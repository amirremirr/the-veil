// Every Play-mode number (PLAY_MODE_SPEC.md). These are overrides applied on top of the Study params for
// a Play game only; Study params (../params.ts) are never changed for Play. They live in their own file
// so the Study params hash reads only Study values (DECISIONS.md D-92). The Play rules version hashes
// them together with the Study rules (src/engine/version.ts).
import type { ValuesCard } from '../types';

export const PLAY = {
  /** Section 4.1: every contestant starts a life with this many coins. */
  STARTING_BANK: 100,
  /** Section 4.4: the starting bank of a single episode. Spec guess 100; tuned to 20 so one loss means debt (D-97). */
  EPISODE_STARTING_BANK: 20,
  /** Section 4.1: bank = bank + W - LIVING_COST after every round. */
  LIVING_COST: 30,
  /** Section 4.2: points lost per coin of debt at the end of a round, capped per round. */
  DEBT_POINTS_PER_COIN: 1,
  DEBT_PENALTY_CAP: 40,
  /** Section 4.3: final score = BANK_WEIGHT x bank + MISSION_WEIGHT x k x mission - debt stress. */
  BANK_WEIGHT: 0.5,
  MISSION_WEIGHT: 0.5,
  /** k per mission, calibrated by bot-only simulation so each mission's mean equals the mean bank (D-96). */
  MISSION_SCALE: { EGOIST: 1, RAWLSIAN: 1.78, UTILITARIAN: 1, MERITOCRAT: 1.16 } as Record<ValuesCard, number>,
  /** The mission bar's full mark: start bank + this share of the episode's income minus living cost (D-102). */
  MISSION_GOAL_SHARE: 0.8,
  /** Section 7.4: points for a correct end-of-episode card guess. */
  GUESS_POINTS: 15,
  /** Section 6.1: chance of an event card before a round (otherwise "Quiet week"). */
  EVENT_CHANCE: 0.6,
  /** Episode 3 overrides of the Study Level 3 params (Section 5). Loss: spec guess 100, tuned to 140 for F-f (D-97). */
  L3: { ROUNDS: 3, VOLUNTARY_ROUNDS: 2, LOSS: 140, GYM_COST: 6 },
  /** Section 6.2, Episode 3 deck: each card changes one Level 3 parameter for one round. */
  L3_EVENTS: {
    STORM: { RISK_MULT: 1.5, RISK_CAP: 0.9 },
    GYM_SALE: { GYM_COST: 3 },
    PRICE_WAR: { PREMIUM_MULT: 0.8 },
    BREAKTHROUGH: { LOSS: 50 },
    PAPERWORK: { MANDATE_EXTRA: 5 },
  },
  /** Section 7.3: the audience poll appears from this round of an episode on. */
  POLL_FROM_ROUND: 2,
  /** Section 7.1: the danger meter is green above this bank, amber from 0 to it, red in debt. */
  DANGER_AMBER_BELOW: 60,
  /** Section 7.2: every reveal sequence takes at most this long. */
  REVEAL_MAX_MS: 4000,
  /** Section 7.3: chance that a bot reacts to a result (presentation only, from the flavor hash). */
  BOT_REACTION_CHANCE: 0.35,
  /** Section 8: Play-room timers (used from P4). */
  DECISION_SECONDS: 30,
  RESULTS_SECONDS: 15,
  SUMMARY_SECONDS: 45,
};

export type L3EventId = keyof typeof PLAY.L3_EVENTS;
export const L3_EVENT_IDS = Object.keys(PLAY.L3_EVENTS) as L3EventId[];
