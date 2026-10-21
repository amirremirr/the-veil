// Play-mode rules (PLAY_MODE_SPEC.md Sections 4 and 6): the bank, debt stress, missions and scoring,
// event cards and the end-of-episode card guess. Study games never reach this code (s.play is absent).
import { valuesMetric, equalShares } from '../scoring';
import { argmaxCard } from '../bots/beliefs';
import type { Rng } from '../rng';
import type { GameState, LevelId, PlayerId, ValuesCard } from '../types';
import { PLAY } from './params';
import type { PlayEvent, PlayState } from './types';

export const isPlay = (s: Pick<GameState, 'play'>): boolean => !!s.play;

/** Event decks built so far (Episode 3; v2 Section 5 trims them). The other episodes' decks arrive with their episodes. */
export const eventDeck = (level: LevelId): readonly string[] => (level === 3 ? PLAY.L3_DECK : []);

/** Episodes playable in this build (P1: Episode 3 only). */
export const PLAYABLE_EPISODES: LevelId[] = [3];

export function initPlay(s: GameState): PlayState {
  const start = s.mode === 'EPISODE' ? PLAY.EPISODE_STARTING_BANK : PLAY.STARTING_BANK;
  const per = <X>(x: X) => Object.fromEntries(s.players.map((p) => [p.id, x])) as Record<PlayerId, X>;
  return { banks: per(start), debtStress: per(0), guessPoints: per(0), event: null, events: [], bankHistory: [], episodeStart: {}, guesses: {}, honesty: {}, belief: {}, joint: {}, claimLog: [] };
}

/** Section 4.2: points lost at the end of a round with this bank. */
export function debtStressFor(bank: number): number {
  return bank >= 0 ? 0 : Math.min(PLAY.DEBT_PENALTY_CAP, PLAY.DEBT_POINTS_PER_COIN * -bank);
}

/**
 * Effort shares for the Meritocrat mission (Section 4.3: Episode 2 effort plus Episode 4 training, as in
 * Study). Neither episode exists yet in P1, so every share is equal (as in Study Level 3).
 */
export function playEffortShares(s: GameState): number[] {
  return equalShares(s.players.length);
}

/** The mission's value on a set of banks (seat order). Same metrics as the Study Values cards. */
export function missionValue(card: ValuesCard, banks: readonly number[], i: number, effortShares: readonly number[]): number {
  return valuesMetric(card, banks, i, effortShares);
}

/** Section 4.3 without the guess points: bank half, mission half, minus debt stress. */
export function scoreOnBanks(card: ValuesCard, banks: readonly number[], i: number, effortShares: readonly number[], stress: number): number {
  return PLAY.BANK_WEIGHT * banks[i] + PLAY.MISSION_WEIGHT * PLAY.MISSION_SCALE[card] * missionValue(card, banks, i, effortShares) - stress;
}

const bankList = (s: GameState): number[] => s.players.map((p) => s.play!.banks[p.id]);

/** A contestant's Play score now: final score if the life (or episode) ended here. */
export function playScore(s: GameState, pid: PlayerId): number {
  const pl = s.play!;
  const i = s.players.findIndex((p) => p.id === pid);
  return scoreOnBanks(s.players[i].values, bankList(s), i, playEffortShares(s), pl.debtStress[pid]) + pl.guessPoints[pid];
}

/**
 * What a bot (or the timeout rule) values when it decides in Play (D-95): the Play score it would have
 * if the game ended after this round, given this round's money W for everyone (seat order). The bank
 * moves by W minus living cost and this round's debt stress counts, so a player near debt is risk averse.
 */
export function playRoundValue(s: GameState, card: ValuesCard, W: readonly number[], i: number, effortShares: readonly number[], drift: number | null = null): number {
  const pl = s.play!;
  const banks = s.players.map((p, j) => pl.banks[p.id] + W[j] - PLAY.LIVING_COST);
  const id = s.players[i].id;
  return scoreOnBanks(card, banks, i, effortShares, pl.debtStress[id] + debtStressFor(banks[i])) - futureStress(s, banks[i], drift);
}

/** The episode's rounds still to come after the current one. */
export function roundsLeft(s: GameState): number {
  return Math.max(0, Math.max(...s.phaseQueue.map((p) => p.round)) - s.round);
}

/**
 * D-122: the debt stress a bank of `bank` after this round will still cost in the episode's later rounds,
 * if it moves by `drift` each round: the sum over k = 1..roundsLeft of debtStressFor(bank + k x drift).
 * Zero without a drift (DEBT_HORIZON off).
 */
export function futureStress(s: GameState, bank: number, drift: number | null): number {
  if (drift === null) return 0;
  let out = 0;
  for (let k = 1; k <= roundsLeft(s); k++) out += debtStressFor(bank + k * drift);
  return out;
}

/**
 * A selfish, risk-neutral contestant's value of `w` coins this round (the simple model bots use for
 * others, replacing Study's hardship-adjusted own money): money minus the debt stress it would cause.
 * `j < 0` uses the table's average bank.
 */
