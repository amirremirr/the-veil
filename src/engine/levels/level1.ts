// LEVEL 1: BEHIND THE VEIL. Vote on a distribution principle before learning your income.
import { BOT, L1 } from '../params';
import {
  botParams,
  botRng,
  finishRound,
  gameRng,
  ids,
  headline,
  orderedDraws,
  pluralityResolve,
  pluralityWinnerDist,
  predictChoice,
} from '../core';
import { afterTaxEqualRebate, PRINCIPLES, solvePrinciple, taxGrid, type PrincipleId } from '../tax';
import { equalShares, mean, roundScore } from '../scoring';
import { certaintyEquivalent, crra, logitChoice, logitProbs, argmax } from '../bots/utility';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import type { LevelDefinition } from './types';

export interface L1Round {
  votes: Record<PlayerId, PrincipleId>;
  counts: number[];
  winner: PrincipleId;
  tie: boolean;
  incomes: Record<PlayerId, number>;
  t: number;
  W: Record<PlayerId, number>;
}

export interface L1Outcome {
  avg: number;
  min: number;
  max: number;
  range: number;
  t: number;
}

export interface L1Debrief {
  rounds: Array<L1Round & { byPrinciple: Record<PrincipleId, L1Outcome> }>;
  expected: Record<PrincipleId, { avg: number; min: number; range: number; own: number; t: number }>;
  priceOfInsurance: Record<PrincipleId, number>;
  benchmark: { harsanyi: PrincipleId; rawls: PrincipleId; lab: PrincipleId };
  voteShares: Record<PrincipleId, number>;
  /** The human's card's best vote (risk neutral apart from the hardship line, no noise) vs. their votes. */
  cardBest?: { best: PrincipleId; chose: PrincipleId[] };
}

export interface L1State {
  rounds: L1Round[];
  debrief?: L1Debrief;
}

const GRID = taxGrid(L1.TAX_GRID_STEP, L1.TAX_GRID_MAX);
const solverOpts = { kappa: L1.KAPPA, floor: L1.FLOOR, rangeCap: L1.RANGE_CAP, grid: GRID };

export function principleTax(p: PrincipleId, incomes: readonly number[]): number {
  return solvePrinciple(p, incomes, solverOpts);
}

export function principleOutcome(p: PrincipleId, incomes: readonly number[]): L1Outcome & { W: number[] } {
  const t = principleTax(p, incomes);
  const W = afterTaxEqualRebate(incomes, t, L1.KAPPA);
  const min = Math.min(...W);
  const max = Math.max(...W);
  return { W, t, avg: mean(W), min, max, range: max - min };
}

const evCache = new Map<string, number>();

/** Expected CRRA utility of round score for seat 0 under principle p, by full enumeration of draws. */
export function principleEU(n: number, card: ValuesCard, rho: number, p: PrincipleId): number {
  const key = `${n}|${card}|${rho}|${p}`;
  const hit = evCache.get(key);
  if (hit !== undefined) return hit;
  const draws = orderedDraws(L1.INCOME_DECK, n);
  const eq = equalShares(n);
  let eu = 0;
  for (const inc of draws) {
    const { W } = principleOutcome(p, inc);
    eu += crra(roundScore(card, W, 0, eq), rho);
  }
  eu /= draws.length;
  evCache.set(key, eu);
  return eu;
}

/** Sincere favorite principle for a card (as if the voter were pivotal). */
export function sincereFavorite(n: number, card: ValuesCard, rho: number): PrincipleId {
  const ce = PRINCIPLES.map((p) => certaintyEquivalent(principleEU(n, card, rho, p), rho));
  return PRINCIPLES[argmax(ce)];
}

function voteValues(s: GameState, botId: PlayerId): number[] {
  const n = s.players.length;
  const me = s.players.find((p) => p.id === botId)!;
  const { rho } = botParams(s, botId);
  const euP = PRINCIPLES.map((p) => principleEU(n, me.values, rho, p));
  const others = ids(s).filter((id) => id !== botId);
  const dists = others.map((o) =>
    predictChoice(s, botId, o, PRINCIPLES, (c, rn) => sincereFavorite(n, c, rn ? 0 : BOT.BELIEF_RHO), 'VOTE'),
  );
  return PRINCIPLES.map((_, v) => {
    const mine = PRINCIPLES.map((__, k) => (k === v ? 1 : 0));
    const win = pluralityWinnerDist([mine, ...dists], PRINCIPLES.length);
    const eu = win.reduce((acc, w, k) => acc + w * euP[k], 0);
    return certaintyEquivalent(eu, rho);
  });
}

function st(s: GameState): L1State {
  return s.levelState as L1State;
}

