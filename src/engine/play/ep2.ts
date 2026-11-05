// Play Episode 2, "First Hustle" (PLAY_V2_SPEC.md Section 4, D-153): income = talent x effort + luck; effort
// and talent are private, gross incomes are public, and the luck dice stay hidden until the end reveal (your
// own die excepted), so nobody can tell effort from luck. Claims are about effort; the Hustle Prize goes to
// whoever the table believes worked hardest. Study's Level 2 rules (talents, effort cost, leakage, the median
// tax vote) are reused; Study games never reach this file.
import { L2 } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, lowerMedian, orderedDraws, playerOf, reliabilityOf } from '../core';
import { leakyRevenue, sum } from '../tax';
import { bestEffort, effortCost, grossIncome } from '../levels/level2';
import { effortSharesFrom, mean } from '../scoring';
import { logitChoice } from '../bots/utility';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import type { LevelDefinition } from '../levels/types';
import { PLAY } from './params';
import { activeEvent, giftNet, missionScale, missionValue, playRoundValue, livingCost, setRoundLedger } from './rules';
import { botCall, callChance, callsThisRound, lieBelief, settleCalls, validCall } from './calls';
import { chooseClaim, honestyOf, postClaims, SILENT } from './claims';

type Gift = { to: PlayerId; amount: number };
export type Band = 'LITTLE' | 'SOME' | 'LOT';
export const BANDS: Band[] = ['LITTLE', 'SOME', 'LOT'];

export interface P2Round {
  t: number;
  effort: Record<PlayerId, number>;
  luck: Record<PlayerId, number>;
  y: Record<PlayerId, number>;
  claims: Record<PlayerId, string>;
  /** Every bot's belief about every other contestant's effort band this round, after the incomes (private). */
  beliefs: Record<PlayerId, Record<PlayerId, number[]>>;
  votes: Record<PlayerId, PlayerId | null>;
  winners: PlayerId[];
  prize: Record<PlayerId, number>;
  W: Record<PlayerId, number>;
  gifts: Record<PlayerId, Gift>;
  cameras: boolean;
}

export interface P2State {
  talents: Record<PlayerId, number>;
  t: number | null;
  tVotes?: Record<PlayerId, number>;
  current: Partial<P2Round>;
  rounds: P2Round[];
}

const st = (s: GameState) => s.levelState as P2State;

export const bandOf = (e: number): Band => (e <= PLAY.L2.BANDS[0] ? 'LITTLE' : e <= PLAY.L2.BANDS[1] ? 'SOME' : 'LOT');
/** Each band's middle, in hours (for "mean claimed effort"). */
export const BAND_MID: Record<Band, number> = { LITTLE: 1.5, SOME: 5, LOT: 8.5 };

export function p2Params(s: GameState) {
  const ev = activeEvent(s);
  const e = (ev ? (PLAY.L2_EVENTS as Record<string, Record<string, number>>)[ev.id] : null) ?? {};
  return {
    luck: PLAY.L2.LUCK_VALUES.map((x) => x * (e.LUCK_MULT ?? 1)),
    talentMult: e.TALENT_MULT ?? L2.TALENT_MULT,
    costK: e.EFFORT_COST ?? L2.EFFORT_COST,
    viral: e.VIRAL ?? 0,
    cameras: ev?.id === 'CAMERAS',
  };
}

const gross = (a: number, e: number, luck: number, mult: number) => L2.BASE_INCOME + mult * a * e + luck;

function wealth(y: readonly number[], e: readonly number[], t: number, costK: number): number[] {
  const R = leakyRevenue(t, sum(y), L2.KAPPA);
  return y.map((yi, i) => (1 - t) * yi + R / y.length - costK * e[i] * e[i]);
}

