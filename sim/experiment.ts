// Parameter sweeps for single levels. Mutates params in memory only.
// Usage: npx tsx sim/experiment.ts <level> <games> '<json patch per param group>'
// Example: npx tsx sim/experiment.ts 2 200 '{"L2":{"KAPPA":0.1}}'
import * as P from '../src/engine/params';
import { createInitialState, step } from '../src/engine/engine';
import { mean } from '../src/engine/scoring';
import type { L2Debrief } from '../src/engine/levels/level2';
import type { L3Debrief } from '../src/engine/levels/level3';
import type { LevelId } from '../src/engine/types';

const level = Number(process.argv[2] ?? '2') as LevelId;
const games = Number(process.argv[3] ?? '200');
const patch = JSON.parse(process.argv[4] ?? '{}') as Record<string, Record<string, unknown>>;
for (const [group, values] of Object.entries(patch)) Object.assign((P as unknown as Record<string, object>)[group], values);

const out: number[][] = [];
for (let g = 0; g < games; g++) {
  const s = createInitialState({
    mode: 'SINGLE_LEVEL',
    level,
    nPlayers: 4,
    difficulty: 'NORMAL',
    seed: `exp-${g}`,
    allBots: true,
    botSamples: 100,
    skipCounterfactual: true,
  });
  while (s.phase.kind !== 'END') step(s, { type: 'ADVANCE' });
  const d = s.levelResults[level];
  if (level === 2) {
    const d2 = d as L2Debrief;
    out.push([mean(d2.rounds.map((r) => r.t)), mean(d2.rounds.flatMap((r) => Object.values(r.tVotes)))]);
  } else if (level === 3) {
    const d3 = d as L3Debrief;
    const r1 = d3.rounds[0];
    const r2 = d3.rounds[1];
    const unr = r2.premium === null || Object.values(r2.choices).every((c) => !c.buy) ? 1 : 0;
    const rv = Object.values(d3.regimeVotes ?? {});
    out.push([unr, rv.every((v) => v === rv[0]) ? 1 : 0, Object.values(r1.choices).filter((c) => c.buy).length]);
  }
}
const cols = out[0].map((_, k) => mean(out.map((r) => r[k])).toFixed(3));
console.log(JSON.stringify(patch), '=>', cols.join(' | '));
