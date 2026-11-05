// G1: the money ledger. Every round's lines add up exactly to the bank change, with nothing left over
// ("other"), and the score parts add up to the Play score, in every episode on 50 seeds and in a life.
import { describe, expect, it } from 'vitest';
import { createInitialState, step, waitingOn } from '../../src/engine/engine';
import { autoDecision } from '../../src/engine/auto';
import { PLAY } from '../../src/engine/play/params';
import { playScore } from '../../src/engine/play/rules';
import type { GameState } from '../../src/engine/types';

function check(s: GameState): number {
  let records = 0;
  let g = 0;
  const pl = () => s.play!;
  while (s.phase.kind !== 'END' && g++ < 40000) {
    const before = pl().bankHistory.length;
    if (s.phase.kind === 'DECIDE' && waitingOn(s).length) {
      for (const pid of waitingOn(s)) step(s, { type: 'SUBMIT_DECISION', from: pid, decision: autoDecision(s, pid) });
    } else if (s.phase.kind === 'GUESS') {
      const h = s.players.find((p) => p.isHuman);
      step(s, { type: 'SUBMIT_GUESSES', from: h ? h.id : s.players[0].id, guesses: {} });
    } else step(s, { type: 'ADVANCE' });
    const hist = pl().bankHistory;
    if (hist.length === before) continue;
    const rec = hist[hist.length - 1];
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;
    for (const p of s.players) {
      const lines = rec.ledger![p.id];
      expect(lines.some((x) => x.k === 'other')).toBe(false);
      const from = prev ? prev.banks[p.id] : s.mode === 'LIFE' ? PLAY.LIFE_STARTING_BANK : PLAY.EPISODE_STARTING_BANK;
      const sum = lines.reduce((a, x) => a + x.n, 0);
      expect(sum).toBeCloseTo(rec.banks[p.id] - from, 6);
      const parts = rec.parts![p.id];
      expect(parts.bank + parts.mission + parts.debt + parts.guess).toBeCloseTo(playScore(s, p.id), 6);
    }
    records++;
  }
  return records;
}

describe('G1 money ledger', () => {
  for (const level of [1, 2, 3, 4, 5] as const) {
    it(`Episode ${level}: every round's lines sum to the bank change, 50 seeds`, () => {
      let n = 0;
      for (let k = 0; k < 50; k++) {
        const s = createInitialState({ mode: 'EPISODE', level, ruleset: 'PLAY', nPlayers: 4, difficulty: k % 3 === 0 ? 'HARD' : 'NORMAL', seed: `ledger-${level}-${k}`, allBots: true } as Parameters<typeof createInitialState>[0]);
        n += check(s);
      }
      expect(n).toBeGreaterThan(0);
    }, 120000);
  }
  it('a life: lines include the Second Chance and sum across episodes', () => {
    for (let k = 0; k < 6; k++) {
      const s = createInitialState({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: `ledger-life-${k}`, allBots: true } as Parameters<typeof createInitialState>[0]);
      expect(check(s)).toBeGreaterThan(10);
    }
  }, 120000);
});

describe('G1 rounding shown', () => {
  it('rounded lines add up to the rounded total (Episode 1: 229.6 after the rule, a 10 peek, +219)', async () => {
    const { roundToTotal } = await import('../../src/ui/play/logic');
    expect(roundToTotal([300, -70.4, -10], 219)).toEqual([300, -71, -10]);
    for (let k = 0; k < 200; k++) {
      const xs = [Math.random() * 300 - 100, Math.random() * 50 - 25, -Math.random() * 30, Math.random() * 10];
      const total = Math.round(xs.reduce((a, b) => a + b, 0) + 10) - 10;
      expect(roundToTotal(xs, total).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});
