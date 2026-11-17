/**
 * Progress model and deterministic merge.
 *
 * Every record has a natural key, so merging two copies (guest + account, or two devices) can
 * never produce duplicates:
 *   - discoveries are keyed by country id      → last write wins (ties: "discovered" wins)
 *   - daily results are keyed by kind + date   → the FIRST completed result wins
 *       (ties: lexicographically smaller deviceId, then the higher score)
 * The same rules are enforced server-side in supabase/migrations.
 */
export type DailyKind = 'quiz' | 'mystery';

export interface Discovery {
  on: boolean;
  /** ISO timestamp of the last change. */
  at: string;
}

export interface DailyResult {
  kind: DailyKind;
  /** Europe/Istanbul date key. */
  date: string;
  score: number;
  max: number;
  /** Per-question correctness for the quiz, or revealed clue count for the mystery. */
  detail: number[];
  completedAt: string;
  deviceId: string;
}

export interface Progress {
  discovered: Record<string, Discovery>;
  daily: Record<string, DailyResult>;
  /** Keys changed locally and not yet confirmed by the server ("d:<id>" / "r:<kind>:<date>"). */
  pending: string[];
}

export const emptyProgress = (): Progress => ({ discovered: {}, daily: {}, pending: [] });
export const dailyKey = (kind: DailyKind, date: string) => `${kind}:${date}`;

export function pickDiscovery(a: Discovery | undefined, b: Discovery | undefined): Discovery | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return a.on ? a : b;
}

export function pickDaily(a: DailyResult | undefined, b: DailyResult | undefined): DailyResult | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.completedAt !== b.completedAt) return a.completedAt < b.completedAt ? a : b;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? a : b;
  return a.score >= b.score ? a : b;
}

/** Commutative, associative and idempotent: merge(a, b) = merge(b, a), merge(a, a) = a. */
export function mergeProgress(a: Progress, b: Pick<Progress, 'discovered' | 'daily'> & { pending?: string[] }): Progress {
  const discovered: Record<string, Discovery> = {};
  for (const id of new Set([...Object.keys(a.discovered), ...Object.keys(b.discovered)])) {
    discovered[id] = pickDiscovery(a.discovered[id], b.discovered[id])!;
  }
  const daily: Record<string, DailyResult> = {};
  for (const key of new Set([...Object.keys(a.daily), ...Object.keys(b.daily)])) {
    daily[key] = pickDaily(a.daily[key], b.daily[key])!;
  }
  return { discovered, daily, pending: [...new Set([...a.pending, ...(b.pending ?? [])])].sort() };
}

export function setDiscovered(p: Progress, countryId: string, on: boolean, now: Date = new Date()): Progress {
  const prev = p.discovered[countryId];
  if (prev?.on === on) return p;
  // timestamps must move forward even if the device clock went backwards
  let at = now.toISOString();
  if (prev && at <= prev.at) at = new Date(Date.parse(prev.at) + 1).toISOString();
  return { ...p, discovered: { ...p.discovered, [countryId]: { on, at } }, pending: addPending(p.pending, `d:${countryId}`) };
}

/** Stores a daily result unless one already exists for that kind and date (first result is final). */
export function recordDaily(p: Progress, result: DailyResult): Progress {
  const key = dailyKey(result.kind, result.date);
  if (p.daily[key]) return p;
  return { ...p, daily: { ...p.daily, [key]: result }, pending: addPending(p.pending, `r:${key}`) };
}

const addPending = (pending: string[], key: string) => (pending.includes(key) ? pending : [...pending, key]);

export const discoveredIds = (p: Progress) => Object.keys(p.discovered).filter((id) => p.discovered[id].on).sort();
