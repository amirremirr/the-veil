import { useState } from 'react';
import type { Choice, L3Debrief, L3Round, Regime, RiskType } from '../../engine/levels/level3';
import { L3 } from '../../engine/params';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { lifeEvent, t } from '../i18n';
import { coins, pct } from '../labels';
import { HUMAN_ID, nameOf } from '../game';
import { FormCard, Stamp } from '../components/common';
import { ContinueBar, PrimaryBar } from '../components/TableParts';
import { ChartFrame, LineChart } from '../components/Charts';
import { DebriefShell } from '../components/Debrief';
import { briefingFrom, type LevelUI } from './types';

const REGIMES: Regime[] = ['VOL', 'M50', 'M100'];
type L3View = {
  myType: RiskType;
  types?: Record<string, RiskType>;
  regime: Regime;
  insurerActive: boolean;
  premium: number | null;
  regimeVotes?: Record<string, Regime>;
  regimeCounts?: number[];
  regimeTie?: boolean;
  rounds: L3Round[];
  debrief?: L3Debrief;
};
const rname = (r: Regime) => t(`levels.3.regimes.${r}`);

function Letter({ type }: { type: RiskType }) {
  return (
    <div className="rounded-md border-2 border-dashed border-ink/60 bg-card p-3 text-sm">
      <div className="label">{t('levels.3.letter')}</div>
      <p className="mt-1">{t(`levels.3.letterBody.${type}`)}</p>
    </div>
  );
}

