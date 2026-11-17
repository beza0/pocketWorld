import type { Country, Difficulty, GameMode, Question, QuestionType } from './types';
import { type Rand, sample, seeded, shuffle } from './rng';

export const ROUND_LENGTH = 10;
export const QUESTION_TYPES: QuestionType[] = ['flag', 'map', 'fact', 'photo'];

export interface CountryIndex {
  all: Country[];
  byId: Record<string, Country>;
}

export function indexCountries(all: Country[]): CountryIndex {
  const byId: Record<string, Country> = {};
  for (const c of all) byId[c.id] = c;
  return { all, byId };
}

/**
 * Picks three distractors.
 * easy: countries from other continents (and, for flags, flags that do not look alike).
 * hard: neighbours / nearby countries, or look-alike flags.
 * Flags that are practically identical (twins) are never shown together.
 */
export function pickDistractors(index: CountryIndex, answerId: string, type: QuestionType, difficulty: Difficulty, rand: Rand): string[] {
  const answer = index.byId[answerId];
  const twins = new Set(answer.flagTwins);
  const usable = (id: string) => id !== answerId && !!index.byId[id] && (type !== 'flag' || !twins.has(id));
  let pool: string[];
  if (difficulty === 'hard') {
    pool = (type === 'flag' ? answer.flagLike.slice(0, 6) : answer.near.slice(0, 7)).filter(usable);
  } else {
    const avoid = new Set<string>([...answer.near, ...(type === 'flag' ? answer.flagLike : [])]);
    pool = index.all.filter((c) => c.continent !== answer.continent && !avoid.has(c.id) && usable(c.id)).map((c) => c.id);
  }
  const picked: string[] = [];
  for (const id of shuffle(pool, rand)) {
    if (picked.length === 3) break;
    // options must also be distinguishable from each other
    if (type === 'flag' && picked.some((p) => index.byId[p].flagTwins.includes(id))) continue;
    // easy mode: spread the options over different continents
    if (difficulty === 'easy' && picked.some((p) => index.byId[p].continent === index.byId[id].continent) && pool.length > 30 && rand() < 0.8) continue;
    picked.push(id);
  }
  if (picked.length < 3) {
    for (const c of shuffle(index.all, rand)) {
      if (picked.length === 3) break;
      if (usable(c.id) && !picked.includes(c.id) && !(type === 'flag' && picked.some((p) => index.byId[p].flagTwins.includes(c.id)))) picked.push(c.id);
    }
  }
  return picked;
}

export function makeQuestion(index: CountryIndex, answerId: string, type: QuestionType, difficulty: Difficulty, rand: Rand): Question {
  const options = shuffle([answerId, ...pickDistractors(index, answerId, type, difficulty, rand)], rand);
  const q: Question = { type, difficulty, answer: answerId, options };
  // easy uses the headline fact; hard uses lesser-known cultural / food clues
  if (type === 'fact') q.clue = difficulty === 'easy' ? 'fact' : rand() < 0.5 ? 'culture' : 'food';
  return q;
}

/** Structural validity: four distinct known options, exactly one of which is the answer. */
export function questionProblems(index: CountryIndex, q: Question): string[] {
  const problems: string[] = [];
  if (q.options.length !== 4) problems.push('needs exactly 4 options');
  if (new Set(q.options).size !== q.options.length) problems.push('duplicate options');
  if (q.options.filter((o) => o === q.answer).length !== 1) problems.push('answer must appear exactly once');
  for (const o of q.options) if (!index.byId[o]) problems.push(`unknown option ${o}`);
  if (q.type === 'flag') {
    for (const a of q.options) for (const b of q.options) if (a !== b && index.byId[a]?.flagTwins.includes(b)) problems.push(`indistinguishable flags ${a}/${b}`);
  }
  if (q.type === 'fact' && !q.clue) problems.push('fact question without clue');
  return problems;
}

// ---------- daily quiz ----------

/** "Bugünün 3 Sorusu": flag, map and headline fact of the day's country, in that order. Same for everyone. */
export function dailyQuiz(index: CountryIndex, dateKey: string, countryId: string): Question[] {
  const rand = seeded(`quiz:${dateKey}:${countryId}`);
  return [
    makeQuestion(index, countryId, 'flag', 'hard', rand),
    makeQuestion(index, countryId, 'map', 'hard', rand),
    makeQuestion(index, countryId, 'fact', 'easy', rand),
  ];
}

