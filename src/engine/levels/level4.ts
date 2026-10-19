// LEVEL 4: THE LABOR MARKET. Statistical discrimination with no prejudiced person in the room.
import { BOT, L4, EPS } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, playerOf, pluralityResolve, debriefRng } from '../core';
import { effortSharesFrom, mean, ownNet, roundScore } from '../scoring';
import { ceOfSamples, logitChoice, logitProbs } from '../bots/utility';
import { standalone, type Rng } from '../rng';
import type { GameState, Phase, PlayerId, RngState, ValuesCard } from '../types';
import type { LevelDefinition } from './types';

export type Group = 'CIRCLE' | 'SQUARE';
export type Policy = 'A' | 'B' | 'C' | 'D';
export const POLICIES: Policy[] = ['A', 'B', 'C', 'D'];
export type Job = 'SIMPLE' | 'COMPLEX';
export type Schedule = 'GREEDY' | 'FLEX';

export interface Priors {
  CIRCLE: number;
  SQUARE: number;
  POOL: number | null;
}

export interface L4Round {
  policy: Policy;
  priorsBefore: Priors;
  priorsAfter: Priors;
  costs: Record<PlayerId, number>;
  invest: Record<PlayerId, boolean>;
  pass: Record<PlayerId, boolean>;
  q: Record<PlayerId, number>;
  job: Record<PlayerId, Job>;
  quotaPicks: PlayerId[];
  schedule: Record<PlayerId, Schedule | null>;
  wage: Record<PlayerId, number>;
  chaos: Record<PlayerId, number>;
  W: Record<PlayerId, number>;
  skillRevealed: boolean;
}

export interface CfScenario {
  key: 'BASELINE' | 'EQUAL_PRIORS' | 'EQUAL_CARE' | 'BOTH';
  /** One example: the replay with this game's random draws. */
  gap: number;
  /** The same replay's gap round by round. */
  roundGaps: number[];
  /** Average over the replays with fresh luck, and its standard error. */
  avgGap: number;
  avgGapSe: number;
  piSquare: number[];
}

export interface Decomposition {
  stereotype: number;
  care: number;
  interaction: number;
  total: number;
}

export interface L4Debrief {
  groups: Record<PlayerId, Group>;
  care: Record<PlayerId, boolean>;
  rounds: L4Round[];
  meanByGroup: Array<{ CIRCLE: number; SQUARE: number; gap: number }>;
  gap: number;
  piPath: { CIRCLE: number[]; SQUARE: number[]; POOL: Array<number | null> };
  policy: Policy;
  policyVotes?: Record<PlayerId, Policy>;
  investRate: { CIRCLE: number; SQUARE: number };
  /** Round 1 training: the human's card's best choice (risk neutral apart from hardship) vs. theirs. */
  cardBest?: { best: boolean; chose: boolean };
  /** Per human (D-43, D-62). visibleState merges the viewer's entry into the fields above. */
  byHuman?: Record<PlayerId, { cardBest: { best: boolean; chose: boolean } }>;
  counterfactual?: {
    scenarios: CfScenario[];
    /** Every replay holds HireBot's rule at No Change (D-79). */
    policy: 'A';
    sameSeed: Decomposition;
    /** Mean over the replays; `se` is the standard error of each mean (paired differences, D-79). */
    average: Decomposition & { replays: number; se: Decomposition };
  };
}

export interface L4State {
  groups: Record<PlayerId, Group>;
  care: Record<PlayerId, boolean>;
  priors: Priors;
  policy: Policy;
  policyVotes?: Record<PlayerId, Policy>;
  policyCounts?: number[];
  policyTie?: boolean;
  costs: Record<PlayerId, number>;
  current?: Partial<L4Round>;
  rounds: L4Round[];
  startRng: RngState;
  debrief?: L4Debrief;
}

const st = (s: GameState) => s.levelState as L4State;

export function posterior(pi: number, pass: boolean): number {
  return pass
    ? (L4.PASS_IF_SKILLED * pi) / (L4.PASS_IF_SKILLED * pi + L4.PASS_IF_UNSKILLED * (1 - pi))
    : ((1 - L4.PASS_IF_SKILLED) * pi) / ((1 - L4.PASS_IF_SKILLED) * pi + (1 - L4.PASS_IF_UNSKILLED) * (1 - pi));
}

