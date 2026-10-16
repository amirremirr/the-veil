import { describe, expect, it } from 'vitest';
import { principleTax } from '../../src/engine/levels/level1';
import { bestEffort } from '../../src/engine/levels/level2';
import { mandatoryContribution, premiumFor } from '../../src/engine/levels/level3';
import { posterior, updatePrior } from '../../src/engine/levels/level4';
import { constitutionWealth } from '../../src/engine/levels/level5';
import { afterTaxEqualRebate } from '../../src/engine/tax';
import { valuesMetric, mean } from '../../src/engine/scoring';
import { L1, L4 } from '../../src/engine/params';

const DECK = [20, 50, 90, 160];

describe('Test 1: Level 1 principle solver', () => {
  it('P1 -> t = 0', () => expect(principleTax('P1', DECK)).toBe(0));
  it('P2 (F = 40) -> t = 0.45', () => {
    expect(principleTax('P2', DECK)).toBeCloseTo(0.45, 10);
    expect(Math.min(...afterTaxEqualRebate(DECK, 0.45, L1.KAPPA))).toBeCloseTo(40.52, 10);
    expect(Math.min(...afterTaxEqualRebate(DECK, 0.4, L1.KAPPA))).toBeCloseTo(38.88, 10);
  });
  it('P3 (range <= 100) -> t = 0.30', () => {
    expect(principleTax('P3', DECK)).toBeCloseTo(0.3, 10);
    const y = afterTaxEqualRebate(DECK, 0.3, L1.KAPPA);
    expect(Math.max(...y) - Math.min(...y)).toBeCloseTo(98, 10);
  });
  it('P4 -> t = 0.95', () => {
    expect(principleTax('P4', DECK)).toBeCloseTo(0.95, 10);
    expect(Math.min(...afterTaxEqualRebate(DECK, 0.95, L1.KAPPA))).toBeCloseTo(48.12, 10);
    expect(Math.min(...afterTaxEqualRebate(DECK, 0.9, L1.KAPPA))).toBeCloseTo(48.08, 10);
  });
});

describe('Test 2: Level 2 best response (t = 0, n = 4, kappa = 0.2)', () => {
  it.each([
    [0.8, 4],
    [1.2, 6],
    [1.6, 8],
    [2.0, 10],
  ])('a = %f -> e* = %i', (a, e) => expect(bestEffort(0, a, 4, 0.2)).toBe(e));
});

describe('Test 3: Level 3 premiums', () => {
  it('P_1 = 22', () => expect(premiumFor(0.25)).toBeCloseTo(22, 10));
  it('P_2 = 35.2 when only High types bought without the gym', () => expect(premiumFor(0.4)).toBeCloseTo(35.2, 10));
  it('Mandatory 100%, no gym, 2 Low / 2 High: T = 22', () =>
    expect(mandatoryContribution(1, [0.1, 0.1, 0.4, 0.4])).toBeCloseTo(22, 10));
  it('Mandatory 50%, Highs use the gym: T = 6.6', () =>
    expect(mandatoryContribution(0.5, [0.1, 0.1, 0.2, 0.2])).toBeCloseTo(6.6, 10));
});

describe('Test 4: Level 4 posteriors', () => {
  it('pi = 0.6, Pass -> 0.8', () => expect(posterior(0.6, true)).toBeCloseTo(0.8, 10));
  it('pi = 0.6, Fail -> 0.3', () => expect(posterior(0.6, false)).toBeCloseTo(0.3, 10));
  it('pi = 0.3, Pass -> 0.5333', () => expect(Number(posterior(0.3, true).toFixed(4))).toBe(0.5333));
  it('threshold crossing at pi >= 0.36 for Pass', () => {
    expect(posterior(0.36, true)).toBeGreaterThanOrEqual(L4.THRESHOLD - 1e-9);
    expect(posterior(0.359, true)).toBeLessThan(L4.THRESHOLD);
  });
  it('belief update 0.3 -> 0.34 with observed rate 0.5', () => expect(updatePrior(0.3, 0.5)).toBeCloseTo(0.34, 10));
});

describe('Test 5: Level 5 floor top-up', () => {
  it('matches the worked example', () => {
    const W = constitutionWealth([30, 60, 100, 170], { t: 0.2, F: 40 });
    [52.56, 60.56, 92.56, 148.56].forEach((x, i) => expect(W[i]).toBeCloseTo(x, 10));
  });
});

describe('Test 6: Meritocrat scoring', () => {
  it('equals mean wealth when wealth shares equal effort shares', () => {
    const W = [10, 30, 60];
    expect(valuesMetric('MERITOCRAT', W, 0, [0.1, 0.3, 0.6])).toBeCloseTo(mean(W), 10);
  });
  it('equals half the mean wealth at maximal mismatch (sum abs = 1)', () => {
    const W = [100, 0];
    expect(valuesMetric('MERITOCRAT', W, 0, [0.5, 0.5])).toBeCloseTo(0.5 * mean(W), 10);
  });
});
