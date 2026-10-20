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
  /** Section 7.3: the table's aggregated bot beliefs about one contestant (null until it is shown). */
  poll: { target: PlayerId; card: ValuesCard; share: number } | null;
  /** The viewer's own card guesses; others' guesses only once every card is public. */
  guesses: Partial<Record<LevelId, Record<PlayerId, EpisodeGuess>>>;
  /** Final scores of everyone, once every card is public. */
  finalScores: Record<PlayerId, number> | null;
  startingBank: number;
  /** Episode 3: the numbers in force now (Play overrides plus this round's event), all public. */
  l3?: { loss: number; gymCost: number; gymFactor: number; pLow: number; pHigh: number; riskMult: number; riskCap: number; premiumMult: number; mandateExtra: number; loading: number; priceLoss: number; pBar: number; baseIncome: number; livingCost: number };
}
