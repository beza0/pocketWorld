import { type DailyResult, type Discovery, type Progress, dailyKey, mergeProgress } from './progress';

export interface RemoteSnapshot {
  discovered: Record<string, Discovery>;
  daily: Record<string, DailyResult>;
}

export interface RemoteChanges {
  discovered: Record<string, Discovery>;
  daily: DailyResult[];
}

/**
 * Storage behind the account. `push` must be an idempotent upsert that applies the same
 * conflict rules as `mergeProgress` (see supabase/migrations), so retries never duplicate rows.
 */
export interface RemoteStore {
  pull(): Promise<RemoteSnapshot>;
  push(changes: RemoteChanges): Promise<void>;
}

/**
 * One sync pass: pull → merge → push local changes → confirm.
 * Safe to interrupt at any point: `pending` is only cleared after a successful push, and both
 * pull-merge and push are idempotent, so a retry converges to the same state.
 */
export async function syncOnce(local: Progress, remote: RemoteStore): Promise<Progress> {
  const snapshot = await remote.pull();
  const merged = mergeProgress(local, snapshot);

  const changes: RemoteChanges = { discovered: {}, daily: [] };
  const sent: string[] = [];
  for (const key of merged.pending) {
    if (key.startsWith('d:')) {
      const id = key.slice(2);
      const mine = merged.discovered[id];
      if (mine && !sameDiscovery(mine, snapshot.discovered[id])) changes.discovered[id] = mine;
    } else if (key.startsWith('r:')) {
      const mine = merged.daily[key.slice(2)];
      // only send if the server has nothing yet; an existing server row already won the merge
      if (mine && !snapshot.daily[dailyKey(mine.kind, mine.date)]) changes.daily.push(mine);
    }
    sent.push(key);
  }
  if (Object.keys(changes.discovered).length || changes.daily.length) await remote.push(changes);
  return { ...merged, pending: merged.pending.filter((k) => !sent.includes(k)) };
}

const sameDiscovery = (a: Discovery, b: Discovery | undefined) => !!b && a.on === b.on && a.at === b.at;

/** In-memory RemoteStore with the server's conflict rules. Used by tests and local verification. */
export class MemoryRemote implements RemoteStore {
  discovered: Record<string, Discovery> = {};
  daily: Record<string, DailyResult> = {};
  pushCount = 0;
  /** When set, the next push applies its changes and then throws (simulates a lost response). */
  failAfterNextPush = false;

  async pull(): Promise<RemoteSnapshot> {
    return { discovered: { ...this.discovered }, daily: { ...this.daily } };
  }

  async push(changes: RemoteChanges): Promise<void> {
    this.pushCount++;
    const merged = mergeProgress(
      { discovered: this.discovered, daily: this.daily, pending: [] },
      { discovered: changes.discovered, daily: Object.fromEntries(changes.daily.map((r) => [dailyKey(r.kind, r.date), r])) },
    );
    this.discovered = merged.discovered;
    this.daily = merged.daily;
    if (this.failAfterNextPush) {
      this.failAfterNextPush = false;
      throw new Error('network error after write');
    }
  }

  rowCount() {
    return Object.keys(this.discovered).length + Object.keys(this.daily).length;
  }
}

/**
 * Applies a finished sync pass to the current local state, which may have changed while the
 * request was in flight. A key stays pending if it was edited again after the pass started.
 */
export function applySyncResult(current: Progress, before: Progress, result: Progress): Progress {
  const merged = mergeProgress(current, result);
  const record = (p: Progress, key: string) => JSON.stringify(key.startsWith('d:') ? p.discovered[key.slice(2)] : p.daily[key.slice(2)]);
  const pending = current.pending.filter((key) => {
    if (result.pending.includes(key)) return true; // not sent
    if (!before.pending.includes(key)) return true; // created during the pass
    return record(current, key) !== record(before, key); // edited again during the pass
  });
  return { ...merged, pending };
}