export function updatePrior(pi: number, rate: number): number {
  return (1 - L4.UPDATE_WEIGHT) * pi + L4.UPDATE_WEIGHT * rate;
}

export function chaosCost(policy: Policy): number {
  return policy === 'D' ? L4.CHAOS_COST_SUBSIDIZED : L4.CHAOS_COST;
}

function priorFor(priors: Priors, group: Group, policy: Policy): number {
  return policy === 'B' && priors.POOL !== null ? priors.POOL : priors[group];
}

export function bestSchedule(care: boolean, policy: Policy): Schedule {
  return L4.WAGE_GREEDY - (care ? chaosCost(policy) : 0) > L4.WAGE_FLEXIBLE ? 'GREEDY' : 'FLEX';
}

export function payFor(job: Job, sched: Schedule | null, care: boolean, policy: Policy): { wage: number; chaos: number } {
  if (job === 'SIMPLE') return { wage: L4.WAGE_SIMPLE, chaos: 0 };
  if (sched === 'GREEDY') return { wage: L4.WAGE_GREEDY, chaos: care ? chaosCost(policy) : 0 };
  return { wage: L4.WAGE_FLEXIBLE, chaos: 0 };
}

/**
 * Risk-neutral value of investing at a given cost, counting the hardship line: expected own money
 * minus hardship if you invest, minus the same if you do not (ignores the quota).
 */
export function investGain(pi: number, care: boolean, policy: Policy, cost: number): number {
  const qp = posterior(pi, true) >= L4.THRESHOLD - EPS;
  const qf = posterior(pi, false) >= L4.THRESHOLD - EPS;
  const pS = L4.PASS_IF_SKILLED * (qp ? 1 : 0) + (1 - L4.PASS_IF_SKILLED) * (qf ? 1 : 0);
  const pU = L4.PASS_IF_UNSKILLED * (qp ? 1 : 0) + (1 - L4.PASS_IF_UNSKILLED) * (qf ? 1 : 0);
  const best = Math.max(L4.WAGE_FLEXIBLE, L4.WAGE_GREEDY - (care ? chaosCost(policy) : 0));
  const value = (pComplex: number, c: number) => pComplex * ownNet(best - c) + (1 - pComplex) * ownNet(L4.WAGE_SIMPLE - c);
  return value(pS, cost) - value(pU, 0);
}

interface World {
  groups: Group[];
  care: boolean[];
  priors: Priors;
  policy: Policy;
}

/** Assign jobs from signals; returns job per worker and quota picks. */
export function assignJobs(
  world: World,
  pass: readonly boolean[],
  tieBreak: () => number,
): { q: number[]; job: Job[]; quota: number[] } {
  const q = pass.map((p, i) => posterior(priorFor(world.priors, world.groups[i], world.policy), p));
  const job: Job[] = q.map((x) => (x >= L4.THRESHOLD - EPS ? 'COMPLEX' : 'SIMPLE'));
  const quota: number[] = [];
  // One tie-break draw per group every round, used or not (D-79), so runs under different rules or
  // beliefs stay on the same random stream.
  const u = { CIRCLE: tieBreak(), SQUARE: tieBreak() };
  if (world.policy === 'C') {
    for (const g of ['CIRCLE', 'SQUARE'] as Group[]) {
      const members = world.groups.map((x, i) => (x === g ? i : -1)).filter((i) => i >= 0);
      if (!members.length || members.some((i) => job[i] === 'COMPLEX')) continue;
      const maxQ = Math.max(...members.map((i) => q[i]));
      const top = members.filter((i) => Math.abs(q[i] - maxQ) < 1e-12);
      const pick = top[Math.floor(u[g] * top.length)];
      job[pick] = 'COMPLEX';
      quota.push(pick);
    }
  }
  return { q, job, quota };
}

