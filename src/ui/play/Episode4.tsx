// Play Episode 4, "The Hiring Round" (v2 Section 4, D-151): train, claim, and once per episode you are HireBot.
// One beat per screen, as Episode 3. Every number and string comes from the engine view and play.l4.*.
import { useRef, useState, type ReactNode } from 'react';
import type { ViewState } from '../../engine/types';
import type { P4Round } from '../../engine/play/ep4';
import type { Group, Job, Policy, Priors } from '../../engine/levels/level4';
import { POLICIES } from '../../engine/levels/level4';
import { PLAY } from '../../engine/play/params';
import { L4 } from '../../engine/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { ChoicesDid } from './Choices';
import { CallChips, CallResults, claimantsNow } from './Call';
import { coins, pct } from '../labels';
import { nameOf, shortName } from '../game';
import type { CastCue } from './Cast';
import { Chips, Details, StagedReveal, peakMark, spotlightSteps } from './Peak';
import { Coach } from './Coach';
import { BigButton, Bubble, Face, Stage } from './OnAir';
import { GiftBar, Tile, roundClaims } from './Episode3';
import { hostLine, pick, timesWord } from './logic';

type Gift = { to: string; amount: number };

export type L4View = {
  groups: Record<string, Group>;
  care: Record<string, boolean>;
  priors: Priors;
  policy: Policy;
  policyVotes?: Record<string, Policy>;
  judge: string;
  judges?: string[];
  myCost?: number;
  myCostBase?: number;
  rounds: Array<Partial<P4Round>>;
  current?: Partial<P4Round>;
  threshold: number;
  meterShown: boolean;
  cardsOpen: boolean;
};

const lv4 = (v: ViewState) => v.levelView as L4View;
export const groupName = (g: Group) => t(`play.l4.group.${g}`);
const policyName = (p: Policy) => t(`levels.4.policies.${p}.name`);

function GiftTile({ v, gift, setGift }: { v: ViewState; gift: Gift | null; setGift: (g: Gift | null) => void }) {
  return <GiftBar v={v} gift={gift} onPick={setGift} short />;
}

/**
 * V6 (D-218): "Why?" on an Episode 4 decision screen. The screen shows only what the choice needs; the
 * numbers behind it (beliefs, the meter, the rule) open in place of the choice, and "Back" returns.
 */
function WhyButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle(); }} className="min-h-[44px] shrink-0 rounded-xl bg-card px-3 text-small font-bold underline" data-why>
      {t(open ? 'play.l4.why.back' : 'play.l4.why.open')}
    </button>
  );
}

function WhyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-1 rounded-2xl bg-card p-3 text-small" data-why-panel>
      {children}
    </div>
  );
}

const priorOf = (lv: L4View, id: string) => (lv.policy === 'B' && lv.priors.POOL !== null ? lv.priors.POOL : lv.priors[lv.groups[id]]);
const beliefLine = (lv: L4View, id: string) =>
  t(lv.policy === 'B' ? 'play.l4.train.beliefBlind' : 'play.l4.train.belief', { group: groupName(lv.groups[id]), p: pct(priorOf(lv, id)) });
/** The judge's loss on a bad hire this round, from the hiring line (an event can change it): line = loss / (gain + loss). */
const judgeLossOf = (lv: L4View) => Math.round((PLAY.L4.JUDGE_GAIN * lv.threshold) / Math.max(1e-9, 1 - lv.threshold));

/** Before the first decision: your group, your childcare duty, and who judges when. */
export function MyCards4({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv4(v);
  const me = v.viewer;
  const order = (lv.judges ?? [lv.judge]).map((id) => v.players.find((p) => p.id === id)!);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-mycards>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.l4.cards.label')}</p>
        <p className="h-show mt-2 text-hero leading-none text-spot">{groupName(lv.groups[me])}</p>
        <p className="mt-3 text-body">{t(lv.care[me] ? 'play.l4.cards.care' : 'play.l4.cards.noCare', { n: L4.CHAOS_COST })}</p>
        <p className="mt-3 text-body">{t('play.l4.cards.public')}</p>
        <p className="mt-3 text-small font-semibold">{t('play.l4.cards.judges', { names: order.map((p) => shortName(v, p.id)).join(', ') })}</p>
      </div>
    </Stage>
  );
}

