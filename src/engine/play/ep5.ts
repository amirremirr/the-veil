// Play Episode 5, "Grand Finale: Rewrite the Rules" (PLAY_V2_SPEC.md Section 4, D-154): write the rules behind
// the veil, see where you stand, then propose amendments, buy votes in secret (up to DONATION_MAX), claim how
// you'll vote, and watch the ballots land. Study's Level 5 constitutions, floor top-up and supermajority are
// reused; Study games never reach this file.
import { BOT, L5 } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, lowerMedian, orderedDraws, playerOf, reliabilityOf } from '../core';
import { equalShares, mean, valuesMetric } from '../scoring';
import { argmax, logitChoice, logitProbs } from '../bots/utility';
import { ALL_CONSTITUTIONS, bandOf, constitutionWealth, olsSlope, supermajority, veilCE, type Constitution } from '../levels/level5';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import type { LevelDefinition } from '../levels/types';
import { PLAY } from './params';
import { activeEvent, missionScale, missionValue, playEffortShares, playRoundValue, livingCost, setRoundLedger } from './rules';
import { chooseClaim, credibilityValue, expectedRecord, honestyOf, postClaims, SILENT } from './claims';

export interface Lobby5 {
  donateTo: PlayerId | null;
  amount: number;
  proposal: Constitution | null;
}

export interface Amend5 {
  proposer: PlayerId;
  proposal: Constitution;
  statusQuo: Constitution;
  votes: Record<PlayerId, boolean>;
  claims: Record<PlayerId, string>;
  yes: number;
  need: number;
  passed: boolean;
  withdrawn?: boolean;
}

export interface P5State {
  veil?: Record<PlayerId, Constitution>;
  adopted?: Constitution;
  current?: Constitution;
  incomes?: Record<PlayerId, number>;
  incomesRevealed: boolean;
  fair1?: Record<PlayerId, number>;
  fair2?: Record<PlayerId, number>;
  lobby?: Record<PlayerId, Lobby5>;
  order: PlayerId[];
  /** Per voter, per proposer: "YES", "NO" or SILENT. */
  claims?: Record<PlayerId, Record<PlayerId, string>>;
  amendments: Amend5[];
  W?: Record<PlayerId, number>;
}

const st = (s: GameState) => s.levelState as P5State;
const same = (a: Constitution, b: Constitution) => Math.abs(a.t - b.t) < 1e-9 && a.F === b.F;
const snap = (x: number, grid: readonly number[]) => grid.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) - 1e-9 ? b : a), grid[0]);
const amendIndex = (step: string) => (step.startsWith('AMEND_') ? Number(step.slice(6)) : -1);

export function p5Params(s: GameState) {
  const ev = activeEvent(s) ?? (s.play?.event && s.play.event.level === 5 && s.play.event.id !== 'QUIET' ? s.play.event : null);
  const e = (ev ? (PLAY.L5_EVENTS as Record<string, Record<string, number>>)[ev.id] : null) ?? {};
  const n = s.players.length;
  return { maxDonation: e.DONATION_MAX ?? PLAY.L5.DONATION_MAX, leaked: ev?.id === 'LEAKED_RECEIPTS', need: e.ALL_BUT_ONE ? Math.max(1, n - 1) : supermajority(n) };
}

/** The deck incomes come from in a single episode (v1: Study's deck times 2). */
export const p5Deck = () => L5.INCOME_DECK.map((y) => y * PLAY.L5.INCOME_SCALE);

function withDonations(s: GameState, W: number[], lobby: Record<PlayerId, Lobby5> | undefined): number[] {
  if (!lobby) return W;
  const out = W.slice();
  for (const [from, l] of Object.entries(lobby)) {
    if (!l.donateTo || l.amount <= 0) continue;
    out[idx(s, from)] -= l.amount;
    out[idx(s, l.donateTo)] += l.amount;
  }
  return out;
}

const value = (s: GameState, i: number, W: number[]) => playRoundValue(s, s.players[i].values, W, i, playEffortShares(s), null);

/** Behind the veil, a bot's Play value of each constitution over every deal of the deck. */
function veilValues(s: GameState, i: number): number[] {
  const draws = orderedDraws(p5Deck(), s.players.length);
  return ALL_CONSTITUTIONS.map((c) => mean(draws.map((inc) => value(s, i, constitutionWealth(inc, c)))));
}

