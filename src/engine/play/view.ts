// What a viewer may see of the Play state (Play spec 3.3: never leak private information through new UI).
// Banks, debt stress and events are public (it is TV). Ranks are shown, never exact scores, until every
// card is public. The mission bar is the viewer's own. The audience poll aggregates bot beliefs, which
// bots form from public actions and messages only.
import type { GameState, PlayerId } from '../types';
import { audienceBelief } from './claims';
import { PLAY } from './params';
import { playRanks, playScore, livingCost, bankBase } from './rules';
import type { PlayView } from './types';
import { playL3Params } from '../levels/level3';

/**
 * v2 Section 3.2: the audience poll, every contestant's average belief among the other bots that the
 * episode's hidden fact is true (Episode 3: high risk). Bots form it from public claims and actions only.
 * Shown from the first decision of an episode (null before, and in a table with no bots).
 */
export function audiencePoll(s: GameState): PlayView['poll'] {
  if (s.phase.kind === 'INTRO' || s.phase.kind === 'VALUES_REVEAL' || !Object.keys(s.play!.belief).length) return null;
  // D-145: no audience poll on any screen on Hard.
  if (PLAY.DIFFICULTY[s.difficulty].poll === 'NEVER') return null;
  const out: Record<PlayerId, number> = {};
  for (const p of s.players) {
    const b = audienceBelief(s, p.id);
    if (b !== null) out[p.id] = b;
  }
  return out;
}

/**
 * D-180: the viewer's gap to the nearest score above and below, rounded to PLAY.GAP_ROUND, so a life's
 * ranking has a margin without showing anyone's exact score (which would point at their mission).
 */
function gapsOf(s: GameState, viewer: PlayerId): { above: number | null; below: number | null } {
  const me = playScore(s, viewer);
  const others = s.players.filter((p) => p.id !== viewer).map((p) => playScore(s, p.id));
  const up = others.filter((x) => x > me + 1e-9);
  const down = others.filter((x) => x <= me + 1e-9);
  const r = (x: number) => Math.round(x / PLAY.GAP_ROUND) * PLAY.GAP_ROUND;
  return { above: up.length ? r(Math.min(...up) - me) : null, below: down.length ? r(me - Math.max(...down)) : null };
}

export function playView(s: GameState, viewer: PlayerId, revealAll: boolean): PlayView {
  const pl = s.play!;
  const i = s.players.findIndex((p) => p.id === viewer);
  const me = s.players[i];
  // V5 N1: the viewer's own score (no missions), their choices so far and their first fair-tax answer.
  const score: PlayView['score'] = me ? { total: playScore(s, viewer), bank: pl.banks[viewer] - bankBase(s, viewer), bonus: pl.guessPoints[viewer] } : null;
  return {
    banks: { ...pl.banks },
    debtStress: { ...pl.debtStress },
    // G1: the ledger and score parts are private (training costs, mission points): only the viewer's own.
    bankHistory: pl.bankHistory.map((h) => {
      const { ledger, parts, partsStart, ...rest } = structuredClone(h);
      const mine = <X>(r: Record<PlayerId, X> | undefined) => (r && r[viewer] !== undefined ? { [viewer]: r[viewer] } : undefined);
      return { ...rest, ...(revealAll ? { ledger, parts, partsStart } : { ledger: mine(ledger), parts: mine(parts), partsStart: mine(partsStart) }) };
    }),
    event: pl.event ? { ...pl.event } : null,
    events: structuredClone(pl.events),
    ranks: pl.bankHistory.some((h) => h.level === s.levelIndex) ? playRanks(s) : null,
    gaps: pl.bankHistory.some((h) => h.level === s.levelIndex) && !revealAll ? gapsOf(s, viewer) : null,
    score,
    trail: structuredClone(pl.trail?.[viewer] ?? []),
    fairFirst: pl.fairFirst?.[viewer] ?? null,
    poll: audiencePoll(s),
    comeback: pl.comeback ?? null,
    calls: (pl.calls ?? []).map((c) => ({ ...c })),
    pollMode: PLAY.DIFFICULTY[s.difficulty].poll,
    record: structuredClone(s.reliability),
    finalScores: revealAll ? Object.fromEntries(s.players.map((p) => [p.id, playScore(s, p.id)])) : null,
    livingCost: livingCost(s),
    startingBank: s.mode === 'EPISODE' ? PLAY.EPISODE_STARTING_BANK : PLAY.LIFE_STARTING_BANK,
    ...(s.levelIndex === 3 && s.phase.kind !== 'VALUES_REVEAL' ? { l3: l3Numbers(s) } : {}),
  };
}

function l3Numbers(s: GameState): NonNullable<PlayView['l3']> {
  const p = playL3Params(s);
  return {
    loss: p.LOSS,
    gymCost: p.GYM_COST,
    gymFactor: p.GYM_FACTOR,
    pLow: p.P_LOW,
    pHigh: p.P_HIGH,
    riskMult: p.RISK_MULT,
    riskCap: p.RISK_CAP,
    premiumMult: p.PREMIUM_MULT,
    mandateExtra: p.MANDATE_EXTRA,
    loading: p.LOADING,
    priceLoss: p.PRICE_LOSS,
    pBar: p.P_BAR,
    baseIncome: p.BASE_INCOME,
    livingCost: livingCost(s),
  };
}
