// Play's stage (Play spec 7.1, redesign D-108): one beat per screen, nothing to scroll at 375 x 760.
// The top bar holds only ON AIR, the round, your bank and four small avatars with banks. The mission bar,
// the chat log and leaving the show live in the menu.
import { onTap as ptTap } from '../playtest';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
import { PlayOpening } from './Opening';
import { HowItWorks } from './HowItWorks';

const rounds = (v: ViewState) => Math.max(1, ...v.queue.map((p) => p.round));
const stop = (e: { stopPropagation(): void }) => e.stopPropagation();

/** The menu: the full chat log (and replies while talk is open), the episode's rules card, leaving the show. */
export function PlayMenu({ v, onClose }: { v: ViewState; onClose: () => void; chatFirst?: boolean }) {
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
  // UI V4 (V1): "What is this game?" shows its card inside the menu, not on top of it.
  if (opening)
    return (
      <Sheet title={t('play.stage.menuTitle')} closeLabel={t('play.stage.menuClose')} onClose={onClose}>
        <PlayOpening inline onDone={() => setOpening(false)} />
      </Sheet>
    );
  return (
    <Sheet title={t('play.stage.menuTitle')} closeLabel={t('play.stage.menuClose')} onClose={onClose}>
      {chat}
      {/* UI V4 (V2): the episode's rules card, again, inside the menu. */}
      {v.levelIndex >= 1 && v.levelIndex <= 5 && (
        <details className="rounded-2xl bg-card px-3" data-howto-menu>
          <summary className="flex min-h-[44px] cursor-pointer items-center font-semibold">{t('play.howto.menu')}</summary>
          <div className="pb-3">
            <HowItWorks v={v} compact />
          </div>
        </details>
      )}
      {/* D-139: not in multiplayer rooms until Q4. */}
      {!online && (
        <button type="button" className="btn-ghost w-full" onClick={() => setOpening(true)}>
          {t('play.opening.menu')}
        </button>
      )}
      <button type="button" className="btn-ghost w-full" onClick={() => (online ? leaveOnline() : go('title'))}>
        {t('play.stage.menuQuit')}
      </button>
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
 * UI V4 (V1): no pop-ups. "See the money", "What was really going on?" and the score in words open in
 * place: the screen's own content area shows them (with a Close button) instead of a sheet on top.
 */
export type StagePanel = { title: string; body: ReactNode };
export const PanelContext = createContext<((p: StagePanel | null) => void) | null>(null);
/** Open a panel in place on the enclosing stage (null when there is no stage). */
export function useStagePanel() {
  return useContext(PanelContext);
}

/** UI V4 (V1): Dash's line sits in one fixed slot of the screen, under the cast, never over content. */
export type DashLine = { text: string; mood: DashExpr };
export const DashSlotContext = createContext<((key: string, l: DashLine | null) => void) | null>(null);

function DashSlot({ line, dark }: { line: DashLine; dark: boolean }) {
  return (
    <figure className="mt-1 flex min-h-[44px] items-center gap-2" data-voice="host" data-dash-slot>
      <span aria-hidden className="shrink-0">
        <DashHost expr={line.mood} size={40} />
      </span>
      <p className={`line-clamp-2 flex-1 text-small leading-snug ${dark ? 'text-onspot' : ''}`}>
        <span className="font-bold">Dash:</span> {line.text}
      </p>
    </figure>
  );
}

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
  const [panel, setPanel] = useState<StagePanel | null>(null);
  const [dash, setDash] = useState<Record<string, DashLine>>({});
  const setDashLine = useCallback((key: string, l: DashLine | null) => {
    setDash((x) => {
      const y = { ...x };
      if (l) y[key] = l;
      else delete y[key];
      return y;
    });
  }, []);
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
  // UI V4 (V1): something opening in place (the Give picker, a call in a bubble) can make the screen taller
  // without this stage re-rendering, so a resize of the page checks the fit again.
  const [grew, setGrew] = useState(0);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setGrew((g) => g + 1));
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!showCast || fit >= 3) return;
    if (document.documentElement.scrollHeight > window.innerHeight) setFit(fit + 1);
  }, [grew, fit, showCast, children, panel]);
  const dashLines = Object.values(dash);
  const dashLine = dashLines[dashLines.length - 1];
  return (
    <CallContext.Provider value={setCall}>
    <CueContext.Provider value={setCue}>
    <PanelContext.Provider value={setPanel}>
    <DashSlotContext.Provider value={setDashLine}>
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
          {dashLine && !panel && <DashSlot line={dashLine} dark={tone === 'breaking'} />}
          <div className="flex flex-1 flex-col pt-2" data-content>
            {/* The content stays mounted (its choices are kept) while a panel shows in its place. */}
            <div className={panel ? 'hidden' : 'contents'}>
              {banner}
              {children}
            </div>
            {panel && (
              <section className="flex flex-1 flex-col" aria-labelledby="stage-panel-title" onClick={stop} data-panel>
                <h2 id="stage-panel-title" className="h-show text-title leading-tight">{panel.title}</h2>
                <div className="mt-2 flex-1 space-y-2 text-small">{panel.body}</div>
                <button type="button" className="mt-3 min-h-[52px] w-full rounded-full bg-card text-lead font-bold" onClick={() => setPanel(null)} data-panel-close>
                  {t('play.ledger.hide')}
                </button>
              </section>
            )}
          </div>
          {footer && !panel && (
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
    </DashSlotContext.Provider>
    </PanelContext.Provider>
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
export function Bubble({ who, text, host = false, bot, mood, inline = false }: { who: string; text: string; host?: boolean; bot?: ViewState['players'][number]; mood?: DashExpr; inline?: boolean }) {
  const slot = useContext(DashSlotContext);
  // `inline`: a line inside something closed by default (the event card), which stays where it is.
  const inSlot = host && !!slot && !inline;
  const m = mood ?? 'neutral';
  // UI V4 (V1): on a stage, Dash's line goes to the stage's fixed slot; the bubble itself renders nothing.
  const [key] = useState(() => `d${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    if (!inSlot || !text) return;
    slot!(key, { text, mood: m });
    return () => slot!(key, null);
  }, [inSlot, text, m, key, slot]);
  if (!text || inSlot) return null;
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

/** Fix 4: the auto-advance hold for a screen with this many words. */
export function holdFor(words: number): number {
  return Math.min(5000, DURATION.hold + 200 * Math.max(0, words - 12));
}

/** UI V4 (V4): only a screen of this many words or fewer moves on by itself; every other screen waits. */
export const AUTO_MAX_WORDS = 8;

/** The words a player reads on the screen itself (not the top bar, the cast or the bottom button). */
function contentWords(): number {
  const el = document.querySelector('[data-content]') ?? document.getElementById('root');
  return ((el as HTMLElement | null)?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * UI V3 (U3): the button of a beat that only informs. UI V4 (V4): it moves on by itself only when the screen
 * has 8 words or fewer (after its animation and a 1.2 second hold; a thin line fills to show it). A tap or
 * touch anywhere else on the screen holds it there (the first tap holds, it does not advance); the button
 * still moves on. Every other screen waits for a tap. It waits while a panel is open.
 */
export function AutoButton({ onClick, children, animMs = 0, dark = false }: { onClick: () => void; children: ReactNode; animMs?: number; dark?: boolean }) {
  const on = autoAdvanceOn();
  const off = useMotionOff();
  const [words, setWords] = useState<number | null>(null);
  useLayoutEffect(() => setWords(contentWords()), []);
  const [held, setHeld] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const auto = on && words !== null && words <= AUTO_MAX_WORDS && !held;
  const ms = (off ? 0 : animMs) + holdFor(words ?? 0);
  useEffect(() => {
    if (!auto) return;
    let id = 0;
    const fire = () => {
      // A panel ("See the money", "What was really going on?") holds the beat until it closes.
      if (document.querySelector('[role="dialog"], [data-panel]')) id = window.setTimeout(fire, 400);
      else onClick();
    };
    id = window.setTimeout(fire, ms);
    // The first touch outside the button holds the screen; a plain tap on the stage is swallowed, so it holds
    // instead of moving on. Links and buttons still work (and hold too).
    let swallow = false;
    const down = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (box.current && el && box.current.contains(el)) return;
      swallow = !el?.closest('button, a, summary, input, label');
      setHeld(true);
    };
    const click = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('click', click, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener('pointerdown', down, true);
      // The click that follows the holding touch still needs swallowing after this effect ends.
      window.setTimeout(() => window.removeEventListener('click', click, true), 600);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, ms]);
  return (
    <div ref={box} className="relative" data-auto={auto ? ms : undefined} data-held={held || undefined}>
      <BigButton beatNext dark={dark} onClick={onClick}>
        {children}
      </BigButton>
      {auto && (
        <motion.span
          aria-hidden
          className={`pointer-events-none absolute bottom-1 left-6 right-6 h-1 origin-left rounded-full ${dark ? 'bg-spot/60' : 'bg-onspot/40'}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: ms / 1000, ease: 'linear' }}
          data-auto-line
        />
      )}
    </div>
  );
}
