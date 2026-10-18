// Phone-width walkthrough of a full run, one human screen at a time.
// Usage: npm run walkthrough -- [--width 375] [--seed playtest-1] [--save walkthrough-after.txt]
// Uses an installed browser via PW_CHANNEL (default msedge) when Playwright's bundled Chromium is missing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const width = Number(arg('width', '375'));
const height = Number(arg('height', '760'));
const seed = arg('seed', 'playtest-1');
const save = arg('save', '');
const outDir = 'walkthrough-out';
mkdirSync(outDir, { recursive: true });

const server = await createServer({ server: { port: 5188, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];

async function launch() {
  const channel = process.env.PW_CHANNEL;
  try {
    return await chromium.launch(channel ? { channel } : {});
  } catch {
    return await chromium.launch({ channel: 'msedge' });
  }
}
const browser = await launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => '__autoplay' in window);
await page.evaluate((s) => {
  const st = window.__veil.getState();
  st.updateSettings({ reducedMotion: true });
  st.start({ mode: 'FULL_RUN', nPlayers: 4, difficulty: 'NORMAL', seed: s });
}, seed);

/** Measure the current screen. Runs in the page. */
function measure() {
  const g = window.__veil.getState().game;
  const root = document.querySelector('main') || document.getElementById('root');
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const words = (root.innerText || '').trim().split(/\s+/).filter(Boolean).length;
  const buttons = [...document.querySelectorAll('button')].filter(isVisible).length;
  // Overlap: content is hidden if a bottom bar or floating button still covers it when the page is
  // scrolled to the bottom, or if a floating (not full-width) element covers it at first view.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const overlaysNow = () =>
    [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') return false;
      if (!isVisible(el)) return false;
      const r = el.getBoundingClientRect();
      return r.top > vh / 2 && r.height < vh / 2;
    });
  const candidates = [...root.querySelectorAll('button, .choice, p, li, td, th, h1, h2, h3, label, dt, dd')].filter(isVisible);
  const label = (el) => (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 60);
  const covered = (onlyFloating) => {
    const out = [];
    const overlays = overlaysNow().filter((o) => !onlyFloating || o.getBoundingClientRect().width < vw * 0.8);
    for (const el of candidates) {
      if (overlays.some((o) => o.contains(el) || el.contains(o))) continue;
      const r = el.getBoundingClientRect();
      for (const o of overlays) {
        const q = o.getBoundingClientRect();
        const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left);
        const iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (ix > 4 && iy > 4) {
          out.push(label(el));
          break;
        }
      }
    }
    return out;
  };
  window.scrollTo(0, 0);
  const atTop = covered(true);
  window.scrollTo(0, document.documentElement.scrollHeight);
  const atBottom = covered(false);
  const overlaps = [...atTop, ...atBottom];
  window.scrollTo(0, 0);
  return {
    level: g.levelIndex,
    round: g.round,
    kind: g.phase.kind,
    step: g.phase.step ?? '',
    words,
    buttons,
    height: document.documentElement.scrollHeight,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    overlaps: [...new Set(overlaps)],
    logLen: g.log.length,
  };
}

const rows = [];
const seen = new Set();
const lines = [];
for (let i = 0; i < 1000; i++) {
  await page.waitForTimeout(120);
  const m = await page.evaluate(measure);
  if (m.kind === 'END') break;
  const group = ['VALUES_REVEAL', 'GUESS', 'RUN_DEBRIEF'].includes(m.kind) ? 'Run' : `L${m.level}`;
  const key = `${group}-${m.kind}-${m.step || 'x'}`;
  if (!seen.has(key)) {
    seen.add(key);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/${String(seen.size).padStart(3, '0')}-${key}.png`, fullPage: true });
  }
  // One human screen forward. Record which human submissions it produced.
  const added = await page.evaluate(() => {
    const before = window.__veil.getState().game.log.length;
    const g0 = window.__veil.getState().game;
    window.__autoplay((g) => g !== g0);
    return window.__veil.getState().game.log.slice(before).map((x) => x.action.type);
  });
  const decisions = added.filter((x) => x === 'SUBMIT_DECISION' || x === 'SUBMIT_GUESSES').length;
  rows.push({ ...m, group, decisions });
  lines.push(
    `${group.padEnd(4)} R${m.round} ${`${m.kind}:${m.step}`.padEnd(24)} words=${String(m.words).padStart(4)} buttons=${String(m.buttons).padStart(2)} height=${String(m.height).padStart(5)}${m.hscroll ? ' HSCROLL' : ''}`,
  );
  for (const o of m.overlaps) lines.push(`     OVERLAP: ${o}`);
}

const groups = [...new Set(rows.map((r) => r.group))];
const table = [];
table.push(`Walkthrough: seed ${seed}, ${width}x${height}, FULL_RUN, 4 players, Normal`);
table.push('');
table.push('Group  Screens  Decisions  Words  Tallest(px)  Overlaps  HScroll');
let tot = { s: 0, d: 0, w: 0, o: 0, h: 0 };
for (const gname of groups) {
  const rs = rows.filter((r) => r.group === gname);
  const s = rs.length;
  const d = rs.reduce((a, r) => a + r.decisions, 0);
  const w = rs.reduce((a, r) => a + r.words, 0);
  const tall = Math.max(...rs.map((r) => r.height));
  const o = rs.reduce((a, r) => a + r.overlaps.length, 0);
  const h = rs.filter((r) => r.hscroll).length;
  tot = { s: tot.s + s, d: tot.d + d, w: tot.w + w, o: tot.o + o, h: tot.h + h };
  table.push(`${gname.padEnd(6)} ${String(s).padStart(7)}  ${String(d).padStart(9)}  ${String(w).padStart(5)}  ${String(tall).padStart(11)}  ${String(o).padStart(8)}  ${String(h).padStart(7)}`);
}
table.push(`${'Total'.padEnd(6)} ${String(tot.s).padStart(7)}  ${String(tot.d).padStart(9)}  ${String(tot.w).padStart(5)}  ${''.padStart(11)}  ${String(tot.o).padStart(8)}  ${String(tot.h).padStart(7)}`);
const text = [...table, '', 'Screens:', ...lines].join('\n');
console.log(text);
if (save) writeFileSync(save, text);
await browser.close();
await server.close();
