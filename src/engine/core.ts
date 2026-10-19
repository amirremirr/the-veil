// Shared helpers for the engine and level definitions. No UI, no browser APIs.
import { BOT, BOT_PROFILES, DIFFICULTY, VALUES_PRIOR } from './params';
import { roundScore, valuesMetric } from './scoring';
import { flavorIndex, stream, type Rng, standalone, hashString } from './rng';
import type {
  BotKey,
  BotProfile,
  Difficulty,
  GameState,
  Headline,
  LevelId,
  Message,
  Phase,
  Player,
  PlayerId,
  StructuredMessage,
  ValuesCard,
} from './types';
import { VALUES_CARDS } from './types';

export const ids = (s: GameState): PlayerId[] => s.players.map((p) => p.id);
export const idx = (s: GameState, pid: PlayerId): number => s.players.findIndex((p) => p.id === pid);
export const playerOf = (s: GameState, pid: PlayerId): Player => s.players[idx(s, pid)];
export const humanOf = (s: GameState): Player | undefined => s.players.find((p) => p.isHuman);
export const nPlayers = (s: GameState): number => s.players.length;

export const gameRng = (s: GameState): Rng => stream(s, 'game');
export const botRng = (s: GameState): Rng => stream(s, 'bots');

/** A bot's working parameters at a difficulty (Section 5.2, D-51). */
export function makeBotProfile(key: BotKey, difficulty: Difficulty): BotProfile {
  const prof = BOT_PROFILES[key];
  const diff = DIFFICULTY[difficulty];
  return {
    key,
    rho: prof.rho * BOT.RHO_SCALE,
    lambda: prof.lambda * diff.lambdaMult,
    honesty: Math.max(prof.honesty * diff.honestyMult, diff.honestyFloor),
    sigma: prof.sigma,
  };
}

export function botParams(s: GameState, pid: PlayerId) {
  const p = playerOf(s, pid);
  return p.botProfile ?? { key: 'ugo' as const, rho: 1, lambda: 3, honesty: 1, sigma: 0 };
}

/** Record a finished round: wealth, metrics, scores, headline. */
export function finishRound(s: GameState, W: number[], effortShares: number[], headline?: Headline): void {
  const rec = {
    level: s.levelIndex,
    round: s.round,
    W: {} as Record<PlayerId, number>,
    M: {} as Record<PlayerId, number>,
    S: {} as Record<PlayerId, number>,
    effortShares: {} as Record<PlayerId, number>,
    headline,
  };
  s.players.forEach((p, i) => {
    rec.W[p.id] = W[i];
    rec.M[p.id] = valuesMetric(p.values, W, i, effortShares);
    rec.S[p.id] = roundScore(p.values, W, i, effortShares);
    rec.effortShares[p.id] = effortShares[i];
    s.scores[p.id].byLevel[s.levelIndex - 1] += rec.S[p.id];
  });
  s.history.push(rec);
}

export function roundsOf(s: GameState, level: LevelId = s.levelIndex) {
  return s.history.filter((r) => r.level === level);
}

export function initBeliefs(s: GameState): void {
  s.botBeliefs = {};
  for (const obs of s.players) {
    if (obs.isHuman) continue;
    s.botBeliefs[obs.id] = {};
    for (const other of s.players) {
      if (other.id === obs.id) continue;
      s.botBeliefs[obs.id][other.id] = { ...VALUES_PRIOR };
    }
  }
}

export function normalizeBelief(b: Record<ValuesCard, number>): Record<ValuesCard, number> {
  let z = 0;
  for (const c of VALUES_CARDS) {
    b[c] = Math.max(BOT.BELIEF_FLOOR, b[c]);
    z += b[c];
  }
  for (const c of VALUES_CARDS) b[c] /= z;
  return b;
}

export function reliabilityOf(s: GameState, pid: PlayerId): number {
  const r = s.reliability[pid] ?? { made: 0, kept: 0 };
  return (r.kept + 1) / (r.made + 2);
}

/** Messages sent in the current level whose claim is still unchecked, for a given decision step. */
export function openClaims(s: GameState, from: PlayerId, step: string): Message[] {
  return s.messages.filter(
    (m) => m.from === from && m.level === s.levelIndex && m.checkStep === step && !m.resolved,
  );
}

/**
 * Predicted distribution of another player's discrete choice, as seen by a bot (Section 5.4):
 * other bots are risk-neutral Egoists with prob 0.5 and follow the believed card otherwise;
 * the human follows the believed card. SUPPORT/OPPOSE messages shift the prediction by reliability.
 */
