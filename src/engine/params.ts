// Every numeric constant in the game lives here. Nothing else in the codebase
// may hardcode a parameter. See DECISIONS.md for any value changed from the spec.

import type { BotKey, ValuesCard } from './types';

export const VALUES_DECK: ValuesCard[] = ['EGOIST', 'EGOIST', 'RAWLSIAN', 'UTILITARIAN', 'MERITOCRAT'];
export const VALUES_PRIOR: Record<ValuesCard, number> = {
  EGOIST: 0.4,
  RAWLSIAN: 0.2,
  UTILITARIAN: 0.2,
  MERITOCRAT: 0.2,
};

export const SCORE = {
  WEALTH_WEIGHT: 0.5,
  METRIC_WEIGHT: 0.5,
  MERITOCRAT_MISMATCH_WEIGHT: 0.5,
  /** Run bonus per correct Values guess, in level points (D-46). */
  GUESS_BONUS: 25,
  /**
   * Level points (D-45, D-54): BASE + SPREAD x (your level score - table average) / LEVEL_SD[level].
   * LEVEL_SD is the typical within-table spread of each level's raw scores, measured by the simulator
   * (`npm run sim`, line "Level spread SD"). Recalibrate it whenever level rules change.
   */
  LEVEL_POINTS_BASE: 100,
  LEVEL_POINTS_SPREAD: 50,
  LEVEL_SD: [49.8, 57.7, 39.2, 114.5, 28.9],
};

/**
 * Balancing handicap (DECISIONS.md, D-07): each card's metric is multiplied so that its
 * simulated average equals average wealth. Without it, min(W) <= W means Rawlsians
 * almost never win. Calibrated with `npx tsx sim/calibrate.ts`.
 */
export const METRIC_SCALE: Record<ValuesCard, number> = {
  EGOIST: 1,
  RAWLSIAN: 1.66,
  UTILITARIAN: 1,
  MERITOCRAT: 1.27,
};

/**
 * Hardship line (DECISIONS.md D-39): a player's own round score loses POINTS_PER_COIN points
 * for every coin of their own wealth below LINE. It never changes wealth or anyone's metric.
 */
export const HARDSHIP = { LINE: 40, POINTS_PER_COIN: 2 };

export const BOT_PROFILES: Record<BotKey, { name: string; rho: number; lambda: number; honesty: number; sigma: number }> = {
  chet: { name: 'Chet Bootstraps', rho: 0.5, lambda: 3, honesty: 0.5, sigma: 0.6 },
  marigold: { name: 'Marigold Fairweather', rho: 2.5, lambda: 2, honesty: 0.9, sigma: 0.2 },
  ugo: { name: 'Prof. Ugo Utilé', rho: 1.0, lambda: 6, honesty: 0.8, sigma: 0.3 },
  dot: { name: 'Dot Ledger', rho: 1.5, lambda: 4, honesty: 0.4, sigma: 0.4 },
};
export const BOT_ORDER: BotKey[] = ['chet', 'marigold', 'ugo', 'dot'];

export const DIFFICULTY = {
  EASY: { lambdaMult: 0.5, honestyFloor: 0.8, honestyMult: 1 },
  NORMAL: { lambdaMult: 1, honestyFloor: 0, honestyMult: 1 },
  HARD: { lambdaMult: 1.5, honestyFloor: 0, honestyMult: 0.7 },
};