/** The effort that maximizes your own money at tax t (Study's rule, with this round's numbers). */
function bestE(t: number, a: number, n: number, P: ReturnType<typeof p2Params>): number {
  if (P.talentMult === L2.TALENT_MULT && P.costK === L2.EFFORT_COST) return bestEffort(t, a, n);
  const e = ((P.talentMult * a) / (2 * P.costK)) * (1 - t + (t * (1 - L2.KAPPA * t)) / n);
  return Math.max(0, Math.min(L2.EFFORT_MAX, Math.round(e)));
}

/**
 * A bot's belief about another contestant's effort band from public facts only: its gross income, with talent
 * and luck unknown (every remaining talent card and every luck face equally likely), then moved toward its
 * claim by CLAIM_WEIGHT x its record. Security Cameras make it certain.
 */
export function readEffort(s: GameState, obs: PlayerId, _target: PlayerId, y: number, claim: string | undefined, rel: number, P: ReturnType<typeof p2Params>, cameras: number | null): number[] {
  if (cameras !== null) return BANDS.map((b) => (bandOf(cameras) === b ? 1 : 0));
  const pool = L2.TALENT_DECK.slice();
  const mine = st(s).talents[obs];
  pool.splice(pool.indexOf(mine), 1);
  const w = [0, 0, 0];
  for (const a of pool)
    for (const luck of P.luck) {
      const e = (y - L2.BASE_INCOME - luck) / (P.talentMult * a);
      const k = Math.round(e);
      if (Math.abs(e - k) < 1e-6 && k >= 0 && k <= L2.EFFORT_MAX) w[BANDS.indexOf(bandOf(k))] += 1;
    }
  let z = w.reduce((x, x2) => x + x2, 0);
  let out = z > 0 ? w.map((x) => x / z) : [1 / 3, 1 / 3, 1 / 3];
  if (claim && claim !== SILENT) {
    if (PLAY.L2_PRIZE.BAYES) {
      // G4 (D-190): Bayes' rule, as HireBot reads "I trained" (D-159): an honest claimer always says its band,
      // a dishonest one may say any band, so a claim multiplies the odds of the claimed band by 1 / (1 - k).
      const k = Math.min(0.99, PLAY.L2_PRIZE.CLAIM_WEIGHT * rel);
      out = out.map((x, i) => x * (BANDS[i] === claim ? 1 : 1 - k));
    } else {
      const k = Math.min(1, PLAY.L2_PRIZE.CLAIM_WEIGHT * rel);
      out = out.map((x, i) => (1 - k) * x + (BANDS[i] === claim ? k : 0));
    }
  }
  z = out.reduce((x, x2) => x + x2, 0);
  return out.map((x) => x / z);
}

/** H1: contestants with a claim on record this round (made on the effort screen). */
const claimants2 = (s: GameState): PlayerId[] => ids(s).filter((id) => { const c = st(s).current.claims?.[id]; return !!c && c !== SILENT; });

const expEffort = (b: number[]) => b.reduce((a, x, i) => a + x * BAND_MID[BANDS[i]], 0);

/** A bot's believed effort of everyone this episode (its own is known), averaged over rounds read so far. */
function believedEffort(s: GameState, obs: PlayerId, extra?: Record<PlayerId, number[]>): number[] {
  const l = st(s);
  return s.players.map((p) => {
    if (p.id === obs) return mean([...l.rounds.map((r) => r.effort[obs]), ...(l.current.effort ? [l.current.effort[obs]] : [])]);
    const xs = [...l.rounds.map((r) => expEffort(r.beliefs[obs]?.[p.id] ?? [1 / 3, 1 / 3, 1 / 3])), ...(extra?.[p.id] ? [expEffort(extra[p.id])] : [])];
    return xs.length ? mean(xs) : BAND_MID.SOME;
  });
}

// ---------------------------------------------------------------------------------------------------------

