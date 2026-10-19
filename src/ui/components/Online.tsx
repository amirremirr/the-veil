// Multiplayer additions to the game screens: the countdown, "Waiting for 2 players", locked-in
// marks, Ready buttons and the connection banner. Solo play renders none of this.
import { useEffect, useState } from 'react';
import type { ViewState } from '../../engine/types';
import { screenDecisionPhase } from '../../shared/flow';
import { useStore } from '../store';
import { connectedHumans, screenKeyOf, useRoom } from '../room';
import { t } from '../i18n';
import { PrimaryBar } from './TableParts';

export const useOnline = () => useStore((s) => s.online);

/** Online and an action is waiting for the server: the main button is disabled meanwhile. */
export function usePending(): boolean {
  const online = useOnline();
  const since = useRoom((s) => s.pendingSince);
  return online && since !== null;
}

/** Shown once an action has waited this long without an answer. */
export const THINKING_AFTER_MS = 300;

/** True when an action has waited longer than THINKING_AFTER_MS. */
export function useThinking(): boolean {
  const online = useOnline();
  const since = useRoom((s) => s.pendingSince);
  const [, tick] = useState(0);
  useEffect(() => {
    if (since === null) return;
    const left = THINKING_AFTER_MS - (Date.now() - since);
    if (left <= 0) return;
    const id = setTimeout(() => tick((x) => x + 1), left);
    return () => clearTimeout(id);
  }, [since]);
  return online && since !== null && Date.now() - since >= THINKING_AFTER_MS;
}

/**
 * "Thinking..." while the server has not answered. `inline` sits in the TopBar; otherwise it floats
 * at the top of screens that have no TopBar. The live region is always mounted so the text is announced.
 */
export function Thinking({ inline = false }: { inline?: boolean }) {
  const online = useOnline();
  const topBar = useRoom((s) => s.topBar);
  const on = useThinking();
  useEffect(() => {
    if (!inline) return;
    useRoom.setState({ topBar: true });
    return () => useRoom.setState({ topBar: false });
  }, [inline]);
  if (!online || (!inline && topBar)) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      data-thinking={on ? 'on' : 'off'}
      className={inline ? 'min-w-0 text-sm text-soft' : 'pointer-events-none fixed end-3 top-3 z-40 text-sm text-soft'}
    >
      {on && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1">
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-ink" />
          {t('room.thinking')}
        </span>
      )}
    </span>
  );
}

/** How many humans this screen is still waiting for, and whether this player is done here. */
export function useWaiting(v: ViewState | null): { waiting: number; done: boolean } {
  const r = useRoom();
  if (!v) return { waiting: 0, done: false };
  const humans = v.players.filter((p) => p.isHuman).map((p) => p.id);
  const k = v.phase.kind;
  if (k === 'DECIDE' || k === 'GUESS') {
    const waiting = v.waitingOn.filter((id) => humans.includes(id)).length;
    return { waiting, done: !v.waitingOn.includes(v.viewer) };
  }
  if (screenDecisionPhase(v, v.queue)) return { waiting: humans.length - r.lockedIn.length, done: r.lockedIn.includes(v.viewer) };
  const done = r.readyOn === screenKeyOf(v);
  return { waiting: Math.max(0, connectedHumans(r) - r.readyCount), done };
}

export function waitingText(n: number): string {
  return n === 1 ? t('room.waitingOne') : t('room.waitingMany', { n });
}

/** Seconds left on this screen's timer (server clock), updated every quarter second. */
export function useSecondsLeft(): number | null {
  const deadline = useRoom((s) => s.deadline);
  const skew = useRoom((s) => s.skew);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - (now + skew)) / 1000));
}

export function Countdown() {
  const s = useSecondsLeft();
  if (s === null) return null;
  return (
    <span
      className={`num rounded-md border px-2 py-1 text-sm ${s <= 10 ? 'border-stamp text-stamp' : 'border-line text-soft'}`}
      role="timer"
      aria-label={t('room.timerLabel')}
      data-countdown
    >
      {t('room.timeLeft', { s })}
    </span>
  );
}

/** Countdown and waiting count, placed at the start of a screen's action bar. */
export function OnlineStatus({ v }: { v: ViewState }) {
  const online = useOnline();
  const { waiting, done } = useWaiting(v);
  if (!online) return null;
  return (
    <span className="me-auto flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <Countdown />
      {done && waiting > 0 && (
        <span className="text-soft" data-waiting>
          {waitingText(waiting)}
        </span>
      )}
    </span>
  );
}

/** Online, a Continue button becomes Ready; once pressed it waits for the others. */
export function ReadyButton({ v, label, onClick, className = 'btn-primary' }: { v: ViewState; label: string; onClick: () => void; className?: string }) {
  const online = useOnline();
  const pending = usePending();
  const { done } = useWaiting(v);
  if (!online) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {label}
      </button>
    );
  }
  return (
    <button type="button" className={className} disabled={done || pending} aria-pressed={done} onClick={onClick}>
      {done ? `${t('room.readyDone')} ✓` : t('room.ready')}
    </button>
  );
}

/** Shown in place of a decision form once this player's choice is in (online only). */
export function LockedInPanel({ v }: { v: ViewState }) {
  const { waiting } = useWaiting(v);
  const talking = v.phase.kind === 'TALK';
  return (
    <>
      <section className="rounded-md border-2 border-ink bg-card p-4" aria-live="polite" data-locked-in>
        <p className="font-semibold">{talking ? t('room.lockedInYou') : t('room.submittedYou')}</p>
        {waiting > 0 && <p className="mt-1 text-sm text-soft">{waitingText(waiting)}</p>}
      </section>
      <PrimaryBar>
        <span />
      </PrimaryBar>
    </>
  );
}

/** A banner when the connection drops, and briefly when it is back. */
export function ConnectionBanner() {
  const online = useOnline();
  const status = useRoom((s) => s.status);
  const restoredAt = useRoom((s) => s.restoredAt);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!restoredAt) return;
    const id = setTimeout(() => tick((x) => x + 1), 3500);
    return () => clearTimeout(id);
  }, [restoredAt]);
  if (!online) return null;
  const lost = status === 'lost' || status === 'connecting';
  const restored = !lost && restoredAt !== null && Date.now() - restoredAt < 3000;
  if (!lost && !restored) return null;
  return (
    <div
      role="status"
      aria-live="assertive"
      data-connection={lost ? 'lost' : 'restored'}
      className={`fixed inset-x-0 top-0 z-[60] px-4 py-2 text-center text-sm font-semibold ${lost ? 'bg-stamp text-paper' : 'bg-good text-paper'}`}
    >
      {lost ? t('room.lost') : t('room.restored')}
    </div>
  );
}
