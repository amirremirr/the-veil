// The timeout rule (D-63): a human who has not decided in time is decided for by the bot evaluation
// code, playing their own card with the "dot" bot profile and no messages. The calculation runs on a
// throwaway copy of the state with a private random stream seeded from (game seed, seat, phase step),
// like the card's-best lines (D-43), so it never consumes the game or bot streams. The result is
// logged as an ordinary SUBMIT_DECISION (marked auto), so a replay from seed plus log is unchanged.
import { L2 } from './params';
import { idx, makeBotProfile } from './core';
import { hashString } from './rng';
import { LEVELS } from './levels';
import type { GameState, PlayerId } from './types';

export const AUTO_PROFILE = 'dot' as const;

/** Decisions the bot code does not make for itself (unpaid answers only humans give). */
const FALLBACK: Record<string, unknown> = { POLL: 50, BONUS: L2.BONUS_POT / 2 };

/** The key of the private stream: game seed, seat, and the exact phase step. */
export function autoStreamKey(s: GameState, pid: PlayerId): string {
  return `${s.seed}|auto|seat${idx(s, pid)}|L${s.levelIndex}|n${s.levelsPlayed.length}|p${s.phaseIdx}|${s.phase.kind}:${s.phase.step ?? ''}`;
}

/** The decision the timeout rule makes for `pid` in the current DECIDE phase (or GUESS: no guesses). */
export function autoDecision(s: GameState, pid: PlayerId): unknown {
  if (s.phase.kind === 'GUESS') return {};
  if (s.phase.kind !== 'DECIDE') throw new Error('autoDecision outside a decision');
  const stepId = s.phase.step!;
  const d = LEVELS[s.levelIndex];
  if (stepId in FALLBACK) return FALLBACK[stepId];
  // Throwaway copy: private streams, no messages, the seat played by the dot profile.
  const c: GameState = structuredClone({ ...s, log: [] });
  const key = autoStreamKey(s, pid);
  c.rng = { game: hashString(`${key}|game`), bots: hashString(`${key}|bots`) };
  c.messages = [];
  const me = c.players[idx(c, pid)];
  me.botProfile = makeBotProfile(AUTO_PROFILE, s.difficulty);
  const decision = d.botDecide(c, pid, stepId);
  const ok = d.validate(s, stepId, pid, decision);
  if (ok === null) throw new Error(`auto decision invalid at ${stepId}`);
  return ok;
}
