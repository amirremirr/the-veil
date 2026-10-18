import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { StructuredMessage, ValuesCard, ViewState } from '../../engine/types';
import { VALUES_CARDS } from '../../engine/types';
import { TALK } from '../../engine/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { actionName, cardName, coins, optionName } from '../labels';
import { HUMAN_ID, currentRecord, headlineText, humanLevelScore, nameOf, renderMessage, shortName, type VPlayer } from '../game';
import { Avatar, FormCard, Shape, Tip, useMotionOff } from './common';

/** True inside a combined results screen: the screen supplies one Continue button for everything. */
export const ResultsContext = createContext(false);

/**
 * The main action bar. Fixed to the bottom on phones, inline on desktop. Its height is published
 * as --bar-h so the page can pad its bottom and nothing ends up hidden under the bar.
 */
export function PrimaryBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--bar-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--bar-h', '0px');
    };
  }, []);
  return (
    <div
      ref={ref}
      data-primary-bar
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
    >
      <div className="mx-auto flex max-w-page flex-wrap justify-end gap-2">{children}</div>
    </div>
  );
}

export function talkMenu(v: ViewState): { support: string[]; oppose: string[]; promise: string[] } {
  const lv = v.levelView as Record<string, unknown>;
  switch (v.levelIndex) {
    case 1:
      return { support: ['P1', 'P2', 'P3', 'P4'], oppose: ['P1', 'P2', 'P3', 'P4'], promise: [] };
    case 2:
      return { support: ['T0', 'T20', 'T40', 'T60', 'T80'], oppose: [], promise: [] };
    case 3:
      if (v.phase.step === 'REGIME') return { support: ['VOL', 'M50', 'M100'], oppose: [], promise: [] };
      return { support: [], oppose: [], promise: lv.premium !== null && lv.premium !== undefined ? ['BUY', 'GYM'] : ['GYM'] };
    case 4:
      if (v.phase.step === 'POLICY') return { support: ['A', 'B', 'C', 'D'], oppose: ['A', 'B', 'C', 'D'], promise: [] };
      return { support: [], oppose: [], promise: [] };
    case 5:
      return { support: ['T_LOW', 'T_MID', 'T_HIGH'], oppose: [], promise: [] };
  }
}

export function TopBar({ v, onMenu, onChat }: { v: ViewState; onMenu: () => void; onChat: () => void }) {
  const rounds = { 1: 3, 2: 4, 3: 4, 4: 5, 5: 1 }[v.levelIndex];
  const count = v.messages.filter((m) => m.level === v.levelIndex).length;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-page items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="label truncate">
            {t('mode.level', { n: v.levelIndex })} · {t(`levels.${v.levelIndex}.name`)}
          </div>
          <div className="num text-sm">{t('table.round', { r: Math.max(1, v.round), n: rounds })}</div>
        </div>
        <button type="button" className="btn-ghost px-3 lg:hidden" onClick={onChat}>
          {t('table.openTranscript', { n: count })}
        </button>
        <button type="button" className="btn-ghost px-3" onClick={onMenu}>
          {t('table.menu')}
        </button>
      </div>
    </header>
  );
}

function statusFor(v: ViewState, p: VPlayer): string[] {
  const lv = v.levelView as Record<string, any>;
  const out: string[] = [];
  if (v.levelIndex === 3 && lv?.rounds?.length && v.phase.kind === 'REVEAL') {
    const r = lv.rounds[lv.rounds.length - 1];
    if (r.choices?.[p.id]?.buy) out.push(t('table.statusInsured'));
    if (r.choices?.[p.id]?.gym) out.push(t('table.statusGym'));
  }
  if (v.levelIndex === 4 && lv?.care?.[p.id]) out.push(t('table.statusCareShort'));
  return out;
}

