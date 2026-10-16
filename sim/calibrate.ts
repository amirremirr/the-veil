// Measures mean wealth and mean Values metric per card, per level, from bot-only runs.
import { createInitialState, step } from '../src/engine/engine';
import { mean } from '../src/engine/scoring';
import type { ValuesCard } from '../src/engine/types';

const games = Number(process.argv[2] ?? '200');
const W: Record<string, number[]> = {};
const M: Record<string, number[]> = {};
for (let g = 0; g < games; g++) {
  const s = createInitialState({ mode: 'FULL_RUN', nPlayers: 4, difficulty: 'NORMAL', seed: `cal-${g}`, allBots: true, botSamples: 60, skipCounterfactual: true });
  while (s.phase.kind !== 'END') step(s, { type: 'ADVANCE' });
  for (const r of s.history)
    for (const p of s.players) {
      const k = `${p.values}`;
      (W[k] ??= []).push(r.W[p.id]);
      (M[k] ??= []).push(r.M[p.id]);
    }
}
for (const c of ['EGOIST', 'RAWLSIAN', 'UTILITARIAN', 'MERITOCRAT'] as ValuesCard[])
  console.log(c, 'meanW', mean(W[c]).toFixed(2), 'meanM', mean(M[c]).toFixed(2), 'ratio W/M', (mean(W[c]) / mean(M[c])).toFixed(3));
