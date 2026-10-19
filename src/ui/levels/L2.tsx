import { useState } from 'react';
import type { L2Bonus, L2Debrief, L2Round, BonusCitizen, FairnessIdeal } from '../../engine/levels/level2';
import { L2 } from '../../engine/params';
import { bestEffort } from '../../engine/levels/level2';
import { MoneyBox, MoneyLine, TaxInfo, fmt1, lossLine, taxPool } from '../components/Money';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { nameOf } from '../game';
import { FormCard, ResultBanner, Stamp } from '../components/common';
import { ContinueBar, PrimaryBar } from '../components/TableParts';
import { ChartFrame, StackedBars } from '../components/Charts';
import { DebriefShell } from '../components/Debrief';
import { briefingFrom, type LevelUI } from './types';

type L2View = {
  myTalent: number;
  talents?: Record<string, number>;
  current: { t?: number; tVotes?: Record<string, number> };
  rounds: L2Round[];
  bonus?: L2Bonus;
  debrief?: L2Debrief;
};

const meanLuck = L2.LUCK_VALUES.reduce((a, b) => a + b, 0) / L2.LUCK_VALUES.length;

function Submit({ label, disabled, decision }: { label: string; disabled?: boolean; decision: unknown }) {
  const act = useStore((s) => s.act);
  return (
    <PrimaryBar>
      <button type="button" className="btn-primary" disabled={disabled} onClick={() => act(decision)}>
        {label}
      </button>
    </PrimaryBar>
  );
}

function TaxForm() {
  const [x, setX] = useState<number | null>(null);
  return (
    <FormCard form={t('levels.2.taxTitle')}>
      <p className="mb-3 text-sm">{t('levels.2.taxDecide')}</p>
      <TaxInfo>
        <p>{t('taxInfo.money')}</p>
        <p className="font-semibold">{lossLine(x ?? 0.4, L2.KAPPA)}</p>
      </TaxInfo>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label={t('levels.2.taxTitle')}>
        {L2.TAX_OPTIONS.map((o) => (
          <button key={o} type="button" aria-pressed={x === o} className="choice justify-center" onClick={() => setX(o)}>
            <span className="num text-lg font-semibold">{pct(o)}</span>
          </button>
        ))}
      </div>
      <Submit label={t('levels.2.taxSubmit')} disabled={x === null} decision={x} />
    </FormCard>
  );
}

function EffortForm({ v }: { v: ViewState }) {
  const lv = v.levelView as L2View;
  const [e, setE] = useState(5);
  const tax = lv.current.t ?? 0;
  const n = v.players.length;
  const y = L2.BASE_INCOME + L2.TALENT_MULT * lv.myTalent * e + meanLuck;
  const cost = L2.EFFORT_COST * e * e;
  // Expected share: the others' talents are secret, so use the average over the talent cards you do
  // not hold, each working as hard as pays for them, with average luck.
  const others = L2.TALENT_DECK.filter((a) => a !== lv.myTalent);
  const otherY = others.reduce((acc, a) => acc + L2.BASE_INCOME + L2.TALENT_MULT * a * bestEffort(tax, a, n) + meanLuck, 0) / others.length;
  const pool = taxPool([y, ...Array.from({ length: n - 1 }, () => otherY)], tax, L2.KAPPA);
  const money = (1 - tax) * y + pool.share - cost;
  return (
    <FormCard form={t('levels.2.effortTitle')} right={t('levels.2.yourTalent', { a: lv.myTalent })}>
      <p className="mb-3 text-sm">{t('levels.2.effortDecide', { t: Math.round(tax * 100) })}</p>
      <label className="block">
        <span className="label">{t('levels.2.effort')}</span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={L2.EFFORT_MAX}
            step={1}
            value={e}
            onChange={(ev) => setE(Number(ev.target.value))}
            className="h-11 w-full accent-[rgb(var(--ink))]"
            aria-valuetext={`${e}`}
          />
          <span className="num w-8 text-end text-2xl font-semibold">{e}</span>
        </div>
      </label>
      <p className="mt-2 text-sm text-soft">{t('levels.2.avgLuck')}</p>
      <dl className="mt-1 grid grid-cols-2 gap-1 text-sm">
        <dt className="text-soft">{t('ui.l2.grossAvg')}</dt>
        <dd className="num text-end">{fmt1(y)}</dd>
        <dt className="text-soft">{t('ui.l2.tax')}</dt>
        <dd className="num text-end">{tax > 0 ? `-${fmt1(tax * y)}` : 0}</dd>
        <dt className="text-soft">{t('ui.l2.expectedShare')}</dt>
        <dd className="num text-end">{pool.share > 0 ? `+${fmt1(pool.share)}` : 0}</dd>
        <dt className="text-soft">{t('ui.l2.effortCost')}</dt>
        <dd className="num text-end">-{fmt1(cost)}</dd>
        <dt className="border-t border-line pt-1 font-semibold">{t('levels.2.moneyAvgLabel')}</dt>
        <dd className="num border-t border-line pt-1 text-end font-semibold">{fmt1(money)}</dd>
      </dl>
      <p className="mt-1 text-xs text-soft">{t('levels.2.moneyAvgNote')}</p>
      <Submit label={t('levels.2.effortSubmit')} decision={e} />
    </FormCard>
  );
}

