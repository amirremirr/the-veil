import { useState } from 'react';
import type { CfScenario, Group, L4Debrief, L4Round, Policy, Priors, Schedule } from '../../engine/levels/level4';
import { L4 } from '../../engine/params';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct, signed } from '../labels';
import { HUMAN_ID, nameOf } from '../game';
import { FormCard, ResultBanner, Shape, Stamp } from '../components/common';
import { ContinueBar, PrimaryBar } from '../components/TableParts';
import { ChartFrame, LineChart, StackedBars } from '../components/Charts';
import { DebriefShell } from '../components/Debrief';
import { briefingFrom, type LevelUI } from './types';

const POLICIES: Policy[] = ['A', 'B', 'C', 'D'];
type L4View = {
  groups: Record<string, Group>;
  care: Record<string, boolean>;
  priors: Priors;
  policy: Policy;
  policyVotes?: Record<string, Policy>;
  policyTie?: boolean;
  myCost?: number;
  current?: Partial<L4Round>;
  rounds: Partial<L4Round>[];
  debrief?: L4Debrief;
};
const pname = (p: Policy) => t(`levels.4.policies.${p}.name`);

function Submit({ label, decision, disabled }: { label: string; decision: unknown; disabled?: boolean }) {
  const act = useStore((s) => s.act);
  return (
    <PrimaryBar>
      <button type="button" className="btn-primary" disabled={disabled} onClick={() => act(decision)}>
        {label}
      </button>
    </PrimaryBar>
  );
}

function InvestForm({ v }: { v: ViewState }) {
  const lv = v.levelView as L4View;
  const [x, setX] = useState<boolean | null>(null);
  const c = lv.myCost ?? 0;
  return (
    <FormCard form={t('levels.4.investTitle')} right={`R${v.round}`}>
      <p className="mb-3 text-sm">{t('levels.4.investDecide', { c })}</p>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={t('levels.4.investTitle')}>
        <button type="button" aria-pressed={x === true} className="choice" onClick={() => setX(true)}>
          {t('levels.4.investYes', { c })}
        </button>
        <button type="button" aria-pressed={x === false} className="choice" onClick={() => setX(false)}>
          {t('levels.4.investNo')}
        </button>
      </div>
      <Submit label={t('levels.4.investSubmit')} decision={x} disabled={x === null} />
    </FormCard>
  );
}

function ScheduleForm({ v }: { v: ViewState }) {
  const lv = v.levelView as L4View;
  const [x, setX] = useState<Schedule | null>(null);
  const care = lv.care[HUMAN_ID];
  const chaos = lv.policy === 'D' ? L4.CHAOS_COST_SUBSIDIZED : L4.CHAOS_COST;
  return (
    <FormCard form={t('levels.4.scheduleTitle')}>
      <p className="mb-3 text-sm">{t('levels.4.scheduleDecide')}</p>
      <div className="space-y-2" role="group" aria-label={t('levels.4.scheduleTitle')}>
        <button type="button" aria-pressed={x === 'GREEDY'} className="choice" onClick={() => setX('GREEDY')}>
          {care ? t('levels.4.greedyCare', { chaos }) : t('levels.4.greedy')}
        </button>
        <button type="button" aria-pressed={x === 'FLEX'} className="choice" onClick={() => setX('FLEX')}>
          {t('levels.4.flex')}
        </button>
      </div>
      <Submit label={t('levels.4.scheduleSubmit')} decision={x} disabled={!x} />
    </FormCard>
  );
}

function PolicyForm() {
  const [x, setX] = useState<Policy | null>(null);
  return (
    <FormCard form={t('levels.4.policyTitle')}>
      <p className="mb-3 text-sm">{t('levels.4.policyDecide')}</p>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={t('levels.4.policyTitle')}>
        {POLICIES.map((p) => (
          <button key={p} type="button" aria-pressed={x === p} className="choice" onClick={() => setX(p)}>
            <span>
              <span className="block font-semibold">{pname(p)}</span>
              <span className="block text-sm text-soft">{t(`levels.4.policies.${p}.desc`)}</span>
            </span>
          </button>
        ))}
      </div>
      <Submit label={t('levels.4.policySubmit')} decision={x} disabled={!x} />
    </FormCard>
  );
}

function Decide({ v }: { v: ViewState }) {
  if (v.phase.step === 'INVEST') return <InvestForm v={v} />;
  if (v.phase.step === 'SCHEDULE') return <ScheduleForm v={v} />;
  return <PolicyForm />;
}