function ChoiceForm({ v }: { v: ViewState }) {
  const lv = v.levelView as L3View;
  const dispatch = useStore((s) => s.dispatch);
  const [buy, setBuy] = useState(false);
  const [gym, setGym] = useState(false);
  const mandatory = lv.regime !== 'VOL';
  const canBuy = !mandatory && lv.premium !== null;
  const decision: Choice = { buy: canBuy && buy, gym };
  return (
    <FormCard form={t('levels.3.choiceTitle')} right={`R${v.round}`}>
      <Letter type={lv.myType} />
      <p className="my-3 text-sm">{t('levels.3.choiceDecide')}</p>
      <div className="space-y-2">
        {canBuy ? (
          <button type="button" aria-pressed={buy} className="choice" onClick={() => setBuy(!buy)}>
            <span aria-hidden className="num">{buy ? '[x]' : '[ ]'}</span>
            <span>{t('levels.3.buy', { p: lv.premium!.toFixed(1) })}</span>
          </button>
        ) : (
          <p className="rounded-md border border-line p-3 text-sm">
            {mandatory ? t('levels.3.mandatoryNote', { c: lv.regime === 'M50' ? 50 : 100 }) : t('levels.3.noInsurer')}
          </p>
        )}
        <button type="button" aria-pressed={gym} className="choice" onClick={() => setGym(!gym)}>
          <span aria-hidden className="num">{gym ? '[x]' : '[ ]'}</span>
          <span>{t('levels.3.gym')}</span>
        </button>
      </div>
      <PrimaryBar>
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'SUBMIT_DECISION', from: HUMAN_ID, decision })}>
          {t('levels.3.choiceSubmit')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

function RegimeForm() {
  const dispatch = useStore((s) => s.dispatch);
  const [x, setX] = useState<Regime | null>(null);
  return (
    <FormCard form={t('levels.3.regimeTitle')}>
      <p className="mb-3 text-sm">{t('levels.3.regimeDecide')}</p>
      <div className="space-y-2" role="group" aria-label={t('levels.3.regimeTitle')}>
        {REGIMES.map((r) => (
          <button key={r} type="button" aria-pressed={x === r} className="choice" onClick={() => setX(r)}>
            <span>
              <span className="block font-semibold">{rname(r)}</span>
              <span className="block text-sm text-soft">{t(`levels.3.regimeDesc.${r}`)}</span>
            </span>
          </button>
        ))}
      </div>
      <PrimaryBar>
        <button type="button" className="btn-primary" disabled={!x} onClick={() => dispatch({ type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: x })}>
          {t('levels.3.regimeSubmit')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

function Decide({ v }: { v: ViewState }) {
  return v.phase.step === 'REGIME' ? <RegimeForm /> : <ChoiceForm v={v} />;
}

function Reveal({ v }: { v: ViewState }) {
  const lv = v.levelView as L3View;
  if (v.phase.step === 'REGIME') {
    return (
      <FormCard form={t('levels.3.reveal.regimeTitle')} right={lv.regimeTie ? <Stamp>{t('stamps.COINFLIP')}</Stamp> : undefined}>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {v.players.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 border-b border-line/60 py-1">
              <span>{nameOf(v, p.id)}</span>
              <span className="font-semibold">{lv.regimeVotes?.[p.id] ? rname(lv.regimeVotes[p.id]) : ''}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="h-display text-2xl">{rname(lv.regime)}</span>
          <Stamp>{t('stamps.ADOPTED')}</Stamp>
        </div>
        <ContinueBar />
      </FormCard>
    );
  }
  const r = lv.rounds[lv.rounds.length - 1];
  return (
    <FormCard form={t('levels.3.reveal.eventsTitle', { r: v.round })}>
      <ul className="space-y-2">
        {v.players.map((p) => (
          <li key={p.id} className="rounded-md border border-line p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{nameOf(v, p.id)}</span>
              <span className="flex gap-2">
                {r.choices[p.id].buy && <span className="rounded bg-teal/15 px-1 font-mono text-xs">{t('table.statusInsured')}</span>}
                {r.choices[p.id].gym && <span className="rounded bg-amber/15 px-1 font-mono text-xs">{t('table.statusGym')}</span>}
                <span className="num">{coins(r.W[p.id])}</span>
              </span>
            </div>
            <p className={`mt-1 ${r.events[p.id] ? 'text-stamp' : 'text-soft'}`}>{r.events[p.id] ? lifeEvent(r.eventCards[p.id]) : t('levels.3.reveal.none')}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-sm">
        {r.regime !== 'VOL' && r.T !== undefined && <p>{t('levels.3.reveal.contribution', { T: r.T.toFixed(1) })}</p>}
        {r.regime === 'VOL' && (r.nextPremium !== null ? <p>{t('levels.3.reveal.premiumNext', { p: r.nextPremium.toFixed(1) })}</p> : <Stamp>{t('stamps.LOST')}</Stamp>)}
        {r.regime === 'VOL' && r.nextPremium === null && <p className="mt-2">{t('levels.3.reveal.insurerGone')}</p>}
      </div>
      <ContinueBar />
    </FormCard>
  );
}

function Info({ v }: { v: ViewState }) {
  const lv = v.levelView as L3View;
  return (
    <div className="space-y-2 text-sm">
      <Letter type={lv.myType} />
      <p className="first-letter:uppercase">
        {rname(lv.regime)}
        {lv.regime === 'VOL' && (lv.premium !== null ? ` · ${lv.premium.toFixed(1)}` : '')}
      </p>
      <div className="label">{t('levels.3.info')}</div>
      <ol className="num text-xs">
        <li>R1: 22.0</li>
        {lv.rounds.map((r, i) => (
          <li key={i}>
            R{i + 2}: {r.regime === 'VOL' ? (r.nextPremium !== null ? r.nextPremium.toFixed(1) : '×') : t('ui.l3.mandate')}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Debrief({ v }: { v: ViewState }) {
  const d = (v.levelView as L3View).debrief ?? (v.levelResults[3] as L3Debrief);
  const me = d.types[HUMAN_ID];
  const myVote = d.regimeVotes?.[HUMAN_ID];
  const best = d.bestRegimeForType[me];
  const g = d.gym;
  const rate = (x: [number, number]) => (x[1] ? `${x[0]}/${x[1]}` : '0/0');
  const path = d.premiumPath.map((p, i) => `R${i + 1} ${p === null ? (d.rounds[i].regime === 'VOL' ? '×' : rname(d.rounds[i].regime)) : p.toFixed(1)}`).join(', ');
  return (
    <DebriefShell
      v={v}
      archiveIds={['adverse-selection', 'moral-hazard', 'death-spiral', 'expected-utility']}
      predicted={
        <>
          <p>{t('debrief.l3.predicted')}</p>
          <p className="text-soft">{t('debrief.l3.realWorld')}</p>
        </>
      }
      compare={[
        {
          label: t('ui.l3.cmpLabel'),
          benchmark: '35.2',
          lab: t('ui.l3.cmpLab'),
          you: d.rounds[1]?.choices[HUMAN_ID]?.buy ? t('table.statusInsured') : t('ui.l3.cmpNone'),
          bots: d.premiumPath[1] !== null && d.premiumPath[1] !== undefined ? d.premiumPath[1].toFixed(1) : '×',
        },
      ]}
      did={
        <>
          <p>{t('debrief.l3.path', { path })}</p>
          <p>{d.unraveled ? t('debrief.l3.unraveled') : t('debrief.l3.survived')}</p>
          <p>{t('debrief.l3.gym', { ins: rate(g.insured), unins: rate(g.uninsured), mand: rate(g.mandatory) })}</p>
          {myVote && (
            <p>
              {t('debrief.l3.yourType', { type: t(`ui.l3.type${me}`), best: rname(best), vote: rname(myVote) })}{' '}
              {myVote === best ? t('debrief.l3.matchType') : t('debrief.l3.mismatchType')}
            </p>
          )}
          <div className="overflow-x-auto">
            <div className="label mt-2">{t('debrief.l3.expectedTitle')}</div>
            <table className="data-table mt-1">
              <thead>
                <tr>
                  <th />
                  {REGIMES.map((r) => (
                    <th key={r} className="text-end">
                      {rname(r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['LOW', 'HIGH'] as RiskType[]).map((ty) => (
                  <tr key={ty} className={ty === me ? 'font-semibold' : ''}>
                    <td>{t(`ui.l3.type${ty}`)}</td>
                    {REGIMES.map((r) => (
                      <td key={r} className="num text-end">
                        {d.expectedByType[r][ty].toFixed(1)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-soft">{t('ui.l3.highShare', { p: pct(d.highShare) })}</p>
          </div>
        </>
      }
      chart={
        <ChartFrame title={t('debrief.l3.chartTitle')} summary={path}>
          <LineChart
            xLabels={d.rounds.map((_, i) => `R${i + 1}`)}
            series={[{ name: t('ui.l3.premiumSeries'), values: d.premiumPath }]}
            nullLabels={d.rounds.map((r) => (r.regime === 'VOL' ? '×' : t('ui.l3.mandateMark')))}
            yMin={0}
            yMax={L3.LOSS * 0.6}
            format={(x) => x.toFixed(1)}
            annotations={d.pools.map((p) => t('debrief.l3.pool', { n: p.buyers.length }))}
            refLine={{ value: L3.LOADING * L3.LOSS * L3.P_BAR, label: t('ui.l3.p1') }}
          />
        </ChartFrame>
      }
    />
  );
}

export const L3UI: LevelUI = { Decide, Reveal, Info, Debrief, briefing: (v) => briefingFrom(3, v.round) };
