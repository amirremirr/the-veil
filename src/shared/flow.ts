// Screen flow, shared by the solo store and the multiplayer room server, so both behave the same.
// The engine's phase list is unchanged; this module decides which engine phases players actually
// see, and what one tap of the main button does. Every engine action is still a normal ADVANCE /
// SUBMIT_DECISION / SUBMIT_GUESSES, so action logs and replays are unchanged. See DECISIONS.md
// D-37 (screens) and D-64 (several humans at one table). No DOM code: the server imports this.
import { humanIds, reduce, waitingOn } from '../engine/engine';
import { autoDecision } from '../engine/auto';
import { LEVELS } from '../engine/levels';
import type { Action, GameState, Phase, PlayerId, StructuredMessage, ValuesCard } from '../engine/types';

/** Short results that become a banner on the next decision screen instead of their own screen. */
export const BANNER_REVEALS: Record<number, string[]> = { 2: ['TAX'], 3: ['REGIME'], 4: ['POLICY', 'ASSIGN'] };

export const isBannerReveal = (level: number, p: Phase | undefined): boolean =>
  !!p && p.kind === 'REVEAL' && (BANNER_REVEALS[level] ?? []).includes(p.step ?? '');

const nextPhase = (g: GameState): Phase | undefined => g.phaseQueue[g.phaseIdx + 1];
const prevPhase = (g: GameState): Phase | undefined => g.phaseQueue[g.phaseIdx - 1];

function apply(g: GameState, action: Action): GameState {
  return reduce(g, action);
}

/** Skip phases that never get their own screen. Only ever dispatches ADVANCE. */
export function settle(g: GameState): GameState {
  for (let i = 0; i < 50; i++) {
    const p = g.phase;
    let skip = false;
    if (p.kind === 'BRIEFING') skip = true;
    else if (isBannerReveal(g.levelIndex, p)) skip = true;
    // A round summary is shown together with the reveal before it. Reached any other way
    // (Level 2 after the luck survey), it has already been seen on the results screen.
    else if (p.kind === 'ROUND_SUMMARY' && prevPhase(g)?.kind !== 'REVEAL') skip = true;
    // Level 5: the adopted constitution is shown at the top of the income reveal (incomes are only
    // visible once that phase starts, so the constitution screen is the one that is skipped).
    else if (p.kind === 'REVEAL' && p.step === 'CONSTITUTION' && g.levelIndex === 5) skip = true;
    if (!skip) return g;
    const n = apply(g, { type: 'ADVANCE' });
    if (n === g) return g;
    g = n;
  }
  return g;
}

/** The decision a screen is asking for: the current DECIDE, or the one right after an open TALK. */
export function screenDecisionPhase(g: { phase: Phase; phaseIdx: number }, queue: Phase[]): Phase | undefined {
  if (g.phase.kind === 'DECIDE') return g.phase;
  if (g.phase.kind === 'TALK') return queue[g.phaseIdx + 1];
  if (g.phase.kind === 'REVEAL' && queue[g.phaseIdx + 1]?.step === 'POLL') return queue[g.phaseIdx + 1];
  return undefined;
}

/**
 * Leave a pre-decision screen: ADVANCE (closing the talk, or leaving the results screen that holds
 * the Level 2 luck survey; bots decide on entering DECIDE), then submit each held decision in seat
 * order. `held` maps a seat to its decision, or to `auto` for the timeout rule. Auto decisions are
 * all computed before any decision is submitted, so they never depend on another seat's choice.
 */
export function applyHeld(g: GameState, held: Record<PlayerId, Held>, autoIfRefused = true): GameState {
  g = apply(g, { type: 'ADVANCE' });
  if (g.phase.kind !== 'DECIDE') return settle(g);
  const order = g.players.map((p) => p.id).filter((id) => id in held && waitingOn(g).includes(id));
  const decisions = order.map((id) => {
    const h = held[id];
    return 'auto' in h ? { decision: autoDecision(g, id), auto: true as const } : { decision: h.decision };
  });
  order.forEach((id, k) => {
    if (g.phase.kind !== 'DECIDE' || !waitingOn(g).includes(id)) return;
    const a: Action = { type: 'SUBMIT_DECISION', from: id, decision: decisions[k].decision, ...(decisions[k].auto ? { auto: true } : {}) };
    const n = apply(g, a);
    // A held decision was checked when it was locked in; if it is somehow refused now, the timeout rule decides.
    // Solo play keeps its old behavior: a refused decision leaves the decision screen open.
    if (n !== g || !autoIfRefused) g = n;
    else g = apply(g, { type: 'SUBMIT_DECISION', from: id, decision: autoDecision(g, id), auto: true });
  });
  return settle(g);
}

