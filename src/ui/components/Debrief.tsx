import type { ReactNode } from 'react';
import archives from '../copy/archives.json';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { cardName, coins } from '../labels';
import { HUMAN_ID, levelRounds, nameOf } from '../game';
import { Collapsible, FormCard, Page, Stamp } from './common';

export interface CompareRow {
  label: string;
  benchmark: ReactNode;
  lab: string;
  you: string;
  bots: string;
}

/**
 * End-of-level summary. The first fold holds the lesson, one "you vs. the theory" row, the scores,
 * the level's main chart, and the buttons. Everything else sits in one closed "Show details" section.
 */
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
  const score = (id: string) => v.scores[id]?.byLevel[level - 1] ?? 0;
  const players = v.players.slice().sort((a, b) => score(b.id) - score(a.id));
  const entries = archives.entries.filter((e) => archiveIds.includes(e.id));
  const refs = archives.refs as Record<string, string>;
  const rel = v.reliability?.[HUMAN_ID];
  const canNext = level < 5 && (settings.unlockAll || progress.unlocked > level);
  const row = compare?.[0];
  return (
    <Page>
      <header className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="label">{t(`levels.${level}.name`)}</span>
          <Stamp small rotate={-3}>
            {t('debrief.stamp', { n: level })}
          </Stamp>
        </div>
        <h1 className="h-display mt-1 text-xl leading-tight">{t(`levels.${level}.question`)}</h1>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="space-y-3">
          <section className="rounded-md border-2 border-ink bg-card p-3">
            <h2 className="label">{t('debrief.lesson')}</h2>
            <p className="mt-1 font-semibold leading-snug">{t(`debrief.l${level}.lesson`)}</p>
          </section>

          {row && (
            <section aria-label={t('debrief.vsTheory')}>
              <h2 className="label mb-1">
                {t('debrief.vsTheory')}: {row.label}
              </h2>
              <dl className="grid grid-cols-2 gap-1.5 text-sm">
                {(
                  [
                    [t('debrief.theory'), row.benchmark],
                    [t('debrief.experiments'), row.lab],
                    [t('debrief.youDid'), row.you],
                  ] as Array<[string, ReactNode]>
                ).map(([k, val], i) => (
                  <div key={k} className={`rounded-md border p-2 ${i === 0 ? 'col-span-2' : ''} ${i === 2 ? 'border-ink bg-ink/5' : 'border-line bg-card'}`}>
                    <dt className="text-[11px] uppercase tracking-wide text-soft">{k}</dt>
                    <dd className={`leading-snug ${i === 2 ? 'font-semibold' : ''}`}>{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section aria-label={t('debrief.scores')}>
            <h2 className="label mb-1">{t('debrief.scores')}</h2>
            <ol className="divide-y divide-line/60 rounded-md border border-line bg-card px-3 text-sm">
              {players.map((p) => (
                <li key={p.id} className={`flex items-baseline justify-between gap-2 py-1 ${p.id === HUMAN_ID ? 'font-semibold' : ''}`}>
                  <span className="min-w-0 truncate">
                    {nameOf(v, p.id)}
                    {v.revealAll && p.values && <span className="font-normal text-soft"> · {cardName(p.values)}</span>}
                  </span>
                  <span className="num">{coins(score(p.id))}</span>
                </li>
              ))}
            </ol>
            {!v.revealAll && <p className="mt-1 text-xs text-soft">{t('debrief.valuesHidden')}</p>}
          </section>
        </div>

        <FormCard form={t('debrief.chart')}>{chart}</FormCard>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" data-debrief-actions>
        {v.mode === 'FULL_RUN' ? (
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => dispatch({ type: 'ADVANCE' })}>
            {level < 5 ? t('debrief.next') : t('debrief.toRunDebrief')}
          </button>
        ) : (
          canNext && (
            <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => nextSingleLevel()}>
              {t('debrief.next')}
            </button>
          )
        )}
        <button type="button" className="btn-ghost flex-1 px-2 text-sm sm:flex-none" onClick={() => replay(true)}>
          {t('debrief.replaySame')}
        </button>
        <button type="button" className="btn-ghost flex-1 px-2 text-sm sm:flex-none" onClick={() => replay(false)}>
          {t('debrief.replayNew')}
        </button>
        <button type="button" className="btn-ghost flex-1 px-2 text-sm sm:flex-none" onClick={() => go('title')}>
          {t('debrief.menu')}
        </button>
      </div>

      <div className="mt-4">
        <Collapsible title={t('debrief.showDetails')}>
          <div className="space-y-5">
            <section>
              <h2 className="label mb-1">{t('debrief.predicted')}</h2>
              <div className="space-y-2">{predicted}</div>
              {row && (
                <p className="mt-2 text-soft">
                  {t('debrief.compare.bots')}: {row.bots}
                </p>
              )}
            </section>
            <section>
              <h2 className="label mb-1">{t('debrief.did')}</h2>
              <div className="space-y-2">{did}</div>
            </section>
            <section>
              <h2 className="label mb-1">{t('debrief.perRound')}</h2>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('summary.citizen')}</th>
                      {rounds.map((r) => (
                        <th key={r.round} className="text-end">
                          R{r.round}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id} className={p.id === HUMAN_ID ? 'font-semibold' : ''}>
                        <td>{nameOf(v, p.id)}</td>
                        {rounds.map((r) => (
                          <td key={r.round} className="num text-end">
                            {coins(r.W[p.id])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rel && <p className="mt-1 text-xs text-soft">{t('debrief.trust', { r: Math.round(((rel.kept + 1) / (rel.made + 2)) * 100) })}</p>}
            </section>
            {extra && <section>{extra}</section>}
            <section>
              <h2 className="label mb-1">{t('debrief.archives')}</h2>
              <ul className="space-y-3">
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
            </section>
            <p className="label">{t('debrief.seed', { seed: v.seed })}</p>
          </div>
        </Collapsible>
      </div>
    </Page>
  );
}
