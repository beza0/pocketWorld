/** Günün Gizemi: three clues, four fixed options, 3/2/1/0 points. */
export type MysteryStatus = 'playing' | 'won' | 'lost';

export interface MysteryState {
  /** Number of clues revealed (1 = fact, 2 = + map, 3 = + flag). */
  step: 1 | 2 | 3;
  /** Wrongly guessed options, now disabled. */
  eliminated: string[];
  status: MysteryStatus;
  score: number;
}

export const MYSTERY_MAX_SCORE = 3;
export const mysteryPoints = (step: number) => Math.max(0, 4 - step);

export const initialMystery = (): MysteryState => ({ step: 1, eliminated: [], status: 'playing', score: 0 });

export function guessMystery(state: MysteryState, answerId: string, guessId: string): MysteryState {
  if (state.status !== 'playing' || state.eliminated.includes(guessId)) return state;
  if (guessId === answerId) return { ...state, status: 'won', score: mysteryPoints(state.step) };
  const eliminated = [...state.eliminated, guessId];
  if (state.step === 3) return { ...state, eliminated, status: 'lost', score: 0 };
  return { ...state, eliminated, step: (state.step + 1) as 2 | 3 };
}

/** Reveal the next clue without guessing. Not possible on the last clue. */
export function nextMysteryClue(state: MysteryState): MysteryState {
  if (state.status !== 'playing' || state.step === 3) return state;
  return { ...state, step: (state.step + 1) as 2 | 3 };
}
