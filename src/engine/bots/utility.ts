import { BOT } from '../params';
import type { Rng } from '../rng';

/**
 * Bot utility over a round score S (D-77): constant absolute risk aversion,
 * u(S) = (1 - exp(-a S)) / a with a = rho / BOT.RISK_POINTS, and u(S) = S when rho = 0.
 * It is defined, strictly increasing and (for rho > 0) strictly concave at every score, so losses
 * keep counting however low a score goes. The CRRA it replaces worked on S + 50 floored at 1, which
 * made every score at or below -49 worth the same. At S = 50 the two have the same local risk
 * aversion (rho / 100 per point), so a bot's attitude to ordinary gambles is unchanged.
 * expm1 and log1p keep it accurate when a is tiny.
 */
export function utility(S: number, rho: number): number {
  const a = rho / BOT.RISK_POINTS;
  if (a < 1e-12) return S;
  return -Math.expm1(-a * S) / a;
}

/** Inverse of `utility`: the sure round score with the same utility (certainty equivalent). */
export function certaintyEquivalent(EU: number, rho: number): number {
  const a = rho / BOT.RISK_POINTS;
  if (a < 1e-12) return EU;
  return -Math.log1p(-a * EU) / a;
}

/**
 * Logit (quantal response) choice probabilities over certainty equivalents in coins (D-05, D-59).
 * P(a_k) is proportional to exp(lambda x CE_k / LOGIT_COIN_SCALE). A fixed coin scale replaces the
 * spec 5.3 range scale, so a bot is careless about small gaps and careful about large ones.
 */
export function logitProbs(U: readonly number[], lambda: number): number[] {
  const max = Math.max(...U);
  const ex = U.map((u) => Math.exp((lambda * (u - max)) / BOT.LOGIT_COIN_SCALE));
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

/** Expected utility of a list of equally likely scores, expressed as a certainty equivalent. */
export function ceOfSamples(scores: readonly number[], rho: number): number {
  let eu = 0;
  for (const s of scores) eu += utility(s, rho);
  return certaintyEquivalent(eu / scores.length, rho);
}

/** Weighted version: pairs of [probability, score]. */
export function ceOfLottery(lottery: ReadonlyArray<readonly [number, number]>, rho: number): number {
  let eu = 0;
  let pt = 0;
  for (const [p, s] of lottery) {
    eu += p * utility(s, rho);
    pt += p;
  }
  return certaintyEquivalent(eu / (pt || 1), rho);
}
