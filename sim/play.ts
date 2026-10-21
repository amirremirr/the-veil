// Play-mode simulation (PLAY_MODE_SPEC.md Section 10, PLAY_V2_SPEC.md Section 8), bot-only. Reached from sim/run.ts with
// `--ruleset PLAY`:  npm run sim -- --ruleset PLAY --mode EPISODE --episode 3 --games 2000
// Every table is bots only: these numbers describe the bots, not people (D-76). Each statistic is the
// mean ± a bootstrap SE over games. Mechanism checks (E*) and the debt target F-f decide the exit code;
// the other fun targets are reported. In EPISODE mode the per-life fun targets are measured per episode
// and labeled as such; F-b needs Episode 2 and is N/A (D-101).
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialState, step } from '../src/engine/engine';
import { mean } from '../src/engine/scoring';
import { standalone } from '../src/engine/rng';
import { PLAY } from '../src/engine/play/params';
import { missionValue, playEffortShares, playScore } from '../src/engine/play/rules';
import { bestOwnChoices, type L3Debrief } from '../src/engine/levels/level3';
import { activeEvent } from '../src/engine/play/rules';
import { audienceBelief } from '../src/engine/play/claims';
import type { Difficulty, GameState, LevelId, ValuesCard } from '../src/engine/types';
import { VALUES_CARDS } from '../src/engine/types';
import { currentRules } from '../src/engine/version';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const mode = arg('mode', 'EPISODE');
if (mode !== 'EPISODE') {
  console.error(`--mode ${mode}: LIFE mode is not built yet (milestone P3). Use --mode EPISODE --episode 3.`);
  process.exit(2);
}
const episode = Number(arg('episode', '3')) as LevelId;
if (episode !== 3) {
  console.error(`--episode ${episode} is not built yet (P1 has Episode 3 only).`);
  process.exit(2);
}
const games = Number(arg('games', '2000'));
const nPlayers = Number(arg('players', '4')) as 2 | 3 | 4;
const difficulty = arg('difficulty', 'NORMAL') as Difficulty;
const samples = Number(arg('samples', '300'));
const outDir = arg('out', 'sim/out/play');
const seedBase = arg('seed', 'play');
const BOOT = Number(arg('boot', '400'));
/** Optional PLAY overrides for tuning runs, as JSON (for example '{"EPISODE_STARTING_BANK":40}'). Never Study values. */
const overrides = JSON.parse(arg('play', '{}')) as Record<string, unknown>;
Object.assign(PLAY, overrides);

/** What the run watches while a game plays: event cards' effect on choices, and the reader's beliefs. */
interface Watch {
  /** Per drawn card: did it change at least one bot's best cover or gym choice (v2 Section 5 trim rule)? */
  cards: Array<{ id: string; changed: boolean }>;
  /** Per claim: the audience belief that it is true, right after that round's results (S-b). */
  reads: Array<{ lied: boolean; pTrue: number }>;
}

function playOne(seed: string): { s: GameState; w: Watch } {
  const s = createInitialState({ mode: 'EPISODE', level: episode, ruleset: 'PLAY', nPlayers, difficulty, seed, allBots: true, botSamples: samples });
  const w: Watch = { cards: [], reads: [] };
  let guard = 0;
  while (s.phase.kind !== 'END' && guard++ < 10000) {
    if (!step(s, { type: 'ADVANCE' })) throw new Error(`stuck ${s.phase.kind}`);
    const ph = s.phase;
    if (ph.kind === 'BRIEFING') {
      const ev = activeEvent(s);
      // Leaked Medical Files changes the bar, not cover or the gym, and is the spec's own new card: not trimmed.
      if (ev && ev.id !== 'LEAKED') {
        const a = bestOwnChoices(s, true);
        const b = bestOwnChoices(s, false);
        w.cards.push({ id: ev.id, changed: Object.keys(a).some((id) => a[id].buy !== b[id].buy || a[id].gym !== b[id].gym) });
      }
    }
    if (ph.kind === 'REVEAL' && ph.step === 'EVENTS')
      for (const c of s.play!.claimLog) {
        if (c.level !== s.levelIndex || c.round !== s.round || c.said === 'SILENT') continue;
        const b = audienceBelief(s, c.pid) ?? 0.5;
        w.reads.push({ lied: c.lied, pTrue: c.said === 'HIGH' ? b : 1 - b });
      }
  }
  return { s, w };
}

