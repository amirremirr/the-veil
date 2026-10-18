// Level 4 training rates by group, childcare and round (single-level runs, all bots).
// Usage: npx tsx sim/l4train.ts --games 2000
import { createInitialState, step } from '../src/engine/engine';
import type { L4Debrief } from '../src/engine/levels/level4';
import { HARDSHIP, L4 } from '../src/engine/params';

// Test only: --no-hardship turns the hardship penalty off at run time. Source params are unchanged.
if (process.argv.includes('--no-hardship')) HARDSHIP.POINTS_PER_COIN = 0;
// Test only: --costs 20,40,60,80 overrides the training costs at run time.
const ci = process.argv.indexOf('--costs');
if (ci >= 0) (L4 as { COST_OPTIONS: number[] }).COST_OPTIONS = process.argv[ci + 1].split(',').map(Number);

const i = process.argv.indexOf('--games');
const games = i >= 0 ? Number(process.argv[i + 1]) : 2000;

type Cell = [number, number];
const R = 5;
const keys = ['CIRCLE', 'SQUARE', 'CIRCLE+care', 'CIRCLE-nocare', 'SQUARE+care', 'SQUARE-nocare'];
const train: Record<string, Cell[]> = Object.fromEntries(keys.map((k) => [k, Array.from({ length: R }, () => [0, 0] as Cell)]));
const byCost: Record<string, Cell> = {};
const piC: number[][] = [];
const piS: number[][] = [];
const goodJob: Record<string, Cell[]> = { CIRCLE: Array.from({ length: R }, () => [0, 0] as Cell), SQUARE: Array.from({ length: R }, () => [0, 0] as Cell) };
const wealth: Record<string, Cell[]> = { trained: Array.from({ length: R }, () => [0, 0] as Cell), untrained: Array.from({ length: R }, () => [0, 0] as Cell) };
let below40Trained = 0;
let trainedTotal = 0;

for (let g = 0; g < games; g++) {
  const s = createInitialState({ mode: 'SINGLE_LEVEL', level: 4, nPlayers: 4, difficulty: 'NORMAL', seed: `l4-${g}`, allBots: true, botSamples: 300, skipCounterfactual: true } as never);
  let guard = 0;
  while (s.phase.kind !== 'END' && guard++ < 10000) if (!step(s, { type: 'ADVANCE' })) throw new Error(`stuck ${s.phase.kind}`);
  const d = s.levelResults[4] as L4Debrief;
  piC.push(d.piPath.CIRCLE);
  piS.push(d.piPath.SQUARE);
  d.rounds.forEach((r, k) => {
    for (const id of Object.keys(r.invest)) {
      const grp = d.groups[id];
      const care = d.care[id] ? '+care' : '-nocare';
      const t = r.invest[id] ? 1 : 0;
      for (const key of [grp, grp + care]) {
        train[key][k][0] += t;
        train[key][k][1]++;
      }
      const c = String(r.costs[id]);
      byCost[c] ??= [0, 0];
      byCost[c][0] += t;
      byCost[c][1]++;
      goodJob[grp][k][0] += r.job[id] === 'SIMPLE' ? 0 : 1;
      goodJob[grp][k][1]++;
      const w = wealth[t ? 'trained' : 'untrained'][k];
      w[0] += r.W[id];
      w[1]++;
      if (t) {
        trainedTotal++;
        if (r.W[id] < 40) below40Trained++;
      }
    }
  });
}

const pct = (c: Cell) => (c[1] ? `${((100 * c[0]) / c[1]).toFixed(1)}%` : '  -  ');
const avg = (c: Cell) => (c[1] ? (c[0] / c[1]).toFixed(1) : '-');
const path = (xs: number[][]) => Array.from({ length: xs[0].length }, (_, k) => (xs.reduce((a, p) => a + p[k], 0) / xs.length).toFixed(3)).join(' -> ');
console.log(`Level 4 alone, ${games} games, 4 bots, NORMAL, hardship ${HARDSHIP.POINTS_PER_COIN ? 'on' : 'OFF'}, costs ${L4.COST_OPTIONS.join('/')}`);
console.log(`Training rate by round        R1      R2      R3      R4      R5`);
for (const k of keys) console.log(`  ${k.padEnd(16)}` + train[k].map((c) => pct(c).padStart(8)).join(''));
console.log(`Training rate by this round's cost: ${Object.entries(byCost).sort((a, b) => +a[0] - +b[0]).map(([c, v]) => `${c}: ${pct(v)}`).join(', ')}`);
console.log(`Good job rate   CIRCLE ${goodJob.CIRCLE.map(pct).join(' ')}`);
console.log(`                SQUARE ${goodJob.SQUARE.map(pct).join(' ')}`);
console.log(`Mean money      trained ${wealth.trained.map(avg).join(' ')}; untrained ${wealth.untrained.map(avg).join(' ')}`);
console.log(`Trainers who ended the round below 40: ${((100 * below40Trained) / Math.max(1, trainedTotal)).toFixed(1)}%`);
console.log(`HireBot belief, Circle: ${path(piC)}`);
console.log(`HireBot belief, Square: ${path(piS)}`);
console.log(`Games ending with Circle belief below 0.36: ${piC.filter((p) => p[p.length - 1] < 0.36).length} of ${games} (${((100 * piC.filter((p) => p[p.length - 1] < 0.36).length) / games).toFixed(1)}%); ever below 0.36: ${piC.filter((p) => p.some((x) => x < 0.36)).length}`);
