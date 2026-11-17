import AsyncStorage from '@react-native-async-storage/async-storage';

/** Key-value persistence. AsyncStorage maps to native storage on iOS/Android and localStorage on web. */
export const storage = {
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // corrupted or unavailable storage must never crash the app
    }
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: keep running with in-memory state */
    }
  },
};
