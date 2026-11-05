// Play Episode 4, "The Hiring Round" (v2 Section 4, D-151): train, claim, and once per episode you are HireBot.
// One beat per screen, as Episode 3. Every number and string comes from the engine view and play.l4.*.
import { useState } from 'react';
import type { ViewState } from '../../engine/types';
import type { P4Preview, P4Round } from '../../engine/play/ep4';
import type { Group, Job, Policy, Priors } from '../../engine/levels/level4';
import { POLICIES } from '../../engine/levels/level4';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { nameOf, shortName } from '../game';
import { BigButton, Bubble, Face, Stage } from './OnAir';
import { GiftSheet, Stamps, Tile, previewText, roundClaims } from './Episode3';
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
  const [open, setOpen] = useState(false);
  const pv = lv4(v).preview?.gift;
  return (
    <>
      <Tile
        on={!!gift}
        title={t('play.gift.title')}
        desc={gift ? t('play.gift.picked', { n: gift.amount, name: shortName(v, gift.to) }) : t('play.gift.desc', { max: Math.max(...PLAY.GIFT_AMOUNTS) })}
        note={gift ? previewText(pv?.[gift.to]?.[gift.amount]) : null}
        onClick={() => setOpen(true)}
      />
      {open && (
        <GiftSheet
          v={v}
          gift={gift}
          previews={pv}
          onPick={(g) => {
            setGift(g);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Before the first decision: your group, your childcare duty, and who judges when. */
export function MyCards4({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv4(v);
  const me = v.viewer;
  const order = [1, 2, 3, 4].map((r) => v.players[(r - 1) % v.players.length]);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-mycards>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l4.cards.label')}</p>
        <p className="h-show mt-2 text-5xl leading-none text-spot">{groupName(lv.groups[me])}</p>
        <p className="mt-3 text-base">{t(lv.care[me] ? 'play.l4.cards.care' : 'play.l4.cards.noCare')}</p>
        <p className="mt-3 text-base">{t('play.l4.cards.public')}</p>
        <p className="mt-3 text-sm font-semibold">{t('play.l4.cards.judges', { names: order.map((p) => shortName(v, p.id)).join(', ') })}</p>
      </div>
    </Stage>
  );
}

/** The policy vote's result, as a beat before round 3's first screen. */
export function PolicyIn({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv4(v);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-vote>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l4.policyIn')}</p>
        <p className="h-show mt-2 text-4xl leading-tight text-spot">{policyName(lv.policy)}</p>
        <p className="mt-2 text-base">{t(`levels.4.policies.${lv.policy}.desc`)}</p>
        <p className="mt-3 text-sm">{v.players.map((p) => `${shortName(v, p.id)}: ${lv.policyVotes?.[p.id] ? policyName(lv.policyVotes[p.id]) : ''}`).join(' · ')}</p>
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
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l4.judgeIs', { name: shortName(v, lv.judge) })}</p>
      <h1 className="h-show mt-1 text-4xl leading-tight">{t('play.l4.train.title')}</h1>
      <p className="mt-2 text-base">{t(lv.policy === 'B' ? 'play.l4.train.beliefBlind' : 'play.l4.train.belief', { group: groupName(g), p: pct(prior) })}</p>
      <p className="mt-2 text-sm">{t('play.l4.train.how')}</p>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-3">
        <Tile on={train} title={t('play.l4.train.tile')} desc={lv.myCostBase !== undefined && lv.myCostBase !== lv.myCost ? t('play.l4.train.costCut', { c: lv.myCost ?? 0, was: lv.myCostBase }) : t('play.l4.train.cost', { c: lv.myCost ?? 0 })} note={previewText(lv.preview?.train)} onClick={() => setTrain(true)} />
        <Tile on={!train} title={t('play.l4.train.skip')} desc={t('play.l4.train.skipDesc')} onClick={() => setTrain(false)} />
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
      <h1 className="h-show text-4xl leading-tight">{t('play.claim.title')}</h1>
      <div className="mt-3 rounded-2xl bg-card p-3">
        <p className="h-show text-2xl leading-tight">{t(trained ? 'play.l4.claim.youT' : 'play.l4.claim.youU')}</p>
      </div>
      <p className="mt-2 text-sm">{t('play.l4.claim.how', { name: shortName(v, lv.judge) })}</p>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.claim.title')}>
        {['TRAINED', 'SILENT'].map((o) => (
          <button key={o} type="button" aria-pressed={x === o} onClick={() => setX(o)} className={`block w-full rounded-2xl p-3 text-start ${x === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-xl leading-tight">{t(`play.l4.claim.opts.${o}`)}</span>
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
  const claims = roundClaims(v);
  return (
    <Stage v={v} footer={<BigButton onClick={() => act({ hires, gift })}>{t('play.l4.judge.submit')}</BigButton>}>
      <h1 className="h-show text-3xl leading-tight">{t('play.l4.judge.title')}</h1>
      <p className="mt-1 text-sm">{t('play.l4.judge.pay', { g: PLAY.L4.JUDGE_GAIN, l: PLAY.L4.JUDGE_LOSS })}</p>
      <ul className="mt-2 space-y-1.5" aria-label={t('play.l4.judge.title')}>
        {workers.map((w) => {
          const p = v.players.find((x) => x.id === w)!;
          const on = hires[w] === 'COMPLEX';
          const note = on ? previewText(lv.preview?.hire?.[w]) : null;
          return (
            <li key={w}>
              <button type="button" aria-pressed={on} onClick={() => setHires({ ...hires, [w]: on ? 'SIMPLE' : 'COMPLEX' })} className={`flex min-h-[52px] w-full items-center gap-2 rounded-xl px-2 text-start ${on ? 'bg-spot text-onspot' : 'bg-card'}`} data-hire={w}>
                <Face v={v} p={p} size={24} />
                <span className="w-16 truncate text-sm font-bold">{shortName(v, w)}</span>
                <span className="flex-1 text-xs leading-tight">
                  {lv.policy === 'B' ? t('play.l4.judge.hidden') : groupName(lv.groups[w])}, {t(c.pass?.[w] ? 'play.l4.judge.passed' : 'play.l4.judge.failed')}, {t(claims[w] === 'TRAINED' ? 'play.l4.judge.says' : 'play.l4.judge.quiet')}
                  {lv.meterShown && c.meter && (
                    <span className="mt-0.5 flex items-center gap-1" aria-label={t('play.l4.meter', { p: pct(c.meter[w]) })}>
                      <span className="relative h-1.5 w-16 rounded bg-paper" aria-hidden>
                        <span className="absolute inset-y-0 left-0 rounded bg-good" style={{ width: `${Math.round(c.meter[w] * 100)}%` }} />
                        <span className="absolute inset-y-[-2px] w-0.5 bg-ink" style={{ left: `${Math.round(lv.threshold * 100)}%` }} />
                      </span>
                      <span className="font-bold">{pct(c.meter[w])}</span>
                    </span>
                  )}
                </span>
                <span className="text-right text-xs font-bold">
                  {t(on ? 'play.l4.complex' : 'play.l4.simple')}
                  {note && <span className="block text-[10px]">{note}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {lv.meterShown && <p className="mt-1 text-xs">{t('play.l4.judge.meterNote', { p: pct(lv.threshold) })}</p>}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
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
      <h1 className="h-show text-3xl leading-tight">{t('play.l4.policy.title')}</h1>
      <p className="mt-1 text-sm">{t('play.l4.policy.how')}</p>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.l4.policy.title')}>
        {POLICIES.map((p) => (
          <button key={p} type="button" aria-pressed={x === p} onClick={() => setX(p)} className={`block w-full rounded-2xl p-2.5 text-start ${x === p ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-lg leading-tight">{policyName(p)}</span>
            <span className="block text-xs">{t(`play.l4.policy.short.${p}`)}</span>
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
  const youLine = r.judge === me ? t('play.l4.res.youJudged', { n: coins(r.judgePay ?? 0) }) : t(r.job?.[me] === 'COMPLEX' ? 'play.l4.res.youComplex' : 'play.l4.res.youSimple', { n: coins(W[me] ?? 0) });
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext={!last} onClick={next}>{last ? t('play.stage.nextRound', { r: v.round + 1 }) : t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-outcome>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l4.res.label', { r: v.round })}</p>
        <h1 className="h-show mt-1 text-3xl leading-tight text-spot">{youLine}</h1>
        <ul className="mt-3 space-y-1.5">
          {workers.map((w) => {
            const p = v.players.find((x) => x.id === w)!;
            const complex = r.job?.[w] === 'COMPLEX';
            const stamp = complex ? (r.good?.includes(w) ? 'GOOD' : 'BAD') : null;
            return (
              <li key={w} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
                <Face v={v} p={p} size={24} />
                <span className="w-16 truncate text-sm font-bold">{shortName(v, w)}</span>
                <span className="flex-1 text-xs">
                  {t(complex ? 'play.l4.complex' : 'play.l4.simple')}
                  {r.quotaPicks?.includes(w) ? ` · ${t('play.l4.quota')}` : ''} · {t(r.pass?.[w] ? 'play.l4.pass' : 'play.l4.fail')}
                </span>
                {stamp && <span className={`rounded px-1 text-[11px] font-bold ${stamp === 'GOOD' ? 'bg-good text-onspot' : 'bg-stamp text-onspot'}`}>{t(`play.l4.stamp.${stamp}`)}</span>}
                <span className="h-show w-10 text-end">{coins(W[w] ?? 0)}</span>
              </li>
            );
          })}
        </ul>
        {r.judge !== me && r.train?.[me] && <p className="mt-2 text-sm">{t('play.l4.res.trainCost', { c: coins((r.costs?.[me] ?? 0) - (v.play!.event?.id === 'GRANT' && v.play!.event.round === v.round ? PLAY.L4_EVENTS.GRANT.COST_CUT : 0)) })}</p>}
        <p className="mt-2 text-sm">{t('play.l4.res.judgePay', { name: shortName(v, r.judge!), n: coins(r.judgePay ?? 0) })}</p>
        {bankLineText(v) && <p className="mt-2 text-sm font-semibold" data-bankline>{bankLineText(v)}</p>}
      </div>
    </Stage>
  );
}

/** HireBot's beliefs after the round, as Episode 3's price board. */
export function BeliefBeat({ v, next, onReally }: { v: ViewState; next: () => void; onReally: () => void }) {
  const lv = lv4(v);
  const r = lv.rounds[lv.rounds.length - 1];
  const a = r.priorsBefore!;
  const b = r.priorsAfter!;
  const voteNext = v.round === PLAY.L4.BASELINE_ROUNDS;
  const lastRound = v.round >= PLAY.L4.ROUNDS;
  const rows: Array<[string, number, number]> = lv.policy === 'B' && a.POOL !== null && b.POOL !== null ? [[t('play.l4.everyone'), a.POOL, b.POOL]] : (['CIRCLE', 'SQUARE'] as Group[]).map((g) => [groupName(g), a[g], b[g]]);
  return (
    <Stage v={v} bar={false} tone="breaking" onTap={next} footer={<BigButton dark onClick={next}>{voteNext ? t('play.stage.toVote') : lastRound ? t('play.l1.toReveal') : t('play.stage.nextRound', { r: v.round + 1 })}</BigButton>}>
      <div className="my-auto" data-price>
        <p className="text-xs font-bold uppercase tracking-wider">{t('play.l4.board.title')}</p>
        {rows.map(([name, x, y]) => (
          <p key={name} className="mt-2 flex items-baseline gap-3">
            <span className="h-show w-24 text-2xl">{name}</span>
            <span className="h-show text-3xl line-through opacity-60">{pct(x)}</span>
            <span className="h-show text-6xl leading-none">{pct(y)}</span>
          </p>
        ))}
        <p className="h-show mt-4 text-2xl leading-tight">{t('play.l4.board.head')}</p>
        <p className="mt-2 text-sm">{t('play.l4.board.sub', { p: pct(lv.threshold) })}</p>
        <div className="mt-4">
          <figure className="rounded-2xl bg-onspot px-3 py-2 text-sm text-spot" data-voice="host">
            <span className="font-bold">Dash:</span> {hostLine('l4board', pick(v, 'l4board', 6))}
          </figure>
        </div>
        <button
          type="button"
          className="mt-3 text-sm font-semibold underline"
          onClick={(e) => {
            e.stopPropagation();
            onReally();
          }}
        >
          {t('play.really.button')}
        </button>
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
      ? t('play.l4.peak.youTurnedSq', { n: turnedSq })
      : turnedDown.length
        ? t('play.l4.peak.youTurned', { n: turnedDown.length })
        : badHires
          ? t('play.l4.peak.youBad', { n: badHires })
          : t('play.l4.peak.youClean');
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.stage.tap')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.cards.label')}</p>
      <h1 className="h-show text-3xl leading-tight text-spot">{t('play.l4.peak.title')}</h1>
      <ul className="mt-2 space-y-1" data-cards>
        {rows.map(({ p, stamps }) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1">
            <Face v={v} p={p} size={22} />
            <span className="w-14 truncate text-xs font-bold">{shortName(v, p.id)}</span>
            <span className="flex-1 text-[11px] leading-tight">
              <Stamps items={stamps.map((x) => t('play.l4.peak.stamp', { r: x.round, did: t(x.trained ? 'play.l4.peak.T' : 'play.l4.peak.U'), stamp: x.claimed ? t(x.trained ? 'play.cards.TRUE' : 'play.cards.LIE') : t('play.l4.peak.silent') }))} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm font-semibold">{t(gap >= 0 ? 'play.l4.peak.gap' : 'play.l4.peak.gapNeg', { n: coins(Math.abs(gap)) })}</p>
      <p className="h-show mt-2 text-xl leading-tight">{t('play.l4.peak.line')}</p>
      {record && <p className="mt-1 text-sm font-semibold">{record}</p>}
      <div className="mt-2">
        <Bubble who="Dash" host text={top && top.lies ? t(top.p.id === me ? 'play.cards.peakLieYou' : 'play.l4.peak.lie', { name: nameOf(v, top.p.id), n: timesWord(top.lies) }) : hostLine('peakHonest', pick(v, 'peakHonest', 6))} />
      </div>
    </Stage>
  );
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