function taxValues(s: GameState, pid: PlayerId): number[] {
  const l = st(s);
  const i = idx(s, pid);
  const n = s.players.length;
  const P = p2Params(s);
  const pool = L2.TALENT_DECK.filter((a) => a !== l.talents[pid]);
  const perms = orderedDraws(pool, n - 1);
  const luck = mean(P.luck);
  return PLAY.L2.TAX_OPTIONS.map((t) => {
    let tot = 0;
    for (const perm of perms) {
      const talents = perm.slice();
      talents.splice(i, 0, l.talents[pid]);
      const e = talents.map((a) => bestE(t, a, n, P));
      const y = talents.map((a, j) => gross(a, e[j], luck, P.talentMult));
      // The tax holds for every round of the episode.
      tot += PLAY.L2.ROUNDS * playRoundValue(s, s.players[i].values, wealth(y, e, t, P.costK), i, effortSharesFrom(e), null);
    }
    return tot / perms.length;
  });
}

/** Coins a claim is worth: 30 x the change in the chance the table's reads put you first. */
function claimGain(s: GameState, pid: PlayerId, value: string, e: number): number {
  const others = ids(s).filter((x) => x !== pid);
  const rel = reliabilityOf(s, pid);
  const k = Math.min(1, PLAY.L2_PRIZE.CLAIM_WEIGHT * rel);
  // Before the incomes, a listener expects the true band on average; the claim pulls toward the claimed band.
  // Loop R3 cycle 1: under Security Cameras the hours are shown, so a claim moves no belief (and a lie is caught).
  const mine = value !== SILENT && !p2Params(s).cameras ? (1 - k) * e + k * BAND_MID[value as Band] : e;
  const rivals = others.map((o) => mean(st(s).rounds.map((r) => expEffort(r.beliefs[pid]?.[o] ?? [1 / 3, 1 / 3, 1 / 3])).concat([BAND_MID.SOME])));
  const top = Math.max(...rivals);
  const raw = mine > top + 1e-9 ? PLAY.HUSTLE_PRIZE : mine > top - 1e-9 ? PLAY.HUSTLE_PRIZE / 2 : 0;
  if (value === SILENT || value === bandOf(e)) return raw;
  // H2 (D-194): a lie can be called. Others read the claim against the income they expect (average luck); a
  // caught liar pays the payout and cannot win the prize, so the lie keeps its gain only if nobody calls.
  const P = p2Params(s);
  const y = gross(st(s).talents[pid], e, mean(P.luck), P.talentMult);
  const pc = callChance(s, pid, (obs) => lieBelief(s, pid, readEffort(s, obs, pid, y, undefined, rel, P, P.cameras ? e : null)[BANDS.indexOf(value as Band)]));
  return (1 - pc) * raw - pc * PLAY.CALL_PAYOUT;
}

function botEffort(s: GameState, pid: PlayerId): { effort: number; claim: string; gift: Gift | null } {
  const l = st(s);
  const P = p2Params(s);
  const { lambda } = botParams(s, pid);
  const rng = botRng(s);
  let e = bestE(l.t ?? 0, l.talents[pid], s.players.length, P);
  if (rng.next() < 1 / (1 + lambda)) e += rng.next() < 0.5 ? -1 : 1;
  e = Math.max(0, Math.min(L2.EFFORT_MAX, e));
  const truth = bandOf(e);
  // The only lie that can pay is overclaiming: "a lot".
  const claim = chooseClaim(s, pid, truth, 'LOT', (v) => claimGain(s, pid, v, e)).value;
  return { effort: e, claim, gift: bestGift(s, pid, e) };
}

function expectedW(s: GameState, i: number, myE: number): number[] {
  const l = st(s);
  const P = p2Params(s);
  const n = s.players.length;
  const t = l.t ?? 0;
  const luck = mean(P.luck);
  const meanA = mean(L2.TALENT_DECK);
  const e = s.players.map((_p, j) => (j === i ? myE : bestE(t, meanA, n, P)));
  const y = s.players.map((p, j) => gross(j === i ? l.talents[p.id] : meanA, e[j], luck, P.talentMult));
  return wealth(y, e, t, P.costK);
}

