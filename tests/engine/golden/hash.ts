// Golden Study replay (Play mode spec, Section 0.2). Helpers shared by the recorder and the test.
import { createHash } from 'node:crypto';
import type { GameState } from '../../../src/engine/types';

/** JSON with object keys sorted, so the hash does not depend on key order. */
export function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object')
    return `{${Object.keys(x)
      .sort()
      .filter((k) => (x as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable((x as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(x);
}

export const sha = (x: unknown): string => createHash('sha256').update(stable(x)).digest('hex');

/**
 * The whole final state except `rules`, which records the engine's source hash and changes with any
 * engine edit by design (D-75). Everything that a Study game plays, scores or shows is in here.
 */
export function stateHash(s: GameState): string {
  const { rules: _rules, ...rest } = s;
  return sha(rest);
}

export interface GoldenGame {
  name: string;
  /** Human seats whose final view is hashed too. */
  viewers: string[];
  log: GameState['log'];
  stateHash: string;
  viewHashes: Record<string, string>;
}
