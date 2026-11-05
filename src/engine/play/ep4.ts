// Play Episode 4, "The Hiring Round" (PLAY_V2_SPEC.md Section 4, D-151): you are HireBot. The judge seat
// rotates; workers train (private), claim "I trained" or stay silent, and the judge hires each worker for
// the complex or the simple job from group, test result, claim and the HireBot meter. Study's Level 4
// rules (groups, care, costs, test accuracy, wages, belief updates, policies) are reused unchanged; Study
// games never reach this file (the Level 4 dispatcher sends only Play games here).
import { L4, EPS } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, playerOf, pluralityResolve } from '../core';
import { effortSharesFrom, mean } from '../scoring';
import { logitChoice } from '../bots/utility';
import type { Rng } from '../rng';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import type { LevelDefinition } from '../levels/types';
import { POLICIES, type Group, type Job, type Policy, type Priors } from '../levels/level4';
import { PLAY } from './params';
import { activeEvent, missionScale, missionValue, playEffortShares, playRanks, playRoundValue, playScore, livingCost } from './rules';
import { chooseClaim, honestyRange, postClaims, SILENT } from './claims';

export interface Gift4 {
  to: PlayerId;
  amount: number;
}

export interface P4Round {
  judge: PlayerId;
  workers: PlayerId[];
  policy: Policy;
  priorsBefore: Priors;
  priorsAfter: Priors;
  costs: Record<PlayerId, number>;
  train: Record<PlayerId, boolean>;
  pass: Record<PlayerId, boolean>;
  /** The HireBot meter: Study's posterior from the group's belief (pooled under policy B) and the test. */
  meter: Record<PlayerId, number>;
  claims: Record<PlayerId, string>;
  /** The judge's hires before any quota pick, and after. */
  chosen: Record<PlayerId, Job>;
  job: Record<PlayerId, Job>;
  quotaPicks: PlayerId[];
  W: Record<PlayerId, number>;
  judgePay: number;
  good: PlayerId[];
  bad: PlayerId[];
  gifts: Record<PlayerId, Gift4>;
  /** Simulator only: a bot judge's read of each worker (meter moved by the claim). */
  reads: Record<PlayerId, number>;
  /** Study's posterior from the group belief and the test alone (before the claim). */
  testMeter?: Record<PlayerId, number>;
}

export interface P4State {
  groups: Record<PlayerId, Group>;
  care: Record<PlayerId, boolean>;
  priors: Priors;
  policy: Policy;
  policyVotes?: Record<PlayerId, Policy>;
  costs: Record<PlayerId, number>;
  judge: PlayerId;
  current?: Partial<P4Round>;
  rounds: P4Round[];
}

export interface P4Debrief {
  groups: Record<PlayerId, Group>;
  rounds: P4Round[];
  gap: number;
  meanByGroup: { CIRCLE: number; SQUARE: number };
  policy: Policy;
}

const st = (s: GameState) => s.levelState as P4State;

/** The numbers in force this round: Study's Level 4 values, Play's judge pay, and this round's event. */
export function p4Params(s: GameState, withEvent = true) {
  const ev = withEvent ? activeEvent(s) : null;
  const e = (ev ? (PLAY.L4_EVENTS as Record<string, Record<string, number>>)[ev.id] : null) ?? {};
  const loss = e.JUDGE_LOSS ?? PLAY.L4.JUDGE_LOSS;
  return {
    judgeGain: PLAY.L4.JUDGE_GAIN,
    judgeLoss: loss,
    judgeBase: PLAY.L4.JUDGE_BASE,
    threshold: loss / (PLAY.L4.JUDGE_GAIN + loss),
    wageGreedy: e.WAGE_GREEDY ?? L4.WAGE_GREEDY,
    wageFlex: L4.WAGE_FLEXIBLE + (e.FLEX_BONUS ?? 0),
    wageSimple: L4.WAGE_SIMPLE,
    costCut: e.COST_CUT ?? 0,
    updateWeight: e.UPDATE_WEIGHT ?? L4.UPDATE_WEIGHT,
  };
}
export type P4Params = ReturnType<typeof p4Params>;

export function posterior4(pi: number, pass: boolean): number {
  const a = pass ? L4.PASS_IF_SKILLED : 1 - L4.PASS_IF_SKILLED;
  const b = pass ? L4.PASS_IF_UNSKILLED : 1 - L4.PASS_IF_UNSKILLED;
  return (a * pi) / (a * pi + b * (1 - pi));
}

