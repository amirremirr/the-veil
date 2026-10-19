export type PlayerId = string;
export type ValuesCard = 'EGOIST' | 'RAWLSIAN' | 'UTILITARIAN' | 'MERITOCRAT';
export const VALUES_CARDS: ValuesCard[] = ['EGOIST', 'RAWLSIAN', 'UTILITARIAN', 'MERITOCRAT'];
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
export type Mode = 'FULL_RUN' | 'SINGLE_LEVEL';
export type LevelId = 1 | 2 | 3 | 4 | 5;
export type BotKey = 'chet' | 'marigold' | 'ugo' | 'dot';

export interface BotProfile {
  key: BotKey;
  rho: number;
  lambda: number;
  honesty: number;
  sigma: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  isHuman: boolean;
  botProfile?: BotProfile;
  values: ValuesCard;
  privateInfo: Record<string, unknown>;
  publicInfo: Record<string, unknown>;
}

export type PhaseKind =
  | 'VALUES_REVEAL'
  | 'INTRO'
  | 'BRIEFING'
  | 'TALK'
  | 'DECIDE'
  | 'REVEAL'
  | 'ROUND_SUMMARY'
  | 'LEVEL_DEBRIEF'
  | 'GUESS'
  | 'RUN_DEBRIEF'
  | 'END';

export interface Phase {
  kind: PhaseKind;
  step?: string;
  round: number;
}

export interface SetupConfig {
  mode: Mode;
  level?: LevelId;
  nPlayers: 2 | 3 | 4;
  difficulty: Difficulty;
  seed: string;
  /**
   * Human seats, in seat order ({id, name}); every other seat is a bot. Solo play passes one human
   * with HUMAN_ID. When omitted, one human with HUMAN_ID and `humanName` (older saves and tests).
   */
  humans?: HumanSeat[];
  humanName?: string;
  /** Simulation only: every seat is a bot. */
  allBots?: boolean;
  /** Simulation only: override Monte Carlo sample count for speed. */
  botSamples?: number;
  /** Simulation only: skip the Level 4 counterfactual replays. */
  skipCounterfactual?: boolean;
}

export interface HumanSeat {
  id: PlayerId;
  name: string;
}

export type StructuredMessage =
  | { type: 'SUPPORT'; option: string }
  | { type: 'OPPOSE'; option: string }
  | { type: 'CLAIM_VALUES'; card: ValuesCard }
  | { type: 'PROMISE'; action: string }
  | { type: 'ACCUSE'; target: PlayerId; card: ValuesCard }
  | { type: 'FLAVOR' };

export interface Message {
  id: number;
  from: PlayerId;
  msg: StructuredMessage;
  level: LevelId;
  round: number;
  /** Rendering variant chosen when sent, so text is stable on re-render. */
  variant: number;
  /** Decision step this message makes a checkable claim about (SUPPORT/PROMISE). */
  checkStep?: string;
  resolved?: boolean;
  kept?: boolean;
}

export interface RoundRecord {
  level: LevelId;
  round: number;
  W: Record<PlayerId, number>;
  M: Record<PlayerId, number>;
  S: Record<PlayerId, number>;
  effortShares: Record<PlayerId, number>;
  headline?: Headline;
}

export interface Headline {
  key: string;
  variant: number;
  vars: Record<string, string | number>;
}

export type Action =
  | { type: 'START_RUN'; config: SetupConfig }
  | { type: 'ADVANCE' }
  | { type: 'SEND_MESSAGE'; from: PlayerId; msg: StructuredMessage }
  /** `auto`: chosen by the timeout rule for a human who did not decide in time (logged like any decision). */
  | { type: 'SUBMIT_DECISION'; from: PlayerId; decision: unknown; auto?: true }
  /** `from` may be omitted only when the table has exactly one human (solo saves). */
  | { type: 'SUBMIT_GUESSES'; from?: PlayerId; guesses: Record<PlayerId, ValuesCard>; auto?: true };

export interface LoggedAction {
  action: Action;
}

export interface RngState {
  game: number;
  bots: number;
}

export type Beliefs = Record<PlayerId, Record<PlayerId, Record<ValuesCard, number>>>;

/** Which rules a game was played under (D-75); see src/engine/version.ts. */
export interface RulesVersion {
  /** SHA-256 prefix of every engine source file. */
  rules: string;
  /** Hash of every parameter value at the moment the game started. */
  params: string;
  /** Git commit of the build, or 'unknown'. Informational: a different commit with the same hashes replays the same. */
  commit: string;
}

export interface GameState {
  version: 1;
  /** Rules and parameters the game was started under (D-75). Missing in games saved before it. */
  rules?: RulesVersion;
  seed: string;
  rng: RngState;
  mode: Mode;
  difficulty: Difficulty;
  config: SetupConfig;
  players: Player[];
  levelIndex: LevelId;
  round: number;
  phase: Phase;
  phaseQueue: Phase[];
  phaseIdx: number;
  /** Secret decisions for the current DECIDE phase. */
  pending: Record<PlayerId, unknown>;
  talkSent: Record<PlayerId, number>;
  levelState: unknown;
  levelsPlayed: LevelId[];
  history: RoundRecord[];
  messages: Message[];
  nextMessageId: number;
  reliability: Record<PlayerId, { made: number; kept: number }>;
  botBeliefs: Beliefs;
  /** byLevel: raw level scores. points: level points (D-45). guessBonus: in level points. */
  scores: Record<PlayerId, { byLevel: number[]; points: number[]; guessBonus: number }>;
  /** `human` is the viewer's own guesses in a ViewState; in the GameState, `byHuman` holds every human's. */
  guesses?: {
    human: Record<PlayerId, ValuesCard>;
    byHuman?: Record<PlayerId, Record<PlayerId, ValuesCard>>;
    bots: Record<PlayerId, Record<PlayerId, ValuesCard>>;
  };
  /** Counterfactual overrides (Level 4 decomposition only). */
  cf?: {
    priorCircle?: number;
    priorSquare?: number;
    careCircle?: number;
    careSquare?: number;
    fast?: boolean;
    /** The rule HireBot uses after the referendum, whatever the vote (D-79: the decomposition holds the rule at No Change). */
    fixedPolicy?: 'A' | 'B' | 'C' | 'D';
  };
  botSamples: number;
  /** Debrief data of each finished level (used by the run debrief). */
  levelResults: Partial<Record<LevelId, unknown>>;
  log: LoggedAction[];
}

/** What a viewer is allowed to see. */
export interface ViewState {
  viewer: PlayerId;
  seed: string;
  mode: Mode;
  difficulty: Difficulty;
  players: Array<Omit<Player, 'values' | 'privateInfo' | 'botProfile'> & {
    values?: ValuesCard;
    privateInfo?: Record<string, unknown>;
    botKey?: BotKey;
  }>;
  levelIndex: LevelId;
  round: number;
  phase: Phase;
  phaseIdx: number;
  /** The current level's phase list (public structure; lets the UI look ahead). */
  queue: Phase[];
  waitingOn: PlayerId[];
  hasSubmitted: boolean;
  talkSent: number;
  levelView: unknown;
  levelResults: Partial<Record<LevelId, unknown>>;
  history: RoundRecord[];
  messages: Message[];
  scores: GameState['scores'];
  reliability?: GameState['reliability'];
  botBeliefs?: Record<PlayerId, Record<ValuesCard, number>>;
  guesses?: GameState['guesses'];
  revealAll: boolean;
}
