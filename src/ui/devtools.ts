// Dev and e2e helpers. Loaded only when import.meta.env.DEV is true.
import { HUMAN_ID } from '../engine/engine';
import type { GameState } from '../engine/types';
import { useStore } from './store';

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
  LOBBY: { donateTo: null, amount: 0, proposal: { t: 0.1, F: 25 } },
};

/** Play scripted human moves until `stopAt` returns true. Returns where it stopped. */
export function autoplay(stopAt: (g: GameState) => boolean): string {
  const st = useStore;
  for (let i = 0; i < 3000; i++) {
    const g = st.getState().game;
    if (!g) return 'no game';
    if (stopAt(g)) return `${g.phase.kind}:${g.phase.step ?? ''}:L${g.levelIndex}:R${g.round}`;
    const k = g.phase.kind;
    if (k === 'END') return 'END';
    if (k === 'GUESS') {
      const guesses = Object.fromEntries(g.players.filter((p) => !p.isHuman).map((p) => [p.id, 'EGOIST' as const]));
      st.getState().dispatch({ type: 'SUBMIT_GUESSES', guesses });
    } else if (k === 'DECIDE') {
      const step = g.phase.step!;
      st.getState().dispatch({ type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: step.startsWith('AMEND_') ? true : SCRIPT[step] });
    } else st.getState().dispatch({ type: 'ADVANCE' });
  }
  return 'limit';
}

export function installDevtools(): void {
  Object.assign(window, { __veil: useStore, __autoplay: autoplay });
}