function PollForm({ v }: { v: ViewState }) {
  const lv = v.levelView as L2View;
  const r = lv.rounds[lv.rounds.length - 1];
  const target = r.pollTarget!;
  const [x, setX] = useState(50);
  return (
    <FormCard form={t('levels.2.pollTitle')}>
      <p className="mb-3 text-sm">{t('levels.2.pollDecide', { name: nameOf(v, target), y: coins(r.y[target]) })}</p>
      <div className="flex items-center gap-3">
        <input type="range" min={0} max={100} step={5} value={x} onChange={(e) => setX(Number(e.target.value))} className="h-11 w-full" aria-label={t('ui.l2.pollAria')} />
        <span className="num w-14 text-end text-2xl font-semibold">{x}%</span>
      </div>
      <p className="mt-2 text-xs text-soft">{t('levels.2.pollNote')}</p>
      <Submit label={t('levels.2.pollSubmit')} decision={x} />
    </FormCard>
  );
}

function CitizenFile({ c }: { c: BonusCitizen }) {
  return (
    <div className="rounded-md border border-line p-3">
      <div className="font-semibold">{c.name}</div>
      <dl className="mt-1 grid grid-cols-2 gap-x-2 text-sm">
        <dt className="text-soft">{t('levels.2.talent')}</dt>
        <dd className="num text-end">{c.talent}</dd>
        <dt className="text-soft">{t('levels.2.effort')}</dt>
        <dd className="num text-end">{c.effort}</dd>
        <dt className="text-soft">{t('levels.2.luck')}</dt>
        <dd className="num text-end">{c.luck}</dd>
        <dt className="text-soft">{t('levels.2.gross')}</dt>
        <dd className="num text-end">{coins(c.y)}</dd>
      </dl>
    </div>
  );
}

