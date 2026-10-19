// Headless bot-only simulation CLI (Section 9.6).
// Usage: npm run sim -- --games 2000 --players 4 --difficulty NORMAL --samples 300 --out sim/out
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialState, step, totalScore } from '../src/engine/engine';
import { mean } from '../src/engine/scoring';
import { bestEffort, type L2Debrief } from '../src/engine/levels/level2';
import type { L1Debrief } from '../src/engine/levels/level1';
import type { L3Debrief } from '../src/engine/levels/level3';
import type { L4Debrief } from '../src/engine/levels/level4';
import type { L5Debrief } from '../src/engine/levels/level5';
import type { Difficulty, GameState, ValuesCard } from '../src/engine/types';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const games = Number(arg('games', '2000'));
const nPlayers = Number(arg('players', '4')) as 2 | 3 | 4;
const difficulty = arg('difficulty', 'NORMAL') as Difficulty;
const samples = Number(arg('samples', '300'));
const outDir = arg('out', 'sim/out');
const seedBase = arg('seed', 'sim');

function playOne(seed: string): GameState {
  const s = createInitialState({
    mode: 'FULL_RUN',
    nPlayers,
    difficulty,
    seed,
    allBots: true,
    botSamples: samples,
    skipCounterfactual: true,
  });
  let guard = 0;
  while (s.phase.kind !== 'END' && guard++ < 10000) if (!step(s, { type: 'ADVANCE' })) throw new Error(`stuck ${s.phase.kind}`);
  return s;
}

const header = [
  'seed',
  'l1_votes_P1',
  'l1_votes_P2',
  'l1_votes_P3',
  'l1_votes_P4',
  'l2_mean_t',
  'l2_mean_effort_gap',
  'l3_unraveled_by_r2',
  'l3_regime',
  'l3_regime_unanimous',
  'l4_gap',
  'l4_policy',
  'l4_pi_square_final',
  'l5_amendments',
  'l5_slope',
  'winner_cards',
];
const rows: string[] = [header.join(',')];

