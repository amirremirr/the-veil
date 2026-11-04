// Play Episode 4, The Hiring Round (RUNPLAN T2, D-151).
import { describe, expect, it } from 'vitest';
import { createInitialState, step, visibleState } from '../../src/engine/engine';
import { PLAY } from '../../src/engine/play/params';
import { L4 } from '../../src/engine/params';
import type { GameState } from '../../src/engine/types';
import type { P4State } from '../../src/engine/play/ep4';

function bots(seed: string, n: 2 | 3 | 4 = 4): GameState {
  const s = createInitialState({ mode: 'EPISODE', level: 4, ruleset: 'PLAY', nPlayers: n, difficulty: 'NORMAL', seed, allBots: true } as Parameters<typeof createInitialState>[0]);
  let g = 0;
  while (s.phase.kind !== 'END' && g++ < 5000) expect(step(s, { type: 'ADVANCE' })).toBe(true);
  return s;
}

describe('Play Episode 4', () => {
  it('keeps the judge-pay identity JUDGE_LOSS / (JUDGE_GAIN + JUDGE_LOSS) = Study threshold', () => {
    expect(PLAY.L4.JUDGE_LOSS / (PLAY.L4.JUDGE_GAIN + PLAY.L4.JUDGE_LOSS)).toBeCloseTo(L4.THRESHOLD, 12);
  });

  it('rotates the judge: each seat once at 4 seats, and 4 rounds at 2 and 3 seats', () => {
    for (const n of [2, 3, 4] as const) {
      const s = bots(`rot-${n}`, n);
      const l = s.levelState as P4State;
      expect(l.rounds.length).toBe(4);
      const judges = l.rounds.map((r) => r.judge);
      expect(judges).toEqual([0, 1, 2, 3].map((k) => s.players[k % n].id));
      for (const r of l.rounds) expect(r.workers).not.toContain(r.judge);
    }
  });

  it('pays the judge 40 + 20 per good hire - 30 per bad hire (no event)', () => {
    const s = bots('pay-1');
    const l = s.levelState as P4State;
    for (const r of l.rounds) {
      const ev = s.play!.events.find((e) => e.level === 4 && e.round === l.rounds.indexOf(r) + 1);
      if (ev && ev.id !== 'QUIET') continue;
      expect(r.judgePay).toBe(40 + 20 * r.good.length - 30 * r.bad.length);
    }
  });

  it('never shows another worker training before the end reveal, except a complex hire', () => {
    const s = createInitialState({ mode: 'EPISODE', level: 4, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: 'leak-1', allBots: true } as Parameters<typeof createInitialState>[0]);
    const viewer = s.players[0].id;
    let g = 0;
    while (s.phase.kind !== 'END' && g++ < 5000) {
      step(s, { type: 'ADVANCE' });
      if (s.phase.kind === 'REVEAL' && s.phase.step === 'CARDS') break;
      const lv = visibleState(s, viewer).levelView as { rounds: Array<{ train?: Record<string, boolean>; job?: Record<string, string> }>; current?: { train?: Record<string, boolean> } };
      for (const r of [...lv.rounds, ...(lv.current ? [lv.current] : [])])
        for (const id of Object.keys(r.train ?? {})) if (id !== viewer) expect((r as { job?: Record<string, string> }).job?.[id]).toBe('COMPLEX');
    }
  });

  it('is deterministic from the seed', () => {
    expect(bots('det-1').play!.banks).toEqual(bots('det-1').play!.banks);
  });
});
