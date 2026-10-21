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

/** Every way to pick k of the given players, in seat order. */
function combinations(xs: PlayerId[], k: number): PlayerId[][] {
  if (k === 0) return [[]];
  if (k > xs.length) return [];
  const [h, ...rest] = xs;
  return [...combinations(rest, k - 1).map((c) => [h, ...c]), ...combinations(rest, k)];
}

/**
 * At an episode start (D-120): the hidden fact is true of exactly `count` contestants (Episode 3: two are
 * high risk). Each bot knows its own fact, so it holds a joint belief over which of the others it is true
 * of, uniform at first: with 2 of 4 high, a high bot gives each other player 1/3, a low bot 2/3.
 */
export function initFactBeliefs(s: GameState, count: number, holds: (pid: PlayerId) => boolean): void {
  const pl = s.play!;
  pl.belief = {};
  pl.joint = {};
  for (const obs of s.players) {
    if (obs.isHuman) continue;
    const others = s.players.filter((o) => o.id !== obs.id).map((o) => o.id);
    const sets = combinations(others, count - (holds(obs.id) ? 1 : 0));
    pl.joint[obs.id] = { sets, w: sets.map(() => 1 / sets.length) };
    refresh(s, obs.id);
  }
}

/** Normalize the joint weights, keep each at least BELIEF_FLOOR, and recompute the marginals. */
function settle(s: GameState, obs: PlayerId, w: number[]): void {
  const j = s.play!.joint[obs];
  let z = w.reduce((a, b) => a + b, 0);
  if (!(z > 0)) return;
  let n = w.map((x) => Math.max(PLAY.BELIEF_FLOOR, x / z));
  z = n.reduce((a, b) => a + b, 0);
  n = n.map((x) => x / z);
  j.w = n;
  refresh(s, obs);
}

function marginal(sets: PlayerId[][], w: number[], target: PlayerId): number {
  return sets.reduce((a, set, i) => (set.includes(target) ? a + w[i] : a), 0);
}

function refresh(s: GameState, obs: PlayerId): void {
  const pl = s.play!;
  const j = pl.joint[obs];
  pl.belief[obs] = {};
  for (const o of s.players) if (o.id !== obs) pl.belief[obs][o.id] = marginal(j.sets, j.w, o.id);
}

/** Bayes' rule on every bot's joint belief, given the likelihood of what `target` did if the fact is true or false of it. */
export function observe(s: GameState, target: PlayerId, likTrue: number, likFalse: number): void {
  for (const [obs, j] of Object.entries(s.play!.joint)) {
    if (obs === target) continue;
    settle(s, obs, j.w.map((x, i) => x * (j.sets[i].includes(target) ? likTrue : likFalse)));
  }
}

/**
 * A claim (Study's rule on a joint belief): mix the belief toward the same belief conditioned on the claim
 * being true, with weight CLAIM_WEIGHT x the speaker's record.
 */
function claimWeights(w: number[], sets: PlayerId[][], target: PlayerId, claimTrue: boolean, reliability: number): number[] | null {
  const cond = w.map((x, i) => (sets[i].includes(target) === claimTrue ? x : 0));
  const z = cond.reduce((a, b) => a + b, 0);
  if (!(z > 0)) return null;
  const k = PLAY.CLAIM_WEIGHT * reliability;
  return w.map((x, i) => (1 - k) * x + (k * cond[i]) / z);
}

export function claimUpdate(s: GameState, target: PlayerId, claimTrue: boolean, reliability: number): void {
  for (const [obs, j] of Object.entries(s.play!.joint)) {
    if (obs === target) continue;
    const w = claimWeights(j.w, j.sets, target, claimTrue, reliability);
    if (w) settle(s, obs, w);
  }
}

/** What `obs` would believe of `target` after this claim (nothing changes). */
export function beliefAfterClaim(s: GameState, obs: PlayerId, target: PlayerId, claimTrue: boolean, reliability: number): number {
  const j = s.play!.joint[obs];
  const w = claimWeights(j.w, j.sets, target, claimTrue, reliability) ?? j.w;
  const z = w.reduce((a, b) => a + b, 0);
  return marginal(j.sets, w.map((x) => x / z), target);
}

/** Every fact becomes public (Leaked Medical Files): every bot's belief settles on the truth. */
export function revealFacts(s: GameState, holds: (pid: PlayerId) => boolean): void {
  for (const [obs, j] of Object.entries(s.play!.joint)) {
    const truth = s.players.filter((p) => p.id !== obs && holds(p.id)).map((p) => p.id);
    settle(s, obs, j.sets.map((set) => (set.length === truth.length && set.every((x) => truth.includes(x)) ? 1 : 0)));
  }
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
    claimUpdate(s, p.id, isTrueFact(value), rel[p.id]);
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
