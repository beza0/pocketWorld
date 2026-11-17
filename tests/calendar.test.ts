import { describe, expect, it } from 'vitest';
import { addDays, getDaily, istanbulDateKey, msUntilNextDay, previousDays } from '../src/core/calendar';
import type { CalendarData } from '../src/core/types';
import calendar from '../src/data/generated/calendar.json';

const cal = calendar as CalendarData;
const start = cal.cycles[0].start;

describe('Istanbul day boundary', () => {
  it('switches at 00:00 Europe/Istanbul (21:00 UTC), whatever the device time zone', () => {
    expect(istanbulDateKey(new Date('2026-11-16T20:59:59Z'))).toBe('2026-11-16');
    expect(istanbulDateKey(new Date('2026-11-16T21:00:00Z'))).toBe('2026-11-17');
    // the same instant gives the same day for a user in New York, Tokyo or Istanbul
    const instant = new Date('2026-11-17T02:30:00-05:00'); // 07:30 UTC
    expect(istanbulDateKey(instant)).toBe('2026-11-17');
  });

  it('keeps the same pair for the whole Istanbul day and changes it exactly at midnight', () => {
    const before = getDaily(cal, istanbulDateKey(new Date('2026-11-16T20:59:00Z')))!;
    const sameDay = getDaily(cal, istanbulDateKey(new Date('2026-11-15T21:00:00Z')))!;
    const after = getDaily(cal, istanbulDateKey(new Date('2026-11-16T21:00:00Z')))!;
    expect(before.countryId).toBe(sameDay.countryId);
    expect(after.countryId).not.toBe(before.countryId);
    expect(after.mysteryId).not.toBe(before.mysteryId);
  });

  it('computes the time left until the next Istanbul midnight', () => {
    const ms = msUntilNextDay(new Date('2026-11-16T20:00:00Z'));
    expect(Math.abs(ms - 3_600_000)).toBeLessThan(1000);
  });
});

describe('daily calendar', () => {
  it('shows every country exactly once per 195-day cycle in both series, never the same one on the same day', () => {
    const countries = new Set<string>();
    const mysteries = new Set<string>();
    for (let i = 0; i < 195; i++) {
      const d = getDaily(cal, addDays(start, i))!;
      expect(d.countryId).not.toBe(d.mysteryId);
      countries.add(d.countryId);
      mysteries.add(d.mysteryId);
    }
    expect(countries.size).toBe(195);
    expect(mysteries.size).toBe(195);
  });

  it('repeats the cycle after 195 days and is deterministic', () => {
    expect(getDaily(cal, addDays(start, 195))!.countryId).toBe(getDaily(cal, start)!.countryId);
    expect(getDaily(cal, '2027-03-01')).toEqual(getDaily(cal, '2027-03-01'));
  });

  it('never rewrites past days when a new cycle version is appended', () => {
    const next: CalendarData = {
      ...cal,
      cycles: [...cal.cycles, { version: 2, start: '2027-06-01', countryOrder: [...cal.cycles[0].countryOrder].reverse(), mysteryOrder: [...cal.cycles[0].mysteryOrder].reverse() }],
    };
    for (let i = 0; i < 200; i++) {
      const day = addDays(start, i);
      expect(getDaily(next, day)).toEqual(getDaily(cal, day));
    }
    expect(getDaily(next, '2027-06-01')!.cycleVersion).toBe(2);
  });

  it('returns nothing before the first published day and lists previous days newest first', () => {
    expect(getDaily(cal, addDays(start, -1))).toBeNull();
    const prev = previousDays(cal, addDays(start, 3));
    expect(prev.map((d) => d.dateKey)).toEqual([addDays(start, 2), addDays(start, 1), start]);
  });
});
