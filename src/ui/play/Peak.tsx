// UI V3 (U1, U2): an episode's peak as a staged moment. The spotlight moves from contestant to contestant
// (or ballot to ballot), and a stamp lands on each character. Every step is short, the whole reveal takes at
// most 4 seconds, a tap skips to the end, and under reduced motion the end shows at once.
import { useEffect, useState, type ReactNode } from 'react';
import type { ViewState } from '../../engine/types';
import { t } from '../i18n';
import { useMotionOff } from '../components/common';
import { BigButton, Stage } from './OnAir';
import type { CastCue } from './Cast';
import type { Expr } from './Characters';
import { DURATION } from './tokens';
import { sfx } from './sound';

export type RevealStep = { cue: CastCue; body: ReactNode };

export function StagedReveal({
  v,
  label,
  title,
  steps,
  final,
  onDone,
  doneLabel,
  beatNext = false,
  data = 'cards',
}: {
  v: ViewState;
  label: string;
  title: ReactNode;
  steps: RevealStep[];
  final: RevealStep;
  onDone: () => void;
  doneLabel?: string;
  beatNext?: boolean;
  data?: string;
}) {
  const off = useMotionOff();
  const [k, setK] = useState(off ? steps.length : 0);
  const step = Math.min(DURATION.revealStep, Math.floor((DURATION.REVEAL_MAX - 400) / Math.max(1, steps.length)));
  useEffect(() => {
    if (off) {
      setK(steps.length);
      return;
    }
    if (k >= steps.length) return;
    const id = setTimeout(() => setK(k + 1), step);
    return () => clearTimeout(id);
  }, [k, off, steps.length, step]);
  useEffect(() => {
    if (k === steps.length && !off) sfx('fanfare');
  }, [k === steps.length]);
  const done = k >= steps.length;
  const cur = done ? final : steps[k];
  return (
    <Stage
      v={v}
      cast={cur.cue}
      onTap={done ? undefined : () => setK(steps.length)}
      footer={
        done ? (
          <BigButton beatNext={beatNext} onClick={onDone}>
            {doneLabel ?? t('play.stage.tap')}
          </BigButton>
        ) : (
          <button type="button" className="min-h-[52px] w-full rounded-full bg-card text-lead font-bold" onClick={() => setK(steps.length)} data-skip>
            {t('play.stage.skip')}
          </button>
        )
      }
    >
      <div {...{ [`data-${data}`]: '' }} data-step={done ? 'final' : k} aria-live="polite">
        <p className="text-small font-bold uppercase tracking-wider text-soft">{label}</p>
        <h1 className="h-show text-title leading-tight text-spot">{title}</h1>
        <div className="mt-2">{cur.body}</div>
      </div>
    </Stage>
  );
}

/** Small stamp chips for a row of claims ("R1 Low TRUE"). */
export function Chips({ items }: { items: Array<{ text: string; lie?: boolean }> }) {
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((x, i) => (
        <span key={i} className={`rounded-md px-1.5 text-small font-bold leading-snug ${x.lie ? 'bg-stamp text-onspot' : 'bg-paper text-ink'}`}>
          {x.text}
        </span>
      ))}
    </span>
  );
}

/** A contestant's stamp and face at the peak: LIE (smug if it worked, caught if called), TRUE, or nothing. */
export function peakMark(v: ViewState, id: string, lies: number, claims: number): { stamp?: { text: string; tone: 'stamp' | 'good' }; expr: Expr } {
  const caught = (v.play?.calls ?? []).some((c) => c.level === v.levelIndex && c.target === id && c.lie);
  if (lies > 0) return { stamp: { text: t('play.cards.LIE'), tone: 'stamp' }, expr: caught ? 'caught' : 'smug' };
  if (claims > 0) return { stamp: { text: t('play.cards.TRUE'), tone: 'good' }, expr: 'pleased' };
  return { expr: 'neutral' };
}

/** Steps for a peak that spotlights one contestant at a time; stamps stay once they land. */
export function spotlightSteps(rows: Array<{ id: string; stamp?: { text: string; tone: 'stamp' | 'good' | 'ink' }; expr: Expr; body: ReactNode }>, finalBody: ReactNode): { steps: RevealStep[]; final: RevealStep } {
  const cueUpTo = (k: number): CastCue => {
    const c: CastCue = { stamps: {}, expr: {} };
    rows.slice(0, k + 1).forEach((r) => {
      if (r.stamp) c.stamps![r.id] = r.stamp;
      c.expr![r.id] = r.expr;
    });
    return c;
  };
  return {
    steps: rows.map((r, k) => ({ cue: { ...cueUpTo(k), focus: r.id }, body: r.body })),
    final: { cue: cueUpTo(rows.length - 1), body: finalBody },
  };
}

/** User review fix 3: the round-by-round table sits behind a "Details" tap; the stamps and one line stay. */
export function Details({ children }: { children: ReactNode }) {
  return (
    <details className="mt-2 rounded-2xl bg-card px-3" data-details>
      <summary className="flex min-h-[44px] cursor-pointer items-center text-small font-bold underline">{t('play.cast.details')}</summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}
