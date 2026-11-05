// Play Episode 1, Born (RUNPLAN T3, D-152).
import { describe, expect, it } from 'vitest';
import { createInitialState, step, visibleState } from '../../src/engine/engine';
import type { GameState } from '../../src/engine/types';
import type { P1State } from '../../src/engine/play/ep1';

const start = (seed: string, n: 2 | 3 | 4 = 4): GameState =>
  createInitialState({ mode: 'EPISODE', level: 1, ruleset: 'PLAY', nPlayers: n, difficulty: 'NORMAL', seed, allBots: true } as Parameters<typeof createInitialState>[0]);

describe('Play Episode 1', () => {
  it('E1 structure: no contestant who did not peek can see any income before the vote', () => {
    for (const seed of ['e1-a', 'e1-b', 'e1-c', 'e1-d']) {
      const s = start(seed);
      let g = 0;
      while (s.phase.kind !== 'END' && g++ < 2000) {
        if (s.phase.kind === 'DECIDE' && (s.phase.step === 'CLAIM' || s.phase.step === 'VOTE' || s.phase.step === 'PEEK')) {
          const l = s.levelState as P1State;
          for (const p of s.players) {
            const v = visibleState(s, p.id);
            const lv = v.levelView as { myIncome?: number; rounds: Array<{ incomes: Record<string, number> }> };
            const doneRounds = lv.rounds.length;
            // Only finished rounds' incomes are in the view; this round's income only for a peeker, after the peek.
            expect(doneRounds).toBeLessThan(s.round);
            if (!l.peeked.includes(p.id)) {
              expect(lv.myIncome).toBeUndefined();
              expect((v.players.find((x) => x.id === p.id)?.privateInfo as Record<string, unknown> | undefined)?.income).toBeUndefined();
            } else expect(lv.myIncome).toBe(l.dealt[p.id]);
          }
        }
        expect(step(s, { type: 'ADVANCE' })).toBe(true);
      }
    }
  });

  it('round 1 has no peek; round 2 does, and a peek costs PEEK_COST', () => {
    const s = start('peek-1');
    const steps = s.phaseQueue.filter((q) => q.kind === 'DECIDE').map((q) => `${q.round}:${q.step}`);
    expect(steps).toEqual(['1:CLAIM', '1:VOTE', '2:PEEK', '2:CLAIM', '2:VOTE']);
  });

  it('is deterministic and plays at 2, 3 and 4 seats', () => {
    for (const n of [2, 3, 4] as const) {
      const a = start(`det-${n}`, n);
      const b = start(`det-${n}`, n);
      for (const s of [a, b]) {
        let g = 0;
        while (s.phase.kind !== 'END' && g++ < 2000) step(s, { type: 'ADVANCE' });
      }
      expect(a.play!.banks).toEqual(b.play!.banks);
      expect((a.levelState as P1State).rounds.length).toBe(2);
    }
  });
});
