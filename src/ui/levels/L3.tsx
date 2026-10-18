import { useState } from 'react';
import type { Choice, L3Debrief, L3Round, Regime, RiskType } from '../../engine/levels/level3';
import { L3 } from '../../engine/params';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { lifeEvent, t } from '../i18n';
import { coins, pct } from '../labels';
import { HUMAN_ID, nameOf } from '../game';
import { CheckBox, FormCard, ResultBanner, Stamp } from '../components/common';
import { ContinueBar, PrimaryBar } from '../components/TableParts';
import { ChartFrame, LineChart } from '../components/Charts';
import { DebriefShell } from '../components/Debrief';
import { briefingFrom, type LevelUI } from './types';
import { MoneyLine, fmt1 } from '../components/Money';

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
  const act = useStore((s) => s.act);
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
            <CheckBox on={buy} />
            <span className="leading-snug">{t('levels.3.buy', { p: Math.round(lv.premium!) })}</span>
          </button>
        ) : (
          <p className="rounded-md border border-line p-3 text-sm">
            {mandatory ? t('levels.3.mandatoryNote', { c: lv.regime === 'M50' ? 50 : 100 }) : t('levels.3.noInsurer')}
          </p>
        )}
        <button type="button" aria-pressed={gym} className="choice" onClick={() => setGym(!gym)}>
          <CheckBox on={gym} />
          <span className="leading-snug">{t('levels.3.gym')}</span>
        </button>
      </div>
      <PrimaryBar>
        <button type="button" className="btn-primary" onClick={() => act(decision)}>
          {t('levels.3.choiceSubmit')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

function RegimeForm() {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<Regime | null>(null);
  return (
    <FormCard form={t('levels.3.regimeTitle')}>
      <p className="mb-3 text-sm">{t('levels.3.regimeDecide')}</p>
      <div className="mb-3 space-y-1 rounded-md border border-line bg-paper/60 px-3 py-2 text-sm leading-snug">
        <p>
          {t('levels.3.regimeCost', {
            full: Math.round(L3.LOADING * L3.LOSS * L3.P_BAR),
            half: Math.round(L3.LOADING * 0.5 * L3.LOSS * L3.P_BAR),
          })}
        </p>
        <p>{t('levels.3.regimeKeeps')}</p>
      </div>
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
        <button type="button" className="btn-primary" disabled={!x} onClick={() => act(x)}>
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
            <MoneyLine mine={p.id === HUMAN_ID}>{moneyText(r, p.id)}</MoneyLine>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-sm">
        {r.regime !== 'VOL' && r.T !== undefined && <p>{t('levels.3.reveal.contribution', { T: Math.round(r.T) })}</p>}
        {r.regime === 'VOL' && r.nextPremium !== null && (
          <p>{t('levels.3.reveal.premiumWhy', { p: Math.round(r.nextPremium), r: Math.round((r.nextPremium / (L3.LOADING * L3.LOSS)) * 100) })}</p>
        )}
        {r.regime === 'VOL' && r.nextPremium === null && (
          <>
            <Stamp>{t('stamps.LOST')}</Stamp>
            <p className="mt-2">{r.premium !== null ? t('levels.3.reveal.closedWhy') : t('levels.3.reveal.insurerGone')}</p>
          </>
        )}
      </div>
      <ContinueBar />
    </FormCard>
  );
}

/** "100 - insurance 22 - gym 0 - loss 0 = 78". Every part here is public. */
function moneyText(r: L3Round, id: string): string {
  const ch = r.choices[id];
  const gym = ch.gym ? L3.GYM_COST : 0;
  const ev = r.events[id];
  const base = L3.BASE_INCOME;
  if (r.regime === 'VOL') {
    const prem = ch.buy && r.premium !== null ? r.premium : 0;
    if (ch.buy && ev) return t('summary.money.l3covered', { base, p: fmt1(prem), gym, w: fmt1(r.W[id]) });
    return t('summary.money.l3vol', { base, p: fmt1(prem), gym, loss: ev ? L3.LOSS : 0, w: fmt1(r.W[id]) });
  }
  const c = r.regime === 'M50' ? 0.5 : 1;
  return t('summary.money.l3mand', {
    base,
    T: fmt1(r.T ?? 0),
    gym,
    loss: ev ? L3.LOSS : 0,
    paid: ev ? fmt1(c * L3.LOSS) : 0,
    w: fmt1(r.W[id]),
  });
}

function Info({ v }: { v: ViewState }) {
  const lv = v.levelView as L3View;
  return (
    <div className="space-y-2 text-sm">
      <Letter type={lv.myType} />
      <p className="first-letter:uppercase">
        {rname(lv.regime)}
        {lv.regime === 'VOL' && (lv.premium !== null ? ` · ${Math.round(lv.premium)}` : '')}
      </p>
      <div className="label">{t('levels.3.info')}</div>
      <ol className="num text-xs">
        <li>R1: 22</li>
        {lv.rounds.map((r, i) => (
          <li key={i}>
            R{i + 2}: {r.regime === 'VOL' ? (r.nextPremium !== null ? Math.round(r.nextPremium) : '×') : t('ui.l3.mandate')}
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
  const path = d.premiumPath.map((p, i) => `R${i + 1} ${p === null ? (d.rounds[i].regime === 'VOL' ? '×' : rname(d.rounds[i].regime)) : Math.round(p)}`).join(', ');
  return (
    <DebriefShell
      v={v}
      archiveIds={['adverse-selection', 'moral-hazard', 'death-spiral', 'hardship-line']}
      cardBest={
        d.cardBest && {
          best: t(d.cardBest.best ? 'debrief.choice.buyYes' : 'debrief.choice.buyNo'),
          chose: t(d.cardBest.chose ? 'debrief.choice.buyYes' : 'debrief.choice.buyNo'),
        }
      }
      predicted={
        <>
          <p>{t('debrief.l3.predicted')}</p>
          <p className="text-soft">{t('debrief.l3.realWorld')}</p>
          <p className="text-soft">{t('debrief.l3.realCase')}</p>
        </>
      }
      compare={[
        {
          label: t('ui.l3.cmpLabel'),
          benchmark: '35.2',
          lab: t('ui.l3.cmpLab'),
          you: d.rounds[1]?.choices[HUMAN_ID]?.buy ? t('table.statusInsured') : t('ui.l3.cmpNone'),
          bots: d.premiumPath[1] !== null && d.premiumPath[1] !== undefined ? String(Math.round(d.premiumPath[1])) : '×',
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
                        {Math.round(d.expectedByType[r][ty])}
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
            format={(x) => String(Math.round(x))}
            annotations={d.pools.map((p) => t('debrief.l3.pool', { n: p.buyers.length }))}
            refLine={{ value: L3.LOADING * L3.LOSS * L3.P_BAR, label: t('ui.l3.p1') }}
          />
        </ChartFrame>
      }
    />
  );
}

function Banner({ v }: { v: ViewState; step: string }) {
  const lv = v.levelView as L3View;
  return (
    <ResultBanner>
      {t('levels.3.banner.regime', { name: rname(lv.regime) })}
      {lv.regimeTie && <span className="block font-normal text-soft">{t('levels.1.reveal.tieLine')}</span>}
    </ResultBanner>
  );
}

export const L3UI: LevelUI = { Decide, Reveal, Info, Debrief, Banner, briefing: (v) => briefingFrom(3, v.round) };