/** What one tap of the main button does on the current screen, for the human in seat `from` (solo play). */
export function act(g: GameState, from: PlayerId, decision?: unknown, guesses?: Record<string, ValuesCard>): GameState {
  const p = g.phase;
  const next = nextPhase(g);
  if (p.kind === 'GUESS') return settle(apply(g, { type: 'SUBMIT_GUESSES', from, guesses: guesses ?? {} }));
  // The decision form was shown while the floor was still open, so messages could be sent.
  // Close the floor now (bots decide on entry), then submit. Same for the Level 2 luck survey,
  // which sits on the results screen.
  if (p.kind === 'TALK' || (p.kind === 'REVEAL' && next?.kind === 'DECIDE' && next.step === 'POLL')) {
    return applyHeld(g, { [from]: { decision } }, false);
  }
  if (p.kind === 'DECIDE') return settle(apply(g, { type: 'SUBMIT_DECISION', from, decision }));
  return advanceInfo(g);
}

/** Leave an information screen (intro, values card, results, debriefs). */
export function advanceInfo(g: GameState): GameState {
  const p = g.phase;
  if (p.kind === 'END') return g;
  // Reveal and round summary are one screen with one Continue.
  if (p.kind === 'REVEAL' && nextPhase(g)?.kind === 'ROUND_SUMMARY') return settle(apply(apply(g, { type: 'ADVANCE' }), { type: 'ADVANCE' }));
  return settle(apply(g, { type: 'ADVANCE' }));
}

// ---------------------------------------------------------------------------------------------
// Several humans at one table (multiplayer). The room server keeps a Table; solo play needs none.
// ---------------------------------------------------------------------------------------------

export type ScreenKind = 'predecision' | 'decision' | 'guess' | 'info' | 'end';

/** A held decision: what the seat chose, or the timeout rule. */
export type Held = { decision: unknown } | { auto: true };

export interface Table {
  game: GameState;
  /** Decisions locked in on a pre-decision screen. Never sent to clients (only who has locked in). */
  held: Record<PlayerId, Held>;
  /** Humans who pressed Ready on an information screen. */
  ready: PlayerId[];
}

export type TableAction =
  | { type: 'SEND_MESSAGE'; from: PlayerId; msg: StructuredMessage }
  | { type: 'DECIDE'; from: PlayerId; decision: unknown }
  | { type: 'GUESSES'; from: PlayerId; guesses: Record<PlayerId, ValuesCard> }
  | { type: 'READY'; from: PlayerId }
  /** Apply the timeout rule to one seat now (a disconnected seat that has missed two decisions). */
  | { type: 'AUTO'; from: PlayerId }
  /** The screen's timer ran out. */
  | { type: 'TIMEOUT' };

export const TIMERS = {
  DECISION_MS: 60_000,
  INFO_MS: 30_000,
  DEBRIEF_MS: 90_000,
};

export function newTable(game: GameState): Table {
  return { game: settle(game), held: {}, ready: [] };
}

export function screenKind(g: GameState): ScreenKind {
  const p = g.phase;
  if (p.kind === 'END') return 'end';
  if (p.kind === 'GUESS') return 'guess';
  if (p.kind === 'DECIDE') return 'decision';
  const next = nextPhase(g);
  if (p.kind === 'TALK' && next?.kind === 'DECIDE') return 'predecision';
  if (p.kind === 'REVEAL' && next?.kind === 'DECIDE' && next.step === 'POLL') return 'predecision';
  return 'info';
}

/** Identifies the current screen; held decisions and Ready marks are cleared when it changes. */
export function screenKey(g: GameState): string {
  return `${g.levelsPlayed.length}:${g.levelIndex}:${g.phaseIdx}:${g.phase.kind}:${g.phase.step ?? ''}`;
}

/** How long the current screen waits before the timeout rule (null: no timer). */
export function screenTimeoutMs(g: GameState): number | null {
  const k = screenKind(g);
  if (k === 'end') return null;
  if (k === 'info') return g.phase.kind === 'LEVEL_DEBRIEF' || g.phase.kind === 'RUN_DEBRIEF' ? TIMERS.DEBRIEF_MS : TIMERS.INFO_MS;
  return TIMERS.DECISION_MS;
}

/** Humans who must decide on a pre-decision screen. */
function preDeciders(g: GameState): PlayerId[] {
  const next = nextPhase(g)!;
  const deciders = LEVELS[g.levelIndex].deciders(g, next.step!);
  return humanIds(g).filter((id) => deciders.includes(id));
}

/** Humans the current screen is still waiting for (decisions or guesses). */
export function pendingHumans(t: Table): PlayerId[] {
  const g = t.game;
  const k = screenKind(g);
  if (k === 'predecision') return preDeciders(g).filter((id) => !(id in t.held));
  if (k === 'decision' || k === 'guess') {
    const humans = humanIds(g);
    return waitingOn(g).filter((id) => humans.includes(id));
  }
  return [];
}

