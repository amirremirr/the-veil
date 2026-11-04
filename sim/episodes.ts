// Play-mode simulation for the episodes after Episode 3 (RUNPLAN T2 to T6), bot-only, reached from sim/play.ts:
//   npm run sim -- --ruleset PLAY --mode EPISODE --episode 4 --games 500
// Every table is bots only: these numbers describe the bots, not people (D-76). Each statistic is the mean
// ± a bootstrap SE over games (resampling whole games). E checks and F-f decide the exit code; the rest is
// reported. `--calibrate 1` also prints the MISSION_SCALE that would bring every mission's win share to 25%.
import { createInitialState, step } from '../src/engine/engine';
import { standalone } from '../src/engine/rng';
import { PLAY } from '../src/engine/play/params';
import { missionScale, missionValue, playEffortShares } from '../src/engine/play/rules';
import type { Difficulty, GameState, LevelId, ValuesCard } from '../src/engine/types';
import { VALUES_CARDS } from '../src/engine/types';
import { currentRules } from '../src/engine/version';
import { episodeMetrics, type Metric } from './metrics';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const mode = arg('mode', 'EPISODE') as 'EPISODE' | 'LIFE';
const episode = Number(arg('episode', '4')) as LevelId;
const games = Number(arg('games', '500'));
const nPlayers = Number(arg('players', '4')) as 2 | 3 | 4;
const difficulty = arg('difficulty', 'NORMAL') as Difficulty;
const seedBase = arg('seed', 'play');
const BOOT = Number(arg('boot', '300'));
const calibrate = arg('calibrate', '0') === '1';
Object.assign(PLAY, JSON.parse(arg('play', '{}')));

export interface GameRec {
  /** Per metric key: [numerator, denominator] for this game. */
  m: Record<string, [number, number]>;
  cards: ValuesCard[];
  bank: number[];
  stress: number[];
  guess: number[];
  mission: number[];
  winner: number;
}

function playOne(seed: string): GameState {
  const s = createInitialState({ mode, ...(mode === 'EPISODE' ? { level: episode } : {}), ruleset: 'PLAY', nPlayers, difficulty, seed, allBots: true } as Parameters<typeof createInitialState>[0]);
  let guard = 0;
  const watchers = episodeMetrics(mode === 'LIFE' ? 0 : episode);
  while (s.phase.kind !== 'END' && guard++ < 20000) {
    if (!step(s, { type: 'ADVANCE' })) throw new Error(`stuck ${s.phase.kind}:${s.phase.step}`);
    watchers.watch?.(s);
  }
  (s as GameState & { __m?: Record<string, [number, number]> }).__m = watchers.finish(s);
  return s;
}

function recOf(s: GameState): GameRec {
  const pl = s.play!;
  const eff = playEffortShares(s);
  const banks = s.players.map((p) => pl.banks[p.id]);
  const mission = s.players.map((p, i) => missionValue(p.values, banks, i, eff));
  const score = s.players.map((p, i) => PLAY.BANK_WEIGHT * banks[i] + PLAY.MISSION_WEIGHT * missionScale(s, p.values) * mission[i] - pl.debtStress[p.id] + pl.guessPoints[p.id]);
  const winner = score.indexOf(Math.max(...score));
  return {
    m: (s as GameState & { __m?: Record<string, [number, number]> }).__m!,
    cards: s.players.map((p) => p.values),
    bank: banks,
    stress: s.players.map((p) => pl.debtStress[p.id]),
    guess: s.players.map((p) => pl.guessPoints[p.id]),
    mission,
    winner,
  };
}

function boot(recs: GameRec[], f: (r: GameRec) => [number, number]): { mean: number; se: number; n: number } {
  const xs = recs.map(f);
  const ratio = (arr: Array<[number, number]>) => {
    const d = arr.reduce((a, x) => a + x[1], 0);
    return d > 0 ? arr.reduce((a, x) => a + x[0], 0) / d : NaN;
  };
  const m = ratio(xs);
  const rng = standalone(12345);
  const bs: number[] = [];
  for (let b = 0; b < BOOT; b++) {
    const smp: Array<[number, number]> = [];
    for (let k = 0; k < xs.length; k++) smp.push(xs[Math.floor(rng.next() * xs.length)]);
    bs.push(ratio(smp));
  }
  const ok = bs.filter(Number.isFinite);
  const mu = ok.reduce((a, b) => a + b, 0) / ok.length;
  const se = Math.sqrt(ok.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, ok.length - 1));
  return { mean: m, se, n: xs.reduce((a, x) => a + x[1], 0) };
}

function bootDiff(recs: GameRec[], a: string, b: string): { mean: number; se: number; n: number } {
  const ratio = (arr: GameRec[], k: string) => {
    const d = arr.reduce((acc, x) => acc + (x.m[k]?.[1] ?? 0), 0);
    return d > 0 ? arr.reduce((acc, x) => acc + (x.m[k]?.[0] ?? 0), 0) / d : NaN;
  };
  const m = ratio(recs, a) - ratio(recs, b);
  const rng = standalone(777);
  const bs: number[] = [];
  for (let k = 0; k < BOOT; k++) {
    const smp = recs.map(() => recs[Math.floor(rng.next() * recs.length)]);
    bs.push(ratio(smp, a) - ratio(smp, b));
  }
  const ok = bs.filter(Number.isFinite);
  const mu = ok.reduce((x, y) => x + y, 0) / ok.length;
  return { mean: m, se: Math.sqrt(ok.reduce((x, y) => x + (y - mu) ** 2, 0) / Math.max(1, ok.length - 1)), n: recs.reduce((acc, x) => acc + (x.m[a]?.[1] ?? 0) + (x.m[b]?.[1] ?? 0), 0) };
}