export const level1: LevelDefinition = {
  id: 1,
  rounds: L1.ROUNDS,
  init(s) {
    s.levelState = { rounds: [] } satisfies L1State;
  },
  phases() {
    const out: Phase[] = [];
    for (let r = 1; r <= L1.ROUNDS; r++) {
      out.push(
        { kind: 'BRIEFING', round: r },
        { kind: 'TALK', step: 'VOTE', round: r },
        { kind: 'DECIDE', step: 'VOTE', round: r },
        { kind: 'REVEAL', step: 'VOTE', round: r },
        { kind: 'ROUND_SUMMARY', round: r },
      );
    }
    return out;
  },
  deciders(s) {
    return ids(s);
  },
  validate(_s, _step, _pid, d) {
    return PRINCIPLES.includes(d as PrincipleId) ? d : null;
  },
  botDecide(s, botId) {
    const { lambda } = botParams(s, botId);
    const U = voteValues(s, botId);
    return PRINCIPLES[logitChoice(U, lambda, botRng(s))];
  },
  resolve(s, _step, decisions) {
    const pids = ids(s);
    const votes = pids.map((id) => PRINCIPLES.indexOf(decisions[id] as PrincipleId));
    const g = gameRng(s);
    const { winner, tie, counts } = pluralityResolve(votes, PRINCIPLES.length, g);
    const drawn = g.shuffle(L1.INCOME_DECK).slice(0, pids.length);
    const p = PRINCIPLES[winner];
    const out = principleOutcome(p, drawn);
    const round: L1Round = {
      votes: Object.fromEntries(pids.map((id) => [id, decisions[id] as PrincipleId])),
      counts,
      winner: p,
      tie,
      incomes: Object.fromEntries(pids.map((id, i) => [id, drawn[i]])),
      t: out.t,
      W: Object.fromEntries(pids.map((id, i) => [id, out.W[i]])),
    };
    st(s).rounds.push(round);
    finishRound(s, out.W, equalShares(pids.length), headline(s, `l1.${p}${tie ? '_tie' : ''}`, { t: Math.round(out.t * 100) }));
  },
  talkMenu() {
    return { support: [...PRINCIPLES], oppose: [...PRINCIPLES], promise: [] };
  },
  checkStep(_s, _phase, msg) {
    return msg.type === 'SUPPORT' || msg.type === 'OPPOSE' ? 'VOTE' : undefined;
  },
  messageKept(_s, _step, msg, d) {
    return msg.type === 'SUPPORT' ? msg.option === d : true;
  },
  botIntent(s, botId) {
    const U = voteValues(s, botId);
    const order = PRINCIPLES.map((p, i) => [p, U[i]] as const).sort((a, b) => b[1] - a[1]);
    return { support: order[0][0], decoy: order[1][0] };
  },
  observable: ['VOTE'],
  likelihood(s, _observer, _actor, _step, decision, card) {
    const n = s.players.length;
    const ce = PRINCIPLES.map((p) => certaintyEquivalent(principleEU(n, card, BOT.BELIEF_RHO, p), BOT.BELIEF_RHO));
    const probs = logitProbs(ce, BOT.BELIEF_LAMBDA);
    return probs[PRINCIPLES.indexOf(decision as PrincipleId)] ?? 0;
  },
  debrief(s) {
    const n = s.players.length;
    const draws = orderedDraws(L1.INCOME_DECK, n);
    const expected = {} as L1Debrief['expected'];
    for (const p of PRINCIPLES) {
      const outs = draws.map((d) => principleOutcome(p, d));
      expected[p] = {
        avg: mean(outs.map((o) => o.avg)),
        min: mean(outs.map((o) => o.min)),
        range: mean(outs.map((o) => o.range)),
        own: mean(outs.map((o) => o.W[0])),
        t: mean(outs.map((o) => o.t)),
      };
    }
    const price = {} as Record<PrincipleId, number>;
    for (const p of PRINCIPLES) price[p] = expected.P1.avg - expected[p].avg;
    const rounds = st(s).rounds.map((r) => {
      const inc = ids(s).map((id) => r.incomes[id]);
      const byPrinciple = {} as Record<PrincipleId, L1Outcome>;
      for (const p of PRINCIPLES) {
        const { W: _w, ...o } = principleOutcome(p, inc);
        byPrinciple[p] = o;
      }
      return { ...r, byPrinciple };
    });
    const shares = { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<PrincipleId, number>;
    let total = 0;
    for (const r of st(s).rounds)
      for (const v of Object.values(r.votes)) {
        shares[v]++;
        total++;
      }
    for (const p of PRINCIPLES) shares[p] = total ? shares[p] / total : 0;
    const human = s.players.find((p) => p.isHuman);
    const d: L1Debrief = {
      rounds,
      expected,
      priceOfInsurance: price,
      // Harsanyi's benchmark maximizes expected income, which is the average: No Tax, because every tax leaks.
      benchmark: { harsanyi: 'P1', rawls: 'P4', lab: 'P2' },
      voteShares: shares,
      cardBest: human
        ? { best: sincereFavorite(n, human.values, 0), chose: st(s).rounds.map((r) => r.votes[human.id]) }
        : undefined,
    };
    st(s).debrief = d;
    return d;
  },
  view(s, _viewer, revealPrivate) {
    const l = st(s);
    return { rounds: l.rounds, debrief: revealPrivate ? l.debrief : undefined };
  },
};
