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

/** Play episodes whose steps differ from Study's: scripted human moves, from the game state. */
const PLAY_SCRIPT: Partial<Record<number, Record<string, (g: GameState) => unknown>>> = {
  1: {
    PEEK: () => true,
    CLAIM: () => 'P2',
    VOTE: () => ({ vote: 'P2', gift: null }),
  },
  2: {
    TAX: () => 0.4,
    EFFORT: () => ({ effort: 5, claim: 'LOT', gift: null }),
    PRIZE: (g) => g.players.find((p) => !p.isHuman)!.id,
  },
  5: {
    FAIR_2: () => ({ fair: 0.2, proposal: { t: 0.1, F: 25 } }),
    CLAIM: () => ({}),
    LOBBY: () => ({ donateTo: null, amount: 0 }),
  },
  4: {
    COMEBACK: () => 'COINS',
    TRAIN: () => ({ train: true, gift: null }),
    CLAIM: () => 'TRAINED',
    HIRE: (g) => ({ hires: Object.fromEntries(g.players.filter((p) => p.id !== (g.levelState as { judge: string }).judge).map((p) => [p.id, 'COMPLEX'])), gift: null }),
    POLICY: () => 'B',
  },
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
    const decision = g.play && step && PLAY_SCRIPT[g.levelIndex]?.[step] ? PLAY_SCRIPT[g.levelIndex]![step](g) : step ? (step.startsWith('AMEND_') ? true : SCRIPT[step]) : undefined;
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
  if (g.levelIndex === 5 && g.play) {
    if (step === 'CLAIM') return persona === 'SKIMMER' ? {} : Object.fromEntries(((g.levelState as { order: string[] }).order ?? []).map((p) => [p, 'YES']));
    if (step === 'FAIR_2') return { fair: 0.2, proposal: persona === 'SKIMMER' ? null : { t: 0.3, F: 40 } };
    if (step === 'LOBBY') return { donateTo: null, amount: 0 };
  }
  if (g.levelIndex === 2 && g.play) {
    if (step === 'TAX') return persona === 'CAREFUL' ? 0.2 : 0;
    if (step === 'EFFORT') return { effort: persona === 'SKIMMER' ? 5 : persona === 'BLUFFER' ? 2 : 6, claim: persona === 'SKIMMER' ? 'SILENT' : persona === 'BLUFFER' ? 'LOT' : 'SOME', gift: null };
    if (step === 'PRIZE') return suspect(g.players.map((p) => p.id)) ?? others[0].id;
  }
  if (g.levelIndex === 1 && g.play) {
    if (step === 'PEEK') return persona !== 'SKIMMER';
    const y = priv.income as number | undefined;
    const vote = persona === 'SKIMMER' ? 'P1' : y === undefined ? 'P2' : y >= 110 ? 'P1' : 'P4';
    if (step === 'CLAIM') return persona === 'SKIMMER' ? 'SILENT' : persona === 'BLUFFER' ? 'P2' : vote === 'P4' ? 'SILENT' : vote;
    if (step === 'VOTE') return { vote: persona === 'BLUFFER' ? 'P1' : vote, gift: null };
  }
  if (g.levelIndex === 4 && g.play) {
    const l = g.levelState as { judge: string; current?: { meter?: Record<string, number>; train?: Record<string, boolean> } };
    const workers = g.players.filter((p) => p.id !== l.judge).map((p) => p.id);
    if (step === 'COMEBACK') return persona === 'CAREFUL' ? 'POINTS' : 'COINS';
    if (step === 'TRAIN') return { train: persona === 'CAREFUL' ? (me.publicInfo as { group?: string }).group === 'CIRCLE' : persona === 'SKIMMER', gift: null };
    if (step === 'CLAIM') return persona === 'BLUFFER' ? 'TRAINED' : persona === 'SKIMMER' ? 'SILENT' : l.current?.train?.[me.id] ? 'TRAINED' : 'SILENT';
    if (step === 'HIRE')
      return { hires: Object.fromEntries(workers.map((w) => [w, persona === 'SKIMMER' ? 'COMPLEX' : (l.current?.meter?.[w] ?? 0) >= 0.6 ? 'COMPLEX' : 'SIMPLE'])), gift: null };
    if (step === 'POLICY') return persona === 'CAREFUL' ? 'B' : 'A';
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
