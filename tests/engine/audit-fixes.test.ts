// Fixes from the October 2026 audit (DECISIONS.md D-72 onward).
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { createInitialState, reduce, replay, step, waitingOn } from '../../src/engine/engine';
import { L4 } from '../../src/engine/params';
import { RULES_HASH } from '../../src/engine/rules-hash';
import { canResume, compareRules, currentRules, gameRecord, paramsHash, RulesMismatchError } from '../../src/engine/version';
import { varianceShares, type L2Debrief } from '../../src/engine/levels/level2';
import { MIN_HUMANS_FOR_SLOPE, olsSlope, type L5Debrief } from '../../src/engine/levels/level5';
import en from '../../src/ui/copy/en.json';
import type { GameState, LevelId } from '../../src/engine/types';

function playBots(level: LevelId, seed: string, nPlayers: 2 | 3 | 4 = 4, botSamples = 8): GameState {
  const s = createInitialState({ mode: 'SINGLE_LEVEL', level, nPlayers, difficulty: 'NORMAL', seed, allBots: true, botSamples, skipCounterfactual: true });
  for (let i = 0; i < 2000 && s.phase.kind !== 'END'; i++) step(s, { type: 'ADVANCE' });
  return s;
}

describe('D-72: Level 2 variance shares stay in [0, 100]', () => {
  it('a hand example: equal variances split 50/50, no variation splits evenly', () => {
    expect(varianceShares([0, 10], [5, 15])).toEqual({ talentEffort: 0.5, luck: 0.5 });
    expect(varianceShares([3, 3], [7, 7])).toEqual({ talentEffort: 0.5, luck: 0.5 });
    expect(varianceShares([0, 0], [0, 20]).luck).toBe(1);
  });

  it('the seed that used to show 78% / 121% / -99% now shows two shares that add to 100%', () => {
    const v = (playBots(2, 'l2v-10', 4, 60).levelResults[2] as L2Debrief).variance;
    expect(v.talentEffort).toBeGreaterThanOrEqual(0);
    expect(v.luck).toBeGreaterThanOrEqual(0);
    expect(v.talentEffort + v.luck).toBeCloseTo(1, 12);
  });

  it('over 1,000 seeds (2 to 4 players), every share is in [0, 100] and the two add to 100', () => {
    let checked = 0;
    for (let g = 0; g < 1000; g++) {
      const n = (2 + (g % 3)) as 2 | 3 | 4;
      const v = (playBots(2, `h2-${g}`, n).levelResults[2] as L2Debrief).variance;
      for (const x of [v.talentEffort, v.luck]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
      }
      expect(v.talentEffort + v.luck).toBeCloseTo(1, 12);
      expect(Object.keys(v).sort()).toEqual(['luck', 'talentEffort']);
      checked++;
    }
    expect(checked).toBe(1000);
  }, 120_000);
});

function playL5Humans(nHumans: number, seed: string): GameState {
  const humans = Array.from({ length: nHumans }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));
  const s = createInitialState({ mode: 'SINGLE_LEVEL', level: 5, nPlayers: 4, difficulty: 'NORMAL', seed, botSamples: 8, humans });
  const fair2 = [0.1, 0.3, 0.5, 0.7];
  for (let i = 0; i < 500 && s.phase.kind !== 'LEVEL_DEBRIEF'; i++) {
    if (s.phase.kind !== 'DECIDE') {
      step(s, { type: 'ADVANCE' });
      continue;
    }
    const stepId = s.phase.step!;
    for (const pid of waitingOn(s)) {
      const k = humans.findIndex((h) => h.id === pid);
      const decision =
        stepId === 'VEIL' ? { t: 0.3, F: 25 }
        : stepId === 'FAIR_1' ? 0.4
        : stepId === 'FAIR_2' ? fair2[k]
        : stepId === 'LOBBY' ? { donateTo: null, amount: 0, proposal: null }
        : true;
      expect(step(s, { type: 'SUBMIT_DECISION', from: pid, decision })).toBe(true);
    }
  }
  return s;
}

