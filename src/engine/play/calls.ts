// H1 to H2: "Call it", the fifth verb (v2 Section 3.7, D-194). After the claims are shown, a contestant may
// stake PLAY.CALL_STAKE on one other contestant's claim this round. The claim is checked at once and the
// result is public: a lie pays the caller PLAY.CALL_PAYOUT (the stake comes back) and is stamped CAUGHT; a
// true claim costs the caller the stake, paid to the claimant, and is stamped CALLED WRONG. Each episode
// says what a caught lie means there (calls.ts only handles the money, the stamps, the record and the bots).
import { reliabilityOf } from '../core';
import type { GameState, PlayerId } from '../types';
import { PLAY } from './params';
import { isPlay, playEffortShares, playRoundValue } from './rules';
import type { CallRecord } from './types';

export const callsOn = (s: GameState): boolean => isPlay(s) && PLAY.CALL_ENABLED;

/** A call decision field, validated: another contestant with a claim on record this round, or null. */
export function validCall(s: GameState, caller: PlayerId, x: unknown, claimants: readonly PlayerId[]): PlayerId | null {
  if (!callsOn(s) || typeof x !== 'string' || x === caller) return null;
  return claimants.includes(x) ? x : null;
}

/**
 * Settle this round's calls. `isLie(target)` says whether the target's claim was false. Returns each
 * contestant's money from calls (to add to the round's W and the ledger). Marks the claim checked in the
 * public record (a caught lie counts as a broken word) and logs every call for stamps and the Receipts.
 */
export function settleCalls(s: GameState, calls: Record<PlayerId, PlayerId | null | undefined>, isLie: (target: PlayerId) => boolean, markRecord = true): Record<PlayerId, number> {
  const net: Record<PlayerId, number> = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  if (!callsOn(s)) return net;
  const pl = s.play!;
  pl.calls ??= [];
  const checked = new Set<PlayerId>();
  for (const p of s.players) {
    const target = calls[p.id];
    if (!target) continue;
    const lie = isLie(target);
    if (lie) {
      net[p.id] += PLAY.CALL_PAYOUT;
      net[target] -= PLAY.CALL_PAYOUT;
    } else {
      net[p.id] -= PLAY.CALL_STAKE;
      net[target] += PLAY.CALL_STAKE;
    }
    const rec: CallRecord = { level: s.levelIndex, round: s.round, caller: p.id, target, lie };
    pl.calls.push(rec);
    checked.add(target);
  }
  // The checked claim enters the public record now (once, however many callers).
  if (markRecord) for (const m of s.messages) {
    if (m.level !== s.levelIndex || m.round !== s.round || m.resolved || m.msg.type !== 'CLAIM' || !checked.has(m.from)) continue;
    m.resolved = true;
    m.kept = !isLie(m.from);
    s.reliability[m.from].made++;
    if (m.kept) s.reliability[m.from].kept++;
  }
  return net;
}

/** This round's calls so far (for stamps and screens). */
export function callsThisRound(s: GameState): CallRecord[] {
  return (s.play?.calls ?? []).filter((c) => c.level === s.levelIndex && c.round === s.round);
}

/** The value of one coin of own money to contestant i now, in Play points (to price stakes for claims). */
export function coinValue(s: GameState, i: number): number {
  const W0 = s.players.map(() => 0);
  const W1 = W0.slice();
  W1[i] += 1;
  const card = s.players[i].values;
  const eff = playEffortShares(s);
  return Math.max(1e-6, playRoundValue(s, card, W1, i, eff) - playRoundValue(s, card, W0, i, eff));
}

/**
 * H2: a bot's call. For each other contestant with a claim this round, its own belief that the claim is
 * false (`pFalse`, from its own beliefs) prices the bet with its own mission: the Play value of winning the
 * payout (and the target paying it) against losing the stake (and the target receiving it). It calls the
 * best bet if its expected value is positive (risk-neutral, that is a belief above STAKE / (STAKE + PAYOUT)).
 */
export function botCall(s: GameState, pid: PlayerId, claimants: readonly PlayerId[], pFalse: (target: PlayerId) => number | null): PlayerId | null {
  if (!callsOn(s)) return null;
  const i = s.players.findIndex((p) => p.id === pid);
  const card = s.players[i].values;
  const eff = playEffortShares(s);
  const W0 = s.players.map(() => 0);
  const v0 = playRoundValue(s, card, W0, i, eff);
  let best: { t: PlayerId | null; u: number } = { t: null, u: 0 };
  for (const t of claimants) {
    if (t === pid) continue;
    const p = pFalse(t);
    if (p === null) continue;
    const j = s.players.findIndex((q) => q.id === t);
    const win = W0.slice();
    win[i] += PLAY.CALL_PAYOUT;
    win[j] -= PLAY.CALL_PAYOUT;
    const lose = W0.slice();
    lose[i] -= PLAY.CALL_STAKE;
    lose[j] += PLAY.CALL_STAKE;
    const u = p * (playRoundValue(s, card, win, i, eff) - v0) + (1 - p) * (playRoundValue(s, card, lose, i, eff) - v0);
    if (u > best.u + 1e-9) best = { t, u };
  }
  return best.t;
}

/**
 * H2: the chance a claim is called, predicted from the other contestants' beliefs that it is false: each
 * other contestant is taken to call when its belief clears the risk-neutral line STAKE / (STAKE + PAYOUT).
 */
export function callChance(s: GameState, pid: PlayerId, pFalseBy: (obs: PlayerId) => number | null): number {
  if (!callsOn(s)) return 0;
  const line = PLAY.CALL_STAKE / (PLAY.CALL_STAKE + PLAY.CALL_PAYOUT);
  let none = 1;
  for (const o of s.players) {
    if (o.id === pid) continue;
    const p = pFalseBy(o.id);
    if (p !== null && p > line) none *= 1 - Math.min(1, p);
  }
  return 1 - none;
}

/** Re-exported for episodes that weigh a caught lie's record cost. */
export const recordOf = reliabilityOf;
