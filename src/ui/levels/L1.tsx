import { useState } from 'react';
import type { L1Debrief, L1Round } from '../../engine/levels/level1';
import type { PrincipleId } from '../../engine/tax';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { HUMAN_ID, nameOf } from '../game';
import { FlipCard, FormCard, Stamp } from '../components/common';
import { ContinueBar, PrimaryBar } from '../components/TableParts';
import { ChartFrame, GroupedBars } from '../components/Charts';
import { DebriefShell } from '../components/Debrief';
import { briefingFrom, type LevelUI } from './types';

const PS: PrincipleId[] = ['P1', 'P2', 'P3', 'P4'];
type L1View = { rounds: L1Round[]; debrief?: L1Debrief };
const pname = (p: PrincipleId) => t(`levels.1.options.${p}.name`);

function Decide({ v }: { v: ViewState }) {
  const dispatch = useStore((s) => s.dispatch);
  const [choice, setChoice] = useState<PrincipleId | null>(null);
  return (
    <FormCard form={t('levels.1.formTitle')} right={`R${v.round}`}>
      <p className="mb-3 text-sm">{t('levels.1.decide')}</p>
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
      <PrimaryBar>
        <button type="button" className="btn-primary" disabled={!choice} onClick={() => dispatch({ type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: choice })}>
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
        className="h-24 w-full"
        flipped={flipped}
        back={<div className="flex h-full items-center justify-center rounded-md border-2 border-ink bg-ink text-paper">?</div>}
        front={
          <div className="flex h-full flex-col items-center justify-center rounded-md border-2 border-ink bg-card">
            <span className="num text-2xl font-semibold">{value}</span>
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
  const [flipped, setFlipped] = useState(false);
  if (!r) return null;
  return (
    <FormCard form={t('levels.1.reveal.winner')} right={r.tie ? <Stamp>{t('stamps.COINFLIP')}</Stamp> : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="h-display text-2xl">{pname(r.winner)}</h2>
        <Stamp>{t('stamps.ADOPTED')}</Stamp>
      </div>
      <h3 className="label mt-4">{t('levels.1.reveal.votes')}</h3>
      <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
        {v.players.map((p) => (
          <li key={p.id} className="flex justify-between gap-2 border-b border-line/60 py-1">
            <span>{nameOf(v, p.id)}</span>
            <span className="font-semibold">{pname(r.votes[p.id])}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        {t('levels.1.reveal.tax')}: <span className="num font-semibold">{pct(r.t)}</span>
      </p>
      <h3 className="label mt-4">{t('levels.1.reveal.incomes')}</h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {v.players.map((p) => (
          <IncomeCard key={p.id} value={r.incomes[p.id]} owner={nameOf(v, p.id)} flipped={flipped} />
        ))}
      </div>
      {flipped && (
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2" aria-live="polite">
          {v.players.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span>
                {nameOf(v, p.id)} · {t('levels.1.reveal.after')}
              </span>
              <span className="num font-semibold">{coins(r.W[p.id])}</span>
            </li>
          ))}
        </ul>
      )}
      {flipped ? (
        <ContinueBar />
      ) : (
        <PrimaryBar>
          <button type="button" className="btn-primary" onClick={() => setFlipped(true)}>
            {t('levels.1.reveal.incomes')}
          </button>
        </PrimaryBar>
      )}
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
      archiveIds={['veil', 'maximin', 'expected-utility', 'leaky-bucket']}
      predicted={<p>{t('debrief.l1.predicted')}</p>}
      compare={[
        {
          label: t('levels.1.reveal.winner'),
          benchmark: `${pname(d.benchmark.harsanyi)} / ${pname(d.benchmark.rawls)}`,
          lab: pname(d.benchmark.lab),
          you: main ? pname(main) : '',
          bots: botMain ? pname(botMain) : '',
        },
      ]}
      did={
        <>
          <p>{t('debrief.l1.yourVotes', { votes: myVotes.map(pname).join(', ') })}</p>
          <p>{price > 0.01 ? t('debrief.l1.price', { p: pname(main), x: price.toFixed(1) }) : t('debrief.l1.priceZero')}</p>
          <p>{tease}</p>
          <div className="overflow-x-auto">
            <div className="label mt-2">{t('debrief.l1.actualTitle')}</div>
            {d.rounds.map((r, i) => (
              <table key={i} className="data-table mt-2">
                <thead>
                  <tr>
                    <th>R{i + 1}: {t('debrief.l1.colPrinciple')}</th>
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
                      <td className="num text-end">{r.byPrinciple[p].avg.toFixed(1)}</td>
                      <td className="num text-end">{r.byPrinciple[p].min.toFixed(1)}</td>
                      <td className="num text-end">{r.byPrinciple[p].range.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </>
      }
      chart={
        <ChartFrame
          title={t('debrief.l1.chartTitle')}
          summary={PS.map((p) => t('ui.l1.summary', { name: pname(p), avg: d.expected[p].avg.toFixed(1), min: d.expected[p].min.toFixed(1) })).join('; ')}
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