/** The four options of the daily mystery; fixed for the whole day and identical on every device. */
export function mysteryOptions(index: CountryIndex, dateKey: string, answerId: string): string[] {
  const rand = seeded(`mystery:${dateKey}:${answerId}`);
  // nearby countries keep all three clues (fact, map, flag) meaningful
  return shuffle([answerId, ...pickDistractors(index, answerId, 'flag', 'easy', rand).slice(0, 1), ...pickNear(index, answerId, rand)], rand);
}

function pickNear(index: CountryIndex, answerId: string, rand: Rand): string[] {
  const answer = index.byId[answerId];
  return sample(answer.near.slice(0, 6).filter((id) => !answer.flagTwins.includes(id)), 2, rand);
}

// ---------- free play ----------

export interface MistakeRecord {
  /** Outstanding weight; decreases when the country is answered correctly later. */
  n: number;
  lastType: QuestionType;
}

export interface RoundOptions {
  mode: GameMode;
  difficulty: Difficulty;
  /** Country ids to ask about (general pool or the user's discovered countries). */
  pool: string[];
  mistakes?: Record<string, MistakeRecord>;
  rand: Rand;
}

export const MAX_REVIEW_PER_ROUND = 3;

/** Balanced type order for mixed mode: every type appears 2–3 times in 10 questions. */
export function mixedTypes(rand: Rand, length = ROUND_LENGTH): QuestionType[] {
  const order = shuffle(QUESTION_TYPES, rand);
  const out: QuestionType[] = [];
  for (let i = 0; i < length; i++) out.push(order[i % order.length]);
  return shuffle(out, rand);
}

/**
 * Builds a round of 10 questions about 10 different countries.
 * Previously missed countries are more likely to come back (at most three per round), and in
 * mixed mode they return with a different question type than the one that was missed.
 */
export function buildRound(index: CountryIndex, { mode, difficulty, pool, mistakes = {}, rand }: RoundOptions): Question[] {
  const ids = [...new Set(pool)].filter((id) => index.byId[id]);
  if (ids.length < ROUND_LENGTH) throw new Error('POOL_TOO_SMALL');
  const types = mode === 'mixed' ? mixedTypes(rand) : Array<QuestionType>(ROUND_LENGTH).fill(mode);

  const review: string[] = [];
  const weighted = ids.filter((id) => (mistakes[id]?.n ?? 0) > 0);
  const bag = shuffle(weighted.flatMap((id) => Array<string>(Math.min(3, mistakes[id].n)).fill(id)), rand);
  for (const id of bag) {
    if (review.length >= MAX_REVIEW_PER_ROUND) break;
    if (!review.includes(id) && rand() < 0.75) review.push(id);
  }
  const rest = shuffle(ids.filter((id) => !review.includes(id)), rand).slice(0, ROUND_LENGTH - review.length);
  const chosen = shuffle([...review, ...rest], rand);

  if (mode === 'mixed') {
    // give review countries a type that differs from the one they were missed with
    for (let i = 0; i < chosen.length; i++) {
      const last = review.includes(chosen[i]) ? mistakes[chosen[i]]?.lastType : undefined;
      if (last && types[i] === last) {
        const j = types.findIndex((t, k) => k !== i && t !== last && !(review.includes(chosen[k]) && mistakes[chosen[k]]?.lastType === types[i]));
        if (j >= 0) [types[i], types[j]] = [types[j], types[i]];
      }
    }
  }
  return chosen.map((id, i) => makeQuestion(index, id, types[i], difficulty, rand));
}

/** Updates the mistake weights after an answer. */
export function recordAnswer(mistakes: Record<string, MistakeRecord>, q: Question, correct: boolean): Record<string, MistakeRecord> {
  const next = { ...mistakes };
  const cur = next[q.answer];
  if (!correct) next[q.answer] = { n: Math.min(3, (cur?.n ?? 0) + 1), lastType: q.type };
  else if (cur) {
    if (cur.n <= 1) delete next[q.answer];
    else next[q.answer] = { ...cur, n: cur.n - 1 };
  }
  return next;
}
