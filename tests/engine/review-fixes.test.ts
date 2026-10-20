// Fixes from the post-merge review (DECISIONS.md D-83 onward).
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { varianceShares } from '../../src/engine/levels/level2';
import en from '../../src/ui/copy/en.json';

const variance = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
};

describe('D-85: Level 2 shares describe the spread the rules tend to produce, not this game\'s realized spread', () => {
  it('offsetting parts: the realized spread is zero, the shares still split the parts 50/50', () => {
    const X = [0, 10];
    const E = [10, 0];
    expect(variance(X.map((x, i) => x + E[i]))).toBe(0);
    expect(varianceShares(X, E)).toEqual({ talentEffort: 0.5, luck: 0.5 });
  });

  it('correlated parts: the realized variance is twice the sum of the parts, the shares ignore the covariance', () => {
    const X = [0, 10];
    const E = [0, 10];
    expect(variance(X.map((x, i) => x + E[i]))).toBe(2 * (variance(X) + variance(E)));
    expect(varianceShares(X, E)).toEqual({ talentEffort: 0.5, luck: 0.5 });
  });

  it('independent parts: the shares equal each part\'s share of the realized variance', () => {
    const X = [0, 10, 0, 10];
    const E = [0, 0, 20, 20];
    const Y = X.map((x, i) => x + E[i]);
    expect(varianceShares(X, E).talentEffort).toBeCloseTo(variance(X) / variance(Y), 12);
  });

  it('the label says what is computed, and the note says talent is not chosen and the actual spread can differ', () => {
    expect(en.debrief.l2.variance).toBe('Of the income spread these rules tend to produce, about {te}% comes from talent and work and {lu}% from luck.');
    expect(en.debrief.l2.varianceNote).toMatch(/not chosen/);
    expect(en.debrief.l2.varianceNote).toMatch(/actual spread can differ/);
  });
});

describe('D-84: the rules hash covers the shared screen flow', () => {
  it('lists src/shared/flow.ts and every engine source', () => {
    const files = execSync('node scripts/rules-version.mjs --list', { encoding: 'utf8' }).trim().split(/\r?\n/);
    expect(files).toContain('../shared/flow.ts');
    expect(files).toContain('engine.ts');
    expect(files).toContain('levels/level4.ts');
    expect(files).not.toContain('rules-hash.ts');
  });
});

describe('D-89: the game-code hint is limited to this version', () => {
  it('says "in this version"', () => expect(en.setup.seedHint).toMatch(/replay the exact same game in this version\./));
});
