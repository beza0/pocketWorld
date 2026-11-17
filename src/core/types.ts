export type Lang = 'tr' | 'en';
export type L10n = Record<Lang, string>;
export type ContinentId = 'africa' | 'asia' | 'europe' | 'north-america' | 'south-america' | 'oceania';

export const CONTINENTS: ContinentId[] = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'oceania'];

/** A country record. `id` is the lowercase ISO 3166-1 alpha-2 code and never changes. */
export interface Country {
  id: string;
  iso3: string;
  name: L10n;
  /** Normalised search keys (both languages, alternative spellings). */
  aliases: string[];
  capital: L10n;
  continent: ContinentId;
  languages: { tr: string[]; en: string[] };
  fact: L10n;
  culture: L10n;
  food: L10n;
  sight: L10n;
  /** Name of the photographed place. */
  place: L10n;
  /** Neighbours first, then nearest countries. Used for hard distractors. */
  near: string[];
  /** Countries whose flags look alike (but are still distinguishable). */
  flagLike: string[];
  /** Flags that are practically indistinguishable; never shown together. */
  flagTwins: string[];
  latlng: [number, number];
}

export interface PhotoAttribution {
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  /** Remote high-resolution rendition, loaded on demand. */
  hiRes: string;
}

export interface GeoCountry {
  /** SVG path in map units. */
  d: string;
  /** Marker point [x, y]. */
  c: [number, number];
  /** Zoom box [x, y, w, h]. */
  z: [number, number, number, number];
  /** 1 when the country is too small to read at world scale. */
  s: 0 | 1;
}

export interface GeoData {
  viewBox: [number, number, number, number];
  other: string;
  countries: Record<string, GeoCountry>;
}

export interface CalendarCycle {
  version: number;
  /** First day of the cycle, Europe/Istanbul calendar date (YYYY-MM-DD). */
  start: string;
  countryOrder: string[];
  mysteryOrder: string[];
}

export interface CalendarData {
  timeZone: 'Europe/Istanbul';
  cycles: CalendarCycle[];
}

export type QuestionType = 'flag' | 'map' | 'fact' | 'photo';
export type Difficulty = 'easy' | 'hard';
export type GameMode = QuestionType | 'mixed';

export interface Question {
  type: QuestionType;
  difficulty: Difficulty;
  answer: string;
  options: string[];
  /** For fact questions: which text field is the clue. */
  clue?: 'fact' | 'culture' | 'food';
}
