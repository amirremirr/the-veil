// H3 (D-194): how often calls happen and how often they are right, per episode (bots, Normal).
// Call rate: rounds with at least one call / rounds with at least one claim. Accuracy: calls on a lie / calls.
// Usage: npx tsx sim/calls.ts --games 300 [--episodes 1,2,3,4,5]
import { createInitialState, step } from '../src/engine/engine';
import type { LevelId } from '../src/engine/types';

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const games = Number(arg('games', '300'));
const episodes = arg('episodes', '1,2,3,4,5').split(',').map(Number) as LevelId[];
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}% ± ${((100 * Math.sqrt(((a / b) * (1 - a / b)) / b)) || 0).toFixed(1)} (n=${b})` : 'n/a');

for (const level of episodes) {
  let rounds = 0;
  let called = 0;
  let calls = 0;
  let right = 0;
  let lies = 0;
  let liesCaught = 0;
  for (let k = 0; k < games; k++) {
    const s = createInitialState({ mode: 'EPISODE', level, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: `calls-${level}-${k}`, allBots: true } as Parameters<typeof createInitialState>[0]);
    let guard = 0;
    while (s.phase.kind !== 'END' && guard++ < 20000) step(s, { type: 'ADVANCE' });
    const cs = s.play!.calls ?? [];
    const claimRounds = new Set(s.messages.filter((m) => m.msg.type === 'CLAIM' && m.level === level).map((m) => m.round));
    rounds += claimRounds.size;
    called += new Set(cs.map((c) => c.round)).size;
    calls += cs.length;
    right += cs.filter((c) => c.lie).length;
    const lied = s.play!.claimLog.filter((c) => c.level === level && c.lied);
    lies += lied.length;
    liesCaught += lied.filter((c) => cs.some((x) => x.round === c.round && x.target === c.pid && x.lie)).length;
  }
  console.log(`Ep${level}: rounds with a call ${pct(called, rounds)}; calls right ${pct(right, calls)}; lies caught by a call ${pct(liesCaught, lies)}`);
}
