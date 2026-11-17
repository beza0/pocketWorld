/**
 * Store screenshots from the exported web build (same UI as the native app).
 *   npm run build:web && npm run serve:web   # port 8080
 *   node scripts/store-screenshots.cjs
 * Output: store/screenshots/<platform>/<lang>/NN-name.png
 *   ios:     1320 × 2868 (6.9" iPhone, accepted for all iPhone sizes)
 *   android: 1080 × 2400 phone
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.argv[2] || 'http://localhost:8080';
const DEVICES = {
  ios: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 },
  android: { viewport: { width: 360, height: 800 }, deviceScaleFactor: 3 },
};
const FIXED_NOW = new Date('2026-11-21T09:00:00+03:00');
const tid = (id) => `[data-testid="${id}"]`;

(async () => {
  const browser = await chromium.launch();
  for (const [platform, device] of Object.entries(DEVICES)) {
    for (const lang of ['tr', 'en']) {
      const dir = path.join(__dirname, '..', 'store', 'screenshots', platform, lang);
      fs.mkdirSync(dir, { recursive: true });
      const ctx = await browser.newContext({ ...device, timezoneId: 'Europe/Istanbul', locale: lang === 'tr' ? 'tr-TR' : 'en-GB' });
      const page = await ctx.newPage();
      await page.clock.setFixedTime(FIXED_NOW);
      // seed a little progress and the language, as a returning user would have
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.evaluate(({ lang }) => {
        const now = '2026-11-20T10:00:00.000Z';
        const discovered = Object.fromEntries(['tr', 'jp', 'it', 'br', 'eg', 'ma', 'pe', 'no', 'in', 'mx', 'gr', 'ke'].map((id) => [id, { on: true, at: now }]));
        localStorage.setItem('pw:progress:v1', JSON.stringify({ discovered, daily: {}, pending: [] }));
        localStorage.setItem('pw:settings:v1', JSON.stringify({ lang, reminder: { enabled: false, hour: 9, minute: 0 } }));
      }, { lang });
      const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(dir, name + '.png') }); };

      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector(tid('country-card'));
      await shot('01-today');
      await page.click(tid('quiz-start'));
      await page.locator(tid('quiz-question')).scrollIntoViewIfNeeded();
      await page.click('[data-testid$="-answer"][data-testid^="quiz-option-"]');
      await page.locator(tid('quiz-question')).evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await shot('02-daily-questions');
      await page.goto(BASE + '/mystery', { waitUntil: 'networkidle' });
      await page.click('[data-testid^="mystery-option-"]:not([data-testid$="-answer"])');
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot('03-mystery');
      await page.goto(BASE + '/round?mode=photo&difficulty=easy&pool=all', { waitUntil: 'networkidle' });
      await page.waitForSelector(tid('game-question-photo'));
      await shot('04-photo-game');
      await page.goto(BASE + '/round?mode=flag&difficulty=hard&pool=all', { waitUntil: 'networkidle' });
      await page.click('[data-testid$="-answer"][data-testid^="game-option-"]');
      await shot('05-flag-game');
      await page.goto(BASE + '/atlas', { waitUntil: 'networkidle' });
      await shot('06-discovery-map');
      await page.goto(BASE + '/countries', { waitUntil: 'networkidle' });
      await page.fill(tid('country-search'), lang === 'tr' ? 'Tür' : 'Tur');
      await shot('07-search');
      await ctx.close();
      console.log(`${platform}/${lang}: done`);
    }
  }
  await browser.close();
})();
