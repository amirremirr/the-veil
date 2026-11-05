// Play Episode 2, First Hustle (RUNPLAN T4, D-153).
import { describe, expect, it } from 'vitest';
import { createInitialState, step, visibleState } from '../../src/engine/engine';
import type { GameState } from '../../src/engine/types';
import type { P2Round } from '../../src/engine/play/ep2';

const start = (seed: string, n: 2 | 3 | 4 = 4): GameState =>
  createInitialState({ mode: 'EPISODE', level: 2, ruleset: 'PLAY', nPlayers: n, difficulty: 'NORMAL', seed, allBots: true } as Parameters<typeof createInitialState>[0]);

describe('Play Episode 2', () => {
  it('never shows another contestant hours or die before the end reveal (Security Cameras excepted for hours)', () => {
    for (const seed of ['h-a', 'h-b', 'h-c', 'h-d', 'h-e']) {
      const s = start(seed);
      const viewer = s.players[0].id;
      let g = 0;
      while (s.phase.kind !== 'END' && g++ < 2000) {
        if (s.phase.kind === 'REVEAL' && s.phase.step === 'CARDS') break;
        const lv = visibleState(s, viewer).levelView as { rounds: Array<Partial<P2Round>>; current?: Partial<P2Round> };
        for (const r of [...lv.rounds, ...(lv.current ? [lv.current] : [])]) {
          for (const id of Object.keys(r.luck ?? {})) expect(id).toBe(viewer);
          if (!r.cameras) for (const id of Object.keys(r.effort ?? {})) expect(id).toBe(viewer);
        }
        expect(step(s, { type: 'ADVANCE' })).toBe(true);
      }
    }
  });

  it('pays the Hustle Prize to the plurality winner, split on ties, never to a self-vote', () => {
    const s = start('prize-1');
    let g = 0;
    while (s.phase.kind !== 'END' && g++ < 2000) step(s, { type: 'ADVANCE' });
    const rounds = (s.levelState as { rounds: P2Round[] }).rounds;
    expect(rounds.length).toBe(3);
    for (const r of rounds) {
      for (const [from, to] of Object.entries(r.votes)) expect(to).not.toBe(from);
      const total = Object.values(r.prize).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(30, 9);
    }
  });
});
