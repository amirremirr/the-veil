import { create } from 'zustand';
import { reduce, HUMAN_ID } from '../engine/engine';
import type { Action, Difficulty, GameState, LevelId, SetupConfig, ValuesCard } from '../engine/types';
import { act as flowAct, settle } from '../shared/flow';

export type Screen = 'title' | 'mode' | 'setup' | 'game' | 'archives' | 'settings' | 'about';

export interface Settings {
  reducedMotion: boolean;
  textSize: 'S' | 'M' | 'L';
  sound: boolean;
  theme: 'system' | 'light' | 'dark';
  difficulty: Difficulty;
  unlockAll: boolean;
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
};

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (v?.version !== 1) return null;
    if (v.game && v.game.version !== 1) v.game = null;
    // Games saved before rules v2 have no level points (D-45); they cannot be resumed.
    if (v.game && Object.values(v.game.scores).some((sc) => !Array.isArray(sc.points))) v.game = null;
    return v;
  } catch {
    return null;
  }
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
  game: GameState | null;
  settings: Settings;
  progress: Progress;
  setupFor: { mode: SetupConfig['mode']; level?: LevelId } | null;
  /** First message id of the current talk phase, so the chat strip shows only this round's talk. */
  talkFrom: number | null;
  tipsSeen: string[];
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
    const { settings, progress, game, tipsSeen } = get();
    save({ version: 1, settings, progress, game, tipsSeen });
  };
  const recordProgress = (g: GameState) => {
    // Unlock level k+1 when level k's debrief is reached; remember best level scores.
    if (g.phase.kind !== 'LEVEL_DEBRIEF') return;
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
    talkFrom: null,
    tipsSeen: saved?.tipsSeen ?? [],
    game: saved?.game ?? null,
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
      set({ game: g, screen: 'game', talkFrom: null });
      persist();
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },
    dispatch(action) {
      const g = get().game;
      if (!g) return;
      const next = reduce(g, action);
      if (next === g) return;
      commit(g, settle(next));
    },
    act(decision, guesses) {
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
