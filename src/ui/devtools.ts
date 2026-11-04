// Dev and e2e helpers. Loaded only when import.meta.env.DEV is true.
import type { GameState } from '../engine/types';
import { useStore } from './store';
import { screenDecisionPhase } from '../shared/flow';
import { devDelayMessages, devDropConnection, devSetRules } from './room';
import { membersOf } from '../engine/levels/level3';
import { audienceBelief } from '../engine/play/claims';

const SCRIPT: Record<string, unknown> = {
  VOTE: 'P2',
  TAX: 0.4,
  EFFORT: 5,
  POLL: 40,
  BONUS: 60,
  CHOICE: { buy: true, gym: false },
  CLAIM: 'LOW',
  REGIME: 'M50',
  INVEST: true,
  SCHEDULE: 'GREEDY',
  POLICY: 'D',
  VEIL: { t: 0.3, F: 40 },
  FAIR_1: 0.3,
  FAIR_2: 0.2,
  LOBBY: { donateTo: null, amount: 0, proposal: { t: 0.1, F: 25 } },
};

/** Play scripted human moves, one screen (one tap) at a time, until `stopAt` returns true. */
export function autoplay(stopAt: (g: GameState) => boolean): string {
  const st = useStore;
  for (let i = 0; i < 3000; i++) {
    const g = st.getState().game;
    if (!g) return 'no game';
    if (stopAt(g)) return `${g.phase.kind}:${g.phase.step ?? ''}:L${g.levelIndex}:R${g.round}`;
    if (g.phase.kind === 'END') return 'END';
    if (g.phase.kind === 'GUESS') {
      // Play guesses one contestant per episode (Play spec 7.4); Study guesses everyone.
      const others = g.players.filter((p) => !p.isHuman);
      const guesses = Object.fromEntries((g.play ? others.slice(0, 1) : others).map((p) => [p.id, 'EGOIST' as const]));
      st.getState().act(undefined, guesses);
      continue;
    }
    const step = screenDecisionPhase(g, g.phaseQueue)?.step;
    const decision = step ? (step.startsWith('AMEND_') ? true : SCRIPT[step]) : undefined;
    st.getState().act(decision);
  }
  return 'limit';
}

/**
 * AI playtest personas (RUNPLAN T1, T7; proxy, not human evidence). Each decides from its own cards and the
 * public table only: SKIMMER taps the first option, CAREFUL plays its cards honestly, BLUFFER lies every
 * round and votes to bar the contestant the audience suspects most.
 */
export function personaDecision(g: GameState, persona: string, step: string | undefined): unknown {
  if (!step) return undefined;
  const me = g.players.find((p) => p.isHuman)!;
  const priv = me.privateInfo as Record<string, unknown>;
  const others = g.players.filter((p) => p.id !== me.id);
  const suspect = (pool: string[]) =>
    pool
      .filter((id) => id !== me.id)
      .map((id) => ({ id, b: g.play ? (audienceBelief(g, id) ?? 0.5) : 0.5 }))
      .sort((a, b) => b.b - a.b)[0]?.id ?? null;
  if (g.levelIndex === 3 && g.play) {
    const high = priv.riskType === 'HIGH';
    const worrier = priv.worry === 'WORRIER';
    if (step === 'CLAIM') return persona === 'SKIMMER' ? 'SILENT' : persona === 'BLUFFER' ? (high ? 'LOW' : 'HIGH') : high ? 'HIGH' : 'LOW';
    if (step === 'CHOICE') {
      if (persona === 'SKIMMER') return { buy: true, gym: false };
      if (persona === 'CAREFUL') return { buy: high || worrier, gym: high, gift: null, bar: null };
      const members = membersOf(g);
      return { buy: true, gym: false, gift: null, bar: members.includes(me.id) ? suspect(members) : null };
    }
    if (step === 'REGIME') return persona === 'CAREFUL' ? 'M50' : 'VOL';
  }
  void others;
  return step.startsWith('AMEND_') ? persona !== 'BLUFFER' : SCRIPT[step];
}

/** One screen forward as a persona. */
export function personaStep(persona: string): void {
  const st = useStore;
  const g = st.getState().game!;
  if (g.phase.kind === 'GUESS') {
    const other = g.players.find((p) => !p.isHuman)!;
    st.getState().act(undefined, { [other.id]: persona === 'SKIMMER' ? 'EGOIST' : 'UTILITARIAN' });
    return;
  }
  const step = screenDecisionPhase(g, g.phaseQueue)?.step;
  st.getState().act(personaDecision(g, persona, step));
}

export function installDevtools(): void {
  Object.assign(window, { __veil: useStore, __autoplay: autoplay, __personaStep: personaStep, __roomDrop: devDropConnection, __roomDelay: devDelayMessages, __roomRules: devSetRules });
}
