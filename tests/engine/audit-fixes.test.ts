// Fixes from the October 2026 audit (DECISIONS.md D-72 onward).
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { createInitialState, reduce, replay, step, waitingOn } from '../../src/engine/engine';
import { BOT, BOT_PROFILES, L4 } from '../../src/engine/params';
import { ceOfLottery, certaintyEquivalent, utility } from '../../src/engine/bots/utility';
import { roundScore } from '../../src/engine/scoring';
import { pluralityResolve } from '../../src/engine/core';
import { standalone } from '../../src/engine/rng';
import { stdErr } from '../../src/engine/counterfactual';
import { subsidyFor, type L4Debrief, type L4State } from '../../src/engine/levels/level4';
import { expectedByType, voluntaryPath } from '../../src/engine/levels/level3';
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

describe('D-77: bot utility is defined, increasing and concave over every reachable score', () => {
  const rhos = [0, BOT.BELIEF_RHO, ...Object.values(BOT_PROFILES).map((p) => p.rho * BOT.RHO_SCALE), 2.5, 5];
  const grid = Array.from({ length: 601 }, (_, k) => -200 + k);

  it('strictly increasing on [-200, 400] for every risk attitude', () => {
    for (const rho of rhos) for (let k = 1; k < grid.length; k++) expect(utility(grid[k], rho)).toBeGreaterThan(utility(grid[k - 1], rho));
  });

  it('strictly concave on [-200, 400] when rho > 0 (second differences negative), linear at rho = 0', () => {
    for (const rho of rhos)
      for (let k = 1; k < grid.length - 1; k++) {
        const d2 = utility(grid[k + 1], rho) - 2 * utility(grid[k], rho) + utility(grid[k - 1], rho);
        if (rho > 0) expect(d2).toBeLessThan(0);
        else expect(Math.abs(d2)).toBeLessThan(1e-9);
      }
  });

  it('the certainty equivalent inverts the utility and a worse tail always lowers it', () => {
    for (const rho of rhos) for (const S of [-200, -140, -49, 0, 50, 400]) expect(certaintyEquivalent(utility(S, rho), rho)).toBeCloseTo(S, 4);
    const rho = 0.375;
    // Under the old CRRA on max(1, S + 50), these two lotteries had the same value.
    expect(ceOfLottery([[0.5, -140], [0.5, 100]], rho)).toBeLessThan(ceOfLottery([[0.5, -50], [0.5, 100]], rho) - 30);
    // Risk aversion: below the mean, above the worst outcome.
    const ce = ceOfLottery([[0.5, -140], [0.5, 100]], rho);
    expect(ce).toBeLessThan(-20);
    expect(ce).toBeGreaterThan(-140);
  });

  it('the lowest reachable score is inside the tested range: an Egoist at -40 coins scores -200', () => {
    // Level 2: maximum effort cost 0.4 x 10^2 = 40 with zero income is the lowest reachable wealth.
    expect(roundScore('EGOIST', [-40, 100], 0, [0.5, 0.5])).toBe(-200);
    // Level 4: training at 60 and still getting a basic job.
    expect(roundScore('EGOIST', [-20, 40], 0, [1, 0])).toBe(-140);
  });
});

