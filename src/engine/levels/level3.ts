// LEVEL 3: SHOCKS AND INSURANCE. Adverse selection, moral hazard, and the mandate.
import { BOT, L3 } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, playerOf, pluralityResolve } from '../core';
import { equalShares, mean, ownNet, roundScore } from '../scoring';
import { ceOfLottery, logitChoice, logitProbs } from '../bots/utility';
import { flavorIndex } from '../rng';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import type { LevelDefinition } from './types';

export type Regime = 'VOL' | 'M50' | 'M100';
export const REGIMES: Regime[] = ['VOL', 'M50', 'M100'];
export type RiskType = 'LOW' | 'HIGH';
export interface Choice {
  buy: boolean;
  gym: boolean;
}

export interface L3Round {
  regime: Regime;
  premium: number | null;
  T?: number;
  choices: Record<PlayerId, Choice>;
  pEff: Record<PlayerId, number>;
  events: Record<PlayerId, boolean>;
  eventCards: Record<PlayerId, number>;
  W: Record<PlayerId, number>;
  nextPremium: number | null;
}

export interface L3Debrief {
  types: Record<PlayerId, RiskType>;
  rounds: L3Round[];
  premiumPath: Array<number | null>;
  pools: Array<{ round: number; buyers: PlayerId[]; meanP: number | null }>;
  gym: { insured: [number, number]; uninsured: [number, number]; mandatory: [number, number] };
  expectedByType: Record<Regime, Record<RiskType, number>>;
  /** Prices the voluntary market would have had in every round with this table's types (D-80). */
  volPath: Array<number | null>;
  highShare: number;
  regimeVotes?: Record<PlayerId, Regime>;
  regime: Regime;
  bestRegimeForType: Record<RiskType, Regime>;
  unraveled: boolean;
  /** Round 1 buy decision: the human's card's best choice (risk neutral apart from hardship) vs. theirs. */
  cardBest?: { best: boolean; chose: boolean };
  /** Per human (D-43, D-62). visibleState merges the viewer's entry into the fields above. */
  byHuman?: Record<PlayerId, { cardBest: { best: boolean; chose: boolean } }>;
}

export interface L3State {
  types: Record<PlayerId, RiskType>;
  regime: Regime;
  insurerActive: boolean;
  nextPremium: number | null;
  regimeVotes?: Record<PlayerId, Regime>;
  regimeCounts?: number[];
  regimeTie?: boolean;
  rounds: L3Round[];
  debrief?: L3Debrief;
}

const st = (s: GameState) => s.levelState as L3State;
const pOf = (type: RiskType) => (type === 'HIGH' ? L3.P_HIGH : L3.P_LOW);
const coverage = (r: Regime) => (r === 'M50' ? L3.COVERAGE_OPTIONS[0] : L3.COVERAGE_OPTIONS[1]);

export function premiumFor(meanP: number): number {
  return L3.LOADING * L3.LOSS * meanP;
}

export function mandatoryContribution(c: number, pEffAll: readonly number[]): number {
  return L3.LOADING * c * L3.LOSS * mean(pEffAll);
}

export function wealthL3(
  regime: Regime,
  premium: number | null,
  choices: readonly Choice[],
  pEff: readonly number[],
  events: readonly boolean[],
): { W: number[]; T?: number } {
  if (regime === 'VOL') {
    const W = choices.map((c, i) => {
      const buy = c.buy && premium !== null;
      return L3.BASE_INCOME - (buy ? premium! : 0) - (c.gym ? L3.GYM_COST : 0) - (events[i] && !buy ? L3.LOSS : 0);
    });
    return { W };
  }
  const c = coverage(regime);
  const T = mandatoryContribution(c, pEff);
  const W = choices.map((ch, i) => L3.BASE_INCOME - T - (ch.gym ? L3.GYM_COST : 0) - (events[i] ? (1 - c) * L3.LOSS : 0));
  return { W, T };
}

/**
 * Expected own money minus hardship for one choice (risk neutral apart from the hardship line).
 * Under a mandate the contribution is estimated from the population average risk.
 */
export function rnValue(type: RiskType, regime: Regime, premium: number | null, ch: Choice): number {
  const pe = pOf(type) * (ch.gym ? L3.GYM_FACTOR : 1);
  const gym = ch.gym ? L3.GYM_COST : 0;
  if (regime === 'VOL') {
    if (ch.buy && premium !== null) return ownNet(L3.BASE_INCOME - premium - gym);
    return (1 - pe) * ownNet(L3.BASE_INCOME - gym) + pe * ownNet(L3.BASE_INCOME - gym - L3.LOSS);
  }
  const c = coverage(regime);
  const T = mandatoryContribution(c, [L3.P_BAR]);
  return (1 - pe) * ownNet(L3.BASE_INCOME - T - gym) + pe * ownNet(L3.BASE_INCOME - T - gym - (1 - c) * L3.LOSS);
}