const chaosOf = (policy: Policy) => (policy === 'D' ? L4.CHAOS_COST_SUBSIDIZED : L4.CHAOS_COST);

/** A worker's pay for a job: the complex job on the better schedule for them (picked for them, D-151). */
export function pay4(job: Job, care: boolean, policy: Policy, P: P4Params): number {
  if (job === 'SIMPLE') return P.wageSimple;
  return Math.max(P.wageFlex, P.wageGreedy - (care ? chaosOf(policy) : 0));
}

const priorOf = (l: P4State, id: PlayerId) => (l.policy === 'B' && l.priors.POOL !== null ? l.priors.POOL : l.priors[l.groups[id]]);

/** v1 6.3: the contestant in last place now (lowest Play score; the later seat on a tie). */
export function comebackSeat(s: GameState): PlayerId {
  const r = playRanks(s);
  const worst = Math.max(...Object.values(r));
  return s.players.filter((p) => r[p.id] === worst).slice(-1)[0].id;
}

/** The judge seat for a round: seat order, wrapping when there are fewer than 4 seats. */
export const judgeOf = (s: GameState, round: number): PlayerId => s.players[(round - 1) % s.players.length].id;

const workersOf = (s: GameState): PlayerId[] => ids(s).filter((id) => id !== st(s).judge);

/** Training cost this round (Training Grant takes COST_CUT off, minimum 0). */
const costOf = (s: GameState, id: PlayerId, P: P4Params) => Math.max(0, st(s).costs[id] - P.costCut);

/**
 * R2 (D-159): a judge's read of "I trained", by Bayes' rule. A trained worker always says so; an untrained one
 * says so unless it is honest, so P(claim | untrained) = 1 - k, with k = CLAIM_WEIGHT_EP4 x the chance the worker
 * is honest, from public facts: its record, with the table's honesty prior as the starting point. k = 0 is the
 * meter alone.
 */
export function judgeRead(meter: number, claimed: boolean, k: number): number {
  if (!claimed || k <= 0) return meter;
  const odds = meter / Math.max(1e-9, 1 - meter) / Math.max(1e-9, 1 - Math.min(0.99, k));
  return odds / (1 + odds);
}

/** k for a worker: CLAIM_WEIGHT_EP4 x (kept + 2 x the table's mean honesty) / (made + 2). */
export function claimCred(s: GameState, pid: PlayerId): number {
  const ranges = s.players.map((p) => honestyRange(s, p.isHuman || !p.botProfile ? 'AUTO' : p.botProfile.key));
  const prior = mean(ranges.map(([lo, hi]) => (lo + hi) / 2));
  const r = s.reliability[pid] ?? { made: 0, kept: 0 };
  return PLAY.CLAIM_WEIGHT_EP4 * ((r.kept + 2 * prior) / (r.made + 2));
}

/** The judge's pay given the hires and the workers' true skill. */
function judgePayOf(job: Record<PlayerId, Job>, train: Record<PlayerId, boolean>, P: P4Params): { pay: number; good: PlayerId[]; bad: PlayerId[] } {
  const good = Object.keys(job).filter((id) => job[id] === 'COMPLEX' && train[id]);
  const bad = Object.keys(job).filter((id) => job[id] === 'COMPLEX' && !train[id]);
  return { pay: P.judgeBase + P.judgeGain * good.length - P.judgeLoss * bad.length, good, bad };
}

/** Policy C (quota): a group with no complex hire gets its highest-meter worker hired complex. */
function applyQuota(s: GameState, chosen: Record<PlayerId, Job>, meter: Record<PlayerId, number>, rng: Rng): { job: Record<PlayerId, Job>; picks: PlayerId[] } {
  const l = st(s);
  const job = { ...chosen };
  const picks: PlayerId[] = [];
  const u = { CIRCLE: rng.next(), SQUARE: rng.next() };
  if (l.policy !== 'C') return { job, picks };
  for (const g of ['CIRCLE', 'SQUARE'] as Group[]) {
    const members = Object.keys(chosen).filter((id) => l.groups[id] === g);
    if (!members.length || members.some((id) => job[id] === 'COMPLEX')) continue;
    const top = Math.max(...members.map((id) => meter[id]));
    const best = members.filter((id) => Math.abs(meter[id] - top) < 1e-12);
    const pick = best[Math.floor(u[g] * best.length)];
    job[pick] = 'COMPLEX';
    picks.push(pick);
  }
  return { job, picks };
}

