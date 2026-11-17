/* Pocket World service worker.
 *
 * - App shell + base pack: served from the active pack cache (written by "Prepare for offline use").
 *   Nothing is pre-cached on install; until a verified pack exists everything goes to the network.
 * - Large photos from upload.wikimedia.org: cached on demand in a separate cache that the user can clear.
 */
const META_CACHE = 'pw-meta';
const PACK_PREFIX = 'pw-pack-';
const PHOTO_CACHE = 'pw-photos';
const PHOTO_HOST = 'upload.wikimedia.org';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function activePack() {
  try {
    const meta = await caches.open(META_CACHE);
    const res = await meta.match('/__pw_active__');
    if (!res) return null;
    const { version } = await res.json();
    const name = PACK_PREFIX + version;
    return (await caches.has(name)) ? caches.open(name) : null;
  } catch {
    return null;
  }
}

async function fromPack(request) {
  const url = new URL(request.url);
  const pack = await activePack();
  if (pack) {
    const hit = await pack.match(url.pathname);
    if (hit) return hit;
  }
  try {
    return await fetch(request);
  } catch (err) {
    // offline: client-side routes (e.g. /country/jp) fall back to the app shell
    if (pack && request.mode === 'navigate') {
      const shell = await pack.match('/index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function photo(request) {
  const cache = await caches.open(PHOTO_CACHE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request.url, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname === PHOTO_HOST) {
    event.respondWith(photo(request));
  } else if (url.origin === self.location.origin && url.pathname !== '/offline-manifest.json' && url.pathname !== '/sw.js') {
    event.respondWith(fromPack(request));
  }
});
