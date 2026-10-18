import { HARDSHIP, METRIC_SCALE, SCORE } from './params';
import type { ValuesCard } from './types';

/** Share of total wealth per player. Falls back to equal shares if total <= 0. */
export function wealthShares(W: readonly number[]): number[] {
  const total = W.reduce((a, b) => a + b, 0);
  const n = W.length;
  if (total <= 0) return W.map(() => 1 / n);
  return W.map((w) => w / total);
}

/** Effort shares from raw effort. Falls back to equal shares if total effort is 0. */
export function effortSharesFrom(effort: readonly number[]): number[] {
  const total = effort.reduce((a, b) => a + b, 0);
  const n = effort.length;
  if (total <= 0) return effort.map(() => 1 / n);
  return effort.map((e) => e / total);
}

export function equalShares(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n);
}

export function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Values metric M for player i (Section 1.4). */
export function valuesMetric(card: ValuesCard, W: readonly number[], i: number, effortShares: readonly number[]): number {
  switch (card) {
    case 'EGOIST':
      return W[i];
    case 'RAWLSIAN':
      return Math.min(...W);
    case 'UTILITARIAN':
      return mean(W);
    case 'MERITOCRAT': {
      const s = wealthShares(W);
      let mismatch = 0;
      for (let j = 0; j < W.length; j++) mismatch += Math.abs(s[j] - effortShares[j]);
      return mean(W) * (1 - SCORE.MERITOCRAT_MISMATCH_WEIGHT * mismatch);
    }
  }
}

/** Hardship penalty in points: POINTS_PER_COIN for every coin of own wealth below the line (D-39). */
export function hardshipPenalty(w: number): number {
  return HARDSHIP.POINTS_PER_COIN * Math.max(0, HARDSHIP.LINE - w);
}

/** Own wealth minus the hardship penalty: what a purely selfish player maximizes. */
export function ownNet(w: number): number {
  return w - hardshipPenalty(w);
}

/**
 * Round score S = 0.5 W + 0.5 k M - hardship, with k the card's balancing scale.
 * For the Egoist it equals W - hardship.
 */
export function roundScore(card: ValuesCard, W: readonly number[], i: number, effortShares: readonly number[]): number {
  return (
    SCORE.WEALTH_WEIGHT * W[i] +
    SCORE.METRIC_WEIGHT * METRIC_SCALE[card] * valuesMetric(card, W, i, effortShares) -
    hardshipPenalty(W[i])
  );
}
