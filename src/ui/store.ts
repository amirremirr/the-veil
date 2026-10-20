import { create } from 'zustand';
import { reduce, HUMAN_ID } from '../engine/engine';
import { canResume } from '../engine/version';
import type { Action, Difficulty, GameState, LevelId, Ruleset, SetupConfig, ValuesCard } from '../engine/types';
import { act as flowAct, settle } from '../shared/flow';
import { leaveRoom, roomAct, sendRoomMessage } from './room';

export type Screen = 'title' | 'howPlay' | 'mode' | 'setup' | 'playMode' | 'playSetup' | 'game' | 'archives' | 'settings' | 'about' | 'friends' | 'lobby';

export interface Settings {
  reducedMotion: boolean;
  textSize: 'S' | 'M' | 'L';
  sound: boolean;
  theme: 'system' | 'light' | 'dark';
  difficulty: Difficulty;
  unlockAll: boolean;
  /** Which way to play is offered first (Play spec 8). A game in progress keeps its own ruleset. */
  ruleset: Ruleset;
}

export interface Progress {
  unlocked: number;
  best: Record<string, number>;
}

interface Saved {
  version: 1;
  settings: Settings;
  progress: Progress;
  game: GameState | null;
  /** The saved game of the other ruleset (D-93: Play and Study never share a save). Older saves have none. */
  playGame?: GameState | null;
  tipsSeen?: string[];
}

const KEY = 'the-veil:v1';

const defaultSettings: Settings = {
  reducedMotion: false,
  textSize: 'M',
  sound: false,
  theme: 'system',
  difficulty: 'NORMAL',
  unlockAll: false,
  ruleset: 'PLAY',
};

const rulesetOf = (g: GameState | null | undefined): Ruleset => (g?.ruleset === 'PLAY' ? 'PLAY' : 'STUDY');

/** Set when a saved game was dropped because the rules changed since it was saved (D-75). */
let staleSaveDropped = false;

/**
 * Read the stored data. A game saved under other rules or parameters (or before D-75) would not
 * continue as it began, so it is dropped (`dropped: true`); settings, progress and tips are kept.
 */
export function parseSaved(raw: string | null): { saved: Saved | null; dropped: boolean } {
  try {
    if (!raw) return { saved: null, dropped: false };
    const v = JSON.parse(raw) as Saved;
    if (v?.version !== 1) return { saved: null, dropped: false };
    if (v.game && v.game.version !== 1) v.game = null;
    // Each slot holds only its own ruleset's game (a Play game in the Study slot, or the reverse, is dropped).
    if (v.game && rulesetOf(v.game) !== 'STUDY') v.game = null;
    if (v.playGame && (v.playGame.version !== 1 || rulesetOf(v.playGame) !== 'PLAY' || !canResume(v.playGame))) v.playGame = null;
    if (v.game && !canResume(v.game)) {
      v.game = null;
      return { saved: v, dropped: true };
    }
    return { saved: v, dropped: false };
  } catch {
    return { saved: null, dropped: false };
  }
}

function load(): Saved | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  const { saved, dropped } = parseSaved(raw);
  if (dropped && saved) {
    // Write the data back without the old game, so the title-screen notice shows once, not on every visit.
    staleSaveDropped = true;
    save(saved);
  }
  return saved;
}

function save(data: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, quota). The game still works without it.
  }
}

