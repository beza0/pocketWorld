import type { CalendarData, Country, GeoData, PhotoAttribution } from '../core/types';
import { indexCountries } from '../core/questions';
import countriesJson from './generated/countries.json';
import geoJson from './generated/geo.json';
import calendarJson from './generated/calendar.json';
import attributionsJson from './generated/attributions.json';
import metaJson from './generated/meta.json';

export { flagAssets } from './generated/flagAssets';
export { photoAssets } from './generated/photoAssets';

export const countries = countriesJson as unknown as Country[];
export const countryIndex = indexCountries(countries);
export const geo = geoJson as unknown as GeoData;
export const calendar = calendarJson as unknown as CalendarData;
export const attributions = attributionsJson as unknown as Record<string, PhotoAttribution>;
export const contentMeta = metaJson as { contentVersion: string; countryCount: number; photoCount: number; totalBytes: number; sizes: Record<string, number> };

export const getCountry = (id: string | undefined | null): Country | undefined => (id ? countryIndex.byId[id.toLowerCase()] : undefined);