describe('D-73: Level 5 measures use human answers only', () => {
  it('with 1 or 2 humans there is no slope and no verdict; the bots-included slope stays internal', () => {
    for (const n of [1, 2]) {
      const s = playL5Humans(n, `h1-${n}`);
      const d = s.levelResults[5] as L5Debrief;
      expect(d.slopes.humans).toBeNull();
      expect(Number.isFinite(d.slopes.everyone)).toBe(true);
      expect(JSON.stringify(d)).not.toMatch(/verdict/);
      for (const h of s.players.filter((p) => p.isHuman)) expect(d.deltaT[h.id]).toBeCloseTo(d.fair2[h.id] - d.fair1[h.id], 12);
    }
  });

  it('with 3 or 4 humans the slope uses the humans only', () => {
    for (const n of [3, 4]) {
      const s = playL5Humans(n, `h1-${n}`);
      const d = s.levelResults[5] as L5Debrief;
      const hs = s.players.filter((p) => p.isHuman).map((p) => p.id);
      expect(d.slopes.humans).toBeCloseTo(olsSlope(hs.map((id) => d.rank[id]), hs.map((id) => d.deltaT[id])), 12);
    }
    expect(MIN_HUMANS_FOR_SLOPE).toBe(3);
  });

  it('the copy makes no diagnosis or causal claim and labels bot answers as programmed', () => {
    const all = JSON.stringify(en);
    expect(all).not.toMatch(/That is the self-serving bias/);
    expect((en as Record<string, unknown>).verdicts).toBeUndefined();
    expect(en.debrief.l5.botsProgrammed).toMatch(/programmed/);
    expect(en.debrief.l5.botsProgrammed).toMatch(/Egoist/);
    expect(en.debrief.l5.ownShiftNote).toMatch(/several causes/);
  });
});

describe('D-75: rules version in games, saves and exports', () => {
  const play = () => {
    let s = reduce(null as unknown as GameState, { type: 'START_RUN', config: { mode: 'SINGLE_LEVEL', level: 1, nPlayers: 3, difficulty: 'NORMAL', seed: 'm5', botSamples: 8 } });
    for (let i = 0; i < 200 && s.phase.kind !== 'END'; i++) {
      const a = s.phase.kind === 'DECIDE' ? { type: 'SUBMIT_DECISION' as const, from: 'you', decision: 'P2' } : { type: 'ADVANCE' as const };
      s = reduce(s, a);
    }
    return s;
  };

  it('src/engine/rules-hash.ts matches the engine sources (run npm run rules-version if this fails)', () => {
    expect(() => execSync('node scripts/rules-version.mjs --check', { stdio: 'pipe' })).not.toThrow();
  });

  it('every new game records the current rules, and its export carries them', () => {
    const g = play();
    expect(g.phase.kind).toBe('END');
    expect(g.rules).toEqual(currentRules());
    expect(g.rules!.rules).toBe(RULES_HASH);
    const rec = JSON.parse(JSON.stringify(gameRecord(g)));
    expect(rec.rules).toEqual(g.rules);
    expect(replay(rec.log, rec)).toEqual(g);
  });

  it('a record from other rules or parameters, or with none, is refused; another commit alone is accepted', () => {
    const g = play();
    const rules = g.rules!;
    expect(() => replay(g.log, { rules: { ...rules, rules: '0000000000000000' } })).toThrow(RulesMismatchError);
    expect(() => replay(g.log, { rules: { ...rules, params: 'ffffffffffffffff' } })).toThrow(RulesMismatchError);
    expect(() => replay(g.log, {})).toThrow(RulesMismatchError);
    expect(compareRules({ ...rules, commit: 'abc123' })).toBe('commitOnly');
    expect(() => replay(g.log, { rules: { ...rules, commit: 'abc123' } })).not.toThrow();
  });

  it('saved games resume only under the same rules', () => {
    const g = play();
    expect(canResume(g)).toBe(true);
    expect(canResume({ ...g, rules: undefined })).toBe(false);
    expect(canResume({ ...g, rules: { ...g.rules!, params: 'x' } })).toBe(false);
    expect(canResume(null)).toBe(false);
  });

  it('changing a parameter in memory changes the params hash', () => {
    const before = paramsHash();
    const old = L4.UPDATE_WEIGHT;
    (L4 as { UPDATE_WEIGHT: number }).UPDATE_WEIGHT = 0.3;
    try {
      expect(paramsHash()).not.toBe(before);
    } finally {
      (L4 as { UPDATE_WEIGHT: number }).UPDATE_WEIGHT = old;
    }
    expect(paramsHash()).toBe(before);
  });
});