/** Study's belief update, from this round's workers' true skill. */
function nextPriors4(l: P4State, workers: PlayerId[], train: Record<PlayerId, boolean>, weight: number): Priors {
  const up = (pi: number, rate: number) => (1 - weight) * pi + weight * rate;
  const out = { ...l.priors };
  if (l.policy === 'B' && l.priors.POOL !== null) {
    out.POOL = up(l.priors.POOL, workers.filter((id) => train[id]).length / workers.length);
    return out;
  }
  for (const g of ['CIRCLE', 'SQUARE'] as Group[]) {
    const m = workers.filter((id) => l.groups[id] === g);
    if (m.length) out[g] = up(l.priors[g], m.filter((id) => train[id]).length / m.length);
  }
  return out;
}

function pooled(l: P4State): number {
  const gs = Object.values(l.groups);
  const nc = gs.filter((g) => g === 'CIRCLE').length;
  return (nc * l.priors.CIRCLE + (gs.length - nc) * l.priors.SQUARE) / gs.length;
}

// ---------------------------------------------------------------------------------------------------------
// Bots' expectations (B.2: every rule comes from the payoffs).

/** Chance a worker with prior `pi` is hired complex by the threshold rule, if trained or not (claims aside). */
function hireChance(pi: number, trained: boolean, thr: number): number {
  const qp = posterior4(pi, true) >= thr - EPS ? 1 : 0;
  const qf = posterior4(pi, false) >= thr - EPS ? 1 : 0;
  const pp = trained ? L4.PASS_IF_SKILLED : L4.PASS_IF_UNSKILLED;
  return pp * qp + (1 - pp) * qf;
}

/** Money a worker expects this round if they train or not, by the threshold rule (Study's investGain in coins). */
function workerMoney(s: GameState, id: PlayerId, trained: boolean, P: P4Params): number {
  const l = st(s);
  const h = hireChance(priorOf(l, id), trained, P.threshold);
  return h * pay4('COMPLEX', l.care[id], l.policy, P) + (1 - h) * P.wageSimple - (trained ? costOf(s, id, P) : 0);
}

/** Chance another worker trains, as bots model them: the share of costs at which training pays in coins. */
function trainChance(s: GameState, id: PlayerId, P: P4Params): number {
  const l = st(s);
  const pi = priorOf(l, id);
  const gain = (c: number) => {
    const h1 = hireChance(pi, true, P.threshold);
    const h0 = hireChance(pi, false, P.threshold);
    return (h1 - h0) * (pay4('COMPLEX', l.care[id], l.policy, P) - P.wageSimple) - Math.max(0, c - P.costCut);
  };
  return L4.COST_OPTIONS.filter((c) => gain(c) > 0).length / L4.COST_OPTIONS.length;
}

/** Everyone's expected money this round from bot `i`'s point of view, with `i`'s own choice fixed. */
function expectedW(s: GameState, i: number, mine: { trained?: boolean; job?: Record<PlayerId, Job> }, P: P4Params): number[] {
  const l = st(s);
  const me = s.players[i].id;
  return s.players.map((p) => {
    if (p.id === l.judge) {
      if (p.id === me && mine.job) {
        // The judge's expected pay from its hires, by its read of each worker.
        const c = l.current!;
        let pay = P.judgeBase;
        for (const w of Object.keys(mine.job)) if (mine.job[w] === 'COMPLEX') pay += P.judgeGain * c.reads![w] - P.judgeLoss * (1 - c.reads![w]);
        return pay;
      }
      return P.judgeBase;
    }
    if (p.id === me && mine.trained !== undefined) return workerMoney(s, p.id, mine.trained, P);
    if (mine.job) return pay4(mine.job[p.id] ?? 'SIMPLE', l.care[p.id], l.policy, P);
    const q = trainChance(s, p.id, P);
    return q * workerMoney(s, p.id, true, P) + (1 - q) * workerMoney(s, p.id, false, P);
  });
}

const withGift = (W: number[], i: number, g: Gift4 | null | undefined, s: GameState) => {
  if (!g) return W;
  const out = W.slice();
  out[i] -= g.amount;
  out[idx(s, g.to)] += g.amount;
  return out;
};

