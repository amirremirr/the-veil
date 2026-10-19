import { useMemo } from 'react';
import { HUMAN_ID, visibleState } from '../engine/engine';
import type { LevelId, Message, RoundRecord, ViewState } from '../engine/types';
import { useStore } from './store';
import { newsletter, t, voiceLine } from './i18n';
import { actionName, cardName, optionName } from './labels';

export function useView(): ViewState | null {
  const game = useStore((s) => s.game);
  return useMemo(() => (game ? visibleState(game, HUMAN_ID) : null), [game]);
}

export type VPlayer = ViewState['players'][number];

export function playerById(v: ViewState, id: string): VPlayer | undefined {
  return v.players.find((p) => p.id === id);
}

export function nameOf(v: ViewState, id: string): string {
  if (id === v.viewer) return t('table.you');
  return playerById(v, id)?.name ?? id;
}

/** First name only ("Marigold"), or "You". Used where space is tight. */
export function shortName(v: ViewState, id: string): string {
  if (id === v.viewer) return t('table.you');
  return (playerById(v, id)?.name ?? id).replace(/^Prof\. /, '').split(' ')[0];
}

export function renderMessage(v: ViewState, m: Message): string {
  const from = playerById(v, m.from);
  const msg = m.msg;
  const level = m.level as LevelId;
  const vars: Record<string, string> = {};
  if (msg.type === 'SUPPORT' || msg.type === 'OPPOSE') vars.option = optionName(level, msg.option);
  if (msg.type === 'PROMISE') vars.action = actionName(level, msg.action);
  if (msg.type === 'CLAIM_VALUES' || msg.type === 'ACCUSE') vars.cardName = cardName(msg.card);
  if (msg.type === 'ACCUSE') vars.target = nameOf(v, msg.target);
  const aboutHuman = msg.type === 'ACCUSE' && msg.target === v.viewer;
  const text =
    !from || from.isHuman || !from.botKey ? t(`talk.human.${msg.type}`, vars) : voiceLine(from.botKey, msg.type, m.variant, vars, aboutHuman);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function levelRounds(v: ViewState, level: LevelId = v.levelIndex): RoundRecord[] {
  return v.history.filter((r) => r.level === level);
}

/** The finished record for the current round, if it has been resolved. */
export function currentRecord(v: ViewState): RoundRecord | undefined {
  return v.history.find((r) => r.level === v.levelIndex && r.round === v.round);
}

/** The round's news headline. Pass the view so a headline about the viewer uses second person. */
export function headlineText(r: RoundRecord | undefined, v?: ViewState): string {
  if (!r?.headline) return '';
  const h = r.headline;
  const human = v?.players.find((p) => p.id === v.viewer);
  const you = !!human && h.vars.name === human.name;
  if (h.key.endsWith('_tie')) {
    const base = h.key.replace('_tie', '');
    return `${newsletter('l1.tie', h.variant, h.vars)} ${newsletter(base, h.variant, h.vars, you)}`;
  }
  return newsletter(h.key, h.variant, h.vars, you);
}

export const ROUNDS: Record<LevelId, number> = { 1: 3, 2: 4, 3: 4, 4: 5, 5: 1 };

export function humanLevelScore(v: ViewState, level: LevelId = v.levelIndex): number {
  return v.scores[v.viewer]?.byLevel[level - 1] ?? 0;
}

export { HUMAN_ID };
