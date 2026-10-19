import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AmendmentRecord, Constitution, L5Debrief, Lobby } from '../../engine/levels/level5';
import { constitutionWealth, supermajority } from '../../engine/levels/level5';
import { orderedDraws } from '../../engine/core';
import { L5 } from '../../engine/params';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, constitutionLabel, signed } from '../labels';
import { nameOf, shortName } from '../game';
import { FlipCard, FormCard, Stamp, useMotionOff } from '../components/common';
import { ContinueBar, PrimaryBar } from '../components/TableParts';
import { ChartFrame, GroupedBars, Scatter } from '../components/Charts';
import { DebriefShell } from '../components/Debrief';
import type { LevelUI } from './types';
import { floorTopUpParts } from '../../engine/tax';
import { MoneyBox, MoneyLine, TaxInfo, fmt1, lossLine } from '../components/Money';

type L5View = {
  veil?: Record<string, Constitution>;
  adopted?: Constitution;
  current?: Constitution;
  incomes?: Record<string, number>;
  incomesRevealed: boolean;
  lobby?: Record<string, Lobby>;
  order: string[];
  amendments: AmendmentRecord[];
  W?: Record<string, number>;
  myFair1?: number;
  myFair2?: number;
  myIncome?: number;
  debrief?: L5Debrief;
};

