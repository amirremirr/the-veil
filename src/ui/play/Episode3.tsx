// Episode 3, "Bad Luck Season" (Play spec 5): the same Level 3 rules as Study, Play's numbers and
// presentation. The wheel and the ticker only animate outcomes the engine has already decided.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Choice, L3Round, Regime, RiskType } from '../../engine/levels/level3';
import type { ViewState } from '../../engine/types';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { nameOf } from '../game';
import { CheckBox, CountUp, useMotionOff } from '../components/common';
import { PrimaryBar } from '../components/TableParts';
import { fmt1 } from '../components/Money';
import { PLAY } from '../../engine/play/params';
import { wheelSlip } from './logic';

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

/** Your own odds this round (you know your type and the event). */
export function myOdds(v: ViewState, gym: boolean): number {
  const n = v.play!.l3!;
  const lv = v.levelView as L3View;
  const base = (lv.myType === 'HIGH' ? n.pHigh : n.pLow) * (gym ? n.gymFactor : 1);
  return n.riskMult === 1 ? base : Math.min(n.riskCap, base * n.riskMult);
}

/** SafeHands Mutual's price board. On results it counts from this round's price to the next. */
export function PriceTicker({ v, results = false }: { v: ViewState; results?: boolean }) {
  const lv = v.levelView as L3View;
  const n = v.play!.l3!;
  const r = lv.rounds[lv.rounds.length - 1];
  let price: number | null;
  let reason: string;
  let from: number | null = null;
  if (results && r) {
    if (r.regime !== 'VOL') {
      price = null;
      reason = t('play.l3.reasonMandate');
    } else if (r.nextPremium === null) {
      price = null;
      reason = t('play.l3.reasonGone');
    } else {
      price = r.nextPremium;
      from = r.listPrice ?? r.premium;
      const d = from === null ? 0 : r.nextPremium - from;
      reason = t(d > 1e-9 ? 'play.l3.reasonUp' : d < -1e-9 ? 'play.l3.reasonDown' : 'play.l3.reasonSame');
    }
  } else {
    const mandate = lv.regime !== 'VOL';
    price = mandate || !lv.insurerActive ? null : lv.premium;
    reason = mandate ? t('play.l3.reasonMandate') : !lv.insurerActive ? t('play.l3.reasonGone') : lv.rounds.length === 0 ? t('play.l3.reasonFirst') : '';
  }
  const label = price === null ? (lv.regime !== 'VOL' || r?.regime !== 'VOL' ? t('play.l3.tickerMandate') : t('play.l3.tickerClosed')) : coins(price);
  return (
    <section className="ticker rounded-md border-2 border-ink bg-ink px-3 py-2 text-paper" aria-label={t('play.l3.ticker')} data-ticker>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest">{t('play.l3.ticker')}</span>
        <span className="font-mono text-[11px] uppercase opacity-80">{t('play.l3.tickerLabel')}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="h-show text-3xl tabular-nums" aria-live="polite">
          {price !== null && from !== null && results ? <CountUp value={price} /> : label}
        </span>
        {!results && n.premiumMult !== 1 && price !== null && <span className="rounded bg-spot px-1.5 text-xs font-semibold text-onspot">{t('play.l3.discount', { p: coins(price) })}</span>}
      </div>
      {reason && <p className="text-xs leading-snug opacity-90">{reason}</p>}
    </section>
  );
}

