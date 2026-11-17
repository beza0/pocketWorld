import { describe, expect, it } from 'vitest';
import { type DailyResult, emptyProgress, mergeProgress, recordDaily, setDiscovered } from '../src/core/progress';
import { MemoryRemote, applySyncResult, syncOnce } from '../src/core/sync';

const result = (over: Partial<DailyResult>): DailyResult => ({ kind: 'quiz', date: '2026-11-16', score: 2, max: 3, detail: [1, 1, 0], completedAt: '2026-11-16T08:00:00.000Z', deviceId: 'a', ...over });

describe('progress merge', () => {
  it('counts a country discovered on two devices once', () => {
    const a = setDiscovered(emptyProgress(), 'jp', true, new Date('2026-11-16T08:00:00Z'));
    const b = setDiscovered(emptyProgress(), 'jp', true, new Date('2026-11-16T09:00:00Z'));
    const m = mergeProgress(a, b);
    expect(Object.keys(m.discovered)).toEqual(['jp']);
  });

  it('keeps the first completed daily result, on whichever side it is', () => {
    const early = result({ score: 1, completedAt: '2026-11-16T07:00:00.000Z', deviceId: 'phone' });
    const late = result({ score: 3, completedAt: '2026-11-16T10:00:00.000Z', deviceId: 'laptop' });
    const a = recordDaily(emptyProgress(), late);
    const b = recordDaily(emptyProgress(), early);
    expect(mergeProgress(a, b).daily['quiz:2026-11-16'].score).toBe(1);
    expect(mergeProgress(b, a).daily['quiz:2026-11-16'].score).toBe(1);
  });

  it('breaks exact timestamp ties deterministically by device id', () => {
    const x = result({ deviceId: 'b', score: 3 });
    const y = result({ deviceId: 'a', score: 0 });
    expect(mergeProgress(recordDaily(emptyProgress(), x), recordDaily(emptyProgress(), y)).daily['quiz:2026-11-16'].deviceId).toBe('a');
  });

  it('does not let a second attempt on the same day overwrite the first', () => {
    const p = recordDaily(emptyProgress(), result({ score: 1 }));
    expect(recordDaily(p, result({ score: 3 })).daily['quiz:2026-11-16'].score).toBe(1);
  });

  it('is commutative and idempotent', () => {
    const a = setDiscovered(recordDaily(emptyProgress(), result({ kind: 'mystery', max: 3 })), 'fr', true, new Date('2026-11-01'));
    const b = setDiscovered(setDiscovered(emptyProgress(), 'fr', false, new Date('2026-11-02')), 'de', true);
    expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a));
    expect(mergeProgress(a, a)).toEqual({ ...a, pending: [...a.pending].sort() });
  });
});

describe('sync', () => {
  it('merges guest progress into an account and two devices never double count', async () => {
    const remote = new MemoryRemote();
    let phone = setDiscovered(setDiscovered(emptyProgress(), 'jp', true), 'tr', true);
    phone = recordDaily(phone, result({ deviceId: 'phone', completedAt: '2026-11-16T07:00:00.000Z', score: 2 }));
    let laptop = setDiscovered(setDiscovered(emptyProgress(), 'jp', true), 'br', true);
    laptop = recordDaily(laptop, result({ deviceId: 'laptop', completedAt: '2026-11-16T09:00:00.000Z', score: 3 }));

    phone = await syncOnce(phone, remote);
    laptop = await syncOnce(laptop, remote);
    phone = await syncOnce(phone, remote);

    expect(Object.keys(remote.discovered).sort()).toEqual(['br', 'jp', 'tr']);
    expect(Object.keys(remote.daily)).toEqual(['quiz:2026-11-16']);
    expect(remote.daily['quiz:2026-11-16'].deviceId).toBe('phone');
    expect(phone.daily).toEqual(laptop.daily);
    expect(phone.pending).toEqual([]);
  });

  it('retries after a lost response without creating duplicate rows', async () => {
    const remote = new MemoryRemote();
    let local = recordDaily(setDiscovered(emptyProgress(), 'jp', true), result({}));
    remote.failAfterNextPush = true;
    await expect(syncOnce(local, remote)).rejects.toThrow();
    expect(local.pending.length).toBe(2); // nothing was marked as sent
    const rowsAfterFailure = remote.rowCount();
    local = await syncOnce(local, remote);
    local = await syncOnce(local, remote);
    expect(remote.rowCount()).toBe(rowsAfterFailure);
    expect(remote.rowCount()).toBe(2);
    expect(local.pending).toEqual([]);
  });

  it('keeps changes made while a sync was in flight', async () => {
    const remote = new MemoryRemote();
    const before = setDiscovered(emptyProgress(), 'jp', true);
    const result1 = await syncOnce(before, remote);
    const during = setDiscovered(before, 'fr', true);
    const after = applySyncResult(during, before, result1);
    expect(after.pending).toEqual(['d:fr']);
    expect(after.discovered.fr.on).toBe(true);
  });
});
