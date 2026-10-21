// The v2 spine (PLAY_V2_SPEC.md Section 3): public claims, the honesty record, bot honesty traits and
// bots' beliefs about each episode's hidden fact. Study games never reach this code (s.play is absent).
import { reliabilityOf } from '../core';
import { flavorIndex, type Rng } from '../rng';
import type { GameState, LevelId, Message, PlayerId } from '../types';
import { PLAY } from './params';
import type { ClaimRecord } from './types';

export const SILENT = 'SILENT';

/** v2 3.5: draw every bot's honesty trait once per life, from the bot stream, in seat order. */
export function drawHonesty(s: GameState, rng: Rng): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const p of s.players) {
    if (p.isHuman || !p.botProfile) continue;
    const [lo, hi] = PLAY.HONESTY_RANGE[p.botProfile.key];
    out[p.id] = lo + (hi - lo) * rng.next();
  }
  return out;
}

/** A seat's honesty trait; a human's seat (played by the timeout rule) uses the middle of the AUTO range. */
export function honestyOf(s: GameState, pid: PlayerId): number {
  const h = s.play!.honesty[pid];
  if (h !== undefined) return h;
  const [lo, hi] = PLAY.HONESTY_RANGE.AUTO;
  return (lo + hi) / 2;
}

/** At an episode start: every bot believes the hidden fact of every other contestant with this prior. */
export function initFactBeliefs(s: GameState, prior: number): void {
  const b: Record<PlayerId, Record<PlayerId, number>> = {};
  for (const obs of s.players) {
    if (obs.isHuman) continue;
    b[obs.id] = {};
    for (const o of s.players) if (o.id !== obs.id) b[obs.id][o.id] = prior;
  }
  s.play!.belief = b;
}

const clamp = (x: number) => Math.min(1 - PLAY.BELIEF_FLOOR, Math.max(PLAY.BELIEF_FLOOR, x));

/** A belief after a claim: mixed toward the claim by CLAIM_WEIGHT x the speaker's record (as Study's rule). */
export function mixClaim(b: number, claimTrue: boolean, reliability: number): number {
  const w = PLAY.CLAIM_WEIGHT * reliability;
  return clamp((1 - w) * b + w * (claimTrue ? 1 : 0));
}

/** Bayes' rule on a belief that the fact is true, given the likelihood of what was seen under each case. */
export function bayes(b: number, likTrue: number, likFalse: number): number {
  const num = b * likTrue;
  const den = num + (1 - b) * likFalse;
  return den > 0 ? clamp(num / den) : b;
}

/** Update every bot's belief about `target` with a function of the old belief. */
export function updateBeliefs(s: GameState, target: PlayerId, f: (b: number, observer: PlayerId) => number): void {
  for (const [obs, m] of Object.entries(s.play!.belief)) if (obs !== target && m[target] !== undefined) m[target] = f(m[target], obs);
}

/** The audience poll (v2 3.2): the average belief of every bot except the contestant itself. */
export function audienceBelief(s: GameState, target: PlayerId): number | null {
  const vals = Object.entries(s.play!.belief)
    .filter(([obs, m]) => obs !== target && m[target] !== undefined)
    .map(([, m]) => m[target]);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * Publish the round's claims (v2 3.1). `said` maps every decider to a value or SILENT; `truth` gives each
 * contestant's real value; `isTrueFact` says whether a claimed value asserts the hidden fact (Episode 3:
 * 'HIGH'). Claims become messages, then every bot's belief moves toward each claim by its speaker's
 * record as it stood before this round (claims are simultaneous).
 */
