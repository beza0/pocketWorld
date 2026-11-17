import { contentMeta } from '../data';
import type { OfflineAdapter, OfflineStatus } from './offline.types';

/**
 * Web offline pack.
 *
 * `offline-manifest.json` (written by scripts/build-web-offline.mjs after `expo export`) lists every
 * file of the app shell and base pack with its size and SHA-256. "Prepare" downloads all of them into
 * a new cache named after the manifest version, verifies each file, and only then marks the pack as
 * active. The previously active cache keeps serving until that moment and is deleted afterwards, so a
 * failed or interrupted update never leaves the app without a working pack.
 */
const MANIFEST_URL = '/offline-manifest.json';
const ACTIVE_KEY = 'pw:offline:active'; // localStorage: JSON { version, bytes }
const META_CACHE = 'pw-meta'; // holds the "active" marker for the service worker
const PACK_PREFIX = 'pw-pack-';
export const PHOTO_CACHE = 'pw-photos';

interface Manifest { version: string; totalBytes: number; files: { url: string; size: number; sha256: string }[] }
interface Active { version: string; bytes: number }

const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof caches !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle;

const readActive = (): Active | null => {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null'); } catch { return null; }
};

async function fetchManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Manifest;
  } catch {
    return null;
  }
}

async function photoCacheBytes(): Promise<number | null> {
  try {
    if (!(await caches.has(PHOTO_CACHE))) return 0;
    const cache = await caches.open(PHOTO_CACHE);
    let total = 0;
    for (const req of await cache.keys()) {
      const res = await cache.match(req);
      if (res) total += (await res.clone().arrayBuffer()).byteLength;
    }
    return total;
  } catch {
    return null;
  }
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function getStatus(): Promise<OfflineStatus> {
  const base = { progress: 0, packBytes: contentMeta.totalBytes, photoCacheBytes: null as number | null, version: null as string | null };
  if (!supported()) return { ...base, state: 'unsupported' };
  const active = readActive();
  // the marker alone is not trusted: the cache it points to must still exist
  const activeOk = !!active && (await caches.has(PACK_PREFIX + active.version));
  const photos = await photoCacheBytes();
  const manifest = await fetchManifest();
  if (activeOk) {
    const outdated = !!manifest && manifest.version !== active!.version;
    return { state: outdated ? 'update-available' : 'ready', progress: 1, packBytes: active!.bytes, photoCacheBytes: photos, version: active!.version };
  }
  if (!manifest) return { ...base, state: 'unsupported', photoCacheBytes: photos }; // dev server: no manifest
  return { ...base, state: 'not-ready', packBytes: manifest.totalBytes, photoCacheBytes: photos };
}

async function prepare(onProgress: (s: OfflineStatus) => void): Promise<OfflineStatus> {
  const before = await getStatus();
  if (before.state === 'unsupported') return before;
  const manifest = await fetchManifest();
  if (!manifest) return { ...before, state: before.state === 'update-available' ? 'update-available' : 'failed' };
  const cacheName = PACK_PREFIX + manifest.version;
  const previous = readActive();
  const report = (state: OfflineStatus['state'], progress: number) =>
    onProgress({ state, progress, packBytes: manifest.totalBytes, photoCacheBytes: before.photoCacheBytes, version: previous?.version ?? null });

  try {
    report('downloading', 0);
    const cache = await caches.open(cacheName);
    let done = 0;
    const queue = manifest.files.slice();
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const existing = await cache.match(f.url);
        let body = existing ? await existing.clone().arrayBuffer() : null;
        if (!body || body.byteLength !== f.size) {
          const res = await fetch(f.url, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${f.url}`);
          body = await res.clone().arrayBuffer();
          if (body.byteLength !== f.size) throw new Error(`size mismatch for ${f.url}`);
          await cache.put(f.url, res);
        }
        done += f.size;
        report('downloading', done / manifest.totalBytes);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    // verify every file from the cache before declaring the pack ready
    report('verifying', 1);
    let bytes = 0;
    for (const f of manifest.files) {
      const res = await cache.match(f.url);
      if (!res) throw new Error(`missing after download: ${f.url}`);
      const buf = await res.arrayBuffer();
      if (hex(await crypto.subtle.digest('SHA-256', buf)) !== f.sha256) throw new Error(`checksum mismatch for ${f.url}`);
      bytes += buf.byteLength;
    }

    // switch: marker for the page, marker for the service worker, then drop older packs
    const active: Active = { version: manifest.version, bytes };
    const meta = await caches.open(META_CACHE);
    await meta.put('/__pw_active__', new Response(JSON.stringify(active), { headers: { 'content-type': 'application/json' } }));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    for (const name of await caches.keys()) if (name.startsWith(PACK_PREFIX) && name !== cacheName) await caches.delete(name);
    return await getStatus();
  } catch {
    // keep whatever was active before; discard the incomplete download unless it is the active pack
    if (previous?.version !== manifest.version) await caches.delete(cacheName).catch(() => {});
    const after = await getStatus();
    return { ...after, state: after.state === 'ready' || after.state === 'update-available' ? after.state : 'failed' };
  }
}

export const offline: OfflineAdapter = {
  getStatus,
  prepare,
  async clearPhotoCache() {
    if (typeof caches !== 'undefined') await caches.delete(PHOTO_CACHE);
  },
  init() {
    if (!supported()) return;
    // the service worker file only exists in exported builds; registration failure is harmless
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  },
};
