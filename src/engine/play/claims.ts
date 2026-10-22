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

/**
 * D-141: each bot's belief about every other contestant is its own little table over that contestant's two
 * hidden cards (Episode 3: high or low risk, Worrier or Calm), in the order HIGH+second, HIGH+not,
 * LOW+second, LOW+not. Cards are dealt independently, 50/50, so the prior is the product of the shares and
 * nothing one contestant does says anything about another's cards.
 */
const HOLD = [
  [true, true],
  [true, false],
  [false, true],
  [false, false],
] as const;

/** At an episode start: every bot's prior, `pFact` and `pSecond` per contestant, independent across players. */
export function initFactBeliefs(s: GameState, pFact: number, pSecond = 0): void {
  const pl = s.play!;
  pl.belief = {};
  pl.belief2 = {};
  pl.joint = {};
  for (const obs of s.players) {
    if (obs.isHuman) continue;
    pl.joint[obs.id] = {};
    for (const o of s.players) {
      if (o.id === obs.id) continue;
      pl.joint[obs.id][o.id] = HOLD.map(([f, g]) => (f ? pFact : 1 - pFact) * (g ? pSecond : 1 - pSecond));
    }
    refresh(s, obs.id);
  }
}

/** Normalize one table, keep each cell at least BELIEF_FLOOR (cells the prior rules out stay at 0), and refresh. */
function settle(s: GameState, obs: PlayerId, target: PlayerId, w: number[]): void {
  let z = w.reduce((x, y) => x + y, 0);
  if (!(z > 0)) return;
  const prior = s.play!.joint[obs][target];
  let n = w.map((x, i) => (prior[i] > 0 || x > 0 ? Math.max(PLAY.BELIEF_FLOOR, x / z) : 0));
  z = n.reduce((x, y) => x + y, 0);
  n = n.map((x) => x / z);
  s.play!.joint[obs][target] = n;
  refresh(s, obs);
}

const marginal = (w: readonly number[], key: 0 | 1) => w.reduce((acc, x, i) => (HOLD[i][key] ? acc + x : acc), 0);

function refresh(s: GameState, obs: PlayerId): void {
  const pl = s.play!;
  pl.belief[obs] = {};
  pl.belief2[obs] = {};
  for (const [o, w] of Object.entries(pl.joint[obs])) {
    pl.belief[obs][o] = marginal(w, 0);
    pl.belief2[obs][o] = marginal(w, 1);
  }
}

/**
 * Bayes' rule on every bot's table for `target`: `lik(fact, second)` is the likelihood of what `target` did
 * if it holds the fact (high risk) or not, and the second card (Worrier) or not.
 */
export function observe(s: GameState, target: PlayerId, lik: (fact: boolean, second: boolean) => number): void {
  for (const [obs, j] of Object.entries(s.play!.joint)) {
    if (obs === target || !j[target]) continue;
    settle(s, obs, target, j[target].map((x, i) => x * lik(HOLD[i][0], HOLD[i][1])));
  }
}

/**
 * A claim about the fact (Study's rule): mix the table toward the same table conditioned on the claim being
 * true, with weight CLAIM_WEIGHT x the speaker's record. The second card is never claimed.
 */
function claimWeights(w: readonly number[], claimTrue: boolean, reliability: number): number[] | null {
  const cond = w.map((x, i) => (HOLD[i][0] === claimTrue ? x : 0));
  const z = cond.reduce((x, y) => x + y, 0);
  if (!(z > 0)) return null;
  const k = PLAY.CLAIM_WEIGHT * reliability;
  return w.map((x, i) => (1 - k) * x + (k * cond[i]) / z);
}

export function claimUpdate(s: GameState, target: PlayerId, claimTrue: boolean, reliability: number): void {
  for (const [obs, j] of Object.entries(s.play!.joint)) {
    if (obs === target || !j[target]) continue;
    const w = claimWeights(j[target], claimTrue, reliability);
    if (w) settle(s, obs, target, w);
  }
}

/** What `obs` would believe of `target` after this claim (nothing changes). */
export function beliefAfterClaim(s: GameState, obs: PlayerId, target: PlayerId, claimTrue: boolean, reliability: number): number {
  const w0 = s.play!.joint[obs][target];
  const w = claimWeights(w0, claimTrue, reliability) ?? w0;
  const z = w.reduce((x, y) => x + y, 0);
  return marginal(w.map((x) => x / z), 0);
}

/** The fact becomes public (Leaked Medical Files): every bot's belief settles on the true fact; the second card stays hidden. */
export function revealFacts(s: GameState, holds: (pid: PlayerId) => boolean): void {
  for (const [obs, j] of Object.entries(s.play!.joint))
    for (const [target, w] of Object.entries(j)) settle(s, obs, target, w.map((x, i) => (HOLD[i][0] === holds(target) ? x : 0)));
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