interface Rec {
  watch: Watch;
  /** Bars: how many hit a high-risk and a low-risk contestant. */
  barHigh: number;
  barLow: number;
  /** List price in round 3 (null if the market was closed by then). */
  r3Price: number | null;
  /** Bot claim decisions where the lie would gain coins, and how many of them lied (S-a). */
  lieChances: number;
  lieGains: number[];
  byBot: Record<string, [number, number]>;
  open3: boolean;
  lies: number;
  /** Lies where the lie gained nothing over the truth (a bot rarely tells one). */
  otherLies: number;
  claims: number;
  silences: number;
  highBuyersR1: number;
  lowBuyersR1: number;
  r1Price: number;
  r2Price: number;
  r2Open: boolean;
  collapsed: boolean;
  anyDebt: boolean;
  leadChanges: number;
  close: boolean;
  bigMoment: boolean;
  anyEvent: boolean;
  maxSwing: number;
  cards: ValuesCard[];
  winShare: number[];
  /** Per seat: final bank, and every mission's value on the final banks (for MISSION_SCALE). */
  banks: number[];
  missionByCard: Record<ValuesCard, number[]>;
  final: number[];
}

function record(s: GameState, watch: Watch): Rec {
  const d = s.levelResults[3] as L3Debrief;
  const pl = s.play!;
  // The first voluntary round: round 2 after a launch round (D-121), else round 1. Buyers are those who
  // applied for cover (self-selection; a barred applicant still chose to buy).
  const f = PLAY.L3_LAUNCH ? 2 : 1;
  const r1 = d.rounds[f - 1];
  const r2 = d.rounds[f];
  let high = 0;
  let low = 0;
  for (const p of s.players) if (r1.regime === 'VOL' && r1.premium !== null && (r1.applied?.[p.id] ?? r1.choices[p.id].buy)) d.types[p.id] === 'HIGH' ? high++ : low++;
  // Leader after each round, by the Play score at that moment (history S; ties go to the first seat).
  const lead = pl.bankHistory.map((_, k) => {
    const S = s.history[k].S;
    const ids = s.players.map((p) => p.id);
    return ids.reduce((a, b) => (S[b] > S[a] + 1e-9 ? b : a), ids[0]);
  });
  let changes = 0;
  for (let k = 1; k < lead.length; k++) if (lead[k] !== lead[k - 1]) changes++;
  const final = s.players.map((p) => playScore(s, p.id));
  const sorted = [...final].sort((a, b) => b - a);
  const best = sorted[0];
  const winners = final.filter((x) => Math.abs(x - best) < 1e-9).length;
  const swings = pl.bankHistory.flatMap((h) => s.players.map((p) => Math.abs(h.W[p.id] - PLAY.LIVING_COST)));
  const maxSwing = Math.max(...swings);
  const anyEvent = pl.events.some((e) => e.id !== 'QUIET');
  const banks = s.players.map((p) => pl.banks[p.id]);
  const eff = playEffortShares(s);
  const bars = d.rounds.map((r) => r.bar?.barred).filter((x): x is string => !!x);
  const r3 = d.rounds[2];
  const chances = pl.claimLog.filter((c) => c.lieGain !== null && c.lieGain > 0.01);
  const open = (r: (typeof d.rounds)[number] | undefined) => !!r && r.regime === 'VOL' && r.premium !== null;
  // New F-d (author, v2 8.2): a liar who got in, in a round where the bar voted.
  const liarIn = pl.claimLog.some((c) => c.lied && d.rounds[c.round - 1]?.bar && d.rounds[c.round - 1].choices[c.pid].buy);
  const byBot: Record<string, [number, number]> = {};
  for (const c of chances) {
    const key = s.players.find((p) => p.id === c.pid)!.botProfile!.key;
    byBot[key] ??= [0, 0];
    byBot[key][0]++;
    if (c.lied) byBot[key][1]++;
  }
  return {
    watch,
    barHigh: bars.filter((b) => d.types[b] === 'HIGH').length,
    barLow: bars.filter((b) => d.types[b] === 'LOW').length,
    // E3d: the price round 3's pool sets (after the last voluntary round), against the first voluntary round's.
    r3Price: open(r3) && r3.nextPremium !== null ? r3.nextPremium : null,
    open3: open(r3),
    lieGains: chances.map((c) => c.lieGain!),
    byBot,
    lieChances: chances.length,
    lies: chances.filter((c) => c.lied).length,
    otherLies: pl.claimLog.filter((c) => c.lied && !(c.lieGain !== null && c.lieGain > 0.01)).length,
    claims: pl.claimLog.filter((c) => c.said !== 'SILENT').length,
    silences: pl.claimLog.filter((c) => c.said === 'SILENT').length,
    highBuyersR1: high,
    lowBuyersR1: low,
    r1Price: r1.listPrice ?? r1.premium ?? 0,
    r2Price: r2.listPrice ?? r2.premium ?? 0,
    r2Open: open(r2),
    collapsed: r2.premium === null || Object.values(r2.choices).every((c) => !c.buy),
    anyDebt: pl.bankHistory.some((h) => Object.values(h.banks).some((b) => b < 0)),
    leadChanges: changes,
    close: sorted.length > 1 && best - sorted[1] <= 0.15 * Math.abs(best),
    bigMoment: anyEvent || maxSwing >= 80 || bars.length > 0 || liarIn,
    anyEvent,
    maxSwing,
    cards: s.players.map((p) => p.values),
    winShare: final.map((x) => (Math.abs(x - best) < 1e-9 ? 1 / winners : 0)),
    banks,
    missionByCard: Object.fromEntries(VALUES_CARDS.map((c) => [c, banks.map((_, i) => missionValue(c, banks, i, eff))])) as Record<ValuesCard, number[]>,
    final,
  };
}

