// LEVEL 2: LUCK VS. EFFORT. Vote on a tax, choose effort, guess how much was luck.
import { BOT, L2 } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, lowerMedian, playerOf, debriefRng } from '../core';
import { effortSharesFrom, mean, roundScore } from '../scoring';
import { leakyRevenue, sum } from '../tax';
import { ceOfSamples, logitChoice, logitProbs, argmax } from '../bots/utility';
import type { Rng } from '../rng';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import type { LevelDefinition } from './types';

export interface L2Round {
  tVotes: Record<PlayerId, number>;
  t: number;
  effort: Record<PlayerId, number>;
  eps: Record<PlayerId, number>;
  y: Record<PlayerId, number>;
  W: Record<PlayerId, number>;
  revenue: number;
  leaked: number;
  /** The viewer's poll target and answer (visibleState fills these from the per-human records). */
  pollTarget?: PlayerId;
  poll?: { target: PlayerId; answer: number; truth: number };
  /** Per human: the other player with the highest gross income this round. */
  pollTargets?: Record<PlayerId, PlayerId>;
  /** Per human answers to the luck poll. Private to each human until the debrief. */
  polls?: Record<PlayerId, { target: PlayerId; answer: number; truth: number }>;
}

export interface BonusCitizen {
  id: string;
  name: string;
  talent: number;
  effort: number;
  luck: number;
  y: number;
}

export type FairnessIdeal = 'EGALITARIAN' | 'LIBERTARIAN' | 'MERITOCRATIC' | 'LIBERAL_EGALITARIAN';

export interface L2Bonus {
  a: BonusCitizen;
  b: BonusCitizen;
  shareToA?: number;
  ideals?: Record<FairnessIdeal, number>;
  classification?: FairnessIdeal[];
}

export interface L2Debrief {
  talents: Record<PlayerId, number>;
  rounds: L2Round[];
  /** Shares of income differences from talent and work vs. luck; each in [0, 1], summing to 1 (D-72). */
  variance: { talentEffort: number; luck: number };
  eStar: Array<Record<PlayerId, number>>;
  polls: Array<{ round: number; target: PlayerId; answer: number; truth: number }>;
  distortion: { realizedW: number; counterfactualW: number; realizedGross: number; counterfactualGross: number };
  bonus?: L2Bonus;
  selfishT: Record<PlayerId, number>;
  predictedT: number;
  humanMeanLuckBelief?: number;
  humanMeanTaxVote?: number;
  /** The human's card's best round-1 tax vote (risk neutral apart from the hardship line) vs. their vote. */
  cardBest?: { best: number; chose: number };
  /** Per human (D-43, D-62). visibleState merges the viewer's entry into the fields above. */
  byHuman?: Record<
    PlayerId,
    Pick<L2Debrief, 'polls' | 'bonus' | 'humanMeanLuckBelief' | 'humanMeanTaxVote' | 'cardBest'> & { rounds: L2Round[] }
  >;
}

export interface L2State {
  talents: Record<PlayerId, number>;
  rounds: L2Round[];
  current: { tVotes?: Record<PlayerId, number>; t?: number };
  /** Each human's Bonus Pot pair and split. */
  bonusBy?: Record<PlayerId, L2Bonus>;
  debrief?: L2Debrief;
}

function st(s: GameState): L2State {
  return s.levelState as L2State;
}

/** Exact selfish best response including own rebate share (Section 4, Level 2). */
export function bestEffort(t: number, a: number, n: number, kappa = L2.KAPPA): number {
  const e = 5 * a * (1 - t + (t * (1 - kappa * t)) / n);
  return Math.max(0, Math.min(L2.EFFORT_MAX, Math.round(e)));
}

/** Simple best response ignoring the rebate: e* = 5 (1 - t) a. */
export function bestEffortSimple(t: number, a: number): number {
  return Math.max(0, Math.min(L2.EFFORT_MAX, Math.round(5 * (1 - t) * a)));
}

export function grossIncome(a: number, e: number, eps: number): number {
  return L2.BASE_INCOME + L2.TALENT_MULT * a * e + eps;
}

export function effortCost(e: number): number {
  return L2.EFFORT_COST * e * e;
}