describe('D-79, D-90: Level 4 decomposition holds the rule fixed, takes tie-break draws every time, and reports SE', () => {
  it('a plurality vote takes exactly one draw, tie or not', () => {
    for (const votes of [[0, 0, 1], [0, 1, 2, 3], [2, 2, 2, 2]]) {
      const a = standalone(42);
      pluralityResolve(votes, 4, a);
      const b = standalone(42);
      b.next();
      expect(a.next()).toBe(b.next());
    }
  });

  const play = (seed: string) => {
    const s = createInitialState({ mode: 'SINGLE_LEVEL', level: 4, nPlayers: 4, difficulty: 'NORMAL', seed, botSamples: 20 });
    for (let i = 0; i < 1000 && s.phase.kind !== 'LEVEL_DEBRIEF'; i++) {
      if (s.phase.kind !== 'DECIDE') step(s, { type: 'ADVANCE' });
      else {
        const st = s.phase.step!;
        step(s, { type: 'SUBMIT_DECISION', from: 'you', decision: st === 'INVEST' ? true : st === 'SCHEDULE' ? 'FLEX' : 'C' });
      }
    }
    return s.levelResults[4] as L4Debrief;
  };

  it('every replay uses No Change; the baseline matches the real game before the referendum; SEs are reported', () => {
    for (const seed of ['m3-a', 'm3-b']) {
      const d = play(seed);
      const cf = d.counterfactual!;
      expect(cf.policy).toBe('A');
      const base = cf.scenarios.find((x) => x.key === 'BASELINE')!;
      for (let r = 0; r < 3; r++) expect(base.roundGaps[r]).toBeCloseTo(d.meanByGroup[r].gap, 9);
      for (const k of ['stereotype', 'care', 'interaction', 'total'] as const) {
        expect(Number.isFinite(cf.average.se[k])).toBe(true);
        expect(cf.average.se[k]).toBeGreaterThanOrEqual(0);
      }
      expect(cf.average.total).toBeCloseTo(cf.average.stereotype + cf.average.care + cf.average.interaction, 9);
    }
  });

  it('stdErr is the sample SD over the square root of n', () => {
    expect(stdErr([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5 / 3) / 2, 12);
    expect(stdErr([7])).toBe(0);
  });
});

describe('D-80: Level 3 values voluntary insurance along its price path', () => {
  it('price paths: High types buy at 22, the pool is all High, the price goes to 35.2, then the insurer leaves', () => {
    const p = voluntaryPath(2, 4);
    expect(p[0]).toBeCloseTo(22, 10);
    expect(p[1]).toBeCloseTo(35.2, 10);
    expect(p.slice(2)).toEqual([null, null]);
    // Nobody High: nobody buys at 22 and the insurer leaves after round 1.
    expect(voluntaryPath(0, 4).slice(1)).toEqual([null, null, null]);
  });

  it("a High type's voluntary value averages 78 (insured at 22) with three rounds uninsured with the gym (67.6)", () => {
    const net = expectedByType(2, 4, true);
    expect(net.VOL.HIGH).toBeCloseTo((78 + 3 * 67.6) / 4, 9);
    // Valued at the opening price for all four rounds it would have been 78.
    expect(net.VOL.HIGH).toBeLessThan(78);
  });

  it('the debrief carries the path it used', () => {
    for (let g = 0; g < 5; g++) {
      const d = playBots(3, `m4-${g}`).levelResults[3] as { volPath: Array<number | null>; types: Record<string, string> };
      const nHigh = Object.values(d.types).filter((x) => x === 'HIGH').length;
      expect(d.volPath).toEqual(voluntaryPath(nHigh, 4));
    }
  });
});

describe('D-81: the Cheaper Childcare subsidy is shown as paid from outside', () => {
  it('60 coins per childcare worker on long hours, only under Cheaper Childcare', () => {
    expect(subsidyFor('COMPLEX', 'GREEDY', true, 'D')).toBe(60);
    expect(subsidyFor('COMPLEX', 'GREEDY', true, 'A')).toBe(0);
    expect(subsidyFor('COMPLEX', 'FLEX', true, 'D')).toBe(0);
    expect(subsidyFor('COMPLEX', 'GREEDY', false, 'D')).toBe(0);
    expect(subsidyFor('SIMPLE', null, true, 'D')).toBe(0);
  });

  it('round records and the level total add up, and money itself is unchanged', () => {
    let found = 0;
    for (let g = 0; g < 12; g++) {
      const s = createInitialState({ mode: 'SINGLE_LEVEL', level: 4, nPlayers: 4, difficulty: 'NORMAL', seed: `m2-${g}`, allBots: true, botSamples: 8 });
      s.cf = { fixedPolicy: 'D', fast: false };
      for (let i = 0; i < 1000 && s.phase.kind !== 'END'; i++) {
        if (s.phase.kind === 'ROUND_SUMMARY' && s.round === 5) delete s.cf;
        step(s, { type: 'ADVANCE' });
      }
      const l = s.levelState as L4State;
      const d = s.levelResults[4] as L4Debrief;
      let total = 0;
      for (const r of l.rounds)
        for (const id of Object.keys(r.W)) {
          expect(r.subsidy[id]).toBe(subsidyFor(r.job[id], r.schedule[id], l.care[id], r.policy));
          expect(r.W[id]).toBe(r.wage[id] - r.chaos[id] - (r.invest[id] ? r.costs[id] : 0));
          total += r.subsidy[id];
        }
      expect(d.subsidyTotal).toBe(total);
      found += total;
    }
    expect(found).toBeGreaterThan(0);
  });
});
