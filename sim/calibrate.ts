// METRIC_SCALE calibration (D-13, D-91): for each Values card, mean wealth / mean Values metric over every
// player-round of bot-only full runs. A card's scale is set to this ratio, so its scaled metric averages
// the same as wealth. The SE is a bootstrap over whole games (fixed resampling seed). Bot-only (D-76).
// Usage: npx tsx sim/calibrate.ts [games=2000] [samples=60] [boot=400]
import { execSync } from 'node:child_process';
import { createInitialState, step } from '../src/engine/engine';
import { METRIC_SCALE } from '../src/engine/params';
import { standalone } from '../src/engine/rng';
import { currentRules } from '../src/engine/version';
import { VALUES_CARDS, type ValuesCard } from '../src/engine/types';

const games = Number(process.argv[2] ?? '2000');
const samples = Number(process.argv[3] ?? '60');
const BOOT = Number(process.argv[4] ?? '400');

/** Per game and card: sum of wealth, sum of metric. */
type Sums = Record<ValuesCard, [number, number]>;
const perGame: Sums[] = [];
const t0 = Date.now();
for (let g = 0; g < games; g++) {
  const s = createInitialState({ mode: 'FULL_RUN', nPlayers: 4, difficulty: 'NORMAL', seed: `cal-${g}`, allBots: true, botSamples: samples, skipCounterfactual: true });
  while (s.phase.kind !== 'END') step(s, { type: 'ADVANCE' });
  const sums = Object.fromEntries(VALUES_CARDS.map((c) => [c, [0, 0]])) as unknown as Sums;
  for (const r of s.history)
    for (const p of s.players) {
      sums[p.values][0] += r.W[p.id];
      sums[p.values][1] += r.M[p.id];
    }
  perGame.push(sums);
  if ((g + 1) % Math.max(1, Math.floor(games / 10)) === 0) process.stderr.write(`  ${g + 1}/${games} games (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
}

const ratio = (gs: Sums[], c: ValuesCard) => {
  let w = 0;
  let m = 0;
  for (const x of gs) {
    w += x[c][0];
    m += x[c][1];
  }
  return w / m;
};
const rng = standalone(0xca1);
const boots: Record<ValuesCard, number[]> = Object.fromEntries(VALUES_CARDS.map((c) => [c, []])) as unknown as Record<ValuesCard, number[]>;
for (let b = 0; b < BOOT; b++) {
  const sample = Array.from({ length: perGame.length }, () => perGame[rng.int(perGame.length)]);
  for (const c of VALUES_CARDS) boots[c].push(ratio(sample, c));
}
const sd = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // Not a git checkout.
}
const rules = currentRules();
console.log(`METRIC_SCALE calibration: ${games} full runs (seeds cal-0 to cal-${games - 1}), 4 bots, NORMAL, ${samples} MC samples, ${BOOT} bootstrap resamples. Code ${commit}, rules ${rules.rules}, params ${rules.params}.`);
for (const c of VALUES_CARDS) {
  const r = ratio(perGame, c);
  const e = sd(boots[c]);
  const cur = METRIC_SCALE[c];
  const away = e > 0 ? `${(Math.abs(cur - r) / e).toFixed(1)} SE from the estimate` : 'exact: the metric is wealth itself';
  console.log(`${c.padEnd(12)} W/M ${r.toFixed(3)} ± ${e.toFixed(3)}   current scale ${cur}   (${away})`);
}
