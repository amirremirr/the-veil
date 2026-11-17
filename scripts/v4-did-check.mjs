// UI V4 (V3): plays whole lives and checks that every "What your choices did" block adds up: its rows sum
// to its total, and its total is the bank change it names. Usage: node scripts/v4-did-check.mjs [n lives]
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const lives = Number(process.argv[2] ?? 4);
const server = await createServer({ server: { port: 5194, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => '__autoplay' in window);
let blocks = 0;
const bad = [];
for (let L = 0; L < lives; L++) {
  const seed = `did-check-${L}`;
  await page.evaluate((s) => {
    const st = window.__veil.getState();
    st.updateSettings({ reducedMotion: true });
    st.start({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: [4, 3, 2, 4][s.length % 4], difficulty: 'NORMAL', seed: s });
  }, seed);
  for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(40);
    const kind = await page.evaluate(() => window.__veil.getState().game.phase.kind);
    if (kind === 'RUN_DEBRIEF' || kind === 'END') break;
    if (await page.locator('[data-choices-did]').count()) {
      const r = await page.locator('[data-choices-did]').evaluate((el) => {
        const num = (x) => Number(x.replace('−', '-').replace('+', '')) || 0;
        const rows = [...el.querySelectorAll('[data-did] > span:last-child')].map((x) => num(x.textContent ?? '0'));
        const total = num(el.querySelector('[data-did-total] > span:last-child')?.textContent ?? '0');
        const m = /Bank (-?\d+) to (-?\d+)/.exec(el.querySelector('[data-did-total]')?.textContent ?? '');
        return { sum: rows.reduce((a, b) => a + b, 0), total, change: m ? Number(m[2]) - Number(m[1]) : NaN, text: el.innerText.replace(/\s+/g, ' ') };
      });
      blocks++;
      if (r.sum !== r.total || r.total !== r.change) bad.push(`${seed}: ${JSON.stringify(r)}`);
    }
    if (await page.locator('[data-beat-next]').count()) {
      await page.locator('[data-beat-next]').first().click();
      continue;
    }
    await page.evaluate(() => {
      const g0 = window.__veil.getState().game;
      window.__autoplay((g) => g !== g0);
    });
  }
}
console.log(`${blocks} blocks checked in ${lives} lives; ${bad.length} do not add up`);
for (const b of bad) console.log(b);
await browser.close();
await server.close();
if (bad.length) process.exitCode = 1;