function incomesOf(s: GameState): number[] {
  return ids(s).map((id) => st(s).incomes![id]);
}

/**
 * D-155: in a life the incomes are the banks (debt counts as 0 for the tax base), and the rules redistribute
 * them: the round's money is the after-rules amount minus the bank it came from, plus the living cost, so the
 * bank becomes the after-rules amount (a debt stays). In a single episode the after-rules amount is the money.
 */
function asRound(s: GameState, W: number[]): number[] {
  if (s.mode !== 'LIFE') return W;
  const base = incomesOf(s);
  return W.map((w, j) => w - base[j] + livingCost(s));
}

/** A bot's proposal: its sigma mix of the mission-best and the money-best constitution, as Study. */
function botProposal(s: GameState, pid: PlayerId): Constitution | null {
  const i = idx(s, pid);
  const inc = incomesOf(s);
  const Ws = ALL_CONSTITUTIONS.map((c) => asRound(s, constitutionWealth(inc, c)));
  // G2 (D-188): the Play value already weighs the bot's own bank and its mission; Study's extra pull toward
  // the money-best constitution (sigma) counted own money twice, so the proposal is the Play-value best.
  const prop = PLAY.L5.PROPOSAL_PLAY_VALUE
    ? ALL_CONSTITUTIONS[argmax(Ws.map((W) => value(s, i, W)))]
    : (() => {
        const { sigma } = botParams(s, pid);
        const bestS = ALL_CONSTITUTIONS[argmax(Ws.map((W) => value(s, i, W)))];
        const bestW = ALL_CONSTITUTIONS[argmax(Ws.map((W) => W[i]))];
        return { t: snap((1 - sigma) * bestS.t + sigma * bestW.t, L5.TAX_OPTIONS), F: snap((1 - sigma) * bestS.F + sigma * bestW.F, L5.FLOOR_OPTIONS) };
      })();
  return same(prop, st(s).current!) ? null : prop;
}

function passProbability(s: GameState, pid: PlayerId, prop: Constitution, target: PlayerId | null, d: number, P: ReturnType<typeof p5Params>): number {
  const inc = incomesOf(s);
  const Wa = constitutionWealth(inc, prop);
  const Wc = constitutionWealth(inc, st(s).current!);
  const claims = st(s).claims;
  const ps = ids(s).map((id, j) => {
    if (id === pid) return 1;
    let p = Wa[j] > Wc[j] + 1e-9 ? BOT.VOTE_PREDICT_CONFIDENCE : Wa[j] < Wc[j] - 1e-9 ? 1 - BOT.VOTE_PREDICT_CONFIDENCE : 0.5;
    // R1 (D-158): a vote claim on this amendment moves the prediction toward it by the voter's record, (kept + 1) / (made + 2).
    const c = claims?.[id]?.[pid];
    if (c === 'YES' || c === 'NO') {
      const r = reliabilityOf(s, id);
      p = r * (c === 'YES' ? 1 : 0) + (1 - r) * p;
    }
    if (id === target) p = Math.min(1, p + (PLAY.L5.RECIPROCITY * d) / P.maxDonation);
    return p;
  });
  let dist = [1];
  for (const p of ps) {
    const next = new Array(dist.length + 1).fill(0);
    dist.forEach((q, k) => {
      next[k] += q * (1 - p);
      next[k + 1] += q * p;
    });
    dist = next;
  }
  return dist.slice(P.need).reduce((a, b) => a + b, 0);
}

/**
 * R1 (D-158): a donor funds only delegates who claimed "I'll vote yes" on its amendment, choosing the one and the
 * amount that raise its expected Play value most, by the pass chance (which counts each claim by its record).
 * `claimsOverride` lets a voter ask what this donor would do if it claimed differently.
 */
