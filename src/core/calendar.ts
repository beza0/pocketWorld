import type { CalendarCycle, CalendarData } from './types';

const DAY_MS = 86_400_000;
/** Türkiye has used UTC+3 all year since 2016; used only if Intl time zones are unavailable. */
const FALLBACK_OFFSET_MS = 3 * 3_600_000;

let formatter: Intl.DateTimeFormat | null | undefined;

function getFormatter() {
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
      // some engines accept the option but ignore it; sanity-check a known instant
      if (formatParts(formatter, new Date(Date.UTC(2026, 0, 1, 21, 30))) !== '2026-01-02') formatter = null;
    } catch {
      formatter = null;
    }
  }
  return formatter;
}

function formatParts(f: Intl.DateTimeFormat, d: Date) {
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/** Calendar date in Europe/Istanbul (YYYY-MM-DD) for an instant, independent of the device time zone. */
export function istanbulDateKey(now: Date = new Date()): string {
  const f = getFormatter();
  if (f) return formatParts(f, now);
  return new Date(now.getTime() + FALLBACK_OFFSET_MS).toISOString().slice(0, 10);
}

const toDayNumber = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
const fromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

export const addDays = (key: string, days: number) => fromDayNumber(toDayNumber(key) + days);
export const daysBetween = (from: string, to: string) => toDayNumber(to) - toDayNumber(from);

export interface Daily {
  dateKey: string;
  countryId: string;
  mysteryId: string;
  cycleVersion: number;
  /** 0-based position inside the 195-day cycle. */
  index: number;
  /** 1-based number of the published day since the very first cycle. */
  dayNumber: number;
}

function cycleFor(calendar: CalendarData, dateKey: string): CalendarCycle | null {
  let found: CalendarCycle | null = null;
  for (const c of calendar.cycles) {
    if (c.start <= dateKey && (!found || c.start > found.start)) found = c;
  }
  return found;
}

/** The two daily countries for a date. Null before the first published day. */
export function getDaily(calendar: CalendarData, dateKey: string): Daily | null {
  const cycle = cycleFor(calendar, dateKey);
  if (!cycle) return null;
  const n = cycle.countryOrder.length;
  const index = ((daysBetween(cycle.start, dateKey) % n) + n) % n;
  const first = calendar.cycles.reduce((a, b) => (a.start < b.start ? a : b));
  return {
    dateKey,
    countryId: cycle.countryOrder[index],
    mysteryId: cycle.mysteryOrder[index],
    cycleVersion: cycle.version,
    index,
    dayNumber: daysBetween(first.start, dateKey) + 1,
  };
}

export function getToday(calendar: CalendarData, now: Date = new Date()): Daily | null {
  return getDaily(calendar, istanbulDateKey(now));
}

/** Days already published before `todayKey`, newest first. */
export function previousDays(calendar: CalendarData, todayKey: string, limit = 400): Daily[] {
  const first = calendar.cycles.reduce((a, b) => (a.start < b.start ? a : b));
  const out: Daily[] = [];
  for (let key = addDays(todayKey, -1); key >= first.start && out.length < limit; key = addDays(key, -1)) {
    const d = getDaily(calendar, key);
    if (d) out.push(d);
  }
  return out;
}

/** Milliseconds until the next 00:00 in Europe/Istanbul. */
export function msUntilNextDay(now: Date = new Date()): number {
  const today = istanbulDateKey(now);
  // search forward for the first instant whose Istanbul date differs (handles any offset)
  let lo = now.getTime();
  let hi = lo + 25 * 3_600_000;
  while (hi - lo > 500) {
    const mid = Math.floor((lo + hi) / 2);
    if (istanbulDateKey(new Date(mid)) === today) lo = mid;
    else hi = mid;
  }
  return Math.max(0, hi - now.getTime());
}
