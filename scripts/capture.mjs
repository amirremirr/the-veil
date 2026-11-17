// UI V3 (U4): capture a Play life or episode with motion ON, one JPEG per screen plus mid-animation frames
// of every reveal (wheel, peaks, Receipts). For the review loop; screenshots only, no checks.
// Usage: node scripts/capture.mjs --out docs/review/ui-v3-shots/life --mode LIFE --seed fresh-life-1
//        node scripts/capture.mjs --out docs/review/ui-v3-shots/ep3-hard --episode 3 --difficulty HARD --seed fresh-ep3-hard
//        --motion off  captures with reduced motion (static frames only)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const out = arg('out', 'walkthrough-out/capture');
const mode = arg('mode', 'EPISODE');
const episode = Number(arg('episode', '3'));
const seed = arg('seed', 'fresh-life-1');
const difficulty = arg('difficulty', 'NORMAL');
const motionOn = arg('motion', 'on') !== 'off';
const opening = arg('opening', '');
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { port: 5191, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 1 });
await page.goto(url);
await page.evaluate(() => {
  localStorage.clear();
  // A first-time player sees the coach marks.
  localStorage.setItem('veil.play.coach', '1');
});
await page.reload();
await page.waitForFunction(() => '__autoplay' in window);
let n = 0;
const lines = [];
const shot = async (label) => {
  n++;
  const file = `${String(n).padStart(3, '0')}-${label}.jpg`;
  await page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 70 });
  lines.push(file);
};
if (opening) {
  await page.evaluate(() => window.__veil.getState().go('playMode'));
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(300);
    if (!(await page.locator('[data-opening]').count())) break;
    await shot(`opening-${i + 1}`);
    await page.click('[data-opening-next]');
  }
  await shot('pick-your-show');
}
await page.evaluate(
  ([s, md, ep, df, mo]) => {
    const st = window.__veil.getState();
    st.updateSettings({ reducedMotion: !mo });
    st.start({ ...(md === 'LIFE' ? { mode: 'LIFE' } : { mode: 'EPISODE', level: ep }), ruleset: 'PLAY', nPlayers: 4, difficulty: df, seed: s });
  },
  [seed, mode, episode, difficulty, motionOn],
);

const state = () =>
  page.evaluate(() => {
    const g = window.__veil.getState().game;
    const beat = ['data-mycards', 'data-vote', 'data-event', 'data-bar', 'data-outcome', 'data-price', 'data-cards', 'data-ranking', 'data-receipts', 'data-receipt', 'data-result-card'].map((a) => (document.querySelector(`[${a}]`) ? a.slice(5) : '')).find(Boolean) || '';
    return {
      key: `ep${g.levelIndex}-r${g.round}-${g.phase.kind}${g.phase.step ? `-${g.phase.step}` : ''}${beat ? `-${beat}` : ''}`,
      kind: g.phase.kind,
      beatNext: !!document.querySelector('[data-beat-next]'),
      skip: !!document.querySelector('[data-skip]'),
      spinning: !!document.querySelector('[data-stage]') && !document.querySelector('[data-outcome]') && /Wheel of Misfortune/.test(document.body.innerText),
      result: !!document.querySelector('[data-result-card]'),
    };
  });

for (let i = 0; i < 400; i++) {
  await page.waitForTimeout(motionOn ? 150 : 80);
  const s = await state();
  if (s.result) {
    await page.waitForTimeout(600);
    await shot('result-card');
    break;
  }
  if (s.kind === 'END') break;
  // Mid-animation frames of a reveal: the wheel while it turns, a staged peak while the spotlight moves.
  if (motionOn && (s.skip || s.spinning)) {
    await shot(`${s.key}-mid1`);
    await page.waitForTimeout(900);
    await shot(`${s.key}-mid2`);
    for (let w = 0; w < 30; w++) {
      const x = await state();
      if (!x.skip && !x.spinning) break;
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);
  } else if (motionOn) await page.waitForTimeout(700);
  const s2 = await state();
  await shot(s2.key);
  if (s2.beatNext) {
    await page.click('[data-beat-next]');
    continue;
  }
  if (s2.kind === 'RUN_DEBRIEF') {
    const b = page.getByRole('button', { name: /Skip|See how you played|Next/ }).first();
    if (await b.count()) await b.click();
    continue;
  }
  await page.evaluate(() => {
    const g0 = window.__veil.getState().game;
    window.__autoplay((g) => g !== g0);
  });
}
writeFileSync(`${out}/index.txt`, lines.join('\n') + '\n');
console.log(`${n} frames in ${out}`);
await browser.close();
await server.close();