export function nextPriors(priors: Priors, groups: readonly Group[], skilled: readonly boolean[], policy: Policy): Priors {
  const out = { ...priors };
  if (policy === 'B' && priors.POOL !== null) {
    out.POOL = updatePrior(priors.POOL, skilled.filter(Boolean).length / skilled.length);
    return out;
  }
  for (const g of ['CIRCLE', 'SQUARE'] as Group[]) {
    const members = groups.map((x, i) => (x === g ? i : -1)).filter((i) => i >= 0);
    if (!members.length) continue;
    out[g] = updatePrior(priors[g], members.filter((i) => skilled[i]).length / members.length);
  }
  return out;
}

/** One simulated round in a bot's head. Everyone except `i` follows the risk-neutral rule. */
function simulateRound(world: World, i: number, myInvest: boolean | null, myCost: number | null, rng: Rng) {
  const n = world.groups.length;
  const costs = world.groups.map((_, j) => (j === i && myCost !== null ? myCost : rng.pick(L4.COST_OPTIONS)));
  const invest = world.groups.map((g, j) =>
    j === i && myInvest !== null ? myInvest : investGain(priorFor(world.priors, g, world.policy), world.care[j], world.policy, costs[j]) > 0,
  );
  const pass = invest.map((v) => rng.next() < (v ? L4.PASS_IF_SKILLED : L4.PASS_IF_UNSKILLED));
  const { job } = assignJobs(world, pass, () => rng.next());
  const W = job.map((jb, j) => {
    const { wage, chaos } = payFor(jb, bestSchedule(world.care[j], world.policy), world.care[j], world.policy);
    return wage - chaos - (invest[j] ? costs[j] : 0);
  });
  void n;
  return { W, invest, effortShares: effortSharesFrom(invest.map((v) => (v ? 1 : 0))) };
}

function worldOf(s: GameState, policy = st(s).policy, priors = st(s).priors): World {
  const pids = ids(s);
  return { groups: pids.map((id) => st(s).groups[id]), care: pids.map((id) => st(s).care[id]), priors, policy };
}

function investCE(
  s: GameState,
  botId: PlayerId,
  card: ValuesCard,
  rho: number,
  samples: number,
  at?: { world: World; cost: number; rng: Rng },
): number[] {
  const i = idx(s, botId);
  const world = at?.world ?? worldOf(s);
  const myCost = at?.cost ?? st(s).costs[botId];
  const rng = at?.rng ?? botRng(s);
  const res: number[][] = [[], []];
  for (let m = 0; m < samples; m++) {
    const state = rng.next();
    [false, true].forEach((inv, k) => {
      // Common random numbers across both options.
      const sub = seededSub(state);
      const { W, effortShares } = simulateRound(world, i, inv, myCost, sub);
      res[k].push(roundScore(card, W, i, effortShares));
    });
  }
  return res.map((r) => ceOfSamples(r, rho));
}

function seededSub(u: number): Rng {
  return standalone(Math.floor(u * 4294967296));
}

/** CE for each policy over the two remaining rounds, everyone following the risk-neutral rule. */
function policyCE(s: GameState, actorId: PlayerId, card: ValuesCard, rho: number, samples: number, rng: Rng): number[] {
  const i = idx(s, actorId);
  return POLICIES.map((policy) => {
    const scores: number[] = [];
    for (let m = 0; m < samples; m++) {
      let priors: Priors = { ...st(s).priors };
      if (policy === 'B') priors.POOL = pooledPrior(s, priors);
      let total = 0;
      for (let r = 0; r < L4.ROUNDS - L4.BASELINE_ROUNDS; r++) {
        const world = worldOf(s, policy, priors);
        const { W, invest, effortShares } = simulateRound(world, i, null, null, rng);
        total += roundScore(card, W, i, effortShares);
        priors = nextPriors(priors, world.groups, invest, policy);
      }
      scores.push(total / (L4.ROUNDS - L4.BASELINE_ROUNDS));
    }
    return ceOfSamples(scores, rho);
  });
}

function pooledPrior(s: GameState, priors: Priors): number {
  const groups = Object.values(st(s).groups);
  const nc = groups.filter((g) => g === 'CIRCLE').length;
  return (nc * priors.CIRCLE + (groups.length - nc) * priors.SQUARE) / groups.length;
}

