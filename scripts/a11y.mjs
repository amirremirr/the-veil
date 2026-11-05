// Accessibility pass (RUNPLAN T7): axe on every distinct Play screen of a life at 375 x 760.
// Usage: node scripts/a11y.mjs [--seed a11y-1] [--motion on|off]
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const seed = arg('seed', 'a11y-1');
const server = await createServer({ server: { port: 5190, strictPort: false }, logLevel: 'error' });
await server.listen();
const exe = process.env.PW_EXECUTABLE;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } });
const page = await ctx.newPage();
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => '__autoplay' in window);
await page.evaluate((s) => {
  const st = window.__veil.getState();
  st.updateSettings({ reducedMotion: true });
  st.start({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: s, humanName: 'Ana' });
}, seed);
const seen = new Set();
const byRule = {};
let screens = 0;
for (let i = 0; i < 1500; i++) {
  await page.waitForTimeout(80);
  const m = await page.evaluate(() => {
    const g = window.__veil.getState().game;
    const beat = ['data-mycards', 'data-vote', 'data-event', 'data-claims', 'data-outcome', 'data-price', 'data-cards', 'data-missions', 'data-receipts', 'data-result-card'].find((a) => document.querySelector(`[${a}]`)) ?? '';
    return { kind: g.phase.kind, step: g.phase.step ?? '', level: g.levelIndex, beat, beatNext: !!document.querySelector('[data-beat-next]') };
  });
  if (m.kind === 'END' && m.beat === 'data-result-card' && seen.has('END')) break;
  const key = `${m.level}-${m.kind}-${m.step}-${m.beat}`;
  if (!seen.has(key)) {
    seen.add(key);
    screens++;
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    for (const v of res.violations) {
      byRule[v.id] ??= { impact: v.impact, help: v.help, count: 0, screens: [], example: v.nodes[0]?.target?.join(' ') };
      byRule[v.id].count += v.nodes.length;
      if (byRule[v.id].screens.length < 6) byRule[v.id].screens.push(key);
    }
  }
  if (m.kind === 'END' || m.kind === 'RUN_DEBRIEF') {
    if (m.beat === 'data-result-card') {
      seen.add('END');
      break;
    }
  }
  if (m.beatNext) {
    await page.click('[data-beat-next]');
    continue;
  }
  if (m.kind === 'RUN_DEBRIEF' || m.kind === 'END') {
    await page.click('button:has-text("The missions flip"), button:has-text("Skip")').catch(() => {});
    continue;
  }
  await page.evaluate(() => {
    const g0 = window.__veil.getState().game;
    window.__autoplay((g) => g !== g0);
  });
}
// Keyboard: Tab through the last screen; every focused element must match :focus-visible with an outline.
let focusable = 0;
let noRing = 0;
for (let k = 0; k < 8; k++) {
  await page.keyboard.press('Tab');
  const r = await page.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return null;
    const cs = getComputedStyle(e);
    return { ring: e.matches(':focus-visible') && cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' };
  });
  if (!r) continue;
  focusable++;
  if (!r.ring) noRing++;
}
const focus = { tabbed: focusable, noRing };
const out = { seed, screens, rules: byRule, focusOnLastScreen: focus };
writeFileSync('docs/playtest/a11y.json', JSON.stringify(out, null, 2));
console.log(`screens ${screens}`);
for (const [id, r] of Object.entries(byRule)) console.log(`${id} (${r.impact}) x${r.count}: ${r.help} | e.g. ${r.example} | ${r.screens.join(', ')}`);
console.log('focus', JSON.stringify(focus));
await browser.close();
await server.close();
