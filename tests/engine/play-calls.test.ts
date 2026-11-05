// H1 (D-194): Call it. Calls move money between caller and claimant only, are stamped, and a caught lie has
// its episode's consequence that round.
import { describe, expect, it } from 'vitest';
import { createInitialState, step } from '../../src/engine/engine';
import type { GameState, LevelId } from '../../src/engine/types';
import type { P2State } from '../../src/engine/play/ep2';
import type { L3State } from '../../src/engine/levels/level3';
import type { P4State } from '../../src/engine/play/ep4';

function bots(level: LevelId, seed: string): GameState {
  const s = createInitialState({ mode: 'EPISODE', level, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed, allBots: true } as Parameters<typeof createInitialState>[0]);
  let g = 0;
  while (s.phase.kind !== 'END' && g++ < 20000) step(s, { type: 'ADVANCE' });
  return s;
}

describe('H1 Call it', () => {
  for (const level of [1, 2, 3, 4, 5] as LevelId[]) {
    it(`Episode ${level}: call money nets to zero every round`, () => {
      let calls = 0;
      for (let k = 0; k < 25; k++) {
        const s = bots(level, `calls-${level}-${k}`);
        calls += s.play!.calls?.length ?? 0;
        for (const h of s.play!.bankHistory) {
          const sum = Object.values(h.ledger ?? {}).reduce((a, ls) => a + (ls.find((x) => x.k === 'call')?.n ?? 0), 0);
          expect(sum).toBeCloseTo(0, 9);
        }
      }
      expect(calls).toBeGreaterThan(0);
    }, 120000);
  }
  it('consequences: no prize for a caught liar (Ep2), no cover (Ep3), the simple job (Ep4)', () => {
    let seen = 0;
    for (let k = 0; k < 25; k++) {
      const s2 = bots(2, `cq2-${k}`);
      for (const c of (s2.play!.calls ?? []).filter((x) => x.lie)) {
        const r = (s2.levelState as P2State).rounds[c.round - 1];
        expect(r.winners).not.toContain(c.target);
        seen++;
      }
      const s3 = bots(3, `cq3-${k}`);
      for (const c of (s3.play!.calls ?? []).filter((x) => x.lie)) {
        const r = (s3.levelState as L3State).rounds[c.round - 1];
        expect(r.choices[c.target].buy).toBe(false);
        seen++;
      }
      const s4 = bots(4, `cq4-${k}`);
      for (const c of (s4.play!.calls ?? []).filter((x) => x.lie)) {
        const r = (s4.levelState as P4State).rounds[c.round - 1];
        expect(r.job?.[c.target]).toBe('SIMPLE');
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 300000);
});