/** Humans who have locked in on this screen. Others see that, never what they chose. */
export function lockedIn(t: Table): PlayerId[] {
  const g = t.game;
  const k = screenKind(g);
  if (k === 'predecision') return humanIds(g).filter((id) => id in t.held);
  if (k === 'decision' || k === 'guess') {
    const deciders = k === 'guess' ? humanIds(g) : LEVELS[g.levelIndex].deciders(g, g.phase.step!);
    return humanIds(g).filter((id) => deciders.includes(id) && id in g.pending);
  }
  return [];
}

function withGame(t: Table, game: GameState): Table {
  if (screenKey(game) !== screenKey(t.game)) return { game, held: {}, ready: [] };
  return { ...t, game };
}

/** Submit every pending human's timeout decision at once (computed first, submitted in seat order). */
function autoAll(g: GameState): GameState {
  const humans = humanIds(g);
  const missing = waitingOn(g).filter((id) => humans.includes(id));
  if (g.phase.kind === 'GUESS') {
    for (const id of missing) g = apply(g, { type: 'SUBMIT_GUESSES', from: id, guesses: {}, auto: true });
    return settle(g);
  }
  const decisions = missing.map((id) => autoDecision(g, id));
  missing.forEach((id, k) => {
    if (g.phase.kind === 'DECIDE' && waitingOn(g).includes(id)) g = apply(g, { type: 'SUBMIT_DECISION', from: id, decision: decisions[k], auto: true });
  });
  return settle(g);
}

/**
 * One table action. `connected` lists the humans currently connected (only they are waited for on
 * information screens). Returns null if the action is not valid now.
 */
export function tableStep(t: Table, a: TableAction, connected: readonly PlayerId[]): Table | null {
  const g = t.game;
  const k = screenKind(g);
  const humans = humanIds(g);
  if (a.type !== 'TIMEOUT' && !humans.includes(a.from)) return null;
  switch (a.type) {
    case 'SEND_MESSAGE': {
      const n = apply(g, { type: 'SEND_MESSAGE', from: a.from, msg: a.msg });
      return n === g ? null : withGame(t, n);
    }
    case 'DECIDE': {
      if (k === 'predecision') {
        if (!preDeciders(g).includes(a.from) || a.from in t.held) return null;
        const next = nextPhase(g)!;
        if (LEVELS[g.levelIndex].validate(g, next.step!, a.from, a.decision) === null) return null;
        return resolvePre({ ...t, held: { ...t.held, [a.from]: { decision: a.decision } } });
      }
      if (k === 'decision') {
        const n = apply(g, { type: 'SUBMIT_DECISION', from: a.from, decision: a.decision });
        return n === g ? null : withGame(t, settle(n));
      }
      return null;
    }
    case 'GUESSES': {
      if (k !== 'guess') return null;
      const n = apply(g, { type: 'SUBMIT_GUESSES', from: a.from, guesses: a.guesses });
      return n === g ? null : withGame(t, settle(n));
    }
    case 'READY': {
      if (k !== 'info' || t.ready.includes(a.from)) return null;
      const ready = [...t.ready, a.from];
      const waiting = humans.filter((id) => connected.includes(id) && !ready.includes(id));
      if (waiting.length) return { ...t, ready };
      return withGame(t, advanceInfo(g));
    }
    case 'AUTO': {
      if (k === 'predecision') {
        if (!preDeciders(g).includes(a.from) || a.from in t.held) return null;
        return resolvePre({ ...t, held: { ...t.held, [a.from]: { auto: true } } });
      }
      if (k === 'decision' && waitingOn(g).includes(a.from)) {
        return withGame(t, settle(apply(g, { type: 'SUBMIT_DECISION', from: a.from, decision: autoDecision(g, a.from), auto: true })));
      }
      if (k === 'guess' && waitingOn(g).includes(a.from)) {
        return withGame(t, settle(apply(g, { type: 'SUBMIT_GUESSES', from: a.from, guesses: {}, auto: true })));
      }
      return null;
    }
    case 'TIMEOUT': {
      if (k === 'end') return null;
      if (k === 'info') return withGame(t, advanceInfo(g));
      if (k === 'predecision') {
        const held = { ...t.held };
        for (const id of preDeciders(g)) if (!(id in held)) held[id] = { auto: true };
        return withGame(t, applyHeld(g, held));
      }
      return withGame(t, autoAll(g));
    }
  }
}

/** When every human who must decide has locked in, close the screen. */
function resolvePre(t: Table): Table {
  if (preDeciders(t.game).some((id) => !(id in t.held))) return t;
  return withGame(t, applyHeld(t.game, t.held));
}
