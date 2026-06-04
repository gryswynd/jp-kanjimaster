// Polish review screenshots. Drives the app in an iPhone-sized viewport and
// captures key screens in two states: FRESH (brand-new user) + UNLOCKED.
// Output: /tmp/polish/*.png  →  Read them to review visually.
// Run: node scripts/polish-shots.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = '/tmp/polish';
const BASE = 'http://localhost:8300';
// iPhone 14-ish logical viewport.
const VP = { width: 390, height: 844 };

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('  shot:', name);
}

async function settle(page, ms = 900) { await page.waitForTimeout(ms); }

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: VP, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('   [page error]', m.text().slice(0, 120)); });

  // ---- FRESH state: wipe everything first via the QA reset, then load clean ----
  console.log('FRESH state…');
  await page.goto(`${BASE}/?reset=all`, { waitUntil: 'load' });
  await settle(page, 1200);                 // reset strips query + reloads
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await settle(page, 1600);
  await shot(page, '01-fresh-home');

  // Open settings on a fresh user.
  const gear = page.locator('.jp-settings-gear-menu, .jp-settings-gear, [aria-label="Settings"]').first();
  if (await gear.count()) { await gear.click(); await settle(page); await shot(page, '02-fresh-settings');
    const close = page.locator('#jp-set-close, .jp-set-close').first();
    if (await close.count()) await close.click();
    await settle(page, 400);
  }

  // ---- UNLOCKED state: open everything ----
  console.log('UNLOCKED state…');
  await page.goto(`${BASE}/?reset=all-content`, { waitUntil: 'load' });
  await settle(page, 1600);
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await settle(page, 1600);
  await shot(page, '10-home-unlocked');

  // Scroll the home screen to see the lower content (streak, modules, cast).
  await page.evaluate(() => window.scrollTo(0, 600)); await settle(page, 500);
  await shot(page, '11-home-scrolled');
  await page.evaluate(() => window.scrollTo(0, 1400)); await settle(page, 500);
  await shot(page, '12-home-bottom');
  await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 400);

  // Launch a few core screens via the global launcher (most reliable selector path).
  const screens = [
    ['lesson', '20-lesson'],
    ['grammar', '21-grammar'],
    ['practice', '22-dojo'],
    ['stories', '23-stories'],
    ['review', '24-review'],
  ];
  for (const [mode, name] of screens) {
    try {
      await page.evaluate((m) => window.JPApp && window.JPApp.launch(m), mode);
      await settle(page, 1700);
      await shot(page, name);
      // back home for the next one
      await page.evaluate(() => window.JPApp && window.JPApp.renderMenu());
      await settle(page, 700);
    } catch (e) { console.log('   skip', name, e.message.slice(0, 80)); }
  }

  // Settings full scroll (the menus we built today: tiers, custom, account, bug).
  if (await gear.count()) {
    await gear.click(); await settle(page);
    await shot(page, '30-settings-top');
    await page.evaluate(() => { const b = document.querySelector('.jp-set-body'); if (b) b.scrollTop = b.scrollHeight; });
    await settle(page, 500);
    await shot(page, '31-settings-bottom');
  }

  await browser.close();
  console.log('\nDone →', OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
