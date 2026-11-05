// Play Episode 1, "Born" (PLAY_V2_SPEC.md Section 4, D-152): vote on the sharing rule before you know your
// income. Round 1 is the pure veil; in round 2 anyone may pay PEEK_COST to see their own income first, and
// everyone sees who peeked. Claims are about votes. Study's Level 1 principles and tax solver are reused;
// Study games never reach this file (the Level 1 dispatcher sends only Play games here).
import { BOT, L1, L5 } from '../params';
import { fairBefore } from './ep5';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, orderedDraws, playerOf, pluralityResolve, pluralityWinnerDist, reliabilityOf } from '../core';
import { afterTaxEqualRebate, PRINCIPLES, solvePrinciple, taxGrid, type PrincipleId } from '../tax';
import { mean } from '../scoring';
import { certaintyEquivalent, logitChoice, logitProbs } from '../bots/utility';
import { principleEU } from '../levels/level1';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import { VALUES_CARDS } from '../types';
import type { LevelDefinition } from '../levels/types';
import { PLAY } from './params';
import { activeEvent, missionScale, missionValue, playEffortShares, playRoundValue, livingCost } from './rules';
import { chooseClaim, credibilityValue, expectedRecord, honestyOf, postClaims, SILENT } from './claims';
import { VALUES_PRIOR } from '../params';

type Gift = { to: PlayerId; amount: number };

export interface P1Round {
  incomes: Record<PlayerId, number>;
  peeked: PlayerId[];
  claims: Record<PlayerId, string>;
  votes: Record<PlayerId, PrincipleId>;
  counts: number[];
  winner: PrincipleId;
  tie: boolean;
  t: number;
  /** After-tax money (before the peek cost and gifts). */
  post: Record<PlayerId, number>;
  W: Record<PlayerId, number>;
  gifts: Record<PlayerId, Gift>;
  inheritance?: PlayerId;
}

export interface P1State {
  /** Incomes are dealt at the start of each round (hidden; the round's peekers see their own). */
  dealt: Record<PlayerId, number>;
  peeked: PlayerId[];
  claims?: Record<PlayerId, string>;
  rounds: P1Round[];
}

const st = (s: GameState) => s.levelState as P1State;
/** D-152: the claims map to Study's principles: Free Market = No Tax (P1), Safety Net (P2), Middle Way = Limit the Gap (P3). */
export const CLAIMABLE: PrincipleId[] = ['P1', 'P2', 'P3'];
const GRID = taxGrid(L1.TAX_GRID_STEP, L1.TAX_GRID_MAX);

/** The numbers in force this round (Play deck, v1 Section 6.2). */
export function p1Params(s: GameState) {
  const ev = activeEvent(s);
  const e = (ev ? (PLAY.L1_EVENTS as Record<string, Record<string, number>>)[ev.id] : null) ?? {};
  const deck = PLAY.L1.INCOME_DECK.map((y) => y * (e.INCOME_MULT ?? 1));
  if (e.TOP_CARD) deck[deck.length - 1] = e.TOP_CARD;
  return { deck, kappa: L1.KAPPA * (e.KAPPA_MULT ?? 1), inheritance: e.INHERITANCE ?? 0 };
}
type P1Params = ReturnType<typeof p1Params>;

export function outcome1(p: PrincipleId, incomes: readonly number[], P: P1Params): { t: number; W: number[] } {
  const t = solvePrinciple(p, incomes, { kappa: P.kappa, floor: L1.FLOOR, rangeCap: L1.RANGE_CAP, grid: GRID });
  return { t, W: afterTaxEqualRebate(incomes, t, P.kappa) };
}

/**
 * A bot's expected Play value if principle `p` wins, over the income draws it can't see: every ordering of
 * the deck, or (after a peek) every ordering of the rest with its own card fixed.
 */
function valueIfWins(s: GameState, i: number, p: PrincipleId, known: number | null, extra: (W: number[]) => number[]): number {
  const P = p1Params(s);
  const n = s.players.length;
  const draws = orderedDraws(P.deck, n).filter((d) => known === null || d[i] === known);
  let total = 0;
  for (const d of draws) total += playRoundValue(s, s.players[i].values, extra(outcome1(p, d, P).W), i, playEffortShares(s), null);
  return total / draws.length;
}

