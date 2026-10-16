// Diagnostic: Level 3 insurance purchase rates by round, risk type, and Values card.
import { createInitialState, step } from '../src/engine/engine';
import type { L3Debrief } from '../src/engine/levels/level3';

const games = Number(process.argv[2] ?? '200');
const stats: Record<string, [number, number]> = {};
for (let g = 0; g < games; g++) {
  const s = createInitialState({ mode: 'SINGLE_LEVEL', level: 3, nPlayers: 4, difficulty: 'NORMAL', seed: `dbg-${g}`, allBots: true, botSamples: 100 });
  while (s.phase.kind !== 'END') step(s, { type: 'ADVANCE' });
  const d = s.levelResults[3] as L3Debrief;
  d.rounds.slice(0, 2).forEach((r, ri) => {
    if (r.premium === null) return;
    for (const p of s.players) {
      for (const key of [`r${ri + 1} ${d.types[p.id]} ${p.values}`, `r${ri + 1} ${d.types[p.id]} ${p.id}`]) {
        stats[key] ??= [0, 0];
        stats[key][1]++;
        if (r.choices[p.id].buy) stats[key][0]++;
      }
    }
  });
}
for (const k of Object.keys(stats).sort()) console.log(k.padEnd(30), (stats[k][0] / stats[k][1]).toFixed(2), stats[k][1]);
