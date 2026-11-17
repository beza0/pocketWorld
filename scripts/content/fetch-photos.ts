/**
 * Fetches one real photo per country from Wikimedia Commons and records its provenance.
 *
 *   npx tsx scripts/content/fetch-photos.ts            # fetch everything that is missing
 *   npx tsx scripts/content/fetch-photos.ts jp tr      # (re)fetch specific countries
 *   npx tsx scripts/content/fetch-photos.ts --encode   # re-encode from cache only (no network)
 *
 * Selection: the lead image of the Wikipedia article named in the editorial header, unless
 * content/photo-overrides.json pins a specific Commons file. Only files hosted on Commons under
 * CC0 / public domain / CC BY / CC BY-SA are accepted. Everything is written to
 * content/photos.lock.json so that the pack can be rebuilt and audited.
 *
 * The crawler is deliberately slow, identifies itself honestly and obeys Retry-After.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, loadEditorial, sha256 } from './lib';

const UA = 'PocketWorldContentBuilder/1.0 (open-source geography app content build; nodejs)';
const CACHE = path.join(ROOT, 'content/.cache/photos');
const OUT = path.join(ROOT, 'assets/content/photos');
const LOCK = path.join(ROOT, 'content/photos.lock.json');
const OVERRIDES = path.join(ROOT, 'content/photo-overrides.json');
export const PHOTO = { width: 1200, height: 800, quality: 68 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;

async function get(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const wait = lastRequest + 2500 - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, redirect: 'follow' });
    } catch (e) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const ra = Number(res.headers.get('retry-after')) || 30;
      await sleep((ra + 2 + attempt * 5) * 1000);
      continue;
    }
    return res;
  }
  throw new Error(`gave up after repeated rate limiting: ${url}`);
}

const strip = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&nbsp;|&#160;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** File names that are almost never a usable landscape/landmark photo. */
const REJECT = /(\bmaps?\b|locator|location|relief|logo|flag|coat of arms|emblem|seal|chart|painting|drawing|engraving|lithograph|satellite|landsat|\bISS\d|\bNASA\b|\bASTER\b|sentinel|interior|\b1[6-9]\d\d\b)/i;

const ACCEPT = /^(CC0|CC BY(-SA)? \d|Public domain|PD\b)/i;

interface Meta { file: string; title: string; author: string; license: string; licenseUrl: string; sourceUrl: string; original: string; width: number; height: number }

/** Reads licence and author from the machine-readable markup of a Commons file page. */
async function commonsMeta(file: string): Promise<Meta | string> {
  const sourceUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
  const res = await get(sourceUrl);
  if (res.status === 404) return 'not on Commons';
  if (!res.ok) return `commons page HTTP ${res.status}`;
  const html = (await res.text()).replace(/&#95;/g, '_');
  if (!/\.(jpe?g)$/i.test(file)) return 'not a JPEG photo';
  const shorts = [...html.matchAll(/class="licensetpl_short"[^>]*>([^<]+)</g)].map((m) => strip(m[1]));
  const links = [...html.matchAll(/class="licensetpl_link"[^>]*>([^<]+)</g)].map((m) => strip(m[1]));
  const idx = shorts.findIndex((s) => ACCEPT.test(s) && !/\b(NC|ND)\b/.test(s));
  if (idx < 0) return `licence not accepted: ${shorts.join(' / ') || 'none found'}`;
  const orig = /class="fullMedia"[\s\S]{0,400}?href="([^"]+)"/.exec(html)?.[1];
  const dims = /class="fileInfo">\s*\(?([\d,.\s]+) × ([\d,.\s]+) pixels/.exec(html);
  if (!orig || !dims) return 'could not read original file info';
  const width = Number(dims[1].replace(/[^\d]/g, '')), height = Number(dims[2].replace(/[^\d]/g, ''));
  if (width < 1000) return `too small (${width}px)`;
  if (height > width * 1.5) return 'portrait orientation';
  const autCell = /id="fileinfotpl_aut"[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/.exec(html)?.[1];
  const attr = /class="licensetpl_attr"[^>]*>([\s\S]*?)<\/span>/.exec(html)?.[1];
  // prefer the Author field; the attribution span can swallow licence boilerplate
  let author = strip(autCell || attr || '').split(/ You are free| This file is| Permission is granted/)[0].trim();
  if (!author && /^(Public domain|PD|CC0)/i.test(shorts[idx])) author = 'Public domain (see source)';
  if (!author) return 'author not found';
  if (author.length > 120) author = author.slice(0, 117) + '…';
  const license = shorts[idx];
  const isPd = /^(Public domain|PD|CC0)/i.test(license);
  return {
    file, title: file.replace(/\.[a-z]+$/i, '').replace(/_/g, ' '), author, license,
    licenseUrl: links[idx] && /^https?:/.test(links[idx]) ? links[idx] : isPd ? 'https://creativecommons.org/publicdomain/mark/1.0/' : '',
    sourceUrl, original: (orig.startsWith('//') ? 'https:' + orig : orig).replace(/&amp;/g, '&').split('?')[0], width, height,
  };
}

const thumbUrl = (original: string, w: number) => {
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f]\/[0-9a-f]{2})\/(.+)$/.exec(original);
  if (!m) return original;
  return `${m[1]}/thumb/${m[2]}/${m[3]}/${w}px-${m[3]}`;
};

