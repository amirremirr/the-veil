import type { ReactNode } from 'react';
import archives from '../copy/archives.json';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { cardName, coins } from '../labels';
import { HUMAN_ID, levelRounds, nameOf } from '../game';
import { FormCard, Page, Stamp } from './common';

export interface CompareRow {
  label: string;
  benchmark: string;
  lab: string;
  you: string;
  bots: string;
}

export function DebriefShell({
  v,
  predicted,
  compare,
  did,
  chart,
  archiveIds,
  extra,
}: {
  v: ViewState;
  predicted: ReactNode;
  compare?: CompareRow[];
  did: ReactNode;
  chart: ReactNode;
  archiveIds: string[];
  extra?: ReactNode;
}) {
  const { dispatch, replay, go, nextSingleLevel, progress, settings } = useStore();
  const rounds = levelRounds(v);
  const level = v.levelIndex;
  const players = v.players.slice().sort((a, b) => (v.scores[b.id]?.byLevel[level - 1] ?? 0) - (v.scores[a.id]?.byLevel[level - 1] ?? 0));
  const entries = archives.entries.filter((e) => archiveIds.includes(e.id));
  const refs = archives.refs as Record<string, string>;
  const rel = v.reliability?.[HUMAN_ID];
  const canNext = level < 5 && (settings.unlockAll || progress.unlocked > level);
  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label">{t(`levels.${level}.name`)}</div>
          <h1 className="h-display text-3xl">{t(`levels.${level}.question`)}</h1>
        </div>
        <Stamp>{t('debrief.stamp', { n: level })}</Stamp>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormCard form={t('debrief.scoreboard')}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('summary.citizen')}</th>
                  {v.revealAll && <th>{t('run.colCard')}</th>}
                  {rounds.map((r) => (
                    <th key={r.round} className="text-end">
                      R{r.round}
                    </th>
                  ))}
                  <th className="text-end">{t('debrief.levelScore')}</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className={p.id === HUMAN_ID ? 'font-semibold' : ''}>
                    <td>{nameOf(v, p.id)}</td>
                    {v.revealAll && <td>{p.values ? cardName(p.values) : ''}</td>}
                    {rounds.map((r) => (
                      <td key={r.round} className="num text-end">
                        {coins(r.W[p.id])}
                      </td>
                    ))}
                    <td className="num text-end">{coins(v.scores[p.id]?.byLevel[level - 1] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-soft">
            {v.revealAll ? '' : t('debrief.valuesHidden')} {rel ? t('debrief.trust', { r: Math.round(((rel.kept + 1) / (rel.made + 2)) * 100) }) : ''}
          </p>
        </FormCard>
        <FormCard form={t('debrief.predicted')}>
          <div className="space-y-3 text-sm leading-relaxed">{predicted}</div>
          {compare && (
            <div className="mt-4 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th />
                    <th>{t('debrief.compare.benchmark')}</th>
                    <th>{t('debrief.compare.lab')}</th>
                    <th>{t('debrief.compare.you')}</th>
                    <th>{t('debrief.compare.bots')}</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map((r) => (
                    <tr key={r.label}>
                      <td className="label">{r.label}</td>
                      <td>{r.benchmark}</td>
                      <td>{r.lab}</td>
                      <td className="font-semibold">{r.you}</td>
                      <td>{r.bots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FormCard>
        <FormCard form={t('debrief.did')}>
          <div className="space-y-3 text-sm leading-relaxed">{did}</div>
        </FormCard>
        <FormCard form={t('debrief.chart')}>{chart}</FormCard>
        {extra && <div className="lg:col-span-2">{extra}</div>}
        <FormCard form={t('debrief.archives')}>
          <ul className="space-y-3 text-sm">
            {entries.map((e) => (
              <li key={e.id}>
                <div className="font-semibold">{e.title}</div>
                <ul className="mt-1 space-y-1 text-soft">
                  {e.refs.map((r) => (
                    <li key={r}>{refs[r]}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost mt-3" onClick={() => go('archives')}>
            {t('debrief.openArchives')}
          </button>
        </FormCard>
      </div>
      <p className="label mt-6">{t('debrief.seed', { seed: v.seed })}</p>
      <div className="sticky bottom-0 -mx-4 mt-4 flex flex-wrap justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <button type="button" className="btn-ghost" onClick={() => go('title')}>
          {t('debrief.menu')}
        </button>
        <button type="button" className="btn-ghost" onClick={() => replay(false)}>
          {t('debrief.replayNew')}
        </button>
        <button type="button" className="btn-ghost" onClick={() => replay(true)}>
          {t('debrief.replaySame')}
        </button>
        {v.mode === 'FULL_RUN' ? (
          <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'ADVANCE' })}>
            {level < 5 ? t('debrief.next') : t('debrief.toRunDebrief')}
          </button>
        ) : (
          canNext && (
            <button type="button" className="btn-primary" onClick={() => nextSingleLevel()}>
              {t('debrief.next')}
            </button>
          )
        )}
      </div>
    </Page>
  );
}