/** Risk-neutral selfish choice for a type, counting the hardship line (the simple model bots use for others). */
export function rnChoice(type: RiskType, regime: Regime, premium: number | null): Choice {
  const opts: Choice[] = [
    { buy: false, gym: false },
    { buy: false, gym: true },
  ];
  if (regime === 'VOL' && premium !== null) opts.push({ buy: true, gym: false });
  let best = opts[0];
  for (const o of opts) if (rnValue(type, regime, premium, o) > rnValue(type, regime, premium, best) + 1e-9) best = o;
  return best;
}

function pEffOf(type: RiskType, gym: boolean): number {
  return pOf(type) * (gym ? L3.GYM_FACTOR : 1);
}

function optionsFor(regime: Regime, premium: number | null): Choice[] {
  const base = [
    { buy: false, gym: false },
    { buy: false, gym: true },
  ];
  if (regime === 'VOL' && premium !== null) base.push({ buy: true, gym: false }, { buy: true, gym: true });
  return base;
}

/**
 * CE of each own option under a regime, with others' types and actions modeled (Section 5.4).
 * Exact enumeration (D-52): every combination of the other players' risk types and every player's
 * bad-luck outcome, weighted by its probability. No Monte Carlo noise, no random draws.
 */
function choiceCE(
  n: number,
  i: number,
  myType: RiskType | null,
  card: ValuesCard,
  rho: number,
  regime: Regime,
  premium: number | null,
): { options: Choice[]; ce: number[] } {
  const options = optionsFor(regime, premium);
  const lotteries: Array<Array<[number, number]>> = options.map(() => []);
  const eq = equalShares(n);
  const free = Array.from({ length: n }, (_, j) => j).filter((j) => j !== i || !myType);
  for (let tm = 0; tm < 1 << free.length; tm++) {
    const types: RiskType[] = Array.from({ length: n }, () => myType ?? 'LOW');
    let pTypes = 1;
    free.forEach((j, k) => {
      const high = (tm >> k) & 1;
      types[j] = high ? 'HIGH' : 'LOW';
      pTypes *= high ? L3.P_HIGH_SHARE : 1 - L3.P_HIGH_SHARE;
    });
    const others = types.map((t) => rnChoice(t, regime, premium));
    options.forEach((opt, k) => {
      const choices = others.slice();
      choices[i] = opt;
      const pEff = choices.map((c, j) => pEffOf(types[j], c.gym));
      for (let em = 0; em < 1 << n; em++) {
        let p = pTypes;
        const events = pEff.map((pe, j) => {
          const ev = ((em >> j) & 1) === 1;
          p *= ev ? pe : 1 - pe;
          return ev;
        });
        if (p === 0) continue;
        const { W } = wealthL3(regime, premium, choices, pEff, events);
        lotteries[k].push([p, roundScore(card, W, i, eq)]);
      }
    });
  }
  return { options, ce: lotteries.map((lot) => ceOfLottery(lot, rho)) };
}

function currentPremium(s: GameState): number | null {
  const l = st(s);
  return l.regime === 'VOL' && l.insurerActive ? l.nextPremium : null;
}

function regimeCE(s: GameState, n: number, i: number, myType: RiskType | null, card: ValuesCard, rho: number): number[] {
  const l = st(s);
  return REGIMES.map((r) => {
    const prem = r === 'VOL' && l.insurerActive ? l.nextPremium : null;
    const { ce } = choiceCE(n, i, myType, card, rho, r, prem);
    return Math.max(...ce);
  });
}

/**
 * The voluntary market's price path if it ran every round (D-80), with every player choosing by the
 * risk-neutral rule that counts the hardship line (`rnChoice`): each round the types that buy at the
 * current price set next round's price from their average risk, and if nobody buys the insurer leaves
 * for good. Deterministic: it uses the table's mix of types, not anyone's luck.
 */
