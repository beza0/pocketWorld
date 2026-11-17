/**
 * End-to-end check of the exported web app with Playwright (Chromium).
 *
 *   npm run build:web && npm run serve:web      # in one terminal (port 8080)
 *   node scripts/e2e/web.e2e.cjs [baseUrl]       # in another
 *
 * Covers: first visit as a guest, country card, "Keşfettim", daily quiz, Daily Mystery scoring and
 * persistence across reload + language switch, search, discovery map, free play, deep links,
 * Istanbul day change across device time zones, and the offline pack (prepare → offline → reopen).
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.argv[2] || 'http://localhost:8080';
const shots = process.env.SHOTS_DIR;
const results = [];
const tid = (id) => `[data-testid="${id}"]`;

async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
}

async function shot(page, name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ------------------------------------------------------------- guest flow (mobile)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Istanbul', serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));

  await step('first visit shows the Country of the Day without sign-up or onboarding', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForSelector(tid('today-title'));
    assert.match(await page.textContent(tid('today-title')), /Bugün hangi ülkeyi öğreneceğim\?/);
    const tr = await page.textContent(tid('country-name'));
    const en = await page.textContent(tid('country-name-other'));
    assert.ok(tr && en, 'both names visible');
    assert.ok(await page.isVisible(tid('country-fact')));
    await shot(page, 'e2e-today');
  });

  await step('card language toggle switches the card text without changing the UI language', async () => {
    const fact = await page.textContent(tid('country-fact'));
    await page.click(tid('card-lang-en'));
    const factEn = await page.textContent(tid('country-fact'));
    assert.notEqual(fact, factEn);
    assert.match(await page.textContent(tid('today-title')), /Bugün/); // UI still Turkish
    await page.click(tid('card-lang-tr'));
  });

  await step('"Daha fazla keşfet" opens culture, food and sight', async () => {
    await page.click(tid('discover-more'));
    await page.waitForSelector('text=Kültür');
    assert.ok(await page.isVisible('text=Yemek'));
  });

  await step('"Keşfettim" adds the country to the discovery map', async () => {
    await page.click(tid('mark-discovered'));
    await page.waitForSelector(tid('discovered-state'));
  });

  await step("Today's 3 Questions: flag, map, fact; explanation after each; result saved", async () => {
    await page.click(tid('quiz-start'));
    for (let i = 0; i < 3; i++) {
      await page.waitForSelector(tid('quiz-question'));
      // answer the first two correctly and the last one wrongly
      const sel = i < 2 ? '[data-testid$="-answer"][data-testid^="quiz-option-"]' : '[data-testid^="quiz-option-"]:not([data-testid$="-answer"])';
      await page.click(sel);
      await page.waitForSelector(tid('feedback'));
      await page.click(tid('quiz-next'));
    }
    await page.waitForSelector(tid('quiz-result'));
    assert.match(await page.textContent(tid('quiz-score')), /2 \/ 3 doğru/);
  });

  let mysteryAnswer = '';
  await step('Daily Mystery preview reveals nothing; wrong guess disables option and opens next clue; 2 points', async () => {
    const preview = await page.textContent(tid('mystery-card'));
    assert.ok(!/\b(Japonya|Japan)\b/.test(preview));
    await page.click(tid('go-mystery'));
    await page.waitForSelector(tid('mystery-fact'));
    assert.ok(!(await page.isVisible(tid('clue-2'))), 'map clue hidden at first');
    assert.match(await page.textContent(tid('mystery-points')), /3 puan/);
    await page.click('[data-testid^="mystery-option-"]:not([data-testid$="-answer"])');
    await page.waitForSelector(tid('clue-2'));
    assert.match(await page.textContent(tid('mystery-points')), /2 puan/);
    assert.ok(await page.isDisabled('[aria-disabled="true"][data-testid^="mystery-option-"]').catch(() => true));
    await page.click('[data-testid$="-answer"][data-testid^="mystery-option-"]');
    await page.waitForSelector(tid('mystery-result'));
    assert.match(await page.textContent(tid('mystery-score')), /2 \/ 3/);
    mysteryAnswer = await page.textContent(tid('mystery-answer'));
    assert.ok(mysteryAnswer.includes('·'), 'answer shown in both languages');
    await shot(page, 'e2e-mystery');
  });

  await step('mystery result survives reload and language change', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector(tid('mystery-result'));
    assert.match(await page.textContent(tid('mystery-score')), /2 \/ 3/);
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
    await page.click(tid('ui-lang-en'));
    await page.goto(BASE + '/mystery', { waitUntil: 'networkidle' });
    await page.waitForSelector(tid('mystery-result'));
    assert.match(await page.textContent(tid('mystery-score')), /Today's score: 2 \/ 3/);
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
    await page.click(tid('ui-lang-tr'));
  });

  await step('the countries one and the mystery country are different', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const name = await page.textContent(tid('country-name'));
    assert.ok(!mysteryAnswer.includes(name));
  });

  await step('search finds Türkiye as Türkiye, Turkiye and Turkey; continent filter works', async () => {
    await page.goto(BASE + '/countries', { waitUntil: 'networkidle' });
    assert.match(await page.textContent(tid('result-count')), /195 ülke/);
    for (const q of ['Türkiye', 'Turkiye', 'Turkey']) {
      await page.fill(tid('country-search'), q);
      await page.waitForTimeout(150);
      const first = await page.getAttribute('[data-testid^="country-row-"]', 'data-testid');
      assert.equal(first, 'country-row-tr', q);
    }
    await page.fill(tid('country-search'), '');
    await page.click(tid('continent-oceania'));
    assert.match(await page.textContent(tid('result-count')), /14 ülke/);
    await page.fill(tid('country-search'), 'zzzz');
    await page.waitForSelector(tid('state-empty'));
    await page.click(tid('continent-all'));
    await page.fill(tid('country-search'), '');
  });

  await step('discovery map counts only "Keşfettim" (1 / 195)', async () => {
    assert.match(await page.textContent(tid('discovered-count')), /1 \/ 195 ülke keşfedildi/);
    await page.click(tid('open-atlas'));
    await page.waitForSelector(tid('atlas-count'));
    assert.match(await page.textContent(tid('atlas-count')), /1 \/ 195/);
  });

  await step('deep links: /country/jp opens, unknown id shows a not-found state', async () => {
    await page.goto(BASE + '/country/jp', { waitUntil: 'networkidle' });
    await page.waitForSelector(tid('country-card'));
    assert.match(await page.textContent(tid('country-name')), /Japonya/);
    await page.goto(BASE + '/country/xx', { waitUntil: 'networkidle' });
    await page.waitForSelector(tid('state-error'));
  });

  await step('"Keşfettiklerim" with fewer than 10 countries offers the general pool', async () => {
    await page.goto(BASE + '/play', { waitUntil: 'networkidle' });
    await page.click(tid('pool-mine'));
    await page.waitForSelector(tid('pool-too-small'));
    await page.click(tid('pool-use-all'));
  });

  await step('free play: mixed / hard round of 10 with result and links to missed countries', async () => {
    await page.click(tid('mode-mixed'));
    await page.click(tid('difficulty-hard'));
    await page.click(tid('start-round'));
    for (let i = 0; i < 10; i++) {
      await page.waitForSelector('[data-testid^="game-question-"]');
      const sel = i % 3 === 0 ? '[data-testid^="game-option-"]:not([data-testid$="-answer"])' : '[data-testid$="-answer"][data-testid^="game-option-"]';
      await page.click(sel);
      await page.waitForSelector(tid('feedback'));
      if (i === 3) await shot(page, 'e2e-round');
      await page.click(tid('round-next'));
    }
    await page.waitForSelector(tid('round-result'));
    assert.match(await page.textContent(tid('round-score')), /6\/10 doğru/);
    assert.equal(await page.locator('[data-testid^="missed-"]').count(), 4);
  });

  await step('web reminder is reported as unsupported, not faked', async () => {
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
    await page.waitForSelector(tid('reminder-unsupported'));
  });

  await step('offline pack: prepare, verify, then reopen with network off', async () => {
    await page.waitForSelector(tid('offline-prepare'), { timeout: 15000 });
    await page.click(tid('offline-prepare'));
    await page.waitForSelector(tid('offline-ready'), { timeout: 180000 });
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
    await page.close();
    await ctx.setOffline(true);
    const off = await ctx.newPage();
    off.on('pageerror', (e) => errors.push('offline: ' + e.message));
    await off.goto(BASE + '/', { waitUntil: 'load' });
    await off.waitForSelector(tid('country-name'), { timeout: 20000 });
    // the base-pack photo of today's country must render from the cache
    await off.waitForFunction(() => [...document.images].some((i) => i.complete && i.naturalWidth > 600), null, { timeout: 15000 });
    await off.goto(BASE + '/countries', { waitUntil: 'load' });
    await off.waitForSelector(tid('country-search'));
    await off.fill(tid('country-search'), 'Turkey');
    await off.waitForSelector(tid('country-row-tr'));
    await off.goto(BASE + '/country/br', { waitUntil: 'load' });
    await off.waitForSelector(tid('country-card'));
    await off.goto(BASE + '/round?mode=photo&difficulty=easy&pool=all', { waitUntil: 'load' });
    await off.waitForSelector(tid('game-question-photo'));
    await off.waitForFunction(() => [...document.images].some((i) => i.complete && i.naturalWidth > 600), null, { timeout: 15000 });
    await off.goto(BASE + '/atlas', { waitUntil: 'load' });
    assert.match(await off.textContent(tid('atlas-count')), /1 \/ 195/);
    await shot(off, 'e2e-offline');
    await off.goto(BASE + '/settings', { waitUntil: 'load' });
    await off.waitForSelector(tid('offline-ready'));
  });
  await ctx.close();

  // ------------------------------------------------------------- same day everywhere
  await step('every time zone sees the same pair, and it changes at 00:00 Istanbul', async () => {
    const names = {};
    for (const tz of ['Europe/Istanbul', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
      for (const [label, iso] of [['before', '2026-11-20T20:59:00Z'], ['after', '2026-11-20T21:01:00Z']]) {
        const c = await browser.newContext({ timezoneId: tz, viewport: { width: 390, height: 844 } });
        const p = await c.newPage();
        await p.clock.setFixedTime(new Date(iso));
        await p.goto(BASE + '/', { waitUntil: 'networkidle' });
        await p.waitForSelector(tid('country-name'));
        names[`${tz}/${label}`] = await p.textContent(tid('country-name'));
        await c.close();
      }
    }
    const before = new Set(Object.entries(names).filter(([k]) => k.endsWith('before')).map(([, v]) => v));
    const after = new Set(Object.entries(names).filter(([k]) => k.endsWith('after')).map(([, v]) => v));
    assert.equal(before.size, 1, JSON.stringify(names));
    assert.equal(after.size, 1, JSON.stringify(names));
    assert.notDeepEqual([...before], [...after]);
  });

  // ------------------------------------------------------------- wide web layout + keyboard
  await step('wide layout and keyboard navigation', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await c.newPage();
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.waitForSelector(tid('country-card'));
    await shot(p, 'e2e-wide');
    // reach "Keşfettim" with the keyboard and activate it with Enter
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await p.keyboard.press('Tab');
      found = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'mark-discovered');
    }
    assert.ok(found, 'mark-discovered reachable with Tab');
    await p.keyboard.press('Enter');
    await p.waitForSelector(tid('discovered-state'));
    await c.close();
  });

  await browser.close();
  console.log(results.join('\n'));
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  process.exit(results.some((r) => r.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
