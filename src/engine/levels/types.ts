import type { TalkMenu } from '../core';
import type { GameState, LevelId, Phase, PlayerId, StructuredMessage, ValuesCard } from '../types';

export interface BotIntent {
  /** Option the bot currently intends to support (SUPPORT messages). */
  support?: string;
  /** A plausible alternative it could falsely support. */
  decoy?: string;
  /** Actions it intends to take (PROMISE messages). */
  promise?: string[];
  /** Actions it does not intend to take (false PROMISE messages). */
  falsePromise?: string[];
}

export interface LevelDefinition {
  id: LevelId;
  rounds: number;
  /** Set s.levelState and per-player private/public info. Uses the game stream only. */
  init(s: GameState): void;
  /** Every phase after INTRO, in order, for the whole level. */
  phases(s: GameState): Phase[];
  onEnter?(s: GameState, phase: Phase): void;
  /** Players who must submit a decision for this step (may be empty: the step is skipped). */
  deciders(s: GameState, step: string): PlayerId[];
  /** Normalize a submitted decision, or return null if invalid. */
  validate(s: GameState, step: string, pid: PlayerId, decision: unknown): unknown | null;
  botDecide(s: GameState, botId: PlayerId, step: string): unknown;
  /** Apply rules and random draws for a completed DECIDE step. May call finishRound. */
  resolve(s: GameState, step: string, decisions: Record<PlayerId, unknown>): void;
  talkMenu(s: GameState, phase: Phase): TalkMenu;
  /** The decision step where a SUPPORT/PROMISE sent now will be checked. */
  checkStep(s: GameState, phase: Phase, msg: StructuredMessage): string | undefined;
  messageKept(s: GameState, step: string, msg: StructuredMessage, decision: unknown): boolean;
  botIntent(s: GameState, botId: PlayerId, phase: Phase): BotIntent;
  /** Steps whose individual decisions are public and drive Bayesian belief updates. */
  observable: string[];
  /** P(actor chooses `decision` | actor holds `card`), from the observer's information. */
  likelihood(s: GameState, observer: PlayerId, actor: PlayerId, step: string, decision: unknown, card: ValuesCard): number;
  debrief(s: GameState): unknown;
  view(s: GameState, viewer: PlayerId, revealPrivate: boolean): unknown;
}
