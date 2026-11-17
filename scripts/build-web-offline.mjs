// Post-processes `expo export --platform web` (dist/):
//  - copies the service worker
//  - writes offline-manifest.json: every file of the app shell + base pack with size and SHA-256
// The manifest version is a hash of all file hashes, so any change produces a new offline pack.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html not found. Run `npx expo export --platform web` first.');
  process.exit(1);
}

const SKIP = new Set(['offline-manifest.json', 'sw.js', 'metadata.json']);
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else {
      const rel = path.relative(dist, abs).split(path.sep).join('/');
      if (SKIP.has(rel) || rel.endsWith('.map')) continue;
      const buf = fs.readFileSync(abs);
      files.push({ url: '/' + rel, size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
    }
  }
};
walk(dist);
files.sort((a, b) => a.url.localeCompare(b.url));

const version = crypto.createHash('sha256').update(files.map((f) => f.url + f.sha256).join('|')).digest('hex').slice(0, 16);
const totalBytes = files.reduce((s, f) => s + f.size, 0);
fs.writeFileSync(path.join(dist, 'offline-manifest.json'), JSON.stringify({ version, totalBytes, files }));

const isContent = (u) => /\/assets\/content\//.test(u) || /\.(webp|png)$/.test(u);
const contentBytes = files.filter((f) => isContent(f.url)).reduce((s, f) => s + f.size, 0);
console.log(`offline manifest ${version}: ${files.length} files, ${(totalBytes / 1e6).toFixed(2)} MB total`);
console.log(`  images (flags + photos): ${(contentBytes / 1e6).toFixed(2)} MB, app shell + data (JS/HTML): ${((totalBytes - contentBytes) / 1e6).toFixed(2)} MB`);
