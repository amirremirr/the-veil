// UI V4 (V2): "How this episode works", the one rules card of each episode: three short lines and one
// picture, at the start of the episode and again from the menu. In a life it also names the one new thing
// you can do this episode (verbs unlock one at a time). Presentation only.
import type { ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { t } from '../i18n';
import { coins } from '../labels';
import { newVerb } from './logic';

const INK = '#120e24';

/** One simple picture per episode, drawn in code (abstract shapes, no people). */
export function EpisodePicture({ level, size = 96 }: { level: number; size?: number }) {
  const w = size * 3;
  const common = { width: w, height: size, viewBox: '0 0 300 100', 'aria-hidden': true as const, className: 'mx-auto block' };
  const card = (x: number, label: string, fill = '#2a2350') => (
    <g key={x}>
      <rect x={x} y="22" width="40" height="56" rx="6" fill={fill} stroke="#ffd23f" strokeWidth="3" />
      <text x={x + 20} y="58" textAnchor="middle" fontSize="26" fontWeight="800" fill="#ffd23f">
        {label}
      </text>
    </g>
  );
  if (level === 1)
    return (
      <svg {...common}>
        {card(10, '?')}
        {card(56, '?')}
        {card(102, '?')}
        {card(148, '?')}
        <rect x="214" y="44" width="70" height="44" rx="6" fill="#2dd4bf" stroke={INK} strokeWidth="3" />
        <rect x="236" y="40" width="26" height="8" rx="3" fill={INK} />
        <rect x="241" y="14" width="16" height="30" rx="2" fill="#fff" stroke={INK} strokeWidth="2" transform="rotate(8 249 29)" />
      </svg>
    );
  if (level === 2)
    return (
      <svg {...common}>
        <circle cx="52" cy="50" r="36" fill="#2a2350" stroke="#ffd23f" strokeWidth="4" />
        <path d="M52 50 L52 24 M52 50 L70 60" stroke="#ffd23f" strokeWidth="5" strokeLinecap="round" />
        <text x="118" y="62" fontSize="30" fontWeight="800" fill="#ffd23f">
          +
        </text>
        <rect x="150" y="30" width="40" height="40" rx="8" fill="#fff" stroke={INK} strokeWidth="3" />
        <circle cx="162" cy="42" r="4" fill={INK} />
        <circle cx="178" cy="58" r="4" fill={INK} />
        <circle cx="170" cy="50" r="4" fill={INK} />
        <text x="204" y="62" fontSize="30" fontWeight="800" fill="#ffd23f">
          =
        </text>
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx="262" cy={70 - i * 12} rx="24" ry="8" fill="#ffd23f" stroke={INK} strokeWidth="2.5" />
        ))}
      </svg>
    );
  if (level === 3)
    return (
      <svg {...common}>
        <g transform="translate(70 52)">
          <circle r="40" fill="#34d399" stroke="#ffd23f" strokeWidth="4" />
          <path d="M0 0 L0 -40 A40 40 0 0 1 38 -12 Z" fill="#ff3e7f" />
          <path d="M0 -50 L-6 -38 L6 -38 Z" fill="#fff" />
        </g>
        <path d="M150 30 L190 20 L230 30 L230 58 Q230 84 190 94 Q150 84 150 58 Z" fill="#2dd4bf" stroke={INK} strokeWidth="3" />
        <path d="M172 58 L186 72 L210 44" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="262" y="70" textAnchor="middle" fontSize="44" fontWeight="900" fill="#ff3e7f">
          !
        </text>
      </svg>
    );
  if (level === 4)
    return (
      <svg {...common}>
        <rect x="16" y="20" width="76" height="62" rx="12" fill="#a5b4fc" stroke={INK} strokeWidth="3" />
        <rect x="30" y="36" width="48" height="18" rx="6" fill={INK} />
        <circle cx="44" cy="45" r="5" fill="#2dd4bf" />
        <circle cx="64" cy="45" r="5" fill="#2dd4bf" />
        <rect x="38" y="62" width="32" height="6" rx="3" fill={INK} />
        <path d="M54 20 L54 8" stroke={INK} strokeWidth="3" />
        <circle cx="54" cy="7" r="5" fill="#ff3e7f" stroke={INK} strokeWidth="2" />
        <rect x="120" y="24" width="76" height="54" rx="8" fill="#ffd23f" stroke={INK} strokeWidth="3" />
        <text x="158" y="58" textAnchor="middle" fontSize="18" fontWeight="800" fill={INK}>
          {t('play.howto.complex')}
        </text>
        <rect x="210" y="24" width="76" height="54" rx="8" fill="#2a2350" stroke="#ffd23f" strokeWidth="3" />
        <text x="248" y="58" textAnchor="middle" fontSize="18" fontWeight="800" fill="#ffd23f">
          {t('play.howto.simple')}
        </text>
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="20" y="16" width="110" height="70" rx="8" fill="#fff" stroke={INK} strokeWidth="3" />
      <path d="M36 36 H112 M36 52 H100 M36 68 H86" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <rect x="150" y="30" width="56" height="44" rx="8" fill="#34d399" stroke={INK} strokeWidth="3" />
      <text x="178" y="60" textAnchor="middle" fontSize="18" fontWeight="800" fill={INK}>
        {t('play.cast.yes')}
      </text>
      <rect x="220" y="30" width="56" height="44" rx="8" fill="#ff3e7f" stroke={INK} strokeWidth="3" />
      <text x="248" y="60" textAnchor="middle" fontSize="18" fontWeight="800" fill={INK}>
        {t('play.cast.no')}
      </text>
      <ellipse cx="248" cy="88" rx="20" ry="7" fill="#ffd23f" stroke={INK} strokeWidth="2.5" />
    </svg>
  );
}

