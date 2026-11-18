// UI V4: screenshots of in-place states (no pop-ups): the call confirmed inside a bubble, the Give picker
// open, "See the money" open, and the first-time hint lines. For review; it checks that each state fits.
// Usage: node scripts/v4-states.mjs [--out walkthrough-out/v4-states] [--seed v4-states-1] [--width 375]
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const out = arg('out', 'walkthrough-out/v4-states');
const seed = arg('seed', 'v4-states-1');
const width = Number(arg('width', '375'));
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5193, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width, height: 760 } });
await page.goto(server.resolvedUrls.local[0]);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('veil.play.coach', '1');
});
await page.reload();
await page.waitForFunction(() => '__autoplay' in window);
await page.evaluate((s) => {
  const st = window.__veil.getState();
  st.updateSettings({ reducedMotion: true });
  st.start({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: s, humanName: 'Ana' });
}, seed);
const fits = () => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
const results = [];
const shot = async (name) => {
  await page.waitForTimeout(250);
  const ok = await fits();
  await page.screenshot({ path: `${out}/${name}.png` });
  results.push(`${name}: ${ok ? 'fits' : 'TALLER THAN VIEWPORT'}`);
};
const done = new Set();
const words = () => page.evaluate(() => ((document.querySelector('[data-content]')?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length));
// The second screens of a split decision (UI V4 V2) are not seen by the walkthrough's autoplay: measure them here.
const measureSplit = async () => {
  const h = await page.evaluate(() => (document.querySelector('[data-content] h1')?.textContent ?? '').trim());
  if (h === 'How hard do you work?' && !done.has('split-claim') && (await page.getByRole('button', { name: 'Next', exact: true }).count())) {
    done.add('split-claim');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await shot('split-ep2-claim');
    results.push(`split-ep2-claim: ${await words()} words`);
    await page.getByRole('button', { name: 'Lock in', exact: true }).click();
    return true;
  }
  if (h === 'Keep someone out of the pool?' && !done.has('split-bar')) {
    done.add('split-bar');
    await shot('split-ep3-bar');
    results.push(`split-ep3-bar: ${await words()} words`);
    await page.getByRole('button', { name: 'Nobody', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(100);
    results.push(`ep3-cover-question: ${await words()} words`);
    await shot('ep3-cover-question');
    return false;
  }
  return false;
};
for (let i = 0; i < 900 && done.size < 9; i++) {
  await page.waitForTimeout(60);
  const g = await page.evaluate(() => {
    const x = window.__veil.getState().game;
    return { kind: x.phase.kind, step: x.phase.step ?? '', level: x.levelIndex, round: x.round };
  });
  if (g.kind === 'END' || g.kind === 'RUN_DEBRIEF') break;
  const key = `ep${g.level}`;
  if (await measureSplit()) continue;
  if ((await page.locator('[data-coach]').count()) && !done.has(`coach-${key}`)) {
    done.add(`coach-${key}`);
    await shot(`hint-${key}-${g.step}`);
  }
  if ((await page.locator('[data-gift-bar]').count()) && !done.has('gift')) {
    done.add('gift');
    await page.locator('[data-gift-bar]').click();
    await shot(`gift-open-${key}`);
    await page.locator('[data-gift="none"]').click();
  }
  if ((await page.locator('[data-call-bubble]').count()) && !done.has('call')) {
    done.add('call');
    await page.locator('[data-call-bubble]').first().click();
    await shot(`call-confirm-${key}`);
    await page.locator('[data-call-cancel]').click();
  }
  if ((await page.locator('[data-ledger]').count()) && !done.has('ledger')) {
    done.add('ledger');
    await page.locator('[data-ledger]').first().click();
    await shot(`money-open-${key}`);
    await page.locator('[data-panel-close]').click();
  }
  if ((await page.locator('[data-score-words]').count()) && !done.has('score')) {
    done.add('score');
    await page.locator('[data-score-words]').first().click();
    await shot(`score-words-${key}`);
    await page.locator('[data-panel-close]').click();
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
console.log(results.join('\n'));
await browser.close();
await server.close();