/** A bot's value of a round's money for everyone: its Play score if the episode ended after this round. */
function valueOf(s: GameState, i: number, W: number[], extraEffort = 0): number {
  const eff = effortWith(s, s.players[i].id, extraEffort);
  return playRoundValue(s, s.players[i].values, W, i, eff, null);
}

function effortWith(s: GameState, pid: PlayerId, extra: number): number[] {
  if (!extra) return playEffortShares(s);
  const e = s.play!.effort ?? {};
  const xs = s.players.map((p) => (e[p.id] ?? 0) + (p.id === pid ? extra : 0));
  return effortSharesFrom(xs);
}

function bestGift(s: GameState, i: number, W: number[]): Gift4 | null {
  const me = s.players[i].id;
  let best: { g: Gift4 | null; u: number } = { g: null, u: valueOf(s, i, W) };
  for (const p of s.players) {
    if (p.id === me) continue;
    for (const a of PLAY.GIFT_AMOUNTS) {
      const g = { to: p.id, amount: a };
      const u = valueOf(s, i, withGift(W, i, g, s));
      if (u > best.u + 0.5) best = { g, u };
    }
  }
  return best.g;
}

// ---------------------------------------------------------------------------------------------------------
// Mission previews (D-143): mission points against doing nothing, under the bots' model.

export interface P4Preview {
  train?: number;
  hire?: Record<PlayerId, number>;
  gift: Record<PlayerId, Record<number, number>>;
}

function missionPoints(s: GameState, i: number, W: number[], extraEffort = 0): number {
  const card = s.players[i].values;
  const banks = s.players.map((p, j) => s.play!.banks[p.id] + W[j] - livingCost(s));
  return PLAY.MISSION_WEIGHT * missionScale(s, card) * missionValue(card, banks, i, effortWith(s, s.players[i].id, extraEffort));
}