function ChoiceForm({ v }: { v: ViewState }) {
  const lv = v.levelView as L3View;
  const n = v.play!.l3!;
  const act = useStore((s) => s.act);
  const [buy, setBuy] = useState(false);
  const [gym, setGym] = useState(false);
  const mandatory = lv.regime !== 'VOL';
  const canBuy = !mandatory && lv.premium !== null;
  const decision: Choice = { buy: canBuy && buy, gym };
  const cover = lv.regime === 'M50' ? 50 : 100;
  const T = n.loading * (cover / 100) * n.loss * n.pBar + n.mandateExtra;
  return (
    <section className="form-card p-3" aria-labelledby="l3-choice">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="l3-choice" className="h-show text-lg">{t('play.l3.choiceTitle')}</h2>
        <span className="num text-xs text-soft">{t('play.l3.oddsYou', { p: pct(myOdds(v, gym)) })}</span>
      </div>
      <p className="mt-1 text-xs text-soft">
        {t(`play.episodes.3.type.${lv.myType}`, { p: pct(myOdds(v, false)) })} {t('play.episodes.3.typeNote')}
      </p>
      <div className="mt-2 space-y-2">
        {canBuy ? (
          <button type="button" aria-pressed={buy} className="choice" onClick={() => setBuy(!buy)}>
            <CheckBox on={buy} />
            <span className="leading-snug">{t('play.l3.buy', { p: fmt1(lv.premium!) })}</span>
          </button>
        ) : (
          <p className="rounded-md border border-line p-3 text-sm">{mandatory ? t('play.l3.mandatory', { T: coins(T), c: cover }) : t('play.l3.noInsurer')}</p>
        )}
        <button type="button" aria-pressed={gym} className="choice" onClick={() => setGym(!gym)}>
          <CheckBox on={gym} />
          <span className="leading-snug">{t('play.l3.gym', { c: n.gymCost })}</span>
        </button>
      </div>
      <PrimaryBar>
        <button type="button" className="btn-primary" onClick={() => act(decision)}>
          {t('play.l3.submit')}
        </button>
      </PrimaryBar>
    </section>
  );
}

function RegimeForm() {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<Regime | null>(null);
  return (
    <section className="form-card p-3" aria-labelledby="l3-regime">
      <h2 id="l3-regime" className="h-show text-lg">{t('play.l3.regimeTitle')}</h2>
      <p className="mb-2 text-sm text-soft">{t('play.l3.regimeDecide')}</p>
      <div className="space-y-2" role="group" aria-labelledby="l3-regime">
        {REGIMES.map((r) => (
          <button key={r} type="button" aria-pressed={x === r} className="choice" onClick={() => setX(r)}>
            <span>
              <span className="block font-semibold">{regimeName(r)}</span>
              <span className="block text-sm text-soft">{t(`play.l3.regimes.${r}.desc`)}</span>
            </span>
          </button>
        ))}
      </div>
      <PrimaryBar>
        <button type="button" className="btn-primary" disabled={!x} onClick={() => act(x)}>
          {t('play.l3.regimeSubmit')}
        </button>
      </PrimaryBar>
    </section>
  );
}

export function Decide3({ v }: { v: ViewState }) {
  return v.phase.step === 'REGIME' ? <RegimeForm /> : <ChoiceForm v={v} />;
}

/** The regime vote's result, shown on the round-3 decision screen (its own screen is skipped, D-37). */
export function RegimeBanner({ v }: { v: ViewState }) {
  const lv = v.levelView as L3View;
  if (!lv.regimeVotes) return null;
  return (
    <section className="rounded-md border-2 border-stamp bg-card px-3 py-2" aria-live="polite">
      <p className="h-show text-base">{t('play.l3.regimeResult', { name: regimeName(lv.regime) })}</p>
      <p className="mt-1 text-xs text-soft">
        {t('play.l3.regimeVotes')}: {v.players.map((p) => `${nameOf(v, p.id)} ${regimeName(lv.regimeVotes![p.id])}`).join(' · ')}
      </p>
    </section>
  );
}

