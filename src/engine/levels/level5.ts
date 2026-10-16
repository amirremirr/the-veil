// LEVEL 5: THE CONSTITUTIONAL CONVENTION. Write the rules blind, then amend them knowing who you are.
import { BOT, L5 } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, lowerMedian, orderedDraws, playerOf } from '../core';
import { equalShares, mean, roundScore } from '../scoring';
import { floorTopUp } from '../tax';
import { certaintyEquivalent, crra, logitChoice, logitProbs, argmax } from '../bots/utility';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import type { LevelDefinition } from './types';

export interface Constitution {
  t: number;
  F: number;
}

export interface Lobby {
  donateTo: PlayerId | null;
  amount: number;
  proposal: Constitution | null;
}

export interface AmendmentRecord {
  proposer: PlayerId;
  proposal: Constitution;
  statusQuo: Constitution;
  votes: Record<PlayerId, boolean>;
  yes: number;
  passed: boolean;
}

export type VerdictKey =
  | 'consistent'
  | 'paydayStrong'
  | 'paydayMild'
  | 'convenientStrong'
  | 'convenientMild'
  | 'selfTaxingRich'
  | 'poorTaxCutter';

export interface L5Debrief {
  veil: Record<PlayerId, Constitution>;
  revealed: Record<PlayerId, Constitution>;
  incomes: Record<PlayerId, number>;
  rank: Record<PlayerId, number>;
  deltaT: Record<PlayerId, number>;
  slope: number;
  adopted: Constitution;
  final: Constitution;
  amendments: AmendmentRecord[];
  donations: Record<PlayerId, { to: PlayerId | null; amount: number }>;
  boughtVotes: Array<{ donor: PlayerId; recipient: PlayerId; amount: number; votedYes: boolean; passed: boolean }>;
  verdict?: VerdictKey;
  W: Record<PlayerId, number>;
}

export interface L5State {
  veil?: Record<PlayerId, Constitution>;
  adopted?: Constitution;
  current?: Constitution;
  incomes?: Record<PlayerId, number>;
  incomesRevealed: boolean;
  lobby?: Record<PlayerId, Lobby>;
  order: PlayerId[];
  amendments: AmendmentRecord[];
  revealed?: Record<PlayerId, Constitution>;
  W?: Record<PlayerId, number>;
  debrief?: L5Debrief;
}

const st = (s: GameState) => s.levelState as L5State;

export const ALL_CONSTITUTIONS: Constitution[] = L5.TAX_OPTIONS.flatMap((t) => L5.FLOOR_OPTIONS.map((F) => ({ t, F })));
export const BANDS = ['T_LOW', 'T_MID', 'T_HIGH'] as const;
export type Band = (typeof BANDS)[number];

export function bandOf(t: number): Band {
  if (t <= L5.BAND_LOW_MAX + 1e-9) return 'T_LOW';
  if (t >= L5.BAND_HIGH_MIN - 1e-9) return 'T_HIGH';
  return 'T_MID';
}

export function supermajority(n: number): number {
  return Math.ceil((2 * n) / 3);
}

export function constitutionWealth(incomes: readonly number[], c: Constitution): number[] {
  return floorTopUp(incomes, c.t, c.F, L5.KAPPA);
}

function withDonations(W: number[], s: GameState, lobby: Record<PlayerId, Lobby> | undefined): number[] {
  if (!lobby) return W;
  const out = W.slice();
  for (const [from, l] of Object.entries(lobby)) {
    if (!l.donateTo || l.amount <= 0) continue;
    out[idx(s, from)] -= l.amount;
    out[idx(s, l.donateTo)] += l.amount;
  }
  return out;
}

const veilCache = new Map<string, number[]>();