function withGift(s: GameState, W: number[], i: number, g: Gift | null): number[] {
  if (!g) return W;
  const out = W.slice();
  out[i] -= g.amount;
  out[idx(s, g.to)] += g.amount;
  return out;
}

function bestGift(s: GameState, pid: PlayerId, e: number): Gift | null {
  const i = idx(s, pid);
  const W = expectedW(s, i, e);
  const eff = effortSharesFrom(believedEffort(s, pid));
  const val = (x: number[]) => playRoundValue(s, s.players[i].values, x, i, eff, null);
  let best: { g: Gift | null; u: number } = { g: null, u: val(W) };
  for (const p of s.players) {
    if (p.id === pid) continue;
    for (const a of PLAY.GIFT_AMOUNTS) {
      const g = { to: p.id, amount: a };
      const u = val(withGift(s, W, i, g));
      if (u > best.u + 0.5) best = { g, u };
    }
  }
  return best.g;
}

/**
 * The Hustle Prize vote (B.2, from payoffs): the contestant whose prize would raise the voter's Play value
 * most, with effort shares as the voter believes them; near-ties (within 0.5 points) go to the highest
 * believed effort, the prize's stated purpose.
 */
function botPrize(s: GameState, pid: PlayerId): PlayerId {
  const c = st(s).current;
  const i = idx(s, pid);
  const believed = believedEffort(s, pid, c.beliefs![pid]);
  const eff = effortSharesFrom(believed);
  const W = s.players.map((p) => c.W![p.id]);
  const u = s.players.map((p, j) => {
    if (p.id === pid) return -Infinity;
    const W2 = W.slice();
    W2[j] += PLAY.HUSTLE_PRIZE;
    return playRoundValue(s, s.players[i].values, W2, i, eff, null);
  });
  const top = Math.max(...u);
  // G4 (D-190): the prize is "for who worked hardest". An honest bot follows that rule with probability equal
  // to its honesty (its belief about effort, claims included); otherwise it votes for its mission, as before.
  if (PLAY.L2_PRIZE.NORM && botRng(s).next() < honestyOf(s, pid)) {
    const others = s.players.map((_p, j) => j).filter((j) => j !== i);
    others.sort((a, b) => believed[b] - believed[a] || u[b] - u[a]);
    return s.players[others[0]].id;
  }
  const near = s.players.map((_p, j) => j).filter((j) => u[j] >= top - 0.5);
  near.sort((a, b) => believed[b] - believed[a]);
  return s.players[near[0]].id;
}

// ---------------------------------------------------------------------------------------------------------

export interface P2Preview {
  tax?: Record<string, number>;
  effort?: number[];
  prize?: Record<PlayerId, number>;
  gift: Record<PlayerId, Record<number, number>>;
}

function missionPts(s: GameState, i: number, W: number[], eff: number[]): number {
  const card = s.players[i].values;
  const banks = s.players.map((p, j) => s.play!.banks[p.id] + W[j] - livingCost(s));
  return PLAY.MISSION_WEIGHT * missionScale(s, card) * missionValue(card, banks, i, eff);
}