const WHEEL_R = 34;
/** A slice from 0 to `share` of the circle, as an SVG path. */
function slice(share: number): string {
  const a = Math.min(0.9999, share) * 2 * Math.PI;
  const x = 40 + WHEEL_R * Math.sin(a);
  const y = 40 - WHEEL_R * Math.cos(a);
  return `M40 40 L40 ${40 - WHEEL_R} A${WHEEL_R} ${WHEEL_R} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

/**
 * One contestant's wheel. Your own wheel shows your real odds; everyone else's shows the table's average
 * odds (risk types are secret, D-103). It stops where the engine's draw already landed.
 */
function Wheel({ odds, hit, spin, seedTurn }: { odds: number; hit: boolean; spin: boolean; seedTurn: number }) {
  // The pointer is at the top. Misfortune is the slice from 0 to odds; land in its middle or in the safe part.
  const land = hit ? (odds / 2) * 360 : (odds + (1 - odds) * (0.3 + 0.4 * seedTurn)) * 360;
  const final = 3 * 360 + (360 - land);
  return (
    <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden className="shrink-0">
      <motion.g style={{ originX: '40px', originY: '40px' }} initial={{ rotate: 0 }} animate={{ rotate: spin ? final : 0 }} transition={{ duration: spin ? 0.8 : 0, ease: 'easeOut' }}>
        <circle cx="40" cy="40" r={WHEEL_R} className="fill-good/30 stroke-ink" strokeWidth="2" />
        <path d={slice(odds)} className="fill-stamp" />
      </motion.g>
      <path d="M40 2 L35 12 L45 12 Z" className="fill-ink" />
    </svg>
  );
}

/** Section 7.2: the Wheel of Misfortune for each contestant in turn, at most 4 seconds, skippable. */
export function WheelReveal({ v }: { v: ViewState }) {
  const lv = v.levelView as L3View;
  const n = v.play!.l3!;
  const r = lv.rounds[lv.rounds.length - 1];
  const off = useMotionOff();
  const players = v.players;
  const step = Math.min(PLAY.REVEAL_MAX_MS / players.length, 900);
  const [shown, setShown] = useState(off ? players.length : 0);
  useEffect(() => {
    if (off) return setShown(players.length);
    if (shown >= players.length) return;
    const id = setTimeout(() => setShown((k) => k + 1), shown === 0 ? 150 : step);
    return () => clearTimeout(id);
  }, [shown, off, players.length, step]);
  if (!r) return null;
  const avg = (gym: boolean) => {
    const b = n.pBar * (gym ? n.gymFactor : 1);
    return n.riskMult === 1 ? b : Math.min(n.riskCap, b * n.riskMult);
  };
  const done = shown >= players.length;
  return (
    <section className="form-card p-3" aria-labelledby="wheel-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="wheel-title" className="h-show text-lg">
          {t('play.l3.wheel')}
        </h2>
        {!done && (
          <button type="button" className="btn-ghost min-h-[36px] px-3 py-1 text-sm" onClick={() => setShown(players.length)}>
            {t('play.l3.skip')}
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {players.map((p, i) => {
          const mine = p.id === v.viewer;
          const ch = r.choices[p.id];
          const hit = r.events[p.id];
          const odds = mine ? r.pEff[p.id] : avg(ch.gym);
          const revealed = i < shown;
          const covered = r.regime === 'VOL' ? ch.buy && r.premium !== null : true;
          let outcome = t('play.l3.safe');
          if (hit) outcome = r.regime === 'M50' ? t('play.l3.halfCovered') : covered ? t('play.l3.covered') : t('play.l3.hit', { loss: n.loss });
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-md border border-line p-2">
              <Wheel odds={odds} hit={hit} spin={revealed && !off} seedTurn={(r.eventCards[p.id] % 100) / 100} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-semibold">{nameOf(v, p.id)}</span>
                  <span className="flex gap-1">
                    {ch.buy && r.premium !== null && <span className="rounded bg-teal/15 px-1 font-mono text-[10px]">{t('play.l3.insured')}</span>}
                    {ch.gym && <span className="rounded bg-amber/15 px-1 font-mono text-[10px]">{t('play.l3.gymTag')}</span>}
                  </span>
                </div>
                {revealed ? (
                  <>
                    <p className={hit && !covered ? 'font-semibold text-stamp' : hit ? 'text-ink' : 'text-good'}>{outcome}</p>
                    {hit && <p className="text-xs italic text-soft">{wheelSlip(r.eventCards[p.id])}</p>}
                    <p className="num text-xs text-soft">
                      {t('play.l3.money')}: {fmt1(r.W[p.id])}
                    </p>
                  </>
                ) : (
                  <p className="text-soft" aria-hidden>
                    …
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-soft">{t('play.l3.oddsOthers')}</p>
    </section>
  );
}
