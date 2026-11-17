/**
 * Content build: turns the editorial sources + open datasets into the app's base pack.
 *
 *   content/editorial/*.txt      hand-written TR/EN texts, capital (TR), photo place
 *   content/overrides.json       documented corrections on top of world-countries
 *   content/languages.tr.json    Turkish language names
 *   content/photos.lock.json     photo provenance (written by fetch-photos.ts)
 *   content/calendar.json        versioned daily calendar (created once, then frozen)
 *
 * Outputs src/data/generated/* and assets/content/flags/*.png.
 * Deterministic: same inputs produce byte-identical outputs.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { feature } from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { normalize } from '../../src/core/search';
import type { CalendarData, ContinentId, Country, GeoCountry, GeoData } from '../../src/core/types';
import { ROOT, loadEditorial, mulberry32, shuffle, sha256, writeIfChanged } from './lib';

const wc: any[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/world-countries/countries.json'), 'utf8'));
const overrides = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/overrides.json'), 'utf8'));
const langTr: Record<string, string> = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/languages.tr.json'), 'utf8'));

const OUT = path.join(ROOT, 'src/data/generated');
const FLAG_DIR = path.join(ROOT, 'assets/content/flags');
const PHOTO_DIR = path.join(ROOT, 'assets/content/photos');

const EXTRA = new Set(['PS', 'VA']); // UN observer states
const source = wc.filter((c) => c.unMember || EXTRA.has(c.cca2));

function continentOf(c: any): ContinentId {
  switch (c.region) {
    case 'Africa': return 'africa';
    case 'Asia': return 'asia';
    case 'Europe': return 'europe';
    case 'Oceania': return 'oceania';
    case 'Americas': return c.subregion === 'South America' ? 'south-america' : 'north-america';
    default: throw new Error(`Unknown region for ${c.cca2}: ${c.region}`);
  }
}

const capTr = (s: string) => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);

function haversine(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function main() {
  const editorial = loadEditorial();
  const problems: string[] = [];
  const iso3to2 = new Map<string, string>(source.map((c) => [c.cca3, c.cca2.toLowerCase()]));

  // ---------- flags ----------
  fs.mkdirSync(FLAG_DIR, { recursive: true });
  const thumbs = new Map<string, Buffer>();
  for (const c of source) {
    const id = c.cca2.toLowerCase();
    const svg = fs.readFileSync(path.join(ROOT, `node_modules/flag-icons/flags/4x3/${id}.svg`));
    const out = path.join(FLAG_DIR, `${id}.png`);
    const png = await sharp(svg, { density: 200 }).resize(320, 240, { fit: 'fill' }).png({ palette: true, colours: 128, compressionLevel: 9 }).toBuffer();
    writeIfChanged(out, png);
    thumbs.set(id, await sharp(svg, { density: 100 }).resize(32, 24, { fit: 'fill' }).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer());
  }
  // Similarity = same palette (colour histogram, layout-independent) + same layout (pixel difference).
  const hists = new Map<string, Float64Array>();
  for (const [id, buf] of thumbs) {
    const h = new Float64Array(64);
    for (let i = 0; i < buf.length; i += 3) h[(buf[i] >> 6) * 16 + (buf[i + 1] >> 6) * 4 + (buf[i + 2] >> 6)] += 3 / buf.length;
    hists.set(id, h);
  }
  const flagDist = (a: string, b: string) => {
    const A = thumbs.get(a)!, B = thumbs.get(b)!;
    let pix = 0;
    for (let i = 0; i < A.length; i++) pix += Math.abs(A[i] - B[i]);
    const ha = hists.get(a)!, hb = hists.get(b)!;
    let hist = 0;
    for (let i = 0; i < 64; i++) hist += Math.abs(ha[i] - hb[i]);
    return hist + pix / A.length / 255;
  };
  // Flags that cannot reasonably be told apart in a quiz are curated in overrides.flagTwins.
  const twinPairs: [string, string][] = overrides.flagTwins;
  const isTwin = (a: string, b: string) => twinPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  // ---------- countries ----------
  const countries: Country[] = [];
  for (const c of source) {
    const id = c.cca2.toLowerCase();
    const ed = editorial.get(id);
    if (!ed) { problems.push(`missing editorial: ${id}`); continue; }
    const nameEn: string = overrides.nameEn[id] ?? c.name.common;
    const nameTr: string = overrides.nameTr[id] ?? capTr(c.translations.tur.common);
    const langCodes: string[] = overrides.languages[id] ?? Object.keys(c.languages);
    for (const code of langCodes) if (!langTr[code]) problems.push(`missing TR language name: ${code}`);
    const langEn = (code: string) => (code === 'bar' ? 'German' : code === 'fas' ? 'Persian' : (wc.find((x) => x.languages?.[code])?.languages[code] as string));
    const aliasSet = new Set<string>();
    for (const a of [nameTr, nameEn, c.name.common, c.name.official, c.translations.tur.official, c.translations.tur.common,
      ...(c.altSpellings as string[]).filter((s) => s.length > 2), ...(overrides.aliases[id] ?? [])]) {
      const n = normalize(a);
      if (n) aliasSet.add(n);
    }
    const latlng: [number, number] = [c.latlng[0], c.latlng[1]];
    countries.push({
      id, iso3: c.cca3,
      name: { tr: nameTr, en: nameEn },
      aliases: [...aliasSet],
      capital: { tr: ed.capitalTr, en: ed.capitalEn ?? (c.capital as string[]).join(', ') },
      continent: continentOf(c),
      languages: { tr: [...new Set(langCodes.map((k) => langTr[k]))], en: [...new Set(langCodes.map(langEn))] },
      fact: ed.fact, culture: ed.culture, food: ed.food, sight: ed.sight, place: ed.place,
      near: [], flagLike: [], flagTwins: [], latlng,
    });
  }
  countries.sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(countries.map((c) => [c.id, c]));
  for (const id of editorial.keys()) if (!byId.has(id)) problems.push(`editorial for unknown country: ${id}`);

  for (const c of countries) {
    const src = source.find((s) => s.cca2.toLowerCase() === c.id)!;
    const borders = (src.borders as string[]).map((b) => iso3to2.get(b)).filter((x): x is string => !!x && byId.has(x));
    const nearest = countries.filter((o) => o.id !== c.id && !borders.includes(o.id))
      .map((o) => ({ id: o.id, d: haversine(c.latlng, o.latlng) })).sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
    c.near = [...borders.sort(), ...nearest.map((n) => n.id)].slice(0, 10);
    const dists = countries.filter((o) => o.id !== c.id).map((o) => ({ id: o.id, d: flagDist(c.id, o.id) })).sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
    c.flagTwins = dists.filter((x) => isTwin(c.id, x.id)).map((x) => x.id);
    c.flagLike = dists.filter((x) => !isTwin(c.id, x.id)).slice(0, 8).map((x) => x.id);
  }

  // ---------- geometry ----------
  const W = 2000, H = 1000, LAT_TOP = 84, LAT_BOTTOM = -58;
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
  const ccn3to2 = new Map<string, string>(source.map((c) => [c.ccn3, c.cca2.toLowerCase()]));

  /** Rings that cross the antimeridian are unwrapped and drawn at both map edges (the viewport clips them). */
  const ringPath = (ring: number[][]): string => {
    let crosses = false;
    for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) { crosses = true; break; }
    if (!crosses) return plainRing(ring);
    const east = ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]);
    return plainRing(east) + plainRing(east.map(([lon, lat]) => [lon - 360, lat]));
  };
  const plainRing = (ring: number[][]) => {
    let d = '';
    let last = '';
    ring.forEach(([lon, lat], i) => {
      const p = `${fmt(px(lon))},${fmt(py(Math.max(-89, Math.min(89, lat))))}`;
      if (p === last) return;
      d += (i === 0 ? 'M' : 'L') + p;
      last = p;
    });
    return d + 'Z';
  };
  /** Planar (lon/lat) area and centroid of a ring; world-atlas rings are already cut at the antimeridian. */
  const unwrap = (ring: number[][]) => {
    for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) return ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]);
    return ring;
  };
  const planar = (raw: number[][]) => {
    const ring = unwrap(raw);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (Math.abs(a) < 1e-12) return { area: 0, c: [ring[0][0], ring[0][1]] as [number, number] };
    return { area: Math.abs(a / 2), c: [cx / (3 * a), cy / (3 * a)] as [number, number] };
  };
  const polysOf = (geom: any): number[][][][] => (geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []);

  const loadTopo = (file: string, q: number) => {
    const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/world-atlas', file), 'utf8'));
    const pre = presimplify(topo);
    const simp = simplify(pre, quantile(pre, q));
    return (feature(simp as any, (simp as any).objects.countries) as any).features as any[];
  };
  const features = loadTopo('countries-50m.json', 0.45);
  const tuvalu = loadTopo('countries-10m.json', 0).find((f) => f.id === '798');
  if (tuvalu) features.push(tuvalu);

  const geoCountries: Record<string, GeoCountry> = {};
  let other = '';
  // several features can share one ISO code (e.g. Australia + Ashmore and Cartier Is.): merge them
  const grouped = new Map<string, number[][][][]>();
  for (const f of features) {
    const id = ccn3to2.get(String(f.id));
    const polys = polysOf(f.geometry).filter((p) => p[0].length >= 4);
    if (!id || !byId.has(id)) { if (f.properties?.name !== 'Antarctica') other += polys.map((p) => p.map(ringPath).join('')).join(''); continue; }
    grouped.set(id, [...(grouped.get(id) ?? []), ...polys]);
  }
  for (const [id, polys] of grouped) {
    const d = polys.map((p) => p.map(ringPath).join('')).join('');
    // zoom box: largest polygon plus nearby polygons of the same country
    const withArea = polys.map((p) => ({ p, ...planar(p[0]) })).sort((a, b) => b.area - a.area);
    const main = withArea[0];
    let bw = Infinity, be = -Infinity, bs = Infinity, bn = -Infinity;
    for (const [lon, lat] of unwrap(main.p[0])) { bw = Math.min(bw, lon); be = Math.max(be, lon); bs = Math.min(bs, lat); bn = Math.max(bn, lat); }
    const reach = Math.min(25, Math.max(8, 1.2 * Math.hypot(be - bw, bn - bs)));
    // near the antimeridian, compare in the same (east-shifted) longitude space as the main polygon
    const east = main.c[0] > 90 || be > 180;
    const shift = (lon: number) => (east && lon < 0 ? lon + 360 : lon);
    for (const o of withArea.slice(1)) {
      if (Math.hypot(shift(o.c[0]) - main.c[0], o.c[1] - main.c[1]) > reach) continue;
      for (const [rawLon, lat] of unwrap(o.p[0])) {
        const lon = shift(rawLon); bw = Math.min(bw, lon); be = Math.max(be, lon); bs = Math.min(bs, lat); bn = Math.max(bn, lat); }
    }
    const spanDeg = Math.max(be - bw, bn - bs);
    const pad = Math.max(spanDeg * 0.9, 9); // show surrounding region for context
    const cx = (bw + be) / 2, cy = (bs + bn) / 2;
    const half = Math.max(spanDeg / 2 + pad, 11);
    // keep the zoom window inside the map, sliding it rather than cutting it at the edges
    let zx0 = px(cx - half * 1.25), zx1 = px(cx + half * 1.25);
    if (zx1 > W) { zx0 -= zx1 - W; zx1 = W; }
    if (zx0 < 0) { zx1 = Math.min(W, zx1 - zx0); zx0 = 0; }
    const zy0 = Math.max(py(LAT_TOP), py(cy + half)), zy1 = Math.min(py(LAT_BOTTOM), py(cy - half));
    const small = spanDeg < 4.5;
    // marker point: centroid of the main polygon for small countries, dataset lat/lng otherwise falls inside large ones
    const mlon = main.c[0] > 180 ? main.c[0] - 360 : main.c[0];
    const mc: [number, number] = [px(mlon), py(main.c[1])];
    geoCountries[id] = {
      d,
      c: [Math.round(mc[0] * 10) / 10, Math.round(mc[1] * 10) / 10],
      z: [zx0, zy0, zx1 - zx0, zy1 - zy0].map((n) => Math.round(n * 10) / 10) as GeoCountry['z'],
      s: small ? 1 : 0,
    };
  }
  for (const c of countries) if (!geoCountries[c.id]) problems.push(`missing geometry: ${c.id}`);
  const sortedGeo: Record<string, GeoCountry> = {};
  for (const k of Object.keys(geoCountries).sort()) sortedGeo[k] = geoCountries[k];
  const geo: GeoData = { viewBox: [0, py(LAT_TOP), W, py(LAT_BOTTOM) - py(LAT_TOP)].map((n) => Math.round(n * 10) / 10) as GeoData['viewBox'], other, countries: sortedGeo };

  // ---------- calendar (created once, then frozen) ----------
  const calPath = path.join(ROOT, 'content/calendar.json');
  if (!fs.existsSync(calPath)) {
    const ids = countries.map((c) => c.id);
    const rand = mulberry32(20261101);
    const countryOrder = shuffle(ids, rand);
    let mysteryOrder = shuffle(ids, rand);
    // the two series must never show the same country on the same day, nor on adjacent days
    for (let guard = 0; guard < 1000; guard++) {
      let clash = -1;
      const n = ids.length;
      for (let i = 0; i < n; i++) {
        if ([countryOrder[i], countryOrder[(i + 1) % n], countryOrder[(i + n - 1) % n]].includes(mysteryOrder[i])) { clash = i; break; }
      }
      if (clash < 0) break;
      const j = Math.floor(rand() * n);
      [mysteryOrder[clash], mysteryOrder[j]] = [mysteryOrder[j], mysteryOrder[clash]];
    }
    const cal: CalendarData = { timeZone: 'Europe/Istanbul', cycles: [{ version: 1, start: '2026-11-01', countryOrder, mysteryOrder }] };
    fs.writeFileSync(calPath, JSON.stringify(cal, null, 1) + '\n');
    console.log('created content/calendar.json');
  }
  const calendar: CalendarData = JSON.parse(fs.readFileSync(calPath, 'utf8'));

  // ---------- photos ----------
  const lockPath = path.join(ROOT, 'content/photos.lock.json');
  const lock: Record<string, any> = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : {};
  const attributions: Record<string, any> = {};
  const photoIds: string[] = [];
  for (const c of countries) {
    const l = lock[c.id];
    if (l && fs.existsSync(path.join(PHOTO_DIR, `${c.id}.webp`))) {
      photoIds.push(c.id);
      attributions[c.id] = { title: l.title, author: String(l.author).split(/ You are free| This file is| Permission is granted/)[0].trim(), license: l.license, licenseUrl: l.licenseUrl, sourceUrl: l.sourceUrl, hiRes: l.hiRes };
    }
  }

  // ---------- write ----------
  fs.mkdirSync(OUT, { recursive: true });
  const contentVersion = sha256(JSON.stringify([countries, geo, calendar, attributions])).slice(0, 12);
  writeIfChanged(path.join(OUT, 'countries.json'), JSON.stringify(countries));
  writeIfChanged(path.join(OUT, 'geo.json'), JSON.stringify(geo));
  writeIfChanged(path.join(OUT, 'calendar.json'), JSON.stringify(calendar));
  writeIfChanged(path.join(OUT, 'attributions.json'), JSON.stringify(attributions));
  const assetMap = (name: string, dir: string, ext: string, ids: string[]) =>
    `// GENERATED by scripts/content/build.ts — do not edit.\n/* eslint-disable */\nexport const ${name}: Record<string, number> = {\n` +
    ids.map((id) => `  ${id}: require('../../../assets/content/${dir}/${id}.${ext}'),`).join('\n') + '\n};\n';
  writeIfChanged(path.join(OUT, 'flagAssets.ts'), assetMap('flagAssets', 'flags', 'png', countries.map((c) => c.id)));
  writeIfChanged(path.join(OUT, 'photoAssets.ts'), assetMap('photoAssets', 'photos', 'webp', photoIds));

  const dirSize = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0) : 0);
  const fileSize = (f: string) => fs.statSync(path.join(OUT, f)).size;
  const sizes = {
    countriesJson: fileSize('countries.json'), geoJson: fileSize('geo.json'), calendarJson: fileSize('calendar.json'),
    attributionsJson: fileSize('attributions.json'), flags: dirSize(FLAG_DIR), photos: dirSize(PHOTO_DIR),
  };
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const meta = { contentVersion, countryCount: countries.length, photoCount: photoIds.length, sizes, totalBytes: total };
  writeIfChanged(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));

  console.log(`countries: ${countries.length}, photos: ${photoIds.length}, version ${contentVersion}`);
  console.log(`base pack: ${(total / 1e6).toFixed(2)} MB`, sizes);
  if (problems.length) {
    console.error('PROBLEMS:\n' + problems.join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