export function p2Preview(s: GameState, pid: PlayerId): P2Preview {
  const i = idx(s, pid);
  const l = st(s);
  const out: P2Preview = { gift: {} };
  const eff = effortSharesFrom(believedEffort(s, pid));
  if (s.phase.step === 'TAX') {
    // Mission points if each tax holds for the episode, against the average over the options (bots' model).
    const n = s.players.length;
    const P = p2Params(s);
    const pool = L2.TALENT_DECK.filter((a) => a !== l.talents[pid]);
    const perms = orderedDraws(pool, n - 1);
    const by = PLAY.L2.TAX_OPTIONS.map((t) => {
      let tot = 0;
      for (const perm of perms) {
        const talents = perm.slice();
        talents.splice(i, 0, l.talents[pid]);
        const e = talents.map((a) => bestE(t, a, n, P));
        const y = talents.map((a, j) => gross(a, e[j], mean(P.luck), P.talentMult));
        tot += PLAY.L2.ROUNDS * missionPts(s, i, wealth(y, e, t, P.costK), effortSharesFrom(e));
      }
      return tot / perms.length;
    });
    const avg = mean(by);
    out.tax = Object.fromEntries(PLAY.L2.TAX_OPTIONS.map((t, k) => [String(t), by[k] - avg]));
  }
  if (s.phase.step === 'EFFORT') {
    const base = missionPts(s, i, expectedW(s, i, 0), eff);
    out.effort = Array.from({ length: L2.EFFORT_MAX + 1 }, (_, e) => missionPts(s, i, expectedW(s, i, e), eff) - base);
    const W = expectedW(s, i, bestE(l.t ?? 0, l.talents[pid], s.players.length, p2Params(s)));
    const m0 = missionPts(s, i, W, eff);
    for (const p of s.players) {
      if (p.id === pid) continue;
      out.gift[p.id] = {};
      for (const a of PLAY.GIFT_AMOUNTS) out.gift[p.id][a] = missionPts(s, i, withGift(s, W, i, { to: p.id, amount: a }), eff) - m0;
    }
  }
  if (s.phase.step === 'PRIZE' && l.current.W) {
    const W = s.players.map((p) => l.current.W![p.id]);
    const m0 = missionPts(s, i, W, eff);
    out.prize = {};
    s.players.forEach((p, j) => {
      if (p.id === pid) return;
      const W2 = W.slice();
      W2[j] += PLAY.HUSTLE_PRIZE;
      out.prize![p.id] = missionPts(s, i, W2, eff) - m0;
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------

export const playLevel2: LevelDefinition = {
  id: 2,
  rounds: PLAY.L2.ROUNDS,
  init(s) {
    const g = gameRng(s);
    const deck = g.shuffle(L2.TALENT_DECK);
    const talents: Record<PlayerId, number> = {};
    s.players.forEach((p, i) => {
      talents[p.id] = deck[i];
      p.privateInfo.talent = deck[i];
    });
    s.levelState = { talents, t: null, current: {}, rounds: [] } satisfies P2State;
    const pl = s.play!;
    pl.joint = {};
    pl.belief = {};
    pl.belief2 = {};
  },
  phases() {
    const out: Phase[] = [];
    for (let r = 1; r <= PLAY.L2.ROUNDS; r++) {
      out.push({ kind: 'BRIEFING', round: r });
      if (r === 1) out.push({ kind: 'DECIDE', step: 'TAX', round: r }, { kind: 'REVEAL', step: 'TAX', round: r });
      out.push({ kind: 'DECIDE', step: 'EFFORT', round: r }, { kind: 'REVEAL', step: 'INCOME', round: r }, { kind: 'DECIDE', step: 'PRIZE', round: r }, { kind: 'REVEAL', step: 'PRIZE', round: r }, { kind: 'ROUND_SUMMARY', round: r });
    }
    out.push({ kind: 'REVEAL', step: 'CARDS', round: PLAY.L2.ROUNDS });
    return out;
  },
  onEnter(s, phase) {
    if (phase.kind === 'BRIEFING') st(s).current = {};
    if (phase.kind === 'REVEAL' && phase.step === 'CARDS') {
      const l = st(s);
      for (const m of s.messages) {
        if (m.level !== s.levelIndex || m.resolved || m.msg.type !== 'CLAIM') continue;
        m.resolved = true;
        m.kept = bandOf(l.rounds[m.round - 1]?.effort[m.from] ?? 0) === m.msg.value;
        s.reliability[m.from].made++;
        if (m.kept) s.reliability[m.from].kept++;
      }
    }
  },
  deciders(s) {
    return ids(s);
  },
  validate(s, step, pid, d) {
    if (step === 'TAX') return PLAY.L2.TAX_OPTIONS.includes(d as number) ? d : null;
    if (step === 'PRIZE') {
      // H1 (D-194): the prize vote may carry a call ({ vote, call }); a plain id is a vote without a call.
      const o = (typeof d === 'string' ? { vote: d } : (d ?? {})) as { vote?: unknown; call?: unknown };
      if (typeof o.vote !== 'string' || o.vote === pid || !ids(s).includes(o.vote)) return null;
      const call = validCall(s, pid, o.call, claimants2(s));
      return call ? { vote: o.vote, call } : o.vote;
    }
    if (step === 'EFFORT') {
      const c = d as { effort?: unknown; claim?: unknown; gift?: Gift | null };
      if (!c || !Number.isInteger(c.effort) || (c.effort as number) < 0 || (c.effort as number) > L2.EFFORT_MAX) return null;
      const claim = c.claim === SILENT || BANDS.includes(c.claim as Band) ? (c.claim as string) : null;
      if (claim === null) return null;
      const gf = c.gift;
      const gift = gf && typeof gf.to === 'string' && gf.to !== pid && ids(s).includes(gf.to) && PLAY.GIFT_AMOUNTS.includes(gf.amount) ? { to: gf.to, amount: gf.amount } : null;
      return { effort: c.effort, claim, gift };
    }
    return null;
  },
  botDecide(s, botId, step) {
    if (step === 'TAX') return PLAY.L2.TAX_OPTIONS[logitChoice(taxValues(s, botId), botParams(s, botId).lambda, botRng(s))];
    if (step === 'EFFORT') return botEffort(s, botId);
    const vote = botPrize(s, botId);
    // H2 (D-194): call the claim it most doubts, if the bet pays with its own beliefs and mission.
    const cur = st(s).current;
    const call = botCall(s, botId, claimants2(s), (t) => {
      const cl = cur.claims?.[t];
      if (!cl || cl === SILENT || cur.y?.[t] === undefined) return null;
      const P = p2Params(s);
      const prior = readEffort(s, botId, t, cur.y[t], undefined, reliabilityOf(s, t), P, P.cameras ? cur.effort![t] : null);
      return lieBelief(s, t, prior[BANDS.indexOf(cl as Band)]);
    });
    return call ? { vote, call } : vote;
  },
  resolve(s, step, decisions) {
    const l = st(s);
    const pids = ids(s);
    if (step === 'TAX') {
      l.tVotes = decisions as Record<PlayerId, number>;
      l.t = lowerMedian(pids.map((id) => decisions[id] as number));
      return;
    }
    if (step === 'EFFORT') {
      const P = p2Params(s);
      const g = gameRng(s);
      const t = l.t ?? 0;
      const ds = pids.map((id) => decisions[id] as { effort: number; claim: string; gift: Gift | null });
      const e = ds.map((d) => d.effort);
      const luck = pids.map(() => g.pick(P.luck));
      if (P.viral) luck[Math.floor(g.next() * pids.length)] += P.viral;
      const y = pids.map((id, i) => gross(l.talents[id], e[i], luck[i], P.talentMult));
      const W = wealth(y, e, t, P.costK);
      const rec = (xs: number[]) => Object.fromEntries(pids.map((id, i) => [id, xs[i]]));
      const claims = Object.fromEntries(pids.map((id, i) => [id, ds[i].claim]));
      const rel = Object.fromEntries(pids.map((id) => [id, reliabilityOf(s, id)]));
      const beliefs: P2Round['beliefs'] = {};
      for (const o of s.players)
        beliefs[o.id] = Object.fromEntries(pids.filter((x) => x !== o.id).map((x, _k) => [x, readEffort(s, o.id, x, y[pids.indexOf(x)], claims[x], rel[x], P, P.cameras ? e[pids.indexOf(x)] : null)]));
      const gains = Object.fromEntries(pids.map((id, i) => [id, playerOf(s, id).isHuman || bandOf(e[i]) === 'LOT' ? null : claimGain(s, id, 'LOT', e[i]) - claimGain(s, id, bandOf(e[i]), e[i])]));
      postClaims(s, 'EFFORT', claims, (pid) => bandOf(e[pids.indexOf(pid)]), (v) => v === 'LOT', gains);
      l.current = { t, effort: rec(e), luck: rec(luck), y: rec(y), claims, beliefs, W: rec(W), cameras: P.cameras, gifts: {} };
      ds.forEach((d, i) => {
        if (d.gift) l.current.gifts![pids[i]] = d.gift;
      });
      for (const p of s.players) p.privateInfo.myLuck = luck[pids.indexOf(p.id)];
      return;
    }
    // PRIZE: plurality of votes (never yourself); ties split. Then gifts, effort for the Meritocrat, finish.
    const c = l.current;
    const norm = (d: unknown) => (typeof d === 'string' ? { vote: d, call: null } : (d as { vote: PlayerId; call?: PlayerId | null }));
    const votes = Object.fromEntries(pids.map((id) => [id, norm(decisions[id]).vote]));
    // H1 (D-194): calls first. A caught liar cannot win the prize this round; the true hours become public.
    const lied = (t: PlayerId) => c.claims![t] !== SILENT && c.claims![t] !== bandOf(c.effort![t]);
    const callNet = settleCalls(s, Object.fromEntries(pids.map((id) => [id, norm(decisions[id]).call ?? null])), lied);
    const caught = new Set(callsThisRound(s).filter((x) => x.lie).map((x) => x.target));
    for (const x of callsThisRound(s)) for (const o of s.players) if (o.id !== x.target && c.beliefs![o.id]) c.beliefs![o.id][x.target] = BANDS.map((b) => (bandOf(c.effort![x.target]) === b ? 1 : 0));
    const tally: Record<PlayerId, number> = {};
    for (const v of Object.values(votes)) if (!caught.has(v)) tally[v] = (tally[v] ?? 0) + 1;
    const top = Math.max(0, ...Object.values(tally));
    const winners = top > 0 ? pids.filter((id) => tally[id] === top) : [];
    const prize = Object.fromEntries(pids.map((id) => [id, winners.includes(id) ? PLAY.HUSTLE_PRIZE / winners.length : 0]));
    let W = pids.map((id) => c.W![id] + prize[id] + callNet[id]);
    for (const [from, gf] of Object.entries(c.gifts ?? {})) W = withGift(s, W, idx(s, from), gf);
    const pl = s.play!;
    pl.effort ??= Object.fromEntries(pids.map((id) => [id, 0]));
    for (const id of pids) pl.effort[id] = (pl.effort[id] ?? 0) + c.effort![id];
    const round = { ...(c as P2Round), votes, winners, prize, W: Object.fromEntries(pids.map((id, i) => [id, W[i]])) };
    l.rounds.push(round);
    l.current = round;
    const P2 = p2Params(s);
    const gn = giftNet(pids, c.gifts ?? {});
    setRoundLedger(s, Object.fromEntries(pids.map((id) => {
      const hours = -P2.costK * c.effort![id] * c.effort![id];
      return [id, [
        { k: 'income' as const, n: c.y![id] },
        { k: 'rule' as const, n: c.W![id] - c.y![id] - hours },
        { k: 'hours' as const, n: hours },
        { k: 'prize' as const, n: prize[id] },
        { k: 'gift' as const, n: gn[id] },
        { k: 'call' as const, n: callNet[id] },
      ]];
    })));
    finishRound(s, W, effortSharesFrom(pids.map((id) => pl.effort![id])), headline(s, 'l2.play', {}));
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
    return { rounds: st(s).rounds, t: st(s).t };
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    const cards = revealPrivate || (s.phase.kind === 'REVEAL' && s.phase.step === 'CARDS') || s.phase.kind === 'GUESS' || s.phase.kind === 'LEVEL_DEBRIEF';
    const hide = (r: Partial<P2Round>): Partial<P2Round> => {
      if (!r.effort) return { ...r, beliefs: undefined };
      const open = cards || r.cameras;
      const pick = (m: Record<PlayerId, number> | undefined) => (m ? Object.fromEntries(Object.entries(m).filter(([id]) => open || id === viewer)) : m);
      return { ...r, effort: pick(r.effort), luck: cards ? r.luck : pick(r.luck), beliefs: undefined };
    };
    // The audience poll (v2 3.2): the other bots' average belief that each contestant worked "a lot" this round.
    const poll: Record<PlayerId, number> = {};
    const c = l.current;
    if (c.beliefs && PLAY.DIFFICULTY[s.difficulty].poll !== 'NEVER')
      for (const p of s.players) {
        const xs = Object.entries(c.beliefs)
          .filter(([o]) => o !== p.id && !playerOf(s, o).isHuman)
          .map(([, m]) => m[p.id]?.[2])
          .filter((x): x is number => x !== undefined);
        if (xs.length) poll[p.id] = mean(xs);
      }
    return {
      t: l.t,
      tVotes: l.tVotes,
      myTalent: l.talents[viewer],
      talents: cards ? l.talents : undefined,
      rounds: l.rounds.map(hide),
      current: c.effort && !l.rounds.includes(c as P2Round) ? hide(c) : undefined,
      poll,
      // E5 (D-164): Hard shows no mission hints, as it shows no audience poll.
      preview: s.difficulty !== 'HARD' && s.phase.kind === 'DECIDE' && s.players.some((p) => p.id === viewer) && s.players.some((p) => p.id === viewer) ? p2Preview(s, viewer) : undefined,
      myMoney: s.phase.kind === 'DECIDE' && s.phase.step === 'EFFORT' && s.players.some((p) => p.id === viewer) ? Array.from({ length: L2.EFFORT_MAX + 1 }, (_, e) => expectedW(s, idx(s, viewer), e)[idx(s, viewer)]) : undefined,
      costK: p2Params(s).costK,
      talentMult: p2Params(s).talentMult,
      meanLuck: mean(p2Params(s).luck),
      cardsOpen: cards,
    };
  },
};

/** Near-miss hooks (v2 6.1). */
export function p2Plans(s: GameState, h: PlayerId): Record<string, unknown> {
  const l = st(s);
  const out: Record<string, unknown> = {};
  if (l.tVotes?.[h] !== undefined) out['1:TAX'] = l.tVotes[h];
  l.rounds.forEach((r, k) => {
    out[`${k + 1}:EFFORT`] = { effort: r.effort[h], claim: r.claims[h], gift: r.gifts[h] ?? null };
    if (r.votes[h]) out[`${k + 1}:PRIZE`] = r.votes[h];
  });
  return out;
}

export function p2Tries(s: GameState, k: string, value: unknown): Array<{ value: unknown; from: unknown; to: unknown; kind: string }> {
  const stepId = k.split(':')[1];
  if (stepId === 'TAX') return PLAY.L2.TAX_OPTIONS.filter((t) => t !== value).map((t) => ({ value: t, from: value, to: t, kind: 'TAX' }));
  if (stepId === 'EFFORT') {
    const v = value as { effort: number; claim: string; gift: Gift | null };
    const out: Array<{ value: unknown; from: unknown; to: unknown; kind: string }> = [];
    for (const e of [0, 2, 4, 6, 8, 10]) if (e !== v.effort) out.push({ value: { ...v, effort: e }, from: v.effort, to: e, kind: 'EFFORT' });
    for (const c of [...BANDS, SILENT]) if (c !== v.claim) out.push({ value: { ...v, claim: c }, from: v.claim, to: c, kind: 'CLAIM' });
    return out;
  }
  if (stepId === 'PRIZE') return ids(s).filter((x) => x !== value && x !== s.players.find((p) => p.isHuman)?.id).map((x) => ({ value: x, from: value, to: x, kind: 'PRIZE' }));
  return [];
}

export { effortCost, grossIncome };
export type { ValuesCard };
