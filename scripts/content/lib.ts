import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '../..');

export interface Editorial {
  id: string;
  capitalTr: string;
  capitalEn?: string;
  wikiTitle: string;
  place: { tr: string; en: string };
  fact: { tr: string; en: string };
  culture: { tr: string; en: string };
  food: { tr: string; en: string };
  sight: { tr: string; en: string };
}

const KEYS: Record<string, 'fact' | 'culture' | 'food' | 'sight'> = { F: 'fact', C: 'culture', Y: 'food', S: 'sight' };

/** Parses content/editorial/*.txt (format documented in content/README.md). */
export function loadEditorial(): Map<string, Editorial> {
  const dir = path.join(ROOT, 'content/editorial');
  const out = new Map<string, Editorial>();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()) {
    let cur: Partial<Editorial> | null = null;
    const flush = () => {
      if (!cur) return;
      for (const k of ['fact', 'culture', 'food', 'sight'] as const) {
        if (!cur[k]?.tr || !cur[k]?.en) throw new Error(`${file}: ${cur.id} is missing "${k}" in one language`);
      }
      if (out.has(cur.id!)) throw new Error(`${file}: duplicate country ${cur.id}`);
      out.set(cur.id!, cur as Editorial);
    };
    for (const raw of fs.readFileSync(path.join(dir, file), 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('@')) {
        flush();
        const parts = line.slice(1).split('|').map((s) => s.trim());
        if (parts.length !== 5) throw new Error(`${file}: bad header "${line}"`);
        const [capTr, capEn] = parts[1].split(' = ').map((s) => s.trim());
        cur = { id: parts[0], capitalTr: capTr, capitalEn: capEn, wikiTitle: parts[2], place: { tr: parts[3], en: parts[4] } };
        continue;
      }
      const m = /^([FCYS]):\s*(.+?)\s*\|\|\s*(.+)$/.exec(line);
      if (!m || !cur) throw new Error(`${file}: cannot parse "${line.slice(0, 60)}"`);
      cur[KEYS[m[1]]] = { tr: m[2], en: m[3] };
    }
    flush();
  }
  return out;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

export function writeIfChanged(file: string, data: string | Buffer) {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buf)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return true;
}
