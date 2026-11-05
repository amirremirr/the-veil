// Display names for engine option ids.
import { t } from './i18n';
import type { LevelId, ValuesCard } from '../engine/types';

/** A Values card's name; in Play, its mission in quotes ("Get rich"), since Play never names the cards. */
export function cardName(c: ValuesCard, play = false): string {
  return play ? `"${t(`play.missions.${c}.name`)}"` : t(`values.${c}.name`);
}

export function cardTitle(c: ValuesCard): string {
  return t(`values.${c}.title`);
}

export function optionName(level: LevelId, option: string, play = false): string {
  if (play && level === 3) return t(`play.l3.regimes.${option}.name`);
  switch (level) {
    case 1:
      return t(`levels.1.options.${option}.name`);
    case 2:
      return t(`levels.2.options.${option}`);
    case 3:
      return t(`levels.3.regimes.${option}`);
    case 4:
      return t(`levels.4.policies.${option}.name`);
    case 5:
      return t(`levels.5.options.${option}`);
  }
}

export function actionName(level: LevelId, action: string, play = false): string {
  if (level === 3) return play ? t(`play.promises.${action}`) : t(`levels.3.promises.${action}`);
  return action;
}

export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
export const coins = (x: number) => `${Math.round(x)}`;
export const signed = (x: number, d = 0) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d)}`;

export function constitutionLabel(c: { t: number; F: number }): string {
  return t('levels.5.constitution', { t: Math.round(c.t * 100), F: c.F });
}
