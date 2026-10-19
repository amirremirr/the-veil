// Fixes from the October 2026 audit (DECISIONS.md D-72 onward).
import { describe, expect, it } from 'vitest';
import { createInitialState, step } from '../../src/engine/engine';
import { varianceShares, type L2Debrief } from '../../src/engine/levels/level2';
import type { GameState, LevelId } from '../../src/engine/types';

function playBots(level: LevelId, seed: string, nPlayers: 2 | 3 | 4 = 4, botSamples = 8): GameState {
  const s = createInitialState({ mode: 'SINGLE_LEVEL', level, nPlayers, difficulty: 'NORMAL', seed, allBots: true, botSamples, skipCounterfactual: true });
  for (let i = 0; i < 2000 && s.phase.kind !== 'END'; i++) step(s, { type: 'ADVANCE' });
  return s;
}

describe('D-72: Level 2 variance shares stay in [0, 100]', () => {
  it('a hand example: equal variances split 50/50, no variation splits evenly', () => {
    expect(varianceShares([0, 10], [5, 15])).toEqual({ talentEffort: 0.5, luck: 0.5 });
    expect(varianceShares([3, 3], [7, 7])).toEqual({ talentEffort: 0.5, luck: 0.5 });
    expect(varianceShares([0, 0], [0, 20]).luck).toBe(1);
  });

  it('the seed that used to show 78% / 121% / -99% now shows two shares that add to 100%', () => {
    const v = (playBots(2, 'l2v-10', 4, 60).levelResults[2] as L2Debrief).variance;
    expect(v.talentEffort).toBeGreaterThanOrEqual(0);
    expect(v.luck).toBeGreaterThanOrEqual(0);
    expect(v.talentEffort + v.luck).toBeCloseTo(1, 12);
  });

  it('over 1,000 seeds (2 to 4 players), every share is in [0, 100] and the two add to 100', () => {
    let checked = 0;
    for (let g = 0; g < 1000; g++) {
      const n = (2 + (g % 3)) as 2 | 3 | 4;
      const v = (playBots(2, `h2-${g}`, n).levelResults[2] as L2Debrief).variance;
      for (const x of [v.talentEffort, v.luck]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
      }
      expect(v.talentEffort + v.luck).toBeCloseTo(1, 12);
      expect(Object.keys(v).sort()).toEqual(['luck', 'talentEffort']);
      checked++;
    }
    expect(checked).toBe(1000);
  }, 120_000);
});