export function postClaims(
  s: GameState,
  topic: 'RISK',
  said: Record<PlayerId, string>,
  truth: (pid: PlayerId) => string,
  isTrueFact: (value: string) => boolean,
  lieGains: Record<PlayerId, number | null>,
): void {
  const pl = s.play!;
  const rel = Object.fromEntries(s.players.map((p) => [p.id, reliabilityOf(s, p.id)]));
  for (const p of s.players) {
    if (!(p.id in said)) continue;
    const value = said[p.id];
    const rec: ClaimRecord = {
      pid: p.id,
      level: s.levelIndex,
      round: s.round,
      topic,
      said: value,
      truth: truth(p.id),
      lied: value !== SILENT && value !== truth(p.id),
      lieGain: lieGains[p.id] ?? null,
    };
    pl.claimLog.push(rec);
    if (value === SILENT) continue;
    const m: Message = {
      id: s.nextMessageId++,
      from: p.id,
      msg: { type: 'CLAIM', topic, value },
      level: s.levelIndex,
      round: s.round,
      variant: flavorIndex(s.seed, `claim-${s.nextMessageId}`, 997),
      resolved: false,
    };
    s.messages.push(m);
    updateBeliefs(s, p.id, (b) => mixClaim(b, isTrueFact(value), rel[p.id]));
  }
}

/** v2 3.4: stamp every open claim of this episode TRUE or LIE, and feed it into the public record. */
export function checkClaims(s: GameState, truth: (pid: PlayerId) => string): void {
  for (const m of s.messages) {
    if (m.level !== s.levelIndex || m.resolved || m.msg.type !== 'CLAIM') continue;
    m.resolved = true;
    m.kept = m.msg.value === truth(m.from);
    s.reliability[m.from].made++;
    if (m.kept) s.reliability[m.from].kept++;
  }
}

/**
 * The share of true claims a contestant expects on their record once the reveal checks every claim made
 * so far plus this one (the speaker knows which of its own claims were true). Prior (1 + kept) / (2 + made),
 * as Study's reliability rule.
 */
export function expectedRecord(s: GameState, pid: PlayerId, now: 'TRUE' | 'LIE' | 'SILENT'): number {
  const mine = s.play!.claimLog.filter((c) => c.pid === pid && c.said !== SILENT);
  const made = mine.length + (now === 'SILENT' ? 0 : 1);
  const kept = mine.filter((c) => !c.lied).length + (now === 'TRUE' ? 1 : 0);
  return (kept + 1) / (made + 2);
}

/**
 * v2 3.5, the bot claim rule (D-112). `gain(value)` is the coins a claim is worth this round under the
 * bot's current beliefs, before credibility. Honest options are the truth and silence; the bot takes the
 * one with the higher gain + CREDIBILITY_VALUE x expected record. It lies instead when
 * (lie gain - best honest gain) x (1 - honesty) > CREDIBILITY_VALUE x (best honest record - lie record).
 */
export function chooseClaim(
  s: GameState,
  pid: PlayerId,
  truthValue: string,
  lieValue: string,
  gain: (value: string) => number,
): { value: string; lieGain: number } {
  const cv = PLAY.CREDIBILITY_VALUE;
  const honest = [
    { value: truthValue, g: gain(truthValue), r: expectedRecord(s, pid, 'TRUE') },
    { value: SILENT, g: gain(SILENT), r: expectedRecord(s, pid, 'SILENT') },
  ];
  const best = honest[0].g + cv * honest[0].r >= honest[1].g + cv * honest[1].r - 1e-9 ? honest[0] : honest[1];
  const lieGain = gain(lieValue) - best.g;
  const loss = cv * (best.r - expectedRecord(s, pid, 'LIE'));
  if (lieGain * (1 - honestyOf(s, pid)) > loss + 1e-9) return { value: lieValue, lieGain };
  return { value: best.value, lieGain };
}

/** The claims of one episode round, by speaker (public: they are messages). */
export function claimsOf(messages: readonly Message[], level: LevelId, round: number): Record<PlayerId, string> {
  const out: Record<PlayerId, string> = {};
  for (const m of messages) if (m.level === level && m.round === round && m.msg.type === 'CLAIM') out[m.from] = m.msg.value;
  return out;
}