function BonusForm({ v }: { v: ViewState }) {
  const b = (v.levelView as L2View).bonus!;
  const [x, setX] = useState(50);
  return (
    <FormCard form={t('levels.2.bonusTitle')}>
      <p className="mb-1 text-sm">{t('levels.2.bonusDecide')}</p>
      <p className="mb-3 text-sm font-semibold">{t('levels.2.pretend')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CitizenFile c={b.a} />
        <CitizenFile c={b.b} />
      </div>
      <label className="mt-4 block">
        <span className="label">
          {b.a.name}: {x} · {b.b.name}: {100 - x}
        </span>
        <input type="range" min={0} max={100} step={1} value={x} onChange={(e) => setX(Number(e.target.value))} className="h-11 w-full" />
      </label>
      <Submit label={t('levels.2.bonusSubmit')} decision={x} />
    </FormCard>
  );
}

function Decide({ v }: { v: ViewState }) {
  switch (v.phase.step) {
    case 'TAX':
      return <TaxForm />;
    case 'EFFORT':
      return <EffortForm v={v} />;
    case 'POLL':
      return <PollForm v={v} />;
    case 'BONUS':
      return <BonusForm v={v} />;
  }
  return null;
}

function Reveal({ v }: { v: ViewState }) {
  const lv = v.levelView as L2View;
  if (v.phase.step === 'TAX') {
    return (
      <FormCard form={t('levels.2.reveal.taxTitle')}>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {v.players.map((p) => (
            <li key={p.id} className="flex justify-between border-b border-line/60 py-1">
              <span>{nameOf(v, p.id)}</span>
              <span className="num">{pct(lv.current.tVotes?.[p.id] ?? 0)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="h-display text-2xl">{t('levels.2.taxApplied', { t: Math.round((lv.current.t ?? 0) * 100) })}</span>
          <Stamp>{t('stamps.APPROVED')}</Stamp>
        </div>
        <ContinueBar />
      </FormCard>
    );
  }
  if (v.phase.step === 'BONUS') {
    const b = lv.bonus;
    return (
      <FormCard form={t('levels.2.reveal.bonusTitle')}>
        {b?.shareToA !== undefined && (
          <p className="text-sm">
            {b.a.name}: {Math.round(b.shareToA * 100)} · {b.b.name}: {Math.round((1 - b.shareToA) * 100)}
          </p>
        )}
        <ContinueBar />
      </FormCard>
    );
  }
  const r = lv.rounds[lv.rounds.length - 1];
  const myE = r.effort[v.viewer];
  const myLuck = r.eps[v.viewer];
  return (
    <FormCard form={t('levels.2.reveal.incomeTitle')}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('summary.citizen')}</th>
            <th className="text-end">{t('levels.2.gross')}</th>
            <th className="text-end">{t('summary.wealth')}</th>
          </tr>
        </thead>
        <tbody>
          {v.players.map((p) => (
            <tr key={p.id} className={p.id === v.viewer ? 'font-semibold' : ''}>
              <td>{nameOf(v, p.id)}</td>
              <td className="num text-end">{coins(r.y[p.id])}</td>
              <td className="num text-end">{coins(r.W[p.id])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {myE !== undefined && (
        <p className="mt-3 text-sm">
          {t('levels.2.reveal.yourBreakdown', {
            a: lv.myTalent,
            e: myE,
            te: fmt1(L2.BASE_INCOME + L2.TALENT_MULT * lv.myTalent * myE),
            luck: myLuck,
            y: fmt1(r.y[v.viewer]),
          })}
        </p>
      )}
      <MoneyBox>
        {(() => {
          const pool = taxPool(
            v.players.map((p) => r.y[p.id]),
            r.t,
            L2.KAPPA,
          );
          return (
            <>
              {v.players.map((p) => {
                const mine = p.id === v.viewer;
                const vars = { y: fmt1(r.y[p.id]), tax: fmt1(r.t * r.y[p.id]), share: fmt1(pool.share), w: fmt1(r.W[p.id]) };
                return (
                  <MoneyLine key={p.id} mine={mine}>
                    {nameOf(v, p.id)}:{' '}
                    {mine
                      ? t('summary.money.l2', { ...vars, cost: fmt1(L2.EFFORT_COST * myE * myE) })
                      : t('summary.money.l2other', vars)}
                  </MoneyLine>
                );
              })}
              <p className="text-xs text-soft">
                {t('summary.taxWent', { c: fmt1(pool.collected), lost: fmt1(pool.lost), share: fmt1(pool.share) })}
              </p>
            </>
          );
        })()}
      </MoneyBox>
      <ContinueBar />
    </FormCard>
  );
}

function Info({ v }: { v: ViewState }) {
  const lv = v.levelView as L2View;
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold">{t('levels.2.yourTalent', { a: lv.myTalent })}</p>
      {lv.current.t !== undefined && <p>{t('levels.2.taxApplied', { t: Math.round(lv.current.t * 100) })}</p>}
      <p className="text-soft">{t('levels.2.info')}</p>
      <p className="num text-xs text-soft">y = 20 + 4 a e + luck · cost = 0.4 e²</p>
    </div>
  );
}

function Debrief({ v }: { v: ViewState }) {
  const d = (v.levelView as L2View).debrief ?? (v.levelResults[2] as L2Debrief);
  const polls = d.polls;
  const belief = polls.length ? (polls.reduce((a, p) => a + p.answer, 0) / polls.length) * 100 : undefined;
  const truth = polls.length ? (polls.reduce((a, p) => a + p.truth, 0) / polls.length) * 100 : undefined;
  const meanVote = d.humanMeanTaxVote ?? 0;
  let aa = '';
  if (belief !== undefined) {
    const highLuck = belief >= 50;
    const highTax = meanVote >= 0.4;
    const why = t(`debrief.l2.${highLuck ? (highTax ? 'aaWhyHighHigh' : 'aaWhyHighLow') : highTax ? 'aaWhyLowHigh' : 'aaWhyLowLow'}`);
    aa = t(highLuck === highTax ? 'debrief.l2.aaConsistent' : 'debrief.l2.aaInconsistent', { why });
  }
  const ideals = d.bonus?.classification?.map((c: FairnessIdeal) => t(`debrief.l2.ideals.${c}`)).join(' / ');
  const pairs = d.rounds.map((r, i) => `R${i + 1} ${r.effort[v.viewer]} vs ${d.eStar[i][v.viewer]}`).join(', ');
  const rows = v.players.map((p) => {
    const base = d.rounds.length * L2.BASE_INCOME;
    const te = d.rounds.reduce((a, r) => a + L2.TALENT_MULT * d.talents[p.id] * r.effort[p.id], 0);
    const luck = d.rounds.reduce((a, r) => a + r.eps[p.id], 0);
    return { label: `${nameOf(v, p.id)} (a=${d.talents[p.id]})`, parts: [base, te, luck], highlight: p.id === v.viewer };
  });
  return (
    <DebriefShell
      v={v}
      archiveIds={['optimal-taxation', 'median-voter', 'luck-effort', 'fairness-ideals']}
      cardBest={
        d.cardBest && {
          best: t('debrief.choice.taxR1', { t: t(`levels.2.options.T${Math.round(d.cardBest.best * 100)}`) }),
          chose: t('debrief.choice.taxR1', { t: t(`levels.2.options.T${Math.round(d.cardBest.chose * 100)}`) }),
        }
      }
      predicted={
        <>
          <p>{t('debrief.l2.predicted')}</p>
          <p>{t('debrief.l2.predictedT', { t: Math.round(d.predictedT * 100), actual: d.rounds.map((r) => pct(r.t)).join(', ') })}</p>
        </>
      }
      compare={[
        {
          label: t('ui.l2.cmpLabel'),
          benchmark: pct(d.predictedT),
          lab: t('ui.l2.cmpLab'),
          you: pct(meanVote),
          bots: pct(
            d.rounds.flatMap((r) => Object.entries(r.tVotes).filter(([id]) => id !== v.viewer).map(([, x]) => x)).reduce((a, b, _, arr) => a + b / arr.length, 0),
          ),
        },
      ]}
      did={
        <>
          <p>
            {t('debrief.l2.variance', {
              te: Math.round(d.variance.talentEffort * 100),
              lu: Math.round(d.variance.luck * 100),
              ia: Math.round(d.variance.interaction * 100),
            })}
          </p>
          <p>{belief !== undefined ? t('debrief.l2.poll', { belief: Math.round(belief), truth: Math.round(truth!) }) : t('debrief.l2.pollNone')}</p>
          {aa && <p>{aa}</p>}
          <p>{t('debrief.l2.effort', { pairs })}</p>
          <p>
            {t('debrief.l2.distortion', {
              real: coins(d.distortion.realizedW),
              cf: coins(d.distortion.counterfactualW),
              diff: coins(d.distortion.realizedW - d.distortion.counterfactualW),
            })}
          </p>
          {ideals && <p className="font-semibold">{t('debrief.l2.fairness', { ideal: ideals })}</p>}
        </>
      }
      chart={
        <ChartFrame title={t('debrief.l2.chartTitle')} summary={rows.map((r) => t('ui.l2.chartSummary', { name: r.label, base: r.parts[0], te: Math.round(r.parts[1]), luck: r.parts[2] })).join('; ')}>
          <StackedBars rows={rows} partNames={[t('debrief.l2.chartBase'), t('debrief.l2.chartTE'), t('debrief.l2.chartLuck')]} />
        </ChartFrame>
      }
    />
  );
}

function Banner({ v }: { v: ViewState; step: string }) {
  const lv = v.levelView as L2View;
  return <ResultBanner>{t('levels.2.banner.tax', { t: Math.round((lv.current.t ?? 0) * 100) })}</ResultBanner>;
}

export const L2UI: LevelUI = { Decide, Reveal, Info, Debrief, Banner, briefing: (v) => briefingFrom(2, v.round) };
