// UI V3 U5: runaway scores in a Play life, bots only (these numbers describe the bots, not people).
//   npx tsx sim/runaway.ts --games 1000 [--play '{"L2":{...}}'] [--seed runaway]
// After each episode: the ratio of the top bank to the bottom bank (lives where the bottom bank is above 0;
// the rest are counted) and the gap. Then how often the final rank order equals the order after Episode 2,
// and how often the leader after Episode 4 loses the lead in the finale. Ranks are the game's own score
// ranks (playRanks, recorded in the bank history after every round). Mean ± bootstrap SE over lives.
import { createInitialState, step } from '../src/engine/engine';
import { standalone } from '../src/engine/rng';
import { PLAY } from '../src/engine/play/params';
import { playScore } from '../src/engine/play/rules';
import type { GameState } from '../src/engine/types';
import { currentRules } from '../src/engine/version';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const games = Number(arg('games', '300'));
const seedBase = arg('seed', 'runaway');
const overrides = JSON.parse(arg('play', '{}'));
// Deep-merge overrides into PLAY (in memory only; the code is unchanged).
function merge(a: Record<string, unknown>, b: Record<string, unknown>) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') merge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
    else a[k] = v;
  }
}
merge(PLAY as unknown as Record<string, unknown>, overrides);

interface Life {
  ratio: Array<number | null>;
  gap: number[];
  sameAsEp2: number;
  leaderLost: number;
  leaderDefined: number;
  sameAsEp3: number;
  /** (1st score - 4th score) / 1st score at the end; null when the winner's score is not above 0. */
  gapShare: number | null;
  /** The contestant with the lowest bank after Episode 1 finishes first. */
  poorestWins: number;
}

/** Ids in rank order (ties broken by seat), as a string, from a ranks map. */
const orderOf = (ranks: Record<string, number>, ids: string[]) =>
  ids
    .slice()
    .sort((a, b) => ranks[a] - ranks[b] || ids.indexOf(a) - ids.indexOf(b))
    .join(',');

function playOne(seed: string): Life {
  const s: GameState = createInitialState({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed, allBots: true } as Parameters<typeof createInitialState>[0]);
  let guard = 0;
  while (s.phase.kind !== 'END' && guard++ < 20000) if (!step(s, { type: 'ADVANCE' })) throw new Error(`stuck ${s.phase.kind}`);
  const pl = s.play!;
  const ids = s.players.map((p) => p.id);
  const lastOf = (l: number) => pl.bankHistory.filter((h) => h.level === l).slice(-1)[0];
  const ratio: Array<number | null> = [];
  const gap: number[] = [];
  for (const l of [1, 2, 3, 4, 5]) {
    const h = lastOf(l);
    const b = ids.map((id) => h.banks[id]);
    const top = Math.max(...b);
    const bot = Math.min(...b);
    ratio.push(bot > 0 ? top / bot : null);
    gap.push(top - bot);
  }
  const sc = Object.fromEntries(ids.map((id) => [id, playScore(s, id)]));
  const finalRanks = Object.fromEntries(ids.map((id) => [id, 1 + ids.filter((x) => sc[x] > sc[id] + 1e-9).length]));
  const r2 = lastOf(2).ranks;
  const r3 = lastOf(3).ranks;
  const r4 = lastOf(4).ranks;
  const leaders = ids.filter((id) => r4[id] === 1);
  const scores = ids.map((id) => sc[id]).sort((a, b) => b - a);
  const b1 = lastOf(1).banks;
  const poorest = ids.slice().sort((a, b) => b1[a] - b1[b] || ids.indexOf(a) - ids.indexOf(b))[0];
  return {
    ratio,
    gap,
    sameAsEp2: orderOf(finalRanks, ids) === orderOf(r2, ids) ? 1 : 0,
    sameAsEp3: orderOf(finalRanks, ids) === orderOf(r3, ids) ? 1 : 0,
    gapShare: scores[0] > 0 ? (scores[0] - scores[scores.length - 1]) / scores[0] : null,
    poorestWins: finalRanks[poorest] === 1 ? 1 : 0,
    leaderDefined: leaders.length === 1 ? 1 : 0,
    leaderLost: leaders.length === 1 && finalRanks[leaders[0]] !== 1 ? 1 : 0,
  };
}

function boot(xs: number[], f = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)): { m: number; se: number } {
  const m = f(xs);
  const rng = standalone(4242);
  const bs: number[] = [];
  for (let k = 0; k < 300; k++) bs.push(f(xs.map(() => xs[Math.floor(rng.next() * xs.length)])));
  const mu = bs.reduce((a, b) => a + b, 0) / bs.length;
  return { m, se: Math.sqrt(bs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, bs.length - 1)) };
}
const median = (a: number[]) => {
  const s = a.slice().sort((x, y) => x - y);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN;
};

const t0 = Date.now();
const lives: Life[] = [];
for (let g = 0; g < games; g++) lives.push(playOne(`${seedBase}-${g}`));
const out: string[] = [];
out.push(`Runaway scores: ${games} bot lives, 4 seats, NORMAL, seeds ${seedBase}-0..${games - 1}; rules ${currentRules('PLAY').rules}, params ${currentRules('PLAY').params}; overrides ${JSON.stringify(overrides)}`);
for (let l = 0; l < 5; l++) {
  const rs = lives.map((x) => x.ratio[l]).filter((x): x is number => x !== null);
  const r = boot(rs, median);
  const gp = boot(lives.map((x) => x.gap[l]));
  out.push(`After Ep${l + 1}: top/bottom bank median ${r.m.toFixed(2)} ± ${r.se.toFixed(2)} (bottom bank 0 or less in ${(100 * (1 - rs.length / games)).toFixed(1)}% of lives); gap ${gp.m.toFixed(0)} ± ${gp.se.toFixed(0)}`);
}
const same = boot(lives.map((x) => x.sameAsEp2));
const same3 = boot(lives.map((x) => x.sameAsEp3));
const def = lives.filter((x) => x.leaderDefined);
const lost = boot(def.map((x) => x.leaderLost));
out.push(`Final order = order after Ep2: ${(100 * same.m).toFixed(1)}% ± ${(100 * same.se).toFixed(1)} (target at most 35%)`);
out.push(`Final order = order after Ep3: ${(100 * same3.m).toFixed(1)}% ± ${(100 * same3.se).toFixed(1)} (reported)`);
out.push(`Leader after Ep4 loses the lead in the finale: ${(100 * lost.m).toFixed(1)}% ± ${(100 * lost.se).toFixed(1)} of ${def.length} lives with one leader (target at least 20%)`);
const gs = lives.map((x) => x.gapShare).filter((x): x is number => x !== null);
const gsm = boot(gs, median);
const pw = boot(lives.map((x) => x.poorestWins));
out.push(`Score gap 1st to 4th at the end, share of the winner's score, median: ${(100 * gsm.m).toFixed(1)}% ± ${(100 * gsm.se).toFixed(1)} (target at most 40%; winner's score not above 0 in ${lives.length - gs.length} lives)`);
out.push(`Contestant born poorest (lowest bank after Ep1) wins: ${(100 * pw.m).toFixed(1)}% ± ${(100 * pw.se).toFixed(1)} (target at least 15%)`);
out.push(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log(out.join('\n'));
