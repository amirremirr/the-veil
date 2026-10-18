// Screen flow (UI layer). The engine's phase list is unchanged; this module decides which engine
// phases the player actually sees, and what one tap of the main button does. Every engine action is
// still a normal ADVANCE / SUBMIT_DECISION / SUBMIT_GUESSES, so action logs and replays are unchanged.
// See DECISIONS.md D-37.
import { HUMAN_ID, reduce, waitingOn } from '../engine/engine';
import type { Action, GameState, Phase, ValuesCard } from '../engine/types';

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

/** What one tap of the main button does on the current screen. */
export function act(g: GameState, decision?: unknown, guesses?: Record<string, ValuesCard>): GameState {
  const p = g.phase;
  const next = nextPhase(g);
  if (p.kind === 'GUESS') return settle(apply(g, { type: 'SUBMIT_GUESSES', guesses: guesses ?? {} }));
  if (p.kind === 'TALK') {
    // The decision form was shown while the floor was still open, so messages could be sent.
    // Close the floor now (bots decide on entry), then submit.
    g = apply(g, { type: 'ADVANCE' });
    if (g.phase.kind === 'DECIDE' && waitingOn(g).includes(HUMAN_ID)) g = apply(g, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision });
    return settle(g);
  }
  if (p.kind === 'DECIDE') return settle(apply(g, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision }));
  if (p.kind === 'REVEAL' && next?.kind === 'ROUND_SUMMARY') {
    return settle(apply(apply(g, { type: 'ADVANCE' }), { type: 'ADVANCE' }));
  }
  if (p.kind === 'REVEAL' && next?.kind === 'DECIDE' && next.step === 'POLL') {
    // Level 2: the luck survey sits on the results screen.
    g = apply(g, { type: 'ADVANCE' });
    if (g.phase.kind === 'DECIDE' && waitingOn(g).includes(HUMAN_ID)) g = apply(g, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision });
    return settle(g);
  }
  return settle(apply(g, { type: 'ADVANCE' }));
}

/** The decision a screen is asking for: the current DECIDE, or the one right after an open TALK. */
export function screenDecisionPhase(g: { phase: Phase; phaseIdx: number }, queue: Phase[]): Phase | undefined {
  if (g.phase.kind === 'DECIDE') return g.phase;
  if (g.phase.kind === 'TALK') return queue[g.phaseIdx + 1];
  if (g.phase.kind === 'REVEAL' && queue[g.phaseIdx + 1]?.step === 'POLL') return queue[g.phaseIdx + 1];
  return undefined;
}
