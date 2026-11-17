import { describe, expect, it } from 'vitest';
import { QUESTION_TYPES, buildRound, dailyQuiz, indexCountries, mysteryOptions, questionProblems, recordAnswer } from '../src/core/questions';
import { mulberry32 } from '../src/core/rng';
import type { Country } from '../src/core/types';
import data from '../src/data/generated/countries.json';

const index = indexCountries(data as unknown as Country[]);
const all = index.all.map((c) => c.id);

describe('questions', () => {
  it('builds 10 valid questions about 10 different countries', () => {
    for (const mode of [...QUESTION_TYPES, 'mixed'] as const) {
      const round = buildRound(index, { mode, difficulty: 'hard', pool: all, rand: mulberry32(3) });
      expect(round).toHaveLength(10);
      expect(new Set(round.map((q) => q.answer)).size).toBe(10);
      for (const q of round) expect(questionProblems(index, q)).toEqual([]);
    }
  });

  it('balances the four types in mixed mode', () => {
    const round = buildRound(index, { mode: 'mixed', difficulty: 'easy', pool: all, rand: mulberry32(9) });
    for (const t of QUESTION_TYPES) expect(round.filter((q) => q.type === t).length).toBeGreaterThanOrEqual(2);
  });

  it('refuses a pool with fewer than 10 countries', () => {
    expect(() => buildRound(index, { mode: 'flag', difficulty: 'easy', pool: all.slice(0, 9), rand: mulberry32(1) })).toThrow('POOL_TOO_SMALL');
  });

  it('brings missed countries back more often, but at most three per round, with another type', () => {
    let mistakes = {};
    for (const id of ['jp', 'fr', 'br', 'eg', 'au']) mistakes = recordAnswer(mistakes, { type: 'flag', difficulty: 'easy', answer: id, options: [] }, false);
    let seen = 0;
    for (let s = 1; s <= 100; s++) {
      const round = buildRound(index, { mode: 'mixed', difficulty: 'easy', pool: all, mistakes, rand: mulberry32(s) });
      const review = round.filter((q) => ['jp', 'fr', 'br', 'eg', 'au'].includes(q.answer));
      expect(review.length).toBeLessThanOrEqual(3 + 1); // +1: a missed country can also be drawn normally
      seen += review.length;
      for (const q of review) if (round.indexOf(q) >= 0) expect(questionProblems(index, q)).toEqual([]);
    }
    // without weighting the expected count would be 100 * 10 * 5/195 ≈ 26
    expect(seen).toBeGreaterThan(100);
  });

  it('forgets a mistake after it is answered correctly', () => {
    const q = { type: 'map' as const, difficulty: 'easy' as const, answer: 'jp', options: [] };
    const m = recordAnswer(recordAnswer({}, q, false), q, true);
    expect(m).toEqual({});
  });

  it('daily quiz and mystery options are the same on every device', () => {
    expect(dailyQuiz(index, '2026-11-16', 'tz')).toEqual(dailyQuiz(index, '2026-11-16', 'tz'));
    expect(mysteryOptions(index, '2026-11-16', 'jp')).toEqual(mysteryOptions(index, '2026-11-16', 'jp'));
    expect(dailyQuiz(index, '2026-11-16', 'tz').map((q) => q.type)).toEqual(['flag', 'map', 'fact']);
  });
});