export function playNet(s: GameState, j: number, w: number, drift: number | null = null): number {
  const pl = s.play!;
  const bank = j >= 0 ? pl.banks[s.players[j].id] : bankList(s).reduce((a, b) => a + b, 0) / s.players.length;
  const after = bank + w - PLAY.LIVING_COST;
  return w - debtStressFor(after) - futureStress(s, after, drift);
}

/** Ranks by Play score (1 = leading; ties share the better rank). */
export function playRanks(s: GameState): Record<PlayerId, number> {
  const sc = s.players.map((p) => playScore(s, p.id));
  return Object.fromEntries(s.players.map((p, i) => [p.id, 1 + sc.filter((x) => x > sc[i] + 1e-9).length]));
}

/** Section 4.1 and 4.2: after a round, move every bank and take debt stress. */
export function playFinishRound(s: GameState, W: readonly number[]): void {
  const pl = s.play!;
  const rec = { level: s.levelIndex, round: s.round, W: {} as Record<PlayerId, number>, banks: {} as Record<PlayerId, number>, stress: {} as Record<PlayerId, number>, ranks: {} as Record<PlayerId, number> };
  s.players.forEach((p, i) => {
    pl.banks[p.id] += W[i] - PLAY.LIVING_COST;
    const st = debtStressFor(pl.banks[p.id]);
    pl.debtStress[p.id] += st;
    rec.W[p.id] = W[i];
    rec.banks[p.id] = pl.banks[p.id];
    rec.stress[p.id] = st;
  });
  rec.ranks = playRanks(s);
  pl.bankHistory.push(rec);
}

/** At an episode start: remember the banks and clear the event. */
export function playStartEpisode(s: GameState, level: LevelId): void {
  const pl = s.play!;
  pl.episodeStart[level] = { ...pl.banks };
  pl.event = null;
}

/**
 * Section 6.1: before a round, draw from the game stream. Always exactly two draws (chance, card), so the
 * stream does not depend on which card came up. A card that needs a condition the round does not meet
 * becomes a quiet week (Paperwork Week without a mandate).
 */
export function playDrawEvent(s: GameState, rng: Rng): void {
  const pl = s.play!;
  const deck = eventDeck(s.levelIndex);
  const u = rng.next();
  const v = rng.next();
  let id = deck.length && u < PLAY.EVENT_CHANCE ? deck[Math.floor(v * deck.length)] : 'QUIET';
  let fallback: string | undefined;
  const l3 = s.levelState as { regime?: string; insurerActive?: boolean };
  // Paperwork Week needs a mandate; Leaked Medical Files needs a pool with a bar (v2 Section 5: only from round 2).
  const noBar = l3.regime !== 'VOL' || !l3.insurerActive || s.round < PLAY.LEAKED_FROM_ROUND;
  if (s.levelIndex === 3 && ((id === 'PAPERWORK' && l3.regime === 'VOL') || (id === 'LEAKED' && noBar))) {
    fallback = id;
    id = 'QUIET';
  }
  const ev: PlayEvent = { id, level: s.levelIndex, round: s.round, ...(fallback ? { fallback } : {}) };
  pl.event = ev;
  pl.events.push(ev);
}

/** The event in force for the current decision, or null (none, a quiet week, or outside the round itself). */
export function activeEvent(s: GameState): PlayEvent | null {
  const ev = s.play?.event;
  if (!ev || ev.id === 'QUIET' || ev.level !== s.levelIndex || ev.round !== s.round) return null;
  // The regime vote after round 2 decides about round 3, before its event is drawn (D-98).
  if (s.phase.step === 'REGIME') return null;
  if (!['BRIEFING', 'TALK', 'DECIDE', 'REVEAL', 'ROUND_SUMMARY'].includes(s.phase.kind)) return null;
  return ev;
}

/** Section 7.4: one guess per contestant per episode. A human submits {target: card} or nothing. */
export function playApplyGuess(s: GameState, from: PlayerId, guess: Record<PlayerId, ValuesCard>): boolean {
  const entries = Object.entries(guess);
  if (entries.length > 1) return false;
  const pl = s.play!;
  const level = s.levelIndex;
  pl.guesses[level] ??= {};
  if (entries.length === 1) {
    const [target, card] = entries[0];
    const correct = s.players.find((p) => p.id === target)!.values === card;
    pl.guesses[level]![from] = { target, card, correct };
    if (correct) pl.guessPoints[from] += PLAY.GUESS_POINTS;
  }
  return true;
}

/** Bots guess too (D-99): the contestant they are surest about, with their most likely card. */
export function playBotGuesses(s: GameState): void {
  for (const p of s.players) {
    if (p.isHuman) continue;
    const beliefs = s.botBeliefs[p.id] ?? {};
    let best: { target: PlayerId; conf: number } | null = null;
    for (const o of s.players) {
      if (o.id === p.id || !beliefs[o.id]) continue;
      const conf = Math.max(...Object.values(beliefs[o.id]));
      if (!best || conf > best.conf + 1e-12) best = { target: o.id, conf };
    }
    if (best) playApplyGuess(s, p.id, { [best.target]: argmaxCard(beliefs[best.target]) });
  }
}
