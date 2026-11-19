// V6 part 4 (D-220): optional challenges, checked from the public end-of-life view; they never touch the score.
import { describe, expect, it } from 'vitest';
import { createInitialState, step, visibleState } from '../../src/engine/engine';
import { playScore } from '../../src/engine/play/rules';
import type { Message } from '../../src/engine/types';
import { CHALLENGES, OFFERED, challengeDone, clearPick, loadPick, offeredFor, savePick } from '../../src/ui/play/challenges';

describe('V6 challenges', () => {
  it('offers three different challenges from a list of at least 10, the same for the same seed', () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(10);
    const seen = new Set<string>();
    for (let k = 0; k < 40; k++) {
      const a = offeredFor(`seed-${k}`);
      expect(a).toHaveLength(OFFERED);
      expect(new Set(a).size).toBe(OFFERED);
      expect(offeredFor(`seed-${k}`)).toEqual(a);
      a.forEach((c) => seen.add(c));
    }
    // Over many seeds every challenge gets offered.
    expect(seen.size).toBe(CHALLENGES.length);
  });

  it('keeps one pick per life, and forgets it when a new game starts', () => {
    clearPick();
    expect(loadPick('a').decided).toBe(false);
    savePick('a', 'NEVER_LIE');
    expect(loadPick('a')).toEqual({ decided: true, pick: 'NEVER_LIE' });
    expect(loadPick('b').decided).toBe(false);
    clearPick();
    expect(loadPick('a').decided).toBe(false);
  });

  it('checks a finished life from public facts, and does not change any score', () => {
    const s = createInitialState({ mode: 'LIFE', ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: 'ch-test', allBots: true } as Parameters<typeof createInitialState>[0]);
    let g = 0;
    while (s.phase.kind !== 'RUN_DEBRIEF' && s.phase.kind !== 'END' && g++ < 20000) step(s, { type: 'ADVANCE' });
    const before = s.players.map((p) => playScore(s, p.id));
    const v = visibleState(s, s.players[0].id);
    const me = v.viewer;
    for (const c of CHALLENGES) expect(typeof challengeDone(v, c)).toBe('boolean');
    const lied = (v.messages as Message[]).some((m) => m.from === me && m.msg.type === 'CLAIM' && m.kept === false);
    expect(challengeDone(v, 'NEVER_LIE')).toBe(!lied);
    expect(challengeDone(v, 'NO_DEBT')).toBe(!v.play!.bankHistory.some((h) => h.banks[me] < 0));
    expect(s.players.map((p) => playScore(s, p.id))).toEqual(before);
  });
});