/** OLS slope of a per-game y on a per-game x, with a bootstrap SE over games. */
function bootSlope(recs: GameRec[], xk: string, yk: string): { mean: number; se: number; n: number } {
  const slope = (arr: GameRec[]) => {
    const xs = arr.map((r) => r.m[xk][0]);
    const ys = arr.map((r) => r.m[yk][0]);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0;
    let sxx = 0;
    xs.forEach((x, i) => {
      sxy += (x - mx) * (ys[i] - my);
      sxx += (x - mx) ** 2;
    });
    return sxx > 0 ? sxy / sxx : NaN;
  };
  const m = slope(recs);
  const rng = standalone(99);
  const bs: number[] = [];
  for (let k = 0; k < BOOT; k++) bs.push(slope(recs.map(() => recs[Math.floor(rng.next() * recs.length)])));
  const ok = bs.filter(Number.isFinite);
  const mu = ok.reduce((a, b) => a + b, 0) / ok.length;
  return { mean: m, se: Math.sqrt(ok.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, ok.length - 1)), n: recs.length };
}

function winShares(recs: GameRec[], scale: Record<ValuesCard, number>): Record<ValuesCard, number> {
  const wins: Record<string, number> = {};
  const seats: Record<string, number> = {};
  for (const r of recs) {
    const sc = r.bank.map((b, i) => PLAY.BANK_WEIGHT * b + PLAY.MISSION_WEIGHT * scale[r.cards[i]] * r.mission[i] - r.stress[i] + r.guess[i]);
    const w = sc.indexOf(Math.max(...sc));
    r.cards.forEach((c, i) => {
      seats[c] = (seats[c] ?? 0) + 1;
      if (i === w) wins[c] = (wins[c] ?? 0) + 1;
    });
  }
  // Per seat: a card's chance of winning, rescaled so a fair game gives every card 1 / seats per table.
  const n = recs[0]?.cards.length ?? 4;
  return Object.fromEntries(VALUES_CARDS.map((c) => [c, ((wins[c] ?? 0) / Math.max(1, seats[c] ?? 0)) * (n / 4)])) as Record<ValuesCard, number>;
}

const t0 = Date.now();
const recs: GameRec[] = [];
for (let g = 0; g < games; g++) recs.push(recOf(playOne(`${seedBase}-${g}`)));
const metrics: Metric[] = episodeMetrics(mode === 'LIFE' ? 0 : episode).metrics;
const rules = currentRules('PLAY');
const out: string[] = [];
out.push(`Play ${mode === 'LIFE' ? 'LIFE' : `Episode ${episode}`}: ${games} bot games, ${nPlayers} seats, ${difficulty}, seeds ${seedBase}-0..${games - 1}`);
out.push(`rules ${JSON.stringify(rules)}`);
out.push('');
let fail = false;
for (const m of metrics) {
  // E1: a difference of two pooled shares (top two incomes minus bottom two), bootstrapped over games.
  const r = m.key === 'e1' ? bootDiff(recs, 'e1hi', 'e1lo') : m.key === 'e2b' ? bootDiff(recs, 'e2c', 'e2t') : m.key === 'e2' ? bootSlope(recs, 'e2x', 'e2y') : boot(recs, (x) => x.m[m.key] ?? [0, 0]);
  const pass = Number.isFinite(r.mean) && (m.min === undefined || r.mean >= m.min) && (m.max === undefined || r.mean <= m.max);
  const target = m.min !== undefined && m.max !== undefined ? `${m.min} to ${m.max}` : m.min !== undefined ? `>= ${m.min}` : m.max !== undefined ? `<= ${m.max}` : 'reported';
  if (m.gate && !pass) fail = true;
  const status = m.min === undefined && m.max === undefined ? 'REPORT' : pass ? 'PASS' : 'FAIL';
  out.push(`${status.padEnd(6)} ${m.gate ? '[gate]    ' : '[reported]'} ${m.label}: ${(m.pct ? r.mean * 100 : r.mean).toFixed(m.pct ? 1 : 3)}${m.pct ? '%' : ''} ± ${(m.pct ? r.se * 100 : r.se).toFixed(m.pct ? 1 : 3)} (target ${target}; n=${r.n})`);
}
const scale = Object.fromEntries(VALUES_CARDS.map((c) => [c, missionScale({ mode, levelIndex: mode === 'LIFE' ? 5 : episode } as GameState, c)])) as Record<ValuesCard, number>;
const ws = winShares(recs, scale);
const wsOk = VALUES_CARDS.every((c) => ws[c] >= 0.15 && ws[c] <= 0.35);
out.push(`${wsOk ? 'PASS' : 'FAIL'}   [reported] F-e mission win shares (15% to 35% each): ${VALUES_CARDS.map((c) => `${c} ${(ws[c] * 100).toFixed(1)}%`).join(', ')}`);
if (calibrate) {
  let k = { ...scale };
  for (let it = 0; it < 60; it++) {
    const w = winShares(recs, k);
    k = Object.fromEntries(VALUES_CARDS.map((c) => [c, Math.max(0.05, k[c] * Math.pow(0.25 / Math.max(0.01, w[c]), 0.3))])) as Record<ValuesCard, number>;
  }
  const w = winShares(recs, k);
  out.push(`Calibrated MISSION_SCALE: ${JSON.stringify(Object.fromEntries(VALUES_CARDS.map((c) => [c, Number(k[c].toFixed(2))])))} -> ${VALUES_CARDS.map((c) => `${c} ${(w[c] * 100).toFixed(1)}%`).join(', ')}`);
}
out.push('', fail ? 'A gating target fails.' : 'All gating targets pass.', `Time: ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
console.log(out.join('\n'));
if (fail) process.exitCode = 1;
