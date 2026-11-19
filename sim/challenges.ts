// V6 part 4 (D-220): how often a bot in seat 1 meets each challenge over a life (bots, not people).
//   npx tsx sim/challenges.ts 300
import { createInitialState, step, visibleState } from '../src/engine/engine';
import { CHALLENGES, challengeDone } from '../src/ui/play/challenges';
const n = Number(process.argv[2] ?? 300);
const done: Record<string, number> = {};
for (let g = 0; g < n; g++) {
  const s = createInitialState({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: `ch-${g}`, allBots: true } as Parameters<typeof createInitialState>[0]);
  let k = 0;
  while (s.phase.kind !== 'END' && s.phase.kind !== 'RUN_DEBRIEF' && k++ < 20000) step(s, { type: 'ADVANCE' });
  const v = visibleState(s, s.players[0].id);
  for (const c of CHALLENGES) done[c] = (done[c] ?? 0) + (challengeDone(v, c) ? 1 : 0);
}
console.log(CHALLENGES.map((c) => `${c} ${((100 * done[c]) / n).toFixed(1)}%`).join('\n'));
