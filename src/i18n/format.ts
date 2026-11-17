import type { Lang } from '../core/types';

const MONTHS: Record<Lang, string[]> = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** "16 Kasım 2026" / "16 November 2026" from a YYYY-MM-DD key (no time-zone conversion involved). */
export function formatDate(dateKey: string, lang: Lang): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTHS[lang][m - 1]} ${y}`;
}

export const formatTime = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')}`;

export function formatBytes(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} kB`;
  return `${bytes} B`;
}