/** Bots' model of another contestant's vote: the Study card model from its beliefs, moved toward its claim. */
function predictVote(s: GameState, obs: PlayerId, actor: PlayerId): number[] {
  const n = s.players.length;
  const belief = s.botBeliefs[obs]?.[actor] ?? VALUES_PRIOR;
  const dist = PRINCIPLES.map(() => 0);
  for (const c of VALUES_CARDS) {
    const ce = PRINCIPLES.map((p) => certaintyEquivalent(principleEU(n, c, BOT.BELIEF_RHO, p), BOT.BELIEF_RHO));
    logitProbs(ce, BOT.BELIEF_LAMBDA).forEach((x, k) => (dist[k] += belief[c] * x));
  }
  const claim = st(s).claims?.[actor];
  if (claim && claim !== SILENT) {
    const k = PRINCIPLES.indexOf(claim as PrincipleId);
    const r = PLAY.CLAIM_WEIGHT * reliabilityOf(s, actor);
    for (let j = 0; j < dist.length; j++) dist[j] = (1 - r) * dist[j] + (j === k ? r : 0);
  }
  return dist;
}

/** A bot's value of voting for each principle: chance each wins with that vote, times its value if it wins. */
function voteValues(s: GameState, pid: PlayerId, known: number | null, gift: Gift | null): number[] {
  const i = idx(s, pid);
  const ifWins = PRINCIPLES.map((p) => valueIfWins(s, i, p, known, (W) => withGift(s, W, i, gift)));
  const dists = ids(s)
    .filter((id) => id !== pid)
    .map((o) => predictVote(s, pid, o));
  return PRINCIPLES.map((_, v) => {
    const mine = PRINCIPLES.map((__, k) => (k === v ? 1 : 0));
    const win = pluralityWinnerDist([mine, ...dists], PRINCIPLES.length);
    return win.reduce((a, w, k) => a + w * ifWins[k], 0);
  });
}

function withGift(s: GameState, W: number[], i: number, g: Gift | null): number[] {
  if (!g) return W;
  const out = W.slice();
  out[i] -= g.amount;
  out[idx(s, g.to)] += g.amount;
  return out;
}

const knownIncome = (s: GameState, pid: PlayerId): number | null => (st(s).peeked.includes(pid) ? st(s).dealt[pid] : null);

/** The vote a bot intends now (its best principle), used for its claim. */
function intendedVote(s: GameState, pid: PlayerId): PrincipleId {
  const u = voteValues(s, pid, knownIncome(s, pid), null);
  return PRINCIPLES[u.indexOf(Math.max(...u))];
}

/** Peek: pay to see your income when its value of information beats the cost (logit, like every bot choice). */
function botPeek(s: GameState, pid: PlayerId): boolean {
  const P = p1Params(s);
  const i = idx(s, pid);
  const deck = P.deck;
  const blind = Math.max(...voteValues(s, pid, null, null));
  let informed = 0;
  for (const y of deck) informed += Math.max(...voteValues(s, pid, y, null)) / deck.length;
  // The peek cost is paid from this round's money: its value is the drop in Play value of PEEK_COST coins.
  const W0 = s.players.map(() => mean(deck));
  const costPts = playRoundValue(s, s.players[i].values, W0, i, playEffortShares(s), null) - playRoundValue(s, s.players[i].values, W0.map((w, j) => (j === i ? w - PLAY.PEEK_COST : w)), i, playEffortShares(s), null);
  return logitChoice([blind, informed - costPts], botParams(s, pid).lambda, botRng(s)) === 1;
}

function bestGift(s: GameState, pid: PlayerId, vote: PrincipleId): Gift | null {
  const i = idx(s, pid);
  const known = knownIncome(s, pid);
  const base = valueIfWins(s, i, vote, known, (W) => W);
  let best: { g: Gift | null; u: number } = { g: null, u: base };
  for (const p of s.players) {
    if (p.id === pid) continue;
    for (const a of PLAY.GIFT_AMOUNTS) {
      const g = { to: p.id, amount: a };
      const u = valueIfWins(s, i, vote, known, (W) => withGift(s, W, i, g));
      if (u > best.u + 0.5) best = { g, u };
    }
  }
  return best.g;
}