export function voluntaryPath(nHigh: number, n: number): Array<number | null> {
  const out: Array<number | null> = [];
  let premium: number | null = premiumFor(L3.P_BAR);
  for (let r = 0; r < L3.ROUNDS; r++) {
    out.push(premium);
    if (premium === null) continue;
    const counts: Record<RiskType, number> = { HIGH: nHigh, LOW: n - nHigh };
    let buyers = 0;
    let riskSum = 0;
    for (const type of ['LOW', 'HIGH'] as RiskType[]) {
      const c = rnChoice(type, 'VOL', premium);
      if (!c.buy || counts[type] === 0) continue;
      buyers += counts[type];
      riskSum += counts[type] * pEffOf(type, c.gym);
    }
    premium = buyers ? premiumFor(riskSum / buyers) : null;
  }
  return out;
}

/**
 * Risk-neutral expectation per type and round, averaged over the level's rounds, under each regime for a
 * table with `nHigh` High types out of `n`. Voluntary insurance is valued along `voluntaryPath`, not at
 * the opening price (D-80). With `net`, each outcome counts own money minus the hardship penalty (used to
 * pick a type's best regime).
 */
export function expectedByType(nHigh: number, n: number, net = false): Record<Regime, Record<RiskType, number>> {
  const f = net ? ownNet : (w: number) => w;
  const highShare = n > 0 ? nHigh / n : 0;
  const path = voluntaryPath(nHigh, n);
  const volRound = (type: RiskType, prem: number | null) => {
    const c = rnChoice(type, 'VOL', prem);
    const gym = c.gym ? L3.GYM_COST : 0;
    if (c.buy && prem !== null) return f(L3.BASE_INCOME - prem - gym);
    const p = pEffOf(type, c.gym);
    return (1 - p) * f(L3.BASE_INCOME - gym) + p * f(L3.BASE_INCOME - gym - L3.LOSS);
  };
  const vol = (type: RiskType) => mean(path.map((prem) => volRound(type, prem)));
  const mand = (r: Regime) => {
    const cv = coverage(r);
    const gymL = rnChoice('LOW', r, null).gym;
    const gymH = rnChoice('HIGH', r, null).gym;
    const meanP = highShare * pEffOf('HIGH', gymH) + (1 - highShare) * pEffOf('LOW', gymL);
    const T = L3.LOADING * cv * L3.LOSS * meanP;
    const w = (type: RiskType, gym: boolean) => {
      const base = L3.BASE_INCOME - T - (gym ? L3.GYM_COST : 0);
      const p = pEffOf(type, gym);
      return (1 - p) * f(base) + p * f(base - (1 - cv) * L3.LOSS);
    };
    return { LOW: w('LOW', gymL), HIGH: w('HIGH', gymH) };
  };
  return { VOL: { LOW: vol('LOW'), HIGH: vol('HIGH') }, M50: mand('M50'), M100: mand('M100') };
}

/** Round 1: would the human's card (risk neutral apart from hardship, no noise) buy at the opening price? */
function cardBestBuy(s: GameState, pid: PlayerId): { best: boolean; chose: boolean } {
  const l = st(s);
  const me = playerOf(s, pid);
  const r1 = l.rounds[0];
  const premium = r1.premium;
  const { options, ce } = choiceCE(s.players.length, idx(s, pid), l.types[pid], me.values, 0, 'VOL', premium);
  return { best: options[ce.indexOf(Math.max(...ce))].buy, chose: r1.choices[pid].buy };
}