export function randomSeed(): string {
  const words = ['ledger', 'stamp', 'form', 'veil', 'quota', 'floor', 'median', 'lemon', 'binder', 'memo', 'audit', 'decree'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

interface Store {
  screen: Screen;
  /** The game being played (either ruleset). */
  game: GameState | null;
  /** The other ruleset's saved game, kept while this one is played. */
  shelf: GameState | null;
  /** Swap in the shelved game and continue it. */
  resumeShelf(): void;
  settings: Settings;
  progress: Progress;
  setupFor: { mode: SetupConfig['mode']; level?: LevelId } | null;
  /** First message id of the current talk phase, so the chat strip shows only this round's talk. */
  talkFrom: number | null;
  tipsSeen: string[];
  /** Playing in a multiplayer room: the screens show the room's view and actions go to the server. */
  online: boolean;
  /** A saved game was dropped because the game's rules changed since it was saved (D-75). */
  staleSave: boolean;
  /** Where "Play with friends" opens: create a room, or join one (with a code from a share link). */
  friendsFor: { tab: 'create' | 'join'; code?: string } | null;
  goOnline(): void;
  leaveOnline(): void;
  go(screen: Screen): void;
  /** One tap of the main button on the current screen (see src/shared/flow.ts). */
  act(decision?: unknown, guesses?: Record<string, ValuesCard>): void;
  dismissTip(id: string): void;
  resetTips(): void;
  chooseMode(mode: SetupConfig['mode'], level?: LevelId): void;
  start(config: Omit<SetupConfig, 'seed'> & { seed?: string }): void;
  dispatch(action: Action): void;
  replay(sameSeed: boolean): void;
  nextSingleLevel(): void;
  quitGame(): void;
  updateSettings(patch: Partial<Settings>): void;
  resetProgress(): void;
}

const saved = load();

export const useStore = create<Store>((set, get) => {
  const persist = () => {
    const { settings, progress, game, shelf, tipsSeen } = get();
    const slot = (r: Ruleset) => (rulesetOf(game) === r && game ? game : rulesetOf(shelf) === r && shelf ? shelf : null);
    save({ version: 1, settings, progress, game: slot('STUDY'), playGame: slot('PLAY'), tipsSeen });
  };
  const recordProgress = (g: GameState) => {
    // Unlock level k+1 when level k's debrief is reached; remember best level scores.
    if (g.phase.kind !== 'LEVEL_DEBRIEF' || g.play) return;
    const p = { ...get().progress, best: { ...get().progress.best } };
    p.unlocked = Math.max(p.unlocked, Math.min(5, g.levelIndex + 1));
    const human = g.scores[HUMAN_ID];
    if (human) {
      const key = `L${g.levelIndex}`;
      const sc = Math.round(human.byLevel[g.levelIndex - 1]);
      p.best[key] = Math.max(p.best[key] ?? -Infinity, sc);
    }
    set({ progress: p });
  };
  const commit = (prev: GameState, next: GameState) => {
    if (next === prev) return;
    const enteredTalk = next.phase.kind === 'TALK' && (next.phaseIdx !== prev.phaseIdx || next.levelIndex !== prev.levelIndex);
    set({ game: next, ...(enteredTalk ? { talkFrom: prev.nextMessageId } : {}) });
    recordProgress(next);
    persist();
  };
  return {
    screen: 'title',
    online: false,
    friendsFor: null,
    goOnline() {
      set({ online: true, screen: 'game' });
    },
    leaveOnline() {
      leaveRoom();
      set({ online: false, screen: 'title' });
    },
    talkFrom: null,
    tipsSeen: saved?.tipsSeen ?? [],
    game: saved?.game ?? saved?.playGame ?? null,
    shelf: saved?.game ? saved?.playGame ?? null : null,
    resumeShelf() {
      const { game, shelf } = get();
      if (!shelf) return;
      set({ game: shelf, shelf: game, screen: 'game', talkFrom: null });
      persist();
    },
    staleSave: staleSaveDropped,
    settings: { ...defaultSettings, ...(saved?.settings ?? {}) },
    progress: saved?.progress ?? { unlocked: 1, best: {} },
    setupFor: null,
    go(screen) {
      set({ screen });
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },
    chooseMode(mode, level) {
      set({ setupFor: { mode, level }, screen: 'setup' });
    },
    start(config) {
      const seed = config.seed?.trim() || randomSeed();
      // Solo play: one human seat with HUMAN_ID (multiplayer rooms pass several, see server/).
      const humans = [{ id: HUMAN_ID, name: config.humanName || 'You' }];
      const g = settle(reduce(null as unknown as GameState, { type: 'START_RUN', config: { ...config, humans, seed } }));
      // A game of the other ruleset is kept on the shelf, not overwritten (D-93).
      const cur = get().game;
      const shelf = cur && rulesetOf(cur) !== rulesetOf(g) ? cur : rulesetOf(get().shelf) !== rulesetOf(g) ? get().shelf : null;
      set({ game: g, shelf, screen: 'game', talkFrom: null });
      persist();
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },
    dispatch(action) {
      if (get().online) {
        // Online, the server applies every action; a client can only talk or press its own buttons.
        if (action.type === 'SEND_MESSAGE') sendRoomMessage(action.msg);
        else if (action.type === 'ADVANCE') roomAct();
        return;
      }
      const g = get().game;
      if (!g) return;
      const next = reduce(g, action);
      if (next === g) return;
      commit(g, settle(next));
    },
    act(decision, guesses) {
      if (get().online) return roomAct(decision, guesses);
      const g = get().game;
      if (!g) return;
      commit(g, flowAct(g, HUMAN_ID, decision, guesses));
    },
    dismissTip(id) {
      if (get().tipsSeen.includes(id)) return;
      set({ tipsSeen: [...get().tipsSeen, id] });
      persist();
    },
    resetTips() {
      set({ tipsSeen: [] });
      persist();
    },
    replay(sameSeed) {
      const g = get().game;
      if (!g) return;
      get().start({ ...g.config, seed: sameSeed ? g.config.seed : undefined });
    },
    nextSingleLevel() {
      const g = get().game;
      if (!g) return;
      const level = Math.min(5, g.levelIndex + 1) as LevelId;
      get().start({ ...g.config, mode: 'SINGLE_LEVEL', level, seed: undefined });
    },
    quitGame() {
      set({ screen: 'title' });
      persist();
    },
    updateSettings(patch) {
      set({ settings: { ...get().settings, ...patch } });
      persist();
    },
    resetProgress() {
      set({ progress: { unlocked: 1, best: {} }, game: null });
      persist();
    },
  };
});
