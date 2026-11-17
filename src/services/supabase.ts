import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { type DailyKind, type DailyResult, type Discovery, dailyKey } from '../core/progress';
import type { RemoteChanges, RemoteSnapshot, RemoteStore } from '../core/sync';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when this build was given a Supabase project (public URL + anon key only). */
export const isSyncConfigured = !!url && !!anonKey;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSyncConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}

const iso = (value: string) => new Date(value).toISOString();

/** RemoteStore backed by Postgres. Row-level security restricts every query to the signed-in user. */
export class SupabaseRemote implements RemoteStore {
  constructor(private readonly db: SupabaseClient) {}

  async pull(): Promise<RemoteSnapshot> {
    const [d, r] = await Promise.all([
      this.db.from('discoveries').select('country_id, discovered, updated_at'),
      this.db.from('daily_results').select('kind, day, score, max_score, detail, completed_at, device_id'),
    ]);
    if (d.error) throw d.error;
    if (r.error) throw r.error;
    const discovered: Record<string, Discovery> = {};
    for (const row of d.data ?? []) discovered[row.country_id] = { on: row.discovered, at: iso(row.updated_at) };
    const daily: Record<string, DailyResult> = {};
    for (const row of r.data ?? []) {
      daily[dailyKey(row.kind as DailyKind, row.day)] = {
        kind: row.kind as DailyKind, date: row.day, score: row.score, max: row.max_score,
        detail: row.detail ?? [], completedAt: iso(row.completed_at), deviceId: row.device_id,
      };
    }
    return { discovered, daily };
  }

  async push(changes: RemoteChanges): Promise<void> {
    // one idempotent RPC; conflict rules live in the database (see supabase/migrations)
    const { error } = await this.db.rpc('push_progress', {
      p_discoveries: Object.entries(changes.discovered).map(([country_id, v]) => ({ country_id, discovered: v.on, updated_at: v.at })),
      p_results: changes.daily.map((r) => ({
        kind: r.kind, day: r.date, score: r.score, max_score: r.max, detail: r.detail, completed_at: r.completedAt, device_id: r.deviceId,
      })),
    });
    if (error) throw error;
  }
}
