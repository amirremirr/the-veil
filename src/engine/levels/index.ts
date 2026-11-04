import type { LevelId } from '../types';
import type { LevelDefinition } from './types';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { level4 } from './level4';
import { level5 } from './level5';
import { playLevel4 } from '../play/ep4';

/**
 * D-151: a level whose Play episode is its own definition. Study games (no s.play) call the Study level,
 * unchanged; Play games call the Play episode. Every method takes the game state first, so this is a switch.
 */
function byRuleset(study: LevelDefinition, play: LevelDefinition): LevelDefinition {
  const pick = (s: { play?: unknown }) => (s.play ? play : study);
  const out = { id: study.id, rounds: study.rounds, observable: [...new Set([...study.observable, ...play.observable])] } as LevelDefinition;
  for (const k of Object.keys(study) as Array<keyof LevelDefinition>) {
    const f = study[k];
    if (typeof f !== 'function') continue;
    (out as unknown as Record<string, unknown>)[k] = (s: { play?: unknown }, ...rest: unknown[]) => {
      const d = pick(s) as unknown as Record<string, (...a: unknown[]) => unknown>;
      return d[k] ? d[k](s, ...rest) : undefined;
    };
  }
  return out;
}

export const LEVELS: Record<LevelId, LevelDefinition> = { 1: level1, 2: level2, 3: level3, 4: byRuleset(level4, playLevel4), 5: level5 };
