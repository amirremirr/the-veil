// Rules v2: hardship line (Part A), unpaid fair-tax shift (Part B), amendment skip and level points (Part E).
import { describe, expect, it } from 'vitest';
import { createInitialState, HUMAN_ID, levelPoints, step } from '../../src/engine/engine';
import { orderedDraws } from '../../src/engine/core';
import { principleOutcome, principleTax } from '../../src/engine/levels/level1';
import { rnChoice, rnValue } from '../../src/engine/levels/level3';
import { investGain } from '../../src/engine/levels/level4';
import { fairShift, type AmendmentRecord, type Constitution, type L5State } from '../../src/engine/levels/level5';
import { hardshipPenalty, mean, roundScore } from '../../src/engine/scoring';
import { BOT, BOT_PROFILES, DIFFICULTY, L1, L4, SCORE } from '../../src/engine/params';
import { logitProbs } from '../../src/engine/bots/utility';
import type { GameState } from '../../src/engine/types';

const DECK = [20, 50, 90, 160];

describe('Part A: hardship line', () => {
  it('penalty is 2 coins of scored money per coin below 40; the Egoist loses all of it, other cards half', () => {
    expect(hardshipPenalty(40)).toBe(0);
    expect(hardshipPenalty(20)).toBe(40);
    expect(hardshipPenalty(9)).toBe(62);
    const W = [20, 50, 90, 160];
    const eq = [0.25, 0.25, 0.25, 0.25];
    // Egoist: S = W - penalty.
    expect(roundScore('EGOIST', W, 0, eq)).toBe(20 - 40);
    expect(roundScore('EGOIST', W, 1, eq)).toBe(50);
    // Utilitarian: S = 0.5 (W - penalty) + 0.5 x mean(W). The metric uses plain wealth.
    expect(roundScore('UTILITARIAN', W, 0, eq)).toBeCloseTo(0.5 * (20 - 40) + 0.5 * 80, 10);
    // Rawlsian: the metric is still the plain minimum (20), scaled by 1.67.
    expect(roundScore('RAWLSIAN', W, 0, eq)).toBeCloseTo(0.5 * (20 - 40) + 0.5 * 1.67 * 20, 10);
    // Without hardship the non-Egoist half is unchanged.
    expect(roundScore('UTILITARIAN', W, 1, eq)).toBeCloseTo(0.5 * 50 + 0.5 * 80, 10);
  });

  it('L1, No Tax, full deck: the player dealt 20 loses 40 points; a random seat expects 10', () => {
    const { W } = principleOutcome('P1', DECK);
    expect(hardshipPenalty(W[0])).toBe(40);
    const draws = orderedDraws(L1.INCOME_DECK, 4);
    const expected = mean(draws.map((d) => hardshipPenalty(principleOutcome('P1', d).W[0])));
    expect(expected).toBeCloseTo(10, 10);
  });

  it('L1, Safety Net (t = 0.45): no one is below the line, so the expected penalty is 0', () => {
    expect(principleTax('P2', DECK)).toBeCloseTo(0.45, 10);
    const draws = orderedDraws(L1.INCOME_DECK, 4);
    const expected = mean(draws.map((d) => hardshipPenalty(principleOutcome('P2', d).W[0])));
    expect(expected).toBe(0);
  });

  it('L3 High type, price 22: insured 78 with no penalty beats the gym (expected cost 32.4)', () => {
    const insured = rnValue('HIGH', 'VOL', 22, { buy: true, gym: false });
    expect(insured).toBeCloseTo(78, 10);
    // Uninsured with gym: bad luck leaves 100 - 6 - 80 = 14, which is 26 below 40, a 52-point penalty.
    // Expected cost = 6 + 0.2 x (80 + 52) = 32.4.
    const gym = rnValue('HIGH', 'VOL', 22, { buy: false, gym: true });
    expect(100 - gym).toBeCloseTo(32.4, 10);
    expect(rnChoice('HIGH', 'VOL', 22).buy).toBe(true);
  });

  it('L3 High type, price 35.2: buying no longer beats the gym', () => {
    expect(100 - rnValue('HIGH', 'VOL', 35.2, { buy: true, gym: false })).toBeCloseTo(35.2, 10);
    expect(rnChoice('HIGH', 'VOL', 35.2)).toEqual({ buy: false, gym: true });
  });

  it('L3 Low type: expected cost uninsured without the gym is 12 < 22, so adverse selection survives', () => {
    expect(100 - rnValue('LOW', 'VOL', 22, { buy: false, gym: false })).toBeCloseTo(12, 10);
    expect(rnChoice('LOW', 'VOL', 22).buy).toBe(false);
  });
});

function playL5(seed: string, decide: (s: GameState, stepId: string) => unknown): GameState {
  const s = createInitialState({ mode: 'SINGLE_LEVEL', level: 5, nPlayers: 4, difficulty: 'NORMAL', seed, botSamples: 30 });
  for (let i = 0; i < 500 && s.phase.kind !== 'LEVEL_DEBRIEF'; i++) {
    if (s.phase.kind === 'DECIDE') step(s, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: decide(s, s.phase.step!) });
    else step(s, { type: 'ADVANCE' });
  }
  return s;
}

describe('Part B: self-serving shift uses unpaid fair answers', () => {
  it('fairShift is after minus before', () => {
    expect(fairShift(0.3, 0.3)).toBe(0);
    expect(fairShift(0.4, 0.1)).toBeCloseTo(-0.3, 10);
  });

  it('a delegate who passes, with equal fair answers, has shift 0 and no paid move', () => {
    const s = playL5('passer', (_g, stepId) => {
      if (stepId === 'VEIL') return { t: 0.5, F: 40 };
      if (stepId === 'FAIR_1' || stepId === 'FAIR_2') return 0.3;
      if (stepId === 'LOBBY') return { donateTo: null, amount: 0, proposal: null };
      return true;
    });
    const d = (s.levelState as L5State).debrief!;
    expect(d.deltaT[HUMAN_ID]).toBe(0);
    expect(d.paidMove[HUMAN_ID]).toBeNull();
    expect(d.proposals[HUMAN_ID]).toBeNull();
  });
});