function Report({ priors, policy }: { priors: Priors; policy: Policy }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="label">{t('levels.4.report')}</div>
      {(['CIRCLE', 'SQUARE'] as Group[]).map((g) => (
        <div key={g} className="flex items-center gap-2">
          <Shape group={g} />
          <span className="flex-1">{t('levels.4.reportBelief', { g: t(`levels.4.groups.${g}`) })}</span>
          <span className="num font-semibold">{pct(priors[g])}</span>
        </div>
      ))}
      {policy === 'B' && priors.POOL !== null && (
        <div className="flex items-center justify-between">
          <span>{t('levels.4.reportPool')}</span>
          <span className="num font-semibold">{pct(priors.POOL)}</span>
        </div>
      )}
      <p className="text-soft">{t('levels.4.reportThreshold')}</p>
      <p>
        {pname(policy)}: <span className="text-soft">{t(`levels.4.policies.${policy}.desc`)}</span>
      </p>
    </div>
  );
}

function Reveal({ v }: { v: ViewState }) {
  const lv = v.levelView as L4View;
  if (v.phase.step === 'POLICY') {
    return (
      <FormCard form={t('levels.4.reveal.policyTitle')} right={lv.policyTie ? <Stamp>{t('stamps.COINFLIP')}</Stamp> : undefined}>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {v.players.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 border-b border-line/60 py-1">
              <span>{nameOf(v, p.id)}</span>
              <span className="font-semibold">{lv.policyVotes?.[p.id] ? pname(lv.policyVotes[p.id]) : ''}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="h-display text-2xl">{pname(lv.policy)}</span>
          <Stamp>{t('stamps.ADOPTED')}</Stamp>
        </div>
        <ContinueBar />
      </FormCard>
    );
  }
  const c = lv.current;
  if (!c) return null;
  const pay = v.phase.step === 'PAY';
  return (
    <FormCard form={pay ? t('levels.4.reveal.payTitle') : t('levels.4.reveal.assignTitle')}>
      <ul className="space-y-2">
        {v.players.map((p) => {
          const complex = c.job?.[p.id] === 'COMPLEX';
          return (
            <li key={p.id} className="rounded-md border border-line p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  <Shape group={lv.groups[p.id]} /> {nameOf(v, p.id)}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`font-mono text-xs ${c.pass?.[p.id] ? 'text-good' : 'text-stamp'}`}>
                    {c.pass?.[p.id] ? t('levels.4.reveal.pass') : t('levels.4.reveal.fail')}
                  </span>
                  <Stamp tone={complex ? 'good' : 'ink'} rotate={-3} small>
                    {complex ? t('table.statusComplex') : t('table.statusSimple')}
                  </Stamp>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-soft">
                <span>{t('levels.4.reveal.confidence', { q: Math.round((c.q?.[p.id] ?? 0) * 100) })}</span>
                {c.quotaPicks?.includes(p.id) && <span className="text-amber">{t('levels.4.reveal.quota')}</span>}
                {pay && c.invest && <span>{c.invest[p.id] ? t('levels.4.reveal.skilled') : t('levels.4.reveal.unskilled')}</span>}
                {pay && c.schedule?.[p.id] && <span>{c.schedule[p.id] === 'GREEDY' ? t('ui.l4.greedy') : t('ui.l4.flex')}</span>}
                {pay && c.W && <span className="num text-ink">{t('ui.wealthShort')} {coins(c.W[p.id])}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {pay && c.priorsAfter && (
        <p className="mt-3 text-sm">
          {lv.policy === 'B' && c.priorsAfter.POOL !== null
            ? t('levels.4.reveal.poolUpdate', { pp: Math.round(c.priorsAfter.POOL * 100) })
            : t('levels.4.reveal.beliefUpdate', { pc: Math.round(c.priorsAfter.CIRCLE * 100), ps: Math.round(c.priorsAfter.SQUARE * 100) })}
        </p>
      )}
      <ContinueBar />
    </FormCard>
  );
}

function Info({ v }: { v: ViewState }) {
  const lv = v.levelView as L4View;
  return (
    <div className="space-y-3">
      <Report priors={lv.priors} policy={lv.policy} />
      <p className="text-sm">
        <Shape group={lv.groups[HUMAN_ID]} /> {t(`levels.4.groups.${lv.groups[HUMAN_ID]}`)}
        {lv.care[HUMAN_ID] ? ` · ${t('levels.4.care')}` : ''}
      </p>
    </div>
  );
}

function Debrief({ v }: { v: ViewState }) {
  const d = (v.levelView as L4View).debrief ?? (v.levelResults[4] as L4Debrief);
  const cf = d.counterfactual;
  const myGroup = d.groups[HUMAN_ID];
  const invested = d.rounds.filter((r) => r.invest[HUMAN_ID]).length;
  const scen = (k: CfScenario['key']) => cf?.scenarios.find((s) => s.key === k);
  const rounds = d.piPath.SQUARE.map((_, i) => (i === 0 ? t('ui.l4.start') : `R${i}`));
  return (
    <DebriefShell
      v={v}
      archiveIds={['statistical-discrimination', 'self-fulfilling-stereotypes', 'greedy-jobs', 'patronizing-equilibrium']}
      predicted={
        <>
          <p>{t('debrief.l4.predicted')}</p>
          <p className="font-semibold">{t('debrief.l4.punchline')}</p>
          <p className="text-soft">{t('debrief.l4.realWorld')}</p>
        </>
      }
      compare={[
        {
          label: t('ui.l4.cmpLabel'),
          benchmark: t('ui.l4.cmpBench'),
          lab: t('ui.l4.cmpLab'),
          you: `${invested}/5`,
          bots: `${pct(d.investRate.CIRCLE)} / ${pct(d.investRate.SQUARE)}`,
        },
      ]}
      did={
        <>
          <p>{t('debrief.l4.you', { g: t(`levels.4.groups.${myGroup}`), care: d.care[HUMAN_ID] ? t('ui.l4.careHolder') : '', k: invested })}</p>
          <p>{t('debrief.l4.gap', { gap: signed(d.gap) })}</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('ui.l4.round')}</th>
                <th className="text-end">{t('levels.4.groups.CIRCLE')}</th>
                <th className="text-end">{t('levels.4.groups.SQUARE')}</th>
                <th className="text-end">{t('ui.l4.gap')}</th>
              </tr>
            </thead>
            <tbody>
              {d.meanByGroup.map((m, i) => (
                <tr key={i}>
                  <td>R{i + 1}{i >= L4.BASELINE_ROUNDS ? ` (${pname(d.policy)})` : ''}</td>
                  <td className="num text-end">{Math.round(m.CIRCLE)}</td>
                  <td className="num text-end">{Math.round(m.SQUARE)}</td>
                  <td className="num text-end">{signed(m.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      }
      chart={
        <ChartFrame title={t('debrief.l4.chartTitle')} summary={t('ui.l4.summary', { path: d.piPath.SQUARE.map((x) => x.toFixed(2)).join(', ') })}>
          <LineChart
            xLabels={rounds}
            series={[
              { name: t('levels.4.groups.CIRCLE'), values: d.piPath.CIRCLE },
              { name: t('levels.4.groups.SQUARE'), values: d.piPath.SQUARE },
              ...(d.piPath.POOL.some((x) => x !== null) ? [{ name: t('levels.4.reportPool'), values: d.piPath.POOL, dashed: true }] : []),
            ]}
            yMin={0}
            yMax={1}
            refLine={{ value: 0.36, label: t('ui.l4.threshold') }}
          />
        </ChartFrame>
      }
      extra={
        cf && (
          <FormCard form={t('debrief.l4.decompTitle')}>
            <p className="mb-3 text-sm">{t('debrief.l4.decompExplain', { k: cf.average.replays })}</p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('debrief.l4.colChannel')}</th>
                    <th className="text-end">{t('debrief.l4.colSame')}</th>
                    <th className="text-end">{t('debrief.l4.colAvg', { k: cf.average.replays })}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t('debrief.l4.baselineGap')}</td>
                    <td className="num text-end">{signed(scen('BASELINE')?.gap ?? 0)}</td>
                    <td className="num text-end">{signed(scen('BASELINE')?.avgGap ?? 0)}</td>
                  </tr>
                  {(['stereotype', 'care', 'interaction', 'total'] as const).map((k) => (
                    <tr key={k} className={k === 'total' ? 'font-semibold' : ''}>
                      <td>{t(`debrief.l4.${k}`)}</td>
                      <td className="num text-end">{signed(cf.sameSeed[k])}</td>
                      <td className="num text-end">{signed(cf.average[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <ChartFrame
                title={t('debrief.l4.chartGapTitle')}
                summary={t('ui.l4.gapSummary', { s: cf.average.stereotype.toFixed(1), c: cf.average.care.toFixed(1), i: cf.average.interaction.toFixed(1) })}
              >
                <StackedBars
                  rows={(['stereotype', 'care', 'interaction'] as const).map((k) => ({ label: t(`debrief.l4.${k}`), parts: [cf.average[k]] }))}
                  partNames={[t('debrief.l4.colAvg', { k: cf.average.replays })]}
                  format={(x) => String(Math.round(x))}
                />
              </ChartFrame>
            </div>
          </FormCard>
        )
      }
    />
  );
}

function Banner({ v, step }: { v: ViewState; step: string }) {
  const lv = v.levelView as L4View;
  if (step === 'POLICY')
    return (
      <ResultBanner>
        {t('levels.4.banner.policy', { name: pname(lv.policy) })}
        {lv.policyTie && <span className="block font-normal text-soft">{t('levels.1.reveal.tieLine')}</span>}
      </ResultBanner>
    );
  const c = lv.current;
  if (step === 'ASSIGN' && c?.job?.[HUMAN_ID] === 'COMPLEX')
    return <ResultBanner>{t('levels.4.banner.assign', { q: Math.round((c.q?.[HUMAN_ID] ?? 0) * 100) })}</ResultBanner>;
  return null;
}

export const L4UI: LevelUI = { Decide, Reveal, Info, Debrief, Banner, briefing: (v) => briefingFrom(4, v.round) };
