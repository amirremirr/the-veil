import { reduce, HUMAN_ID } from '../../src/engine/engine';
import type { Action, GameState, SetupConfig } from '../../src/engine/types';

/** A simple scripted human used by tests. */
export function humanAction(s: GameState): Action {
  const k = s.phase.kind;
  const stepId = s.phase.step ?? '';
  if (k === 'GUESS') {
    const guesses = Object.fromEntries(s.players.filter((p) => !p.isHuman).map((p) => [p.id, 'EGOIST' as const]));
    return { type: 'SUBMIT_GUESSES', guesses };
  }
  if (k === 'DECIDE') {
    const map: Record<string, unknown> = {
      VOTE: 'P2',
      TAX: 0.4,
      EFFORT: 5,
      POLL: 50,
      BONUS: 50,
      CHOICE: { buy: true, gym: false },
      REGIME: 'M50',
      INVEST: true,
      SCHEDULE: 'FLEX',
      POLICY: 'D',
      VEIL: { t: 0.3, F: 40 },
      LOBBY: { donateTo: null, amount: 0, proposal: { t: 0.2, F: 25 } },
    };
    const decision = stepId.startsWith('AMEND_') ? true : map[stepId];
    return { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision };
  }
  return { type: 'ADVANCE' };
}

export function playFull(config: Partial<SetupConfig> = {}, maxSteps = 5000): GameState[] {
  const cfg: SetupConfig = { mode: 'FULL_RUN', nPlayers: 4, difficulty: 'NORMAL', seed: 'test-seed', botSamples: 30, ...config };
  let s = reduce(null as unknown as GameState, { type: 'START_RUN', config: cfg });
  const states = [s];
  for (let i = 0; i < maxSteps && s.phase.kind !== 'END'; i++) {
    if (s.phase.kind === 'TALK' && (s.talkSent[HUMAN_ID] ?? 0) === 0) {
      s = reduce(s, { type: 'SEND_MESSAGE', from: HUMAN_ID, msg: { type: 'CLAIM_VALUES', card: 'RAWLSIAN' } });
      states.push(s);
    }
    const next = reduce(s, humanAction(s));
    if (next === s) throw new Error(`stuck at ${s.phase.kind}:${s.phase.step}`);
    s = next;
    states.push(s);
  }
  return states;
}