export const level3: LevelDefinition = {
  id: 3,
  rounds: L3.ROUNDS,
  init(s) {
    const g = gameRng(s);
    const types: Record<PlayerId, RiskType> = {};
    for (const p of s.players) {
      types[p.id] = g.next() < L3.P_HIGH_SHARE ? 'HIGH' : 'LOW';
      p.privateInfo.riskType = types[p.id];
    }
    s.levelState = {
      types,
      regime: 'VOL',
      insurerActive: true,
      nextPremium: premiumFor(L3.P_BAR),
      rounds: [],
    } satisfies L3State;
  },
  phases() {
    const out: Phase[] = [];
    for (let r = 1; r <= L3.ROUNDS; r++) {
      out.push(
        { kind: 'BRIEFING', round: r },
        { kind: 'TALK', step: 'ROUND', round: r },
        { kind: 'DECIDE', step: 'CHOICE', round: r },
        { kind: 'REVEAL', step: 'EVENTS', round: r },
        { kind: 'ROUND_SUMMARY', round: r },
      );
      if (r === L3.VOLUNTARY_ROUNDS)
        out.push(
          { kind: 'TALK', step: 'REGIME', round: r },
          { kind: 'DECIDE', step: 'REGIME', round: r },
          { kind: 'REVEAL', step: 'REGIME', round: r },
        );
    }
    return out;
  },
  deciders(s) {
    return ids(s);
  },
  validate(s, step, _pid, d) {
    if (step === 'REGIME') return REGIMES.includes(d as Regime) ? d : null;
    if (step === 'CHOICE') {
      const c = d as Choice;
      if (!c || typeof c.buy !== 'boolean' || typeof c.gym !== 'boolean') return null;
      return { buy: c.buy && currentPremium(s) !== null, gym: c.gym };
    }
    return null;
  },
  botDecide(s, botId, step) {
    const { lambda, rho } = botParams(s, botId);
    const me = playerOf(s, botId);
    const rng = botRng(s);
    const n = s.players.length;
    const i = idx(s, botId);
    if (step === 'CHOICE') {
      const l = st(s);
      const { options, ce } = choiceCE(n, i, l.types[botId], me.values, rho, l.regime, currentPremium(s));
      // Section 5.5: buy is a binary logit (each side valued at its best gym response),
      // then the gym is a binary logit given the purchase decision.
      const best = (buy: boolean) => Math.max(...options.map((o, k) => (o.buy === buy ? ce[k] : -Infinity)));
      const canBuy = options.some((o) => o.buy);
      const buy = canBuy ? logitChoice([best(false), best(true)], lambda, rng) === 1 : false;
      const gymCE = [false, true].map((gym) => ce[options.findIndex((o) => o.buy === buy && o.gym === gym)]);
      const gym = logitChoice(gymCE, lambda, rng) === 1;
      return { buy, gym };
    }
    const ce = regimeCE(s, n, i, st(s).types[botId], me.values, rho);
    return REGIMES[logitChoice(ce, lambda, rng)];
  },
  resolve(s, step, decisions) {
    const l = st(s);
    const pids = ids(s);
    const g = gameRng(s);
    if (step === 'REGIME') {
      const votes = pids.map((id) => REGIMES.indexOf(decisions[id] as Regime));
      const { winner, tie, counts } = pluralityResolve(votes, REGIMES.length, g);
      l.regimeVotes = decisions as Record<PlayerId, Regime>;
      l.regimeCounts = counts;
      l.regimeTie = tie;
      l.regime = REGIMES[winner];
      return;
    }
    const premium = currentPremium(s);
    const choices = pids.map((id) => decisions[id] as Choice);
    const pEff = pids.map((id, i) => pEffOf(l.types[id], choices[i].gym));
    const events = pEff.map((p) => g.next() < p);
    const { W, T } = wealthL3(l.regime, premium, choices, pEff, events);
    const rec = <X>(xs: X[]) => Object.fromEntries(pids.map((id, i) => [id, xs[i]])) as Record<PlayerId, X>;
    let exited = false;
    const before = l.nextPremium;
    if (l.regime === 'VOL' && l.insurerActive) {
      const buyers = pids.map((_, i) => i).filter((i) => choices[i].buy);
      if (buyers.length === 0) {
        l.insurerActive = false;
        l.nextPremium = null;
        exited = true;
      } else l.nextPremium = premiumFor(mean(buyers.map((i) => pEff[i])));
    }
    const round: L3Round = {
      regime: l.regime,
      premium,
      T,
      choices: rec(choices),
      pEff: rec(pEff),
      events: rec(events),
      eventCards: Object.fromEntries(pids.map((id) => [id, flavorIndex(s.seed, `l3-${s.round}-${id}`, 9973)])),
      W: rec(W),
      nextPremium: l.nextPremium,
    };
    l.rounds.push(round);
    const nEvents = events.filter(Boolean).length;
    let key = 'l3.quiet';
    if (exited) key = 'l3.exit';
    else if (l.regime !== 'VOL') key = 'l3.mandatory';
    else if (before !== null && l.nextPremium !== null && l.nextPremium > before + 1e-9) key = 'l3.premiumUp';
    else if (nEvents * 2 >= pids.length) key = 'l3.manyEvents';
    finishRound(s, W, equalShares(pids.length), headline(s, key, { premium: Math.round(l.nextPremium ?? 0), events: nEvents }));
  },
  talkMenu(s, phase) {
    if (phase.step === 'REGIME') return { support: [...REGIMES], oppose: [], promise: [] };
    const promise = currentPremium(s) !== null ? ['BUY', 'GYM'] : ['GYM'];
    return { support: [], oppose: [], promise };
  },
  checkStep(_s, phase, msg) {
    if (msg.type === 'SUPPORT' && phase.step === 'REGIME') return 'REGIME';
    if (msg.type === 'PROMISE') return 'CHOICE';
    return undefined;
  },
  messageKept(_s, step, msg, d) {
    if (step === 'REGIME' && msg.type === 'SUPPORT') return msg.option === d;
    if (step === 'CHOICE' && msg.type === 'PROMISE') {
      const c = d as Choice;
      return msg.action === 'BUY' ? c.buy : c.gym;
    }
    return true;
  },
  botIntent(s, botId, phase) {
    const { rho } = botParams(s, botId);
    const me = playerOf(s, botId);
    const n = s.players.length;
    const i = idx(s, botId);
    if (phase.step === 'REGIME') {
      const ce = regimeCE(s, n, i, st(s).types[botId], me.values, rho);
      const order = REGIMES.map((r, k) => [r, ce[k]] as const).sort((a, b) => b[1] - a[1]);
      return { support: order[0][0], decoy: order[1][0] };
    }
    const l = st(s);
    const { options, ce } = choiceCE(n, i, l.types[botId], me.values, rho, l.regime, currentPremium(s));
    const best = options[ce.indexOf(Math.max(...ce))];
    const menu = currentPremium(s) !== null ? ['BUY', 'GYM'] : ['GYM'];
    const yes = menu.filter((a) => (a === 'BUY' ? best.buy : best.gym));
    return { promise: yes, falsePromise: menu.filter((a) => !yes.includes(a)) };
  },
  observable: ['REGIME'],
  likelihood(s, _observer, actor, _step, decision, card) {
    const n = s.players.length;
    const probs = REGIMES.map(() => 0);
    for (const type of ['LOW', 'HIGH'] as RiskType[]) {
      const ce = regimeCE(s, n, idx(s, actor), type, card, BOT.BELIEF_RHO);
      logitProbs(ce, BOT.BELIEF_LAMBDA).forEach((p, k) => (probs[k] += p / 2));
    }
    return probs[REGIMES.indexOf(decision as Regime)] ?? 0;
  },
  debrief(s) {
    const l = st(s);
    const pids = ids(s);
    const nHigh = pids.filter((id) => l.types[id] === 'HIGH').length;
    const highShare = nHigh / pids.length;
    const exp = expectedByType(nHigh, pids.length);
    const expNet = expectedByType(nHigh, pids.length, true);
    const best = (type: RiskType) => REGIMES.reduce((a, b) => (expNet[b][type] > expNet[a][type] + 1e-9 ? b : a), 'VOL' as Regime);
    const gym = { insured: [0, 0] as [number, number], uninsured: [0, 0] as [number, number], mandatory: [0, 0] as [number, number] };
    for (const r of l.rounds)
      for (const id of pids) {
        const c = r.choices[id];
        const bucket = r.regime !== 'VOL' ? gym.mandatory : c.buy ? gym.insured : gym.uninsured;
        bucket[1]++;
        if (c.gym) bucket[0]++;
      }
    const vol = l.rounds.filter((r) => r.regime === 'VOL');
    const byHuman = Object.fromEntries(s.players.filter((p) => p.isHuman).map((h) => [h.id, { cardBest: cardBestBuy(s, h.id) }]));
    const d: L3Debrief = {
      types: { ...l.types },
      rounds: l.rounds,
      premiumPath: l.rounds.map((r) => (r.regime === 'VOL' ? r.premium : null)),
      pools: l.rounds.map((r, k) => {
        const buyers = pids.filter((id) => r.choices[id].buy);
        return { round: k + 1, buyers, meanP: buyers.length ? mean(buyers.map((id) => r.pEff[id])) : null };
      }),
      gym,
      expectedByType: exp,
      volPath: voluntaryPath(nHigh, pids.length),
      highShare,
      regimeVotes: l.regimeVotes,
      regime: l.regime,
      bestRegimeForType: { LOW: best('LOW'), HIGH: best('HIGH') },
      byHuman,
      unraveled: vol.slice(0, L3.VOLUNTARY_ROUNDS).some((r) => r.premium === null || pids.every((id) => !r.choices[id].buy)),
    };
    l.debrief = d;
    return d;
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    return {
      myType: l.types[viewer],
      types: revealPrivate ? l.types : undefined,
      regime: l.regime,
      insurerActive: l.insurerActive,
      premium: currentPremium(s),
      regimeVotes: l.regimeVotes,
      regimeCounts: l.regimeCounts,
      regimeTie: l.regimeTie,
      rounds: l.rounds.map((r) => ({ ...r, pEff: revealPrivate ? r.pEff : { [viewer]: r.pEff[viewer] } })),
      debrief: revealPrivate ? l.debrief : undefined,
    };
  },
};
