// Play Episode 4, "The Hiring Round" (v2 Section 4, D-151): train, claim, and once per episode you are HireBot.
// One beat per screen, as Episode 3. Every number and string comes from the engine view and play.l4.*.
import { useRef, useState } from 'react';
import type { ViewState } from '../../engine/types';
import type { P4Preview, P4Round } from '../../engine/play/ep4';
import type { Group, Job, Policy, Priors } from '../../engine/levels/level4';
import { POLICIES } from '../../engine/levels/level4';
import { PLAY } from '../../engine/play/params';
import { L4 } from '../../engine/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { MoneyLedger } from './Ledger';
import { CallChips, CallResults, claimantsNow } from './Call';
import { coins, pct } from '../labels';
import { nameOf, shortName } from '../game';
import type { CastCue } from './Cast';
import { Chips, Details, StagedReveal, peakMark, spotlightSteps } from './Peak';
import { ReallyButton } from './Really';
import { Coach } from './Coach';
import { AutoButton, BigButton, Bubble, Face, Stage } from './OnAir';
import { GiftBar, Tile, previewText, roundClaims } from './Episode3';
import { hostLine, pick, timesWord, bankLineText } from './logic';

type Gift = { to: string; amount: number };

export type L4View = {
  groups: Record<string, Group>;
  care: Record<string, boolean>;
  priors: Priors;
  policy: Policy;
  policyVotes?: Record<string, Policy>;
  judge: string;
  myCost?: number;
  myCostBase?: number;
  rounds: Array<Partial<P4Round>>;
  current?: Partial<P4Round>;
  threshold: number;
  meterShown: boolean;
  preview?: P4Preview;
  cardsOpen: boolean;
};

const lv4 = (v: ViewState) => v.levelView as L4View;
export const groupName = (g: Group) => t(`play.l4.group.${g}`);
const policyName = (p: Policy) => t(`levels.4.policies.${p}.name`);

function GiftTile({ v, gift, setGift }: { v: ViewState; gift: Gift | null; setGift: (g: Gift | null) => void }) {
  const pv = lv4(v).preview?.gift;
  return <GiftBar v={v} gift={gift} previews={pv} note={gift ? previewText(pv?.[gift.to]?.[gift.amount]) : null} onPick={setGift} />;
}

/** Before the first decision: your group, your childcare duty, and who judges when. */
export function MyCards4({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv4(v);
  const me = v.viewer;
  const order = [1, 2, 3, 4].map((r) => v.players[(r - 1) % v.players.length]);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-mycards>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.l4.cards.label')}</p>
        <p className="h-show mt-2 text-hero leading-none text-spot">{groupName(lv.groups[me])}</p>
        <p className="mt-3 text-body">{t(lv.care[me] ? 'play.l4.cards.care' : 'play.l4.cards.noCare', { n: L4.CHAOS_COST })}</p>
        <p className="mt-3 text-body">{t('play.l4.cards.public')}</p>
        <p className="mt-3 text-small font-semibold">{t('play.l4.cards.judges', { names: order.map((p) => shortName(v, p.id)).join(', ') })}</p>
        {v.play!.comeback && v.play!.comeback.pid !== v.viewer && (
          <p className="mt-2 text-small">{t(v.play!.comeback.took === 'COINS' ? 'play.comeback.otherCoins' : 'play.comeback.otherPoints', { name: shortName(v, v.play!.comeback.pid), c: PLAY.COMEBACK.COINS, p: PLAY.COMEBACK.POINTS })}</p>
        )}
      </div>
    </Stage>
  );
}