export const BOT = {
  /**
   * Bots' utility is CARA with a = rho / RISK_POINTS per score point (D-77). At a score of 50 this equals
   * the local risk aversion of the CRRA-on-(score + 50) it replaced, so ordinary gambles look the same.
   */
  RISK_POINTS: 100,
  MC_SAMPLES: 300,
  BELIEF_MC_SAMPLES: 40,
  BELIEF_LAMBDA: 3,
  /** Logit scale in coins: P(a_k) is proportional to exp(lambda x CE_k / LOGIT_COIN_SCALE) (D-59). */
  LOGIT_COIN_SCALE: 10,
  /**
   * The hardship line already makes losses hurt, so bots' risk aversion would count risk twice. Every bot's
   * rho is multiplied by this, keeping their order (D-51).
   */
  RHO_SCALE: 0.25,
  /** Risk aversion bots assume for others when reading votes: 1 x RHO_SCALE (D-51). */
  BELIEF_RHO: 0.25,
  BELIEF_FLOOR: 0.01,
  OTHERS_EGOIST_WEIGHT: 0.5,
  CLAIM_BELIEF_WEIGHT: 0.5,
  ACCUSE_BELIEF_WEIGHT: 0.25,
  MESSAGE_COUNT_WEIGHTS: [0.2, 0.55, 0.25],
  MESSAGE_SUPPORT_SHARE: 0.7,
  MESSAGE_ACCUSE_PROB: 0.15,
  MESSAGE_FLAVOR_PROB: 0.1,
  // Level 5 vote-prediction noise for the simple "others vote by own wealth" model.
  VOTE_PREDICT_CONFIDENCE: 0.85,
};

export const TALK = { MAX_MESSAGES: 2 };

export const L1 = {
  ROUNDS: 3,
  INCOME_DECK: [20, 50, 90, 160],
  KAPPA: 0.4,
  FLOOR: 40,
  RANGE_CAP: 100,
  TAX_GRID_STEP: 0.05,
  TAX_GRID_MAX: 0.95,
};

export const L2 = {
  ROUNDS: 4,
  TALENT_DECK: [0.8, 1.2, 1.6, 2.0],
  BASE_INCOME: 20,
  TALENT_MULT: 4,
  EFFORT_MAX: 10,
  EFFORT_COST: 0.4,
  LUCK_VALUES: [-20, 0, 10, 30, 60],
  KAPPA: 0.1,
  TAX_OPTIONS: [0, 0.2, 0.4, 0.6, 0.8],
  POLL_ROUNDS: 3,
  BONUS_POT: 100,
  FAIRNESS_TIE: 0.02,
};

export const L3 = {
  ROUNDS: 4,
  VOLUNTARY_ROUNDS: 2,
  BASE_INCOME: 100,
  P_LOW: 0.1,
  P_HIGH: 0.4,
  P_HIGH_SHARE: 0.5,
  P_BAR: 0.25,
  LOSS: 80,
  GYM_COST: 6,
  GYM_FACTOR: 0.5,
  LOADING: 1.1,
  COVERAGE_OPTIONS: [0.5, 1.0],
};

export const L4 = {
  ROUNDS: 5,
  BASELINE_ROUNDS: 3,
  CARE_PROB_SQUARE: 0.7,
  CARE_PROB_CIRCLE: 0.3,
  // Level 4 money amounts doubled in rules v2 (D-53); training costs 1.5 x the original scale to offset the hardship line (D-57).
  COST_OPTIONS: [15, 30, 45, 60],
  PASS_IF_SKILLED: 0.8,
  PASS_IF_UNSKILLED: 0.3,
  PRIOR_CIRCLE: 0.6,
  PRIOR_SQUARE: 0.3,
  THRESHOLD: 0.6,
  WAGE_SIMPLE: 40,
  WAGE_GREEDY: 180,
  WAGE_FLEXIBLE: 110,
  CHAOS_COST: 80,
  CHAOS_COST_SUBSIDIZED: 20,
  UPDATE_WEIGHT: 0.2,
  // Counterfactual scenarios (Section 4, Level 4 debrief).
  CF_EQUAL_PRIOR: 0.45,
  CF_EQUAL_CARE: 0.5,
  CF_REPLAYS: 24,
  CF_BOT_SAMPLES: 40,
};

export const L5 = {
  TAX_OPTIONS: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
  FLOOR_OPTIONS: [0, 25, 40, 55],
  KAPPA: 0.4,
  INCOME_DECK: [30, 60, 100, 170],
  DONATION_MAX: 20,
  DONATION_OPTIONS_BOT: [0, 5, 10, 20],
  RECIPROCITY: 0.3,
  CONSISTENT_BAND: 0.1,
  STRONG_SHIFT: 0.2,
  BAND_LOW_MAX: 0.2,
  BAND_HIGH_MIN: 0.6,
};

export const EPS = 1e-9;