function ConstitutionPicker({ value, onChange }: { value: Constitution; onChange: (c: Constitution) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset>
        <legend className="label mb-1">{t('levels.5.tax')}</legend>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label={t('levels.5.tax')}>
          {L5.TAX_OPTIONS.map((x) => (
            <button key={x} type="button" aria-pressed={Math.abs(value.t - x) < 1e-9} className="choice justify-center px-1 py-2" onClick={() => onChange({ ...value, t: x })}>
              <span className="num">{Math.round(x * 100)}%</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label mb-1">{t('levels.5.floor')}</legend>
        <div className="grid grid-cols-2 gap-1" role="group" aria-label={t('levels.5.floor')}>
          {L5.FLOOR_OPTIONS.map((F) => (
            <button key={F} type="button" aria-pressed={value.F === F} className="choice justify-center px-1 py-2" onClick={() => onChange({ ...value, F })}>
              <span className="num">{F}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function VeilForm({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [c, setC] = useState<Constitution>({ t: 0.3, F: 25 });
  const n = v.players.length;
  const preview = useMemo(() => {
    const draws = orderedDraws(L5.INCOME_DECK, n);
    let avg = 0;
    let min = 0;
    let own = 0;
    for (const d of draws) {
      const W = constitutionWealth(d, c);
      avg += W.reduce((a, b) => a + b, 0) / n;
      min += Math.min(...W);
      own += W[0];
    }
    return { avg: avg / draws.length, min: min / draws.length, own: own / draws.length };
  }, [c, n]);
  return (
    <FormCard form={t('levels.5.veilTitle')}>
      <p className="mb-3 text-sm">{t('levels.5.veilDecide')}</p>
      <TaxInfo>
        <p>{t(n % 2 === 0 ? 'levels.5.medianRule.even' : 'levels.5.medianRule.odd', { n })}</p>
        <p>{t('levels.5.separate')}</p>
        <p>{t('taxInfo.moneyL5')}</p>
        <p className="font-semibold">{lossLine(c.t, L5.KAPPA)}</p>
      </TaxInfo>
      <ConstitutionPicker value={c} onChange={setC} />
      <div className="mt-4 rounded-md border border-line p-3 text-sm">
        <p className="text-soft">{t('levels.5.veilPreview')}</p>
        <dl className="mt-1 grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="label">{t('debrief.l1.colAvg')}</dt>
            <dd className="num text-lg">{Math.round(preview.avg)}</dd>
          </div>
          <div>
            <dt className="label">{t('debrief.l1.colMin')}</dt>
            <dd className="num text-lg">{Math.round(preview.min)}</dd>
          </div>
          <div>
            <dt className="label">{t('debrief.l1.chartOwn')}</dt>
            <dd className="num text-lg">{Math.round(preview.own)}</dd>
          </div>
        </dl>
      </div>
      <PrimaryBar>
        <button type="button" className="btn-primary" onClick={() => act(c)}>
          {t('levels.5.veilSubmit')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

function LobbyForm({ v }: { v: ViewState }) {
  const lv = v.levelView as L5View;
  const act = useStore((s) => s.act);
  const cur = lv.current!;
  const [to, setTo] = useState<string>('');
  const [amount, setAmount] = useState(0);
  const [proposing, setProposing] = useState(false);
  const [prop, setProp] = useState<Constitution>({ ...cur });
  const ids = v.players.map((p) => p.id);
  const inc = ids.map((id) => lv.incomes![id]);
  const me = ids.indexOf(v.viewer);
  const wCur = constitutionWealth(inc, cur)[me];
  const wNew = constitutionWealth(inc, prop)[me];
  const decision: Lobby = { donateTo: to && amount > 0 ? to : null, amount: to ? amount : 0, proposal: proposing ? prop : null };
  return (
    <FormCard form={t('levels.5.lobbyTitle')} right={`${t('levels.5.current')}: ${constitutionLabel(cur)}`}>
      <p className="mb-3 text-sm">{t('levels.5.lobbyDecide')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">{t('levels.5.donateTo')}</span>
          <select className="mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-2" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{t('levels.5.nobody')}</option>
            {v.players
              .filter((p) => p.id !== v.viewer)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t('levels.5.amount')}</span>
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={L5.DONATION_MAX} value={amount} disabled={!to} onChange={(e) => setAmount(Number(e.target.value))} className="h-11 w-full" />
            <span className="num w-8 text-end">{to ? amount : 0}</span>
          </div>
        </label>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label={t('levels.5.propose')}>
        <button type="button" aria-pressed={!proposing} className="choice" onClick={() => setProposing(false)}>
          {t('levels.5.pass')}
        </button>
        <button type="button" aria-pressed={proposing} className="choice" onClick={() => setProposing(true)}>
          {t('levels.5.propose')}
        </button>
      </div>
      {proposing && (
        <div className="mt-3">
          <ConstitutionPicker value={prop} onChange={setProp} />
          <p className="mt-2 text-sm">{t('levels.5.amendEffect', { cur: coins(wCur), new: coins(wNew) })}</p>
        </div>
      )}
      <PrimaryBar>
        <button type="button" className="btn-primary" onClick={() => act(decision)}>
          {t('levels.5.lobbySubmit')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

function AmendForm({ v }: { v: ViewState }) {
  const lv = v.levelView as L5View;
  const act = useStore((s) => s.act);
  const k = Number(v.phase.step!.slice(6));
  const proposer = lv.order[k];
  const prop = lv.lobby![proposer].proposal!;
  const cur = lv.current!;
  const ids = v.players.map((p) => p.id);
  const inc = ids.map((id) => lv.incomes![id]);
  const me = ids.indexOf(v.viewer);
  return (
    <FormCard form={t('levels.5.amendTitle', { k: k + 1, total: lv.order.length })}>
      {lv.amendments.length > 0 && <AmendmentLog v={v} list={lv.amendments} />}
      <p className="mb-2 text-sm">
        {t(proposer === v.viewer ? 'levels.5.amendDecideYou' : 'levels.5.amendDecide', {
          name: nameOf(v, proposer),
          from: constitutionLabel(cur),
          to: constitutionLabel(prop),
          need: supermajority(ids.length),
        })}
      </p>
      <p className="text-sm text-soft">
        {t('levels.5.amendEffect', { cur: coins(constitutionWealth(inc, cur)[me]), new: coins(constitutionWealth(inc, prop)[me]) })}
      </p>
      <PrimaryBar>
        <button type="button" className="btn-ghost" onClick={() => act(false)}>
          {t('levels.5.amendNo')}
        </button>
        <button type="button" className="btn-primary" onClick={() => act(true)}>
          {t('levels.5.amendYes')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

/** The unpaid question (D-40): it never changes anyone's score or the rules. */
function FairForm({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<number | null>(null);
  const after = v.phase.step === 'FAIR_2';
  return (
    <FormCard form={t('levels.5.fairTitle')}>
      <p className="mb-2 font-semibold">{t(after ? 'levels.5.fairAsk2' : 'levels.5.fairAsk1')}</p>
      <p className="mb-3 rounded-md border-2 border-teal bg-teal/10 px-3 py-2 text-sm">{t('levels.5.fairNote')}</p>
      <div className="grid grid-cols-3 gap-1" role="group" aria-label={t('levels.5.fairTitle')}>
        {L5.TAX_OPTIONS.map((o) => (
          <button key={o} type="button" aria-pressed={x !== null && Math.abs(x - o) < 1e-9} className="choice justify-center px-1 py-2" onClick={() => setX(o)}>
            <span className="num">{Math.round(o * 100)}%</span>
          </button>
        ))}
      </div>
      <PrimaryBar>
        <button type="button" className="btn-primary" disabled={x === null} onClick={() => act(x)}>
          {t('levels.5.fairSubmit')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

function AmendmentLog({ v, list }: { v: ViewState; list: AmendmentRecord[] }) {
  return (
    <ol className="mb-4 space-y-2 text-sm">
      {list.map((a, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-2">
          {a.withdrawn ? (
            <span>
              {nameOf(v, a.proposer)}: {constitutionLabel(a.proposal)}. <span className="text-soft">{t('levels.5.reveal.withdrawn')}</span>
            </span>
          ) : (
            <>
              <span>
                {nameOf(v, a.proposer)}: {constitutionLabel(a.statusQuo)} → {constitutionLabel(a.proposal)} ·{' '}
                {t('levels.5.reveal.yesNeed', { yes: a.yes, need: supermajority(v.players.length) })}
              </span>
              <Stamp tone={a.passed ? 'good' : 'stamp'} rotate={-3} small>
                {a.passed ? t('stamps.PASSED') : t('stamps.FAILED')}
              </Stamp>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

function Decide({ v }: { v: ViewState }) {
  if (v.phase.step === 'VEIL') return <VeilForm v={v} />;
  if (v.phase.step === 'LOBBY') return <LobbyForm v={v} />;
  if (v.phase.step === 'FAIR_1' || v.phase.step === 'FAIR_2') return <FairForm v={v} />;
  return <AmendForm v={v} />;
}

function Reveal({ v }: { v: ViewState }) {
  const lv = v.levelView as L5View;
  const off = useMotionOff();
  const [flipped, setFlipped] = useState(off);
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), off ? 0 : 450);
    return () => clearTimeout(id);
  }, [off]);
  if (v.phase.step === 'CONSTITUTION') {
    return (
      <FormCard form={t('levels.5.reveal.constitutionTitle')}>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {v.players.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 border-b border-line/60 py-1">
              <span>{nameOf(v, p.id)}</span>
              <span className="num">{lv.veil ? constitutionLabel(lv.veil[p.id]) : ''}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="h-display text-2xl">{lv.adopted && constitutionLabel(lv.adopted)}</span>
          <Stamp>{t('stamps.ADOPTED')}</Stamp>
        </div>
        <ContinueBar />
      </FormCard>
    );
  }
  if (v.phase.step === 'INCOMES') {
    // The adopted constitution (its own screen was folded into this one) and the income flip.
    return (
      <FormCard form={t('levels.5.reveal.constitutionTitle')}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-display text-2xl">{lv.adopted && constitutionLabel(lv.adopted)}</span>
          <Stamp>{t('stamps.ADOPTED')}</Stamp>
        </div>
        <ul className="mt-2 grid gap-x-4 text-sm sm:grid-cols-2">
          {v.players.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 border-b border-line/60 py-0.5">
              <span>{nameOf(v, p.id)}</span>
              <span className="num">{lv.veil ? constitutionLabel(lv.veil[p.id]) : ''}</span>
            </li>
          ))}
        </ul>
        <h3 className="label mt-4">{t('levels.5.reveal.incomesTitle')}</h3>
        <p className="mb-2 text-sm">{t('levels.5.reveal.incomesNote')}</p>
        <div className="grid grid-cols-4 gap-2">
          {v.players.map((p) => (
            <div key={p.id}>
              <FlipCard
                className="h-16"
                flipped={flipped}
                back={<div className="flex h-full items-center justify-center rounded-md border-2 border-ink bg-ink text-paper">?</div>}
                front={
                  <div className="flex h-full flex-col items-center justify-center rounded-md border-2 border-ink bg-card">
                    <span className="num text-xl font-semibold">{lv.incomes?.[p.id]}</span>
                    <span className="label">{t('ui.coins')}</span>
                  </div>
                }
              />
              <div className="mt-1 truncate text-center text-xs">{shortName(v, p.id)}</div>
            </div>
          ))}
        </div>
        <ContinueBar />
      </FormCard>
    );
  }
  return (
    <FormCard form={t('levels.5.reveal.amendTitle')}>
      {lv.amendments.length ? <AmendmentLog v={v} list={lv.amendments} /> : <p className="text-sm">{t('levels.5.reveal.noAmendments')}</p>}
      <p className="h-display text-xl">
        {t('levels.5.reveal.final')}: {lv.current && constitutionLabel(lv.current)}
      </p>
      {lv.incomes && lv.current && lv.lobby && lv.W && (
        <MoneyBox>
          {(() => {
            const ids = v.players.map((p) => p.id);
            const inc = ids.map((id) => lv.incomes![id]);
            const parts = floorTopUpParts(inc, lv.current!.t, lv.current!.F, L5.KAPPA);
            const me = ids.indexOf(v.viewer);
            const mine = lv.lobby![v.viewer];
            const given = mine?.donateTo ? mine.amount : 0;
            const recv = Object.values(lv.lobby!).reduce((a, l) => a + (l.donateTo === v.viewer ? l.amount : 0), 0);
            return (
              <>
                <MoneyLine mine>
                  {t('summary.money.l5', {
                    y: inc[me],
                    tax: fmt1(parts.tax[me]),
                    top: fmt1(parts.topUp[me]),
                    share: fmt1(parts.shareEach),
                    given,
                    recv,
                    w: fmt1(lv.W![v.viewer]),
                  })}
                </MoneyLine>
                <p className="text-xs text-soft">
                  {t('summary.taxWentL5', { c: fmt1(parts.collected), lost: fmt1(parts.lost), top: fmt1(parts.topUpTotal), share: fmt1(parts.shareEach) })}
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

function Info({ v }: { v: ViewState }) {
  const lv = v.levelView as L5View;
  return (
    <div className="space-y-1 text-sm">
      <p>
        {t('levels.5.current')}: <span className="font-semibold">{lv.current ? constitutionLabel(lv.current) : t('ui.pending')}</span>
      </p>
      {lv.incomes && (
        <ul className="num text-xs">
          {v.players.map((p) => (
            <li key={p.id}>
              {nameOf(v, p.id)}: {lv.incomes![p.id]}
            </li>
          ))}
        </ul>
      )}
      <p className="text-soft">{t('ui.incomeDeck', { deck: L5.INCOME_DECK.join(', ') })}</p>
    </div>
  );
}

function Debrief({ v }: { v: ViewState }) {
  const d = (v.levelView as L5View).debrief ?? (v.levelResults[5] as L5Debrief);
  const n = v.players.length;
  const dtPts = (id: string) => d.deltaT[id] * 100;
  const mine = dtPts(v.viewer);
  // D-73: only human answers are measured. A slope needs at least 3 of them; bots' answers are programmed.
  const humans = v.players.filter((p) => p.isHuman);
  const hasBots = humans.length < n;
  const hs = d.slopes.humans;
  const humanSlope = hs === null ? null : hs * 100;
  const donations = Object.entries(d.donations).filter(([, x]) => x.to && x.amount > 0);
  let chart: ReactNode;
  if (humanSlope !== null) {
    const xs = humans.map((p) => d.rank[p.id]);
    const ys = humans.map((p) => dtPts(p.id));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    chart = (
      <ChartFrame
        title={t('debrief.l5.chartTitleHumans')}
        summary={humans.map((p) => t('ui.l5.summary', { name: nameOf(v, p.id), rank: d.rank[p.id], dt: dtPts(p.id).toFixed(0) })).join('; ')}
      >
        <Scatter
          points={humans.map((p) => ({ x: d.rank[p.id], y: dtPts(p.id), label: nameOf(v, p.id), highlight: p.id === v.viewer }))}
          xLabel={t('debrief.l5.chartX')}
          yLabel={t('debrief.l5.chartY')}
          slope={{ m: humanSlope, b: my - humanSlope * mx }}
          format={(x) => x.toFixed(0)}
        />
      </ChartFrame>
    );
  } else {
    const before = d.fair1[v.viewer] * 100;
    const after = d.fair2[v.viewer] * 100;
    chart = (
      <ChartFrame title={t('debrief.l5.chartTitleYou')} summary={t('debrief.l5.chartYouSummary', { f1: before.toFixed(0), f2: after.toFixed(0) })}>
        <GroupedBars
          categories={[t('debrief.l5.chartBefore'), t('debrief.l5.chartAfter')]}
          series={[{ name: nameOf(v, v.viewer), values: [before, after] }]}
          format={(x) => `${x.toFixed(0)}%`}
        />
      </ChartFrame>
    );
  }
  return (
    <DebriefShell
      v={v}
      archiveIds={['self-serving-bias', 'veil', 'supermajority', 'reciprocity']}
      cardBest={d.cardBest && { best: constitutionLabel(d.cardBest.best), chose: constitutionLabel(d.cardBest.chose) }}
      predicted={<p>{t('debrief.l5.predicted')}</p>}
      compare={[
        {
          label: t('ui.l5.cmpLabel'),
          benchmark: t('ui.l5.cmpBench'),
          lab: t('ui.l5.cmpLab'),
          you: t('ui.l5.pts', { x: signed(mine) }),
          bots: hasBots ? t('ui.l5.botsProgrammed') : t('ui.l5.noBots'),
        },
      ]}
      did={
        <>
          <p className="h-display text-xl">{Math.round(mine) === 0 ? t('debrief.l5.ownShiftZero') : t('debrief.l5.ownShift', { dt: signed(mine) })}</p>
          <p>{t('debrief.l5.ownShiftNote')}</p>
          <p>
            {t('debrief.l5.fairLine', {
              f1: `${Math.round(d.fair1[v.viewer] * 100)}%`,
              f2: `${Math.round(d.fair2[v.viewer] * 100)}%`,
              inc: d.incomes[v.viewer],
              rank: d.rank[v.viewer],
              n,
            })}
          </p>
          <p>
            {d.proposals[v.viewer]
              ? t('debrief.l5.paidLine', {
                  veil: constitutionLabel(d.veil[v.viewer]),
                  prop: constitutionLabel(d.proposals[v.viewer]!),
                  dt: signed((d.paidMove[v.viewer] ?? 0) * 100),
                })
              : t('debrief.l5.paidLinePass', { veil: constitutionLabel(d.veil[v.viewer]) })}
          </p>
          {humanSlope !== null && <p>{t('debrief.l5.humanSlope', { k: humans.length, slope: signed(humanSlope, 1) })}</p>}
          {hasBots && <p className="text-soft">{t('debrief.l5.botsProgrammed')}</p>}
          <p>{t('debrief.l5.amendments', { n: d.amendments.length, p: d.amendments.filter((a) => a.passed).length })}</p>
          <p>
            {donations.length
              ? t('debrief.l5.donations', { list: donations.map(([id, x]) => `${nameOf(v, id)} → ${nameOf(v, x.to!)} (${x.amount})`).join(', ') })
              : t('debrief.l5.noDonations')}
          </p>
          {d.boughtVotes.map((b, i) => (
            <p key={i} className="text-soft">
              {t(b.donor === v.viewer ? 'debrief.l5.boughtYou' : b.recipient === v.viewer ? 'debrief.l5.boughtToYou' : 'debrief.l5.bought', {
                donor: nameOf(v, b.donor),
                amount: b.amount,
                to: nameOf(v, b.recipient),
                vote: b.votedYes ? t('ui.yes') : t('ui.no'),
              })}
            </p>
          ))}
        </>
      }
      chart={chart}
    />
  );
}

export const L5UI: LevelUI = {
  Decide,
  Reveal,
  Info,
  Debrief,
  briefing: (v) => (v.phase.step === 'VEIL' ? t('levels.5.briefing.VEIL') : ''),
};
