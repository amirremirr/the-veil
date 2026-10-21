// What a viewer may see of the Play state (Play spec 3.3: never leak private information through new UI).
// Banks, debt stress and events are public (it is TV). Ranks are shown, never exact scores, until every
// card is public. The mission bar is the viewer's own. The audience poll aggregates bot beliefs, which
// bots form from public actions and messages only.
import type { GameState, PlayerId } from '../types';
import { audienceBelief } from './claims';
import { PLAY } from './params';
import { missionValue, playEffortShares, playRanks, playScore } from './rules';
import type { PlayView } from './types';
import { playL3Params } from '../levels/level3';

/**
 * v2 Section 3.2: the audience poll, every contestant's average belief among the other bots that the
 * episode's hidden fact is true (Episode 3: high risk). Bots form it from public claims and actions only.
 * Shown from the first decision of an episode (null before, and in a table with no bots).
 */
export function audiencePoll(s: GameState): PlayView['poll'] {
  if (s.phase.kind === 'INTRO' || s.phase.kind === 'VALUES_REVEAL' || !Object.keys(s.play!.belief).length) return null;
  const out: Record<PlayerId, number> = {};
  for (const p of s.players) {
    const b = audienceBelief(s, p.id);
    if (b !== null) out[p.id] = b;
  }
  return out;
}

export function playView(s: GameState, viewer: PlayerId, revealAll: boolean): PlayView {
  const pl = s.play!;
  const i = s.players.findIndex((p) => p.id === viewer);
  const me = s.players[i];
  let mission: PlayView['mission'] = null;
  if (me) {
    const banks = s.players.map((p) => pl.banks[p.id]);
    const value = missionValue(me.values, banks, i, playEffortShares(s));
    const scale = PLAY.MISSION_SCALE[me.values];
    mission = {
      card: me.values,
      value,
      scale,
      bankPart: PLAY.BANK_WEIGHT * banks[i],
      missionPart: PLAY.MISSION_WEIGHT * scale * value,
      stress: pl.debtStress[viewer],
      guessPoints: pl.guessPoints[viewer],
      score: playScore(s, viewer),
      goal: missionGoal(s),
    };
  }
  const guesses: PlayView['guesses'] = {};
  for (const [lvl, byGuesser] of Object.entries(pl.guesses)) {
    const mine = Object.fromEntries(Object.entries(byGuesser ?? {}).filter(([g]) => revealAll || g === viewer));
    guesses[Number(lvl) as keyof typeof guesses] = mine;
  }
  return {
    banks: { ...pl.banks },
    debtStress: { ...pl.debtStress },
    bankHistory: structuredClone(pl.bankHistory),
    event: pl.event ? { ...pl.event } : null,
    events: structuredClone(pl.events),
    ranks: pl.bankHistory.some((h) => h.level === s.levelIndex) ? playRanks(s) : null,
    mission,
    poll: audiencePoll(s),
    record: structuredClone(s.reliability),
    guesses,
    finalScores: revealAll ? Object.fromEntries(s.players.map((p) => [p.id, playScore(s, p.id)])) : null,
    startingBank: s.mode === 'EPISODE' ? PLAY.EPISODE_STARTING_BANK : PLAY.STARTING_BANK,
    ...(s.levelIndex === 3 && s.phase.kind !== 'VALUES_REVEAL' ? { l3: l3Numbers(s) } : {}),
  };
}

/**
 * The mission bar's full mark (D-102): the starting bank plus MISSION_GOAL_SHARE of what the episode's
 * rounds could add (income minus living cost). It is compared with k x mission value, so every mission
 * has the same scale.
 */
export function missionGoal(s: GameState): number {
  const rounds = Math.max(1, ...s.phaseQueue.map((p) => p.round));
  const start = s.mode === 'EPISODE' ? PLAY.EPISODE_STARTING_BANK : PLAY.STARTING_BANK;
  const income = s.levelIndex === 3 ? playL3Params(s, false).BASE_INCOME : 0;
  return start + rounds * (income - PLAY.LIVING_COST) * PLAY.MISSION_GOAL_SHARE;
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
    livingCost: PLAY.LIVING_COST,
  };
}