describe('Part E: amendments that match the rules in force are withdrawn', () => {
  it('a proposal equal to the current rules is skipped, not voted on, and does not pass', () => {
    let found: AmendmentRecord | undefined;
    for (let k = 0; k < 20 && !found; k++) {
      const s = playL5(`withdraw-${k}`, (g, stepId) => {
        if (stepId === 'VEIL') return { t: 0.3, F: 40 };
        if (stepId === 'FAIR_1' || stepId === 'FAIR_2') return 0.3;
        if (stepId === 'LOBBY') {
          const cur = (g.levelState as L5State).current as Constitution;
          return { donateTo: null, amount: 0, proposal: { ...cur } };
        }
        return true;
      });
      const mine = (s.levelState as L5State).amendments.find((a) => a.proposer === HUMAN_ID)!;
      const unchanged = Math.abs(mine.proposal.t - mine.statusQuo.t) < 1e-9 && mine.proposal.F === mine.statusQuo.F;
      // Every amendment that equals the status quo at its turn must be withdrawn, and only those.
      expect(!!mine.withdrawn).toBe(unchanged);
      if (mine.withdrawn) found = mine;
    }
    expect(found).toBeDefined();
    expect(found!.passed).toBe(false);
    expect(Object.keys(found!.votes)).toHaveLength(0);
  });
});

describe('Part E: level points and guess bonus', () => {
  it('level points are 100 + 50 x (score - table average) / level spread', () => {
    const sd = SCORE.LEVEL_SD[0];
    const pts = levelPoints([10, 20, 30], 1);
    expect(pts[1]).toBeCloseTo(100, 10);
    expect(pts[2] - pts[1]).toBeCloseTo((50 * 10) / sd, 10);
    expect(pts.reduce((x, y) => x + y, 0) / 3).toBeCloseTo(100, 10);
  });
  it('a negative table average is harmless', () => {
    const pts = levelPoints([-110, -20, 30, 40], 4);
    for (const p of pts) expect(Number.isFinite(p)).toBe(true);
    expect(pts.reduce((x, y) => x + y, 0) / 4).toBeCloseTo(100, 10);
  });
  it('guess bonus is 25 level points', () => expect(SCORE.GUESS_BONUS).toBe(25));
});

describe('D-57: Level 4 training costs offset the hardship line', () => {
  it('costs are 15, 30, 45 and 60', () => expect(L4.COST_OPTIONS).toEqual([15, 30, 45, 60]));
  it('a Circle without childcare gains 70 - 1.4 x cost, so trains at 15, 30 and 45 but not 60', () => {
    for (const c of L4.COST_OPTIONS) expect(investGain(L4.PRIOR_CIRCLE, false, 'A', c)).toBeCloseTo(70 - 1.4 * c, 10);
    expect(L4.COST_OPTIONS.filter((c) => investGain(L4.PRIOR_CIRCLE, false, 'A', c) > 0)).toEqual([15, 30, 45]);
  });
  it('a Circle with childcare trains only at 15', () => {
    for (const c of L4.COST_OPTIONS) expect(investGain(L4.PRIOR_CIRCLE, true, 'A', c)).toBeCloseTo(35 - 1.4 * c, 10);
    expect(L4.COST_OPTIONS.filter((c) => investGain(L4.PRIOR_CIRCLE, true, 'A', c) > 0)).toEqual([15]);
  });
  it('a Square never gains from training at the start', () => {
    for (const care of [false, true])
      expect(L4.COST_OPTIONS.filter((c) => investGain(L4.PRIOR_SQUARE, care, 'A', c) > 0)).toEqual([]);
  });
});

describe('D-59: logit on a fixed 10-coin scale', () => {
  it('the scale is 10 coins', () => expect(BOT.LOGIT_COIN_SCALE).toBe(10));
  it('with lambda 2, gaps of 3, 10 and 30 coins give the worse option about 35%, 12% and 0.25%', () => {
    expect(logitProbs([0, -3], 2)[1]).toBeCloseTo(1 / (1 + Math.exp(0.6)), 10);
    expect(logitProbs([0, -10], 2)[1]).toBeCloseTo(0.1192, 4);
    expect(logitProbs([0, -30], 2)[1]).toBeCloseTo(0.0025, 4);
  });
  it('two options 1 coin apart are close to 50/50 for every bot', () => {
    for (const prof of Object.values(BOT_PROFILES)) {
      const lam = prof.lambda * DIFFICULTY.NORMAL.lambdaMult;
      const p = logitProbs([100, 99], lam)[1];
      expect(p).toBeGreaterThan(0.35);
      expect(p).toBeLessThan(0.5);
    }
  });
  it('options 50 coins apart give the worse one under 1% for every bot at every difficulty', () => {
    for (const prof of Object.values(BOT_PROFILES))
      for (const d of Object.values(DIFFICULTY)) expect(logitProbs([100, 50], prof.lambda * d.lambdaMult)[1]).toBeLessThan(0.01);
  });
  it('the result depends on the coin gap, not on the spread of the options', () => {
    expect(logitProbs([0, -10, -100], 2)[1] / logitProbs([0, -10, -100], 2)[0]).toBeCloseTo(Math.exp(-2), 10);
  });
});
