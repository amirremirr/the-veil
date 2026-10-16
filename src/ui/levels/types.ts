import type { FC } from 'react';
import type { ViewState } from '../../engine/types';
import { tList } from '../i18n';

export interface LevelUI {
  Decide: FC<{ v: ViewState }>;
  Reveal: FC<{ v: ViewState }>;
  Info: FC<{ v: ViewState }>;
  Debrief: FC<{ v: ViewState }>;
  briefing(v: ViewState): string;
}

export function briefingFrom(level: number, round: number): string {
  const arr = tList(`levels.${level}.briefing`);
  return arr[Math.min(arr.length, Math.max(1, round)) - 1] ?? '';
}
