// Generates every app icon from one vector design. Run: node scripts/brand/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = (f) => path.join(root, f);
const CREAM = '#FBF6EC', NAVY = '#14213D', OCEAN = '#2A7DA8', LAND = '#F6EFDC', CORAL = '#E76F51';

// globe with meridians and a map pin, drawn in a 1000×1000 box
const globe = (_fill = true, mono = false) => {
  const W = '#fff';
  const pinPath = 'M0 -170 C 95 -170 150 -102 150 -30 C 150 66 45 145 0 225 C -45 145 -150 66 -150 -30 C -150 -102 -95 -170 0 -170 Z';
  if (mono) {
    return `
  <g transform="translate(470 545)" fill="none" stroke="${W}" stroke-width="40">
    <circle r="285"/><ellipse rx="285" ry="105"/><ellipse rx="115" ry="285"/>
  </g>
  <g transform="translate(655 330)"><path fill-rule="evenodd" fill="${W}" d="${pinPath} M 0 -82 a 52 52 0 1 0 0.1 0 Z"/></g>`;
  }
  return `
  <g transform="translate(470 545)">
    <circle r="300" fill="${OCEAN}" stroke="${NAVY}" stroke-width="24"/>
    <g fill="none" stroke="${LAND}" stroke-width="16" opacity="0.95">
      <ellipse rx="288" ry="108"/>
      <ellipse rx="118" ry="288"/>
      <line x1="-288" y1="0" x2="288" y2="0"/>
      <line x1="0" y1="-288" x2="0" y2="288"/>
    </g>
  </g>
  <g transform="translate(655 330)">
    <path d="${pinPath}" fill="${CORAL}" stroke="${NAVY}" stroke-width="22"/>
    <circle cy="-30" r="52" fill="${CREAM}" stroke="${NAVY}" stroke-width="14"/>
  </g>`;
};

const svg = (inner, { bg = CREAM, size = 1000, scale = 1 } = {}) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">
    ${bg ? `<rect width="1000" height="1000" fill="${bg}"/>` : ''}
    <g transform="translate(500 500) scale(${scale}) translate(-500 -500)">${inner}</g>
  </svg>`);

const png = (buf, size, file, { flatten = false } = {}) => {
  let s = sharp(buf, { density: 300 }).resize(size, size);
  if (flatten) s = s.flatten({ background: CREAM }).removeAlpha();
  return s.png({ compressionLevel: 9 }).toFile(out(file));
};

await png(svg(globe(), { scale: 0.92 }), 1024, 'assets/icon.png', { flatten: true }); // iOS: no transparency
await png(svg(globe(), { bg: null, scale: 0.62 }), 1024, 'assets/android-icon-foreground.png'); // inside the 66% safe zone
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: CREAM } }).png().toFile(out('assets/android-icon-background.png'));
await png(svg(globe(false, true), { bg: null, scale: 0.62 }), 1024, 'assets/android-icon-monochrome.png');
await png(svg(globe(), { bg: null, scale: 0.9 }), 1024, 'assets/splash-icon.png');
await png(svg(globe(), { scale: 0.95 }), 48, 'assets/favicon.png', { flatten: true });
await png(svg(globe(), { scale: 0.92 }), 512, 'store/play-icon-512.png', { flatten: true });

// Google Play feature graphic 1024×500
const feature = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="${CREAM}"/>
  <g transform="translate(30 30) scale(0.44)">${globe()}</g>
  <text x="480" y="215" font-family="Georgia, serif" font-size="66" font-weight="700" fill="${NAVY}">Dünya Cepte</text>
  <text x="483" y="282" font-family="Georgia, serif" font-size="40" fill="${OCEAN}">Pocket World</text>
  <text x="483" y="350" font-family="sans-serif" font-size="28" fill="${NAVY}">Her gün bir ülke · A country a day</text>
</svg>`);
await sharp(feature, { density: 200 }).resize(1024, 500).flatten({ background: CREAM }).png().toFile(out('store/play-feature-graphic.png'));
console.log('icons written');
