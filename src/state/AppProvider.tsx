import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getToday, msUntilNextDay, type Daily } from '../core/calendar';
import type { MysteryState } from '../core/mystery';
import { type DailyResult, type Progress, discoveredIds, emptyProgress, mergeProgress, recordDaily, setDiscovered } from '../core/progress';
import { type MistakeRecord, recordAnswer } from '../core/questions';
import { applySyncResult, syncOnce } from '../core/sync';
import type { Lang, Question } from '../core/types';
import { calendar } from '../data';
import { type StringKey, translate } from '../i18n/strings';
import { notifications } from '../platform/notifications';
import { storage } from '../platform/storage';
import { SupabaseRemote, getSupabase, isSyncConfigured } from '../services/supabase';

const KEYS = {
  settings: 'pw:settings:v1',
  progress: 'pw:progress:v1',
  mistakes: 'pw:mistakes:v1',
  device: 'pw:device:v1',
  mystery: 'pw:mystery-draft:v1',
  syncedAt: 'pw:synced-at:v1',
};

export interface Reminder {
  enabled: boolean;
  hour: number;
  minute: number;
}

interface Settings {
  lang: Lang;
  reminder: Reminder;
}

const DEFAULT_SETTINGS: Settings = { lang: 'tr', reminder: { enabled: false, hour: 9, minute: 0 } };

export type SyncState = 'idle' | 'syncing' | 'error';

interface AppContextValue {
  ready: boolean;
  lang: Lang;
  setLang(lang: Lang): void;
  t(key: StringKey, params?: Record<string, string | number>): string;
  today: Daily | null;
  progress: Progress;
  discovered: string[];
  isDiscovered(id: string): boolean;
  setCountryDiscovered(id: string, on: boolean): void;
  saveDailyResult(result: Omit<DailyResult, 'deviceId' | 'completedAt'>): void;
  mistakes: Record<string, MistakeRecord>;
  recordGameAnswer(q: Question, correct: boolean): void;
  mysteryDraft(date: string): MysteryState | null;
  saveMysteryDraft(date: string, state: MysteryState): void;
  reminder: Reminder;
  /** Returns false when the OS denied notification permission. */
  setReminder(next: Reminder): Promise<boolean>;
  syncConfigured: boolean;
  email: string | null;
  syncState: SyncState;
  syncedAt: string | null;
  syncNow(): Promise<void>;
  signOut(): Promise<void>;
  /** Deletes the account and its server data. Local progress is kept as guest progress. */
  deleteAccount(): Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

const makeDeviceId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [mistakes, setMistakes] = useState<Record<string, MistakeRecord>>({});
  const [drafts, setDrafts] = useState<Record<string, MysteryState>>({});
  const [today, setToday] = useState<Daily | null>(() => getToday(calendar));
  const [email, setEmail] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const deviceId = useRef<string>('');
  const progressRef = useRef(progress);
  const syncing = useRef(false);

