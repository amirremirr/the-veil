import { describe, expect, it } from 'vitest';
import { replay, visibleState, HUMAN_ID } from '../../src/engine/engine';
import { playFull } from './helpers';
import type { GameState, PhaseKind } from '../../src/engine/types';

const states = playFull({ seed: 'determinism-check' });
const final = states[states.length - 1];

describe('Test 7: determinism', () => {
  it('reaches the end of a full run', () => expect(final.phase.kind).toBe('END'));
  it('same seed and action log reproduce an identical final state', () => {
    const again = replay(final.log);
    expect(again).toEqual(final);
  });
});

describe('Test 8: hidden information', () => {
  const before: PhaseKind[] = ['VALUES_REVEAL', 'INTRO', 'BRIEFING', 'TALK', 'DECIDE', 'REVEAL', 'ROUND_SUMMARY'];
  const checked = states.filter((s) => before.includes(s.phase.kind));
  it('checks many states', () => expect(checked.length).toBeGreaterThan(100));
  it('never exposes bot Values cards, talents, risk types, or costs before the debrief', () => {
    for (const s of checked) {
      const v = visibleState(s, HUMAN_ID);
      for (const p of v.players) {
        if (p.id === HUMAN_ID) continue;
        expect(p.values).toBeUndefined();
        expect(p.privateInfo).toBeUndefined();
      }
      const lv = v.levelView as Record<string, unknown>;
      // The Bonus Pot deliberately shows two citizens in full (Cappelen et al. spectator design).
      const inBonusPot = s.levelIndex === 2 && s.phase.step === 'BONUS';
      if (s.levelIndex === 2 && !inBonusPot) {
        expect(lv.talents).toBeUndefined();
        expect(JSON.stringify(lv)).not.toMatch(/"talent"/);
        for (const r of lv.rounds as Array<{ effort: object; eps: object }>) {
          expect(Object.keys(r.effort)).toEqual([HUMAN_ID]);
          expect(Object.keys(r.eps)).toEqual([HUMAN_ID]);
        }
      }
      if (s.levelIndex === 3) expect(lv.types).toBeUndefined();
      if (s.levelIndex === 4) {
        const cur = lv.current as { costs?: object } | undefined;
        if (cur?.costs) expect(Object.keys(cur.costs)).toEqual([HUMAN_ID]);
      }
      // Other players' scores encode their Values metric, so they stay hidden.
      expect(Object.keys(v.scores)).toEqual([HUMAN_ID]);
      for (const r of v.history) expect(Object.keys(r.S)).toEqual([HUMAN_ID]);
    }
  });
  it('reveals Values cards at the run debrief', () => {
    const end = states.find((s: GameState) => s.phase.kind === 'RUN_DEBRIEF')!;
    const v = visibleState(end, HUMAN_ID);
    for (const p of v.players) expect(p.values).toBeDefined();
  });
});
