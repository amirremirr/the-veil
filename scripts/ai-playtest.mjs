// AI playtest (proxy, not human evidence): plays a Play episode or a life through the UI as one persona,
// saving a screenshot and the visible text of every screen. RUNPLAN T1 and T7.
// Usage: node scripts/ai-playtest.mjs --persona SKIMMER|CAREFUL|BLUFFER [--episode 3] [--mode EPISODE|LIFE]
//        [--players 4] [--difficulty NORMAL] [--seed ai-1] [--name Ana]
// Personas decide from what their screens show them (their own cards and the public table), never from
// other players' private cards.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const persona = arg('persona', 'CAREFUL');
const episode = Number(arg('episode', '3'));
const mode = arg('mode', 'EPISODE');
const players = Number(arg('players', '4'));
const difficulty = arg('difficulty', 'NORMAL');
const seed = arg('seed', `ai-${persona.toLowerCase()}`);
const name = arg('name', 'Ana');
const outDir = arg('out', `docs/playtest/shots/${mode === 'LIFE' ? 'life' : `ep${episode}`}-${persona.toLowerCase()}`);
mkdirSync(outDir, { recursive: true });

const server = await createServer({ server: { port: 5189, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const exe = process.env.PW_EXECUTABLE;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => '__autoplay' in window);
await page.evaluate(
  ([ep, md, np, df, sd, nm]) => {
    const st = window.__veil.getState();
    st.updateSettings({ reducedMotion: true });
    st.start({ mode: md, ...(md === 'EPISODE' ? { level: ep } : {}), ruleset: 'PLAY', nPlayers: np, difficulty: df, seed: sd, humanName: nm });
  },
  [episode, mode, players, difficulty, seed, name],
);

/** The persona's decision for the current screen, computed in the page from the human's own view. */
function decide(persona) {
  const st = window.__veil.getState();
  const g = st.game;
  if (g.phase.kind === 'GUESS') {
    const other = g.players.find((p) => !p.isHuman);
    return { guesses: persona === 'SKIMMER' ? { [other.id]: 'EGOIST' } : { [other.id]: 'UTILITARIAN' } };
  }
  return { auto: true, persona };
}

const lines = [];
let n = 0;
for (let i = 0; i < 1500; i++) {
  await page.waitForTimeout(100);
  const m = await page.evaluate(() => {
    const g = window.__veil.getState().game;
    const root = document.getElementById('root');
    const text = (root.innerText || '').replace(/\s+/g, ' ').trim();
    return {
      kind: g.phase.kind,
      step: g.phase.step ?? '',
      level: g.levelIndex,
      round: g.round,
      text,
      words: text.split(' ').filter(Boolean).length,
      beatNext: !!document.querySelector('[data-beat-next]'),
      tall: document.documentElement.scrollHeight > window.innerHeight,
      hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  if (m.kind === 'END') break;
  n++;
  const key = `${String(n).padStart(3, '0')}-ep${m.level}-r${m.round}-${m.kind}${m.step ? `-${m.step}` : ''}`;
  await page.screenshot({ path: `${outDir}/${key}.jpg`, type: 'jpeg', quality: 55 });
  lines.push(`## ${key} (${m.words} words${m.tall ? ', TALL' : ''}${m.hscroll ? ', HSCROLL' : ''})`, m.text, '');
  if (m.beatNext) {
    await page.click('[data-beat-next]');
    continue;
  }
  await page.evaluate((persona) => window.__personaStep(persona), persona).catch(async () => {
    // Fallback: one scripted screen forward.
    await page.evaluate(() => {
      const g0 = window.__veil.getState().game;
      window.__autoplay((g) => g !== g0);
    });
  });
}
writeFileSync(`${outDir}/screens.md`, [`# ${persona} ${mode} ${mode === 'LIFE' ? '' : `episode ${episode}`} seed ${seed}`, '', ...lines].join('\n'));
console.log(`${persona}: ${n} screens -> ${outDir}`);
await browser.close();
await server.close();
void decide;