/** The policy vote's result, as a beat before round 3's first screen. */
export function PolicyIn({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv4(v);
  return (
    <Stage v={v} onTap={next} footer={<AutoButton onClick={next}>{t('play.stage.tap')}</AutoButton>}>
      <div className="my-auto" data-vote>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.l4.policyIn')}</p>
        <p className="h-show mt-2 text-hero leading-tight text-spot">{policyName(lv.policy)}</p>
        <p className="mt-2 text-body">{t(`levels.4.policies.${lv.policy}.desc`)}</p>
        <p className="mt-3 text-small"><span className="font-bold">{t('play.cast.votes')}</span> {v.players.map((p) => `${shortName(v, p.id)} ${lv.policyVotes?.[p.id] ? policyName(lv.policyVotes[p.id]) : ''}`).join(' · ')}</p>
        {(() => {
          const n: Record<string, number> = {};
          for (const x of Object.values(lv.policyVotes ?? {})) n[x] = (n[x] ?? 0) + 1;
          const top = Math.max(0, ...Object.values(n));
          return Object.values(n).filter((c) => c === top).length > 1 ? <p className="mt-1 text-small">{t('play.l1.votes.tie')}</p> : null;
        })()}
      </div>
    </Stage>
  );
}

/** Worker move: train or not (private), and a gift. */
export function TrainScreen({ v }: { v: ViewState }) {
  const lv = lv4(v);
  const act = useStore((s) => s.act);
  const [train, setTrain] = useState(false);
  const [gift, setGift] = useState<Gift | null>(null);
  const g = lv.groups[v.viewer];
  const prior = lv.policy === 'B' && lv.priors.POOL !== null ? lv.priors.POOL : lv.priors[g];
  return (
    <Stage v={v} footer={<BigButton onClick={() => act({ train, gift })}>{t('play.stage.lock')}</BigButton>}>
      <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.l4.judgeIs', { name: shortName(v, lv.judge) })}</p>
      <h1 className="h-show mt-1 text-hero leading-tight">{t('play.l4.train.title')}</h1>
      <Coach id="move" />
      <p className="mt-2 text-body">{t(lv.policy === 'B' ? 'play.l4.train.beliefBlind' : 'play.l4.train.belief', { group: groupName(g), p: pct(prior) })}</p>
      <p className="mt-2 text-small">{t('play.l4.train.how')}</p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <Tile on={train} title={t('play.l4.train.tile')} desc={lv.myCostBase !== undefined && lv.myCostBase !== lv.myCost ? t('play.l4.train.costCut', { c: lv.myCost ?? 0, was: lv.myCostBase }) : t('play.l4.train.cost', { c: lv.myCost ?? 0 })} note={previewText(lv.preview?.train)} onClick={() => setTrain(true)} />
        <Tile on={!train} title={t('play.l4.train.skip')} desc={t('play.l4.train.skipDesc')} onClick={() => setTrain(false)} />
      </div>
      <div className="mt-2">
        <GiftTile v={v} gift={gift} setGift={setGift} />
      </div>
    </Stage>
  );
}

/** Worker claim, before the test: "I trained" or nothing. */
export function ClaimScreen4({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv4(v);
  const [x, setX] = useState<string | null>(null);
  const trained = lv.current?.train?.[v.viewer];
  return (
    <Stage v={v} footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.claim.submit')}</BigButton>}>
      <h1 className="h-show text-hero leading-tight">{t('play.claim.title')}</h1>
      <Coach id="claim" />
      <div className="mt-3 rounded-2xl bg-card p-3">
        <p className="h-show text-title leading-tight">{t(trained ? 'play.l4.claim.youT' : 'play.l4.claim.youU')}</p>
      </div>
      <p className="mt-2 text-small">{t('play.l4.claim.how', { name: shortName(v, lv.judge) })}</p>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.claim.title')}>
        {['TRAINED', 'SILENT'].map((o) => (
          <button key={o} type="button" aria-pressed={x === o} onClick={() => setX(o)} className={`block w-full rounded-2xl p-3 text-start ${x === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-lead leading-tight">{t(`play.l4.claim.opts.${o}`)}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** You are HireBot: hire each worker for the complex or the simple job. */
export function JudgeScreen({ v }: { v: ViewState }) {
  const lv = lv4(v);
  const act = useStore((s) => s.act);
  const c = lv.current!;
  const workers = c.workers ?? [];
  const [hires, setHires] = useState<Record<string, Job>>(() => Object.fromEntries(workers.map((w) => [w, 'SIMPLE' as Job])));
  const [gift, setGift] = useState<Gift | null>(null);
  const [call, setCall] = useState<string | null>(null);
  // UI V3 (U3): one worker card at a time; Complex or Simple moves to the next card; swipe works too.
  const [k, setK] = useState(0);
  const startX = useRef<number | null>(null);
  const claims = roundClaims(v);
  const w = workers[Math.min(k, workers.length - 1)];
  const p = v.players.find((x) => x.id === w)!;
  const choose = (job: Job) => {
    setHires({ ...hires, [w]: job });
    if (k < workers.length - 1) setK(k + 1);
  };
  const note = hires[w] === 'COMPLEX' ? previewText(lv.preview?.hire?.[w]) : null;
  const meter = lv.meterShown && c.meter ? c.meter[w] : null;
  return (
    <Stage v={v} cast={{ focus: w }} footer={<BigButton onClick={() => act({ hires, gift, call })}>{t('play.l4.judge.submit')}</BigButton>}>
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="h-show text-title leading-tight">{t('play.l4.judge.title')}</h1>
        <span className="text-small font-bold text-soft">{t('play.l4.judge.of', { k: Math.min(k, workers.length - 1) + 1, n: workers.length })}</span>
      </div>
      <p className="text-small">{t('play.l4.judge.payShort', { g: PLAY.L4.JUDGE_GAIN, l: PLAY.L4.JUDGE_LOSS })}</p>
      <div
        className="mt-2 rounded-2xl bg-card p-3"
        data-judge-card={w}
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (dx > 60) choose('COMPLEX');
          else if (dx < -60) choose('SIMPLE');
        }}
      >
        <div className="flex items-center gap-2">
          <Face v={v} p={p} size={40} />
          <span className="h-show flex-1 truncate text-lead">{shortName(v, w)}</span>
          <span className="text-small font-bold">{lv.policy === 'B' ? t('play.l4.judge.hidden') : groupName(lv.groups[w])}</span>
        </div>
        <p className="mt-1 text-small">
          {t(c.pass?.[w] ? 'play.l4.judge.passedTest' : 'play.l4.judge.failedTest')} · {t(claims[w] === 'TRAINED' ? 'play.l4.judge.says' : 'play.l4.judge.quiet')}
        </p>
        {meter !== null && (
          <div className="mt-2" aria-label={t('play.l4.meter', { p: pct(meter) })} role="img">
            <div className="relative h-4 rounded-full bg-paper">
              <div className={`absolute inset-y-0 left-0 rounded-full ${meter >= lv.threshold ? 'bg-good' : 'bg-stamp'}`} style={{ width: `${Math.round(meter * 100)}%` }} />
              <div className="absolute -inset-y-1 w-1 rounded bg-spot" style={{ left: `calc(${Math.round(lv.threshold * 100)}% - 2px)` }} />
            </div>
            <p className="mt-1 flex justify-between text-small">
              <span className="font-bold">{t('play.l4.judge.meterShort', { p: pct(meter) })}</span>
              <span>{t('play.l4.judge.line', { p: pct(lv.threshold) })}</span>
            </p>
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={t('play.l4.judge.jobFor', { name: shortName(v, w) })}>
          {(['COMPLEX', 'SIMPLE'] as Job[]).map((job) => (
            <button key={job} type="button" aria-pressed={hires[w] === job} onClick={() => choose(job)} className={`min-h-[48px] rounded-xl text-body font-bold ${hires[w] === job ? 'bg-spot text-onspot' : 'bg-paper'}`} data-hire={`${w}:${job}`}>
              {t(job === 'COMPLEX' ? 'play.l4.complex' : 'play.l4.simple')}
            </button>
          ))}
        </div>
        {note && <p className="mt-1 text-small font-bold" data-preview>{note}</p>}
      </div>
      <div className="mt-2 flex gap-1.5" aria-label={t('play.l4.judge.picks')}>
        {workers.map((x, i) => (
          <button key={x} type="button" onClick={() => setK(i)} aria-current={i === k} className={`min-h-[44px] flex-1 rounded-xl px-1 text-small font-bold ${i === k ? 'border-2 border-spot' : ''} ${hires[x] === 'COMPLEX' ? 'bg-spot text-onspot' : 'bg-card'}`}>
            {shortName(v, x)}: {t(hires[x] === 'COMPLEX' ? 'play.l4.complex' : 'play.l4.simple')}
          </button>
        ))}
      </div>
      <CallChips v={v} claimants={claimantsNow(v, (x) => x === 'TRAINED')} value={call} onPick={setCall} />
      <div className="mt-auto pt-2">
        <GiftTile v={v} gift={gift} setGift={setGift} />
      </div>
    </Stage>
  );
}

export function PolicyScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<Policy | null>(null);
  return (
    <Stage v={v} footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.l4.policy.submit')}</BigButton>}>
      <h1 className="h-show text-title leading-tight">{t('play.l4.policy.title')}</h1>
      <p className="mt-1 text-small">{t('play.l4.policy.how')}</p>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.l4.policy.title')}>
        {POLICIES.map((p) => (
          <button key={p} type="button" aria-pressed={x === p} onClick={() => setX(p)} className={`block w-full rounded-2xl p-2.5 text-start ${x === p ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-lead leading-tight">{policyName(p)}</span>
            <span className="block text-small">{t(`play.l4.policy.short.${p}`)}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** Round results: each worker's job, GOOD HIRE or BAD HIRE for complex hires, the judge's pay. */
export function HiresBeat({ v, next, last }: { v: ViewState; next: () => void; last: boolean }) {
  const lv = lv4(v);
  const r = lv.rounds[lv.rounds.length - 1];
  const workers = r.workers ?? [];
  const me = v.viewer;
  const W = r.W ?? {};
  const nGood = (r.workers ?? []).filter((w) => r.job?.[w] === 'COMPLEX' && r.good?.includes(w)).length;
  const nBad = (r.workers ?? []).filter((w) => r.job?.[w] === 'COMPLEX' && !r.good?.includes(w)).length;
  // UI V3 (U1): GOOD HIRE / BAD HIRE land on the workers; the judge's face follows the pay.
  const cue: CastCue = { stamps: {}, expr: {} };
  for (const w of workers) {
    if (r.job?.[w] !== 'COMPLEX') continue;
    const good = !!r.good?.includes(w);
    cue.stamps![w] = { text: t(`play.cast.hire.${good ? 'GOOD' : 'BAD'}`), tone: good ? 'good' : 'stamp' };
    cue.expr![w] = good ? 'pleased' : 'caught';
  }
  if (r.judge) cue.expr![r.judge] = nBad ? 'shocked' : nGood ? 'smug' : 'neutral';
  // UI V3 (U3): no formula in the headline. "You earned 0 as HireBot", then base, good hires, bad hires.
  const youLine = r.judge === me ? t('play.l4.res.youEarned', { n: coins(r.judgePay ?? 0) }) : t(r.job?.[me] === 'COMPLEX' ? 'play.l4.res.youComplex' : 'play.l4.res.youSimple', { n: coins(W[me] ?? 0) });
  const judgeRows: Array<[string, number]> | null =
    r.judge === me
      ? [
          [t('play.l4.res.rowBase'), (r.judgePay ?? 0) - nGood * PLAY.L4.JUDGE_GAIN + nBad * PLAY.L4.JUDGE_LOSS],
          [t('play.l4.res.rowGood', { n: nGood }), nGood * PLAY.L4.JUDGE_GAIN],
          [t('play.l4.res.rowBad', { n: nBad }), -nBad * PLAY.L4.JUDGE_LOSS],
        ]
      : null;
  return (
    <Stage v={v} cast={cue} onTap={next} footer={<BigButton beatNext={!last} onClick={next}>{last ? t('play.stage.nextRound', { r: v.round + 1 }) : t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-outcome>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.l4.res.label', { r: v.round })}</p>
        <h1 className="h-show mt-1 text-title leading-tight text-spot">{youLine}</h1>
        {judgeRows && (
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 rounded-2xl bg-card px-3 py-2 text-small" data-judge-pay>
            {judgeRows.map(([k, n]) => (
              <div key={k} className="contents">
                <dt>{k}</dt>
                <dd className="h-show text-end">{n > 0 ? `+${coins(n)}` : n < 0 ? `−${coins(-n)}` : '0'}</dd>
              </div>
            ))}
          </dl>
        )}
        <ul className="mt-3 space-y-1.5">
          {workers.map((w) => {
            const p = v.players.find((x) => x.id === w)!;
            const complex = r.job?.[w] === 'COMPLEX';
            const stamp = complex ? (r.good?.includes(w) ? 'GOOD' : 'BAD') : null;
            return (
              <li key={w} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
                <Face v={v} p={p} size={24} />
                <span className="w-16 truncate text-small font-bold">{shortName(v, w)}</span>
                <span className="flex-1 text-small">
                  {t(complex ? 'play.l4.complex' : 'play.l4.simple')}
                  {r.quotaPicks?.includes(w) ? ` · ${t('play.l4.quota')}` : ''} · {t(r.pass?.[w] ? 'play.l4.pass' : 'play.l4.fail')}
                </span>
                {stamp && <span className={`rounded px-1 text-small font-bold ${stamp === 'GOOD' ? 'bg-good text-onspot' : 'bg-stamp text-onspot'}`}>{t(`play.cast.hire.${stamp}`)}</span>}
                <span className="h-show w-10 text-end">{coins(W[w] ?? 0)}</span>
              </li>
            );
          })}
        </ul>
        {r.judge !== me && r.jobPay?.[me] !== undefined && <p className="mt-2 text-small">{t(r.train?.[me] ? 'play.l4.res.payTrain' : 'play.l4.res.pay', { p: coins(r.jobPay[me]), c: coins(Math.max(0, (r.costs?.[me] ?? 0) - (v.play!.event?.id === 'GRANT' && v.play!.event.round === v.round ? PLAY.L4_EVENTS.GRANT.COST_CUT : 0))) })}{lv.care[me] && r.job?.[me] === 'COMPLEX' ? ` ${t('play.l4.res.care', { n: lv.policy === 'D' ? L4.CHAOS_COST_SUBSIDIZED : L4.CHAOS_COST })}` : ''}{(() => { const cost = r.train?.[me] ? Math.max(0, (r.costs?.[me] ?? 0) - (v.play!.event?.id === 'GRANT' && v.play!.event.round === v.round ? PLAY.L4_EVENTS.GRANT.COST_CUT : 0)) : 0; const other = Math.round((W[me] ?? 0) - r.jobPay![me] + cost); return other ? ` ${t('play.l4.res.other', { n: `${other > 0 ? '+' : ''}${other}` })}` : ''; })()}</p>}
        {r.judge !== me && <p className="mt-2 text-small">{t('play.l4.res.judgePay', { name: shortName(v, r.judge!), n: coins(r.judgePay ?? 0) })}</p>}
        {bankLineText(v) && <p className="mt-2 text-small font-semibold" data-bankline>{bankLineText(v)}<MoneyLedger v={v} /></p>}
        <CallResults v={v} />
      </div>
    </Stage>
  );
}

/** HireBot's beliefs after the round, as Episode 3's price board. */
export function BeliefBeat({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv4(v);
  const r = lv.rounds[lv.rounds.length - 1];
  const a = r.priorsBefore!;
  const b = r.priorsAfter!;
  const voteNext = v.round === PLAY.L4.BASELINE_ROUNDS;
  const lastRound = v.round >= PLAY.L4.ROUNDS;
  const rows: Array<[string, number, number]> = lv.policy === 'B' && a.POOL !== null && b.POOL !== null ? [[t('play.l4.everyone'), a.POOL, b.POOL]] : (['CIRCLE', 'SQUARE'] as Group[]).map((g) => [groupName(g), a[g], b[g]]);
  return (
    <Stage v={v} bar={false} tone="breaking" onTap={next} footer={<AutoButton dark onClick={next}>{voteNext ? t('play.stage.toVote') : lastRound ? t('play.l1.toReveal') : t('play.stage.nextRound', { r: v.round + 1 })}</AutoButton>}>
      <div className="my-auto" data-price>
        <p className="text-small font-bold uppercase tracking-wider">{t('play.l4.board.title')}</p>
        {rows.map(([name, x, y]) => (
          <p key={name} className="mt-2 flex items-baseline gap-3">
            <span className="h-show w-28 shrink-0 truncate text-lead">{name}</span>
            <span className="h-show text-title line-through opacity-60">{pct(x)}</span>
            <span className="h-show text-hero leading-none">{pct(y)}</span>
          </p>
        ))}
        <p className="h-show mt-4 text-title leading-tight">{t('play.l4.board.head')}</p>
        <p className="mt-2 text-small">{t('play.l4.board.sub', { p: pct(lv.threshold) })}</p>
        <Bubble who="Dash" host mood="worried" text={hostLine('l4board', pick(v, 'l4board', 6))} />
        <ReallyButton v={v} className="mt-3" />
      </div>
    </Stage>
  );
}

/** The peak: who really trained, every claim stamped, the gap, and your record as the judge. */
export function CardsReveal4({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv4(v);
  const me = v.viewer;
  const rows = v.players.map((p) => {
    const stamps = lv.rounds
      .map((r, k) => ({ round: k + 1, worker: (r.workers ?? []).includes(p.id), trained: !!r.train?.[p.id], claimed: r.claims?.[p.id] === 'TRAINED' }))
      .filter((x) => x.worker);
    return { p, stamps, lies: stamps.filter((x) => x.claimed && !x.trained).length };
  });
  const top = rows.slice().sort((a, b) => b.lies - a.lies)[0];
  const byGroup = (g: Group) => {
    const xs = lv.rounds.flatMap((r) => (r.workers ?? []).filter((w) => lv.groups[w] === g).map((w) => r.W?.[w] ?? 0));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const gap = byGroup('CIRCLE') - byGroup('SQUARE');
  const judged = lv.rounds.filter((r) => r.judge === me);
  const turnedDown = judged.flatMap((r) => (r.workers ?? []).filter((w) => r.train?.[w] && r.job?.[w] === 'SIMPLE'));
  const turnedSq = turnedDown.filter((w) => lv.groups[w] === 'SQUARE').length;
  const badHires = judged.reduce((a, r) => a + (r.bad?.length ?? 0), 0);
  const record = !judged.length
    ? null
    : turnedSq
      ? t(turnedSq === 1 ? 'play.l4.peak.youTurnedSqOne' : 'play.l4.peak.youTurnedSq', { n: turnedSq })
      : turnedDown.length
        ? t(turnedDown.length === 1 ? 'play.l4.peak.youTurnedOne' : 'play.l4.peak.youTurned', { n: turnedDown.length })
        : badHires
          ? t('play.l4.peak.youBad', { n: badHires })
          : t('play.l4.peak.youClean');
  const chipsOf = (stamps: Array<{ round: number; trained: boolean; claimed: boolean }>) =>
    stamps.map((x) => ({ text: t('play.l4.peak.stamp', { r: x.round, did: t(x.trained ? 'play.l4.peak.T' : 'play.l4.peak.U'), stamp: x.claimed ? t(x.trained ? 'play.cards.TRUE' : 'play.cards.LIE') : t('play.l4.peak.silent') }), lie: x.claimed && !x.trained }));
  const order = rows.slice().sort((a, b) => b.lies - a.lies);
  const { steps, final } = spotlightSteps(
    order.map(({ p, stamps, lies }) => ({
      id: p.id,
      ...peakMark(v, p.id, lies, stamps.filter((x) => x.claimed).length),
      body: (
        <div className="rounded-2xl bg-card p-3">
          <p className="h-show text-lead">{shortName(v, p.id)}</p>
          <div className="mt-2">{stamps.length ? <Chips items={chipsOf(stamps)} /> : <span className="text-small text-soft">{t('play.cards.noClaims')}</span>}</div>
        </div>
      ),
    })),
    <>
      <p className="h-show text-lead leading-tight" data-peak-headline>{top && top.lies ? t(top.p.id === me ? 'play.cards.peakLieYouPlain' : 'play.l4.peak.lie', { name: nameOf(v, top.p.id), n: timesWord(top.lies) }) : t('play.l4.peak.line')}</p>
      {top && top.lies > 0 && <p className="mt-1 text-small font-semibold">{t('play.l4.peak.line')}</p>}
      <Details>
        <ul className="space-y-1" data-cards-list>
        {rows.map(({ p, stamps, lies }) => (
          <li key={p.id} className="rounded-xl bg-card px-2">
            <details>
              <summary className="flex min-h-[44px] cursor-pointer items-center gap-2">
                <span className="w-20 shrink-0 truncate text-small font-bold">{shortName(v, p.id)}</span>
                <span className="flex-1 text-small">{t('play.cast.l4row', { n: stamps.filter((x) => x.trained).length, w: stamps.length })}</span>
                <span className={`rounded-md px-1.5 text-small font-bold ${lies ? 'bg-stamp text-onspot' : 'bg-paper text-ink'}`}>{t('play.cast.lies', { n: lies })}</span>
              </summary>
              <div className="pb-1.5"><Chips items={chipsOf(stamps)} /></div>
            </details>
          </li>
        ))}
      </ul>
        <p className="mt-2 text-small font-semibold">{t(gap >= 0 ? 'play.l4.peak.gap' : 'play.l4.peak.gapNeg', { n: coins(Math.abs(gap)) })}</p>
      
      {record && <p className="mt-1 text-small font-semibold">{record}</p>}
      </Details>
      <div className="mt-2">
        <Bubble who="Dash" host mood={top && top.lies ? 'excited' : 'wink'} text={hostLine('l4board', pick(v, 'l4peak', 6))} />
      </div>
    </>,
  );
  return <StagedReveal v={v} label={t('play.cards.label')} title={t('play.l4.peak.title')} steps={steps} final={final} onDone={() => act()} />;
}

/** Summary pieces for Episode 4: the biggest lie (claimed "I trained" without training). */
export function summary4(v: ViewState): { lie: string } {
  const lv = lv4(v);
  const counts = v.players
    .map((p) => ({ id: p.id, n: lv.rounds.filter((r) => r.claims?.[p.id] === 'TRAINED' && r.train?.[p.id] === false).length }))
    .sort((a, b) => b.n - a.n)[0];
  return {
    lie: counts && counts.n ? t(counts.id === v.viewer ? 'play.l4.sum.lieYou' : 'play.l4.sum.lie', { name: nameOf(v, counts.id), n: timesWord(counts.n) }) : t('play.summary.noLie'),
  };
}

export const roundsOf4 = (v: ViewState) => lv4(v).rounds;
