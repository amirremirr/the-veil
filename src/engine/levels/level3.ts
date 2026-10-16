// LEVEL 3: SHOCKS AND INSURANCE. Adverse selection, moral hazard, and the mandate.
import { BOT, L3 } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, playerOf, pluralityResolve } from '../core';
import { equalShares, mean, roundScore } from '../scoring';
import { ceOfSamples, logitChoice, logitProbs } from '../bots/utility';
import { flavorIndex, type Rng } from '../rng';
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
  highShare: number;
  regimeVotes?: Record<PlayerId, Regime>;
  regime: Regime;
  bestRegimeForType: Record<RiskType, Regime>;
  unraveled: boolean;
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

/** Risk-neutral selfish choice for a type (the simple model bots use for others). */
export function rnChoice(type: RiskType, regime: Regime, premium: number | null): Choice {
  const p = pOf(type);
  if (regime === 'VOL') {
    const opts: Array<[Choice, number]> = [
      [{ buy: false, gym: false }, p * L3.LOSS],
      [{ buy: false, gym: true }, L3.GYM_COST + p * L3.GYM_FACTOR * L3.LOSS],
    ];
    if (premium !== null) opts.push([{ buy: true, gym: false }, premium]);
    let best = opts[0];
    for (const o of opts) if (o[1] < best[1] - 1e-9) best = o;
    return best[0];
  }
  const c = coverage(regime);
  const saving = p * (1 - L3.GYM_FACTOR) * (1 - c) * L3.LOSS;
  return { buy: false, gym: saving > L3.GYM_COST + 1e-9 };
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

/** CE of each own option under a regime, with others' types and actions modeled (Section 5.4). */
function choiceCE(
  n: number,
  i: number,
  myType: RiskType | null,
  card: ValuesCard,
  rho: number,
  regime: Regime,
  premium: number | null,
  rng: Rng,
  samples: number,
): { options: Choice[]; ce: number[] } {
  const options = optionsFor(regime, premium);
  const scores: number[][] = options.map(() => []);
  const eq = equalShares(n);
  for (let m = 0; m < samples; m++) {
    const types: RiskType[] = [];
    for (let j = 0; j < n; j++) types.push(j === i && myType ? myType : rng.next() < L3.P_HIGH_SHARE ? 'HIGH' : 'LOW');
    const u = types.map(() => rng.next());
    const others = types.map((t) => rnChoice(t, regime, premium));
    options.forEach((opt, k) => {
      const choices = others.slice();
      choices[i] = opt;
      const pEff = choices.map((c, j) => pEffOf(types[j], c.gym));
      const events = pEff.map((p, j) => u[j] < p);
      const { W } = wealthL3(regime, premium, choices, pEff, events);
      scores[k].push(roundScore(card, W, i, eq));
    });
  }
  return { options, ce: scores.map((sc) => ceOfSamples(sc, rho)) };
}

function currentPremium(s: GameState): number | null {
  const l = st(s);
  return l.regime === 'VOL' && l.insurerActive ? l.nextPremium : null;
}

function regimeCE(s: GameState, n: number, i: number, myType: RiskType | null, card: ValuesCard, rho: number, rng: Rng, samples: number): number[] {
  const l = st(s);
  return REGIMES.map((r) => {
    const prem = r === 'VOL' && l.insurerActive ? l.nextPremium : null;
    const { ce } = choiceCE(n, i, myType, card, rho, r, prem, rng, samples);
    return Math.max(...ce);
  });
}

/** Analytic risk-neutral expected wealth per type under each regime with a given high-risk share. */
export function expectedByType(highShare: number): Record<Regime, Record<RiskType, number>> {
  const vol = (type: RiskType) => {
    const c = rnChoice(type, 'VOL', premiumFor(L3.P_BAR));
    const p = pEffOf(type, c.gym);
    return L3.BASE_INCOME - (c.buy ? premiumFor(L3.P_BAR) : 0) - (c.gym ? L3.GYM_COST : 0) - (c.buy ? 0 : p * L3.LOSS);
  };
  const mand = (r: Regime) => {
    const cv = coverage(r);
    const gymL = rnChoice('LOW', r, null).gym;
    const gymH = rnChoice('HIGH', r, null).gym;
    const meanP = highShare * pEffOf('HIGH', gymH) + (1 - highShare) * pEffOf('LOW', gymL);
    const T = L3.LOADING * cv * L3.LOSS * meanP;
    const w = (type: RiskType, gym: boolean) =>
      L3.BASE_INCOME - T - (gym ? L3.GYM_COST : 0) - pEffOf(type, gym) * (1 - cv) * L3.LOSS;
    return { LOW: w('LOW', gymL), HIGH: w('HIGH', gymH) };
  };
  return { VOL: { LOW: vol('LOW'), HIGH: vol('HIGH') }, M50: mand('M50'), M100: mand('M100') };
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
      const { options, ce } = choiceCE(n, i, l.types[botId], me.values, rho, l.regime, currentPremium(s), rng, s.botSamples);
      // Section 5.5: buy is a binary logit (each side valued at its best gym response),
      // then the gym is a binary logit given the purchase decision.
      const best = (buy: boolean) => Math.max(...options.map((o, k) => (o.buy === buy ? ce[k] : -Infinity)));
      const canBuy = options.some((o) => o.buy);
      const buy = canBuy ? logitChoice([best(false), best(true)], lambda, rng) === 1 : false;
      const gymCE = [false, true].map((gym) => ce[options.findIndex((o) => o.buy === buy && o.gym === gym)]);
      const gym = logitChoice(gymCE, lambda, rng) === 1;
      return { buy, gym };
    }
    const ce = regimeCE(s, n, i, st(s).types[botId], me.values, rho, rng, Math.max(30, Math.round(s.botSamples / 2)));
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
    const rng = botRng(s);
    const n = s.players.length;
    const i = idx(s, botId);
    const samples = Math.max(30, Math.round(s.botSamples / 3));
    if (phase.step === 'REGIME') {
      const ce = regimeCE(s, n, i, st(s).types[botId], me.values, rho, rng, samples);
      const order = REGIMES.map((r, k) => [r, ce[k]] as const).sort((a, b) => b[1] - a[1]);
      return { support: order[0][0], decoy: order[1][0] };
    }
    const l = st(s);
    const { options, ce } = choiceCE(n, i, l.types[botId], me.values, rho, l.regime, currentPremium(s), rng, samples);
    const best = options[ce.indexOf(Math.max(...ce))];
    const menu = currentPremium(s) !== null ? ['BUY', 'GYM'] : ['GYM'];
    const yes = menu.filter((a) => (a === 'BUY' ? best.buy : best.gym));
    return { promise: yes, falsePromise: menu.filter((a) => !yes.includes(a)) };
  },
  observable: ['REGIME'],
  likelihood(s, _observer, actor, _step, decision, card) {
    const n = s.players.length;
    const rng = botRng(s);
    const probs = REGIMES.map(() => 0);
    for (const type of ['LOW', 'HIGH'] as RiskType[]) {
      const ce = regimeCE(s, n, idx(s, actor), type, card, BOT.BELIEF_RHO, rng, Math.round(BOT.BELIEF_MC_SAMPLES / 2));
      logitProbs(ce, BOT.BELIEF_LAMBDA).forEach((p, k) => (probs[k] += p / 2));
    }
    return probs[REGIMES.indexOf(decision as Regime)] ?? 0;
  },
  debrief(s) {
    const l = st(s);
    const pids = ids(s);
    const highShare = pids.filter((id) => l.types[id] === 'HIGH').length / pids.length;
    const exp = expectedByType(highShare);
    const best = (type: RiskType) => REGIMES.reduce((a, b) => (exp[b][type] > exp[a][type] + 1e-9 ? b : a), 'VOL' as Regime);
    const gym = { insured: [0, 0] as [number, number], uninsured: [0, 0] as [number, number], mandatory: [0, 0] as [number, number] };
    for (const r of l.rounds)
      for (const id of pids) {
        const c = r.choices[id];
        const bucket = r.regime !== 'VOL' ? gym.mandatory : c.buy ? gym.insured : gym.uninsured;
        bucket[1]++;
        if (c.gym) bucket[0]++;
      }
    const vol = l.rounds.filter((r) => r.regime === 'VOL');
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
      highShare,
      regimeVotes: l.regimeVotes,
      regime: l.regime,
      bestRegimeForType: { LOW: best('LOW'), HIGH: best('HIGH') },
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