  // ---- hydrate ----
  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, p, m, d, dr, sa] = await Promise.all([
        storage.getJSON<Partial<Settings>>(KEYS.settings),
        storage.getJSON<Progress>(KEYS.progress),
        storage.getJSON<Record<string, MistakeRecord>>(KEYS.mistakes),
        storage.getJSON<string>(KEYS.device),
        storage.getJSON<Record<string, MysteryState>>(KEYS.mystery),
        storage.getJSON<string>(KEYS.syncedAt),
      ]);
      if (!alive) return;
      if (s) setSettings({ lang: s.lang === 'en' ? 'en' : 'tr', reminder: { ...DEFAULT_SETTINGS.reminder, ...(s.reminder ?? {}) } });
      if (p && typeof p === 'object') {
        const loaded = mergeProgress(emptyProgress(), { discovered: p.discovered ?? {}, daily: p.daily ?? {}, pending: p.pending ?? [] });
        progressRef.current = loaded;
        setProgress(loaded);
      }
      if (m) setMistakes(m);
      if (dr) setDrafts(dr);
      if (sa) setSyncedAt(sa);
      deviceId.current = d ?? makeDeviceId();
      if (!d) storage.setJSON(KEYS.device, deviceId.current);
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  // ---- daily rollover at 00:00 Europe/Istanbul, and when the app returns to the foreground ----
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setToday((prev) => {
        const next = getToday(calendar);
        return prev?.dateKey === next?.dateKey ? prev : next;
      });
      clearTimeout(timer);
      timer = setTimeout(refresh, Math.min(msUntilNextDay() + 1000, 6 * 3_600_000));
    };
    refresh();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);

  // web: keep <html lang> in sync for screen readers and correct hyphenation
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = settings.lang;
  }, [settings.lang]);

  const updateProgress = useCallback((fn: (p: Progress) => Progress) => {
    const next = fn(progressRef.current);
    if (next === progressRef.current) return;
    progressRef.current = next;
    setProgress(next);
    storage.setJSON(KEYS.progress, next);
  }, []);

  // ---- sync ----
  const syncNow = useCallback(async () => {
    const db = getSupabase();
    if (!db || syncing.current) return;
    const { data } = await db.auth.getSession();
    if (!data.session) return;
    syncing.current = true;
    setSyncState('syncing');
    try {
      const before = progressRef.current;
      const result = await syncOnce(before, new SupabaseRemote(db));
      updateProgress((cur) => applySyncResult(cur, before, result));
      const at = new Date().toISOString();
      setSyncedAt(at);
      storage.setJSON(KEYS.syncedAt, at);
      setSyncState('idle');
    } catch {
      setSyncState('error'); // pending changes stay queued and are retried later
    } finally {
      syncing.current = false;
    }
  }, [updateProgress]);

  useEffect(() => {
    const db = getSupabase();
    if (!db) return;
    db.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user.email ?? null);
      // signing in merges the guest progress on this device into the account
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') setTimeout(() => { syncNow(); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [syncNow]);

  // retry queued changes when the app becomes active, the browser comes online, or after edits
  useEffect(() => {
    if (!email) return;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') syncNow(); });
    const online = () => { syncNow(); };
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', online);
    return () => {
      sub.remove();
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('online', online);
    };
  }, [email, syncNow]);

  useEffect(() => {
    if (!email || progress.pending.length === 0) return;
    const timer = setTimeout(() => { syncNow(); }, 1500);
    return () => clearTimeout(timer);
  }, [email, progress.pending.length, syncNow]);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setEmail(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const db = getSupabase();
    if (!db) return false;
    const { error } = await db.rpc('delete_my_account');
    if (error) return false;
    await db.auth.signOut({ scope: 'local' }).catch(() => {});
    setEmail(null);
    setSyncedAt(null);
    storage.setJSON(KEYS.syncedAt, null);
    // everything that was on the server is gone, so all local records count as unsynced again
    updateProgress((p) => ({
      ...p,
      pending: [...Object.keys(p.discovered).map((id) => `d:${id}`), ...Object.keys(p.daily).map((k) => `r:${k}`)].sort(),
    }));
    return true;
  }, [updateProgress]);

  // ---- actions ----
  const setLang = useCallback((lang: Lang) => {
    setSettings((s) => {
      const next = { ...s, lang };
      storage.setJSON(KEYS.settings, next);
      if (next.reminder.enabled) {
        // re-schedule so the notification text follows the selected language
        notifications.enable({ hour: next.reminder.hour, minute: next.reminder.minute, title: translate(lang, 'notifTitle'), body: translate(lang, 'notifBody') }).catch(() => {});
      }
      return next;
    });
  }, []);

  const setReminder = useCallback(async (next: Reminder) => {
    let granted = true;
    if (next.enabled) {
      const res = await notifications.enable({ hour: next.hour, minute: next.minute, title: translate(settings.lang, 'notifTitle'), body: translate(settings.lang, 'notifBody') });
      granted = res === 'granted';
    } else {
      await notifications.disable();
    }
    const stored = { ...next, enabled: next.enabled && granted };
    setSettings((s) => {
      const merged = { ...s, reminder: stored };
      storage.setJSON(KEYS.settings, merged);
      return merged;
    });
    return granted;
  }, [settings.lang]);

  const setCountryDiscovered = useCallback((id: string, on: boolean) => updateProgress((p) => setDiscovered(p, id, on)), [updateProgress]);

  const saveDailyResult = useCallback((result: Omit<DailyResult, 'deviceId' | 'completedAt'>) => {
    updateProgress((p) => recordDaily(p, { ...result, deviceId: deviceId.current, completedAt: new Date().toISOString() }));
  }, [updateProgress]);

  const recordGameAnswer = useCallback((q: Question, correct: boolean) => {
    setMistakes((m) => {
      const next = recordAnswer(m, q, correct);
      storage.setJSON(KEYS.mistakes, next);
      return next;
    });
  }, []);

  const saveMysteryDraft = useCallback((date: string, state: MysteryState) => {
    setDrafts(() => {
      const next = { [date]: state }; // only the current day is worth keeping
      storage.setJSON(KEYS.mystery, next);
      return next;
    });
  }, []);

  const discovered = useMemo(() => discoveredIds(progress), [progress]);
  const discoveredSet = useMemo(() => new Set(discovered), [discovered]);

  const value = useMemo<AppContextValue>(() => ({
    ready,
    lang: settings.lang,
    setLang,
    t: (key, params) => translate(settings.lang, key, params),
    today,
    progress,
    discovered,
    isDiscovered: (id) => discoveredSet.has(id),
    setCountryDiscovered,
    saveDailyResult,
    mistakes,
    recordGameAnswer,
    mysteryDraft: (date) => drafts[date] ?? null,
    saveMysteryDraft,
    reminder: settings.reminder,
    setReminder,
    syncConfigured: isSyncConfigured,
    email,
    syncState,
    syncedAt,
    syncNow,
    signOut,
    deleteAccount,
  }), [ready, settings, setLang, today, progress, discovered, discoveredSet, setCountryDiscovered, saveDailyResult, mistakes, recordGameAnswer, drafts, saveMysteryDraft, setReminder, email, syncState, syncedAt, syncNow, signOut, deleteAccount]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