/** The card's three lines for this episode, with this game's numbers. */
export function howLines(v: ViewState): string[] {
  const n = v.levelIndex;
  const life = v.mode === 'LIFE';
  const key = `play.howto.L${n}${n === 5 && life ? 'life' : ''}`;
  const vars = { c: String(v.play?.livingCost ?? PLAY.LIVING_COST), loss: coins(v.play?.l3?.loss ?? 0), n: String(PLAY.HUSTLE_PRIZE), m: String(PLAY.LIFE_MISSION_EP_MULT[5] ?? 1) };
  return [0, 1, 2].map((i) => t(`${key}.${i}`, vars));
}

/** The card itself: label, title, picture, three lines, and in a life the episode's new verb. */
export function HowItWorks({ v, compact = false }: { v: ViewState; compact?: boolean }) {
  const n = v.levelIndex;
  const nv = newVerb(v);
  return (
    <section aria-labelledby={`howto-${n}`} data-howto={n}>
      <p className="text-small font-bold uppercase tracking-wider text-soft">
        {t('play.modes.ep', { n })} · {t('play.intro.rules')}
        {v.difficulty !== 'NORMAL' ? ` · ${t(`play.setup.badge.${v.difficulty}`)}` : ''}
      </p>
      <h1 id={`howto-${n}`} className={`h-show leading-none text-spot ${compact ? 'text-title' : 'text-hero'}`}>
        {t(`play.episodes.${n}.name`)}
      </h1>
      <div className="mt-2">
        <EpisodePicture level={n} size={compact ? 64 : 88} />
      </div>
      <ol className={`mt-2 space-y-1 ${compact ? 'text-small' : 'text-body'} leading-snug`} data-intro>
        {howLines(v).map((x, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="h-show text-spot">
              {i + 1}
            </span>
            <span>{x}</span>
          </li>
        ))}
      </ol>
      {nv && (
        <p className="mt-2 inline-block rounded-full bg-spot px-2 text-small font-bold text-onspot" data-new-verb={nv}>
          {t(`play.howto.new.${nv}`)}
        </p>
      )}
    </section>
  );
}
