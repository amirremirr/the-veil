// Bayesian updates over other players' Values cards (Section 5.6).
import { BOT } from '../params';
import { normalizeBelief, reliabilityOf } from '../core';
import type { GameState, Message, PlayerId, ValuesCard } from '../types';
import { VALUES_CARDS } from '../types';
import type { LevelDefinition } from '../levels/types';

export function updateFromDecisions(
  s: GameState,
  def: LevelDefinition,
  step: string,
  decisions: Record<PlayerId, unknown>,
): void {
  for (const obs of Object.keys(s.botBeliefs)) {
    for (const actor of Object.keys(decisions)) {
      if (actor === obs) continue;
      const b = s.botBeliefs[obs][actor];
      if (!b) continue;
      for (const c of VALUES_CARDS) {
        const lik = def.likelihood(s, obs, actor, step, decisions[actor], c);
        b[c] *= Math.max(1e-6, lik);
      }
      normalizeBelief(b);
    }
  }
}

function mixToward(b: Record<ValuesCard, number>, card: ValuesCard, w: number) {
  for (const c of VALUES_CARDS) b[c] = (1 - w) * b[c] + (c === card ? w : 0);
  normalizeBelief(b);
}

export function updateFromMessage(s: GameState, m: Message): void {
  const r = reliabilityOf(s, m.from);
  for (const obs of Object.keys(s.botBeliefs)) {
    if (obs === m.from) continue;
    if (m.msg.type === 'CLAIM_VALUES') {
      const b = s.botBeliefs[obs][m.from];
      if (b) mixToward(b, m.msg.card, BOT.CLAIM_BELIEF_WEIGHT * r);
    } else if (m.msg.type === 'ACCUSE') {
      if (m.msg.target === obs) continue;
      const b = s.botBeliefs[obs][m.msg.target];
      if (b) mixToward(b, m.msg.card, BOT.ACCUSE_BELIEF_WEIGHT * r);
    }
  }
}

export function argmaxCard(b: Record<ValuesCard, number>): ValuesCard {
  let best: ValuesCard = 'EGOIST';
  for (const c of VALUES_CARDS) if (b[c] > b[best]) best = c;
  return best;
}
