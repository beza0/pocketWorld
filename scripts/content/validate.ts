/**
 * Automatic content validation. The first release is not considered complete unless this passes.
 *
 *   npx tsx scripts/content/validate.ts                 # full validation
 *   npx tsx scripts/content/validate.ts --allow-missing-photos   # while the photo set is still being fetched
 *   npx tsx scripts/content/validate.ts --write-lock    # record the calendar hash after intentionally adding a cycle
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getDaily, addDays, istanbulDateKey } from '../../src/core/calendar';
import { QUESTION_TYPES, buildRound, dailyQuiz, indexCountries, makeQuestion, mysteryOptions, pickDistractors, questionProblems } from '../../src/core/questions';
import { mulberry32 } from '../../src/core/rng';
import { normalize, searchCountries } from '../../src/core/search';
import type { CalendarData, Country, Difficulty, GeoData } from '../../src/core/types';
import { ROOT, sha256 } from './lib';

const args = new Set(process.argv.slice(2));
const GEN = path.join(ROOT, 'src/data/generated');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(GEN, f), 'utf8'));

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);

const countries: Country[] = read('countries.json');
const geo: GeoData = read('geo.json');
const calendar: CalendarData = read('calendar.json');
const attributions: Record<string, any> = read('attributions.json');
const meta = read('meta.json');
const lock: Record<string, any> = fs.existsSync(path.join(ROOT, 'content/photos.lock.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'content/photos.lock.json'), 'utf8')) : {};
const wc: any[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/world-countries/countries.json'), 'utf8'));
const index = indexCountries(countries);

// ---------- 1. scope: 193 UN members + Palestine + Vatican ----------
const expected = wc.filter((c) => c.unMember || c.cca2 === 'PS' || c.cca2 === 'VA').map((c) => c.cca2.toLowerCase()).sort();
// world-countries marks the Holy See as a UN member; it is a permanent observer (see content/README.md)
const unMembers = wc.filter((c) => c.unMember && c.cca2 !== 'VA').length;
if (unMembers !== 193) err(`expected 193 UN members in source data, found ${unMembers}`);
const ids = countries.map((c) => c.id).sort();
if (ids.length !== 195) err(`expected 195 countries, found ${ids.length}`);
if (new Set(ids).size !== ids.length) err('duplicate country ids');
for (const id of expected) if (!index.byId[id]) err(`missing country: ${id}`);
for (const id of ids) if (!expected.includes(id)) err(`unexpected country: ${id}`);

// ---------- 2. bilingual completeness + clue safety ----------
const GENERIC = new Set('south north new republic islands island united saint guney kuzey yeni cumhuriyeti adalari birlesik and ve of the demokratik democratic central orta east dogu west bati equatorial ekvator arab arap states kingdom krallik emirlikleri emirates city sehri federal african afrika sahili coast devleti state great land'.split(' '));
const TEXT_FIELDS = ['fact', 'culture', 'food', 'sight'] as const;
const CLUE_FIELDS = ['fact', 'culture', 'food'] as const;
for (const c of countries) {
  for (const lang of ['tr', 'en'] as const) {
    if (!c.name[lang]?.trim()) err(`${c.id}: missing name (${lang})`);
    if (!c.capital[lang]?.trim()) err(`${c.id}: missing capital (${lang})`);
    if (!c.place[lang]?.trim()) err(`${c.id}: missing place name (${lang})`);
    if (!c.languages[lang]?.length || c.languages[lang].some((l) => !l)) err(`${c.id}: missing languages (${lang})`);
    for (const f of TEXT_FIELDS) {
      const text = c[f][lang]?.trim() ?? '';
      if (text.length < 25) err(`${c.id}: ${f} (${lang}) missing or too short`);
      if (text.length > 260) err(`${c.id}: ${f} (${lang}) is too long for a short card text (${text.length})`);
      if (!/[.!?]$/.test(text)) err(`${c.id}: ${f} (${lang}) should end with punctuation`);
    }
  }
  for (const f of TEXT_FIELDS) if (c[f].tr.trim() === c[f].en.trim()) err(`${c.id}: ${f} is identical in TR and EN (untranslated?)`);
  if (c.languages.tr.length !== c.languages.en.length) err(`${c.id}: language lists differ in length`);
  if (!c.aliases.includes(normalize(c.name.tr)) || !c.aliases.includes(normalize(c.name.en))) err(`${c.id}: names missing from search aliases`);

  // clue texts must not give the answer away: no country name, alias, demonym stem or capital
  const banned = new Set<string>();
  for (const name of [c.name.tr, c.name.en]) {
    const n = normalize(name);
    banned.add(n);
    for (const w of n.split(' ')) if (w.length >= 5 && !GENERIC.has(w)) banned.add(w.slice(0, Math.max(5, w.length - 2)));
  }
  for (const a of c.aliases) if (a.length >= 5 && !a.includes(' ')) banned.add(a);
  for (const lang of ['tr', 'en'] as const) {
    for (const cap of c.capital[lang].split(',')) {
      const n = normalize(cap);
      if (n.length >= 4 && n !== normalize(c.name[lang])) banned.add(n);
    }
  }
  for (const f of CLUE_FIELDS) {
    for (const lang of ['tr', 'en'] as const) {
      const words = ` ${normalize(c[f][lang])} `;
      for (const b of banned) if (words.includes(` ${b}`)) err(`${c.id}: ${f} (${lang}) reveals the answer ("${b}")`);
    }
  }
}

// ---------- 3. search ----------
for (const c of countries) {
  for (const q of [c.name.tr, c.name.en, normalize(c.name.tr), c.name.tr.toLocaleUpperCase('tr')]) {
    const hit = searchCountries(countries, { query: q })[0];
    if (hit?.id !== c.id) err(`search: "${q}" should find ${c.id} first, got ${hit?.id}`);
  }
}
for (const q of ['Türkiye', 'Turkiye', 'Turkey', 'TÜRKİYE', 'turkıye']) if (searchCountries(countries, { query: q })[0]?.id !== 'tr') err(`search: "${q}" should find tr`);

// ---------- 4. map ----------
const [vx, vy, vw, vh] = geo.viewBox;
for (const c of countries) {
  const g = geo.countries[c.id];
  if (!g) { err(`${c.id}: no map geometry`); continue; }
  if (!g.d.startsWith('M')) err(`${c.id}: empty map path`);
  if (g.c[0] < vx || g.c[0] > vx + vw || g.c[1] < vy || g.c[1] > vy + vh) err(`${c.id}: marker outside the map`);
  if (g.z[2] < 60 || g.z[3] < 60) err(`${c.id}: zoom box too small`);
  if (g.z[2] > 1200 && !['ru', 'us', 'ca'].includes(c.id)) warnings.push(`${c.id}: zoom box is very wide (${g.z[2]})`);
  // tiny shapes must carry the "small" flag so the marker ring is drawn
  const coords = g.d.match(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/g)!.map((p) => p.split(',').map(Number));
  const w = Math.max(...coords.map((p) => p[0])) - Math.min(...coords.map((p) => p[0]));
  const h = Math.max(...coords.map((p) => p[1])) - Math.min(...coords.map((p) => p[1]));
  if (Math.max(w, h) < 8 && !g.s) err(`${c.id}: too small to see at world scale but not flagged for a marker`);
}

// ---------- 5. calendar ----------
const lockFile = path.join(ROOT, 'content/calendar.lock.json');
const calLock: Record<string, string> = fs.existsSync(lockFile) ? JSON.parse(fs.readFileSync(lockFile, 'utf8')) : {};
const today = istanbulDateKey();
if (calendar.timeZone !== 'Europe/Istanbul') err('calendar time zone must be Europe/Istanbul');
for (const cycle of calendar.cycles) {
  for (const key of ['countryOrder', 'mysteryOrder'] as const) {
    const order = cycle[key];
    if (order.length !== 195 || new Set(order).size !== 195 || order.some((id) => !index.byId[id])) err(`calendar v${cycle.version}: ${key} is not a permutation of the 195 countries`);
  }
  cycle.countryOrder.forEach((id, i) => { if (id === cycle.mysteryOrder[i]) err(`calendar v${cycle.version}: day ${i} uses ${id} for both series`); });
  const hash = sha256(JSON.stringify(cycle));
  const known = calLock[`v${cycle.version}`];
  if (args.has('--write-lock') && (!known || cycle.start > today)) calLock[`v${cycle.version}`] = hash;
  else if (!known) err(`calendar v${cycle.version} has no lock entry (run with --write-lock once)`);
  else if (known !== hash) err(`calendar v${cycle.version} changed after it was locked — published days must never change; add a new cycle instead`);
}
if (args.has('--write-lock')) fs.writeFileSync(lockFile, JSON.stringify(calLock, null, 1) + '\n');
const first = calendar.cycles.map((c) => c.start).sort()[0];
for (let i = 0; i < 195 * 2; i++) {
  const d = getDaily(calendar, addDays(first, i));
  if (!d || d.countryId === d.mysteryId) err(`calendar: invalid daily pair on ${addDays(first, i)}`);
}

// ---------- 6. questions ----------
let generated = 0;
for (const c of countries) {
  for (const type of QUESTION_TYPES) {
    for (const difficulty of ['easy', 'hard'] as Difficulty[]) {
      for (let seed = 1; seed <= 6; seed++) {
        const q = makeQuestion(index, c.id, type, difficulty, mulberry32(seed * 7919 + c.id.charCodeAt(0) * 31 + c.id.charCodeAt(1)));
        generated++;
        for (const p of questionProblems(index, q)) err(`question ${c.id}/${type}/${difficulty}: ${p}`);
        if (difficulty === 'easy' && type !== 'flag') {
          for (const o of q.options) if (o !== c.id && index.byId[o].continent === c.continent) err(`question ${c.id}/${type}/easy: distractor ${o} is on the same continent`);
        }
        if (difficulty === 'hard') {
          const pool = type === 'flag' ? c.flagLike : c.near;
          for (const o of q.options) if (o !== c.id && !pool.includes(o)) err(`question ${c.id}/${type}/hard: distractor ${o} is not a neighbour / look-alike`);
        }
      }
      if (new Set(pickDistractors(index, c.id, type, difficulty, mulberry32(1))).size !== 3) err(`question ${c.id}/${type}/${difficulty}: fewer than 3 distractors`);
    }
  }
  if (c.flagTwins.some((t) => !index.byId[t].flagTwins.includes(c.id))) err(`${c.id}: flag twin relation is not symmetric`);
}
for (let i = 0; i < 195; i++) {
  const d = getDaily(calendar, addDays(first, i))!;
  const quiz = dailyQuiz(index, d.dateKey, d.countryId);
  if (quiz.map((q) => q.type).join() !== 'flag,map,fact') err(`daily quiz ${d.dateKey}: wrong question order`);
  for (const q of quiz) for (const p of questionProblems(index, q)) err(`daily quiz ${d.dateKey}: ${p}`);
  const options = mysteryOptions(index, d.dateKey, d.mysteryId);
  if (options.length !== 4 || new Set(options).size !== 4 || !options.includes(d.mysteryId)) err(`mystery ${d.dateKey}: invalid options`);
  if (options.some((o) => index.byId[d.mysteryId].flagTwins.includes(o))) err(`mystery ${d.dateKey}: an option has an indistinguishable flag`);
}
for (let seed = 1; seed <= 200; seed++) {
  const round = buildRound(index, { mode: 'mixed', difficulty: seed % 2 ? 'easy' : 'hard', pool: ids, rand: mulberry32(seed) });
  if (new Set(round.map((q) => q.answer)).size !== 10) err(`round seed ${seed}: repeated country`);
  const counts = QUESTION_TYPES.map((t) => round.filter((q) => q.type === t).length);
  if (Math.min(...counts) < 2 || Math.max(...counts) > 3) err(`round seed ${seed}: unbalanced types ${counts}`);
}

// ---------- 7. assets + licences ----------
const ACCEPTED = /^(CC0|CC BY(-SA)? \d(\.\d)?|Public domain|PD\b)/i;

async function assets() {
  let photoCount = 0;
  for (const c of countries) {
    const flag = path.join(ROOT, `assets/content/flags/${c.id}.png`);
    if (!fs.existsSync(flag)) { err(`${c.id}: flag image missing`); continue; }
    const fm = await sharp(flag).metadata();
    if (fm.width !== 320 || fm.height !== 240) err(`${c.id}: flag has unexpected size`);

    const photo = path.join(ROOT, `assets/content/photos/${c.id}.webp`);
    const l = lock[c.id];
    if (!fs.existsSync(photo) || !l || !attributions[c.id]) {
      if (!args.has('--allow-missing-photos')) err(`${c.id}: photo or its provenance record is missing`);
      continue;
    }
    photoCount++;
    const buf = fs.readFileSync(photo);
    const pm = await sharp(buf).metadata();
    if (pm.format !== 'webp' || (pm.width ?? 0) < 900) err(`${c.id}: photo is not a WebP of the expected size`);
    if (sha256(buf) !== l.sha256) err(`${c.id}: photo file does not match its lock entry`);
    if (!ACCEPTED.test(l.license) || /\b(NC|ND)\b/.test(l.license)) err(`${c.id}: licence "${l.license}" does not allow redistribution in the app`);
    if (!l.author?.trim()) err(`${c.id}: photo author missing`);
    if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(l.sourceUrl ?? '')) err(`${c.id}: photo source URL missing`);
    if (!/^https:\/\/upload\.wikimedia\.org\//.test(l.hiRes ?? '')) err(`${c.id}: high-resolution URL missing`);
    if (/^CC BY/i.test(l.license) && !/^https?:\/\//.test(l.licenseUrl ?? '')) err(`${c.id}: licence URL missing for ${l.license}`);
  }
  return photoCount;
}

assets().then((photoCount) => {
  const total = meta.totalBytes as number;
  console.log(`countries: ${countries.length} (UN members: ${unMembers}, observers: 2)`);
  console.log(`photos with provenance: ${photoCount} / ${countries.length}`);
  console.log(`questions generated and checked: ${generated} (+195 daily quizzes, 195 mysteries, 200 mixed rounds)`);
  console.log(`base content pack: ${(total / 1e6).toFixed(2)} MB (target ≈ 30 MB)`, meta.sizes);
  if (total > 36e6) err(`base pack is ${(total / 1e6).toFixed(1)} MB, well above the 30 MB target`);
  for (const w of warnings) console.log('warning: ' + w);
  if (errors.length) {
    console.error(`\nFAILED with ${errors.length} error(s):`);
    for (const e of errors.slice(0, 200)) console.error(' - ' + e);
    process.exit(1);
  }
  console.log('\nContent validation passed.');
});
