// Episode 3, "Bad Luck Season", rebuilt as The Pool (PLAY_V2_SPEC.md Section 4): claim, then the move
// (the Bar and cover), then the wheel and the price board; the risk cards flip at the end. One beat per
// screen (D-108). Same premium formula as Study; every screen only shows outcomes the engine decided.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Choice, L3Round, Regime, RiskType } from '../../engine/levels/level3';
import type { Message, ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct, signed } from '../labels';
import { nameOf, shortName, useTalkFrom } from '../game';
import { Avatar, useMotionOff } from '../components/common';
import { fmt1 } from '../components/Money';
import { BigButton, Bubble, Stage } from './OnAir';
import { confessional, dealtLine, hostLine, pick, roundOutcome } from './logic';
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
const lastRound = (v: ViewState) => Math.max(1, ...v.queue.map((p) => p.round));

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
function Tile({ on, title, desc, onClick, disabled = false }: { on: boolean; title: string; desc: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={onClick ? on : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[112px] flex-col justify-between rounded-2xl p-3 text-start transition-colors disabled:cursor-default ${on ? 'bg-spot text-onspot' : 'bg-card text-ink'}`}
    >
      <span aria-hidden className={`grid h-6 w-6 place-items-center rounded-full border-2 ${onClick ? '' : 'invisible'} ${on ? 'border-onspot bg-onspot' : 'border-soft'}`}>
        {on && (
          <svg viewBox="0 0 12 12" className="h-3 w-3">
            <path d="M2 6.5 L5 9 L10 3" fill="none" strokeWidth="2" className="stroke-spot" />
          </svg>
        )}
      </span>
      <span>
        <span className="h-show block text-xl leading-tight">{title}</span>
        <span className="mt-1 block text-xs leading-snug">{desc}</span>
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
      <h1 className="h-show text-4xl leading-tight">{t('play.claim.title')}</h1>
      <div className="mt-3 rounded-2xl bg-card p-3">
        <p className="h-show text-2xl leading-tight">{t(`play.claim.you.${lv.myType}`, { p: pct(myOdds(v, false)), worry: t(`play.myCards.worry.${lv.myWorry ?? 'CALM'}`) })}</p>
        <p className="mt-1 text-base">{dealtLine(v.players.length, true)}</p>
      </div>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.claim.title')}>
        {opts.map((o) => (
          <button key={o} type="button" aria-pressed={x === o} onClick={() => setX(o)} className={`block w-full rounded-2xl p-3 text-start ${x === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-xl leading-tight">{t(`play.claim.opts.${o}.title`)}</span>
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
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.myCards.label')}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className={`rounded-2xl p-3 ${lv.myType === 'HIGH' ? 'bg-stamp text-onspot' : 'bg-good text-onspot'}`}>
            <p className="h-show text-2xl leading-tight">{t(`play.cards.${lv.myType}`)}</p>
            <p className="mt-1 text-sm">{t('play.myCards.riskLine', { p: pct(myOdds(v, false)) })}</p>
          </div>
          <div className={`rounded-2xl p-3 ${worry === 'WORRIER' ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <p className="h-show text-2xl leading-tight">{t(`play.myCards.worry.${worry}`)}</p>
            <p className="mt-1 text-sm">{t(`play.myCards.worryLine.${worry}`, { m: PLAY.WORRIER_STRESS_MULT })}</p>
          </div>
        </div>
        <p className="mt-4 text-base">{dealtLine(v.players.length)}</p>
        <p className="mt-2 text-sm text-soft">{t('play.myCards.note')}</p>
      </div>
    </Stage>
  );
}

/** The beat after the claims: everyone's claim, one row each. */
export function ClaimsBeat({ v, next }: { v: ViewState; next: () => void }) {
  const claims = roundClaims(v);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-claims>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.claim.inLabel', { r: v.round })}</p>
        <h1 className="h-show mt-1 text-4xl leading-tight text-spot">{t('play.claim.inTitle')}</h1>
        <ul className="mt-4 space-y-2">
          {v.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2">
              <Avatar bot={p.botKey} human={p.isHuman} size={32} />
              <span className="w-20 truncate text-sm font-bold">{shortName(v, p.id)}</span>
              <span className={`h-show flex-1 text-lg leading-tight ${claims[p.id] ? '' : 'text-soft'}`}>{claimShort(claims[p.id])}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-soft">{t('play.claim.inNote')}</p>
      </div>
    </Stage>
  );
}

/**
 * v2 3.2 and 3.3: the move. READ: everyone's claim and the audience poll; a pool member may vote to bar
 * one applicant. ACT: cover and the gym (the gym is public).
 */
export function MoveScreen({ v }: { v: ViewState }) {
  const lv = lv3(v);
  const n = v.play!.l3!;
  const act = useStore((s) => s.act);
  const [buy, setBuy] = useState(false);
  const [gym, setGym] = useState(false);
  const [bar, setBar] = useState<string | null>(null);
  const mandatory = lv.regime !== 'VOL';
  const canBuy = !mandatory && lv.premium !== null;
  const members = lv.members ?? [];
  const member = members.includes(v.viewer);
  const decision: Choice = { buy: canBuy && buy, gym, bar: member ? bar : null };
  const cover = lv.regime === 'M50' ? 50 : 100;
  const T = n.loading * (cover / 100) * n.loss * n.pBar + n.mandateExtra;
  const claims = roundClaims(v);
  const poll = v.play!.poll ?? {};
  const others = v.players.filter((p) => p.id !== v.viewer);
  const showRead = canBuy && v.round > 1;
  // D-121: in the launch round SafeHands has already signed everyone up.
  const launch = PLAY.L3_LAUNCH && v.round === 1 && canBuy;
  return (
    <Stage v={v} chatFirst footer={<BigButton onClick={() => act(decision)}>{t('play.stage.lock')}</BigButton>}>
      <p className="text-base leading-snug">
        {dealtLine(v.players.length, true)}{' '}
        <span className="font-semibold">
          {t('play.move.risk')} <span className="h-show text-2xl text-spot" aria-live="polite">{pct(myOdds(v, gym))}</span>
        </span>
      </p>
      {showRead && (
        <section className="mt-2" aria-labelledby="bar-title">
          <h2 id="bar-title" className="text-sm font-bold">
            {member ? t('play.move.barTitle') : t('play.move.notMember')}
          </h2>
          <ul className="mt-2 space-y-1.5" role={member ? 'group' : undefined} aria-label={member ? t('play.move.barTitle') : undefined}>
            {others.map((p) => {
              const share = poll[p.id];
              const body = (
                <>
                  <Avatar bot={p.botKey} human={p.isHuman} size={24} />
                  <span className="w-16 truncate text-sm font-bold">{shortName(v, p.id)}</span>
                  <span className="flex-1 truncate text-xs">{claimShort(claims[p.id])}</span>
                  {share !== undefined && (
                    <span className="text-xs font-semibold" aria-label={t('play.move.pollLabel', { p: pct(share), name: nameOf(v, p.id) })}>
                      {t('play.move.poll', { p: pct(share) })}
                    </span>
                  )}
                </>
              );
              return (
                <li key={p.id}>
                  {member ? (
                    <button type="button" aria-pressed={bar === p.id} onClick={() => setBar(bar === p.id ? null : p.id)} className={`flex min-h-[40px] w-full items-center gap-2 rounded-xl px-2 text-start ${bar === p.id ? 'bg-stamp text-onspot' : 'bg-card'}`}>
                      {body}
                    </button>
                  ) : (
                    <div className="flex min-h-[36px] items-center gap-2 rounded-xl bg-card px-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {member && bar && <p className="mt-1 text-xs font-semibold">{t('play.move.barPick', { name: shortName(v, bar) })}</p>}
        </section>
      )}
      <div className="mt-auto grid grid-cols-2 gap-3 pt-3">
        {launch ? (
          <Tile on disabled title={t('play.stage.launchTitle')} desc={t('play.stage.launchDesc', { p: fmt1(lv.premium!) })} />
        ) : canBuy ? (
          <Tile on={buy} title={t('play.stage.buyTitle')} desc={t('play.stage.buyDesc', { p: fmt1(lv.premium!) })} onClick={() => setBuy(!buy)} />
        ) : mandatory ? (
          <Tile on={false} disabled title={t('play.stage.mandateTitle')} desc={t('play.stage.mandateDesc', { T: coins(T), c: cover })} />
        ) : (
          <Tile on={false} disabled title={t('play.stage.noCoverTitle')} desc={t('play.stage.noCoverDesc')} />
        )}
        <Tile on={gym} title={t('play.stage.gymTitle')} desc={t('play.stage.gymDesc', { c: n.gymCost })} onClick={() => setGym(!gym)} />
      </div>
    </Stage>
  );
}

/** The Bar's result, its own beat before the wheel. */
export function BarBeat({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv3(v);
  const r = lv.rounds[lv.rounds.length - 1];
  const b = r.bar!;
  // D-133: more than one applicant can be barred in a round.
  const names = (xs: string[]) => xs.map((x) => shortName(v, x)).join(t('play.barBeat.and'));
  const one = b.barred.length === 1 ? b.barred[0] : null;
  const head = !b.barred.length
    ? t('play.barBeat.none')
    : one
      ? t(one === v.viewer ? 'play.barBeat.barredYou' : 'play.barBeat.barred', { name: nameOf(v, one) })
      : t('play.barBeat.barredMany', { names: names(b.barred) });
  const r1 = b.refused.length === 1 ? b.refused[0] : null;
  const sub = !b.barred.length
    ? ''
    : !b.refused.length
      ? t('play.barBeat.notApplied')
      : r1
        ? t(r1 === v.viewer ? 'play.barBeat.refusedYou' : 'play.barBeat.refused', { name: shortName(v, r1) })
        : t('play.barBeat.refusedMany', { names: names(b.refused) });
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto text-center" data-bar={b.barred.join(' ') || 'none'}>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.barBeat.label')}</p>
        <p className={`h-show mt-2 text-5xl leading-tight ${b.barred.length ? 'text-stamp' : 'text-spot'}`}>{head}</p>
        {sub && <p className="mt-3 text-base">{sub}</p>}
        <p className="mt-4 text-sm text-soft">
          {b.members.map((m) => t('play.barBeat.vote', { name: shortName(v, m), target: b.votes[m] ? shortName(v, b.votes[m]!) : t('play.barBeat.noOne') })).join(' · ')}
        </p>
      </div>
    </Stage>
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
  const off = useMotionOff();
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
    ? t(top.p.id === v.viewer ? 'play.cards.peakLieYou' : 'play.cards.peakLie', { name: nameOf(v, top.p.id), n: top.lies, truth: t(`play.cards.${types[top.p.id]}`).toLowerCase() })
    : t('play.cards.peakHonest');
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.stage.tap')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.cards.label')}</p>
      <h1 className="h-show mt-1 text-3xl leading-tight text-spot">{t('play.cards.title')}</h1>
      <ul className="mt-2 space-y-1.5" data-cards>
        {rows.map(({ p, cl }, k) => (
          <motion.li
            key={p.id}
            className="rounded-2xl bg-card px-3 py-1.5"
            initial={off ? false : { opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={{ delay: off ? 0 : 0.6 * k, duration: off ? 0 : 0.35 }}
          >
            <div className="flex items-center gap-2">
              <Avatar bot={p.botKey} human={p.isHuman} size={28} />
              <span className="flex-1 truncate text-sm font-bold">{shortName(v, p.id)}</span>
              {worry[p.id] && <span className={`rounded-md px-1.5 text-xs font-bold ${worry[p.id] === 'WORRIER' ? 'bg-spot text-onspot' : 'bg-paper text-ink'}`}>{t(`play.myCards.worry.${worry[p.id]}`)}</span>}
              <span className={`h-show rounded-md px-2 text-base ${types[p.id] === 'HIGH' ? 'bg-stamp text-onspot' : 'bg-good text-onspot'}`}>{t(`play.cards.${types[p.id]}`)}</span>
            </div>
            {note(p.id) && <p className="mt-0.5 text-xs font-bold text-spot">{note(p.id)}</p>}
            <p className="mt-1 flex flex-wrap gap-1 text-[10px]">
              {cl.length ? (
                cl.map((c) => (
                  <span key={c.round} className={`rounded px-1 py-0.5 font-bold ${c.kept ? 'bg-paper text-ink' : 'bg-stamp text-onspot'}`}>
                    {t('play.cards.stamp', { r: c.round, claim: t(`play.cards.word.${c.value}`), stamp: t(c.kept ? 'play.cards.TRUE' : 'play.cards.LIE') })}
                  </span>
                ))
              ) : (
                <span className="text-soft">{t('play.cards.noClaims')}</span>
              )}
            </p>
          </motion.li>
        ))}
      </ul>
      <div className="mt-auto pt-3">
        <Bubble who="Dash" host text={line} />
      </div>
    </Stage>
  );
}

export function RegimeScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<Regime | null>(null);
  return (
    <Stage v={v} chatFirst footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.l3.regimeSubmit')}</BigButton>}>
      <h1 className="h-show text-4xl">{t('play.l3.regimeTitle')}</h1>
      <p className="mt-1 text-sm text-soft">{t('play.l3.regimeDecide')}</p>
      <div className="mt-3">
        <LatestMessage v={v} />
      </div>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.l3.regimeTitle')}>
        {REGIMES.map((r) => (
          <button key={r} type="button" aria-pressed={x === r} onClick={() => setX(r)} className={`block w-full rounded-2xl p-3 text-start ${x === r ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-lg leading-tight">{regimeName(r)}</span>
            <span className="block text-xs">{t(`play.l3.regimes.${r}.desc`)}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** "The vote is in", the beat before round 3. */
export function VoteInBeat({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv3(v);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto text-center" data-vote>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.stage.voteIn')}</p>
        <p className="h-show mt-2 text-5xl leading-tight text-spot">{regimeName(lv.regime)}</p>
        <p className="mt-4 text-sm text-soft">{v.players.map((p) => `${shortName(v, p.id)}: ${regimeName(lv.regimeVotes![p.id])}`).join(' · ')}</p>
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
  const change = r.W[me] - PLAY.LIVING_COST;
  const from = h.banks[me] - change;
  const ch = r.choices[me];
  let cost: string;
  if (r.regime !== 'VOL') cost = t('play.stage.costMandate', { T: fmt1(r.T ?? 0) });
  else if (mine.kind === 'HIT') cost = t('play.stage.costLoss', { loss: coins(mine.lost) });
  else if (ch.buy && r.premium !== null && ch.gym) cost = t('play.stage.costCoverGym', { p: fmt1(r.premium + n.gymCost) });
  else if (ch.buy && r.premium !== null) cost = t('play.stage.costCover', { p: fmt1(r.premium) });
  else if (ch.gym) cost = t('play.stage.costGym', { c: n.gymCost });
  else cost = t('play.stage.costNone');
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
  return (
    <Stage
      v={v}
      onTap={advance}
      footer={
        <BigButton beatNext={!last} onClick={advance}>
          {done ? t('play.stage.tap') : t('play.l3.skip')}
        </BigButton>
      }
    >
      <p className="text-center text-xs font-bold uppercase tracking-wider text-soft">{t('play.stage.resultsOf', { r: v.round })}</p>
      <h1 className="h-show mt-1 text-center text-3xl leading-tight">{t('play.l3.wheel')}</h1>
      <div className="relative mx-auto mt-2 h-44 w-44">
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
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-6 rounded-lg border-4 px-4 py-1 text-3xl font-black ${mine.kind === 'HIT' ? 'border-stamp bg-ink text-[rgb(18,14,36)]' : 'border-onspot bg-ink text-[rgb(18,14,36)]'}`}
            data-outcome={mine.kind}
          >
            {t(`play.stage.${mine.kind}`)}
          </span>
        )}
      </div>
      {done ? (
        <div className="mt-3 text-center" aria-live="polite">
          <p className="flex items-baseline justify-center gap-3">
            <span className={`h-show text-5xl ${change < 0 ? 'text-stamp' : 'text-spot'}`}>{signed(Math.round(change))}</span>
            <span className="text-base font-semibold" data-chose>
              {t(`play.stage.chose.${chose}`)}
            </span>
          </p>
          <p className="mt-1 text-sm text-soft">
            {t('play.stage.bankLine', { from: coins(from), to: coins(h.banks[me]) })} {cost}
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {v.players
              .filter((p) => p.id !== me)
              .map((p) => {
                const o = outcomeOf(r, p.id, n.loss);
                return (
                  <li key={p.id} className={`rounded-xl px-1 py-1.5 text-center ${o.kind === 'HIT' ? 'bg-card ring-2 ring-stamp' : 'bg-card'}`}>
                    <span className="block truncate text-xs font-bold">{shortName(v, p.id)}</span>
                    <span className={`block text-xs ${o.kind === 'HIT' ? 'text-stamp' : 'text-good'}`}>
                      {o.kind === 'HIT' ? t('play.stage.hit', { n: `−${coins(o.lost)}` }) : o.kind === 'COVERED' ? t('play.stage.covered') : t('play.stage.safe')}
                    </span>
                  </li>
                );
              })}
          </ul>
          <div className="mt-3 text-start">
            <Bubble who={voice.who} text={voice.text} host={voice.host} bot={voice.bot} />
          </div>
        </div>
      ) : (
        <p className="mt-6 text-center text-soft" aria-hidden>
          …
        </p>
      )}
    </Stage>
  );
}

/** Whether this round's results get the "breaking news" price beat (Play spec redesign, beat c). */
export function hasPriceBeat(v: ViewState): boolean {
  const lv = lv3(v);
  const r = lv.rounds[lv.rounds.length - 1];
  return !!r && r.regime === 'VOL' && r.premium !== null && v.round < lastRound(v);
}

/** Beat (c): SafeHands' price change as its own full screen, with one line on why and one voice. */
export function PriceBeat({ v, next, onReally }: { v: ViewState; next: () => void; onReally: () => void }) {
  const lv = lv3(v);
  const r = lv.rounds[lv.rounds.length - 1];
  const from = r.listPrice ?? r.premium!;
  const to = r.nextPremium;
  const kind = to === null ? 'Gone' : r.launch ? 'Launch' : to > from + 1e-9 ? 'Up' : to < from - 1e-9 ? 'Down' : 'Same';
  const change = to === null ? 0 : (to - from) / from;
  const voteNext = v.round === PLAY.L3.VOLUNTARY_ROUNDS;
  return (
    <Stage
      v={v}
      bar={false}
      tone="breaking"
      onTap={next}
      footer={
        <BigButton dark onClick={next}>
          {voteNext ? t('play.stage.toVote') : t('play.stage.nextRound', { r: v.round + 1 })}
        </BigButton>
      }
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-onspot px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-spot">{t('play.stage.breaking')}</span>
        <span className="text-xs font-semibold">{t('play.l3.ticker')}</span>
      </div>
      <div className="my-auto">
        <p className="text-xs font-bold uppercase tracking-wider">{t('play.stage.priceOf')}</p>
        <p className="mt-1 flex items-baseline gap-3" data-price>
          <span className="h-show text-4xl line-through opacity-60">{coins(from)}</span>
          <span className="h-show text-8xl leading-none">{to === null ? t('play.stage.closed') : coins(to)}</span>
        </p>
        {to !== null && (
          <span className="mt-2 inline-block rounded-md bg-onspot px-2 py-0.5 text-sm font-bold text-spot">
            {kind === 'Same' || kind === 'Launch' ? t('play.stage.same') : t(kind === 'Up' ? 'play.stage.up' : 'play.stage.down', { p: pct(Math.abs(change)) })}
          </span>
        )}
        <p className="h-show mt-4 text-2xl leading-tight">{t(`play.stage.head${kind}`)}</p>
        <p className="mt-2 text-sm">{t(`play.stage.sub${kind}`)}</p>
        <div className="mt-4">
          <figure className="rounded-2xl bg-onspot px-3 py-2 text-sm text-spot" data-voice="host">
            <span className="font-bold">Dash:</span> {hostLine(`price${kind}`, pick(v, `price-${kind}`, 6))}
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
