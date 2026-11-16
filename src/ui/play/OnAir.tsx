// Play's stage (Play spec 7.1, redesign D-108): one beat per screen, nothing to scroll at 375 x 760.
// The top bar holds only ON AIR, the round, your bank and four small avatars with banks. The mission bar,
// the chat log and leaving the show live in the menu.
import { onTap as ptTap } from '../playtest';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ViewState } from '../../engine/types';
import { TALK } from '../../engine/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins } from '../labels';
import { useMotionOff } from '../components/common';
import { CallContext, CastStage, CueContext, castKind, mergeCues, screenFlash, type CallReg, type CastCue } from './Cast';
import { DashHost, ShapePerson, type DashExpr } from './Characters';
import { isMuted, onMuted, setMuted, sfx } from './sound';
import { DURATION } from './tokens';
import { ChatFeed, MessageComposer, Sheet } from '../components/TableParts';
import { useOnline } from '../components/Online';
import { missionName } from './logic';
import { PlayOpening } from './Opening';

const rounds = (v: ViewState) => Math.max(1, ...v.queue.map((p) => p.round));
const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

export function MissionBar({ v }: { v: ViewState }) {
  const m = v.play?.mission;
  if (!m) return null;
  const value = m.scale * m.value;
  const share = Math.max(0, Math.min(1, value / m.goal));
  const label = t('play.bar.missionBar', { name: missionName(m.card), value: coins(value), goal: coins(m.goal) });
  return (
    <div>
      <p className="text-small font-semibold">{label}</p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={t('play.a11y.missionProgress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-valuetext={label}>
        <div className="h-full bg-stamp" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

/** The menu: your mission, the full chat log (and replies while talk is open), leaving the show. */
export function PlayMenu({ v, onClose, chatFirst = false }: { v: ViewState; onClose: () => void; chatFirst?: boolean }) {
  const go = useStore((s) => s.go);
  const leaveOnline = useStore((s) => s.leaveOnline);
  const online = useOnline();
  const [opening, setOpening] = useState(false);
  const canTalk = v.phase.kind === 'TALK' && v.talkSent < TALK.MAX_MESSAGES;
  const chat = (
    <section aria-labelledby="menu-chat">
      <h2 id="menu-chat" className="label mb-2">
        {t('play.stage.menuChat')}
      </h2>
      <ChatFeed v={v} />
      {canTalk && (
        <div className="mt-3">
          <MessageComposer v={v} />
        </div>
      )}
    </section>
  );
  return (
    <Sheet title={t('play.stage.menuTitle')} closeLabel={t('play.stage.menuClose')} onClose={onClose}>
      {chatFirst && chat}
      <section aria-labelledby="menu-mission">
        <h2 id="menu-mission" className="label mb-2">
          {t('play.stage.menuMission')}
        </h2>
        <MissionBar v={v} />
      </section>
      {!chatFirst && chat}
      {/* D-139: not in multiplayer rooms until Q4. */}
      {!online && (
        <button type="button" className="btn-ghost w-full" onClick={() => setOpening(true)}>
          {t('play.opening.menu')}
        </button>
      )}
      <button type="button" className="btn-ghost w-full" onClick={() => (online ? leaveOnline() : go('title'))}>
        {t('play.stage.menuQuit')}
      </button>
      {opening && <PlayOpening onDone={() => setOpening(false)} />}
    </Sheet>
  );
}

/** A contestant's character, small; yours carries the yellow ring (D-146: your name shows instead of "You"). */
export function Face({ v, p, size, ring = true }: { v: ViewState; p: ViewState['players'][number]; size: number; ring?: boolean }) {
  const mine = ring && p.id === v.viewer;
  return (
    <span className={`inline-flex shrink-0 rounded-full ${mine ? 'ring-2 ring-spot' : ''}`} data-me={mine ? '' : undefined}>
      <ShapePerson kind={castKind(p)} size={size} />
    </span>
  );
}

/** The mute button: sound is on by default and starts after the first tap; the choice is remembered. */
export function MuteButton() {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMuted(setM), []);
  return (
    <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-card" aria-label={t(m ? 'play.sound.unmute' : 'play.sound.mute')} aria-pressed={m} onClick={() => setMuted(!m)} data-mute>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {m ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
    </button>
  );
}

export function TopBar({ v, onMenu }: { v: ViewState; onMenu: () => void }) {
  const pl = v.play!;
  const mine = pl.banks[v.viewer];
  return (
    <header className="mx-auto w-full max-w-md px-4 pt-3" onClick={stop}>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-stamp px-2 py-0.5 text-small font-bold tracking-wider text-onspot">{t('play.onAir')}</span>
        <span className="text-small text-soft">{t('play.bar.round', { r: Math.max(1, v.round), n: rounds(v) })}</span>
        <span className="ms-auto text-end leading-none">
          <span className="block text-small uppercase tracking-wider text-soft">{t('play.bar.bank')}</span>
          <span className={`h-show text-title ${mine < 0 ? 'text-stamp' : ''}`} data-bank-top>{coins(mine)}</span>
        </span>
        <MuteButton />
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-card text-lead" aria-label={t('play.bar.menu')} onClick={onMenu}>
          <span aria-hidden>≡</span>
        </button>
      </div>
    </header>
  );
}

/** UI V3 (U3): a banner a flow puts at the top of its decision screen (the round's event). */
export const BannerContext = createContext<ReactNode>(null);

/**
 * One screen of the show. `onTap` makes the whole screen advance on a tap (beats); buttons inside stop the
 * tap from bubbling. Content stacks from the top and the action sits at the bottom. UI V3 (U1): the cast
 * stands on the stage under the top bar on every screen with the bar (or when a screen passes `cast`);
 * if the screen would scroll, the characters shrink (72, 58, then 46 px) so it fits.
 */
export function Stage({
  v,
  children,
  footer,
  onTap,
  bar = true,
  tone = 'stage',
  chatFirst = false,
  cast,
  flash,
}: {
  v: ViewState;
  children: ReactNode;
  footer?: ReactNode;
  onTap?: () => void;
  bar?: boolean;
  tone?: 'stage' | 'breaking';
  chatFirst?: boolean;
  /** The stage's cue; `false` hides the cast. Default: shown when the top bar is. */
  cast?: CastCue | false;
  /** A whole-stage flash: pink for a hit, yellow for a gain (U2). */
  flash?: 'hit' | 'gain' | null;
}) {
  const [menu, setMenu] = useState(false);
  const banner = useContext(BannerContext);
  const [fit, setFit] = useState(0);
  const [call, setCall] = useState<CallReg | null>(null);
  const [extras, setExtras] = useState<Record<string, CastCue>>({});
  const setCue = useCallback((key: string, c: CastCue | null) => {
    setExtras((x) => {
      const y = { ...x };
      if (c) y[key] = c;
      else delete y[key];
      return y;
    });
  }, []);
  const off = useMotionOff();
  // A big change to your bank on this screen flashes the stage once, unless the screen sets its own flash.
  const [autoFlash] = useState(() => (flash === undefined && v.play ? screenFlash(v) : null));
  const theFlash = flash === undefined ? autoFlash : flash;
  const showCast = cast !== false && (cast !== undefined || bar);
  useLayoutEffect(() => {
    if (!showCast || fit >= 3) return;
    if (document.documentElement.scrollHeight > window.innerHeight) setFit(fit + 1);
  });
  return (
    <CallContext.Provider value={setCall}>
    <CueContext.Provider value={setCue}>
      <div className={`relative flex min-h-[100dvh] flex-col ${tone === 'breaking' ? 'bg-spot text-onspot' : ''} ${onTap ? 'cursor-pointer' : ''}`} onClick={onTap ? () => { sfx('tap'); onTap(); } : undefined} data-stage data-beat={onTap ? 'tap' : undefined}>
        {theFlash && !off && (
          <motion.div
            aria-hidden
            className={`pointer-events-none fixed inset-0 z-0 ${theFlash === 'hit' ? 'bg-stamp' : 'bg-spot'}`}
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            data-flash={theFlash}
          />
        )}
        {bar && <TopBar v={v} onMenu={() => { ptTap('menu'); setMenu(true); }} />}
        <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-2">
          {showCast && <CastStage v={v} cue={mergeCues(cast || {}, ...Object.values(extras))} fit={fit} call={call} />}
          <div className="flex flex-1 flex-col pt-2">
            {banner}
            {children}
          </div>
          {footer && (
            <div className="pt-3" onClick={stop}>
              {footer}
            </div>
          )}
        </main>
        {/* The menu's taps stay in the menu: on a tap-to-advance beat they must not move the show on. */}
        {menu && (
          <div onClick={stop}>
            <PlayMenu v={v} chatFirst={chatFirst} onClose={() => setMenu(false)} />
          </div>
        )}
      </div>
    </CueContext.Provider>
    </CallContext.Provider>
  );
}

/** Dash's mood for a line, from the kind of line it is. */
export function dashMood(kind?: string): DashExpr {
  if (!kind) return 'neutral';
  if (/caught|hit|win|jackpot|guessRight|welcome|finale|peakLie/i.test(kind)) return 'excited';
  if (/wrong|safe|calm|peakHonest|guessWrong|none/i.test(kind)) return 'wink';
  if (/debt|spiral|price|left|barred|calledWrong/i.test(kind)) return 'worried';
  return 'neutral';
}

/** The single voice on a screen: Dash (drawn beside his line), or one contestant. */
export function Bubble({ who, text, host = false, bot, mood }: { who: string; text: string; host?: boolean; bot?: ViewState['players'][number]; mood?: DashExpr }) {
  if (!text) return null;
  if (host)
    return (
      <figure className="flex items-end gap-2" data-voice="host">
        <span aria-hidden className="shrink-0">
          <DashHost expr={mood ?? 'neutral'} size={76} />
        </span>
        <p className="relative flex-1 rounded-2xl rounded-bl-sm bg-spot px-3 py-2 text-small leading-snug text-onspot">
          <span className="font-bold">{who}:</span> {text}
        </p>
      </figure>
    );
  return (
    <figure className="flex items-end gap-2" data-voice="bot">
      {bot && (
        <span aria-hidden className="shrink-0">
          <ShapePerson kind={castKind(bot)} size={40} />
        </span>
      )}
      <p className="flex-1 rounded-2xl rounded-bl-sm bg-card px-3 py-2 text-small leading-snug">
        <span className="font-bold">{who}:</span> {text}
      </p>
    </figure>
  );
}

/** The bottom action: pink, full width, dark text (white on this pink fails WCAG AA, D-108). */
export function BigButton({ children, onClick, disabled = false, dark = false, beatNext = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; dark?: boolean; beatNext?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-beat-next={beatNext || undefined}
      onClick={(e) => {
        e.stopPropagation();
        sfx(beatNext ? 'tap' : 'lock');
        onClick();
      }}
      className={`min-h-[52px] w-full rounded-full text-lead font-bold transition-opacity disabled:opacity-40 ${dark ? 'bg-onspot text-spot' : 'bg-stamp text-onspot'}`}
    >
      {children}
    </button>
  );
}

/** Auto-advance is off under browser automation (tests tap through), unless a capture asks for it. */
export function autoAdvanceOn(): boolean {
  try {
    if (localStorage.getItem('veil.play.auto') === '1') return true;
    if (localStorage.getItem('veil.play.auto') === '0') return false;
  } catch {
    // Storage blocked: fall through.
  }
  return !(typeof navigator !== 'undefined' && navigator.webdriver);
}

/**
 * UI V3 (U3): the button of a beat that only informs. The beat moves on by itself after its animation and a
 * 1.2 second hold (a bar fills to show it), waits while a sheet is open, and a tap skips the wait.
 */
export function AutoButton({ onClick, children, animMs = 0, dark = false }: { onClick: () => void; children: ReactNode; animMs?: number; dark?: boolean }) {
  const on = autoAdvanceOn();
  const off = useMotionOff();
  const ms = (off ? 0 : animMs) + DURATION.hold;
  useEffect(() => {
    if (!on) return;
    let id = 0;
    const fire = () => {
      // A sheet ("See the money", "What was really going on?") holds the beat until it closes.
      if (document.querySelector('[role="dialog"]')) id = window.setTimeout(fire, 400);
      else onClick();
    };
    id = window.setTimeout(fire, ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ms]);
  return (
    <div className="relative" data-auto={ms}>
      <BigButton beatNext dark={dark} onClick={onClick}>
        {children}
      </BigButton>
      {on && (
        <motion.span
          aria-hidden
          className={`pointer-events-none absolute bottom-1 left-6 right-6 h-1 origin-left rounded-full ${dark ? 'bg-spot/60' : 'bg-onspot/40'}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: ms / 1000, ease: 'linear' }}
        />
      )}
    </div>
  );
}
