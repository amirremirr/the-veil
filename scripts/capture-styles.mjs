// UI V4 (V5): captures the three style directions at 375 x 760 into docs/review/styles (each direction's
// move and reveal screens, plus the side-by-side overview), and runs axe (WCAG 2 A and AA, contrast
// included) on the preview page. Usage: node scripts/capture-styles.mjs [--out docs/review/styles]
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const out = arg('out', 'docs/review/styles');
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5195, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const ready = async (page) => {
  await page.waitForSelector('[data-style-frame]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
};
const phone = await (await browser.newContext({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2 })).newPage();
const lines = [];
for (const s of ['A', 'B', 'C'])
  for (const screen of ['move', 'reveal']) {
    await phone.goto(`${base}?styles=1&only=${s}&screen=${screen}`);
    await ready(phone);
    const fits = await phone.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth);
    const fonts = await phone.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
    await phone.screenshot({ path: `${out}/${s}-${screen}.png` });
    const axe = await new AxeBuilder({ page: phone }).withTags(['wcag2a', 'wcag2aa']).analyze();
    lines.push(`${s}-${screen}: ${fits ? 'fits 375x760' : 'DOES NOT FIT'}; fonts loaded: ${[...new Set(fonts)].join(', ')}; axe violations: ${axe.violations.map((v) => `${v.id} x${v.nodes.length}`).join(', ') || 0}`);
  }
const wide = await (await browser.newContext({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1 })).newPage();
await wide.goto(`${base}?styles=1`);
await ready(wide);
await wide.screenshot({ path: `${out}/overview.png`, fullPage: true });
const axe = await new AxeBuilder({ page: wide }).withTags(['wcag2a', 'wcag2aa']).analyze();
lines.push(`overview: axe violations: ${axe.violations.map((v) => `${v.id} x${v.nodes.length} (${v.nodes[0]?.target?.join(' ')})`).join(', ') || 0}`);
console.log(lines.join('\n'));
await browser.close();
await server.close();