/** Expected utility (as CE) of each constitution behind the veil, by enumerating income draws. */
export function veilCE(n: number, card: ValuesCard, rho: number): number[] {
  const key = `${n}|${card}|${rho}`;
  const hit = veilCache.get(key);
  if (hit) return hit;
  const draws = orderedDraws(L5.INCOME_DECK, n);
  const eq = equalShares(n);
  const out = ALL_CONSTITUTIONS.map((c) => {
    let eu = 0;
    for (const inc of draws) eu += crra(roundScore(card, constitutionWealth(inc, c), 0, eq), rho);
    return certaintyEquivalent(eu / draws.length, rho);
  });
  veilCache.set(key, out);
  return out;
}

function snap(x: number, grid: readonly number[]): number {
  return grid.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) - 1e-9 ? b : a), grid[0]);
}

function same(a: Constitution, b: Constitution): boolean {
  return Math.abs(a.t - b.t) < 1e-9 && a.F === b.F;
}

/** Bot amendment proposal: a sigma-weighted mix of its objective-optimal and wealth-optimal constitutions. */
function botProposal(s: GameState, botId: PlayerId): Constitution | null {
  const l = st(s);
  const pids = ids(s);
  const i = idx(s, botId);
  const inc = pids.map((id) => l.incomes![id]);
  const me = playerOf(s, botId);
  const { sigma } = botParams(s, botId);
  const eq = equalShares(pids.length);
  const Ws = ALL_CONSTITUTIONS.map((c) => constitutionWealth(inc, c));
  const bestS = ALL_CONSTITUTIONS[argmax(Ws.map((W) => roundScore(me.values, W, i, eq)))];
  const bestW = ALL_CONSTITUTIONS[argmax(Ws.map((W) => W[i]))];
  const prop = {
    t: snap((1 - sigma) * bestS.t + sigma * bestW.t, L5.TAX_OPTIONS),
    F: snap((1 - sigma) * bestS.F + sigma * bestW.F, L5.FLOOR_OPTIONS),
  };
  return same(prop, l.current!) ? null : prop;
}

/** Probability an amendment passes, from a bot's simple model of others (vote by own wealth). */
function passProbability(s: GameState, botId: PlayerId, prop: Constitution, target: PlayerId | null, d: number): number {
  const l = st(s);
  const pids = ids(s);
  const inc = pids.map((id) => l.incomes![id]);
  const Wa = constitutionWealth(inc, prop);
  const Wc = constitutionWealth(inc, l.current!);
  const ps = pids.map((id, j) => {
    if (id === botId) return 1;
    let p = Wa[j] > Wc[j] + 1e-9 ? BOT.VOTE_PREDICT_CONFIDENCE : Wa[j] < Wc[j] - 1e-9 ? 1 - BOT.VOTE_PREDICT_CONFIDENCE : 0.5;
    if (id === target) p = Math.min(1, p + (L5.RECIPROCITY * d) / L5.DONATION_MAX);
    return p;
  });
  const need = supermajority(pids.length);
  let dist = [1];
  for (const p of ps) {
    const next = new Array(dist.length + 1).fill(0);
    dist.forEach((q, k) => {
      next[k] += q * (1 - p);
      next[k + 1] += q * p;
    });
    dist = next;
  }
  return dist.slice(need).reduce((a, b) => a + b, 0);
}

function botLobby(s: GameState, botId: PlayerId): Lobby {
  const l = st(s);
  const prop = botProposal(s, botId);
  if (!prop) return { donateTo: null, amount: 0, proposal: null };
  const pids = ids(s);
  const i = idx(s, botId);
  const me = playerOf(s, botId);
  const { rho, lambda } = botParams(s, botId);
  const inc = pids.map((id) => l.incomes![id]);
  const eq = equalShares(pids.length);
  const Wa = constitutionWealth(inc, prop);
  const Wc = constitutionWealth(inc, l.current!);
  const combos: Array<{ to: PlayerId | null; d: number }> = [{ to: null, d: 0 }];
  for (const to of pids) if (to !== botId) for (const d of L5.DONATION_OPTIONS_BOT) if (d > 0) combos.push({ to, d });
  const ce = combos.map(({ to, d }) => {
    const shift = (W: number[]) => {
      const out = W.slice();
      if (to) {
        out[i] -= d;
        out[idx(s, to)] += d;
      }
      return out;
    };
    const p = passProbability(s, botId, prop, to, d);
    const eu = p * crra(roundScore(me.values, shift(Wa), i, eq), rho) + (1 - p) * crra(roundScore(me.values, shift(Wc), i, eq), rho);
    return certaintyEquivalent(eu, rho);
  });
  const k = logitChoice(ce, lambda, botRng(s));
  return { donateTo: combos[k].to, amount: combos[k].d, proposal: prop };
}