function donorPlan(s: GameState, pid: PlayerId, logit: boolean, claimsOverride?: Record<PlayerId, Record<PlayerId, string>>): { to: PlayerId | null; d: number } {
  const l = st(s);
  const prop = l.lobby?.[pid]?.proposal;
  if (!prop) return { to: null, d: 0 };
  const saved = l.claims;
  if (claimsOverride) l.claims = claimsOverride;
  const P = p5Params(s);
  const i = idx(s, pid);
  const inc = incomesOf(s);
  const Wa = asRound(s, constitutionWealth(inc, prop));
  const Wc = asRound(s, constitutionWealth(inc, st(s).current!));
  const amounts = PLAY.L5.DONATION_OPTIONS_BOT.filter((a) => a <= P.maxDonation);
  const combos: Array<{ to: PlayerId | null; d: number }> = [{ to: null, d: 0 }];
  for (const to of ids(s)) if (to !== pid && l.claims?.[to]?.[pid] === 'YES') for (const d of amounts) if (d > 0) combos.push({ to, d });
  const u = combos.map(({ to, d }) => {
    const shift = (W: number[]) => {
      const out = W.slice();
      if (to) {
        out[i] -= d;
        out[idx(s, to)] += d;
      }
      return out;
    };
    const p = passProbability(s, pid, prop, to, d, P);
    return p * value(s, i, shift(Wa)) + (1 - p) * value(s, i, shift(Wc));
  });
  l.claims = saved;
  const k = logit ? logitChoice(u, botParams(s, pid).lambda, botRng(s)) : argmax(u);
  return combos[k];
}

/** What every voter intends on each amendment now (the claim it would make if it told the truth). */
function intents(s: GameState): Record<PlayerId, Record<PlayerId, string>> {
  const l = st(s);
  return Object.fromEntries(ids(s).map((v) => [v, Object.fromEntries(l.order.map((p, k) => [p, p === v ? 'YES' : pYes(s, v, k, l.current!).p >= 0.5 ? 'YES' : 'NO']))]));
}

/** Coins a vote claim on `proposer`'s amendment is worth to `pid`: the donation it would draw (others assumed truthful). */
function claimDonation(s: GameState, pid: PlayerId, proposer: PlayerId, value: string, base: Record<PlayerId, Record<PlayerId, string>>): number {
  const c = { ...base, [pid]: { ...base[pid], [proposer]: value } };
  const plan = donorPlan(s, proposer, false, c);
  return plan.to === pid ? plan.d : 0;
}

/** A bot's chance of voting yes on amendment k: logit on its Play value, plus reciprocity to a donor (Study). */
function pYes(s: GameState, pid: PlayerId, k: number, statusQuo: Constitution): { p: number; gap: number } {
  const l = st(s);
  const a = l.lobby![l.order[k]];
  const i = idx(s, pid);
  const inc = incomesOf(s);
  const Sa = value(s, i, withDonations(s, asRound(s, constitutionWealth(inc, a.proposal!)), l.lobby));
  const Sc = value(s, i, withDonations(s, asRound(s, constitutionWealth(inc, statusQuo)), l.lobby));
  let p = logitProbs([Sa, Sc], botParams(s, pid).lambda)[0];
  if (a.donateTo === pid) p = Math.min(1, p + (PLAY.L5.RECIPROCITY * a.amount) / p5Params(s).maxDonation);
  return { p, gap: Sa - Sc };
}

function metricBestTax(s: GameState, card: ValuesCard, F: number, i: number, incomes: number[][]): number {
  const eq = equalShares(s.players.length);
  const vals = L5.TAX_OPTIONS.map((t) => mean(incomes.map((inc) => valuesMetric(card, constitutionWealth(inc, { t, F }), i, eq))));
  return L5.TAX_OPTIONS[argmax(vals)];
}

/** Study's fair-answer rule (programmed: E5 is labeled as such): the mission's best tax, mixed toward the money-best tax once incomes are known. */
/** R4 (D-161): the first fair answer before anything is known (no floor yet), as Episode 5's "before". Programmed, as E5. */
export function fairBefore(s: GameState, pid: PlayerId): number {
  return metricBestTax(s, playerOf(s, pid).values, 0, 0, orderedDraws(p5Deck(), s.players.length));
}

