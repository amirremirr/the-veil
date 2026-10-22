// Play-mode presentation logic (PLAY_MODE_SPEC.md Section 7). Pure functions of the viewer's own view, so
// nothing here can see more than visibleState allows. Variant choices come from a hash of the game code
// and the moment (like the Study flavor text), never from a random stream, so the game is unchanged.
import { hashString } from '../../engine/rng';
import { PLAY } from '../../engine/play/params';
import type { L3Round } from '../../engine/levels/level3';
import type { BotKey, LevelId, Message, PlayerId, ValuesCard, ViewState } from '../../engine/types';
import type { PlayView } from '../../engine/play/types';
import host from '../copy/play/host.json';
import confessionals from '../copy/play/confessionals.json';
import wheel from '../copy/play/wheel.json';
import { fill, t } from '../i18n';
export type OutcomeKey = 'jackpot' | 'disaster' | 'betrayal' | 'debt' | 'comeback' | 'quiet';
export const OUTCOME_KEYS: OutcomeKey[] = ['jackpot', 'disaster', 'betrayal', 'debt', 'comeback', 'quiet'];

/** A stable variant index for a moment of this game. */
export function pick(v: Pick<ViewState, 'seed' | 'levelIndex' | 'round'>, key: string, n: number): number {
  return n > 0 ? hashString(`${v.seed}|play|${v.levelIndex}|${v.round}|${key}`) % n : 0;
}

type Banks = Record<string, string[]>;

/** One of Dash's lines; the `.you` bank when the subject is the viewer (D-38). At most 15 words each. */
export function hostLine(key: string, variant: number, vars: Record<string, string> = {}, aboutYou = false): string {
  const banks = host as unknown as Banks;
  const bank = (aboutYou && banks[`${key}.you`]) || banks[key] || [];
  return bank.length ? fill(bank[variant % bank.length], vars) : '';
}

export function confessional(bot: BotKey, key: OutcomeKey, variant: number): string {
  const bank = (confessionals as unknown as Record<string, Record<string, string[]>>)[bot]?.[key] ?? [];
  return bank.length ? bank[variant % bank.length] : '';
}

export function wheelSlip(variant: number): string {
  return wheel.slips[variant % wheel.slips.length];
}

export const missionName = (c: ValuesCard) => t(`play.missions.${c}.name`);

/** The event card's name, story and one-line effect, with this episode's numbers filled in. */
export function eventText(level: LevelId, id: string): { name: string; text: string; effect: string } {
  const vars = {
    gym: String(PLAY.L3_EVENTS.GYM_SALE.GYM_COST),
    base: String(id === 'GYM_SALE' ? PLAY.L3.GYM_COST : PLAY.L3.LOSS),
    loss: String(PLAY.L3_EVENTS.BREAKTHROUGH.LOSS),
    extra: String(PLAY.L3_EVENTS.PAPERWORK.MANDATE_EXTRA),
  };
  const k = `play.events.L${level}.${id}`;
  return { name: t(`${k}.name`), text: t(`${k}.text`), effect: t(`${k}.effect`, vars) };
}

export type Danger = 'green' | 'amber' | 'red';
/** Section 7.1: green above DANGER_AMBER_BELOW, amber from 0 to it, red in debt. */
export function danger(bank: number): Danger {
  if (bank < 0) return 'red';
  return bank > PLAY.DANGER_AMBER_BELOW ? 'green' : 'amber';
}

/** A broken promise from this round, stamped on the results screen (Section 7.3). */
export interface Broken {
  from: PlayerId;
  action: string;
}

/** Messages of this level and round whose claim was checked and not kept. All of it is public. */
export function brokenPromises(v: ViewState, step?: string): Broken[] {
  const out: Broken[] = [];
  for (const m of v.messages as Message[]) {
    if (m.level !== v.levelIndex || m.round !== v.round || !m.resolved || m.kept !== false) continue;
    if (step && m.checkStep !== step) continue;
    if (m.msg.type === 'PROMISE') out.push({ from: m.from, action: t(`play.promises.${m.msg.action}`) });
    if (m.msg.type === 'SUPPORT') out.push({ from: m.from, action: t('play.promises.VOTE', { option: t(`play.l3.regimes.${m.msg.option}.name`) }) });
  }
  return out;
}

