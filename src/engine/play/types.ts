import type { LevelId, PlayerId, ValuesCard } from '../types';

/** An event card for one round (Play spec Section 6), or a quiet week. */
export interface PlayEvent {
  /** Card id within its episode's deck, or 'QUIET'. */
  id: string;
  level: LevelId;
  round: number;
  /** Set when a card the spec allows only under some condition fell back to a quiet week (Paperwork Week). */
  fallback?: string;
}

/** Bank after every finished round, in seat order of the record. */
export interface BankRecord {
  level: LevelId;
  round: number;
  /** Money earned this round (W). */
  W: Record<PlayerId, number>;
  banks: Record<PlayerId, number>;
  /** Debt stress points taken this round. */
  stress: Record<PlayerId, number>;
  /** Public ranks after the round (Play spec 4.3: ranks are shown, never exact scores). */
  ranks: Record<PlayerId, number>;
}

export interface EpisodeGuess {
  target: PlayerId;
  card: ValuesCard;
  correct: boolean;
}

export interface PlayState {
  banks: Record<PlayerId, number>;
  /** Total debt stress points so far (public: they follow from public banks). */
  debtStress: Record<PlayerId, number>;
  /** Points from card guesses so far. */
  guessPoints: Record<PlayerId, number>;
  /** The current round's event (cleared at the start of each episode). */
  event: PlayEvent | null;
  /** Every event drawn, in order. */
  events: PlayEvent[];
  bankHistory: BankRecord[];
  /** Banks when each episode started. */
  episodeStart: Partial<Record<LevelId, Record<PlayerId, number>>>;
  /** End-of-episode card guesses, per episode and guesser. */
  guesses: Partial<Record<LevelId, Record<PlayerId, EpisodeGuess>>>;
  /** v2 Section 3.5: each bot's honesty trait for this life (private; never in a view). */
  honesty: Record<PlayerId, number>;
  /**
   * v2 Section 3.5: each bot's belief that the episode's hidden fact is true of each other contestant
   * (Episode 3: P(high risk)). Reset when an episode starts. Private; the view shows only the average.
   */
  belief: Record<PlayerId, Record<PlayerId, number>>;
  /**
   * D-120, D-128: the joint belief behind `belief` and `belief2`. Each bot weighs every pair of sets of
   * other contestants (who is high risk, who is a Worrier) with the dealt sizes (two of four each).
   */
  joint: Record<PlayerId, { states: Array<{ a: PlayerId[]; b: PlayerId[] }>; w: number[] }>;
  /** D-128: each bot's belief that each other contestant holds the second hidden trait (Episode 3: Worrier). Private. */
  belief2: Record<PlayerId, Record<PlayerId, number>>;
  /** Every claim decision of the life, silence included (private: `lieGain` and `truth` reveal types). */
  claimLog: ClaimRecord[];
  /**
   * Simulator only (D-130, contested decisions): at each bar vote, each member's belief that each other
   * applicant is high risk (a human member's is the audience poll). Private: beliefs are never in a view.
   */
  barReads: Array<{ level: LevelId; round: number; member: PlayerId; target: PlayerId; belief: number }>;
}

/** One claim decision (v2 Section 3), kept for the simulator's S-a and S-b and for the near miss. */
export interface ClaimRecord {
  pid: PlayerId;
  level: LevelId;
  round: number;
  topic: string;
  /** What the contestant said ('SILENT' for no claim) and the truth. */
  said: string;
  truth: string;
  lied: boolean;
  /** Bots only: coins the lie would gain over the best honest option, before its credibility cost. */
  lieGain: number | null;
}

/** v2 Section 6.1: the one change to your own decisions that would have left you richest. */
export interface NearMiss {
  kind: 'CLAIM' | 'CHOICE' | 'BAR' | 'REGIME';
  round: number;
  /** The decision you made and the one that would have paid more (CHOICE: {buy, gym}; BAR: target or null). */
  from: unknown;
  to: unknown;
  /** Coins more in your final bank. */
  gain: number;
}

export interface PlayView {
  /** Public (it is TV): every bank, debt stress, the bank history and every event. */
  banks: Record<PlayerId, number>;
  debtStress: Record<PlayerId, number>;
  bankHistory: BankRecord[];
  event: PlayEvent | null;
  events: PlayEvent[];
  /**
   * Rank only (1 = leading; ties share a rank). Exact scores stay hidden until cards are public. Null before
   * the episode's first result: with equal banks, ranks would only show each mission's scale (D-105).
   */
  ranks: Record<PlayerId, number> | null;
  /** The viewer's own mission and its progress. */
  /** `goal`: the mission bar's full mark, k x mission value (D-102). */
  mission: { card: ValuesCard; value: number; score: number; scale: number; bankPart: number; missionPart: number; stress: number; guessPoints: number; goal: number } | null;
  /**
   * v2 Section 3.2: the audience poll on READ screens, the average over the other bots of their belief that
   * each contestant's hidden fact is true (Episode 3: high risk). Null when the episode has no poll now.
   */
  poll: Record<PlayerId, number> | null;
  /** v2 Section 3.4: every contestant's public honesty record (claims checked so far, how many were true). */
  record: Record<PlayerId, { made: number; kept: number }>;
  /** The viewer's own card guesses; others' guesses only once every card is public. */
  guesses: Partial<Record<LevelId, Record<PlayerId, EpisodeGuess>>>;
  /** Final scores of everyone, once every card is public. */
  finalScores: Record<PlayerId, number> | null;
  startingBank: number;
  /** Episode 3: the numbers in force now (Play overrides plus this round's event), all public. */
  l3?: { loss: number; gymCost: number; gymFactor: number; pLow: number; pHigh: number; riskMult: number; riskCap: number; premiumMult: number; mandateExtra: number; loading: number; priceLoss: number; pBar: number; baseIncome: number; livingCost: number };
}
