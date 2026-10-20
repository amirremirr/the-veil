// The ON AIR bar (Play spec 7.1): episode, round, every contestant's bank and rank, your mission bar and
// danger meter, chat and menu. Banks are public in Play (it is TV); ranks only, never exact scores.
import type { ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { t } from '../i18n';
import { coins } from '../labels';
import { shortName } from '../game';
import { Avatar } from '../components/common';
import { Thinking } from '../components/Online';
import { danger, missionName } from './logic';

const rounds = (v: ViewState) => Math.max(1, ...v.queue.map((p) => p.round));

const DANGER_CLASS = { green: 'bg-good', amber: 'bg-amber', red: 'bg-stamp' } as const;

/** Under your bank: green above 60, amber 0 to 60, red in debt. Text, not color alone. */
export function DangerMeter({ bank }: { bank: number }) {
  const d = danger(bank);
  const fill = bank < 0 ? 100 : Math.max(8, Math.min(100, (bank / (PLAY.DANGER_AMBER_BELOW * 2)) * 100));
  return (
    <div className="flex items-center gap-2" data-danger={d}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full ${DANGER_CLASS[d]}`} style={{ width: `${fill}%` }} />
      </div>
      <span className={`font-mono text-[10px] uppercase ${d === 'red' ? 'text-stamp' : d === 'amber' ? 'text-amber' : 'text-good'}`}>{t(`play.bar.danger.${d}`)}</span>
    </div>
  );
}

export function MissionBar({ v }: { v: ViewState }) {
  const m = v.play?.mission;
  if (!m) return null;
  const value = m.scale * m.value;
  const share = Math.max(0, Math.min(1, value / m.goal));
  const label = t('play.bar.missionBar', { name: missionName(m.card), value: coins(value), goal: coins(m.goal) });
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate font-semibold">{label}</span>
      </div>
      <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={t('play.a11y.missionProgress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-valuetext={label}>
        <div className="h-full bg-stamp transition-[width] duration-700" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

/** Every contestant: avatar, short name, bank and rank. */
export function BankStrip({ v }: { v: ViewState }) {
  const pl = v.play!;
  return (
    <ul className="grid grid-cols-4 gap-1.5" aria-label={t('play.bar.ranking')}>
      {v.players.map((p) => {
        const me = p.id === v.viewer;
        const bank = pl.banks[p.id];
        const rank = pl.ranks?.[p.id] ?? null;
        return (
          <li
            key={p.id}
            className={`form-card relative flex min-w-0 flex-col items-center gap-0.5 px-1 py-1.5 text-center ${me ? 'ring-2 ring-stamp' : ''}`}
            aria-label={rank === null ? t('play.a11y.bankOnly', { name: shortName(v, p.id), bank: coins(bank) }) : t('play.a11y.bankOf', { name: shortName(v, p.id), bank: coins(bank), rank })}
          >
            {rank !== null && (
              <span className={`absolute end-1 top-1 rounded px-1 font-mono text-[10px] font-semibold ${rank === 1 ? 'bg-spot text-onspot' : 'bg-line text-ink'}`} aria-hidden>
                {t('play.bar.rank', { n: rank })}
              </span>
            )}
            <Avatar bot={p.botKey} human={p.isHuman} size={24} />
            <span className="max-w-full truncate text-xs font-semibold" aria-hidden>
              {shortName(v, p.id)}
            </span>
            <span className={`num text-sm font-semibold ${bank < 0 ? 'text-stamp' : ''}`} aria-hidden>
              {coins(bank)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function OnAirBar({ v, onMenu, onChat }: { v: ViewState; onMenu: () => void; onChat: () => void }) {
  const count = v.messages.filter((m) => m.level === v.levelIndex).length;
  const myBank = v.play!.banks[v.viewer];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-page px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded bg-stamp px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-paper" aria-label={t('play.onAir')}>
            ● {t('play.onAir')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="h-show truncate text-sm leading-tight">{t(`play.episodes.${v.levelIndex}.name`)}</div>
            <div className="num text-[11px] text-soft">{t('play.bar.round', { r: Math.max(1, v.round), n: rounds(v) })}</div>
          </div>
          <Thinking inline />
          <button type="button" className="btn-ghost min-h-[40px] px-2 text-sm lg:hidden" onClick={onChat}>
            {t('play.bar.chat', { n: count })}
          </button>
          <button type="button" className="btn-ghost min-h-[40px] px-2 text-sm" onClick={onMenu}>
            {t('play.bar.menu')}
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="label">{t('play.bar.bank')}</span>
              <span className={`num text-lg font-bold ${myBank < 0 ? 'text-stamp' : ''}`}>{coins(myBank)}</span>
            </div>
            <DangerMeter bank={myBank} />
          </div>
          <MissionBar v={v} />
        </div>
      </div>
    </header>
  );
}