function botFair(s: GameState, pid: PlayerId, after: boolean): number {
  const l = st(s);
  const me = playerOf(s, pid);
  const F = l.current?.F ?? 0;
  if (!after) return metricBestTax(s, me.values, F, 0, orderedDraws(p5Deck(), s.players.length));
  const i = idx(s, pid);
  const inc = incomesOf(s);
  const tM = metricBestTax(s, me.values, F, i, [inc]);
  const tW = L5.TAX_OPTIONS[argmax(L5.TAX_OPTIONS.map((t) => constitutionWealth(inc, { t, F })[i]))];
  const { sigma } = botParams(s, pid);
  return snap((1 - sigma) * tM + sigma * tW, L5.TAX_OPTIONS);
}

function finalize(s: GameState): void {
  const l = st(s);
  if (l.W) return;
  const W = withDonations(s, asRound(s, constitutionWealth(incomesOf(s), l.current!)), l.lobby);
  l.W = Object.fromEntries(ids(s).map((id, i) => [id, W[i]]));
  // G1: the money lines. In a life the rules act on the banks and the finale covers the living cost (asRound).
  const inc = incomesOf(s);
  const after = constitutionWealth(inc, l.current!);
  const don = withDonations(s, inc.map(() => 0), l.lobby);
  setRoundLedger(s, Object.fromEntries(ids(s).map((id, i) => [id, [
    { k: 'income' as const, n: s.mode === 'LIFE' ? livingCost(s) : inc[i] },
    { k: 'rule' as const, n: after[i] - inc[i] },
    { k: 'donation' as const, n: don[i] },
  ]])));
  finishRound(s, W, playEffortShares(s), headline(s, 'l5.play', {}));
}

export interface P5Preview {
  /** Mission points of each constitution (veil: expected over the deck; later: on the known incomes), against the average. */
  constitutions: number[];
}

export function p5Preview(s: GameState, pid: PlayerId): P5Preview {
  const i = idx(s, pid);
  const card = s.players[i].values;
  const l = st(s);
  const pts = (W: number[]) => {
    const banks = s.players.map((p, j) => s.play!.banks[p.id] + W[j] - livingCost(s));
    return PLAY.MISSION_WEIGHT * missionScale(s, card) * missionValue(card, banks, i, playEffortShares(s));
  };
  const draws = l.incomes ? [incomesOf(s)] : orderedDraws(p5Deck(), s.players.length);
  const by = ALL_CONSTITUTIONS.map((c) => mean(draws.map((inc) => pts(l.incomes ? asRound(s, constitutionWealth(inc, c)) : constitutionWealth(inc, c)))));
  const avg = mean(by);
  return { constitutions: by.map((x) => x - avg) };
}