export function wealthL2(y: readonly number[], effort: readonly number[], t: number): number[] {
  const n = y.length;
  const R = leakyRevenue(t, sum(y), L2.KAPPA);
  return y.map((yi, i) => (1 - t) * yi + R / n - effortCost(effort[i]));
}

/** Expected round score samples for `me` (index i) under each tax option, with talents of others unknown. */
function taxScores(
  n: number,
  i: number,
  myTalent: number,
  card: ValuesCard,
  rho: number,
  rng: Rng,
  samples: number,
  knownTalentsExclude: number[] = [myTalent],
): number[] {
  const pool = L2.TALENT_DECK.slice();
  for (const k of knownTalentsExclude) {
    const at = pool.indexOf(k);
    if (at >= 0) pool.splice(at, 1);
  }
  const scores: number[][] = L2.TAX_OPTIONS.map(() => []);
  for (let m = 0; m < samples; m++) {
    const others = rng.shuffle(pool).slice(0, n - 1);
    const talents = others.slice();
    talents.splice(i, 0, myTalent);
    const eps = talents.map(() => rng.pick(L2.LUCK_VALUES));
    L2.TAX_OPTIONS.forEach((t, k) => {
      const e = talents.map((a) => bestEffort(t, a, n));
      const y = talents.map((a, j) => grossIncome(a, e[j], eps[j]));
      const W = wealthL2(y, e, t);
      scores[k].push(roundScore(card, W, i, effortSharesFrom(e)));
    });
  }
  return scores.map((sc) => ceOfSamples(sc, rho));
}

function taxCE(s: GameState, botId: PlayerId, rho = botParams(s, botId).rho): number[] {
  const me = playerOf(s, botId);
  return taxScores(s.players.length, idx(s, botId), st(s).talents[botId], me.values, rho, botRng(s), s.botSamples);
}

/** Selfish risk-neutral preferred tax given all talents known (Meltzer-Richard benchmark). */
function selfishPreferredT(talents: number[], i: number): number {
  const n = talents.length;
  const meanEps = mean(L2.LUCK_VALUES);
  let best = 0;
  let bestW = -Infinity;
  for (const t of L2.TAX_OPTIONS) {
    const e = talents.map((a) => bestEffort(t, a, n));
    const y = talents.map((a, j) => grossIncome(a, e[j], meanEps));
    const W = wealthL2(y, e, t);
    if (W[i] > bestW + 1e-9) {
      bestW = W[i];
      best = t;
    }
  }
  return best;
}

function makeBonusCitizen(s: GameState, pid: PlayerId, r: L2Round): BonusCitizen {
  return {
    id: pid,
    name: playerOf(s, pid).name,
    talent: st(s).talents[pid],
    effort: r.effort[pid],
    luck: r.eps[pid],
    y: r.y[pid],
  };
}

export function fairnessIdeals(a: BonusCitizen, b: BonusCitizen): Record<FairnessIdeal, number> {
  const safe = (x: number, y: number) => (x + y > 0 ? x / (x + y) : 0.5);
  return {
    EGALITARIAN: 0.5,
    LIBERTARIAN: safe(a.y, b.y),
    MERITOCRATIC: safe(a.talent * a.effort, b.talent * b.effort),
    LIBERAL_EGALITARIAN: safe(a.effort, b.effort),
  };
}

export function classifyFairness(share: number, ideals: Record<FairnessIdeal, number>): FairnessIdeal[] {
  const entries = Object.entries(ideals) as Array<[FairnessIdeal, number]>;
  const d = entries.map(([k, v]) => [k, Math.abs(share - v)] as const);
  const min = Math.min(...d.map((x) => x[1]));
  return d.filter((x) => x[1] <= min + L2.FAIRNESS_TIE + 1e-9).map((x) => x[0]);
}

/** The Bonus Pot pair one human splits coins between: two other citizens, shown in full (D-19). */
function drawBonusPair(s: GameState, hid: PlayerId): L2Bonus {
  const last = st(s).rounds[st(s).rounds.length - 1];
  const g = gameRng(s);
  const others = g.shuffle(ids(s).filter((id) => id !== hid));
  const a = makeBonusCitizen(s, others[0], last);
  if (others.length >= 2) return { a, b: makeBonusCitizen(s, others[1], last) };
  // Two-player game: pair the only other player with an archival citizen (see DECISIONS.md).
  const used = Object.values(st(s).talents);
  const pool = L2.TALENT_DECK.filter((x) => !used.includes(x));
  const talent = g.pick(pool);
  const effort = bestEffort(last.t, talent, s.players.length);
  const luck = g.pick(L2.LUCK_VALUES);
  return { a, b: { id: 'archival', name: 'Citizen #4471 (Archival)', talent, effort, luck, y: grossIncome(talent, effort, luck) } };
}

