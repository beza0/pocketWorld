import { describe, expect, it } from 'vitest';
import { guessMystery, initialMystery, nextMysteryClue } from '../src/core/mystery';

describe('Daily Mystery scoring', () => {
  it('gives 3 / 2 / 1 points for a correct answer on clue 1 / 2 / 3', () => {
    expect(guessMystery(initialMystery(), 'jp', 'jp').score).toBe(3);
    let s = guessMystery(initialMystery(), 'jp', 'kr');
    expect(s.step).toBe(2);
    expect(guessMystery(s, 'jp', 'jp').score).toBe(2);
    s = guessMystery(s, 'jp', 'cn');
    expect(s.step).toBe(3);
    expect(guessMystery(s, 'jp', 'jp')).toMatchObject({ status: 'won', score: 1 });
  });

  it('scores 0 when the last clue is answered wrongly', () => {
    let s = nextMysteryClue(nextMysteryClue(initialMystery()));
    s = guessMystery(s, 'jp', 'kr');
    expect(s).toMatchObject({ status: 'lost', score: 0 });
  });

  it('disables wrong options and ignores them afterwards', () => {
    const s = guessMystery(initialMystery(), 'jp', 'kr');
    expect(s.eliminated).toEqual(['kr']);
    expect(guessMystery(s, 'jp', 'kr')).toBe(s);
  });

  it('"next clue" reveals without guessing but not beyond the third clue', () => {
    const s = nextMysteryClue(nextMysteryClue(initialMystery()));
    expect(s.step).toBe(3);
    expect(nextMysteryClue(s)).toBe(s);
  });

  it('is frozen once finished', () => {
    const won = guessMystery(initialMystery(), 'jp', 'jp');
    expect(guessMystery(won, 'jp', 'kr')).toBe(won);
  });
});