export function groupGap(W: Record<PlayerId, number>, groups: Record<PlayerId, Group>) {
  const c = Object.keys(W).filter((id) => groups[id] === 'CIRCLE');
  const q = Object.keys(W).filter((id) => groups[id] === 'SQUARE');
  const mc = mean(c.map((id) => W[id]));
  const ms = mean(q.map((id) => W[id]));
  return { CIRCLE: mc, SQUARE: ms, gap: mc - ms };
}

export const level4: LevelDefinition = {
  id: 4,
  rounds: L4.ROUNDS,
  init(s) {
    const startRng = { ...s.rng };
    const g = gameRng(s);
    const pids = ids(s);
    const n = pids.length;
    const order = g.shuffle(pids);
    const nCircle = n === 3 ? (g.next() < 0.5 ? 2 : 1) : n / 2;
    const groups: Record<PlayerId, Group> = {};
    order.forEach((id, k) => (groups[id] = k < nCircle ? 'CIRCLE' : 'SQUARE'));
    const care: Record<PlayerId, boolean> = {};
    const cf = s.cf ?? {};
    for (const id of pids) {
      const u = g.next();
      const p = groups[id] === 'SQUARE' ? cf.careSquare ?? L4.CARE_PROB_SQUARE : cf.careCircle ?? L4.CARE_PROB_CIRCLE;
      care[id] = u < p;
      const pl = playerOf(s, id);
      pl.publicInfo.group = groups[id];
      pl.publicInfo.care = care[id];
    }
    s.levelState = {
      groups,
      care,
      priors: { CIRCLE: cf.priorCircle ?? L4.PRIOR_CIRCLE, SQUARE: cf.priorSquare ?? L4.PRIOR_SQUARE, POOL: null },
      policy: 'A',
      costs: {},
      rounds: [],
      startRng,
    } satisfies L4State;
  },
  phases() {
    const out: Phase[] = [];
    for (let r = 1; r <= L4.ROUNDS; r++) {
      out.push(
        { kind: 'BRIEFING', round: r },
        { kind: 'TALK', step: 'ROUND', round: r },
        { kind: 'DECIDE', step: 'INVEST', round: r },
        { kind: 'REVEAL', step: 'ASSIGN', round: r },
        { kind: 'DECIDE', step: 'SCHEDULE', round: r },
        { kind: 'REVEAL', step: 'PAY', round: r },
        { kind: 'ROUND_SUMMARY', round: r },
      );
      if (r === L4.BASELINE_ROUNDS)
        out.push(
          { kind: 'TALK', step: 'POLICY', round: r },
          { kind: 'DECIDE', step: 'POLICY', round: r },
          { kind: 'REVEAL', step: 'POLICY', round: r },
        );
    }
    return out;
  },
  onEnter(s, phase) {
    if (phase.kind === 'BRIEFING') {
      const g = gameRng(s);
      const l = st(s);
      l.costs = {};
      for (const p of s.players) {
        l.costs[p.id] = g.pick(L4.COST_OPTIONS);
        p.privateInfo.cost = l.costs[p.id];
      }
      l.current = undefined;
    }
  },
  deciders(s, step) {
    if (step === 'SCHEDULE') {
      const c = st(s).current;
      if (!c?.job) return [];
      return ids(s).filter((id) => c.job![id] === 'COMPLEX');
    }
    return ids(s);
  },
  validate(_s, step, _pid, d) {
    if (step === 'INVEST') return typeof d === 'boolean' ? d : null;
    if (step === 'SCHEDULE') return d === 'GREEDY' || d === 'FLEX' ? d : null;
    if (step === 'POLICY') return POLICIES.includes(d as Policy) ? d : null;
    return null;
  },
  botDecide(s, botId, step) {
    const { lambda, rho } = botParams(s, botId);
    const me = playerOf(s, botId);
    const rng = botRng(s);
    if (step === 'INVEST') {
      const ce = investCE(s, botId, me.values, rho, s.botSamples);
      return logitChoice(ce, lambda, rng) === 1;
    }
    if (step === 'SCHEDULE') {
      const l = st(s);
      const pids = ids(s);
      const i = idx(s, botId);
      const c = l.current!;
      const baseW = pids.map((id) => {
        const jb = c.job![id];
        const { wage, chaos } = payFor(jb, bestSchedule(l.care[id], l.policy), l.care[id], l.policy);
        return wage - chaos - (c.invest![id] ? l.costs[id] : 0);
      });
      const es = effortSharesFrom(pids.map((id) => (c.invest![id] ? 1 : 0)));
      const opts: Schedule[] = ['GREEDY', 'FLEX'];
      const ce = opts.map((sc) => {
        const W = baseW.slice();
        const { wage, chaos } = payFor('COMPLEX', sc, l.care[botId], l.policy);
        W[i] = wage - chaos - (c.invest![botId] ? l.costs[botId] : 0);
        return roundScore(me.values, W, i, es);
      });
      return opts[logitChoice(ce, lambda, rng)];
    }
    const ce = policyCE(s, botId, me.values, rho, Math.max(30, Math.round(s.botSamples / 3)), rng);
    return POLICIES[logitChoice(ce, lambda, rng)];
  },
  resolve(s, step, decisions) {
    const l = st(s);
    const pids = ids(s);
    const g = gameRng(s);
    const rec = <X>(xs: X[]) => Object.fromEntries(pids.map((id, i) => [id, xs[i]])) as Record<PlayerId, X>;
    if (step === 'POLICY') {
      const votes = pids.map((id) => POLICIES.indexOf(decisions[id] as Policy));
      const { winner, tie, counts } = pluralityResolve(votes, POLICIES.length, g);
      l.policyVotes = decisions as Record<PlayerId, Policy>;
      l.policyCounts = counts;
      l.policyTie = tie;
      l.policy = s.cf?.fixedPolicy ?? POLICIES[winner];
      if (l.policy === 'B') l.priors.POOL = pooledPrior(s, l.priors);
      return;
    }
    if (step === 'INVEST') {
      const invest = pids.map((id) => decisions[id] as boolean);
      const pass = invest.map((v) => g.next() < (v ? L4.PASS_IF_SKILLED : L4.PASS_IF_UNSKILLED));
      const { q, job, quota } = assignJobs(worldOf(s), pass, () => g.next());
      l.current = {
        policy: l.policy,
        priorsBefore: { ...l.priors },
        costs: { ...l.costs },
        invest: rec(invest),
        pass: rec(pass),
        q: rec(q),
        job: rec(job),
        quotaPicks: quota.map((i) => pids[i]),
        skillRevealed: false,
      };
      return;
    }
    // SCHEDULE: pay, finish the round, update the employer's beliefs.
    const c = l.current!;
    const schedule = pids.map((id) => (c.job![id] === 'COMPLEX' ? ((decisions[id] as Schedule) ?? 'FLEX') : null));
    const pay = pids.map((id, i) => payFor(c.job![id], schedule[i], l.care[id], l.policy));
    const W = pids.map((id, i) => pay[i].wage - pay[i].chaos - (c.invest![id] ? l.costs[id] : 0));
    const skilled = pids.map((id) => c.invest![id]);
    const groupsArr = pids.map((id) => l.groups[id]);
    l.priors = nextPriors(l.priors, groupsArr, skilled, l.policy);
    const round: L4Round = {
      ...(c as L4Round),
      schedule: rec(schedule),
      wage: rec(pay.map((p) => p.wage)),
      chaos: rec(pay.map((p) => p.chaos)),
      W: rec(W),
      priorsAfter: { ...l.priors },
      skillRevealed: true,
    };
    l.rounds.push(round);
    l.current = round;
    const squareComplex = pids.some((id) => l.groups[id] === 'SQUARE' && c.job![id] === 'COMPLEX');
    let key = 'l4.noSquare';
    if (squareComplex) key = 'l4.squareComplex';
    else if (l.policy !== 'A') key = `l4.policy_${l.policy}`;
    const delta = Math.abs(round.priorsAfter.SQUARE - round.priorsBefore.SQUARE);
    finishRound(
      s,
      W,
      effortSharesFrom(skilled.map((v) => (v ? 1 : 0))),
      headline(s, key, { delta: delta.toFixed(2), pi: round.priorsAfter.SQUARE.toFixed(2) }),
    );
  },
  talkMenu(_s, phase) {
    if (phase.step === 'POLICY') return { support: [...POLICIES], oppose: [...POLICIES], promise: [] };
    return { support: [], oppose: [], promise: [] };
  },
  checkStep(_s, phase, msg) {
    return phase.step === 'POLICY' && msg.type === 'SUPPORT' ? 'POLICY' : undefined;
  },
  messageKept(_s, _step, msg, d) {
    return msg.type === 'SUPPORT' ? msg.option === d : true;
  },
  botIntent(s, botId, phase) {
    if (phase.step !== 'POLICY') return {};
    const { rho } = botParams(s, botId);
    const ce = policyCE(s, botId, playerOf(s, botId).values, rho, Math.max(20, Math.round(s.botSamples / 6)), botRng(s));
    const order = POLICIES.map((p, k) => [p, ce[k]] as const).sort((a, b) => b[1] - a[1]);
    return { support: order[0][0], decoy: order[1][0] };
  },
  observable: ['POLICY'],
  likelihood(s, _observer, actor, _step, decision, card) {
    const ce = policyCE(s, actor, card, BOT.BELIEF_RHO, Math.round(BOT.BELIEF_MC_SAMPLES / 2), botRng(s));
    return logitProbs(ce, BOT.BELIEF_LAMBDA)[POLICIES.indexOf(decision as Policy)] ?? 0;
  },
  debrief(s) {
    const l = st(s);
    const pids = ids(s);
    const meanByGroup = l.rounds.map((r) => groupGap(r.W, l.groups));
    const rate = (g: Group) => {
      const xs = l.rounds.flatMap((r) => pids.filter((id) => l.groups[id] === g).map((id) => (r.invest[id] ? 1 : 0)));
      return mean(xs);
    };
    const byHuman: NonNullable<L4Debrief['byHuman']> = {};
    const r1 = l.rounds[0];
    for (const h of s.players.filter((p) => p.isHuman)) {
      // Each human's line uses a fresh copy of the same private stream, so the order of humans does not matter.
      const world = worldOf(s, r1.policy, r1.priorsBefore);
      const ce = investCE(s, h.id, h.values, 0, s.botSamples, { world, cost: r1.costs[h.id], rng: debriefRng(s, 'l4') });
      byHuman[h.id] = { cardBest: { best: ce[1] > ce[0], chose: r1.invest[h.id] } };
    }
    const d: L4Debrief = {
      groups: { ...l.groups },
      care: { ...l.care },
      rounds: l.rounds,
      meanByGroup,
      gap: mean(meanByGroup.map((m) => m.gap)),
      piPath: {
        CIRCLE: [l.rounds[0]?.priorsBefore.CIRCLE ?? l.priors.CIRCLE, ...l.rounds.map((r) => r.priorsAfter.CIRCLE)],
        SQUARE: [l.rounds[0]?.priorsBefore.SQUARE ?? l.priors.SQUARE, ...l.rounds.map((r) => r.priorsAfter.SQUARE)],
        POOL: [null, ...l.rounds.map((r) => r.priorsAfter.POOL)],
      },
      policy: l.policy,
      policyVotes: l.policyVotes,
      byHuman,
      investRate: { CIRCLE: rate('CIRCLE'), SQUARE: rate('SQUARE') },
    };
    l.debrief = d;
    return d;
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    const c = l.current;
    const hideCosts = (r: Partial<L4Round>) => ({
      ...r,
      costs: revealPrivate ? r.costs : r.costs ? { [viewer]: r.costs[viewer] } : undefined,
      invest: r.skillRevealed || revealPrivate ? r.invest : r.invest ? { [viewer]: r.invest[viewer] } : undefined,
    });
    return {
      groups: l.groups,
      care: l.care,
      priors: l.priors,
      policy: l.policy,
      policyVotes: l.policyVotes,
      policyCounts: l.policyCounts,
      policyTie: l.policyTie,
      myCost: l.costs[viewer],
      current: c ? hideCosts(c) : undefined,
      rounds: l.rounds.map(hideCosts),
      debrief: revealPrivate ? l.debrief : undefined,
    };
  },
};
