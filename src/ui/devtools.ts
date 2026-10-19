// Dev and e2e helpers. Loaded only when import.meta.env.DEV is true.
import type { GameState } from '../engine/types';
import { useStore } from './store';
import { screenDecisionPhase } from '../shared/flow';

const SCRIPT: Record<string, unknown> = {
  VOTE: 'P2',
  TAX: 0.4,
  EFFORT: 5,
  POLL: 40,
  BONUS: 60,
  CHOICE: { buy: true, gym: false },
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
      const guesses = Object.fromEntries(g.players.filter((p) => !p.isHuman).map((p) => [p.id, 'EGOIST' as const]));
      st.getState().act(undefined, guesses);
      continue;
    }
    const step = screenDecisionPhase(g, g.phaseQueue)?.step;
    const decision = step ? (step.startsWith('AMEND_') ? true : SCRIPT[step]) : undefined;
    st.getState().act(decision);
  }
  return 'limit';
}

export function installDevtools(): void {
  Object.assign(window, { __veil: useStore, __autoplay: autoplay });
}