function codeRevision(): string {
  try {
    const head = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain --untracked-files=no', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
    return dirty ? `${head} + uncommitted changes` : head;
  } catch {
    return 'unknown (not a git checkout)';
  }
}

const t0 = Date.now();
const revision = codeRevision();
const recs: Rec[] = [];
for (let g = 0; g < games; g++) {
  const { s, w } = playOne(`${seedBase}-${g}`);
  recs.push(record(s, w));
  if ((g + 1) % Math.max(1, Math.floor(games / 10)) === 0) process.stderr.write(`  ${g + 1}/${games} episodes (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
}

type Stat = (rs: Rec[]) => number;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (f: (r: Rec) => number): Stat => (rs) => mean(rs.map(f));
function se(stat: Stat): number {
  const rng = standalone(0x5eed);
  const vals: number[] = [];
  for (let b = 0; b < BOOT; b++) {
    const v = stat(Array.from({ length: recs.length }, () => recs[rng.int(recs.length)]));
    if (Number.isFinite(v)) vals.push(v);
  }
  const m = mean(vals);
  return Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / Math.max(1, vals.length - 1));
}

const open = (rs: Rec[]) => rs.filter((r) => r.r2Open);
const open3 = (rs: Rec[]) => rs.filter((r) => r.r3Price !== null);
const barHighShare: Stat = (rs) => sum(rs.map((r) => r.barHigh)) / sum(rs.map((r) => r.barHigh + r.barLow));
const priceRise3: Stat = (rs) => mean(open3(rs).map((r) => r.r3Price!)) / mean(open3(rs).map((r) => r.r1Price)) - 1;
const lieShare: Stat = (rs) => sum(rs.map((r) => r.lies)) / sum(rs.map((r) => r.lieChances));
const readAcc: Stat = (rs) => {
  const reads = rs.flatMap((r) => r.watch.reads);
  return mean(reads.map((x) => ((x.pTrue >= 0.5) === !x.lied ? 1 : 0)));
};
const buyerRatio: Stat = (rs) => sum(rs.map((r) => r.highBuyersR1)) / sum(rs.map((r) => r.lowBuyersR1));
const priceRise: Stat = (rs) => mean(open(rs).map((r) => r.r2Price)) / mean(open(rs).map((r) => r.r1Price)) - 1;
const winRate = (card: ValuesCard): Stat => (rs) => {
  let w = 0;
  let n = 0;
  for (const r of rs) r.cards.forEach((c, i) => c === card && (n++, (w += r.winShare[i])));
  return n ? w / n : NaN;
};
/** Mean of a mission's value on every seat's final banks over the mean final bank (D-96 calibration). */
const missionRatio = (card: ValuesCard): Stat => (rs) => mean(rs.flatMap((r) => r.missionByCard[card])) / mean(rs.flatMap((r) => r.banks));

interface Target {
  name: string;
  stat: Stat;
  lo?: number;
  hi?: number;
  /** Decides the exit code (mechanism checks and F-f); otherwise reported only. */
  gate: boolean;
  note?: string;
}
const FV = PLAY.L3_LAUNCH ? 2 : 1;
const targets: Target[] = [
  { name: `E3a round-${FV} High-risk / Low-risk applicants (first voluntary round)`, stat: buyerRatio, lo: 2, gate: true },
  { name: `E3b mean round-${FV + 1} price over round ${FV}, open markets`, stat: priceRise, lo: 0.15, gate: true, note: `${open(recs).length} of ${recs.length} games open; insurer's price before any Price War discount` },
  { name: 'E3c share of bars that hit a high-risk contestant', stat: barHighShare, lo: 0.5, gate: true, note: `${sum(recs.map((r) => r.barHigh + r.barLow))} bars in ${recs.length} games; the bar screens somewhat` },
  { name: `E3d price set by round 3's pool over round ${FV}, markets open in round 3`, stat: priceRise3, lo: 0, gate: true, note: `${open3(recs).length} of ${recs.length} games; screening does not fully fix it` },
  { name: 'S-a bots lie where lying would pay', stat: lieShare, lo: 0.15, hi: 0.5, gate: false, note: `${sum(recs.map((r) => r.lieChances))} bot claim decisions where the lie gains coins` },
  { name: 'S-b a reader using the audience belief judges a claim TRUE or LIE correctly', stat: readAcc, lo: 0.55, hi: 0.8, gate: false, note: `${sum(recs.map((r) => r.watch.reads.length))} claims, judged right after their round's results` },
  { name: 'F-f some contestant goes into debt', stat: avg((r) => (r.anyDebt ? 1 : 0)), lo: 0.3, hi: 0.7, gate: true, note: 'per episode (per life from P3)' },
  { name: 'F-a lead changes', stat: avg((r) => r.leadChanges), lo: 2, gate: false, note: 'per episode, not per life (4 rounds allow at most 3)' },
  { name: 'F-c close finish, top two within 15%', stat: avg((r) => (r.close ? 1 : 0)), lo: 0.4, gate: false, note: 'per episode' },
  { name: 'F-d big moment (an event, an 80+ swing, a bar, or a liar who got in)', stat: avg((r) => (r.bigMoment ? 1 : 0)), lo: 0.9, gate: false },
  ...VALUES_CARDS.map((c) => ({ name: `F-e mission win share, ${c}`, stat: winRate(c), lo: 0.15, hi: 0.35, gate: false, note: 'per seat, per episode' })),
];

const rules = currentRules('PLAY');
const lines: string[] = [];
lines.push(`THE VEIL: LIVE simulation: ${games} Episode ${episode} games (EPISODE mode), ${nPlayers} bots, ${difficulty}. Rules ${rules.rules}, Play params ${rules.params}.`);
lines.push(`Seeds ${seedBase}-0 to ${seedBase}-${games - 1}. Code ${revision}.${Object.keys(overrides).length ? ` PLAY overrides: ${JSON.stringify(overrides)}.` : ''}`);
lines.push('BOT-ONLY TABLES: these numbers describe the bots, not people. Targets are design targets, not findings (D-76).');
lines.push(`Each value is mean ± bootstrap SE over games (${BOOT} resamples).`);
lines.push('');
lines.push(`Round-${FV} applicants per game: High ${avg((r) => r.highBuyersR1)(recs).toFixed(3)}, Low ${avg((r) => r.lowBuyersR1)(recs).toFixed(3)}`);
lines.push(`Mean list price: round ${FV} ${mean(recs.map((r) => r.r1Price)).toFixed(2)}, round ${FV + 1} (open) ${mean(open(recs).map((r) => r.r2Price)).toFixed(2)}; market closed by round ${FV + 1} in ${(avg((r) => (r.collapsed ? 1 : 0))(recs) * 100).toFixed(1)}%`);
lines.push(`Events: at least one card in ${(avg((r) => (r.anyEvent ? 1 : 0))(recs) * 100).toFixed(1)}% of episodes; largest single-round bank swing ${mean(recs.map((r) => r.maxSwing)).toFixed(1)} on average`);
lines.push(`Mean final bank ${mean(recs.flatMap((r) => r.banks)).toFixed(1)}; mean final score ${mean(recs.flatMap((r) => r.final)).toFixed(1)}`);
lines.push(`Mission value / mean bank (MISSION_SCALE calibration, D-96): ${VALUES_CARDS.map((c) => `${c} ${missionRatio(c)(recs).toFixed(3)} ± ${se(missionRatio(c)).toFixed(3)} (scale ${(1 / missionRatio(c)(recs)).toFixed(3)})`).join(', ')}`);
lines.push('');
lines.push('Targets (bot-only; "at the bound" = within 2 SE):');
let failures = 0;
for (const tg of targets) {
  const v = tg.stat(recs);
  const e = se(tg.stat);
  const bound = [tg.lo !== undefined ? `>= ${tg.lo}` : '', tg.hi !== undefined ? `<= ${tg.hi}` : ''].filter(Boolean).join(' and ');
  let status: string;
  if (!Number.isFinite(v)) status = 'N/A';
  else {
    const pass = (tg.lo === undefined || v >= tg.lo) && (tg.hi === undefined || v <= tg.hi);
    if (!pass && tg.gate) failures++;
    const near = Math.min(...[tg.lo, tg.hi].filter((b): b is number => b !== undefined).map((b) => (e > 0 ? Math.abs(v - b) / e : Infinity)));
    status = pass ? (near < 2 ? `PASS, at the bound (${near.toFixed(1)} SE)` : 'PASS') : `FAIL (${near.toFixed(1)} SE)`;
    if (!tg.gate) status = `${status} [reported]`;
  }
  lines.push(`  ${status.padEnd(38)} ${tg.name}: ${Number.isFinite(v) ? v.toFixed(4) : 'n/a'} ± ${e.toFixed(4)} (target ${bound})${tg.note ? `; ${tg.note}` : ''}`);
}
lines.push('  N/A [reported]                         F-b comeback from last after Episode 2: needs Episode 2 (P2)');
lines.push('');
lines.push(`Market still open in round 3 (SafeHands offers cover): ${(avg((r) => (r.open3 ? 1 : 0))(recs) * 100).toFixed(1)}% ± ${(se(avg((r) => (r.open3 ? 1 : 0))) * 100).toFixed(1)}`);
const gains = recs.flatMap((r) => r.lieGains).sort((a, b) => a - b);
const q = (x: number) => (gains.length ? gains[Math.floor(x * (gains.length - 1))].toFixed(2) : 'n/a');
lines.push(`Lie gain (coins, claim decisions where lying would pay): median ${q(0.5)}, 90th percentile ${q(0.9)}`);
const bots: Record<string, [number, number]> = {};
for (const r of recs) for (const [k, [c, l]] of Object.entries(r.byBot)) {
  bots[k] ??= [0, 0];
  bots[k][0] += c;
  bots[k][1] += l;
}
lines.push(`Lie rate per bot (lies / chances): ${['chet', 'ugo', 'dot', 'marigold'].map((k) => `${k} ${bots[k] ? ((100 * bots[k][1]) / bots[k][0]).toFixed(1) : 'n/a'}% (${bots[k]?.[1] ?? 0}/${bots[k]?.[0] ?? 0})`).join(', ')}`);
lines.push(`Claims: ${sum(recs.map((r) => r.claims))} made, ${sum(recs.map((r) => r.silences))} silences, ${sum(recs.map((r) => r.lies + r.otherLies))} lies (bots).`);
lines.push('Deck trim rule (v2 Section 5): share of draws in which the card changes no bot\'s best cover or gym choice (cut above 90%):');
for (const id of [...new Set(recs.flatMap((r) => r.watch.cards.map((c) => c.id)))].sort()) {
  const cs = recs.flatMap((r) => r.watch.cards.filter((c) => c.id === id));
  const none = cs.filter((c) => !c.changed).length / cs.length;
  lines.push(`  ${id.padEnd(13)} ${String(cs.length).padStart(5)} draws, no change in ${(none * 100).toFixed(1)}%${none > 0.9 ? '  CUT' : ''}`);
}
lines.push(failures ? `${failures} gating target(s) FAILED.` : 'All gating targets pass (E3a to E3d, F-f).');
lines.push(`Time: ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
const summary = lines.join('\n');
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/summary-ep${episode}-${nPlayers}p-${difficulty}.txt`, summary);
console.log(summary);
if (failures) process.exitCode = 1;