/** What a finished Episode 3 round was about, and who it was about (Section 7.3 outcome keys). */
export function roundOutcome(v: ViewState, r: L3Round): { key: OutcomeKey; subject: PlayerId | null } {
  const pl = v.play!;
  const hist = pl.bankHistory.filter((h) => h.level === v.levelIndex);
  const now = hist[hist.length - 1];
  const before = hist.length > 1 ? hist[hist.length - 2] : null;
  const broken = brokenPromises(v, 'CHOICE');
  if (broken.length) return { key: 'betrayal', subject: broken[0].from };
  const ids = v.players.map((p) => p.id);
  const intoDebt = ids.find((id) => now && now.banks[id] < 0 && (!before || before.banks[id] >= 0));
  if (intoDebt) return { key: 'debt', subject: intoDebt };
  const hit = ids.find((id) => r.events[id] && !(r.choices[id].buy && r.premium !== null) && r.regime === 'VOL');
  if (hit) return { key: 'disaster', subject: hit };
  if (before && now) {
    const last = Math.max(...ids.map((id) => before.ranks[id]));
    const up = ids.find((id) => before.ranks[id] === last && now.ranks[id] < last && last > 1);
    if (up) return { key: 'comeback', subject: up };
  }
  const best = ids.reduce((a, b) => (r.W[b] > r.W[a] ? b : a), ids[0]);
  if (r.W[best] - PLAY.LIVING_COST >= 80) return { key: 'jackpot', subject: best };
  return { key: 'quiet', subject: null };
}

/** The bot that speaks to camera: the subject if it is a bot, otherwise one picked by the moment's hash. */
export function confessor(v: ViewState, subject: PlayerId | null): ViewState['players'][number] | null {
  const bots = v.players.filter((p) => !p.isHuman && p.botKey);
  if (!bots.length) return null;
  const s = bots.find((b) => b.id === subject);
  return s ?? bots[pick(v, 'confessor', bots.length)];
}

/** Section 7.6: the episode's biggest moment (largest single-round bank swing, or an event card). */
export function biggestMoment(pl: PlayView, level: LevelId): { kind: 'swing'; round: number; who: PlayerId; change: number } | { kind: 'event'; round: number; id: string } | null {
  let best: { round: number; who: PlayerId; change: number } | null = null;
  for (const h of pl.bankHistory.filter((x) => x.level === level))
    for (const [who, w] of Object.entries(h.W)) {
      const change = w - PLAY.LIVING_COST;
      if (!best || Math.abs(change) > Math.abs(best.change)) best = { round: h.round, who, change };
    }
  const ev = pl.events.find((e) => e.level === level && e.id !== 'QUIET');
  if (ev && (!best || Math.abs(best.change) < 80)) return { kind: 'event', round: ev.round, id: ev.id };
  return best ? { kind: 'swing', ...best } : null;
}

// --- reactions (Section 7.3): presentation only, never logged, never sent with private data -----------

export const REACTIONS = ['laugh', 'gasp', 'angry', 'clap', 'eyeroll'] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export const REACTION_ICON: Record<ReactionKind, string> = { laugh: '😂', gasp: '😮', angry: '😠', clap: '👏', eyeroll: '🙄' };

/** A reaction is only who reacted and how. It carries no game data at all. */
export interface Reaction {
  from: PlayerId;
  kind: ReactionKind;
}

/** Which bot reactions fit an outcome, in character. */
const BOT_REACTS: Record<BotKey, Partial<Record<OutcomeKey, ReactionKind>>> = {
  chet: { disaster: 'laugh', betrayal: 'clap', debt: 'eyeroll', comeback: 'angry', jackpot: 'clap', quiet: 'eyeroll' },
  marigold: { disaster: 'gasp', betrayal: 'gasp', debt: 'gasp', comeback: 'clap', jackpot: 'clap', quiet: 'clap' },
  ugo: { disaster: 'eyeroll', betrayal: 'eyeroll', debt: 'gasp', comeback: 'clap', jackpot: 'gasp', quiet: 'eyeroll' },
  dot: { disaster: 'eyeroll', betrayal: 'laugh', debt: 'laugh', comeback: 'eyeroll', jackpot: 'gasp', quiet: 'eyeroll' },
};

/** Bots react occasionally, from the moment's hash (never from a game stream). */
export function botReactions(v: ViewState, key: OutcomeKey): Reaction[] {
  const out: Reaction[] = [];
  for (const p of v.players) {
    if (p.isHuman || !p.botKey) continue;
    const roll = pick(v, `react-${p.id}`, 1000) / 1000;
    const kind = BOT_REACTS[p.botKey][key];
    if (kind && roll < PLAY.BOT_REACTION_CHANCE) out.push({ from: p.id, kind });
  }
  return out;
}
