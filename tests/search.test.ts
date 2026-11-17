import { describe, expect, it } from 'vitest';
import { normalize, searchCountries } from '../src/core/search';
import type { Country } from '../src/core/types';
import data from '../src/data/generated/countries.json';

const countries = data as unknown as Country[];
const first = (q: string, continent: Country['continent'] | null = null) => searchCountries(countries, { query: q, continent })[0]?.id;

describe('country search', () => {
  it('finds Türkiye under every supported spelling', () => {
    for (const q of ['Türkiye', 'Turkiye', 'Turkey', 'TÜRKİYE', 'türk']) expect(first(q)).toBe('tr');
  });
  it('matches Turkish and English names and common aliases', () => {
    expect(first('Japonya')).toBe('jp');
    expect(first('japan')).toBe('jp');
    expect(first('Almanya')).toBe('de');
    expect(first('ABD')).toBe('us');
    expect(first('İngiltere')).toBe('gb');
    expect(first('Fildisi')).toBe('ci');
    expect(first('Cote dIvoire')).toBeDefined();
  });
  it('folds Turkish characters', () => {
    expect(normalize('IĞDIR ŞÇÖÜ')).toBe('igdir scou');
  });
  it('filters by continent and returns everything for an empty query', () => {
    expect(searchCountries(countries, { query: '' })).toHaveLength(195);
    const africa = searchCountries(countries, { continent: 'africa' });
    expect(africa.length).toBe(54);
    expect(first('Japonya', 'europe')).toBeUndefined();
  });
});
