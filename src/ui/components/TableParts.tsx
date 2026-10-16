import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { StructuredMessage, ValuesCard, ViewState } from '../../engine/types';
import { VALUES_CARDS } from '../../engine/types';
import { TALK } from '../../engine/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { actionName, cardName, coins, optionName } from '../labels';
import { HUMAN_ID, currentRecord, headlineText, humanLevelScore, nameOf, renderMessage, type VPlayer } from '../game';
import { Avatar, FormCard, Shape, Stamp, CountUp, useMotionOff } from './common';

/** Sticky action bar at the bottom on mobile, inline on desktop. */
export function PrimaryBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
      <div className="flex flex-wrap justify-end gap-2">{children}</div>
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

export function TopBar({ v, onMenu }: { v: ViewState; onMenu: () => void }) {
  const rounds = { 1: 3, 2: 4, 3: 4, 4: 5, 5: 1 }[v.levelIndex];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-page items-center gap-3 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="label truncate">
            {t('mode.level', { n: v.levelIndex })} · {t(`levels.${v.levelIndex}.name`)}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="num">{t('table.round', { r: Math.max(1, v.round), n: rounds })}</span>
            <span className="font-semibold">{t(`phase.${v.phase.kind}`)}</span>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={onMenu}>
          {t('table.menu')}
        </button>
      </div>
    </header>
  );
}

function statusFor(v: ViewState, p: VPlayer): string[] {
  const lv = v.levelView as Record<string, any>;
  const out: string[] = [];
  if (v.levelIndex === 3 && lv?.rounds?.length) {
    const r = lv.rounds[lv.rounds.length - 1];
    if (r.choices?.[p.id]?.buy) out.push(t('table.statusInsured'));
    if (r.choices?.[p.id]?.gym) out.push(t('table.statusGym'));
    if (r.events?.[p.id]) out.push(t('table.statusEvent'));
  }
  if (v.levelIndex === 4) {
    if (lv?.care?.[p.id]) out.push(t('table.statusCare'));
    const job = lv?.current?.job?.[p.id];
    if (job) out.push(job === 'COMPLEX' ? t('table.statusComplex') : t('table.statusSimple'));
  }
  return out;
}

export function PlayerStrip({ v }: { v: ViewState }) {
  // Wealth appears once the reveal is over, so the strip never spoils a card flip.
  const rec = v.phase.kind === 'REVEAL' ? undefined : currentRecord(v);
  const lv = v.levelView as Record<string, any>;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t('ui.citizens')}>
      {v.players.map((p) => {
        const me = p.id === HUMAN_ID;
        const group = v.levelIndex === 4 ? (lv?.groups?.[p.id] as 'CIRCLE' | 'SQUARE' | undefined) : undefined;
        const status = statusFor(v, p);
        return (
          <li key={p.id} className={`form-card flex items-center gap-2 p-2 ${me ? 'ring-2 ring-ink' : ''}`}>
            <Avatar bot={p.botKey} human={p.isHuman} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-semibold">
                <span className="truncate">{me ? `${p.name}` : p.name}</span>
                {group && <Shape group={group} />}
              </div>
              <div className="flex flex-wrap gap-1">
                {status.map((s) => (
                  <span key={s} className="rounded bg-ink/10 px-1 font-mono text-[10px] uppercase">
                    {s}
                  </span>
                ))}
              </div>
              {rec && (
                <div className="num text-xs text-soft">
                  {t('ui.wealthShort')} <CountUp value={rec.W[p.id]} />
                </div>
              )}
            </div>
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
                R{m.round} · #{String(m.id).padStart(3, '0')}
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

type MsgType = StructuredMessage['type'];

export function TalkComposer({ v }: { v: ViewState }) {
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
    <FormCard form={t('talk.title')} right={t('talk.remaining', { n: left })}>
      <p className="mb-3 text-sm text-soft">{t('talk.intro', { max: TALK.MAX_MESSAGES })}</p>
      <div className="mb-4 max-h-72 overflow-y-auto lg:hidden">
        <ChatFeed v={v} onlyCurrent />
      </div>
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
      </fieldset>
      <PrimaryBar>
        <button type="button" className="btn-ghost" disabled={left <= 0} onClick={send}>
          {t('talk.send')}
        </button>
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'ADVANCE' })}>
          {t('talk.done')}
        </button>
      </PrimaryBar>
    </FormCard>
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

export function RoundSummary({ v }: { v: ViewState }) {
  const dispatch = useStore((s) => s.dispatch);
  const rec = currentRecord(v);
  if (!rec) return null;
  const rows = v.players.slice().sort((a, b) => rec.W[b.id] - rec.W[a.id]);
  return (
    <FormCard form={t('summary.title', { r: v.round })} right={<Stamp tone="ink">{t('summary.stampDone')}</Stamp>}>
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
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <dt className="label">{t('summary.yourScore')}</dt>
        <dd className="num text-end text-lg">
          <CountUp value={rec.S[HUMAN_ID] ?? 0} />
        </dd>
        <dt className="label">{t('summary.levelScore')}</dt>
        <dd className="num text-end text-lg">
          <CountUp value={humanLevelScore(v)} />
        </dd>
      </dl>
      <p className="mt-2 text-xs text-soft">{t('summary.scoreNote')}</p>
      <Newsletter text={headlineText(rec)} />
      <PrimaryBar>
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'ADVANCE' })}>
          {t('app.continue')}
        </button>
      </PrimaryBar>
    </FormCard>
  );
}

export function ContinueBar({ label }: { label?: string }) {
  const dispatch = useStore((s) => s.dispatch);
  return (
    <PrimaryBar>
      <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'ADVANCE' })}>
        {label ?? t('app.continue')}
      </button>
    </PrimaryBar>
  );
}
