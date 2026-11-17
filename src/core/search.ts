import type { ContinentId, Country } from './types';

const MAP: Record<string, string> = {
  ı: 'i', İ: 'i', I: 'i', ş: 's', Ş: 's', ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o',
  ß: 'ss', æ: 'ae', ø: 'o', đ: 'd', ł: 'l',
};

/** Folds Turkish and Latin diacritics so "Türkiye", "Turkiye" and "TÜRKİYE" compare equal. */
export function normalize(input: string): string {
  let out = '';
  for (const ch of input) out += MAP[ch] ?? ch;
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface SearchOptions {
  query?: string;
  continent?: ContinentId | null;
}

/** Filters and ranks countries: exact alias, then prefix, then word prefix, then substring. */
export function searchCountries(countries: Country[], { query = '', continent = null }: SearchOptions): Country[] {
  const q = normalize(query);
  const pool = continent ? countries.filter((c) => c.continent === continent) : countries;
  if (!q) return pool;
  const scored: { c: Country; score: number; slack: number }[] = [];
  for (const c of pool) {
    let best = 0;
    let slack = Infinity; // how much longer the matched alias is than the query (closer = better)
    for (const a of c.aliases) {
      let s = 0;
      if (a === q) s = 4;
      else if (a.startsWith(q)) s = 3;
      else if (a.split(' ').some((w) => w.startsWith(q))) s = 2;
      else if (q.length >= 3 && a.includes(q)) s = 1;
      if (s > best || (s === best && s > 0 && a.length - q.length < slack)) {
        best = s;
        slack = a.length - q.length;
      }
    }
    if (best > 0) scored.push({ c, score: best, slack });
  }
  scored.sort((a, b) => b.score - a.score || a.slack - b.slack);
  return scored.map((s) => s.c);
}
