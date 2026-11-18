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

  it('V6 (D-217): every seat judges equally often (3 rounds at 3 seats, 4 at 2 and 4) from a random starting seat', () => {
    const starts: Record<number, Set<number>> = { 2: new Set(), 3: new Set(), 4: new Set() };
    for (const n of [2, 3, 4] as const)
      for (let k = 0; k < 12; k++) {
        const s = bots(`rot-${n}-${k}`, n);
        const l = s.levelState as P4State;
        expect(l.rounds.length).toBe(n === 3 ? 3 : 4);
        const start = l.judgeStart!;
        starts[n].add(start);
        const judges = l.rounds.map((r) => r.judge);
        expect(judges).toEqual(l.rounds.map((_, r) => s.players[(start + r) % n].id));
        const count = s.players.map((p) => judges.filter((j) => j === p.id).length);
        expect(new Set(count).size).toBe(1);
        for (const r of l.rounds) expect(r.workers).not.toContain(r.judge);
      }
    // The starting judge is drawn, not always the first seat.
    for (const n of [2, 3, 4]) expect(starts[n].size).toBeGreaterThan(1);
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

describe('Play Episode 4 privacy (loop cycle 1)', () => {
  it('never sends another worker training cost before the end reveal', () => {
    const s = createInitialState({ mode: 'EPISODE', level: 4, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: 'cost-1', allBots: true } as Parameters<typeof createInitialState>[0]);
    const viewer = s.players[0].id;
    let g = 0;
    while (s.phase.kind !== 'END' && g++ < 5000) {
      step(s, { type: 'ADVANCE' });
      if (s.phase.kind === 'REVEAL' && s.phase.step === 'CARDS') break;
      const lv = visibleState(s, viewer).levelView as { rounds: Array<{ costs?: Record<string, number> }>; current?: { costs?: Record<string, number> } };
      for (const r of [...lv.rounds, ...(lv.current ? [lv.current] : [])]) for (const id of Object.keys(r.costs ?? {})) expect(id).toBe(viewer);
    }
  });
});
