// Saved games from other rules are dropped once and the stored data keeps everything else (D-75, D-82).
import { describe, expect, it } from 'vitest';
import { parseSaved } from '../../src/ui/store';
import { createInitialState } from '../../src/engine/engine';

const game = createInitialState({ mode: 'SINGLE_LEVEL', level: 1, nPlayers: 3, difficulty: 'NORMAL', seed: 'saved', botSamples: 8 });
const base = { version: 1, settings: { difficulty: 'HARD' }, progress: { unlocked: 3, best: {} }, tipsSeen: ['a'] };

describe('parseSaved', () => {
  it('keeps a game saved under the current rules', () => {
    const r = parseSaved(JSON.stringify({ ...base, game }));
    expect(r.dropped).toBe(false);
    expect(r.saved?.game).toEqual(game);
  });

  it('drops a game from other rules (or with none) and keeps settings, progress and tips', () => {
    for (const old of [{ ...game, rules: undefined }, { ...game, rules: { ...game.rules!, params: 'x' } }]) {
      const r = parseSaved(JSON.stringify({ ...base, game: old }));
      expect(r.dropped).toBe(true);
      expect(r.saved?.game).toBeNull();
      expect(r.saved?.progress).toEqual(base.progress);
      expect(r.saved?.tipsSeen).toEqual(['a']);
      // What load() writes back parses cleanly the next time, with nothing left to drop.
      expect(parseSaved(JSON.stringify(r.saved)).dropped).toBe(false);
    }
  });

  it('handles empty or broken storage', () => {
    expect(parseSaved(null)).toEqual({ saved: null, dropped: false });
    expect(parseSaved('not json')).toEqual({ saved: null, dropped: false });
    expect(parseSaved(JSON.stringify({ version: 2 }))).toEqual({ saved: null, dropped: false });
  });
});