const extra = {
  egoVotes: { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<string, number>,
  highBuy: [[0, 0], [0, 0]] as Array<[number, number]>,
  lowBuyR1: [0, 0] as [number, number],
  r2Open: 0,
  r2Price30: 0,
  r1PriceSum: 0,
  r2PriceSum: 0,
  runs: [] as Array<{ cards: ValuesCard[]; raw: number[][]; guess: number[] }>,
  levelScores: [[], [], [], [], []] as number[][],
  tableAvg: [[], [], [], [], []] as number[][],
};
const agg = {
  votes: { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<string, number>,
  t: [] as number[],
  effortGap: [] as number[],
  effortAbsGap: [] as number[],
  unravel: 0,
  unanimous: 0,
  regimes: {} as Record<string, number>,
  gaps: [] as number[],
  gapPositive: 0,
  policies: {} as Record<string, number>,
  gapByPolicy: {} as Record<string, number[]>,
  piSquare: [] as number[][],
  amend: 0,
  slopes: [] as number[],
  wins: { EGOIST: 0, RAWLSIAN: 0, UTILITARIAN: 0, MERITOCRAT: 0 } as Record<ValuesCard, number>,
  dealt: { EGOIST: 0, RAWLSIAN: 0, UTILITARIAN: 0, MERITOCRAT: 0 } as Record<ValuesCard, number>,
};

const t0 = Date.now();
for (let g = 0; g < games; g++) {
  const seed = `${seedBase}-${g}`;
  const s = playOne(seed);
  const d1 = s.levelResults[1] as L1Debrief;
  const d2 = s.levelResults[2] as L2Debrief;
  const d3 = s.levelResults[3] as L3Debrief;
  const d4 = s.levelResults[4] as L4Debrief;
  const d5 = s.levelResults[5] as L5Debrief;
  const votes = { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<string, number>;
  for (const r of d1.rounds) for (const v of Object.values(r.votes)) votes[v]++;
  for (const r of d1.rounds)
    for (const [id, v] of Object.entries(r.votes)) if (s.players.find((p) => p.id === id)?.values === 'EGOIST') extra.egoVotes[v]++;
  d3.rounds.slice(0, 2).forEach((r, k) => {
    if (r.regime !== 'VOL' || r.premium === null) return;
    for (const p of s.players)
      if (d3.types[p.id] === 'HIGH') {
        extra.highBuy[k][1]++;
        if (r.choices[p.id].buy) extra.highBuy[k][0]++;
      }
  });
  const r1 = d3.rounds[0];
  if (r1.regime === 'VOL' && r1.premium !== null)
    for (const p of s.players)
      if (d3.types[p.id] === 'LOW') {
        extra.lowBuyR1[1]++;
        if (r1.choices[p.id].buy) extra.lowBuyR1[0]++;
      }
  const r2b = d3.rounds[1];
  if (r2b.regime === 'VOL' && r2b.premium !== null) {
    extra.r2Open++;
    if (r2b.premium >= 30 - 1e-9) extra.r2Price30++;
    extra.r1PriceSum += r1.premium ?? 0;
    extra.r2PriceSum += r2b.premium;
  }
  extra.runs.push({
    cards: s.players.map((p) => p.values),
    raw: s.players.map((p) => s.scores[p.id].byLevel.slice()),
    guess: s.players.map((p) => s.scores[p.id].guessBonus),
  });
  for (const p of s.players) for (let L = 0; L < 5; L++) extra.levelScores[L].push(s.scores[p.id].byLevel[L]);
  for (let L = 0; L < 5; L++) extra.tableAvg[L].push(mean(s.players.map((p) => s.scores[p.id].byLevel[L])));
  for (const k in votes) agg.votes[k] += votes[k];
  const meanT = mean(d2.rounds.map((r) => r.t));
  const gaps: number[] = [];
  const absGaps: number[] = [];
  d2.rounds.forEach((r) => {
    for (const id of Object.keys(r.effort)) {
      const e = bestEffort(r.t, d2.talents[id], s.players.length);
      gaps.push(r.effort[id] - e);
      absGaps.push(Math.abs(r.effort[id] - e));
    }
  });
  agg.t.push(meanT);
  agg.effortGap.push(mean(gaps));
  agg.effortAbsGap.push(mean(absGaps));
  const r2 = d3.rounds[1];
  const unraveled = r2.premium === null || Object.values(r2.choices).every((c) => !c.buy);
  if (unraveled) agg.unravel++;
  const rv = Object.values(d3.regimeVotes ?? {});
  const unanimous = rv.length > 0 && rv.every((v) => v === rv[0]);
  if (unanimous) agg.unanimous++;
  agg.regimes[d3.regime] = (agg.regimes[d3.regime] ?? 0) + 1;
  agg.gaps.push(d4.gap);
  if (d4.gap > 0) agg.gapPositive++;
  agg.policies[d4.policy] = (agg.policies[d4.policy] ?? 0) + 1;
  (agg.gapByPolicy[d4.policy] ??= []).push(mean(d4.meanByGroup.slice(3).map((m) => m.gap)));
  agg.piSquare.push(d4.piPath.SQUARE);
  if (d5.amendments.length > 0) agg.amend++;
  agg.slopes.push(d5.slope);
  const totals = s.players.map((p) => [p, totalScore(s, p.id)] as const);
  const best = Math.max(...totals.map((x) => x[1]));
  const winners = totals.filter((x) => Math.abs(x[1] - best) < 1e-9).map((x) => x[0]);
  for (const p of s.players) agg.dealt[p.values]++;
  for (const w of winners) agg.wins[w.values] += 1 / winners.length;
  rows.push(
    [
      seed,
      votes.P1,
      votes.P2,
      votes.P3,
      votes.P4,
      meanT.toFixed(3),
      mean(gaps).toFixed(3),
      unraveled ? 1 : 0,
      d3.regime,
      unanimous ? 1 : 0,
      d4.gap.toFixed(2),
      d4.policy,
      d4.piPath.SQUARE[d4.piPath.SQUARE.length - 1].toFixed(3),
      d5.amendments.length,
      d5.slope.toFixed(4),
      winners.map((w) => w.values).join('|'),
    ].join(','),
  );
  if ((g + 1) % Math.max(1, Math.floor(games / 10)) === 0)
    process.stderr.write(`  ${g + 1}/${games} games (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
}

mkdirSync(outDir, { recursive: true });
const csvPath = `${outDir}/runs-${nPlayers}p-${difficulty}.csv`;
writeFileSync(csvPath, rows.join('\n'));

const totalVotes = Object.values(agg.votes).reduce((a, b) => a + b, 0);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const lines: string[] = [];
lines.push(`THE VEIL simulation: ${games} full runs, ${nPlayers} bots, ${difficulty}, ${samples} MC samples`);
lines.push('');
lines.push('L1 principle votes:');
for (const k of ['P1', 'P2', 'P3', 'P4']) lines.push(`  ${k}: ${pct(agg.votes[k] / totalVotes)}`);
lines.push(`L2 mean chosen t: ${mean(agg.t).toFixed(3)}   (target 0.2 to 0.5)`);
lines.push(
  `L2 mean effort minus e*: ${mean(agg.effortGap).toFixed(3)}, mean abs gap: ${mean(agg.effortAbsGap).toFixed(3)}   (target within 1)`,
);
lines.push(`L3 regime vote unanimous: ${pct(agg.unanimous / games)}   (target at most 30%)`);
lines.push(`L3 regimes chosen: ${JSON.stringify(agg.regimes)}`);
lines.push(`L4 mean group gap: ${mean(agg.gaps).toFixed(2)}; gap positive in ${pct(agg.gapPositive / games)}   (target at least 80%)`);
lines.push(`L4 policies chosen: ${JSON.stringify(agg.policies)}`);
lines.push(
  `L4 mean gap in rounds 4-5 by policy: ${JSON.stringify(
    Object.fromEntries(Object.entries(agg.gapByPolicy).map(([k, v]) => [k, Number(mean(v).toFixed(2))])),
  )}`,
);
const piLen = agg.piSquare[0].length;
lines.push(
  `L4 mean pi_Square path: ${Array.from({ length: piLen }, (_, k) => mean(agg.piSquare.map((p) => p[k])).toFixed(3)).join(' -> ')}`,
);
lines.push(`L5 at least one amendment proposed: ${pct(agg.amend / games)}   (target at least 90%)`);
lines.push(`L5 mean slope of delta-t on income rank: ${mean(agg.slopes).toFixed(4)}   (target negative)`);
lines.push('Win rate by Values card, per seat holding it (ties split; parity is 1/players; target 15% to 35%):');
for (const c of Object.keys(agg.wins) as ValuesCard[])
  lines.push(
    `  ${c}: ${pct(agg.wins[c] / Math.max(1, agg.dealt[c]))}  (share of runs won by a holder: ${pct(agg.wins[c] / games)}; held ${pct(agg.dealt[c] / games / nPlayers)} of seats)`,
  );
// Standardized level points (rules v2, step 6): 100 + 50 x (score - table average) / SD, where SD is the
// spread of within-table deviations measured in this same run. Win rates below use these points.
const levelSD = [0, 1, 2, 3, 4].map((L) => {
  const devs = extra.runs.flatMap((r) => {
    const avg = mean(r.raw.map((x) => x[L]));
    return r.raw.map((x) => x[L] - avg);
  });
  return Math.sqrt(mean(devs.map((d) => d * d)));
});
const stdWins: Record<ValuesCard, number> = { EGOIST: 0, RAWLSIAN: 0, UTILITARIAN: 0, MERITOCRAT: 0 };
const stdSeats: Record<ValuesCard, number> = { EGOIST: 0, RAWLSIAN: 0, UTILITARIAN: 0, MERITOCRAT: 0 };
for (const r of extra.runs) {
  const tot = r.raw.map((x, i) => {
    let sum = r.guess[i];
    for (let L = 0; L < 5; L++) {
      const avg = mean(r.raw.map((y) => y[L]));
      sum += 100 + (50 * (x[L] - avg)) / levelSD[L];
    }
    return sum;
  });
  const best = Math.max(...tot);
  const winners = tot.map((_v, i) => i).filter((i) => Math.abs(tot[i] - best) < 1e-9);
  r.cards.forEach((c) => stdSeats[c]++);
  for (const i of winners) stdWins[r.cards[i]] += 1 / winners.length;
}
lines.push(`Level spread SD (within-table, for params.ts): ${JSON.stringify(levelSD.map((x) => Math.round(x * 10) / 10))}`);
lines.push('Win rate by Values card with standardized level points, per seat (target 15% to 35%):');
for (const c of Object.keys(stdWins) as ValuesCard[]) lines.push(`  ${c}: ${pct(stdWins[c] / Math.max(1, stdSeats[c]))}`);
// Level 3 checks of the lesson itself (D-60).
const highR1 = extra.highBuy[0][0] / Math.max(1, extra.highBuy[0][1]);
const lowR1 = extra.lowBuyR1[0] / Math.max(1, extra.lowBuyR1[1]);
lines.push(
  `L3 round 1 buying: High ${pct(highR1)}, Low ${pct(lowR1)}; High buy ${(highR1 / Math.max(1e-9, lowR1)).toFixed(2)} x as often as Low   (target at least 3 x)`,
);
const r1Mean = extra.r1PriceSum / Math.max(1, extra.r2Open);
const r2Mean = extra.r2PriceSum / Math.max(1, extra.r2Open);
lines.push(
  `L3 mean price where the insurer is still open in round 2 (${extra.r2Open} games): round 1 ${r1Mean.toFixed(2)}, round 2 ${r2Mean.toFixed(2)}, rise ${pct(r2Mean / Math.max(1e-9, r1Mean) - 1)}   (target at least 15%)`,
);
lines.push(`L3 market collapses by round 2: ${pct(agg.unravel / games)}   (target at least 10%)`);
lines.push(`L3 round-2 price at least 30 among open insurers (old check, for reference): ${pct(extra.r2Price30 / Math.max(1, extra.r2Open))}`);
const egoTotal = Object.values(extra.egoVotes).reduce((a, b) => a + b, 0) || 1;
lines.push(`L1 principle votes by Egoist bots: ${['P1', 'P2', 'P3', 'P4'].map((k) => `${k} ${pct(extra.egoVotes[k] / egoTotal)}`).join(', ')}`);
lines.push(
  `L3 High types buying insurance (when offered): round 1 ${pct(extra.highBuy[0][0] / Math.max(1, extra.highBuy[0][1]))}, round 2 ${pct(extra.highBuy[1][0] / Math.max(1, extra.highBuy[1][1]))}`,
);
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
lines.push('Raw level scores per player (mean, standard deviation):');
extra.levelScores.forEach((xs, L) =>
  lines.push(
    `  L${L + 1}: mean ${mean(xs).toFixed(1)}, sd ${sd(xs).toFixed(1)}; lowest table average ${Math.min(...extra.tableAvg[L]).toFixed(1)}, tables averaging under 10: ${extra.tableAvg[L].filter((a) => a < 10).length}`,
  ),
);
lines.push(`Time: ${((Date.now() - t0) / 1000).toFixed(1)}s. CSV: ${csvPath}`);
const summary = lines.join('\n');
writeFileSync(`${outDir}/summary-${nPlayers}p-${difficulty}.txt`, summary);
console.log(summary);