export function predictChoice(
  s: GameState,
  observer: PlayerId,
  actor: PlayerId,
  options: readonly string[],
  favForCard: (card: ValuesCard, riskNeutral: boolean) => string,
  step: string,
): number[] {
  const belief = s.botBeliefs[observer]?.[actor] ?? VALUES_PRIOR;
  const isHuman = playerOf(s, actor).isHuman;
  const dist = options.map(() => 0);
  const add = (opt: string, w: number) => {
    const k = options.indexOf(opt);
    if (k >= 0) dist[k] += w;
  };
  const egoW = isHuman ? 0 : BOT.OTHERS_EGOIST_WEIGHT;
  if (egoW > 0) add(favForCard('EGOIST', true), egoW);
  for (const c of VALUES_CARDS) add(favForCard(c, false), (1 - egoW) * belief[c]);
  const r = reliabilityOf(s, actor);
  for (const m of openClaims(s, actor, step)) {
    if (m.msg.type === 'SUPPORT') {
      const k = options.indexOf(m.msg.option);
      if (k >= 0) for (let j = 0; j < dist.length; j++) dist[j] = (1 - r) * dist[j] + (j === k ? r : 0);
    } else if (m.msg.type === 'OPPOSE') {
      const k = options.indexOf(m.msg.option);
      if (k >= 0) dist[k] *= 1 - r;
    }
  }
  const z = dist.reduce((a, b) => a + b, 0) || 1;
  return dist.map((d) => d / z);
}

/** Plurality winner distribution given each voter's distribution over options (exact enumeration). */
export function pluralityWinnerDist(dists: number[][], nOptions: number): number[] {
  const out = new Array(nOptions).fill(0);
  const counts = new Array(nOptions).fill(0);
  const rec = (k: number, p: number) => {
    if (p === 0) return;
    if (k === dists.length) {
      const max = Math.max(...counts);
      const tied: number[] = [];
      counts.forEach((c, i) => c === max && tied.push(i));
      for (const t of tied) out[t] += p / tied.length;
      return;
    }
    for (let o = 0; o < nOptions; o++) {
      if (dists[k][o] === 0) continue;
      counts[o]++;
      rec(k + 1, p * dists[k][o]);
      counts[o]--;
    }
  };
  rec(0, 1);
  return out;
}

/** Plurality count with uniform random tie-break. Returns winner index and whether a coin was flipped. */
export function pluralityResolve(votes: number[], nOptions: number, rng: Rng): { winner: number; tie: boolean; counts: number[] } {
  const counts = new Array(nOptions).fill(0);
  for (const v of votes) counts[v]++;
  const max = Math.max(...counts);
  const tied: number[] = [];
  counts.forEach((c, i) => c === max && tied.push(i));
  const winner = tied.length === 1 ? tied[0] : tied[rng.int(tied.length)];
  return { winner, tie: tied.length > 1, counts };
}

/** Lower median for even counts. */
export function lowerMedian(xs: readonly number[]): number {
  const a = xs.slice().sort((x, y) => x - y);
  return a[Math.floor((a.length - 1) / 2)];
}

export function headline(s: GameState, key: string, vars: Headline['vars'] = {}): Headline {
  return { key, variant: flavorIndex(s.seed, `${s.levelIndex}-${s.round}-${key}`, 997), vars };
}

export function isRevealPrivate(phase: Phase): boolean {
  return ['LEVEL_DEBRIEF', 'GUESS', 'RUN_DEBRIEF', 'END'].includes(phase.kind);
}

export type TalkMenu = { support: string[]; oppose: string[]; promise: string[] };

export function messageAllowed(menu: TalkMenu, msg: StructuredMessage, s: GameState, from: PlayerId): boolean {
  switch (msg.type) {
    case 'SUPPORT':
      return menu.support.includes(msg.option);
    case 'OPPOSE':
      return menu.oppose.includes(msg.option);
    case 'PROMISE':
      return menu.promise.includes(msg.action);
    case 'CLAIM_VALUES':
      return VALUES_CARDS.includes(msg.card);
    case 'ACCUSE':
      return msg.target !== from && idx(s, msg.target) >= 0 && VALUES_CARDS.includes(msg.card);
    case 'FLAVOR':
      return true;
  }
}

/** Uniform-ish deterministic permutations of k items chosen from deck (all ordered draws). */
export function orderedDraws(deck: readonly number[], k: number): number[][] {
  const out: number[][] = [];
  const used = new Array(deck.length).fill(false);
  const cur: number[] = [];
  const rec = () => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (let i = 0; i < deck.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(deck[i]);
      rec();
      cur.pop();
      used[i] = false;
    }
  };
  rec();
  return out;
}

/**
 * A private random stream for debrief-only calculations (the card's best choice, D-43). It is seeded
 * from the game code and never touches the game or bot streams, so it cannot change any later draw.
 */
export function debriefRng(s: GameState, key: string): Rng {
  return standalone(hashString(`${s.seed}|debrief|${key}`));
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
