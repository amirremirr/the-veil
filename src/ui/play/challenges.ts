// V6 part 4 (D-220): optional challenges. At the start of a life the player is offered three challenges drawn
// from the list below (from the life's seed, so Daily Life offers everyone the same three), picks one or skips.
// A challenge never changes the score: at the end it shows as done or not, and on the result card. Like the
// achievements (retention.ts), every check reads only public facts from the end-of-life view.
import type { Message, ViewState } from '../../engine/types';

export const CHALLENGES = [
  'NO_DEBT',
  'CATCH_TWO',
  'NO_SECOND_CHANCE',
  'FLOOR_50',
  'NEVER_LIE',
  'NEVER_PEEK',
  'NO_BAD_HIRE',
  'GIVE_20',
  'HUSTLE',
  'NO_COVER',
  'TOP_TWO',
  'ALWAYS_TRAIN',
] as const;
export type Challenge = (typeof CHALLENGES)[number];

/** How many are offered at the start of a life. */
export const OFFERED = 3;

/** A small string hash (FNV-1a), so the offer depends only on the seed. */
function hash(x: string): number {
  let h = 2166136261;
  for (let i = 0; i < x.length; i++) {
    h ^= x.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The three challenges offered for a life's seed: a seeded shuffle of the list, first three. */
export function offeredFor(seed: string): Challenge[] {
  const xs = [...CHALLENGES];
  let h = hash(`challenge:${seed}`);
  for (let i = xs.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs.slice(0, OFFERED);
}

type Results = Record<number, Record<string, unknown>>;

const finalRank = (v: ViewState, id = v.viewer) => {
  const sc = v.play!.finalScores ?? {};
  return 1 + v.players.filter((p) => (sc[p.id] ?? 0) > (sc[id] ?? 0) + 1e-9).length;
};

/** Whether the viewer met a challenge over the life (public facts only). */
export function challengeDone(v: ViewState, c: Challenge): boolean {
  const me = v.viewer;
  const r = v.levelResults as unknown as Results;
  const pl = v.play!;
  const msgs = v.messages as Message[];
  switch (c) {
    case 'NO_DEBT':
      // Never in debt after a round. (The finale's floor lifts every debt, so "finish out of debt" always holds.)
      return !pl.bankHistory.some((h) => (h.banks[me] ?? 0) < 0) && (pl.banks[me] ?? 0) >= 0;
    case 'CATCH_TWO':
      return (pl.calls ?? []).filter((x) => x.caller === me && x.lie).length >= 2;
    case 'NO_SECOND_CHANCE':
      return finalRank(v) === 1 && pl.comeback?.pid !== me;
    case 'FLOOR_50': {
      // At the end of every episode, everyone's bank is above 50.
      const ends = [1, 2, 3, 4, 5].map((l) => pl.bankHistory.filter((h) => h.level === l).slice(-1)[0]).filter(Boolean);
      return ends.length > 0 && ends.every((h) => Math.min(...Object.values(h.banks)) > 50) && Math.min(...Object.values(pl.banks)) > 50;
    }
    case 'NEVER_LIE':
      return !msgs.some((m) => m.from === me && m.msg.type === 'CLAIM' && m.kept === false);
    case 'NEVER_PEEK': {
      const l1 = r[1] as { rounds?: Array<{ peeked: string[] }> } | undefined;
      return !(l1?.rounds ?? []).some((x) => x.peeked.includes(me));
    }
    case 'NO_BAD_HIRE': {
      const l4 = r[4] as { rounds?: Array<{ judge: string; bad: string[] }> } | undefined;
      const judged = (l4?.rounds ?? []).filter((x) => x.judge === me);
      return judged.length > 0 && judged.every((x) => x.bad.length === 0);
    }
    case 'GIVE_20': {
      const l4 = r[4] as { rounds?: Array<{ gifts?: Record<string, { amount: number }> }> } | undefined;
      return (l4?.rounds ?? []).reduce((a, x) => a + (x.gifts?.[me]?.amount ?? 0), 0) >= 20;
    }
    case 'HUSTLE': {
      const l2 = r[2] as { rounds?: Array<{ winners: string[] }> } | undefined;
      return (l2?.rounds ?? []).some((x) => x.winners.includes(me));
    }
    case 'NO_COVER': {
      const l3 = r[3] as { rounds?: Array<{ launch?: boolean; applied?: Record<string, boolean> }> } | undefined;
      return !(l3?.rounds ?? []).some((x) => !x.launch && x.applied?.[me]);
    }
    case 'TOP_TWO':
      return finalRank(v) <= 2;
    case 'ALWAYS_TRAIN': {
      const l4 = r[4] as { rounds?: Array<{ workers: string[]; train: Record<string, boolean> }> } | undefined;
      const worked = (l4?.rounds ?? []).filter((x) => x.workers.includes(me));
      return worked.length > 0 && worked.every((x) => x.train[me] === true);
    }
  }
}

// The pick for a life, by seed: kept in memory and, as a convenience, on this device (a private window may
// lose it on reload; then the life shows no challenge).
const KEY = 'veil.play.challenge';
let memo: { seed: string; pick: Challenge | null } | null = null;

export function loadPick(seed: string): { decided: boolean; pick: Challenge | null } {
  if (memo?.seed === seed) return { decided: true, pick: memo.pick };
  try {
    const x = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { seed?: string; pick?: string | null } | null;
    if (x && x.seed === seed) {
      const pick = (CHALLENGES as readonly string[]).includes(x.pick ?? '') ? (x.pick as Challenge) : null;
      memo = { seed, pick };
      return { decided: true, pick };
    }
  } catch {
    /* storage blocked: fall through */
  }
  return { decided: false, pick: null };
}

export function savePick(seed: string, pick: Challenge | null): void {
  memo = { seed, pick };
  try {
    localStorage.setItem(KEY, JSON.stringify(memo));
  } catch {
    /* storage blocked: keep going */
  }
}

/** A new game starts: forget the last pick, so a replay of the same seed offers the challenges again. */
export function clearPick(): void {
  memo = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: keep going */
  }
}