export const playLevel5: LevelDefinition = {
  id: 5,
  rounds: 1,
  init(s) {
    s.levelState = { incomesRevealed: false, order: [], amendments: [] } satisfies P5State;
    // R4 (D-161): in a life, the first fair answer was given before birth, in Episode 1.
    if (s.mode === 'LIFE' && s.play!.fairFirst) (s.levelState as P5State).fair1 = { ...s.play!.fairFirst };
    const pl = s.play!;
    pl.joint = {};
    pl.belief = {};
    pl.belief2 = {};
  },
  phases(s) {
    const out: Phase[] = [
      { kind: 'BRIEFING', round: 1 },
      { kind: 'DECIDE', step: 'VEIL', round: 1 },
      ...(s.mode === 'LIFE' && s.play!.fairFirst ? [] : [{ kind: 'DECIDE' as const, step: 'FAIR_1', round: 1 }]),
      { kind: 'REVEAL', step: 'INCOMES', round: 1 },
      { kind: 'DECIDE', step: 'FAIR_2', round: 1 },
      { kind: 'DECIDE', step: 'CLAIM', round: 1 },
      { kind: 'DECIDE', step: 'LOBBY', round: 1 },
    ];
    for (let k = 0; k < s.players.length; k++) out.push({ kind: 'DECIDE', step: `AMEND_${k}`, round: 1 });
    out.push({ kind: 'REVEAL', step: 'AMENDMENTS', round: 1 }, { kind: 'ROUND_SUMMARY', round: 1 });
    return out;
  },
  onEnter(s, phase) {
    if (phase.kind === 'REVEAL' && phase.step === 'INCOMES') st(s).incomesRevealed = true;
    if (phase.kind === 'REVEAL' && phase.step === 'AMENDMENTS') {
      // Every vote claim is stamped against the ballot, and feeds the record.
      const l = st(s);
      for (const m of s.messages) {
        if (m.level !== s.levelIndex || m.resolved || m.msg.type !== 'CLAIM') continue;
        m.resolved = true;
        const [proposer, said] = m.msg.value.split(':');
        const a = l.amendments.find((x) => x.proposer === proposer && !x.withdrawn);
        m.kept = !a || a.votes[m.from] === (said === 'YES');
        s.reliability[m.from].made++;
        if (m.kept) s.reliability[m.from].kept++;
      }
    }
  },
  deciders(s, step) {
    const k = amendIndex(step);
    const l = st(s);
    if (step === 'CLAIM') return l.order.length ? ids(s) : [];
    if (step === 'LOBBY') return l.order.slice().sort((a, b) => idx(s, a) - idx(s, b));
    if (k >= 0) {
      if (l.order.length <= k) return [];
      return same(l.lobby![l.order[k]].proposal!, l.current!) ? [] : ids(s);
    }
    return ids(s);
  },
  validate(s, step, pid, d) {
    const okC = (c: unknown): c is Constitution => !!c && L5.TAX_OPTIONS.some((t) => Math.abs(t - (c as Constitution).t) < 1e-9) && L5.FLOOR_OPTIONS.includes((c as Constitution).F);
    if (step === 'VEIL') return okC(d) ? { t: (d as Constitution).t, F: (d as Constitution).F } : null;
    const okT = (x: unknown) => L5.TAX_OPTIONS.some((t) => Math.abs(t - (x as number)) < 1e-9);
    if (step === 'FAIR_1') return okT(d) ? d : null;
    if (step === 'FAIR_2') {
      // R1: the second fair answer and the amendment proposal are one screen.
      const c = (typeof d === 'number' ? { fair: d, proposal: null } : d) as { fair?: unknown; proposal?: unknown };
      if (!c || !okT(c.fair)) return null;
      if (c.proposal !== null && c.proposal !== undefined && !okC(c.proposal)) return null;
      const pr = c.proposal as Constitution | null | undefined;
      return { fair: c.fair, proposal: pr ? { t: pr.t, F: pr.F } : null };
    }
    if (step === 'LOBBY') {
      const l = d as Lobby5;
      if (!l || typeof l !== 'object') return null;
      const amount = Math.round(Number(l.amount) || 0);
      if (amount < 0 || amount > p5Params(s).maxDonation) return null;
      const to = amount > 0 ? l.donateTo : null;
      if (to && (to === pid || idx(s, to) < 0)) return null;
      return { donateTo: to, amount: to ? amount : 0 };
    }
    if (step === 'CLAIM') {
      const c = d as Record<string, unknown>;
      if (!c || typeof c !== 'object') return null;
      return Object.fromEntries(st(s).order.map((p) => [p, c[p] === 'YES' || c[p] === 'NO' ? c[p] : SILENT]));
    }
    if (amendIndex(step) >= 0) return typeof d === 'boolean' ? d : null;
    return null;
  },
  botDecide(s, pid, step) {
    const l = st(s);
    if (step === 'VEIL') {
      const u = veilValues(s, idx(s, pid));
      return ALL_CONSTITUTIONS[logitChoice(u, botParams(s, pid).lambda, botRng(s))];
    }
    if (step === 'FAIR_1') return botFair(s, pid, false);
    if (step === 'FAIR_2') return { fair: botFair(s, pid, true), proposal: botProposal(s, pid) };
    if (step === 'LOBBY') {
      const plan = donorPlan(s, pid, true);
      return { donateTo: plan.to, amount: plan.d };
    }
    if (step === 'CLAIM') {
      // R1 (D-158): a "yes" can draw a donation, so a bot that intends "no" may claim "yes" (the v2 3.5 rule).
      const base = intents(s);
      return Object.fromEntries(
        l.order.map((p) => {
          if (p === pid) return [p, 'YES'];
          const truth = base[pid][p];
          return [p, chooseClaim(s, pid, truth, 'YES', (v) => (v === SILENT ? 0 : claimDonation(s, pid, p, v, base))).value];
        }),
      );
    }
    const k = amendIndex(step);
    const { p, gap } = pYes(s, pid, k, l.current!);
    let vote = botRng(s).next() < p;
    // A claimed vote is kept unless breaking it pays by the v2 3.5 rule (as Episode 1, D-152).
    const claimed = l.claims?.[pid]?.[l.order[k]];
    if (claimed === 'YES' || claimed === 'NO') {
      const want = claimed === 'YES';
      const gain = want ? -gap : gap;
      const loss = credibilityValue(s) * (expectedRecord(s, pid, 'TRUE') - expectedRecord(s, pid, 'LIE'));
      vote = gain * (1 - honestyOf(s, pid)) > loss + 1e-9 ? !want : want;
    }
    return vote;
  },
  resolve(s, step, decisions) {
    const l = st(s);
    const pids = ids(s);
    const g = gameRng(s);
    if (step === 'VEIL') {
      l.veil = decisions as Record<PlayerId, Constitution>;
      l.adopted = { t: lowerMedian(pids.map((id) => l.veil![id].t)), F: lowerMedian(pids.map((id) => l.veil![id].F)) };
      l.current = { ...l.adopted };
      const drawn = g.shuffle(p5Deck()).slice(0, pids.length);
      // The draw is always taken, so the game stream is the same in both modes; a life uses the banks.
      l.incomes = Object.fromEntries(pids.map((id, i) => [id, s.mode === 'LIFE' ? Math.max(0, Math.round(s.play!.banks[id])) : drawn[i]]));
      return;
    }
    if (step === 'FAIR_1') {
      l.fair1 = decisions as Record<PlayerId, number>;
      return;
    }
    if (step === 'FAIR_2') {
      const ds = decisions as Record<PlayerId, { fair: number; proposal: Constitution | null }>;
      l.fair2 = Object.fromEntries(pids.map((id) => [id, ds[id].fair]));
      for (const p of s.players) p.privateInfo.income = l.incomes![p.id];
      l.lobby = Object.fromEntries(pids.map((id) => [id, { donateTo: null, amount: 0, proposal: ds[id].proposal && !same(ds[id].proposal!, l.current!) ? ds[id].proposal : null }]));
      l.order = g.shuffle(pids.filter((id) => l.lobby![id].proposal !== null));
      if (!l.order.length) finalize(s);
      return;
    }
    if (step === 'LOBBY') {
      for (const [id, dn] of Object.entries(decisions as Record<PlayerId, { donateTo: PlayerId | null; amount: number }>)) l.lobby![id] = { ...l.lobby![id], donateTo: dn.donateTo, amount: dn.amount };
      // A recipient knows what it was given (privately); everyone else learns at the ballots, unless Leaked Receipts.
      for (const [from, lb] of Object.entries(l.lobby!)) if (lb.donateTo) playerOf(s, lb.donateTo).privateInfo[`gift_${from}`] = lb.amount;
      return;
    }
    if (step === 'CLAIM') {
      l.claims = decisions as Record<PlayerId, Record<PlayerId, string>>;
      // One claim message per voter per amendment ("proposer:YES"); silence is logged too.
      const base = intents(s);
      for (const proposer of l.order) {
        const said = Object.fromEntries(pids.map((id) => [id, l.claims![id][proposer] === SILENT ? SILENT : `${proposer}:${l.claims![id][proposer]}`]));
        // S-a: a bot's lie gain is the donation a false "yes" would draw (only when it intends "no").
        const gains = Object.fromEntries(pids.map((id) => [id, playerOf(s, id).isHuman || id === proposer || base[id][proposer] === 'YES' ? null : claimDonation(s, id, proposer, 'YES', base) - claimDonation(s, id, proposer, 'NO', base)]));
        postClaims(s, 'AMEND', said, () => '', () => false, gains);
      }
      return;
    }
    const k = amendIndex(step);
    if (k < 0) return;
    if (k >= l.order.length) {
      finalize(s);
      return;
    }
    const P = p5Params(s);
    const proposer = l.order[k];
    const proposal = l.lobby![proposer].proposal!;
    const claims = Object.fromEntries(pids.map((id) => [id, l.claims?.[id]?.[proposer] ?? SILENT]));
    if (same(proposal, l.current!)) {
      l.amendments.push({ proposer, proposal, statusQuo: { ...l.current! }, votes: {}, claims, yes: 0, need: P.need, passed: false, withdrawn: true });
    } else {
      const votes = decisions as Record<PlayerId, boolean>;
      const yes = Object.values(votes).filter(Boolean).length;
      const passed = yes >= P.need;
      l.amendments.push({ proposer, proposal, statusQuo: { ...l.current! }, votes, claims, yes, need: P.need, passed });
      if (passed) l.current = { ...proposal };
      // The claim log gets each claim's truth now (lie success, S-b).
      for (const c of s.play!.claimLog)
        if (c.level === 5 && c.said.startsWith(`${proposer}:`)) {
          c.truth = `${proposer}:${votes[c.pid] ? 'YES' : 'NO'}`;
          c.lied = c.said !== c.truth;
        }
    }
    if (k === l.order.length - 1) finalize(s);
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
  observable: ['VEIL'],
  likelihood(s, _o, _a, _step, decision, card) {
    const ce = veilCE(s.players.length, card, BOT.BELIEF_RHO);
    const probs = logitProbs(ce, BOT.BELIEF_LAMBDA);
    return probs[ALL_CONSTITUTIONS.findIndex((x) => same(x, decision as Constitution))] ?? 0;
  },
  debrief(s) {
    const l = st(s);
    const pids = ids(s);
    if (!l.W) finalize(s);
    const sorted = pids.slice().sort((a, b) => l.incomes![a] - l.incomes![b]);
    const rank = Object.fromEntries(sorted.map((id, k) => [id, k + 1]));
    const deltaT = Object.fromEntries(pids.map((id) => [id, l.fair2![id] - l.fair1![id]]));
    return { rank, deltaT, slope: olsSlope(pids.map((id) => rank[id]), pids.map((id) => deltaT[id])), amendments: l.amendments, W: l.W };
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    const P = p5Params(s);
    const done = s.phase.kind === 'REVEAL' && s.phase.step === 'AMENDMENTS';
    const open = revealPrivate || done || ['ROUND_SUMMARY', 'GUESS', 'LEVEL_DEBRIEF', 'RUN_DEBRIEF', 'END'].includes(s.phase.kind);
    const lobby = l.lobby
      ? Object.fromEntries(
          Object.entries(l.lobby).map(([id, lb]) => [id, open || P.leaked || id === viewer || lb.donateTo === viewer ? lb : { ...lb, donateTo: null, amount: 0 }]),
        )
      : undefined;
    const amendments = open ? l.amendments : l.amendments.map((a) => ({ ...a, votes: {} }));
    return {
      veil: l.adopted ? l.veil : undefined,
      adopted: l.adopted,
      current: l.current,
      incomes: l.incomesRevealed ? l.incomes : undefined,
      lobby,
      order: l.order,
      claims: l.claims,
      amendments,
      myFair1: l.fair1?.[viewer],
      myFair2: l.fair2?.[viewer],
      fair1: open ? l.fair1 : undefined,
      fair2: open ? l.fair2 : undefined,
      W: l.W,
      leaked: P.leaked,
      maxDonation: P.maxDonation,
      need: P.need,
      // E5 (D-164): Hard shows no mission hints, as it shows no audience poll.
      preview: s.difficulty !== 'HARD' && s.phase.kind === 'DECIDE' && (s.phase.step === 'VEIL' || s.phase.step === 'FAIR_2') && s.players.some((p) => p.id === viewer) ? p5Preview(s, viewer) : undefined,
      reliability: Object.fromEntries(ids(s).map((id) => [id, reliabilityOf(s, id)])),
    };
  },
};

export function p5Plans(s: GameState, h: PlayerId): Record<string, unknown> {
  const l = st(s);
  const out: Record<string, unknown> = {};
  if (l.veil) out['1:VEIL'] = l.veil[h];
  if (l.lobby) out['1:LOBBY'] = l.lobby[h];
  return out;
}

export function p5Tries(_s: GameState, k: string, value: unknown): Array<{ value: unknown; from: unknown; to: unknown; kind: string }> {
  const stepId = k.split(':')[1];
  if (stepId === 'LOBBY') {
    const v = value as Lobby5;
    if (v.amount > 0) return [{ value: { ...v, donateTo: null, amount: 0 }, from: v.amount, to: 0, kind: 'DONATE' }];
    return [];
  }
  return [];
}

export const bandOf5 = bandOf;
export type { ValuesCard };