/** Worker move (V6, D-218): one question, two tiles that say what each costs and what it changes; a gift. */
export function TrainScreen({ v }: { v: ViewState }) {
  const lv = lv4(v);
  const act = useStore((s) => s.act);
  const [train, setTrain] = useState(false);
  const [gift, setGift] = useState<Gift | null>(null);
  const [why, setWhy] = useState(false);
  const cut = lv.myCostBase !== undefined && lv.myCostBase !== lv.myCost;
  return (
    <Stage v={v} footer={<BigButton onClick={() => act({ train, gift })}>{t('play.stage.lock')}</BigButton>}>
      <div className="flex items-start gap-2">
        <h1 className="h-show flex-1 text-title leading-tight">{t('play.l4.train.title')}</h1>
        <WhyButton open={why} onToggle={() => setWhy(!why)} />
      </div>
      {why ? (
        <div className="mt-2">
          <WhyPanel>
            <p>{t('play.l4.judgeIs', { name: shortName(v, lv.judge) })}.</p>
            <p>{beliefLine(lv, v.viewer)}</p>
            <p>{t('play.l4.why.trainHow')}</p>
            {lv.care[v.viewer] && <p>{t('play.l4.res.care', { n: L4.CHAOS_COST })}</p>}
          </WhyPanel>
        </div>
      ) : (
        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <Tile on={train} title={t('play.l4.train.tile')} desc={cut ? t('play.l4.train.costCut', { c: lv.myCost ?? 0, was: lv.myCostBase, p: pct(L4.PASS_IF_SKILLED) }) : t('play.l4.train.cost', { c: lv.myCost ?? 0, p: pct(L4.PASS_IF_SKILLED) })} onClick={() => setTrain(true)} />
          <Tile on={!train} title={t('play.l4.train.skip')} desc={t('play.l4.train.skipDesc', { p: pct(L4.PASS_IF_UNSKILLED) })} onClick={() => setTrain(false)} />
        </div>
      )}
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
      <h1 className="h-show text-hero leading-tight">{t('play.l4.claim.title')}</h1>
      <Coach id="claim" />
      <div className="mt-3 rounded-2xl bg-card p-3">
        <p className="h-show text-title leading-tight">{t(trained ? 'play.l4.claim.youT' : 'play.l4.claim.youU')}</p>
      </div>
      <p className="mt-2 text-small">{t('play.l4.claim.how', { name: shortName(v, lv.judge) })}</p>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.l4.claim.title')}>
        {['TRAINED', 'SILENT'].map((o) => (
          <button key={o} type="button" aria-pressed={x === o} onClick={() => setX(o)} className={`block w-full rounded-2xl p-3 text-start ${x === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-lead leading-tight">{t(`play.l4.claim.opts.${o}`)}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** A cream stamp: the test result, "PASSED" or "FAILED". */
function TestStamp({ pass }: { pass: boolean }) {
  return (
    <span className={`h-show inline-block -rotate-6 whitespace-nowrap rounded-lg border-[3px] bg-[#fff4e0] px-1.5 py-0.5 text-[14px] uppercase leading-none shadow-stamp ${pass ? 'border-[#13675a] text-[#13675a]' : 'border-[#c2341f] text-[#c2341f]'}`} data-test-stamp={pass ? 'PASSED' : 'FAILED'}>
      {t(pass ? 'play.l4.judge.stampPass' : 'play.l4.judge.stampFail')}
    </span>
  );
}

/**
 * You are HireBot (V6, D-218): for each worker, three things only: their face and claim bubble, the test as a
 * PASSED or FAILED stamp, and HireBot's suggestion in one line. What a hire means for you, in coins, sits
 * above the two jobs. Group, beliefs and the meter are behind "Why?".
 */
export function JudgeScreen({ v }: { v: ViewState }) {
  const lv = lv4(v);
  const act = useStore((s) => s.act);
  const c = lv.current!;
  const workers = c.workers ?? [];
  const [hires, setHires] = useState<Record<string, Job>>(() => Object.fromEntries(workers.map((w) => [w, 'SIMPLE' as Job])));
  const [gift, setGift] = useState<Gift | null>(null);
  const [call, setCall] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
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
  const meter = lv.meterShown && c.meter ? c.meter[w] : null;
  const said = claims[w] === 'TRAINED';
  return (
    <Stage v={v} cast={{ focus: w }} footer={<BigButton onClick={() => act({ hires, gift, call })}>{t('play.l4.judge.submit')}</BigButton>}>
      <div
        className="rounded-2xl bg-card p-2.5"
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
        <h1 className="h-show text-lead leading-tight">{t('play.l4.judge.which', { name: shortName(v, w) })}</h1>
        {why ? (
          <div className="mt-1 space-y-1 text-small" data-why-panel>
            <p>{lv.policy === 'B' ? t('play.l4.why.blind') : t('play.l4.why.group', { name: shortName(v, w), group: groupName(lv.groups[w]) })}</p>
            <p>{beliefLine(lv, w)}</p>
            {meter !== null ? (
              <div aria-label={t('play.l4.meter', { p: pct(meter) })} role="img">
                <div className="relative mt-1 h-4 rounded-full bg-paper">
                  <div className={`absolute inset-y-0 left-0 rounded-full ${meter >= lv.threshold ? 'bg-good' : 'bg-stamp'}`} style={{ width: `${Math.round(meter * 100)}%` }} />
                  <div className="absolute -inset-y-1 w-1 rounded bg-spot" style={{ left: `calc(${Math.round(lv.threshold * 100)}% - 2px)` }} />
                </div>
                <p className="mt-1">{t('play.l4.why.meter', { p: pct(meter), line: pct(lv.threshold) })}</p>
              </div>
            ) : (
              <p>{t('play.l4.why.noMeter')}</p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-1 flex items-center gap-2">
              <Face v={v} p={p} size={40} />
              <p className="relative rounded-2xl rounded-bl-sm bg-paper px-3 py-1.5 text-body font-bold" data-claim-bubble>
                {t(said ? 'play.l4.judge.bubbleT' : 'play.l4.judge.bubbleSilent')}
              </p>
              <span className="ms-auto">
                <TestStamp pass={!!c.pass?.[w]} />
              </span>
            </div>
            {meter !== null && (
              <p className="mt-1.5 text-small font-semibold" data-suggest>
                {t(meter >= lv.threshold ? 'play.l4.judge.suggestComplex' : 'play.l4.judge.suggestSimple')}
              </p>
            )}
          </>
        )}
        <p className="mt-1 text-small" data-hire-coins>{t('play.l4.judge.coins', { g: PLAY.L4.JUDGE_GAIN, l: judgeLossOf(lv) })}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label={t('play.l4.judge.jobFor', { name: shortName(v, w) })}>
          {(['COMPLEX', 'SIMPLE'] as Job[]).map((job) => (
            <button key={job} type="button" aria-pressed={hires[w] === job} onClick={() => choose(job)} className={`min-h-[44px] rounded-xl text-body font-bold ${hires[w] === job ? 'bg-spot text-onspot' : 'bg-paper'}`} data-hire={`${w}:${job}`}>
              {t(job === 'COMPLEX' ? 'play.l4.complex' : 'play.l4.simple')}
            </button>
          ))}
        </div>
      </div>
      <CallChips v={v} claimants={claimantsNow(v, (x) => x === 'TRAINED')} value={call} onPick={setCall} short />
      {/* V6 (D-218): the worker tabs (faces) and the gift share one row; an open gift picker takes the row. */}
      <div className="mt-auto flex gap-1.5 pt-2">
        {workers.length > 1 && !giftOpen && (
          <div className="flex flex-[3] gap-1.5" role="group" aria-label={t('play.l4.judge.label', { k: Math.min(k, workers.length - 1) + 1, n: workers.length })}>
            {workers.map((x, i) => {
              const px = v.players.find((y) => y.id === x)!;
              return (
                <button key={x} type="button" onClick={() => setK(i)} aria-current={i === k} aria-label={`${shortName(v, x)}: ${t(hires[x] === 'COMPLEX' ? 'play.l4.complex' : 'play.l4.simple')}`} className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl ${i === k ? 'border-2 border-spot' : ''} ${hires[x] === 'COMPLEX' ? 'bg-spot' : 'bg-card'}`} data-worker-tab={x}>
                  <Face v={v} p={px} size={28} ring={false} />
                </button>
              );
            })}
          </div>
        )}
        {!giftOpen && <WhyButton open={why} onToggle={() => setWhy(!why)} />}
        <div className="flex-[2]" onClickCapture={() => setGiftOpen(true)}>
          <GiftBar v={v} gift={gift} onPick={(g) => { setGift(g); setGiftOpen(false); }} short />
        </div>
      </div>
    </Stage>
  );
}

export function PolicyScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<Policy | null>(null);
  const [why, setWhy] = useState(false);
  const one = (lv4(v).judges?.length ?? PLAY.L4.ROUNDS) - PLAY.L4.BASELINE_ROUNDS === 1;
  return (
    <Stage v={v} footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.l4.policy.submit')}</BigButton>}>
      <div className="flex items-start gap-2">
        <h1 className="h-show flex-1 text-title leading-tight">{t('play.l4.policy.title')}</h1>
        <WhyButton open={why} onToggle={() => setWhy(!why)} />
      </div>
      {why ? (
        <div className="mt-2">
          <WhyPanel>
            <p>{t(one ? 'play.l4.policy.howOne' : 'play.l4.policy.how')}</p>
            {POLICIES.map((p) => (
              <p key={p}>
                <span className="font-bold">{policyName(p)}:</span> {t(`play.l4.policy.long.${p}`)}
              </p>
            ))}
          </WhyPanel>
        </div>
      ) : (
        <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.l4.policy.title')}>
          {POLICIES.map((p) => (
            <button key={p} type="button" aria-pressed={x === p} onClick={() => setX(p)} className={`block w-full rounded-2xl p-2.5 text-start ${x === p ? 'bg-spot text-onspot' : 'bg-card'}`}>
              <span className="h-show block text-lead leading-tight">{policyName(p)}</span>
              <span className="block text-small">{t(`play.l4.policy.short.${p}`)}</span>
            </button>
          ))}
        </div>
      )}
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
    <Stage v={v} cast={cue} onTap={next} footer={<BigButton beatNext={!last} onClick={next}>{last ? t('play.stage.tap') : t('play.stage.nextRound', { r: v.round + 1 })}</BigButton>}>
      <div className="my-auto" data-outcome>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.l4.res.label', { r: v.round })}</p>
        {/* V5 N3: in the last round the rows below say it (the screen stays under 45 words). */}
        {!last && <h1 className="h-show mt-1 text-title leading-tight text-spot">{youLine}</h1>}
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
        {/* UI V4 (V3): what your choices did; it adds up to the bank change. */}
        {/* V5 N3: at most 45 words: the workers' hires are the stamps on the stage; before the last round, what
            your choices did shows on the next round's first screen. */}
        {last && <ChoicesDid v={v} />}
        <CallResults v={v} quiet />
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
