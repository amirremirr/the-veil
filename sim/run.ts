// Headless bot-only simulation CLI (Section 9.6).
// Usage: npm run sim -- --games 2000 --players 4 --difficulty NORMAL --samples 300 --out sim/out
//
// Every table here is bots only, so these numbers describe the bots, not people (D-76). The balance
// targets are design targets chosen for the game, not findings. Each statistic is reported as
// mean ± standard error, where the SE is a bootstrap over whole games (games are independent; players
// within a game are not), with a fixed resampling seed so a rerun prints the same SEs.
// Every design target is checked by code at the end (D-88): PASS, FAIL, or N/A when it cannot be
// checked; a PASS within 2 SE of a bound is marked "at the bound". Any FAIL makes the exit code 1.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialState, step, totalScore } from '../src/engine/engine';
import { mean } from '../src/engine/scoring';
import { standalone } from '../src/engine/rng';
import { bestEffort, type L2Debrief } from '../src/engine/levels/level2';
import type { L1Debrief } from '../src/engine/levels/level1';
import type { L3Debrief } from '../src/engine/levels/level3';
import type { L4Debrief } from '../src/engine/levels/level4';
import type { L5Debrief } from '../src/engine/levels/level5';
import type { Difficulty, GameState, ValuesCard } from '../src/engine/types';
import { VALUES_CARDS } from '../src/engine/types';
import { currentRules } from '../src/engine/version';

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
const BOOT = Number(arg('boot', '400'));

function playOne(seed: string): GameState {
  const s = createInitialState({ mode: 'FULL_RUN', nPlayers, difficulty, seed, allBots: true, botSamples: samples, skipCounterfactual: true });
  let guard = 0;
  while (s.phase.kind !== 'END' && guard++ < 10000) if (!step(s, { type: 'ADVANCE' })) throw new Error(`stuck ${s.phase.kind}`);
  return s;
}

/** Everything the summary needs from one game. */
interface Rec {
  seed: string;
  votes: Record<string, number>;
  egoVotes: Record<string, number>;
  meanT: number;
  effortGap: number;
  effortAbsGap: number;
  /** [buyers, offered] among High types in rounds 1 and 2, and Low types in round 1. */
  highBuy: [[number, number], [number, number]];
  lowBuyR1: [number, number];
  r2Open: boolean;
  r1Price: number;
  r2Price: number;
  collapsed: boolean;
  unanimous: boolean;
  regime: string;
  gap: number;
  policy: string;
  gapR45: number;
  piSquare: number[];
  amended: boolean;
  slopeBots: number;
  cards: ValuesCard[];
  raw: number[][];
  guess: number[];
  /** Per seat, share of the win (ties split) by the game's own level points. */
  winShare: number[];
}

