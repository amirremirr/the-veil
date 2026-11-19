// Episode 3, "Bad Luck Season", rebuilt as The Pool (PLAY_V2_SPEC.md Section 4): claim, then the move
// (the Bar and cover), then the wheel and the price board; the risk cards flip at the end. One beat per
// screen (D-108). Same premium formula as Study; every screen only shows outcomes the engine decided.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Choice, Gift, L3Round, Regime, RiskType } from '../../engine/levels/level3';
import type { Message, ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { CallChips, CallResults, claimantsNow } from './Call';
import { coins, pct, signed } from '../labels';
import { nameOf, shortName, useTalkFrom } from '../game';
import { useMotionOff } from '../components/common';
import { ChoicesDid } from './Choices';
import { Coach } from './Coach';
import { BigButton, Bubble, Face, Stage } from './OnAir';
import { Chips, Details, StagedReveal, peakMark, spotlightSteps } from './Peak';
import { type CastCue } from './Cast';
import { buzz, sfx } from './sound';
import { confessional, hostLine, pick, roundOutcome, timesWord, verbOn } from './logic';
import { renderMessage } from '../game';

export type L3View = {
  myType: RiskType;
  regime: Regime;
  insurerActive: boolean;
  premium: number | null;
  regimeVotes?: Record<string, Regime>;
  regimeCounts?: number[];
  regimeTie?: boolean;
  rounds: L3Round[];
  /** Public once leaked or at the end reveal. */
  types?: Record<string, RiskType>;
  leaked?: number | null;
  cardsRevealed?: boolean;
  /** Last round's pool members, who vote on the bar this round. */
  members?: string[];
  /** D-128: your own worry card, and everyone's once the cards flip. */
  myWorry?: 'WORRIER' | 'CALM';
  worry?: Record<string, 'WORRIER' | 'CALM'>;
};
const REGIMES: Regime[] = ['VOL', 'M50', 'M100'];
export const regimeName = (r: Regime) => t(`play.l3.regimes.${r}.name`);
const lv3 = (v: ViewState) => v.levelView as L3View;

/** Your own odds this round (you know your type and the event). */
export function myOdds(v: ViewState, gym: boolean): number {
  const n = v.play!.l3!;
  const base = (lv3(v).myType === 'HIGH' ? n.pHigh : n.pLow) * (gym ? n.gymFactor : 1);
  return n.riskMult === 1 ? base : Math.min(n.riskCap, base * n.riskMult);
}

/** The latest message of this talk, as one bubble (the full log is in the menu). */
export function LatestMessage({ v }: { v: ViewState }) {
  const talkFrom = useTalkFrom();
  const msgs = v.messages.filter((m) => m.level === v.levelIndex && (talkFrom !== null ? m.id >= talkFrom : m.round === v.round));
  const m = msgs[msgs.length - 1];
  if (!m) return null;
  const from = v.players.find((p) => p.id === m.from);
  return <Bubble who={shortName(v, m.from)} text={renderMessage(v, m)} bot={from} />;
}

/** A big tap tile (Play spec redesign: choices are tiles, not checkboxes). */
export function Tile({ on, title, desc, note, onClick, disabled = false }: { on: boolean; title: string; desc: string; note?: string | null; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={onClick ? on : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[96px] flex-col justify-between rounded-2xl p-2.5 text-start transition-colors disabled:cursor-default ${on ? 'bg-spot text-onspot' : 'bg-card text-ink'}`}
    >
      <span aria-hidden className={`grid h-6 w-6 place-items-center rounded-full border-2 ${onClick ? '' : 'invisible'} ${on ? 'border-onspot bg-onspot' : 'border-soft'}`}>
        {on && (
          <svg viewBox="0 0 12 12" className="h-3 w-3">
            <path d="M2 6.5 L5 9 L10 3" fill="none" strokeWidth="2" className="stroke-spot" />
          </svg>
        )}
      </span>
      <span>
        <span className="h-show block text-lead leading-tight">{title}</span>
        <span className="mt-1 block text-small leading-snug">{desc}</span>
        {/* Loop cycle 3 (D-169): a choice's mission effect shows once it is selected, so players don't just pick the biggest number. */}
        {note && (on || !onClick) && (
          <span className="mt-1 block text-small font-bold" data-preview>
            {note}
          </span>
        )}
      </span>
    </button>
  );
}

/** Whether this round had a claim screen (a pool to get into, and risk types still secret). */
export const claimsOpen = (v: ViewState) => {
  const lv = lv3(v);
  return lv.regime === 'VOL' && lv.insurerActive && !lv.leaked;
};

/** This round's claims, by speaker (public messages). */
export function roundClaims(v: ViewState, round = v.round): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of v.messages as Message[]) if (m.level === v.levelIndex && m.round === round && m.msg.type === 'CLAIM') out[m.from] = m.msg.value;
  return out;
}

const claimShort = (value: string | undefined) => (value ? t(`play.claim.short.${value}`) : t('play.claim.short.SILENT'));

/** v2 3.1, CLAIM: tell the pool how risky you are, truthfully or not, or say nothing. */
export function ClaimScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv3(v);
  const [x, setX] = useState<string | null>(null);
  const opts = ['LOW', 'HIGH', 'SILENT'];
  return (
    <Stage v={v} chatFirst footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.claim.submit')}</BigButton>}>
      <h1 className="h-show text-title leading-tight">{t('play.claim.title')}</h1>
      <Coach id="claim" />
      <p className="mt-1 text-body font-semibold">{t(`play.claim.you.${lv.myType}`, { p: pct(myOdds(v, false)), worry: t(`play.myCards.worry.${lv.myWorry ?? 'CALM'}`) })}</p>
      <p className="text-small">{t('play.claim.why')}</p>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.claim.title')}>
        {opts.map((o) => (
          <button key={o} type="button" aria-pressed={x === o} onClick={() => setX(o)} className={`block min-h-[48px] w-full rounded-2xl px-3 py-2 text-start ${x === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-lead leading-tight">{t(`play.claim.opts.${o}.title`)}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** D-128: before the first claim, your two private cards and what they mean. */
export function MyCardsBeat({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv3(v);
  const worry = lv.myWorry ?? 'CALM';
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-mycards>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.myCards.label')}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-3 ${lv.myType === 'HIGH' ? 'bg-stamp text-onspot' : 'bg-good text-onspot'}`}>
            <p className="h-show text-title leading-tight">{t(`play.cards.${lv.myType}`)}</p>
            <p className="mt-1 text-small">{t('play.myCards.riskLine', { p: pct(myOdds(v, false)) })}</p>
          </div>
          <div className={`rounded-2xl p-3 ${worry === 'WORRIER' ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <p className="h-show text-title leading-tight">{t(`play.myCards.worry.${worry}`)}</p>
            <p className="mt-1 text-small">{t(`play.myCards.worryLine.${worry}`, { r: pct(PLAY.WORRIER_DEBT_RATE) })}</p>
          </div>
        </div>
        <p className="mt-4 text-body">{t('play.myCards.unknown')}</p>
      </div>
    </Stage>
  );
}

/** The beat after the claims: everyone's claim, one row each. */
export function ClaimsBeat({ v, next }: { v: ViewState; next: () => void }) {
  const claims = roundClaims(v);
  // D-145: on Easy the audience poll sits beside every claim.
  const poll = v.play!.pollMode === 'ALWAYS' ? (v.play!.poll ?? {}) : {};
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-claims>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.claim.inLabel', { r: v.round })}</p>
        <h1 className="h-show mt-1 text-hero leading-tight text-spot">{t('play.claim.inTitle')}</h1>
        <ul className="mt-4 space-y-2">
          {v.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2">
              <Face v={v} p={p} size={32} />
              <span className="w-20 truncate text-small font-bold">{shortName(v, p.id)}</span>
              <span className={`h-show flex-1 text-lead leading-tight ${claims[p.id] ? '' : 'text-soft'}`}>{claimShort(claims[p.id])}</span>
              {p.id !== v.viewer && poll[p.id] !== undefined && <span className="text-small font-semibold">{t('play.move.poll', { p: pct(poll[p.id]) })}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-small text-soft">{t(v.levelIndex === 1 ? 'play.claim.inNotePoll' : 'play.claim.inNote')}</p>
      </div>
    </Stage>
  );
}

/**
 * v2 3.2 and 3.3: the move. READ: everyone's claim (bubbles) and the audience poll (a mark on each face); a
 * pool member may vote to bar one applicant. ACT: cover, the gym (public) and a gift (D-142, public).
 * UI V4 (V2): one decision per screen. A pool member first answers "Keep someone out of the pool?" on its
 * own screen; then one question, "Buy cover this round?" (or "Hit the gym this round?" when cover is not a
 * choice), with the gym and Give as small optional rows.
 */
export function MoveScreen({ v }: { v: ViewState }) {
  const lv = lv3(v);
  const n = v.play!.l3!;
  const act = useStore((s) => s.act);
  const [buy, setBuy] = useState<boolean | null>(null);
  const [gym, setGym] = useState(false);
  const [bar, setBar] = useState<string | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [call, setCall] = useState<string | null>(null);
  const mandatory = lv.regime !== 'VOL';
  const canBuy = !mandatory && lv.premium !== null;
  const members = lv.members ?? [];
  const member = members.includes(v.viewer);
  const cover = lv.regime === 'M50' ? 50 : 100;
  const T = n.loading * (cover / 100) * n.loss * n.pBar + n.mandateExtra;
  const claims = roundClaims(v);
  const poll = v.play!.poll ?? {};
  const others = v.players.filter((p) => p.id !== v.viewer);
  // D-145: on Easy the audience poll is on every round's move; otherwise the read shows from round 2.
  const always = v.play!.pollMode === 'ALWAYS';
  const showRead = always || (canBuy && v.round > 1);
  const [step, setStep] = useState<'bar' | 'move'>(member && showRead ? 'bar' : 'move');
  // D-121: in the launch round SafeHands has already signed everyone up.
  const launch = PLAY.L3_LAUNCH && v.round === 1 && canBuy;
  const decision: Choice = { buy: canBuy && !launch && !!buy, gym, bar: member ? bar : null, gift, call };
  // The audience's read sits on each face as a small mark, so the screen keeps its words for the question.
  const marks: Record<string, string> = showRead ? Object.fromEntries(Object.entries(poll).map(([id, p]) => [id, pct(p)])) : {};
  if (step === 'bar')
    return (
      <Stage v={v} chatFirst cast={{ marks }} footer={<BigButton onClick={() => setStep('move')}>{t('play.move.barNext')}</BigButton>}>
        <h1 className="h-show text-title leading-tight">{t('play.move.barAsk')}</h1>
        <p className="mt-1 text-small">{t('play.move.barHow')}</p>
        <ul className="mt-auto space-y-1.5 pt-3" role="group" aria-label={t('play.move.barAsk')}>
          {others.map((p) => {
            return (
              <li key={p.id}>
                <button type="button" aria-pressed={bar === p.id} onClick={() => setBar(bar === p.id ? null : p.id)} className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2 text-start ${bar === p.id ? 'bg-stamp text-onspot' : 'bg-card'}`}>
                  <Face v={v} p={p} size={24} />
                  <span className="w-20 truncate text-small font-bold">{shortName(v, p.id)}</span>
                  <span className="flex-1 truncate text-small">{claimShort(claims[p.id])}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" aria-pressed={bar === null} onClick={() => setBar(null)} className={`flex min-h-[48px] w-full items-center rounded-xl px-3 text-start text-small font-bold ${bar === null ? 'bg-spot text-onspot' : 'bg-card'}`}>
              {t('play.move.barNobody')}
            </button>
          </li>
        </ul>
      </Stage>
    );
  const ready = !canBuy || launch || buy !== null;
  return (
    <Stage v={v} chatFirst cast={{ marks }} footer={<BigButton disabled={!ready} onClick={() => act(decision)}>{t('play.stage.lock')}</BigButton>}>
      <h1 className="h-show text-title leading-tight">{t(canBuy && !launch ? 'play.move.coverAsk' : 'play.move.gymAsk')}</h1>
      <p className="text-small font-semibold leading-snug">
        {t('play.move.riskLine', { p: pct(myOdds(v, gym)) })}
        {launch ? ` ${t('play.cast.launchShort', { p: coins(lv.premium!) })}` : mandatory ? ` ${t('play.stage.mandateDesc', { T: coins(T), c: cover })}` : !canBuy ? ` ${t('play.stage.noCoverDesc')}` : ''}
        {showRead && !member ? ` ${t('play.move.readLegend')}` : ''}
      </p>
      <Coach id="move" />
      <CallChips v={v} claimants={claimantsNow(v)} value={call} onPick={setCall} />
      {canBuy && !launch ? (
        <>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-3" role="group" aria-label={t('play.move.coverAsk')}>
            <Tile on={buy === true} title={t('play.stage.buyTitle')} desc={t('play.stage.buyDesc', { p: coins(lv.premium!) })} onClick={() => setBuy(true)} />
            <Tile on={buy === false} title={t('play.stage.noBuyTitle')} desc={t('play.stage.noBuyDesc', { p: coins(lv.premium!), loss: coins(n.loss) })} onClick={() => setBuy(false)} />
          </div>
          <button type="button" aria-pressed={gym} onClick={() => setGym(!gym)} className={`mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-2xl px-3 text-start text-small font-semibold ${gym ? 'bg-spot text-onspot' : 'bg-card'}`} data-gym-row>
            <span aria-hidden className="h-show text-lead">{gym ? '✓' : '+'}</span>
            <span className="flex-1">{t('play.move.gymRow', { c: n.gymCost, p: pct(myOdds(v, true)) })}</span>
          </button>
        </>
      ) : (
        <div className="mt-auto grid grid-cols-2 gap-2 pt-3" role="group" aria-label={t('play.move.gymAsk')}>
          <Tile on={gym} title={t('play.stage.gymTitle')} desc={t('play.stage.gymDesc', { c: n.gymCost, p: pct(myOdds(v, true)) })} onClick={() => setGym(true)} />
          <Tile on={!gym} title={t('play.stage.noGymTitle')} desc={t('play.stage.noGymDesc', { c: n.gymCost, p: pct(myOdds(v, false)) })} onClick={() => setGym(false)} />
        </div>
      )}
      <div className="mt-2">
        <GiftBar v={v} gift={gift} onPick={setGift} />
      </div>
    </Stage>
  );
}

/**
 * UI V3 (U1): Give as one slim bar. UI V4 (V1, V2): the optional second choice of a move screen, collapsed by
 * default; a tap opens the picker in place (no sheet on top), and picking closes it again.
 */
export function GiftBar({ v, gift, onPick, short = false }: { v: ViewState; gift: Gift | null; onPick: (g: Gift | null) => void; short?: boolean }) {
  const [open, setOpen] = useState(false);
  // UI V4 (V2): in a life, Give unlocks in Episode 4.
  if (!verbOn(v, 'give')) return null;
  if (open)
    return (
      <GiftPicker
        v={v}
        gift={gift}
        onPick={(g) => {
          onPick(g);
          setOpen(false);
        }}
      />
    );
  return (
    <button type="button" aria-expanded={false} onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={`flex min-h-[44px] w-full items-center gap-2 rounded-2xl px-3 text-start ${gift ? 'bg-spot text-onspot' : 'bg-card'}`} data-gift-bar>
      {/* V6 (D-218): the short bar (Episode 4) draws its "+" in CSS so it is not read as a word. */}
      {short ? <span aria-hidden className="h-show text-lead before:content-['+']" /> : <span aria-hidden className="h-show text-lead">+</span>}
      <span className="flex-1 text-small font-semibold leading-tight">
        {gift ? (
          short ? (
            t('play.gift.picked', { n: gift.amount, name: shortName(v, gift.to) })
          ) : (
            <>
              <span className="font-bold">{t('play.gift.title')}:</span> {t('play.gift.picked', { n: gift.amount, name: shortName(v, gift.to) })}
            </>
          )
        ) : (
          t(short ? 'play.gift.rowShort' : 'play.gift.row')
        )}
      </span>
    </button>
  );
}

/**
 * D-142: pick a gift: one other contestant, one amount, or none. UI V4 (V1): in place on the screen, two
 * short rows (who, then how much), so it fits under the main choice.
 */
export function GiftPicker({ v, gift, onPick }: { v: ViewState; gift: Gift | null; onPick: (g: Gift | null) => void }) {
  const others = v.players.filter((p) => p.id !== v.viewer);
  const [to, setTo] = useState<string>(gift?.to ?? others[0]?.id ?? '');
  return (
    <section className="rounded-2xl border-2 border-spot bg-card p-2" aria-labelledby="gift-title" onClick={(e) => e.stopPropagation()} data-gift-sheet>
      <p id="gift-title" className="text-small font-bold">
        {t('play.gift.sheet')} <span className="font-normal text-soft">{t('play.gift.how')}</span>
      </p>
      <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${others.length}, minmax(0, 1fr))` }} role="group" aria-label={t('play.gift.who')}>
        {others.map((p) => (
          <button key={p.id} type="button" aria-pressed={to === p.id} onClick={() => setTo(p.id)} className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl px-1 text-small font-bold ${to === p.id ? 'bg-spot text-onspot' : 'bg-paper'}`} data-gift-to={p.id}>
            <Face v={v} p={p} size={24} ring={false} />
            <span className="truncate">{shortName(v, p.id)}</span>
          </button>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1">
        {PLAY.GIFT_AMOUNTS.map((a) => {
          const on = gift?.to === to && gift.amount === a;
          return (
            <button key={a} type="button" aria-pressed={on} onClick={() => onPick({ to, amount: a })} className={`min-h-[44px] rounded-xl px-1 text-small font-bold ${on ? 'bg-spot text-onspot' : 'bg-paper'}`} data-gift={`${to}:${a}`}>
              {t('play.gift.give', { n: a })}
            </button>
          );
        })}
        <button type="button" className="min-h-[44px] rounded-xl bg-paper px-1 text-small font-bold" onClick={() => onPick(null)} data-gift="none">
          {t('play.gift.none')}
        </button>
      </div>
    </section>
  );
}

/** One contestant's checked claims of this episode, in order. */
function checkedClaims(v: ViewState, id: string): Array<{ round: number; value: string; kept: boolean }> {
  return (v.messages as Message[])
    .filter((m) => m.level === v.levelIndex && m.from === id && m.msg.type === 'CLAIM' && m.resolved)
    .map((m) => ({ round: m.round, value: (m.msg as { value: string }).value, kept: !!m.kept }));
}

/**
 * v2 3.4, the end reveal and the episode's peak: every risk card flips, one contestant at a time, starting
 * with the most surprising (most lies, then the audience's biggest wrong read), each claim stamped.
 */
export function CardsReveal({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv3(v);
  const types = lv.types ?? {};
  const worry = lv.worry ?? {};
  const poll = v.play!.poll ?? {};
  // D-128 stamps: a low-risk Worrier who applied or was barred, and a high-risk Calm player who never applied.
  const voluntary = lv.rounds.filter((r) => r.regime === 'VOL' && r.premium !== null && !r.launch);
  const appliedEver = (id: string) => voluntary.some((r) => r.applied?.[id]);
  const barredEver = (id: string) => lv.rounds.some((r) => r.bar?.barred.includes(id));
  const note = (id: string) =>
    types[id] === 'LOW' && worry[id] === 'WORRIER' && (appliedEver(id) || barredEver(id))
      ? t('play.cards.justWorrier')
      : types[id] === 'HIGH' && worry[id] === 'CALM' && voluntary.length && !appliedEver(id)
        ? t('play.cards.tooCalm')
        : '';
  const rows = v.players.map((p) => {
    const cl = checkedClaims(v, p.id);
    const lies = cl.filter((c) => !c.kept).length;
    const wrong = poll[p.id] === undefined ? 0 : Math.abs(poll[p.id] - (types[p.id] === 'HIGH' ? 1 : 0));
    return { p, cl, lies, wrong };
  });
  rows.sort((a, b) => b.lies - a.lies || b.wrong - a.wrong);
  const top = rows[0];
  const line = top.lies
    ? t(top.p.id === v.viewer ? 'play.cards.peakLieYou' : 'play.cards.peakLie', { name: nameOf(v, top.p.id), n: timesWord(top.lies), truth: t(`play.cards.${types[top.p.id]}`).toLowerCase() })
    : hostLine('peakHonest', pick(v, 'peakHonest', 6));
  const chips = (cl: Array<{ round: number; value: string; kept: boolean }>) =>
    cl.length ? (
      <Chips items={cl.map((c) => ({ text: t('play.cards.stamp', { r: c.round, claim: t(`play.cards.word.${c.value}`), stamp: t(c.kept ? 'play.cards.TRUE' : 'play.cards.LIE') }), lie: !c.kept }))} />
    ) : (
      <span className="text-small text-soft">{t('play.cards.noClaims')}</span>
    );
  const head = (p: ViewState['players'][number], big: boolean) => (
    <div className="flex items-center gap-2">
      <span className={`flex-1 truncate font-bold ${big ? 'h-show text-lead' : 'text-small'}`}>{shortName(v, p.id)}</span>
      {worry[p.id] && <span className={`rounded-md px-1.5 text-small font-bold ${worry[p.id] === 'WORRIER' ? 'bg-spot text-onspot' : 'bg-paper text-ink'}`}>{t(`play.myCards.worry.${worry[p.id]}`)}</span>}
      <span className={`h-show rounded-md px-2 text-body ${types[p.id] === 'HIGH' ? 'bg-stamp text-onspot' : 'bg-good text-onspot'}`}>{t(`play.cards.${types[p.id]}`)}</span>
    </div>
  );
  const { steps, final } = spotlightSteps(
    rows.map(({ p, cl, lies }) => ({
      id: p.id,
      ...peakMark(v, p.id, lies, cl.length),
      body: (
        <div className="rounded-2xl bg-card p-3">
          {head(p, true)}
          {note(p.id) && <p className="mt-1 text-small font-bold text-spot">{note(p.id)}</p>}
          <div className="mt-2">{chips(cl)}</div>
        </div>
      ),
    })),
    <>
      <p className="h-show text-lead leading-tight" data-peak-headline>{line}</p>
      <Details>
        <ul className="space-y-1" data-cards-list>
        {rows.map(({ p, cl }) => (
          <li key={p.id} className="rounded-2xl bg-card px-3 py-1">
            {head(p, false)}
            {note(p.id) && <p className="text-small font-bold text-spot">{note(p.id)}</p>}
            <div className="mt-0.5">{chips(cl)}</div>
          </li>
        ))}
      </ul>
      </Details>
      <div className="mt-2">
        <Bubble who="Dash" host text={hostLine(top.lies ? 'caught' : 'peakHonest', pick(v, 'peakFinal', 6))} mood={top.lies ? 'excited' : 'wink'} />
      </div>
    </>,
  );
  return <StagedReveal v={v} label={t('play.cards.label')} title={t('play.cards.title')} steps={steps} final={final} onDone={() => act()} />;
}

export function RegimeScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<Regime | null>(null);
  return (
    <Stage v={v} chatFirst footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.l3.regimeSubmit')}</BigButton>}>
      <h1 className="h-show text-hero">{t('play.l3.regimeTitle')}</h1>
      <p className="mt-1 text-small text-soft">{t('play.l3.regimeDecide')}</p>
      <div className="mt-3">
      </div>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.l3.regimeTitle')}>
        {REGIMES.map((r) => (
          <button key={r} type="button" aria-pressed={x === r} onClick={() => setX(r)} className={`block w-full rounded-2xl p-3 text-start ${x === r ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-lead leading-tight">{regimeName(r)}</span>
            <span className="block text-small">{t(`play.l3.regimes.${r}.desc`)}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

const WHEEL_R = 46;
function slice(share: number): string {
  const a = Math.min(0.9999, share) * 2 * Math.PI;
  const x = 50 + WHEEL_R * Math.sin(a);
  const y = 50 - WHEEL_R * Math.cos(a);
  return `M50 50 L50 ${50 - WHEEL_R} A${WHEEL_R} ${WHEEL_R} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

/** Each contestant's outcome this round, from public data (plus your own odds). */
function outcomeOf(r: L3Round, id: string, loss: number): { kind: 'SAFE' | 'HIT' | 'COVERED'; lost: number } {
  if (!r.events[id]) return { kind: 'SAFE', lost: 0 };
  if (r.regime === 'VOL') return r.choices[id].buy && r.premium !== null ? { kind: 'COVERED', lost: 0 } : { kind: 'HIT', lost: loss };
  if (r.regime === 'M50') return { kind: 'HIT', lost: loss / 2 };
  return { kind: 'COVERED', lost: 0 };
}

/**
 * Beat (a)+(b): your wheel, big, stopping where the engine's draw landed; SAFE, HIT or COVERED; your bank
 * change; everyone else in one small row; one voice. The spin takes at most REVEAL_MAX_MS, can be skipped,
 * and is instant with reduced motion.
 */
export function WheelBeat({ v, next, last }: { v: ViewState; next: () => void; last: boolean }) {
  const lv = lv3(v);
  const n = v.play!.l3!;
  const r = lv.rounds[lv.rounds.length - 1];
  const off = useMotionOff();
  const [done, setDone] = useState(off);
  const spinMs = Math.min(PLAY.REVEAL_MAX_MS, 2400);
  useEffect(() => {
    if (off) return setDone(true);
    const id = setTimeout(() => setDone(true), spinMs);
    return () => clearTimeout(id);
  }, [off, spinMs]);
  const me = v.viewer;
  const odds = r.pEff[me];
  const mine = outcomeOf(r, me, n.loss);
  const hit = r.events[me];
  const turn = (r.eventCards[me] % 100) / 100;
  const land = hit ? (odds / 2) * 360 : (odds + (1 - odds) * (0.3 + 0.4 * turn)) * 360;
  const final = 4 * 360 + (360 - land);
  const hist = v.play!.bankHistory;
  const h = hist[hist.length - 1];
  // D-142: gifts land after the wheel; the change and the bank include them.
  const change = r.W[me] + (r.giftNet?.[me] ?? 0) - (v.play!.l3?.livingCost ?? PLAY.LIVING_COST);
  const giftLine = giftLines(v, r.gifts);
  const from = h.banks[me] - change;
  const ch = r.choices[me];
  // What you chose this round, next to the money it made (playtest note).
  const bought = ch.buy && r.premium !== null;
  const refused = !!r.applied?.[me] && !bought;
  const chose =
    r.regime !== 'VOL' ? (ch.gym ? 'planGym' : 'plan') : r.launch ? (ch.gym ? 'launchGym' : 'launch') : refused ? 'refused' : bought && ch.gym ? 'both' : bought ? 'cover' : ch.gym ? 'gym' : r.premium === null ? 'noneClosed' : 'none';
  const outcome = roundOutcome(v, r);
  const subjectBot = v.players.find((p) => p.id === outcome.subject && !p.isHuman && p.botKey);
  const voice = subjectBot
    ? { who: shortName(v, subjectBot.id), text: confessional(subjectBot.botKey!, outcome.key, pick(v, `conf-${subjectBot.id}`, 4)), host: false, bot: subjectBot }
    : { who: 'Dash', text: hostLine(outcome.key, pick(v, `out-${outcome.key}`, 6), { name: outcome.subject ? nameOf(v, outcome.subject) : '' }, outcome.subject === me), host: true, bot: undefined };
  const advance = () => (done ? next() : setDone(true));
  // UI V3 (U1, U2): ticks that slow down while the wheel turns, then a chime or a thud; the stage reacts.
  useEffect(() => {
    if (off || done) return;
    const timers: number[] = [];
    let at = 0;
    for (let k = 0; at < spinMs - 150; k++) {
      timers.push(window.setTimeout(() => sfx('tick'), at));
      at += 60 + 14 * k * k * 0.12 + 6 * k;
    }
    return () => timers.forEach(clearTimeout);
  }, [off, done, spinMs]);
  useEffect(() => {
    if (!done) return;
    sfx(hit && mine.kind === 'HIT' ? 'hit' : 'safe');
    if (mine.kind === 'HIT' && !off) buzz([60, 40, 60]);
  }, [done]);
  const prevBanks = hist.length > 1 ? hist[hist.length - 2].banks : undefined;
  const cue: CastCue = done
    ? {
        stamps: Object.fromEntries(
          v.players.map((p) => {
            const o = outcomeOf(r, p.id, n.loss);
            return [p.id, o.kind === 'HIT' ? { text: `${t('play.stage.HIT')} −${coins(o.lost)}`, tone: 'stamp' as const } : { text: t(`play.stage.${o.kind}`), tone: 'good' as const }];
          }),
        ),
        expr: Object.fromEntries(v.players.map((p) => [p.id, outcomeOf(r, p.id, n.loss).kind === 'HIT' ? 'shocked' : 'pleased'])),
        flash: Object.fromEntries(v.players.map((p) => [p.id, outcomeOf(r, p.id, n.loss).kind === 'HIT' ? 'hit' : 'gain'])),
      }
    : { banks: prevBanks, expr: Object.fromEntries(v.players.map((p) => [p.id, 'neutral'])) };
  return (
    <Stage
      v={v}
      cast={cue}
      flash={done ? (mine.kind === 'HIT' ? 'hit' : change > 0 ? 'gain' : null) : null}
      onTap={advance}
      footer={
        <BigButton beatNext={!last} onClick={advance}>
          {done ? t('play.stage.tap') : t('play.l3.skip')}
        </BigButton>
      }
    >
      <p className="text-center text-small font-bold uppercase tracking-wider text-soft">{t('play.stage.resultsOf', { r: v.round })}</p>
      <h1 className="h-show mt-1 text-center text-title leading-tight">{t('play.l3.wheel')}</h1>
      <div className={`relative mx-auto mt-1 ${last ? 'h-20 w-20' : 'h-28 w-28'}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
          <motion.g style={{ originX: '50px', originY: '50px' }} initial={{ rotate: 0 }} animate={{ rotate: done ? final : off ? final : [0, final] }} transition={{ duration: done || off ? 0 : spinMs / 1000, ease: 'easeOut' }}>
            <circle cx="50" cy="50" r={WHEEL_R} className="fill-good/80" />
            <path d={slice(odds)} className="fill-stamp" />
          </motion.g>
          <circle cx="50" cy="50" r={WHEEL_R + 2} fill="none" className="stroke-spot" strokeWidth="3" />
          <path d="M50 0 L45 9 L55 9 Z" className="fill-ink" />
        </svg>
        {done && (
          <span
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-6 rounded-lg border-4 px-4 py-1 text-title font-black ${mine.kind === 'HIT' ? 'border-stamp bg-ink text-[rgb(18,14,36)]' : 'border-onspot bg-ink text-[rgb(18,14,36)]'}`}
            data-outcome={mine.kind}
          >
            {t(`play.stage.${mine.kind}`)}
          </span>
        )}
      </div>
      {done ? (
        <div className="mt-3 text-center" aria-live="polite">
          <p className="flex items-baseline justify-center gap-3">
            <span className={`h-show text-hero ${change < 0 ? 'text-stamp' : 'text-spot'}`}>{signed(Math.round(h.banks[me]) - Math.round(from))}</span>
            <span className="text-body font-semibold" data-chose>
              {t(`play.stage.chose.${chose}`)}
            </span>
          </p>
          {/* UI V4 (V3): what each of your choices did, then luck, then everyone else; it adds up to the change. */}
          {/* V5 N3: the Bar's result is a line here, not a screen of its own. */}
          {r.bar && (
            <p className="mt-1 text-small font-semibold" data-bar={r.bar.barred.join(' ') || 'none'}>
              {r.bar.barred.length ? t(r.bar.barred.includes(me) ? 'play.carry.barredYou' : 'play.carry.barred', { names: r.bar.barred.map((x) => shortName(v, x)).join(t('play.barBeat.and')) }) : t('play.barBeat.none')}
            </p>
          )}
          {/* UI V4 (V3): what your choices did; V5 N3: before the last round it shows on the next round's first screen. */}
          {last && (
            <div className="text-start">
              <ChoicesDid v={v} />
            </div>
          )}
          <CallResults v={v} quiet />
          {giftLine && <span className="sr-only" data-gifts>{giftLine}</span>}
          {!voice.host && (
            <div className="mt-2 text-start">
              <Bubble who={voice.who} text={voice.text} host={voice.host} bot={voice.bot} />
            </div>
          )}
          {voice.host && <Bubble who={voice.who} text={voice.text} host />}
        </div>
      ) : (
        <p className="mt-6 text-center text-small text-soft">{t('play.cast.spinning')}</p>
      )}
    </Stage>
  );
}

/** This round's gifts as plain lines ("Chet gave Dot 5."); sentences to you stay in the second person (D-146). */
export function giftLines(v: ViewState, gifts: Record<string, Gift> | undefined): string {
  const me = v.viewer;
  return Object.entries(gifts ?? {})
    .map(([from, g]) =>
      from === me ? t('play.gift.youGave', { to: shortName(v, g.to), n: g.amount }) : t(g.to === me ? 'play.gift.gaveYou' : 'play.gift.gave', { from: shortName(v, from), to: shortName(v, g.to), n: g.amount }),
    )
    .join(' ');
}

/** E5 fix: a list of reveal stamps where every LIE stands out. */
export function Stamps({ items }: { items: string[] }) {
  const lie = t('play.cards.LIE');
  return (
    <>
      {items.map((x, i) => (
        <span key={i} className={x.includes(lie) ? 'font-bold text-stamp' : ''}>
          {i > 0 ? ' · ' : ''}
          {x}
        </span>
      ))}
    </>
  );
}
