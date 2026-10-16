import type { LevelId } from '../types';
import type { LevelDefinition } from './types';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { level4 } from './level4';
import { level5 } from './level5';

export const LEVELS: Record<LevelId, LevelDefinition> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };
