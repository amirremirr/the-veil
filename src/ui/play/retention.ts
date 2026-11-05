// Retention without dark patterns (v2 Section 7, RUNPLAN T8, D-157): Daily Life, a spoiler-free share text,
// achievements named after the economics (at most 12, none for grinding), and the rival line. No streaks,
// no notifications, no timers. Everything here reads only public facts from the end-of-life view.
import type { Message, ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { t } from '../i18n';
import { shortName } from '../game';
import { episodeChanges, receipts } from './LifeEnd';

/** The Europe/Istanbul calendar day, as YYYY-MM-DD. */
export function istanbulDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Daily Life: one shared seed per Istanbul day; everyone plays the same life against the bots. */
export const dailySeed = (day = istanbulDay()) => `daily-${day}`;
export const isDaily = (v: Pick<ViewState, 'seed'>) => !!v.seed && v.seed.startsWith('daily-');

const finalRank = (v: ViewState, id = v.viewer) => {
  const sc = v.play!.finalScores ?? {};
  return 1 + v.players.filter((p) => (sc[p.id] ?? 0) > (sc[id] ?? 0) + 1e-9).length;
};

/** v2 Section 7 (open item 3: an emoji grid): one line per episode (banked, lied, caught, debt), then the rank. */
export function shareText(v: ViewState): string {
  const ch = episodeChanges(v)[v.viewer];
  const rs = receipts(v);
  const msgs = v.messages as Message[];
  const hist = v.play!.bankHistory;
  const lines = [1, 2, 3, 4, 5].map((l) => {
    const banked = (ch[l] ?? 0) > 0 ? '💰' : '📉';
    const lied = msgs.some((m) => m.level === l && m.from === v.viewer && m.msg.type === 'CLAIM' && m.kept === false) ? '🤥' : '😇';
    const caught = rs.some((r) => r.level === l && r.pid === v.viewer && r.kind === 'caught') ? '🚨' : '⬜';
    const debt = hist.some((h) => h.level === l && h.banks[v.viewer] < 0) ? '🔴' : '🟢';
    return `${l} ${banked}${lied}${caught}${debt}`;
  });
  const head = isDaily(v) ? t('play.daily.shareHead', { day: v.seed!.slice(6) }) : t('play.daily.shareHeadSeed');
  return [head, ...lines, t('play.daily.shareRank', { r: finalRank(v), n: v.players.length })].join('\n');
}

export const ACHIEVEMENTS = ['DEATH_SPIRAL', 'LEMON', 'FREE_RIDER', 'GLASS_CEILING', 'KINGMAKER', 'VEIL_PIERCER', 'JACKPOT', 'CLEAN_RECORD', 'COMEBACK_KID', 'DEBT_SURVIVOR', 'BAD_HIRE', 'TOOK_THE_MONEY'] as const;
export type Achievement = (typeof ACHIEVEMENTS)[number];

type Results = Record<number, Record<string, unknown>>;

/** Which achievements this life earned for the viewer (public facts only). */
export function earned(v: ViewState): Achievement[] {
  const me = v.viewer;
  const r = v.levelResults as unknown as Results;
  const out: Achievement[] = [];
  const msgs = v.messages as Message[];
  // Episode 3: the pool emptied (SafeHands left town).
  const l3 = r[3] as { unraveled?: boolean; types?: Record<string, string>; pools?: Array<{ round: number; buyers: string[] }> } | undefined;
  if (l3?.unraveled) out.push('DEATH_SPIRAL');
  // Lemon: high risk, said "low risk", and was covered in a voluntary round.
  if (l3?.types?.[me] === 'HIGH' && msgs.some((m) => m.level === 3 && m.from === me && m.msg.type === 'CLAIM' && m.msg.value === 'LOW') && l3.pools?.some((p) => p.round > 1 && p.buyers.includes(me))) out.push('LEMON');
  // Free Rider: won the Hustle Prize in a round you worked a little (3 hours or fewer).
  const l2 = r[2] as { rounds?: Array<{ effort: Record<string, number>; winners: string[]; luck: Record<string, number> }> } | undefined;
  if (l2?.rounds?.some((x) => x.winners.includes(me) && (x.effort[me] ?? 99) <= PLAY.L2.BANDS[0])) out.push('FREE_RIDER');
  if (l2?.rounds?.some((x) => (x.luck[me] ?? 0) >= Math.max(...PLAY.L2.LUCK_VALUES))) out.push('JACKPOT');
  // Glass Ceiling Breaker: a Square hired for the complex job.
  const l4 = r[4] as { groups?: Record<string, string>; rounds?: Array<{ judge: string; job: Record<string, string>; bad: string[] }> } | undefined;
  if (l4?.groups?.[me] === 'SQUARE' && l4.rounds?.some((x) => x.job[me] === 'COMPLEX')) out.push('GLASS_CEILING');
  if (l4?.rounds?.some((x) => x.judge === me && x.bad.length > 0)) out.push('BAD_HIRE');
  // Veil Piercer: peeked in Episode 1 and your rule won.
  const l1 = r[1] as { rounds?: Array<{ peeked: string[]; votes: Record<string, string>; winner: string }> } | undefined;
  if (l1?.rounds?.some((x) => x.peeked.includes(me) && x.votes[me] === x.winner)) out.push('VEIL_PIERCER');
  // Episode 5: Kingmaker (your donation's yes was the deciding vote) and Took the Money (took a donation, voted no).
  const lv5 = v.levelIndex === 5 ? (v.levelView as { lobby?: Record<string, { donateTo: string | null; amount: number }>; amendments?: Array<{ proposer: string; votes: Record<string, boolean>; yes: number; need: number; passed: boolean; withdrawn?: boolean }> }) : null;
  const mine = lv5?.lobby?.[me];
  const myAm = lv5?.amendments?.find((a) => a.proposer === me && !a.withdrawn);
  if (mine?.donateTo && mine.amount > 0 && myAm?.passed && myAm.yes === myAm.need && myAm.votes[mine.donateTo]) out.push('KINGMAKER');
  for (const [from, lb] of Object.entries(lv5?.lobby ?? {})) {
    const a = lv5?.amendments?.find((x) => x.proposer === from && !x.withdrawn);
    if (lb.donateTo === me && lb.amount > 0 && a && !a.votes[me]) out.push('TOOK_THE_MONEY');
  }
  const claims = msgs.filter((m) => m.from === me && m.msg.type === 'CLAIM' && m.resolved);
  if (claims.length >= 5 && claims.every((m) => m.kept)) out.push('CLEAN_RECORD');
  const cb = (v.play as unknown as { comeback?: { pid: string } }).comeback;
  if (cb?.pid === me && finalRank(v) <= 2) out.push('COMEBACK_KID');
  if (v.play!.bankHistory.some((h) => h.banks[me] < 0) && finalRank(v) <= 2) out.push('DEBT_SURVIVOR');
  return [...new Set(out)];
}

const KEY = 'veil.play.achievements';

/** Achievements kept on this device (a convenience; may be empty in a private window). */
export function loadAchievements(): Achievement[] {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(x) ? x.filter((a) => (ACHIEVEMENTS as readonly string[]).includes(a)) : [];
  } catch {
    return [];
  }
}

export function saveAchievements(list: Achievement[]): Achievement[] {
  const all = [...new Set([...loadAchievements(), ...list])];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: keep going */
  }
  return all;
}

/** The rival line: the contestant just above you ("Chet beat you by 12"), or the runner-up if you won. */
export function rivalLine(v: ViewState): string {
  const sc = v.play!.finalScores ?? {};
  const mine = sc[v.viewer] ?? 0;
  const others = v.players.filter((p) => p.id !== v.viewer).sort((a, b) => (sc[b.id] ?? 0) - (sc[a.id] ?? 0));
  const above = others.filter((p) => (sc[p.id] ?? 0) > mine + 1e-9).slice(-1)[0];
  if (above) return t('play.rival.beat', { name: shortName(v, above.id), n: Math.max(1, Math.round((sc[above.id] ?? 0) - mine)) });
  const next = others[0];
  return next ? t('play.rival.won', { name: shortName(v, next.id), n: Math.max(0, Math.round(mine - (sc[next.id] ?? 0))) }) : '';
}
