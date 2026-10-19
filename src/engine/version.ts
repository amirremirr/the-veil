// Rules version (D-75). Seed plus action log replays a game exactly only under the same engine code
// and parameters, so every game records which rules it was played under: a hash of the engine sources
// (src/engine/rules-hash.ts, generated), a hash of the parameter values in force when the game started
// (catches in-memory changes made by simulator tools), and the commit of the build when known.
import * as PARAMS from './params';
import { RULES_HASH } from './rules-hash';
import { hashString } from './rng';
import type { GameState, RulesVersion } from './types';

export type { RulesVersion };

/** Set by Vite at build time (vite.config.ts); absent under tsx and wrangler. */
declare const __RULES_COMMIT__: string | undefined;

/** JSON with object keys sorted, so the hash does not depend on key order. */
function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object')
    return `{${Object.keys(x)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((x as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(x);
}

export function paramsHash(): string {
  const s = stable(PARAMS);
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return hex(hashString(s)) + hex(hashString(`params|${s}`));
}

export function currentRules(): RulesVersion {
  return {
    rules: RULES_HASH,
    params: paramsHash(),
    commit: typeof __RULES_COMMIT__ === 'string' && __RULES_COMMIT__ ? __RULES_COMMIT__ : 'unknown',
  };
}

/**
 * 'same': identical. 'commitOnly': a different build with identical rules and parameters (replays the
 * same). 'different': other rules or parameters, or no version recorded (games from before D-75).
 */
export function compareRules(recorded: RulesVersion | undefined, now: RulesVersion = currentRules()): 'same' | 'commitOnly' | 'different' {
  if (!recorded || recorded.rules !== now.rules || recorded.params !== now.params) return 'different';
  return recorded.commit === now.commit ? 'same' : 'commitOnly';
}

/** A saved game can be resumed only under the rules it was started with. */
export function canResume(game: Pick<GameState, 'rules'> | null | undefined): boolean {
  return !!game && compareRules(game.rules) !== 'different';
}

export class RulesMismatchError extends Error {
  constructor(public recorded: RulesVersion | undefined, public now: RulesVersion) {
    super(
      `This game record was made under different rules (recorded ${recorded ? `${recorded.rules}/${recorded.params}` : 'none'}, ` +
        `current ${now.rules}/${now.params}), so it would not replay the same.`,
    );
  }
}

/** The downloadable game record (run summary): enough to replay the game, plus the rules it needs. */
export function gameRecord(game: GameState) {
  return {
    rules: game.rules,
    rulesNote: 'Replays exactly only on an engine whose rules and params hashes match (DECISIONS.md D-75).',
    seed: game.seed,
    config: game.config,
    log: game.log,
    history: game.history,
  };
}

/** Throws RulesMismatchError unless the record's rules match this engine. */
export function assertSameRules(record: { rules?: RulesVersion }): void {
  const now = currentRules();
  if (compareRules(record.rules, now) === 'different') throw new RulesMismatchError(record.rules, now);
}

