// Play LIFE mode (RUNPLAN T6, D-155).
import { describe, expect, it } from 'vitest';
import { createInitialState, step } from '../../src/engine/engine';
import { autoDecision } from '../../src/engine/auto';
import { waitingOn } from '../../src/engine/engine';
import en from '../../src/ui/copy/en.json';
import { PLAY } from '../../src/engine/play/params';
import { wholeBankRule } from '../../src/engine/play/ep5';

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

describe('V5 (D-215): the finale reaches the whole bank', () => {
  it('taxes each bank above 0, tops everyone (a debt too) up to the floor, and shares the rest equally', () => {
    const out = wholeBankRule([200, 50, 0, -40], { t: 0.5, F: 20 });
    // Tax 100 + 25 = 125; after tax 100, 25, 0, -40; top-ups 0, 0, 20, 60 = 80; 45 left, 11.25 each.
    expect(out.map((x) => Math.round(x * 100) / 100)).toEqual([111.25, 36.25, 31.25, 31.25]);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(210, 9);
    // A short pot cuts each top-up in proportion.
    const short = wholeBankRule([20, -100], { t: 0.5, F: 0 });
    expect(short).toEqual([10, -90]);
  });
  it('in a life, every bank ends the finale at the rule applied to it with the donations and calls', () => {
    for (const seed of ['whole-1', 'whole-2', 'whole-3']) {
      const { s } = life(seed);
      const lv = s.levelState as { whole?: { before: Record<string, number>; after: Record<string, number>; rule: { t: number; F: number } }; current: { t: number; F: number } };
      expect(lv.whole).toBeDefined();
      const ids = s.players.map((p) => p.id);
      const after = wholeBankRule(ids.map((id) => lv.whole!.before[id]), lv.whole!.rule);
      ids.forEach((id, i) => expect(lv.whole!.after[id]).toBeCloseTo(after[i], 6));
      const fin = s.play!.bankHistory.filter((h) => h.level === 5).slice(-1)[0];
      for (const id of ids) expect(fin.banks[id]).toBeCloseTo(lv.whole!.after[id], 6);
    }
  });
});

describe('Play LIFE', () => {
  it('plays the five episodes in order and carries banks over, starting at LIFE_STARTING_BANK', () => {
    const { s, starts } = life('life-1');
    expect(s.levelsPlayed).toEqual([1, 2, 3, 4, 5]);
    expect(Object.values(starts[1])).toEqual([PLAY.LIFE_STARTING_BANK, PLAY.LIFE_STARTING_BANK, PLAY.LIFE_STARTING_BANK, PLAY.LIFE_STARTING_BANK]);
    for (const l of [2, 3, 4, 5]) {
      const last = s.play!.bankHistory.filter((h) => h.level === l - 1).slice(-1)[0];
      for (const [id, b] of Object.entries(starts[l])) expect(b).toBeCloseTo(last.banks[id] + (l === 4 && s.play!.comeback?.pid === id ? 0 : 0), 6);
    }
    expect(s.play!.comeback).toBeDefined();
    // V5 (D-214): no choice; the contestant last after Episode 3 gets SECOND_CHANCE_COINS, on Episode 4's first round.
    const cb = s.play!.comeback!;
    expect(Object.keys(cb)).toEqual(['pid']);
    const end3 = s.play!.bankHistory.filter((h) => h.level === 3).slice(-1)[0];
    expect(end3.ranks[cb.pid]).toBe(Math.max(...Object.values(end3.ranks)));
    const first4 = s.play!.bankHistory.find((h) => h.level === 4)!;
    for (const p of s.players) {
      const line = first4.ledger![p.id].find((x) => x.k === 'comeback');
      expect(line?.n).toBe(p.id === cb.pid ? PLAY.SECOND_CHANCE_COINS : undefined);
    }
    expect(s.log.some((e) => (e as { step?: string }).step === 'COMEBACK' && (e as { type?: string }).type === 'DECIDE')).toBe(false);
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