function record(seed: string, s: GameState): Rec {
  const d1 = s.levelResults[1] as L1Debrief;
  const d2 = s.levelResults[2] as L2Debrief;
  const d3 = s.levelResults[3] as L3Debrief;
  const d4 = s.levelResults[4] as L4Debrief;
  const d5 = s.levelResults[5] as L5Debrief;
  const card = (id: string) => s.players.find((p) => p.id === id)!.values;
  const votes = { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<string, number>;
  const egoVotes = { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<string, number>;
  for (const r of d1.rounds)
    for (const [id, v] of Object.entries(r.votes)) {
      votes[v]++;
      if (card(id) === 'EGOIST') egoVotes[v]++;
    }
  const gaps: number[] = [];
  for (const r of d2.rounds) for (const id of Object.keys(r.effort)) gaps.push(r.effort[id] - bestEffort(r.t, d2.talents[id], s.players.length));
  const highBuy: Rec['highBuy'] = [
    [0, 0],
    [0, 0],
  ];
  d3.rounds.slice(0, 2).forEach((r, k) => {
    if (r.regime !== 'VOL' || r.premium === null) return;
    for (const p of s.players)
      if (d3.types[p.id] === 'HIGH') {
        highBuy[k][1]++;
        if (r.choices[p.id].buy) highBuy[k][0]++;
      }
  });
  const lowBuyR1: [number, number] = [0, 0];
  const r1 = d3.rounds[0];
  if (r1.regime === 'VOL' && r1.premium !== null)
    for (const p of s.players)
      if (d3.types[p.id] === 'LOW') {
        lowBuyR1[1]++;
        if (r1.choices[p.id].buy) lowBuyR1[0]++;
      }
  const r2 = d3.rounds[1];
  const rv = Object.values(d3.regimeVotes ?? {});
  const totals = s.players.map((p) => totalScore(s, p.id));
  const best = Math.max(...totals);
  const winners = totals.filter((x) => Math.abs(x - best) < 1e-9).length;
  return {
    seed,
    votes,
    egoVotes,
    meanT: mean(d2.rounds.map((r) => r.t)),
    effortGap: mean(gaps),
    effortAbsGap: mean(gaps.map(Math.abs)),
    highBuy,
    lowBuyR1,
    r2Open: r2.regime === 'VOL' && r2.premium !== null,
    r1Price: r1.premium ?? 0,
    r2Price: r2.premium ?? 0,
    collapsed: r2.premium === null || Object.values(r2.choices).every((c) => !c.buy),
    unanimous: rv.length > 0 && rv.every((v) => v === rv[0]),
    regime: d3.regime,
    gap: d4.gap,
    policy: d4.policy,
    gapR45: mean(d4.meanByGroup.slice(3).map((m) => m.gap)),
    piSquare: d4.piPath.SQUARE,
    amended: d5.amendments.length > 0,
    slopeBots: d5.slopes.everyone,
    cards: s.players.map((p) => p.values),
    raw: s.players.map((p) => s.scores[p.id].byLevel.slice()),
    guess: s.players.map((p) => s.scores[p.id].guessBonus),
    winShare: totals.map((x) => (Math.abs(x - best) < 1e-9 ? 1 / winners : 0)),
  };
}

/** The git commit this run used, and whether tracked files had uncommitted changes (D-88). */
function codeRevision(): string {
  try {
    const head = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain --untracked-files=no', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
    return dirty ? `${head} + uncommitted changes` : head;
  } catch {
    return 'unknown (not a git checkout)';
  }
}

const recs: Rec[] = [];
const t0 = Date.now();
const revisionAtStart = codeRevision();
for (let g = 0; g < games; g++) {
  const seed = `${seedBase}-${g}`;
  recs.push(record(seed, playOne(seed)));
  if ((g + 1) % Math.max(1, Math.floor(games / 10)) === 0) process.stderr.write(`  ${g + 1}/${games} games (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
}

// --- statistics --------------------------------------------------------------------------------

type Stat = (rs: Rec[]) => number;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ratio = (num: (r: Rec) => number, den: (r: Rec) => number): Stat => (rs) => {
  const d = sum(rs.map(den));
  return d > 0 ? sum(rs.map(num)) / d : NaN;
};
const avg = (f: (r: Rec) => number): Stat => (rs) => mean(rs.map(f));

/** Bootstrap SE over games, with a fixed resampling seed. */
function se(stat: Stat): number {
  const rng = standalone(0x5eed);
  const vals: number[] = [];
  for (let b = 0; b < BOOT; b++) {
    const sample = Array.from({ length: recs.length }, () => recs[rng.int(recs.length)]);
    const v = stat(sample);
    if (Number.isFinite(v)) vals.push(v);
  }
  const m = mean(vals);
  return Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / Math.max(1, vals.length - 1));
}
const pm = (stat: Stat, scale = 100, digits = 1, unit = '%') => `${(stat(recs) * scale).toFixed(digits)}${unit} ± ${(se(stat) * scale).toFixed(digits)}`;
const num = (stat: Stat, digits = 3) => pm(stat, 1, digits, '');

/** Within-table SD of raw level scores, pooled over games (the LEVEL_SD calibration). */
const levelSD = (L: number): Stat => (rs) => {
  const devs = rs.flatMap((r) => {
    const a = mean(r.raw.map((x) => x[L]));
    return r.raw.map((x) => x[L] - a);
  });
  return Math.sqrt(mean(devs.map((d) => d * d)));
};
/** Win rate per seat holding a card, with level points standardized by this run's own spreads. */
function stdWinRate(card: ValuesCard): Stat {
  return (rs) => {
    const sds = [0, 1, 2, 3, 4].map((L) => levelSD(L)(rs));
    let wins = 0;
    let seats = 0;
    for (const r of rs) {
      const tot = r.raw.map((x, i) => r.guess[i] + sum(x.map((v, L) => 100 + (50 * (v - mean(r.raw.map((y) => y[L])))) / sds[L])));
      const best = Math.max(...tot);
      const w = tot.filter((x) => Math.abs(x - best) < 1e-9).length;
      r.cards.forEach((c, i) => {
        if (c !== card) return;
        seats++;
        if (Math.abs(tot[i] - best) < 1e-9) wins += 1 / w;
      });
    }
    return seats ? wins / seats : NaN;
  };
}
const winRate = (card: ValuesCard): Stat =>
  ratio(
    (r) => sum(r.cards.map((c, i) => (c === card ? r.winShare[i] : 0))),
    (r) => r.cards.filter((c) => c === card).length,
  );

// --- summary -----------------------------------------------------------------------------------

const csvPath = `${outDir}/runs-${nPlayers}p-${difficulty}.csv`;
const lines: string[] = [];
const rules = currentRules();
lines.push(`THE VEIL simulation: ${games} full runs, ${nPlayers} bots, ${difficulty}, ${samples} MC samples. Rules ${rules.rules}, params ${rules.params}.`);
lines.push(`Seeds ${seedBase}-0 to ${seedBase}-${games - 1}. Code ${revisionAtStart} (at the start of the run).`);
lines.push('BOT-ONLY TABLES: these numbers describe the bots, not people. Targets are design targets for the game, not findings (D-76).');
lines.push(`Each value is mean ± bootstrap standard error over games (${BOOT} resamples).`);
lines.push('');
lines.push('L1 principle votes (design target: none above 60%):');
for (const k of ['P1', 'P2', 'P3', 'P4']) lines.push(`  ${k}: ${pm(ratio((r) => r.votes[k], (r) => sum(Object.values(r.votes))))}`);
lines.push(`L1 votes by Egoist bots: ${['P1', 'P2', 'P3', 'P4'].map((k) => `${k} ${pm(ratio((r) => r.egoVotes[k], (r) => sum(Object.values(r.egoVotes))))}`).join(', ')}`);
lines.push(`L2 mean chosen t: ${num(avg((r) => r.meanT))}   (design target 0.2 to 0.5)`);
lines.push(`L2 mean effort minus e*: ${num(avg((r) => r.effortGap))}, mean abs gap: ${num(avg((r) => r.effortAbsGap))}   (design target within 1)`);
const highR1 = ratio((r) => r.highBuy[0][0], (r) => r.highBuy[0][1]);
const lowR1 = ratio((r) => r.lowBuyR1[0], (r) => r.lowBuyR1[1]);
lines.push(`L3 round 1 buying: High ${pm(highR1)}, Low ${pm(lowR1)}; ratio ${num((rs) => highR1(rs) / lowR1(rs), 2)}   (design target ratio at least 3)`);
lines.push(`L3 High types buying in round 2 (when offered): ${pm(ratio((r) => r.highBuy[1][0], (r) => r.highBuy[1][1]))}`);
const open = (rs: Rec[]) => rs.filter((r) => r.r2Open);
lines.push(
  `L3 price rise round 1 -> 2 where the insurer is still open (${open(recs).length} games): ${pm((rs) => mean(open(rs).map((r) => r.r2Price)) / mean(open(rs).map((r) => r.r1Price)) - 1)}   (design target at least 15%)`,
);
lines.push(`L3 market collapses by round 2: ${pm(avg((r) => (r.collapsed ? 1 : 0)))}   (design target at least 10%)`);
lines.push(`L3 regime vote unanimous: ${pm(avg((r) => (r.unanimous ? 1 : 0)))}   (design target at most 30%)`);
lines.push(`L3 regimes chosen: ${['VOL', 'M50', 'M100'].map((k) => `${k} ${pm(avg((r) => (r.regime === k ? 1 : 0)))}`).join(', ')}`);
lines.push(`L4 mean group gap: ${num(avg((r) => r.gap), 2)}; gap positive in ${pm(avg((r) => (r.gap > 0 ? 1 : 0)))}   (design target at least 80%)`);
lines.push(`L4 policies chosen: ${['A', 'B', 'C', 'D'].map((k) => `${k} ${pm(avg((r) => (r.policy === k ? 1 : 0)))}`).join(', ')}`);
lines.push(
  `L4 mean gap in rounds 4-5 by the rule each table chose (conditional on the tables that chose it; No Change is rare, so its row is not a policy effect, D-87): ${['A', 'B', 'C', 'D']
    .map((k) => `${k} ${num((rs) => {
      const xs = rs.filter((r) => r.policy === k).map((r) => r.gapR45);
      return xs.length ? mean(xs) : NaN;
    }, 1)} (n=${recs.filter((r) => r.policy === k).length})`)
    .join(', ')}`,
);
lines.push(`L4 mean pi_Square path: ${recs[0].piSquare.map((_, k) => mean(recs.map((r) => r.piSquare[k])).toFixed(3)).join(' -> ')}`);
lines.push(`L5 at least one amendment proposed: ${pm(avg((r) => (r.amended ? 1 : 0)))}   (design target at least 90%)`);
lines.push(
  `L5 slope of fair-tax shift on income rank, bot answers: ${num(avg((r) => r.slopeBots), 4)}. Programmed (an Egoist bot's fair tax is its own-money optimum; the others drift by sigma): a check on the bot code, not a finding (D-73).`,
);
lines.push('Win rate per seat holding a card, by the game\'s level points (ties split; parity 1/players; design target 15% to 35%):');
for (const c of VALUES_CARDS) lines.push(`  ${c}: ${pm(winRate(c))}`);
lines.push(`Level spread SD (within-table, for params.ts LEVEL_SD): ${[0, 1, 2, 3, 4].map((L) => num(levelSD(L), 1)).join(', ')}`);
lines.push('Win rate per seat with level points standardized by this run\'s spreads (design target 15% to 35%):');
for (const c of VALUES_CARDS) lines.push(`  ${c}: ${pm(stdWinRate(c))}`);
lines.push('Raw level scores per player (mean ± SE; lowest table average):');
for (let L = 0; L < 5; L++)
  lines.push(`  L${L + 1}: ${num(avg((r) => mean(r.raw.map((x) => x[L]))), 1)}; lowest table average ${Math.min(...recs.map((r) => mean(r.raw.map((x) => x[L])))).toFixed(1)}`);

// --- design targets, checked by code (D-88) -----------------------------------------------------

interface Target {
  name: string;
  stat: Stat;
  lo?: number;
  hi?: number;
  /** Shown with the result: what the check is conditional on. */
  note?: string;
}
const share = (k: string): Stat => ratio((r) => r.votes[k], (r) => sum(Object.values(r.votes)));
const gapByRule = (k: string): Stat => (rs) => {
  const xs = rs.filter((r) => r.policy === k).map((r) => r.gapR45);
  return xs.length ? mean(xs) : NaN;
};
const targets: Target[] = [
  { name: 'L1 largest principle share', stat: (rs) => Math.max(...['P1', 'P2', 'P3', 'P4'].map((k) => share(k)(rs))), hi: 0.6 },
  { name: 'L2 mean chosen tax', stat: avg((r) => r.meanT), lo: 0.2, hi: 0.5 },
  { name: 'L2 mean absolute effort gap', stat: avg((r) => r.effortAbsGap), hi: 1 },
  { name: 'L3 High / Low round-1 buying ratio', stat: (rs) => highR1(rs) / lowR1(rs), lo: 3 },
  { name: 'L3 price rise, round 1 to 2, open markets', stat: (rs) => mean(open(rs).map((r) => r.r2Price)) / mean(open(rs).map((r) => r.r1Price)) - 1, lo: 0.15 },
  { name: 'L3 market collapses by round 2', stat: avg((r) => (r.collapsed ? 1 : 0)), lo: 0.1 },
  { name: 'L3 unanimous referendum', stat: avg((r) => (r.unanimous ? 1 : 0)), hi: 0.3 },
  { name: 'L4 gap positive', stat: avg((r) => (r.gap > 0 ? 1 : 0)), lo: 0.8 },
  {
    name: 'L4 some chosen rule below No Change, rounds 4-5 (best other rule minus No Change)',
    stat: (rs) => Math.min(...['B', 'C', 'D'].map((k) => gapByRule(k)(rs)).filter(Number.isFinite)) - gapByRule('A')(rs),
    hi: 0,
    note: `conditional on the ${recs.filter((r) => r.policy === 'A').length} tables that kept No Change; not a policy effect (D-87)`,
  },
  { name: 'L5 amendment proposed', stat: avg((r) => (r.amended ? 1 : 0)), lo: 0.9 },
  { name: 'L5 bot slope negative (programmed check, D-73)', stat: avg((r) => r.slopeBots), hi: 0 },
  ...VALUES_CARDS.map((c) => ({ name: `Win rate per seat, ${c}`, stat: winRate(c), lo: 0.15, hi: 0.35 })),
];
let failures = 0;
lines.push('');
lines.push('Design targets (bot-only; PASS / FAIL on the estimate; "at the bound" = within 2 SE of a bound):');
for (const tg of targets) {
  const v = tg.stat(recs);
  const e = se(tg.stat);
  const bound = `${tg.lo !== undefined ? `>= ${tg.lo}` : ''}${tg.lo !== undefined && tg.hi !== undefined ? ' and ' : ''}${tg.hi !== undefined ? `<= ${tg.hi}` : ''}`;
  let status: string;
  if (!Number.isFinite(v)) status = 'N/A (cannot be computed in this run)';
  else {
    const pass = (tg.lo === undefined || v >= tg.lo) && (tg.hi === undefined || v <= tg.hi);
    if (!pass) failures++;
    const margins = [tg.lo, tg.hi].filter((b): b is number => b !== undefined).map((b) => (e > 0 ? Math.abs(v - b) / e : v === b ? 0 : Infinity));
    const near = Math.min(...margins);
    status = pass ? (near < 2 ? `PASS, at the bound (${near.toFixed(1)} SE away)` : 'PASS') : `FAIL (${near.toFixed(1)} SE beyond the bound)`;
  }
  lines.push(`  ${status.padEnd(36)} ${tg.name}: ${Number.isFinite(v) ? v.toFixed(4) : 'n/a'} ± ${e.toFixed(4)} (target ${bound})${tg.note ? `; ${tg.note}` : ''}`);
}
lines.push(failures ? `${failures} design target(s) FAILED.` : 'All checkable design targets pass.');
lines.push(`Time: ${((Date.now() - t0) / 1000).toFixed(1)}s. CSV: ${csvPath}`);

const header = ['seed', 'l1_votes_P1', 'l1_votes_P2', 'l1_votes_P3', 'l1_votes_P4', 'l2_mean_t', 'l2_mean_effort_gap', 'l3_collapsed_by_r2', 'l3_regime', 'l3_regime_unanimous', 'l4_gap', 'l4_policy', 'l4_pi_square_final', 'l5_amended', 'l5_slope_bots', 'cards'];
const rows = [header.join(',')].concat(
  recs.map((r) =>
    [r.seed, r.votes.P1, r.votes.P2, r.votes.P3, r.votes.P4, r.meanT.toFixed(3), r.effortGap.toFixed(3), r.collapsed ? 1 : 0, r.regime, r.unanimous ? 1 : 0, r.gap.toFixed(2), r.policy, r.piSquare[r.piSquare.length - 1].toFixed(3), r.amended ? 1 : 0, r.slopeBots.toFixed(4), r.cards.join('|')].join(','),
  ),
);
mkdirSync(outDir, { recursive: true });
writeFileSync(csvPath, rows.join('\n'));
const summary = lines.join('\n');
writeFileSync(`${outDir}/summary-${nPlayers}p-${difficulty}.txt`, summary);
console.log(summary);
if (failures) process.exitCode = 1;
