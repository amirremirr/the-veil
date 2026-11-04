// Play Episode 5, Grand Finale (RUNPLAN T5, D-154).
import { describe, expect, it } from 'vitest';
import { createInitialState, step, visibleState } from '../../src/engine/engine';
import type { GameState } from '../../src/engine/types';
import type { P5State } from '../../src/engine/play/ep5';
import { L5 } from '../../src/engine/params';

const start = (seed: string, n: 2 | 3 | 4 = 4): GameState =>
  createInitialState({ mode: 'EPISODE', level: 5, ruleset: 'PLAY', nPlayers: n, difficulty: 'NORMAL', seed, allBots: true } as Parameters<typeof createInitialState>[0]);

describe('Play Episode 5', () => {
  it('uses the Study deck times 2 in a single episode, and incomes only after the veil vote', () => {
    const s = start('inc-1');
    let g = 0;
    while (s.phase.kind !== 'END' && g++ < 2000) {
      const lv = visibleState(s, s.players[0].id).levelView as { incomes?: Record<string, number>; adopted?: unknown };
      if (lv.incomes) expect(lv.adopted).toBeDefined();
      step(s, { type: 'ADVANCE' });
    }
    const inc = Object.values((s.levelState as P5State).incomes!);
    for (const y of inc) expect(L5.INCOME_DECK.map((x) => x * 2)).toContain(y);
  });

  it('keeps donations secret from third parties until the ballots, unless Leaked Receipts', () => {
    for (const seed of ['d-1', 'd-2', 'd-3', 'd-4', 'd-5', 'd-6']) {
      const s = start(seed);
      let g = 0;
      while (s.phase.kind !== 'END' && g++ < 2000) {
        if (s.phase.kind === 'REVEAL' && s.phase.step === 'AMENDMENTS') break;
        const leaked = s.play!.event?.id === 'LEAKED_RECEIPTS';
        for (const p of s.players) {
          const lv = visibleState(s, p.id).levelView as { lobby?: Record<string, { donateTo: string | null; amount: number }> };
          const real = (s.levelState as P5State).lobby;
          if (!lv.lobby || !real || leaked) continue;
          for (const [from, lb] of Object.entries(real)) if (lb.donateTo && from !== p.id && lb.donateTo !== p.id) expect(lv.lobby[from].amount).toBe(0);
        }
        step(s, { type: 'ADVANCE' });
      }
    }
  });
});
