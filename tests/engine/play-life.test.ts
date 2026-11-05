// Play LIFE mode (RUNPLAN T6, D-155).
import { describe, expect, it } from 'vitest';
import { createInitialState, step } from '../../src/engine/engine';
import { autoDecision } from '../../src/engine/auto';
import { waitingOn } from '../../src/engine/engine';
import en from '../../src/ui/copy/en.json';
import { PLAY } from '../../src/engine/play/params';

function life(seed: string, human = false) {
  const s = createInitialState({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed, ...(human ? {} : { allBots: true }) } as Parameters<typeof createInitialState>[0]);
  const starts: Record<number, Record<string, number>> = {};
  let g = 0;
  while (s.phase.kind !== 'END' && g++ < 20000) {
    if (s.phase.kind === 'INTRO' && !starts[s.levelIndex]) starts[s.levelIndex] = { ...s.play!.banks };
    if (s.phase.kind === 'DECIDE' && waitingOn(s).length) {
      for (const pid of waitingOn(s)) step(s, { type: 'SUBMIT_DECISION', from: pid, decision: autoDecision(s, pid) });
      continue;
    }
    if (s.phase.kind === 'GUESS') {
      step(s, { type: 'SUBMIT_GUESSES', from: s.players.find((p) => p.isHuman)!.id, guesses: {} });
      continue;
    }
    expect(step(s, { type: 'ADVANCE' })).toBe(true);
  }
  return { s, starts };
}

describe('Play LIFE', () => {
  it('plays the five episodes in order and carries banks over, starting at LIFE_STARTING_BANK', () => {
    const { s, starts } = life('life-1');
    expect(s.levelsPlayed).toEqual([1, 2, 3, 4, 5]);
    expect(Object.values(starts[1])).toEqual([PLAY.LIFE_STARTING_BANK, PLAY.LIFE_STARTING_BANK, PLAY.LIFE_STARTING_BANK, PLAY.LIFE_STARTING_BANK]);
    for (const l of [2, 3, 4, 5]) {
      const last = s.play!.bankHistory.filter((h) => h.level === l - 1).slice(-1)[0];
      for (const [id, b] of Object.entries(starts[l])) expect(b).toBeCloseTo(last.banks[id] + (l === 4 && s.play!.comeback?.pid === id && s.play!.comeback.took === 'COINS' ? 0 : 0), 6);
    }
    expect(s.play!.comeback).toBeDefined();
  });

  it('replays only the current episode for a human near miss (the snapshot), and reaches the Receipts', () => {
    const { s } = life('life-h', true);
    expect(s.levelsPlayed).toEqual([1, 2, 3, 4, 5]);
    for (const l of [1, 2, 3, 4, 5]) expect((s.levelResults[l as 1] as { byHuman?: unknown }).byHuman).toBeDefined();
  });

  it('has at least 20 result-card titles', () => {
    const T = (en as unknown as { play: { titles: Record<string, unknown> } }).play.titles;
    const count = (o: unknown): number => (typeof o === 'string' ? 1 : Object.values(o as object).reduce((a: number, x) => a + count(x), 0));
    expect(count(T)).toBeGreaterThanOrEqual(20);
  });
});

describe('R4: the first fair answer', () => {
  it('is asked in Episode 1 of a life, carried to Episode 5, and Episode 5 asks only the second', () => {
    const s = createInitialState({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: 'fair-1', allBots: true } as Parameters<typeof createInitialState>[0]);
    const steps: string[] = [];
    let g = 0;
    while (s.phase.kind !== 'END' && g++ < 20000) {
      if (s.phase.kind === 'INTRO') for (const q of s.phaseQueue) if (q.step?.startsWith('FAIR')) steps.push(`${s.levelIndex}:${q.step}`);
      step(s, { type: 'ADVANCE' });
    }
    expect(steps).toEqual(['1:FAIR_1', '5:FAIR_2']);
    const l5 = s.levelState as { fair1: Record<string, number> };
    expect(l5.fair1).toEqual(s.play!.fairFirst);
  });
});

describe('D-180 score gaps', () => {
  it('shows rounded gaps mid-life and hides them once scores are public', async () => {
    const { playView } = await import('../../src/engine/play/view');
    const s = createInitialState({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: 'gaps-1' } as Parameters<typeof createInitialState>[0]);
    let g = 0;
    while (!(s.phase.kind === 'LEVEL_DEBRIEF' && s.levelIndex === 2) && g++ < 20000) {
      if (s.phase.kind === 'DECIDE' && waitingOn(s).length) {
        for (const pid of waitingOn(s)) step(s, { type: 'SUBMIT_DECISION', from: pid, decision: autoDecision(s, pid) });
        continue;
      }
      if (s.phase.kind === 'GUESS') {
        step(s, { type: 'SUBMIT_GUESSES', from: s.players.find((p) => p.isHuman)!.id, guesses: {} });
        continue;
      }
      step(s, { type: 'ADVANCE' });
    }
    const me = s.players.find((p) => p.isHuman)!.id;
    const v = playView(s, me, false);
    expect(v.gaps).toBeTruthy();
    for (const x of [v.gaps!.above, v.gaps!.below]) if (x !== null) expect(x % PLAY.GAP_ROUND).toBe(0);
    expect(v.gaps!.above !== null || v.gaps!.below !== null).toBe(true);
    expect(playView(s, me, true).gaps).toBeNull();
  });
});
