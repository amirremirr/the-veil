import { useEffect, useState } from 'react';
import type { L1Debrief, L1Round } from '../../engine/levels/level1';
import type { PrincipleId } from '../../engine/tax';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { pct } from '../labels';
import { HUMAN_ID, nameOf, shortName } from '../game';
import { FlipCard, FormCard, Stamp, Tip, useMotionOff } from '../components/common';
import { ContinueBar, PrimaryBar } from '../components/TableParts';
import { ChartFrame, GroupedBars } from '../components/Charts';
import { DebriefShell } from '../components/Debrief';
import { briefingFrom, type LevelUI } from './types';
import { L1 } from '../../engine/params';
import { MoneyBox, MoneyLine, TaxInfo, fmt1, taxPool } from '../components/Money';

const PS: PrincipleId[] = ['P1', 'P2', 'P3', 'P4'];
type L1View = { rounds: L1Round[]; debrief?: L1Debrief };
const pname = (p: PrincipleId) => t(`levels.1.options.${p}.name`);

function Decide({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [choice, setChoice] = useState<PrincipleId | null>(null);
  return (
    <FormCard form={t('levels.1.formTitle')} right={`R${v.round}`}>
      <p className="mb-3 text-sm">{t('levels.1.decide')}</p>
      <TaxInfo>
        <p className="font-semibold">{t('levels.1.setAfter')}</p>
        <p>{t('taxInfo.money')}</p>
        <p>{t('taxInfo.lossExample')}</p>
      </TaxInfo>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={t('levels.1.formTitle')}>
        {PS.map((p) => (
          <button key={p} type="button" aria-pressed={choice === p} className="choice" onClick={() => setChoice(p)}>
            <span className="num mt-0.5 text-soft">{p}</span>
            <span>
              <span className="block font-semibold">{pname(p)}</span>
              <span className="block text-sm text-soft">{t(`levels.1.options.${p}.rule`)}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="label mt-3">{t('levels.1.deckNote')}</p>
      {v.round === 1 && <Tip id="decide" text={t('tips.decide')} />}
      <PrimaryBar>
        <button type="button" className="btn-primary" disabled={!choice} onClick={() => act(choice)}>
          {t('levels.1.submit')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

function IncomeCard({ value, owner, flipped }: { value: number; owner: string; flipped: boolean }) {
  return (
    <div>
      <FlipCard
        className="h-16 w-full"
        flipped={flipped}
        back={<div className="flex h-full items-center justify-center rounded-md border-2 border-ink bg-ink text-paper">?</div>}
        front={
          <div className="flex h-full flex-col items-center justify-center rounded-md border-2 border-ink bg-card">
            <span className="num text-xl font-semibold">{value}</span>
            <span className="label">{t('ui.coins')}</span>
          </div>
        }
      />
      <div className="mt-1 truncate text-center text-xs">{owner}</div>
    </div>
  );
}

function Reveal({ v }: { v: ViewState }) {
  const lv = v.levelView as L1View;
  const r = lv.rounds[lv.rounds.length - 1];
  const off = useMotionOff();
  const [flipped, setFlipped] = useState(off);
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), off ? 0 : 450);
    return () => clearTimeout(id);
  }, [off]);
  if (!r) return null;
  return (
    <FormCard form={t('levels.1.reveal.winner')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="h-display text-2xl">{pname(r.winner)}</h2>
          {r.tie && <p className="text-sm text-soft">{t('levels.1.reveal.tieLine')}</p>}
          <p className="mt-1 text-sm">
            {t('levels.1.reveal.tax')}: <span className="num font-semibold">{pct(r.t)}</span>
          </p>
        </div>
        <Stamp>{t('stamps.ADOPTED')}</Stamp>
      </div>
      <h3 className="label mt-3">{t('levels.1.reveal.incomes')}</h3>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {v.players.map((p) => (
          <IncomeCard key={p.id} value={r.incomes[p.id]} owner={shortName(v, p.id)} flipped={flipped} />
        ))}
      </div>
      <h3 className="label mt-3">{t('levels.1.reveal.votes')}</h3>
      <ul className="mt-1 grid gap-x-4 text-sm sm:grid-cols-2">
        {v.players.map((p) => (
          <li key={p.id} className="flex justify-between gap-2 border-b border-line/60 py-0.5">
            <span>{nameOf(v, p.id)}</span>
            <span className="font-semibold">{pname(r.votes[p.id])}</span>
          </li>
        ))}
      </ul>
      {flipped && (
        <MoneyBox>
          {(() => {
            const pool = taxPool(
              v.players.map((p) => r.incomes[p.id]),
              r.t,
              L1.KAPPA,
            );
            const y = r.incomes[HUMAN_ID];
            return (
              <>
                <MoneyLine mine>
                  {t('summary.money.l1', { y, tax: fmt1(r.t * y), share: fmt1(pool.share), w: fmt1(r.W[HUMAN_ID]) })}
                </MoneyLine>
                <p className="text-xs text-soft">
                  {t('summary.taxWent', { c: fmt1(pool.collected), lost: fmt1(pool.lost), share: fmt1(pool.share) })}
                </p>
              </>
            );
          })()}
        </MoneyBox>
      )}
      <ContinueBar />
    </FormCard>
  );
}

function Info() {
  return (
    <div className="space-y-2 text-sm">
      {PS.map((p) => (
        <div key={p}>
          <span className="font-semibold">{pname(p)}</span>: <span className="text-soft">{t(`levels.1.options.${p}.rule`)}</span>
        </div>
      ))}
      <p className="text-soft">{t('levels.1.deckNote')}</p>
      <p className="text-soft">{t('levels.1.info')}</p>
    </div>
  );
}

/** What each principle would have produced, one round at a time. */
function RoundTabs({ d }: { d: L1Debrief }) {
  const [k, setK] = useState(0);
  const r = d.rounds[k];
  if (!r) return null;
  return (
    <div>
      <div className="label mt-2">{t('debrief.l1.actualTitle')}</div>
      <div className="mt-2 flex gap-1" role="tablist" aria-label={t('debrief.l1.actualTitle')}>
        {d.rounds.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === k}
            className={`btn min-h-[36px] px-4 py-1 text-sm ${i === k ? 'border-ink bg-ink text-paper' : 'border-line bg-card'}`}
            onClick={() => setK(i)}
          >
            R{i + 1}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto" role="tabpanel">
        <table className="data-table mt-2">
          <thead>
            <tr>
              <th>{t('debrief.l1.colPrinciple')}</th>
              <th className="text-end">{t('debrief.l1.colTax')}</th>
              <th className="text-end">{t('debrief.l1.colAvg')}</th>
              <th className="text-end">{t('debrief.l1.colMin')}</th>
              <th className="text-end">{t('debrief.l1.colRange')}</th>
            </tr>
          </thead>
          <tbody>
            {PS.map((p) => (
              <tr key={p} className={p === r.winner ? 'font-semibold' : ''}>
                <td>{pname(p)}</td>
                <td className="num text-end">{pct(r.byPrinciple[p].t)}</td>
                <td className="num text-end">{Math.round(r.byPrinciple[p].avg)}</td>
                <td className="num text-end">{Math.round(r.byPrinciple[p].min)}</td>
                <td className="num text-end">{Math.round(r.byPrinciple[p].range)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Debrief({ v }: { v: ViewState }) {
  const d = (v.levelView as L1View).debrief ?? (v.levelResults[1] as L1Debrief);
  const myVotes = d.rounds.map((r) => r.votes[HUMAN_ID]).filter(Boolean);
  const counts = PS.map((p) => myVotes.filter((x) => x === p).length);
  const main = PS[counts.indexOf(Math.max(...counts))];
  const botVotes = d.rounds.flatMap((r) => Object.entries(r.votes).filter(([id]) => id !== HUMAN_ID).map(([, p]) => p));
  const botMain = PS.map((p) => [p, botVotes.filter((x) => x === p).length] as const).sort((a, b) => b[1] - a[1])[0]?.[0];
  const price = d.priceOfInsurance[main] ?? 0;
  const tease = new Set(myVotes).size > 1 ? t('debrief.l1.teaseMix') : main === 'P1' ? t('debrief.l1.teaseEgo') : t('debrief.l1.teaseRisk');
  return (
    <DebriefShell
      v={v}
      archiveIds={['veil', 'maximin', 'hardship-line', 'expected-utility', 'leaky-bucket']}
      cardBest={d.cardBest && { best: pname(d.cardBest.best), chose: d.cardBest.chose.map(pname).join(', ') }}
      predicted={<p>{t('debrief.l1.predicted')}</p>}
      compare={[
        {
          label: t('levels.1.reveal.winner'),
          benchmark: (
            <>
              <span className="block">{t('debrief.l1.theoryAverage', { p: pname(d.benchmark.harsanyi) })}</span>
              <span className="mt-1 block">{t('debrief.l1.theoryPoorest', { p: pname(d.benchmark.rawls) })}</span>
            </>
          ),
          lab: pname(d.benchmark.lab),
          you: main ? pname(main) : '',
          bots: botMain ? pname(botMain) : '',
        },
      ]}
      did={
        <>
          <p>{t('debrief.l1.yourVotes', { votes: myVotes.map(pname).join(', ') })}</p>
          <p>{price > 0.01 ? t('debrief.l1.price', { p: pname(main), x: Math.round(price) }) : t('debrief.l1.priceZero')}</p>
          <p>{tease}</p>
          <RoundTabs d={d} />
        </>
      }
      chart={
        <ChartFrame
          title={t('debrief.l1.chartTitle')}
          summary={PS.map((p) => t('ui.l1.summary', { name: pname(p), avg: Math.round(d.expected[p].avg), min: Math.round(d.expected[p].min) })).join('; ')}
        >
          <GroupedBars
            categories={PS.map(pname)}
            series={[
              { name: t('debrief.l1.chartAvg'), values: PS.map((p) => d.expected[p].avg) },
              { name: t('debrief.l1.chartMin'), values: PS.map((p) => d.expected[p].min) },
              { name: t('debrief.l1.chartOwn'), values: PS.map((p) => d.expected[p].own) },
            ]}
          />
        </ChartFrame>
      }
    />
  );
}

export const L1UI: LevelUI = {
  Decide,
  Reveal,
  Info,
  Debrief,
  briefing: (v) => briefingFrom(1, v.round),
};
