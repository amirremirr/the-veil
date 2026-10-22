// Every Play-mode number (PLAY_MODE_SPEC.md). These are overrides applied on top of the Study params for
// a Play game only; Study params (../params.ts) are never changed for Play. They live in their own file
// so the Study params hash reads only Study values (DECISIONS.md D-92). The Play rules version hashes
// them together with the Study rules (src/engine/version.ts).
import type { ValuesCard } from '../types';

export const PLAY = {
  /** Section 4.1: every contestant starts a life with this many coins. */
  STARTING_BANK: 100,
  /** Section 4.4: the starting bank of a single episode. Spec guess 100; tuned to 20 so one loss means debt (D-97). */
  EPISODE_STARTING_BANK: 10,
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
  /** v2 Section 5: chance of an event card before a round (otherwise a quiet week). Was 0.6 in v1. */
  EVENT_CHANCE: 0.4,
  /**
   * Episode 3 overrides of the Study Level 3 params. v2 Section 4: 4 rounds, the regime vote after round 3.
   * Loss: spec guess 100, tuned to 140 for F-f (D-97).
   */
  L3: { ROUNDS: 4, VOLUNTARY_ROUNDS: 3, LOSS: 140, GYM_COST: 6 },
  /**
   * v2 Section 5: the Episode 3 deck in play. Paperwork Week was cut by the deck trim rule: in 2,000 bot
   * games it changed no bot's choice in any of its 81 draws (D-115). Its numbers stay in L3_EVENTS.
   */
  L3_DECK: ['STORM', 'GYM_SALE', 'PRICE_WAR', 'BREAKTHROUGH', 'LEAKED'] as string[],
  /** D-121: round 1 of Episode 3 is a launch round: SafeHands signs everyone up at the pooled price. */
  L3_LAUNCH: true,
  /**
   * D-128: Episode 3's second hidden card. Half the table are Worriers (dealt like the risk cards); a
   * Worrier's debt stress is multiplied by this. Calm players are unchanged. The author's range: 1.5 to 4.
   */
  WORRIER_STRESS_MULT: 3,
  /** D-122: bots count the debt stress a bank will still cost in the episode's later rounds. */
  DEBT_HORIZON: true,
  /**
   * D-140: every Play table seats this many contestants (bots fill the empty seats). Every Play target was
   * tuned on 4, and with 2 your own cards tell you the other player's. The engine still accepts other sizes
   * for the simulator and tests; the solo store always starts Play with this many.
   */
  SEATS: 4 as 2 | 3 | 4,
  /** v2 Section 5: Leaked Medical Files shows every risk type, only from this round of Episode 3. */
  LEAKED_FROM_ROUND: 2,
  /**
   * v2 Section 3.5: each bot's honesty trait, drawn once per life from the bot stream, uniform in its
   * personality's range. A seat played by the timeout rule uses the AUTO range (D-111).
   */
  HONESTY_RANGE: { chet: [0.3, 0.5], marigold: [0.85, 1], ugo: [0.55, 0.8], dot: [0.7, 0.9], AUTO: [0.7, 0.9] } as Record<string, [number, number]>,
  /**
   * v2 Section 3.5: coins a contestant gives up per unit of track record (share of claims true). A bot
   * lies when gain x (1 - honesty) exceeds CREDIBILITY_VALUE x the record it loses when caught (D-112).
   */
  CREDIBILITY_VALUE: 6,
  /** v2 Section 3.5: how far one claim moves a listener's belief, times the speaker's record (as Study's CLAIM_BELIEF_WEIGHT). */
  CLAIM_WEIGHT: 0.5,
  /** Beliefs about a hidden fact are kept inside these bounds (as Study's BELIEF_FLOOR). */
  BELIEF_FLOOR: 0.01,
  /**
   * D-133, the Bar: a member values barring an applicant at its expected saving on next round's price,
   * times the chance it stays in, times this scale (1 = the grounded rule), against 0 for barring no one.
   */
  BAR_GAIN_SCALE: 2,
  /** Section 6.2, Episode 3 deck: each card changes one Level 3 parameter for one round. */
  L3_EVENTS: {
    STORM: { RISK_MULT: 1.5, RISK_CAP: 0.9 },
    GYM_SALE: { GYM_COST: 3 },
    PRICE_WAR: { PREMIUM_MULT: 0.8 },
    BREAKTHROUGH: { LOSS: 50 },
    PAPERWORK: { MANDATE_EXTRA: 5 },
    /** v2 Section 5: every risk type is shown to the pool (no number changes). */
    LEAKED: {},
  },
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
