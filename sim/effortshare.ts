// G4: in Episode 2, how much of the differences in gross income between contestants comes from effort?
// Per round, the squared correlation between each contestant's income and the part their hours earned
// (hours x 4 x talent), averaged over rounds. Bots only (a proxy, not human evidence).
// Usage: npx tsx sim/effortshare.ts --games 300
import { createInitialState, step } from '../src/engine/engine';
import { L2 } from '../src/engine/params';
import type { P2State } from '../src/engine/play/ep2';

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const games = Number(arg('games', '300'));
const r2s: number[] = [];
for (let k = 0; k < games; k++) {
  const s = createInitialState({ mode: 'EPISODE', level: 2, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: `effort-${k}`, allBots: true } as Parameters<typeof createInitialState>[0]);
  let guard = 0;
  while (s.phase.kind !== 'END' && guard++ < 20000) step(s, { type: 'ADVANCE' });
  const l = s.levelState as P2State;
  for (const r of l.rounds) {
    const ids = Object.keys(r.y);
    const y = ids.map((id) => r.y[id]);
    const e = ids.map((id) => r.effort[id] * L2.TALENT_MULT * l.talents[id]);
    const my = y.reduce((a, b) => a + b, 0) / y.length;
    const me = e.reduce((a, b) => a + b, 0) / e.length;
    const cov = y.reduce((a, yi, j) => a + (yi - my) * (e[j] - me), 0);
    const vy = y.reduce((a, yi) => a + (yi - my) ** 2, 0);
    const ve = e.reduce((a, ei) => a + (ei - me) ** 2, 0);
    if (vy > 0 && ve > 0) r2s.push((cov * cov) / (vy * ve));
  }
}
const m = r2s.reduce((a, b) => a + b, 0) / r2s.length;
const sd = Math.sqrt(r2s.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, r2s.length - 1));
console.log(`Share of income differences explained by effort (mean R^2 over ${r2s.length} rounds): ${(100 * m).toFixed(1)}% ± ${((100 * sd) / Math.sqrt(r2s.length)).toFixed(1)}`);