function variance(xs: number[]): number {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

/**
 * Where income differences came from (D-72). Gross income is base + talent-and-work + luck, and luck is
 * drawn independently after effort is chosen, so the two parts have zero covariance by construction; the
 * sample covariance is only noise and is left out. Each share is that part's variance over the sum of the
 * two, so both lie in [0, 1] and add to 1. With no variation at all the split is even.
 */
export function varianceShares(talentWork: readonly number[], luck: readonly number[]): { talentEffort: number; luck: number } {
  const vx = variance(talentWork.slice());
  const ve = variance(luck.slice());
  const total = vx + ve;
  if (total <= 0) return { talentEffort: 0.5, luck: 0.5 };
  return { talentEffort: vx / total, luck: ve / total };
}

/** A round as one human sees it: their own poll target and answer, nobody else's. */
function personalRound(r: L2Round, pid: PlayerId): L2Round {
  const { pollTargets, polls, ...rest } = r;
  return { ...rest, pollTarget: pollTargets?.[pid], poll: polls?.[pid] };
}

export const level2: LevelDefinition = {
  id: 2,
  rounds: L2.ROUNDS,
  init(s) {
    const g = gameRng(s);
    const deck = g.shuffle(L2.TALENT_DECK);
    const talents: Record<PlayerId, number> = {};
    s.players.forEach((p, i) => {
      talents[p.id] = deck[i];
      p.privateInfo.talent = deck[i];
    });
    s.levelState = { talents, rounds: [], current: {} } satisfies L2State;
  },
  phases() {
    const out: Phase[] = [];
    for (let r = 1; r <= L2.ROUNDS; r++) {
      out.push(
        { kind: 'BRIEFING', round: r },
        { kind: 'TALK', step: 'TAX', round: r },
        { kind: 'DECIDE', step: 'TAX', round: r },
        { kind: 'REVEAL', step: 'TAX', round: r },
        { kind: 'DECIDE', step: 'EFFORT', round: r },
        { kind: 'REVEAL', step: 'INCOME', round: r },
      );
      if (r <= L2.POLL_ROUNDS) out.push({ kind: 'DECIDE', step: 'POLL', round: r });
      out.push({ kind: 'ROUND_SUMMARY', round: r });
    }
    out.push({ kind: 'DECIDE', step: 'BONUS', round: L2.ROUNDS }, { kind: 'REVEAL', step: 'BONUS', round: L2.ROUNDS });
    return out;
  },
  onEnter(s, phase) {
    if (phase.kind === 'BRIEFING') st(s).current = {};
    if (phase.kind === 'DECIDE' && phase.step === 'BONUS') {
      // One pair per human, drawn in seat order (solo play draws exactly as before).
      const bonusBy: Record<PlayerId, L2Bonus> = {};
      for (const h of s.players.filter((p) => p.isHuman)) bonusBy[h.id] = drawBonusPair(s, h.id);
      if (Object.keys(bonusBy).length) st(s).bonusBy = bonusBy;
    }
  },
  deciders(s, step) {
    if (step === 'POLL' || step === 'BONUS') {
      const humans = s.players.filter((p) => p.isHuman).map((p) => p.id);
      if (step === 'BONUS') return humans.filter((id) => !!st(s).bonusBy?.[id]);
      return humans;
    }
    return ids(s);
  },
  validate(_s, step, _pid, d) {
    if (step === 'TAX') return L2.TAX_OPTIONS.includes(d as number) ? d : null;
    if (step === 'EFFORT') return Number.isInteger(d) && (d as number) >= 0 && (d as number) <= L2.EFFORT_MAX ? d : null;
    if (step === 'POLL') return typeof d === 'number' && d >= 0 && d <= 100 ? d : null;
    if (step === 'BONUS') return Number.isInteger(d) && (d as number) >= 0 && (d as number) <= L2.BONUS_POT ? d : null;
    return null;
  },
  botDecide(s, botId, step) {
    const { lambda } = botParams(s, botId);
    const rng = botRng(s);
    if (step === 'TAX') return L2.TAX_OPTIONS[logitChoice(taxCE(s, botId), lambda, rng)];
    if (step === 'EFFORT') {
      const t = st(s).current.t!;
      let e = bestEffort(t, st(s).talents[botId], s.players.length);
      if (rng.next() < 1 / (1 + lambda)) e += rng.next() < 0.5 ? -1 : 1;
      return Math.max(0, Math.min(L2.EFFORT_MAX, e));
    }
    return null;
  },
  resolve(s, step, decisions) {
    const l = st(s);
    const pids = ids(s);
    if (step === 'TAX') {
      l.current.tVotes = decisions as Record<PlayerId, number>;
      l.current.t = lowerMedian(pids.map((id) => decisions[id] as number));
      return;
    }
    if (step === 'EFFORT') {
      const g = gameRng(s);
      const t = l.current.t!;
      const e = pids.map((id) => decisions[id] as number);
      const eps = pids.map(() => g.pick(L2.LUCK_VALUES));
      const y = pids.map((id, i) => grossIncome(l.talents[id], e[i], eps[i]));
      const W = wealthL2(y, e, t);
      const Y = sum(y);
      const rec = (xs: number[]) => Object.fromEntries(pids.map((id, i) => [id, xs[i]]));
      const round: L2Round = {
        tVotes: l.current.tVotes!,
        t,
        effort: rec(e),
        eps: rec(eps),
        y: rec(y),
        W: rec(W),
        revenue: leakyRevenue(t, Y, L2.KAPPA),
        leaked: t * Y * L2.KAPPA * t,
      };
      const humans = s.players.filter((p) => p.isHuman).map((p) => p.id);
      if (humans.length) {
        round.pollTargets = {};
        for (const h of humans) round.pollTargets[h] = pids.filter((id) => id !== h).sort((a, b) => round.y[b] - round.y[a])[0];
      }
      l.rounds.push(round);
      const richest = pids.slice().sort((a, b) => round.y[b] - round.y[a])[0];
      let key = 'l2.normal';
      if (t >= 0.6) key = 'l2.highTax';
      else if (round.eps[richest] === Math.max(...L2.LUCK_VALUES)) key = 'l2.lucky';
      else if (t === 0) key = 'l2.zeroTax';
      finishRound(s, W, effortSharesFrom(e), headline(s, key, { name: playerOf(s, richest).name, t: Math.round(t * 100) }));
      return;
    }
    if (step === 'POLL') {
      const r = l.rounds[l.rounds.length - 1];
      r.polls = {};
      for (const [pid, ans] of Object.entries(decisions)) {
        const target = r.pollTargets![pid];
        const truth = Math.max(0, Math.min(1, r.eps[target] / r.y[target]));
        r.polls[pid] = { target, answer: (ans as number) / 100, truth };
      }
      return;
    }
    if (step === 'BONUS') {
      for (const [pid, coins] of Object.entries(decisions)) {
        const b = l.bonusBy?.[pid];
        if (!b) continue;
        const share = (coins as number) / L2.BONUS_POT;
        b.shareToA = share;
        b.ideals = fairnessIdeals(b.a, b.b);
        b.classification = classifyFairness(share, b.ideals);
      }
    }
  },
  talkMenu() {
    const opts = L2.TAX_OPTIONS.map((t) => `T${Math.round(t * 100)}`);
    return { support: opts, oppose: [], promise: [] };
  },
  checkStep(_s, _p, msg) {
    return msg.type === 'SUPPORT' ? 'TAX' : undefined;
  },
  messageKept(_s, _step, msg, d) {
    return msg.type === 'SUPPORT' ? msg.option === `T${Math.round((d as number) * 100)}` : true;
  },
  botIntent(s, botId) {
    const U = taxCE(s, botId);
    const order = L2.TAX_OPTIONS.map((t, i) => [t, U[i]] as const).sort((a, b) => b[1] - a[1]);
    return { support: `T${Math.round(order[0][0] * 100)}`, decoy: `T${Math.round(order[1][0] * 100)}` };
  },
  observable: ['TAX'],
  likelihood(s, observer, actor, _step, decision, card) {
    const n = s.players.length;
    const rng = botRng(s);
    const pool = L2.TALENT_DECK.filter((x) => x !== st(s).talents[observer]);
    // Marginalize over the actor's unknown talent.
    const probs = L2.TAX_OPTIONS.map(() => 0);
    for (const a of pool) {
      const ce = taxScores(n, idx(s, actor), a, card, BOT.BELIEF_RHO, rng, Math.max(4, Math.round(BOT.BELIEF_MC_SAMPLES / pool.length)), [a, st(s).talents[observer]]);
      const p = logitProbs(ce, BOT.BELIEF_LAMBDA);
      p.forEach((v, k) => (probs[k] += v / pool.length));
    }
    return probs[L2.TAX_OPTIONS.indexOf(decision as number)] ?? 0;
  },
  debrief(s) {
    const l = st(s);
    const pids = ids(s);
    const n = pids.length;
    const X: number[] = [];
    const E: number[] = [];
    for (const r of l.rounds)
      for (const id of pids) {
        X.push(L2.TALENT_MULT * l.talents[id] * r.effort[id]);
        E.push(r.eps[id]);
      }
    const eStar = l.rounds.map((r) => Object.fromEntries(pids.map((id) => [id, bestEffort(r.t, l.talents[id], n)])));
    let realizedW = 0;
    let cfW = 0;
    let realizedGross = 0;
    let cfGross = 0;
    const talents = pids.map((id) => l.talents[id]);
    for (const r of l.rounds) {
      realizedW += sum(pids.map((id) => r.W[id]));
      realizedGross += sum(pids.map((id) => r.y[id]));
      const e0 = talents.map((a) => bestEffort(0, a, n));
      const y0 = talents.map((a, i) => grossIncome(a, e0[i], r.eps[pids[i]]));
      cfW += sum(wealthL2(y0, e0, 0));
      cfGross += sum(y0);
    }
    const selfishT = Object.fromEntries(pids.map((id, i) => [id, selfishPreferredT(talents, i)]));
    const byHuman: NonNullable<L2Debrief['byHuman']> = {};
    for (const h of s.players.filter((p) => p.isHuman)) {
      const polls = l.rounds
        .map((r, i) => (r.polls?.[h.id] ? { round: i + 1, ...r.polls[h.id] } : null))
        .filter((x): x is NonNullable<typeof x> => !!x);
      byHuman[h.id] = {
        polls,
        rounds: l.rounds.map((r) => personalRound(r, h.id)),
        bonus: l.bonusBy?.[h.id],
        humanMeanLuckBelief: polls.length ? mean(polls.map((p) => p.answer)) : undefined,
        humanMeanTaxVote: mean(l.rounds.map((r) => r.tVotes[h.id])),
        cardBest: {
          best: L2.TAX_OPTIONS[argmax(taxScores(n, idx(s, h.id), l.talents[h.id], h.values, 0, debriefRng(s, 'l2'), s.botSamples))],
          chose: l.rounds[0].tVotes[h.id],
        },
      };
    }
    const d: L2Debrief = {
      talents: { ...l.talents },
      rounds: l.rounds,
      variance: varianceShares(X, E),
      eStar,
      polls: [],
      distortion: { realizedW, counterfactualW: cfW, realizedGross, counterfactualGross: cfGross },
      selfishT,
      predictedT: lowerMedian(Object.values(selfishT)),
      byHuman,
    };
    l.debrief = d;
    return d;
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    const hide = <T>(rec: Record<PlayerId, T>) =>
      revealPrivate ? rec : Object.fromEntries(Object.entries(rec).filter(([k]) => k === viewer));
    return {
      myTalent: l.talents[viewer],
      talents: revealPrivate ? l.talents : undefined,
      current: { t: l.current.t, tVotes: l.current.t !== undefined ? l.current.tVotes : undefined },
      rounds: l.rounds.map((r) => ({ ...personalRound(r, viewer), effort: hide(r.effort), eps: hide(r.eps) })),
      bonus: l.bonusBy?.[viewer],
      debrief: revealPrivate ? l.debrief : undefined,
    };
  },
};