/** Compact row of players: avatar, short name, and level-specific badges. */
export function PlayerStrip({ v }: { v: ViewState }) {
  const lv = v.levelView as Record<string, any>;
  return (
    <ul className="grid grid-cols-4 gap-1.5" aria-label={t('ui.citizens')}>
      {v.players.map((p) => {
        const me = p.id === HUMAN_ID;
        const group = v.levelIndex === 4 ? (lv?.groups?.[p.id] as 'CIRCLE' | 'SQUARE' | undefined) : undefined;
        const status = statusFor(v, p);
        return (
          <li key={p.id} className={`form-card flex min-w-0 flex-col items-center gap-0.5 px-1 py-1.5 text-center ${me ? 'ring-2 ring-ink' : ''}`}>
            <Avatar bot={p.botKey} human={p.isHuman} size={26} />
            <div className="flex max-w-full items-center gap-1 text-xs font-semibold">
              <span className="truncate" title={p.name}>
                {shortName(v, p.id)}
              </span>
              {group && <Shape group={group} size={10} />}
            </div>
            {status.length > 0 && <div className="max-w-full truncate font-mono text-[9px] uppercase text-soft">{status.join(' · ')}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export function ChatFeed({ v, onlyCurrent = false }: { v: ViewState; onlyCurrent?: boolean }) {
  const msgs = v.messages.filter((m) => m.level === v.levelIndex && (!onlyCurrent || m.round === v.round));
  const end = useRef<HTMLLIElement>(null);
  const off = useMotionOff();
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: off ? 'auto' : 'smooth' });
  }, [msgs.length, off]);
  if (!msgs.length) return <p className="text-sm text-soft">{t('table.noMessages')}</p>;
  return (
    <ol className="space-y-2 text-sm">
      <AnimatePresence initial={false}>
        {msgs.map((m) => (
          <motion.li
            key={m.id}
            initial={off ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-md border p-2 ${m.from === HUMAN_ID ? 'border-ink bg-ink/5' : 'border-line bg-card'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{nameOf(v, m.from)}</span>
              <span className="num text-[10px] text-soft">
                R{m.round}
                {m.resolved && m.kept !== undefined && (
                  <span className={m.kept ? ' text-good' : ' text-stamp'}>{` · ${m.kept ? t('ui.kept') : t('ui.broken')}`}</span>
                )}
              </span>
            </div>
            <p className="mt-0.5 leading-snug">{renderMessage(v, m)}</p>
          </motion.li>
        ))}
      </AnimatePresence>
      <li ref={end} aria-hidden />
    </ol>
  );
}

/** "What others said" strip at the top of a decision form, while the chat is open. */
export function ChatStrip({ v, onReply }: { v: ViewState; onReply: () => void }) {
  const talkFrom = useStore((s) => s.talkFrom);
  const msgs = v.messages.filter((m) => m.level === v.levelIndex && (talkFrom !== null ? m.id >= talkFrom : m.round === v.round));
  const left = TALK.MAX_MESSAGES - v.talkSent;
  return (
    <section className="rounded-md border border-line bg-card px-3 py-2" aria-label={t('flow.othersSaid')}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="label">{t('flow.othersSaid')}</h2>
        {left > 0 && (
          <button type="button" className="btn-ghost min-h-[36px] px-3 py-1 text-sm" onClick={onReply}>
            {t('flow.reply')}
          </button>
        )}
      </div>
      {msgs.length ? (
        <ul className="mt-1 space-y-1 text-sm leading-snug">
          {msgs.map((m) => (
            <li key={m.id}>
              <span className="font-semibold">{nameOf(v, m.from)}:</span> {renderMessage(v, m)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-soft">{t('flow.noTalk')}</p>
      )}
      {v.levelIndex === 1 && v.round === 1 && <Tip id="chat" text={t('tips.chat')} />}
    </section>
  );
}

type MsgType = StructuredMessage['type'];

/** The message composer. Sends only while the chat phase is open; the engine enforces it. */
export function MessageComposer({ v }: { v: ViewState }) {
  const dispatch = useStore((s) => s.dispatch);
  const menu = talkMenu(v);
  const types: MsgType[] = [];
  if (menu.support.length) types.push('SUPPORT');
  if (menu.oppose.length) types.push('OPPOSE');
  if (menu.promise.length) types.push('PROMISE');
  types.push('CLAIM_VALUES', 'ACCUSE', 'FLAVOR');
  const [type, setType] = useState<MsgType>(types[0]);
  const [option, setOption] = useState('');
  const [card, setCard] = useState<ValuesCard>('RAWLSIAN');
  const others = v.players.filter((p) => p.id !== HUMAN_ID);
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const left = TALK.MAX_MESSAGES - v.talkSent;
  const opts = type === 'SUPPORT' ? menu.support : type === 'OPPOSE' ? menu.oppose : type === 'PROMISE' ? menu.promise : [];
  const chosen = opts.includes(option) ? option : opts[0];
  const send = () => {
    let msg: StructuredMessage;
    if (type === 'SUPPORT' || type === 'OPPOSE') msg = { type, option: chosen };
    else if (type === 'PROMISE') msg = { type, action: chosen };
    else if (type === 'CLAIM_VALUES') msg = { type, card };
    else if (type === 'ACCUSE') msg = { type, target, card };
    else msg = { type: 'FLAVOR' };
    dispatch({ type: 'SEND_MESSAGE', from: HUMAN_ID, msg });
  };
  return (
    <div>
      <p className="mb-3 text-sm text-soft">
        {t('talk.intro', { max: TALK.MAX_MESSAGES })} <span className="num">({t('talk.remaining', { n: left })})</span>
      </p>
      <fieldset disabled={left <= 0} className="space-y-3">
        <legend className="label mb-1">{t('talk.type')}</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('talk.type')}>
          {types.map((ty) => (
            <button key={ty} type="button" aria-pressed={type === ty} className="choice w-auto px-3 py-2 text-sm" onClick={() => setType(ty)}>
              {t(`talk.${ty}`)}
            </button>
          ))}
        </div>
        {opts.length > 0 && (
          <label className="block">
            <span className="label">{t('talk.option')}</span>
            <select className="mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-2" value={chosen} onChange={(e) => setOption(e.target.value)}>
              {opts.map((o) => (
                <option key={o} value={o}>
                  {type === 'PROMISE' ? actionName(v.levelIndex, o) : optionName(v.levelIndex, o)}
                </option>
              ))}
            </select>
          </label>
        )}
        {type === 'ACCUSE' && (
          <label className="block">
            <span className="label">{t('talk.target')}</span>
            <select className="mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-2" value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {(type === 'CLAIM_VALUES' || type === 'ACCUSE') && (
          <label className="block">
            <span className="label">{t('talk.card')}</span>
            <select className="mt-1 min-h-[44px] w-full rounded-md border-2 border-line bg-card px-2" value={card} onChange={(e) => setCard(e.target.value as ValuesCard)}>
              {VALUES_CARDS.map((c) => (
                <option key={c} value={c}>
                  {cardName(c)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="btn-primary w-full" onClick={send}>
          {t('talk.send')}
        </button>
      </fieldset>
    </div>
  );
}

/** A full-screen sheet on phones, a centered panel on desktop. */
export function Sheet({ title, onClose, closeLabel, children }: { title: string; onClose: () => void; closeLabel: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-ink/40 lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex w-full max-w-lg flex-col bg-paper lg:max-h-[85vh] lg:rounded-md lg:border lg:border-line">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <span className="label">{title}</span>
          <button type="button" className="btn-ghost" autoFocus onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function Newsletter({ text }: { text: string }) {
  if (!text) return null;
  return (
    <aside className="mt-4 border-y-4 border-double border-ink py-2">
      <div className="label">{t('newsletter')}</div>
      <p className="h-display text-lg leading-snug">{text}</p>
    </aside>
  );
}

/** Up to two decimals, trailing zeros dropped (20.25, 20.3, 20). */
const num2 = (x: number) => String(Math.round(x * 100) / 100);

/** Money table, score breakdown, and the news headline for a finished round. */
export function SummaryBlock({ v, showMoney = true }: { v: ViewState; showMoney?: boolean }) {
  const rec = currentRecord(v);
  if (!rec) return null;
  const me = v.players.find((p) => p.id === HUMAN_ID);
  const card = me?.values;
  const rows = v.players.slice().sort((a, b) => rec.W[b.id] - rec.W[a.id]);
  const S = rec.S[HUMAN_ID] ?? 0;
  // The engine's own numbers: S = 0.5 W + 0.5 k M. Rounded so the shown parts add up exactly.
  const egoist = card === 'EGOIST';
  const w2 = Math.round(0.5 * rec.W[HUMAN_ID] * 100) / 100;
  // For the Egoist both halves are the same number; otherwise the goal part is the remainder.
  const s2 = egoist ? 2 * w2 : Math.round(S * 100) / 100;
  const sShown = num2(s2);
  const wPart = num2(w2);
  const gPart = num2(egoist ? w2 : s2 - w2);
  return (
    <FormCard form={t('summary.title', { r: v.round })}>
      {showMoney && (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('summary.citizen')}</th>
              <th className="text-end">{t('summary.wealth')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={p.id === HUMAN_ID ? 'font-semibold' : ''}>
                <td>{nameOf(v, p.id)}</td>
                <td className="num text-end">{coins(rec.W[p.id])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className={`${showMoney ? 'mt-3 ' : ''}rounded-md border-2 border-ink p-3`} data-score-breakdown>
        <p className="font-semibold leading-snug">
          {egoist ? t('summary.breakdownEgoist', { s: sShown, w: wPart, g: gPart }) : t('summary.breakdown', { s: sShown, w: wPart, g: gPart })}
        </p>
        {card && <p className="mt-1 text-sm text-soft">{t('summary.goalReminder', { card: t(`values.${card}.short`) })}</p>}
        <p className="mt-2 flex justify-between text-sm">
          <span>{t('summary.levelScore')}</span>
          <span className="num font-semibold">{coins(humanLevelScore(v))}</span>
        </p>
      </div>
      <p className="mt-2 text-xs text-soft">{t('summary.scoreNote')}</p>
      <Newsletter text={headlineText(rec)} />
      {v.levelIndex === 1 && v.round === 1 && <Tip id="results" text={t('tips.results')} />}
    </FormCard>
  );
}

export function ContinueBar({ label }: { label?: string }) {
  const act = useStore((s) => s.act);
  const inResults = useContext(ResultsContext);
  if (inResults) return null;
  return (
    <PrimaryBar>
      <button type="button" className="btn-primary" onClick={() => act()}>
        {label ?? t('app.continue')}
      </button>
    </PrimaryBar>
  );
}