// ---------------------------------------------------------------------------------------------------------

export interface P1Preview {
  /** Mission points if each rule wins, against the average over the rules (under the bots' model). */
  vote: Record<PrincipleId, number>;
  gift: Record<PlayerId, Record<number, number>>;
}

function missionPts(s: GameState, i: number, p: PrincipleId, known: number | null, g: Gift | null): number {
  const P = p1Params(s);
  const card = s.players[i].values;
  const draws = orderedDraws(P.deck, s.players.length).filter((d) => known === null || d[i] === known);
  let tot = 0;
  for (const d of draws) {
    const W = withGift(s, outcome1(p, d, P).W, i, g);
    const banks = s.players.map((x, j) => s.play!.banks[x.id] + W[j] - livingCost(s));
    tot += PLAY.MISSION_WEIGHT * missionScale(s, card) * missionValue(card, banks, i, playEffortShares(s));
  }
  return tot / draws.length;
}

export function p1Preview(s: GameState, pid: PlayerId): P1Preview {
  const i = idx(s, pid);
  const known = knownIncome(s, pid);
  const by = PRINCIPLES.map((p) => missionPts(s, i, p, known, null));
  const avg = mean(by);
  const vote = Object.fromEntries(PRINCIPLES.map((p, k) => [p, by[k] - avg])) as Record<PrincipleId, number>;
  const gift: P1Preview['gift'] = {};
  for (const o of s.players) {
    if (o.id === pid) continue;
    gift[o.id] = {};
    for (const a of PLAY.GIFT_AMOUNTS) gift[o.id][a] = mean(PRINCIPLES.map((p) => missionPts(s, i, p, known, { to: o.id, amount: a }))) - avg;
  }
  return { vote, gift };
}

// ---------------------------------------------------------------------------------------------------------

