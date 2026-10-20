// Episode 3, "Bad Luck Season" (Play spec 5), redesigned as one beat per screen (D-108). Same Level 3
// rules as Study; the wheel and the price board only animate outcomes the engine already decided.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Choice, L3Round, Regime, RiskType } from '../../engine/levels/level3';
import type { ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct, signed } from '../labels';
import { nameOf, shortName, useTalkFrom } from '../game';
import { useMotionOff } from '../components/common';
import { fmt1 } from '../components/Money';
import { BigButton, Bubble, Stage } from './OnAir';
import { brokenPromises, confessional, hostLine, pick, roundOutcome } from './logic';
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
      <span className={`text-[10px] font-bold uppercase tracking-wider ${on ? '' : 'text-soft'}`}>{onClick ? (on ? t('play.stage.selected') : t('play.stage.tapToAdd')) : ' '}</span>
      <span>
        <span className="h-show block text-xl leading-tight">{title}</span>
        <span className="mt-1 block text-xs leading-snug">{desc}</span>
      </span>
    </button>
  );
}

export function ChoiceScreen({ v }: { v: ViewState }) {
  const lv = lv3(v);
  const n = v.play!.l3!;
  const act = useStore((s) => s.act);
  const [buy, setBuy] = useState(false);
  const [gym, setGym] = useState(false);
  const mandatory = lv.regime !== 'VOL';
  const canBuy = !mandatory && lv.premium !== null;
  const decision: Choice = { buy: canBuy && buy, gym };
  const cover = lv.regime === 'M50' ? 50 : 100;
  const T = n.loading * (cover / 100) * n.loss * n.pBar + n.mandateExtra;
  // Insured or under a full plan, a disaster costs you nothing; the chance shown is still the Wheel's.
  return (
    <Stage
      v={v}
      chatFirst
      footer={
        <BigButton onClick={() => act(decision)}>{t('play.stage.lock')}</BigButton>
      }
    >
      <div className="mt-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.stage.chance')}</p>
        <p className="h-show text-8xl leading-none text-spot" aria-live="polite">
          {pct(myOdds(v, gym))}
        </p>
        <p className="mt-2 text-sm">{t('play.stage.chanceNote', { loss: n.loss })}</p>
      </div>
      <div className="mt-4">
        <LatestMessage v={v} />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        {canBuy ? (
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
  const broken = new Set(brokenPromises(v, 'CHOICE').map((b) => b.from));
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
      <div className="relative mx-auto mt-3 h-52 w-52">
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
          <p className={`h-show text-5xl ${change < 0 ? 'text-stamp' : 'text-spot'}`}>{signed(Math.round(change))}</p>
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
                    {broken.has(p.id) && <span className="block text-[10px] font-bold text-stamp">{t('play.stage.brokePromise')}</span>}
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
  const kind = to === null ? 'Gone' : to > from + 1e-9 ? 'Up' : to < from - 1e-9 ? 'Down' : 'Same';
  const change = to === null ? 0 : (to - from) / from;
  const voteNext = v.round === 2;
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
            {kind === 'Same' ? t('play.stage.same') : t(kind === 'Up' ? 'play.stage.up' : 'play.stage.down', { p: pct(Math.abs(change)) })}
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