/** Candidate Commons file names from a Wikipedia article: lead image first, then other large images. */
async function articleImages(title: string): Promise<string[]> {
  let res = await get(`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  // unknown title: let Wikipedia's own search pick the best matching article
  if (res.status === 404) res = await get(`https://en.wikipedia.org/w/index.php?title=Special:Search&go=Go&search=${encodeURIComponent(title)}`);
  if (!res.ok) throw new Error(`article "${title}" HTTP ${res.status}`);
  const html = await res.text();
  const names: string[] = [];
  const push = (u: string) => {
    const m = /\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/"?]+)/.exec(u);
    if (!m) return;
    const name = decodeURIComponent(m[1]).replace(/_/g, ' ');
    if (/\.jpe?g$/i.test(name) && !REJECT.test(name) && !names.includes(name)) names.push(name);
  };
  const og = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
  if (og) push(og);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const src = /\ssrc="([^"]+)"/.exec(m[0])?.[1];
    const width = Number(/\swidth="(\d+)"/.exec(m[0])?.[1] ?? 0);
    if (src && width >= 150) push(src);
  }
  return names;
}

/** Pinned candidates: exact Commons file names, or "search:<terms>" for the top Commons file-search hits. */
async function expandPinned(pinned: string | string[]): Promise<string[]> {
  const out: string[] = [];
  for (const entry of Array.isArray(pinned) ? pinned : [pinned]) {
    if (!entry.startsWith('search:')) { out.push(entry.replace(/^File:/, '')); continue; }
    const res = await get(`https://commons.wikimedia.org/w/index.php?title=Special:Search&ns6=1&fulltext=1&search=${encodeURIComponent(entry.slice(7))}`);
    const html = await res.text();
    for (const m of html.matchAll(/title="File:([^"]+\.(?:jpe?g|JPE?G))"/g)) {
      const name = m[1].replace(/&#039;/g, "'").replace(/&amp;/g, '&');
      if (!out.includes(name) && !REJECT.test(name)) out.push(name);
      if (out.length >= 8) break;
    }
  }
  return out;
}

async function encode(id: string) {
  fs.mkdirSync(OUT, { recursive: true });
  const buf = await sharp(path.join(CACHE, `${id}.jpg`)).rotate().resize(PHOTO.width, PHOTO.height, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: PHOTO.quality, effort: 6 }).toBuffer();
  fs.writeFileSync(path.join(OUT, `${id}.webp`), buf);
  return buf;
}

async function main() {
  const args = process.argv.slice(2);
  const editorial = loadEditorial();
  const lock: Record<string, any> = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : {};
  const overrides: Record<string, string | string[]> = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')) : {};
  fs.mkdirSync(CACHE, { recursive: true });
  const saveLock = () => {
    const sorted: Record<string, any> = {};
    for (const k of Object.keys(lock).sort()) sorted[k] = lock[k];
    fs.writeFileSync(LOCK, JSON.stringify(sorted, null, 1) + '\n');
  };

  if (args.includes('--encode')) {
    for (const id of Object.keys(lock)) {
      if (!fs.existsSync(path.join(CACHE, `${id}.jpg`))) { console.warn(`no cached original for ${id}`); continue; }
      lock[id].sha256 = sha256(await encode(id));
    }
    saveLock();
    return;
  }

  const only = args.filter((a) => !a.startsWith('--'));
  const todo = [...editorial.keys()].sort().filter((id) => (only.length ? only.includes(id) : !lock[id] || !fs.existsSync(path.join(OUT, `${id}.webp`))));
  console.log(`${todo.length} photo(s) to fetch`);
  const failures: string[] = [];
  for (const id of todo) {
    const ed = editorial.get(id)!;
    try {
      const pinned = overrides[id];
      const candidates = pinned ? await expandPinned(pinned) : (await articleImages(ed.wikiTitle)).slice(0, 10);
      let meta: Meta | null = null;
      const reasons: string[] = [];
      for (const file of candidates) {
        const m = await commonsMeta(file);
        if (typeof m === 'string') { reasons.push(`${file}: ${m}`); continue; }
        meta = m;
        break;
      }
      if (!meta) throw new Error(`no acceptable image (${reasons.join('; ') || 'article has no JPEG'})`);
      const res = await get(thumbUrl(meta.original, 1280));
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      fs.writeFileSync(path.join(CACHE, `${id}.jpg`), Buffer.from(await res.arrayBuffer()));
      const out = await encode(id);
      lock[id] = {
        wikiTitle: ed.wikiTitle, pinned: !!pinned, file: `File:${meta.file}`, title: meta.title, author: meta.author,
        license: meta.license, licenseUrl: meta.licenseUrl, sourceUrl: meta.sourceUrl,
        hiRes: meta.width > 1920 ? thumbUrl(meta.original, 1920) : meta.original,
        originalWidth: meta.width, originalHeight: meta.height, sha256: sha256(out),
      };
      saveLock();
      console.log(`ok ${id}: ${meta.file} [${meta.license}] ${meta.author}`);
    } catch (e: any) {
      failures.push(`${id}: ${e.message}`);
      console.log(`FAIL ${id}: ${e.message}`);
    }
  }
  if (failures.length) { console.log(`\n${failures.length} failure(s):\n` + failures.join('\n')); process.exitCode = 1; }
}

main();