export const playLevel1: LevelDefinition = {
  id: 1,
  rounds: PLAY.L1.ROUNDS,
  init(s) {
    s.levelState = { dealt: {}, peeked: [], rounds: [] } satisfies P1State;
    const pl = s.play!;
    pl.joint = {};
    pl.belief = {};
    pl.belief2 = {};
  },
  phases(s) {
    const out: Phase[] = [];
    for (let r = 1; r <= PLAY.L1.ROUNDS; r++) {
      out.push({ kind: 'BRIEFING', round: r });
      // R4 (D-161): in a life, the unpaid "What tax rate is fair?" before birth (v1 Section 5, Episode 1).
      if (r === 1 && s.mode === 'LIFE') out.push({ kind: 'DECIDE', step: 'FAIR_1', round: 1 });
      if (r >= PLAY.L1.PEEK_FROM_ROUND) out.push({ kind: 'DECIDE', step: 'PEEK', round: r });
      out.push({ kind: 'DECIDE', step: 'CLAIM', round: r }, { kind: 'DECIDE', step: 'VOTE', round: r }, { kind: 'REVEAL', step: 'VOTE', round: r }, { kind: 'ROUND_SUMMARY', round: r });
    }
    out.push({ kind: 'REVEAL', step: 'CARDS', round: PLAY.L1.ROUNDS });
    return out;
  },
  onEnter(s, phase) {
    const l = st(s);
    if (phase.kind === 'BRIEFING') {
      // Incomes are dealt before anyone decides, so a peek shows the card that will count.
      const P = p1Params(s);
      const drawn = gameRng(s).shuffle(P.deck).slice(0, s.players.length);
      l.dealt = Object.fromEntries(ids(s).map((id, k) => [id, drawn[k]]));
      l.peeked = [];
      l.claims = undefined;
      for (const p of s.players) delete p.privateInfo.income;
    }
    if (phase.kind === 'REVEAL' && phase.step === 'CARDS') {
      // v2 3.4: every vote claim is stamped TRUE or LIE against the vote, and feeds the record.
      for (const m of s.messages) {
        if (m.level !== s.levelIndex || m.resolved || m.msg.type !== 'CLAIM') continue;
        m.resolved = true;
        m.kept = l.rounds[m.round - 1]?.votes[m.from] === m.msg.value;
        s.reliability[m.from].made++;
        if (m.kept) s.reliability[m.from].kept++;
      }
    }
  },
  deciders(s) {
    return ids(s);
  },
  validate(s, step, pid, d) {
    if (step === 'PEEK') return typeof d === 'boolean' ? d : null;
    if (step === 'FAIR_1') return L5.TAX_OPTIONS.some((t) => Math.abs(t - (d as number)) < 1e-9) ? d : null;
    if (step === 'CLAIM') return d === SILENT || CLAIMABLE.includes(d as PrincipleId) ? d : null;
    const c = d as { vote?: unknown; gift?: Gift | null };
    if (!c || !PRINCIPLES.includes(c.vote as PrincipleId)) return null;
    const gf = c.gift;
    const gift = gf && typeof gf.to === 'string' && gf.to !== pid && ids(s).includes(gf.to) && PLAY.GIFT_AMOUNTS.includes(gf.amount) ? { to: gf.to, amount: gf.amount } : null;
    return { vote: c.vote, gift };
  },
  botDecide(s, botId, step) {
    if (step === 'PEEK') return botPeek(s, botId);
    if (step === 'FAIR_1') return fairBefore(s, botId);
    if (step === 'CLAIM') {
      const v = intendedVote(s, botId);
      // Talk does not move a bot's own payoff in this model, so a lie never gains coins (lieGain 0): a bot claims
      // its intended vote when it can be claimed, else stays silent.
      return chooseClaim(s, botId, CLAIMABLE.includes(v) ? v : SILENT, CLAIMABLE.includes(v) ? v : 'P2', () => 0).value;
    }
    const u = voteValues(s, botId, knownIncome(s, botId), null);
    let vote = PRINCIPLES[logitChoice(u, botParams(s, botId).lambda, botRng(s))];
    // D-152: a bot that claimed a vote keeps it unless breaking it pays, by the v2 3.5 lie rule: the gain over
    // the claimed rule, times (1 - honesty), against CREDIBILITY_VALUE x the record it loses when the vote flips.
    const claimed = st(s).claims?.[botId];
    if (claimed && claimed !== SILENT) {
      const best = u.indexOf(Math.max(...u));
      const gain = u[best] - u[PRINCIPLES.indexOf(claimed as PrincipleId)];
      const loss = credibilityValue(s) * (expectedRecord(s, botId, 'TRUE') - expectedRecord(s, botId, 'LIE'));
      vote = gain * (1 - honestyOf(s, botId)) > loss + 1e-9 ? PRINCIPLES[best] : (claimed as PrincipleId);
    }
    return { vote, gift: bestGift(s, botId, vote) };
  },
  resolve(s, step, decisions) {
    const l = st(s);
    if (step === 'FAIR_1') {
      s.play!.fairFirst = decisions as Record<PlayerId, number>;
      return;
    }
    if (step === 'PEEK') {
      l.peeked = ids(s).filter((id) => decisions[id] === true);
      for (const id of l.peeked) playerOf(s, id).privateInfo.income = l.dealt[id];
      return;
    }
    if (step === 'CLAIM') {
      const said = Object.fromEntries(ids(s).map((id) => [id, decisions[id] as string]));
      l.claims = said;
      // The truth of a vote claim is only known at the vote; the claim log records it then.
      postClaims(s, 'VOTE', said, () => '', () => false, Object.fromEntries(ids(s).map((id) => [id, playerOf(s, id).isHuman ? null : 0])));
      return;
    }
    const P = p1Params(s);
    const g = gameRng(s);
    const pids = ids(s);
    const ds = pids.map((id) => decisions[id] as { vote: PrincipleId; gift: Gift | null });
    const { winner, tie, counts } = pluralityResolve(
      ds.map((d) => PRINCIPLES.indexOf(d.vote)),
      PRINCIPLES.length,
      g,
    );
    const p = PRINCIPLES[winner];
    const inc = pids.map((id) => l.dealt[id]);
    const out = outcome1(p, inc, P);
    let W = out.W.map((w, i) => w - (l.peeked.includes(pids[i]) ? PLAY.PEEK_COST : 0));
    let inheritance: PlayerId | undefined;
    if (P.inheritance) {
      const k = Math.floor(g.next() * pids.length);
      inheritance = pids[k];
      W[k] += P.inheritance;
    }
    const gifts: Record<PlayerId, Gift> = {};
    ds.forEach((d, i) => {
      if (d.gift) {
        gifts[pids[i]] = d.gift;
        W = withGift(s, W, i, d.gift);
      }
    });
    // The claim log gets each claim's truth now that the vote is in (S-a, lie success).
    for (const c of s.play!.claimLog) if (c.level === s.levelIndex && c.round === s.round) {
      c.truth = (decisions[c.pid] as { vote: string }).vote;
      c.lied = c.said !== SILENT && c.said !== c.truth;
    }
    l.rounds.push({
      incomes: { ...l.dealt },
      peeked: [...l.peeked],
      claims: { ...(l.claims ?? {}) },
      votes: Object.fromEntries(pids.map((id, i) => [id, ds[i].vote])),
      counts,
      winner: p,
      tie,
      t: out.t,
      post: Object.fromEntries(pids.map((id, i) => [id, out.W[i]])),
      W: Object.fromEntries(pids.map((id, i) => [id, W[i]])),
      gifts,
      ...(inheritance ? { inheritance } : {}),
    });
    for (const p2 of s.players) p2.privateInfo.income = l.dealt[p2.id];
    finishRound(s, W, playEffortShares(s), headline(s, `l1.play.${p}`, {}));
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
  observable: ['VOTE'],
  likelihood(s, _observer, actor, _step, decision, card) {
    // A peeker votes from its income, not its mission: its vote says nothing about its card (D-152).
    const r = st(s).rounds[st(s).rounds.length - 1];
    if (r?.peeked.includes(actor) || st(s).peeked.includes(actor)) return 1;
    const n = s.players.length;
    const vote = (decision as { vote?: PrincipleId })?.vote;
    const ce = PRINCIPLES.map((p) => certaintyEquivalent(principleEU(n, card, BOT.BELIEF_RHO, p), BOT.BELIEF_RHO));
    return logitProbs(ce, BOT.BELIEF_LAMBDA)[PRINCIPLES.indexOf(vote as PrincipleId)] ?? 0;
  },
  debrief(s) {
    return { rounds: st(s).rounds };
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    const inRoundRevealed = s.phase.kind === 'REVEAL' || s.phase.kind === 'ROUND_SUMMARY' || s.phase.kind === 'GUESS' || s.phase.kind === 'LEVEL_DEBRIEF';
    const myIncome = l.peeked.includes(viewer) || revealPrivate ? l.dealt[viewer] : undefined;
    return {
      rounds: l.rounds,
      peeked: l.peeked,
      claims: l.claims,
      myIncome: inRoundRevealed ? undefined : myIncome,
      deck: p1Params(s).deck,
      peekCost: PLAY.PEEK_COST,
      preview: s.phase.kind === 'DECIDE' && s.phase.step === 'VOTE' && s.players.some((p) => p.id === viewer) ? p1Preview(s, viewer) : undefined,
    };
  },
};

/** Near-miss hooks (v2 6.1). */
export function p1Plans(s: GameState, h: PlayerId): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  st(s).rounds.forEach((r, k) => {
    const round = k + 1;
    if (round >= PLAY.L1.PEEK_FROM_ROUND) out[`${round}:PEEK`] = r.peeked.includes(h);
    out[`${round}:CLAIM`] = r.claims[h] ?? SILENT;
    out[`${round}:VOTE`] = { vote: r.votes[h], gift: r.gifts[h] ?? null };
  });
  return out;
}

export function p1Tries(_s: GameState, k: string, value: unknown): Array<{ value: unknown; from: unknown; to: unknown; kind: string }> {
  const stepId = k.split(':')[1];
  if (stepId === 'PEEK') return [{ value: !value, from: value, to: !value, kind: 'PEEK' }];
  if (stepId === 'VOTE') {
    const v = value as { vote: PrincipleId; gift: Gift | null };
    return PRINCIPLES.filter((p) => p !== v.vote).map((p) => ({ value: { ...v, vote: p }, from: v.vote, to: p, kind: 'VOTE' }));
  }
  return [];
}

export type { ValuesCard };
