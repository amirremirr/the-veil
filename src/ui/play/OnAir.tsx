// Play's stage (Play spec 7.1, redesign D-108): one beat per screen, nothing to scroll at 375 x 760.
// The top bar holds only ON AIR, the round, your bank and four small avatars with banks. The mission bar,
// the chat log and leaving the show live in the menu.
import { useState, type ReactNode } from 'react';
import type { ViewState } from '../../engine/types';
import { TALK } from '../../engine/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins } from '../labels';
import { shortName } from '../game';
import { Avatar } from '../components/common';
import { ChatFeed, MessageComposer, Sheet } from '../components/TableParts';
import { useOnline } from '../components/Online';
import { missionName } from './logic';

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
      <p className="text-sm font-semibold">{label}</p>
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
      <button type="button" className="btn-ghost w-full" onClick={() => (online ? leaveOnline() : go('title'))}>
        {t('play.stage.menuQuit')}
      </button>
    </Sheet>
  );
}

export function TopBar({ v, onMenu }: { v: ViewState; onMenu: () => void }) {
  const pl = v.play!;
  const mine = pl.banks[v.viewer];
  return (
    <header className="mx-auto w-full max-w-md px-4 pt-3" onClick={stop}>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-stamp px-2 py-0.5 text-[11px] font-bold tracking-wider text-onspot">{t('play.onAir')}</span>
        <span className="text-xs text-soft">{t('play.bar.round', { r: Math.max(1, v.round), n: rounds(v) })}</span>
        <span className="ms-auto text-end leading-none">
          <span className="block text-[10px] uppercase tracking-wider text-soft">{t('play.bar.bank')}</span>
          <span className={`h-show text-2xl ${mine < 0 ? 'text-stamp' : ''}`}>{coins(mine)}</span>
        </span>
        <button type="button" className="ms-1 grid h-11 w-11 place-items-center rounded-full bg-card text-xl" aria-label={t('play.bar.menu')} onClick={onMenu}>
          <span aria-hidden>≡</span>
        </button>
      </div>
      <ul className="mt-2 flex justify-between" aria-label={t('play.bar.ranking')}>
        {v.players.map((p) => (
          <li key={p.id} className="flex w-16 flex-col items-center" aria-label={t('play.a11y.bankOnly', { name: shortName(v, p.id), bank: coins(pl.banks[p.id]) })}>
            <span className={`rounded-full ${p.id === v.viewer ? 'ring-2 ring-spot' : ''}`} aria-hidden>
              <Avatar bot={p.botKey} human={p.isHuman} size={30} />
            </span>
            <span className={`text-[11px] font-semibold ${pl.banks[p.id] < 0 ? 'text-stamp' : 'text-soft'}`} aria-hidden>
              {coins(pl.banks[p.id])}
            </span>
          </li>
        ))}
      </ul>
    </header>
  );
}

/**
 * One screen of the show. `onTap` makes the whole screen advance on a tap (beats); buttons inside stop the
 * tap from bubbling. Content stacks from the top and the action sits at the bottom.
 */
export function Stage({
  v,
  children,
  footer,
  onTap,
  bar = true,
  tone = 'stage',
  chatFirst = false,
}: {
  v: ViewState;
  children: ReactNode;
  footer?: ReactNode;
  onTap?: () => void;
  bar?: boolean;
  tone?: 'stage' | 'breaking';
  chatFirst?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className={`flex min-h-[100dvh] flex-col ${tone === 'breaking' ? 'bg-spot text-onspot' : ''} ${onTap ? 'cursor-pointer' : ''}`} onClick={onTap} data-stage data-beat={onTap ? 'tap' : undefined}>
      {bar && <TopBar v={v} onMenu={() => setMenu(true)} />}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-3">
        <div className="flex flex-1 flex-col">{children}</div>
        {footer && (
          <div className="pt-3" onClick={stop}>
            {footer}
          </div>
        )}
      </main>
      {menu && <PlayMenu v={v} chatFirst={chatFirst} onClose={() => setMenu(false)} />}
    </div>
  );
}

/** The single voice on a screen: Dash, or one contestant. */
export function Bubble({ who, text, host = false, bot }: { who: string; text: string; host?: boolean; bot?: ViewState['players'][number] }) {
  if (!text) return null;
  return (
    <figure className={`flex items-start gap-2 rounded-2xl px-3 py-2 ${host ? 'bg-spot text-onspot' : 'bg-card'}`} data-voice={host ? 'host' : 'bot'}>
      {bot && (
        <span aria-hidden className="shrink-0">
          <Avatar bot={bot.botKey} human={bot.isHuman} size={24} />
        </span>
      )}
      <p className="text-sm leading-snug">
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
        onClick();
      }}
      className={`min-h-[52px] w-full rounded-full text-lg font-bold transition-opacity disabled:opacity-40 ${dark ? 'bg-onspot text-spot' : 'bg-stamp text-onspot'}`}
    >
      {children}
    </button>
  );
}
