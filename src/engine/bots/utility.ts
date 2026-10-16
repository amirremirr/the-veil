import { BOT } from '../params';
import type { Rng } from '../rng';

/** CRRA utility over a round score with a +50 shift (Section 5.2). */
export function crra(S: number, rho: number): number {
  const x = Math.max(BOT.UTILITY_MIN_ARG, S + BOT.UTILITY_SHIFT);
  if (Math.abs(rho - 1) < 1e-9) return Math.log(x);
  return (Math.pow(x, 1 - rho) - 1) / (1 - rho);
}

/** Logit (quantal response) choice probabilities with range-normalized scale (Section 5.3). */
export function logitProbs(U: readonly number[], lambda: number): number[] {
  const max = Math.max(...U);
  const min = Math.min(...U);
  const scale = Math.max(1, max - min);
  // Range normalization: utilities in "util" units are tiny for high rho, so we
  // normalize by the spread when it exceeds 1 and by 1 otherwise (spec 5.3).
  const ex = U.map((u) => Math.exp((lambda * (u - max)) / scale));
  const z = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / z);
}

export function logitChoice(U: readonly number[], lambda: number, rng: Rng): number {
  return rng.weighted(logitProbs(U, lambda));
}

export function argmax(xs: readonly number[]): number {
  let bi = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[bi]) bi = i;
  return bi;
}

/** Inverse of crra: the sure round score with the same utility (certainty equivalent). */
export function certaintyEquivalent(EU: number, rho: number): number {
  let x: number;
  if (Math.abs(rho - 1) < 1e-9) x = Math.exp(EU);
  else {
    const base = 1 + (1 - rho) * EU;
    x = base <= 0 ? BOT.UTILITY_MIN_ARG : Math.pow(base, 1 / (1 - rho));
  }
  return x - BOT.UTILITY_SHIFT;
}

/** Expected CRRA utility of a list of equally likely scores, expressed as a certainty equivalent. */
export function ceOfSamples(scores: readonly number[], rho: number): number {
  let eu = 0;
  for (const s of scores) eu += crra(s, rho);
  return certaintyEquivalent(eu / scores.length, rho);
}

/** Weighted version: pairs of [probability, score]. */
export function ceOfLottery(lottery: ReadonlyArray<readonly [number, number]>, rho: number): number {
  let eu = 0;
  let pt = 0;
  for (const [p, s] of lottery) {
    eu += p * crra(s, rho);
    pt += p;
  }
  return certaintyEquivalent(eu / (pt || 1), rho);
}
