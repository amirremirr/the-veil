import { EPS } from './params';

/** Okun's leaky bucket: R = t Y (1 - kappa t). */
export function leakyRevenue(t: number, Y: number, kappa: number): number {
  return t * Y * (1 - kappa * t);
}

export function sum(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/** After-tax income with equal rebate: y (1 - t) + R / n. */
export function afterTaxEqualRebate(incomes: readonly number[], t: number, kappa: number): number[] {
  const R = leakyRevenue(t, sum(incomes), kappa);
  const n = incomes.length;
  return incomes.map((y) => y * (1 - t) + R / n);
}

export function taxGrid(step: number, max: number): number[] {
  const out: number[] = [];
  const k = Math.round(max / step);
  for (let i = 0; i <= k; i++) out.push(Math.round(i * step * 1e6) / 1e6);
  return out;
}

export type PrincipleId = 'P1' | 'P2' | 'P3' | 'P4';
export const PRINCIPLES: PrincipleId[] = ['P1', 'P2', 'P3', 'P4'];

function argBest(grid: number[], score: (t: number) => number): number {
  let best = grid[0];
  let bestV = -Infinity;
  for (const t of grid) {
    const v = score(t);
    if (v > bestV + EPS) {
      bestV = v;
      best = t;
    }
  }
  return best;
}

/** Level 1 principle solver: returns the tax rate t chosen by a principle for given incomes. */
export function solvePrinciple(
  p: PrincipleId,
  incomes: readonly number[],
  opts: { kappa: number; floor: number; rangeCap: number; grid: number[] },
): number {
  const { kappa, floor, rangeCap, grid } = opts;
  const post = (t: number) => afterTaxEqualRebate(incomes, t, kappa);
  const minAt = (t: number) => Math.min(...post(t));
  const rangeAt = (t: number) => {
    const y = post(t);
    return Math.max(...y) - Math.min(...y);
  };
  switch (p) {
    case 'P1':
      return 0;
    case 'P2': {
      for (const t of grid) if (minAt(t) >= floor - EPS) return t;
      return argBest(grid, minAt);
    }
    case 'P3': {
      for (const t of grid) if (rangeAt(t) <= rangeCap + EPS) return t;
      return argBest(grid, (t) => -rangeAt(t));
    }
    case 'P4':
      return argBest(grid, minAt);
  }
}

/**
 * Level 5 constitution: tax at t, top everyone up to floor F from revenue
 * (pro rata to shortfalls if revenue is short), split any remainder equally.
 */
export function floorTopUp(incomes: readonly number[], t: number, F: number, kappa: number): number[] {
  const n = incomes.length;
  const after = incomes.map((y) => (1 - t) * y);
  const R = leakyRevenue(t, sum(incomes), kappa);
  const short = after.map((a) => Math.max(0, F - a));
  const need = sum(short);
  if (need <= R + EPS) {
    const rem = (R - need) / n;
    return after.map((a, i) => a + short[i] + rem);
  }
  const ratio = need > 0 ? R / need : 0;
  return after.map((a, i) => a + short[i] * ratio);
}