function amendIndex(step: string): number {
  return step.startsWith('AMEND_') ? Number(step.slice(6)) : -1;
}

export const level5: LevelDefinition = {
  id: 5,
  rounds: 1,
  init(s) {
    s.levelState = { incomesRevealed: false, order: [], amendments: [] } satisfies L5State;
  },
  phases(s) {
    const out: Phase[] = [
      { kind: 'BRIEFING', step: 'VEIL', round: 1 },
      { kind: 'TALK', step: 'VEIL', round: 1 },
      { kind: 'DECIDE', step: 'VEIL', round: 1 },
      { kind: 'REVEAL', step: 'CONSTITUTION', round: 1 },
      { kind: 'REVEAL', step: 'INCOMES', round: 1 },
      { kind: 'TALK', step: 'STAGE2', round: 1 },
      { kind: 'DECIDE', step: 'LOBBY', round: 1 },
    ];
    for (let k = 0; k < s.players.length; k++) out.push({ kind: 'DECIDE', step: `AMEND_${k}`, round: 1 });
    out.push({ kind: 'REVEAL', step: 'AMENDMENTS', round: 1 }, { kind: 'ROUND_SUMMARY', round: 1 });
    return out;
  },
  onEnter(s, phase) {
    if (phase.kind === 'REVEAL' && phase.step === 'INCOMES') st(s).incomesRevealed = true;
  },
  deciders(s, step) {
    const k = amendIndex(step);
    if (k >= 0) return st(s).order.length > k ? ids(s) : [];
    return ids(s);
  },
  validate(s, step, pid, d) {
    const okC = (c: unknown): c is Constitution =>
      !!c && L5.TAX_OPTIONS.some((t) => Math.abs(t - (c as Constitution).t) < 1e-9) && L5.FLOOR_OPTIONS.includes((c as Constitution).F);
    if (step === 'VEIL') return okC(d) ? { t: (d as Constitution).t, F: (d as Constitution).F } : null;
    if (step === 'LOBBY') {
      const l = d as Lobby;
      if (!l || typeof l !== 'object') return null;
      const amount = Math.round(Number(l.amount) || 0);
      if (amount < 0 || amount > L5.DONATION_MAX) return null;
      const to = amount > 0 ? l.donateTo : null;
      if (to && (to === pid || idx(s, to) < 0)) return null;
      if (l.proposal !== null && !okC(l.proposal)) return null;
      return { donateTo: to, amount: to ? amount : 0, proposal: l.proposal ? { t: l.proposal.t, F: l.proposal.F } : null };
    }
    if (amendIndex(step) >= 0) return typeof d === 'boolean' ? d : null;
    return null;
  },
  botDecide(s, botId, step) {
    const { rho, lambda } = botParams(s, botId);
    const me = playerOf(s, botId);
    const rng = botRng(s);
    if (step === 'VEIL') {
      const ce = veilCE(s.players.length, me.values, rho);
      return ALL_CONSTITUTIONS[logitChoice(ce, lambda, rng)];
    }
    if (step === 'LOBBY') return botLobby(s, botId);
    const k = amendIndex(step);
    const l = st(s);
    const a = l.lobby![l.order[k]];
    const pids = ids(s);
    const i = idx(s, botId);
    const inc = pids.map((id) => l.incomes![id]);
    const eq = equalShares(pids.length);
    const Sa = roundScore(me.values, withDonations(constitutionWealth(inc, a.proposal!), s, l.lobby), i, eq);
    const Sc = roundScore(me.values, withDonations(constitutionWealth(inc, l.current!), s, l.lobby), i, eq);
    let pYes = logitProbs([Sa, Sc], lambda)[0];
    const fromProposer = l.lobby![l.order[k]];
    if (fromProposer.donateTo === botId) pYes = Math.min(1, pYes + (L5.RECIPROCITY * fromProposer.amount) / L5.DONATION_MAX);
    return rng.next() < pYes;
  },
  resolve(s, step, decisions) {
    const l = st(s);
    const pids = ids(s);
    const g = gameRng(s);
    if (step === 'VEIL') {
      l.veil = decisions as Record<PlayerId, Constitution>;
      l.adopted = {
        t: lowerMedian(pids.map((id) => l.veil![id].t)),
        F: lowerMedian(pids.map((id) => l.veil![id].F)),
      };
      l.current = { ...l.adopted };
      const drawn = g.shuffle(L5.INCOME_DECK).slice(0, pids.length);
      l.incomes = Object.fromEntries(pids.map((id, i) => [id, drawn[i]]));
      pids.forEach((id) => (playerOf(s, id).privateInfo.income = l.incomes![id]));
      return;
    }
    if (step === 'LOBBY') {
      l.lobby = decisions as Record<PlayerId, Lobby>;
      l.revealed = Object.fromEntries(pids.map((id) => [id, l.lobby![id].proposal ?? { ...l.current! }]));
      l.order = g.shuffle(pids.filter((id) => l.lobby![id].proposal !== null));
      return;
    }
    const k = amendIndex(step);
    if (k >= 0) {
      if (k >= l.order.length) {
        finalize(s);
        return;
      }
      const proposer = l.order[k];
      const proposal = l.lobby![proposer].proposal!;
      const votes = decisions as Record<PlayerId, boolean>;
      const yes = Object.values(votes).filter(Boolean).length;
      const passed = yes >= supermajority(pids.length);
      l.amendments.push({ proposer, proposal, statusQuo: { ...l.current! }, votes, yes, passed });
      if (passed) l.current = { ...proposal };
      if (k === l.order.length - 1) finalize(s);
      return;
    }
  },
  talkMenu() {
    return { support: [...BANDS], oppose: [], promise: [] };
  },
  checkStep(_s, phase, msg) {
    if (msg.type !== 'SUPPORT') return undefined;
    return phase.step === 'VEIL' ? 'VEIL' : 'LOBBY';
  },
  messageKept(s, step, msg, d) {
    if (msg.type !== 'SUPPORT') return true;
    if (step === 'VEIL') return bandOf((d as Constitution).t) === msg.option;
    const prop = (d as Lobby).proposal ?? st(s).current!;
    return bandOf(prop.t) === msg.option;
  },
  botIntent(s, botId, phase) {
    if (phase.step === 'VEIL') {
      const { rho } = botParams(s, botId);
      const ce = veilCE(s.players.length, playerOf(s, botId).values, rho);
      const best = ALL_CONSTITUTIONS[argmax(ce)];
      const band = bandOf(best.t);
      return { support: band, decoy: band === 'T_LOW' ? 'T_HIGH' : 'T_LOW' };
    }
    const prop = botProposal(s, botId) ?? st(s).current!;
    const band = bandOf(prop.t);
    return { support: band, decoy: band === 'T_LOW' ? 'T_HIGH' : 'T_LOW' };
  },
  observable: ['VEIL'],
  likelihood(s, _observer, _actor, _step, decision, card) {
    const ce = veilCE(s.players.length, card, BOT.BELIEF_RHO);
    const probs = logitProbs(ce, BOT.BELIEF_LAMBDA);
    const c = decision as Constitution;
    const k = ALL_CONSTITUTIONS.findIndex((x) => same(x, c));
    return probs[k] ?? 0;
  },
  debrief(s) {
    const l = st(s);
    const pids = ids(s);
    if (!l.W) finalize(s);
    const sorted = pids.slice().sort((a, b) => l.incomes![a] - l.incomes![b]);
    const rank = Object.fromEntries(sorted.map((id, k) => [id, k + 1]));
    const deltaT = Object.fromEntries(pids.map((id) => [id, l.revealed![id].t - l.veil![id].t]));
    const xs = pids.map((id) => rank[id]);
    const ys = pids.map((id) => deltaT[id]);
    const mx = mean(xs);
    const my = mean(ys);
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slope = sxx > 0 ? xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0) / sxx : 0;
    const boughtVotes: L5Debrief['boughtVotes'] = [];
    for (const [donor, lb] of Object.entries(l.lobby!)) {
      if (!lb.donateTo || lb.amount <= 0) continue;
      const am = l.amendments.find((a) => a.proposer === donor);
      boughtVotes.push({
        donor,
        recipient: lb.donateTo,
        amount: lb.amount,
        votedYes: am ? !!am.votes[lb.donateTo] : false,
        passed: am ? am.passed : false,
      });
    }
    const human = s.players.find((p) => p.isHuman);
    let verdict: VerdictKey | undefined;
    if (human) {
      const dt = deltaT[human.id];
      const rich = rank[human.id] > pids.length / 2;
      if (Math.abs(dt) <= L5.CONSISTENT_BAND + 1e-9) verdict = 'consistent';
      else if (rich && dt < 0) verdict = dt <= -L5.STRONG_SHIFT + 1e-9 ? 'paydayStrong' : 'paydayMild';
      else if (!rich && dt > 0) verdict = dt >= L5.STRONG_SHIFT - 1e-9 ? 'convenientStrong' : 'convenientMild';
      else if (rich) verdict = 'selfTaxingRich';
      else verdict = 'poorTaxCutter';
    }
    const d: L5Debrief = {
      veil: l.veil!,
      revealed: l.revealed!,
      incomes: l.incomes!,
      rank,
      deltaT,
      slope,
      adopted: l.adopted!,
      final: l.current!,
      amendments: l.amendments,
      donations: Object.fromEntries(pids.map((id) => [id, { to: l.lobby![id].donateTo, amount: l.lobby![id].amount }])),
      boughtVotes,
      verdict,
      W: l.W!,
    };
    l.debrief = d;
    return d;
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    const lobbyDone = !!l.lobby;
    return {
      veil: l.adopted ? l.veil : undefined,
      adopted: l.adopted,
      current: l.current,
      incomes: l.incomesRevealed ? l.incomes : undefined,
      incomesRevealed: l.incomesRevealed,
      lobby: lobbyDone ? l.lobby : undefined,
      order: l.order,
      amendments: l.amendments,
      revealed: lobbyDone ? l.revealed : undefined,
      W: l.W,
      myIncome: l.incomesRevealed ? l.incomes?.[viewer] : undefined,
      debrief: revealPrivate ? l.debrief : undefined,
    };
  },
};

function finalize(s: GameState): void {
  const l = st(s);
  if (l.W) return;
  const pids = ids(s);
  const inc = pids.map((id) => l.incomes![id]);
  const W = withDonations(constitutionWealth(inc, l.current!), s, l.lobby);
  l.W = Object.fromEntries(pids.map((id, i) => [id, W[i]]));
  const passed = l.amendments.filter((a) => a.passed).length;
  const donated = Object.values(l.lobby!).some((x) => x.amount > 0);
  let key = 'l5.noAmendments';
  if (passed && donated) key = 'l5.passedDonations';
  else if (passed) key = 'l5.passed';
  else if (l.amendments.length) key = 'l5.failed';
  finishRound(s, W, equalShares(pids.length), headline(s, key, { t: Math.round(l.current!.t * 100), F: l.current!.F, passed }));
}
