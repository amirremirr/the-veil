// UI V4: the pure pieces behind pacing, sound and the verb unlocks.
import { describe, expect, it } from 'vitest';
import { DURATION, revealPick } from '../../src/ui/play/tokens';
import { sizeOf } from '../../src/ui/play/sound';
import { newVerb, verbOn } from '../../src/ui/play/logic';

describe('UI V4 reveals (V4)', () => {
  it('give every staged item at least 1.5 s and the whole at most 6 s', () => {
    expect(DURATION.revealStep).toBeGreaterThanOrEqual(1500);
    for (let n = 0; n <= 25; n++) {
      const pick = revealPick(n);
      expect(pick.length * DURATION.revealStep).toBeLessThanOrEqual(DURATION.REVEAL_MAX);
      expect(pick.length).toBe(Math.min(n, 4));
      if (n) expect(pick[pick.length - 1]).toBe(n - 1);
      expect(new Set(pick).size).toBe(pick.length);
      expect([...pick].sort((a, b) => a - b)).toEqual(pick);
    }
  });
});

describe('UI V4 money sounds (V4)', () => {
  it('scale with the size of the change, the same way for gains and losses', () => {
    expect(sizeOf(5)).toBe('small');
    expect(sizeOf(-19)).toBe('small');
    expect(sizeOf(20)).toBe('medium');
    expect(sizeOf(-79)).toBe('medium');
    expect(sizeOf(80)).toBe('big');
    expect(sizeOf(-220)).toBe('big');
  });
});

describe('UI V4 verbs unlock one at a time in a life (V2)', () => {
  it('Episode 1 has no claim, call or gift; claims from 2, calls from 3, gifts from 4', () => {
    const life = (levelIndex: number) => ({ mode: 'LIFE' as const, levelIndex: levelIndex as 1 });
    expect([1, 2, 3, 4, 5].map((n) => verbOn(life(n), 'claim'))).toEqual([false, true, true, true, true]);
    expect([1, 2, 3, 4, 5].map((n) => verbOn(life(n), 'call'))).toEqual([false, false, true, true, true]);
    expect([1, 2, 3, 4, 5].map((n) => verbOn(life(n), 'give'))).toEqual([false, false, false, true, true]);
    expect([1, 2, 3, 4, 5].map((n) => newVerb(life(n)))).toEqual([null, 'claim', 'call', 'give', null]);
  });
  it('a single episode has every verb', () => {
    for (const verb of ['claim', 'call', 'give'] as const) expect(verbOn({ mode: 'SINGLE_LEVEL', levelIndex: 1 }, verb)).toBe(true);
  });
});