export function p4Preview(s: GameState, pid: PlayerId): P4Preview {
  const l = st(s);
  const P = p4Params(s);
  const i = idx(s, pid);
  const base = s.phase.step === 'HIRE' ? expectedW(s, i, { job: Object.fromEntries(workersOf(s).map((w) => [w, 'SIMPLE' as Job])) }, P) : expectedW(s, i, { trained: false }, P);
  const m0 = missionPoints(s, i, base);
  const out: P4Preview = { gift: {} };
  if (s.phase.step === 'TRAIN') out.train = missionPoints(s, i, expectedW(s, i, { trained: true }, P), PLAY.L4_TRAIN_EFFORT) - m0;
  if (s.phase.step === 'HIRE' && l.current?.reads) {
    out.hire = {};
    for (const w of workersOf(s)) {
      const job = Object.fromEntries(workersOf(s).map((x) => [x, (x === w ? 'COMPLEX' : 'SIMPLE') as Job]));
      out.hire[w] = missionPoints(s, i, expectedW(s, i, { job }, P)) - m0;
    }
  }
  for (const p of s.players) {
    if (p.id === pid) continue;
    out.gift[p.id] = {};
    for (const a of PLAY.GIFT_AMOUNTS) out.gift[p.id][a] = missionPoints(s, i, withGift(base, i, { to: p.id, amount: a }, s)) - m0;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------

function botTrain(s: GameState, pid: PlayerId): { train: boolean; gift: Gift4 | null } {
  const P = p4Params(s);
  const i = idx(s, pid);
  const u = [false, true].map((t) => valueOf(s, i, expectedW(s, i, { trained: t }, P), t ? PLAY.L4_TRAIN_EFFORT : 0));
  const k = logitChoice(u, botParams(s, pid).lambda, botRng(s));
  const train = k === 1;
  return { train, gift: bestGift(s, i, expectedW(s, i, { trained: train }, P)) };
}

/**
 * Coins a claim is worth to a worker this round, by a bot judge's read, before the test (D-151): the chance of
 * each test result given the worker's training, times the job that result and the claim get.
 */
function claimGain(s: GameState, pid: PlayerId, value: string): number {
  const l = st(s);
  const P = p4Params(s);
  const trained = !!l.current!.train![pid];
  const pp = trained ? L4.PASS_IF_SKILLED : L4.PASS_IF_UNSKILLED;
  const k = claimCred(s, pid);
  let out = 0;
  for (const pass of [true, false]) {
    const read = judgeRead(posterior4(priorOf(l, pid), pass), value === 'TRAINED', k);
    const w = read >= P.threshold - EPS ? pay4('COMPLEX', l.care[pid], l.policy, P) : P.wageSimple;
    out += (pass ? pp : 1 - pp) * w;
  }
  return out;
}

function botHire(s: GameState, pid: PlayerId): { hires: Record<PlayerId, Job>; gift: Gift4 | null } {
  const l = st(s);
  const P = p4Params(s);
  const c = l.current!;
  const hires: Record<PlayerId, Job> = {};
  for (const w of workersOf(s)) hires[w] = c.reads![w] >= P.threshold - EPS ? 'COMPLEX' : 'SIMPLE';
  const i = idx(s, pid);
  return { hires, gift: bestGift(s, i, expectedW(s, i, { job: hires }, P)) };
}

/** A bot's policy vote: its expected Play value over the two policy rounds, everyone by the threshold rule. */
function botPolicy(s: GameState, pid: PlayerId): Policy {
  const l = st(s);
  const i = idx(s, pid);
  const saved = { policy: l.policy, priors: { ...l.priors }, judge: l.judge };
  const u = POLICIES.map((pol) => {
    l.policy = pol;
    if (pol === 'B') l.priors.POOL = pooled(l);
    let total = 0;
    for (let r = PLAY.L4.BASELINE_ROUNDS + 1; r <= PLAY.L4.ROUNDS; r++) {
      l.judge = judgeOf(s, r);
      const P = p4Params(s, false);
      const W = s.players.map((p) => {
        if (p.id === l.judge) return P.judgeBase;
        const q = trainChance(s, p.id, P);
        return q * workerMoney(s, p.id, true, P) + (1 - q) * workerMoney(s, p.id, false, P);
      });
      total += valueOf(s, i, W);
    }
    l.policy = saved.policy;
    l.priors = { ...saved.priors };
    return total / (PLAY.L4.ROUNDS - PLAY.L4.BASELINE_ROUNDS);
  });
  l.judge = saved.judge;
  return POLICIES[logitChoice(u, botParams(s, pid).lambda, botRng(s))];
}

// ---------------------------------------------------------------------------------------------------------

export const playLevel4: LevelDefinition = {
  id: 4,
  rounds: PLAY.L4.ROUNDS,
  init(s) {
    const g = gameRng(s);
    const pids = ids(s);
    const n = pids.length;
    const order = g.shuffle(pids);
    const nCircle = n === 3 ? (g.next() < 0.5 ? 2 : 1) : n / 2;
    const groups: Record<PlayerId, Group> = {};
    order.forEach((id, k) => (groups[id] = k < nCircle ? 'CIRCLE' : 'SQUARE'));
    const care: Record<PlayerId, boolean> = {};
    for (const id of pids) {
      care[id] = g.next() < (groups[id] === 'SQUARE' ? L4.CARE_PROB_SQUARE : L4.CARE_PROB_CIRCLE);
      const pl = playerOf(s, id);
      pl.publicInfo.group = groups[id];
      pl.publicInfo.care = care[id];
    }
    s.levelState = { groups, care, priors: { CIRCLE: L4.PRIOR_CIRCLE, SQUARE: L4.PRIOR_SQUARE, POOL: null }, policy: 'A', costs: {}, judge: judgeOf(s, 1), rounds: [] } satisfies P4State;
    // Episode 4's hidden fact is training, read through the meter and the claim; Episode 3's tables are cleared.
    const pl = s.play!;
    pl.joint = {};
    pl.belief = {};
    pl.belief2 = {};
  },
  phases(s) {
    const out: Phase[] = [];
    // v1 Section 6.3: in a life, the comeback card comes before Episode 4 for whoever is last after Episode 3.
    if (s.mode === 'LIFE') out.push({ kind: 'DECIDE', step: 'COMEBACK', round: 1 });
    for (let r = 1; r <= PLAY.L4.ROUNDS; r++) {
      out.push(
        { kind: 'BRIEFING', round: r },
        { kind: 'DECIDE', step: 'TRAIN', round: r },
        { kind: 'DECIDE', step: 'CLAIM', round: r },
        { kind: 'DECIDE', step: 'HIRE', round: r },
        { kind: 'REVEAL', step: 'PAY', round: r },
        { kind: 'ROUND_SUMMARY', round: r },
      );
      if (r === PLAY.L4.BASELINE_ROUNDS) out.push({ kind: 'DECIDE', step: 'POLICY', round: r }, { kind: 'REVEAL', step: 'POLICY', round: r });
    }
    out.push({ kind: 'REVEAL', step: 'CARDS', round: PLAY.L4.ROUNDS });
    return out;
  },
  onEnter(s, phase) {
    if (phase.kind === 'REVEAL' && phase.step === 'CARDS') {
      // v2 3.4: every claim of the episode is stamped against that round's training, and feeds the record.
      const l = st(s);
      for (const m of s.messages) {
        if (m.level !== s.levelIndex || m.resolved || m.msg.type !== 'CLAIM') continue;
        m.resolved = true;
        m.kept = (m.msg.value === 'TRAINED') === !!l.rounds[m.round - 1]?.train[m.from];
        s.reliability[m.from].made++;
        if (m.kept) s.reliability[m.from].kept++;
      }
      return;
    }
    if (phase.kind !== 'BRIEFING') return;
    const l = st(s);
    const g = gameRng(s);
    l.judge = judgeOf(s, phase.round);
    l.costs = {};
    for (const p of s.players) {
      l.costs[p.id] = g.pick(L4.COST_OPTIONS);
      p.privateInfo.cost = l.costs[p.id];
    }
    l.current = { judge: l.judge, workers: workersOf(s), policy: l.policy, priorsBefore: { ...l.priors }, costs: { ...l.costs }, gifts: {} };
  },
  deciders(s, step) {
    if (step === 'COMEBACK') return s.play!.comeback ? [] : [comebackSeat(s)];
    if (step === 'POLICY') return ids(s);
    if (step === 'HIRE') return [st(s).judge];
    return workersOf(s);
  },
  validate(s, step, pid, d) {
    const gift = (x: unknown): Gift4 | null => {
      const gf = x as Gift4 | null | undefined;
      return gf && typeof gf.to === 'string' && gf.to !== pid && ids(s).includes(gf.to) && PLAY.GIFT_AMOUNTS.includes(gf.amount) ? { to: gf.to, amount: gf.amount } : null;
    };
    if (step === 'POLICY') return POLICIES.includes(d as Policy) ? d : null;
    if (step === 'COMEBACK') return d === 'COINS' || d === 'POINTS' ? d : null;
    if (step === 'CLAIM') return d === 'TRAINED' || d === SILENT ? d : null;
    if (step === 'TRAIN') {
      const c = d as { train?: unknown; gift?: unknown };
      if (!c || typeof c.train !== 'boolean') return null;
      return { train: c.train, gift: gift(c.gift) };
    }
    if (step === 'HIRE') {
      const c = d as { hires?: Record<string, unknown>; gift?: unknown };
      if (!c || typeof c.hires !== 'object' || !c.hires) return null;
      const hires: Record<PlayerId, Job> = {};
      for (const w of workersOf(s)) hires[w] = c.hires[w] === 'COMPLEX' ? 'COMPLEX' : 'SIMPLE';
      return { hires, gift: gift(c.gift) };
    }
    return null;
  },
  botDecide(s, botId, step) {
    if (step === 'COMEBACK') {
      // The option that raises the bot's Play score more (the coins count half, and move its mission).
      const before = playScore(s, botId);
      s.play!.banks[botId] += PLAY.COMEBACK.COINS;
      const coinsGain = playScore(s, botId) - before;
      s.play!.banks[botId] -= PLAY.COMEBACK.COINS;
      return coinsGain >= PLAY.COMEBACK.POINTS ? 'COINS' : 'POINTS';
    }
    if (step === 'TRAIN') return botTrain(s, botId);
    if (step === 'CLAIM') {
      const trained = st(s).current!.train![botId];
      return trained ? chooseClaim(s, botId, 'TRAINED', 'TRAINED', (v) => claimGain(s, botId, v)).value : chooseClaim(s, botId, SILENT, 'TRAINED', (v) => claimGain(s, botId, v)).value;
    }
    if (step === 'HIRE') return botHire(s, botId);
    return botPolicy(s, botId);
  },
  resolve(s, step, decisions) {
    const l = st(s);
    const c = l.current!;
    const g = gameRng(s);
    if (step === 'COMEBACK') {
      const [pid, took] = Object.entries(decisions)[0] as [PlayerId, 'COINS' | 'POINTS'];
      if (took === 'COINS') s.play!.banks[pid] += PLAY.COMEBACK.COINS;
      else s.play!.guessPoints[pid] += PLAY.COMEBACK.POINTS;
      s.play!.comeback = { pid, took };
      return;
    }
    if (step === 'POLICY') {
      const votes = ids(s).map((id) => POLICIES.indexOf(decisions[id] as Policy));
      const { winner } = pluralityResolve(votes, POLICIES.length, g);
      l.policyVotes = decisions as Record<PlayerId, Policy>;
      l.policy = POLICIES[winner];
      if (l.policy === 'B') l.priors.POOL = pooled(l);
      return;
    }
    if (step === 'TRAIN') {
      c.train = {};
      for (const w of c.workers!) {
        const d = decisions[w] as { train: boolean; gift: Gift4 | null };
        c.train[w] = d.train;
        if (d.gift) c.gifts![w] = d.gift;
        playerOf(s, w).privateInfo.trained = d.train;
      }
      return;
    }
    if (step === 'CLAIM') {
      const said: Record<PlayerId, string> = {};
      const gains: Record<PlayerId, number | null> = {};
      for (const w of c.workers!) {
        said[w] = decisions[w] as string;
        const human = playerOf(s, w).isHuman;
        gains[w] = human || c.train![w] ? null : claimGain(s, w, 'TRAINED') - claimGain(s, w, SILENT);
      }
      c.claims = said;
      // v2 Section 4: the test comes after the claim, so a claim is made without knowing the result.
      c.pass = {};
      c.meter = {};
      for (const w of c.workers!) {
        c.pass[w] = g.next() < (c.train![w] ? L4.PASS_IF_SKILLED : L4.PASS_IF_UNSKILLED);
        c.meter[w] = posterior4(priorOf(l, w), c.pass[w]);
      }
      // Reads use each worker's record as it stood before this round (claims are simultaneous).
      c.reads = Object.fromEntries(c.workers!.map((w) => [w, judgeRead(c.meter![w], said[w] === 'TRAINED', claimCred(s, w))]));
      // R2: the meter the judge sees includes the claim; the test-only posterior is kept for the simulator.
      c.testMeter = { ...c.meter };
      c.meter = { ...c.reads };
      postClaims(s, 'TRAINING', said, (pid) => (c.train![pid] ? 'TRAINED' : 'UNTRAINED'), (v) => v === 'TRAINED', gains);
      return;
    }
    // HIRE: quota, pay, gifts, the belief update, finish the round.
    const P = p4Params(s);
    const d = decisions[l.judge] as { hires: Record<PlayerId, Job>; gift: Gift4 | null };
    if (d.gift) c.gifts![l.judge] = d.gift;
    c.chosen = d.hires;
    const { job, picks } = applyQuota(s, d.hires, c.meter!, g);
    c.job = job;
    c.quotaPicks = picks;
    const jp = judgePayOf(job, c.train!, P);
    c.judgePay = jp.pay;
    c.good = jp.good;
    c.bad = jp.bad;
    // v2 Section 4: a complex hire's true skill is shown now (GOOD HIRE or BAD HIRE), so a claim by a complex
    // hire is stamped at once and feeds the record; every other claim waits for the end reveal.
    for (const m of s.messages) {
      if (m.level !== s.levelIndex || m.round !== s.round || m.resolved || m.msg.type !== 'CLAIM' || job[m.from] !== 'COMPLEX') continue;
      m.resolved = true;
      m.kept = c.train![m.from];
      s.reliability[m.from].made++;
      if (m.kept) s.reliability[m.from].kept++;
    }
    let W = s.players.map((p) => (p.id === l.judge ? jp.pay : pay4(job[p.id], l.care[p.id], l.policy, P) - (c.train![p.id] ? costOf(s, p.id, P) : 0)));
    for (const [from, gf] of Object.entries(c.gifts!)) W = withGift(W, idx(s, from), gf, s);
    c.W = Object.fromEntries(s.players.map((p, i) => [p.id, W[i]]));
    const pl = s.play!;
    pl.effort ??= Object.fromEntries(s.players.map((p) => [p.id, 0]));
    for (const w of c.workers!) if (c.train![w]) pl.effort[w] = (pl.effort[w] ?? 0) + PLAY.L4_TRAIN_EFFORT;
    l.priors = nextPriors4(l, c.workers!, c.train!, P.updateWeight);
    c.priorsAfter = { ...l.priors };
    l.rounds.push(c as P4Round);
    finishRound(s, W, playEffortShares(s), headline(s, 'l4.play', {}));
  },
  talkMenu() {
    return { support: [], oppose: [], promise: [] };
  },
  checkStep() {
    return undefined;
  },
  messageKept() {
    return true;
  },
  botIntent() {
    return {};
  },
  observable: [],
  likelihood() {
    return 1;
  },
  debrief(s) {
    const l = st(s);
    const byGroup = (g: Group) => mean(l.rounds.flatMap((r) => r.workers.filter((w) => l.groups[w] === g).map((w) => r.W[w])));
    const C = byGroup('CIRCLE');
    const S = byGroup('SQUARE');
    return { groups: l.groups, rounds: l.rounds, gap: C - S, meanByGroup: { CIRCLE: C, SQUARE: S }, policy: l.policy } satisfies P4Debrief;
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    const c = l.current;
    const cards = revealPrivate || (s.phase.kind === 'REVEAL' && s.phase.step === 'CARDS') || s.phase.kind === 'LEVEL_DEBRIEF' || s.phase.kind === 'GUESS';
    const hideTrain = (r: Partial<P4Round>) => {
      if (!r.train) return r;
      const train: Record<PlayerId, boolean> = {};
      for (const [id, v] of Object.entries(r.train)) if (cards || id === viewer || (r.job && r.job[id] === 'COMPLEX')) train[id] = v;
      return { ...r, train, reads: undefined };
    };
    const inRound = c && !l.rounds.includes(c as P4Round);
    return {
      groups: l.groups,
      care: l.care,
      priors: l.priors,
      policy: l.policy,
      policyVotes: l.policyVotes,
      judge: l.judge,
      myCost: s.players.some((p) => p.id === viewer) ? Math.max(0, l.costs[viewer] - p4Params(s).costCut) : undefined,
      rounds: l.rounds.map((r) => hideTrain(r)),
      current: inRound ? hideTrain(c!) : undefined,
      threshold: p4Params(s).threshold,
      meterShown: PLAY.L4.METER[s.difficulty],
      preview: s.phase.kind === 'DECIDE' && (s.phase.step === 'TRAIN' || s.phase.step === 'HIRE') && s.players.some((p) => p.id === viewer) ? p4Preview(s, viewer) : undefined,
      cardsOpen: cards,
    };
  },
};

/** Near-miss hooks (v2 6.1): each human's decisions this episode, and the alternatives to try. */
export function p4Plans(s: GameState, h: PlayerId): Record<string, unknown> {
  const l = st(s);
  const out: Record<string, unknown> = {};
  l.rounds.forEach((r, k) => {
    const round = k + 1;
    if (r.judge === h) out[`${round}:HIRE`] = { hires: r.chosen, gift: r.gifts[h] ?? null };
    else {
      out[`${round}:TRAIN`] = { train: r.train[h], gift: r.gifts[h] ?? null };
      out[`${round}:CLAIM`] = r.claims[h];
    }
  });
  if (l.policyVotes?.[h]) out[`${PLAY.L4.BASELINE_ROUNDS}:POLICY`] = l.policyVotes[h];
  return out;
}

export function p4Tries(_s: GameState, k: string, value: unknown): Array<{ value: unknown; from: unknown; to: unknown; kind: string }> {
  const stepId = k.split(':')[1];
  if (stepId === 'TRAIN') {
    const v = value as { train: boolean; gift: Gift4 | null };
    return [{ value: { ...v, train: !v.train }, from: v.train, to: !v.train, kind: 'TRAIN' }];
  }
  if (stepId === 'CLAIM') {
    const to = value === 'TRAINED' ? SILENT : 'TRAINED';
    return [{ value: to, from: value, to, kind: 'CLAIM' }];
  }
  if (stepId === 'POLICY') return POLICIES.filter((p) => p !== value).map((p) => ({ value: p, from: value, to: p, kind: 'POLICY' }));
  if (stepId === 'HIRE') {
    const v = value as { hires: Record<PlayerId, Job>; gift: Gift4 | null };
    return Object.keys(v.hires).map((w) => {
      const to = v.hires[w] === 'COMPLEX' ? 'SIMPLE' : 'COMPLEX';
      return { value: { ...v, hires: { ...v.hires, [w]: to } }, from: { worker: w, job: v.hires[w] }, to: { worker: w, job: to }, kind: 'HIRE' };
    });
  }
  return [];
}

export type { ValuesCard };
