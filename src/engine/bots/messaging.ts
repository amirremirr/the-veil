// Bot TALK behavior (Section 6.4).
import { BOT, TALK } from '../params';
import { botParams, botRng, ids } from '../core';
import type { GameState, Phase, PlayerId, StructuredMessage, ValuesCard } from '../types';
import type { LevelDefinition } from '../levels/types';

function falseCard(card: ValuesCard): ValuesCard {
  return card === 'RAWLSIAN' ? 'UTILITARIAN' : 'RAWLSIAN';
}

function sameMsg(a: StructuredMessage, b: StructuredMessage): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function botMessages(s: GameState, def: LevelDefinition, phase: Phase, botId: PlayerId): StructuredMessage[] {
  const rng = botRng(s);
  const count = Math.min(TALK.MAX_MESSAGES, rng.weighted(BOT.MESSAGE_COUNT_WEIGHTS));
  if (count === 0) return [];
  const me = s.players.find((p) => p.id === botId)!;
  const { honesty } = botParams(s, botId);
  const menu = def.talkMenu(s, phase);
  const intent = def.botIntent(s, botId, phase);
  const others = ids(s).filter((id) => id !== botId);
  const out: StructuredMessage[] = [];
  for (let k = 0; k < count; k++) {
    let msg: StructuredMessage | null = null;
    const r = rng.next();
    if (r < BOT.MESSAGE_ACCUSE_PROB && others.length) {
      const beliefs = s.botBeliefs[botId];
      const target = others.slice().sort((a, b) => (beliefs[b]?.EGOIST ?? 0) - (beliefs[a]?.EGOIST ?? 0))[0];
      msg = { type: 'ACCUSE', target, card: 'EGOIST' };
    } else if (r < BOT.MESSAGE_ACCUSE_PROB + BOT.MESSAGE_FLAVOR_PROB) {
      msg = { type: 'FLAVOR' };
    } else {
      const honest = rng.next() < honesty;
      const canSupport = !!intent.support && menu.support.length > 0;
      const canPromise = menu.promise.length > 0 && !!(honest ? intent.promise?.length : intent.falsePromise?.length);
      if ((canSupport || canPromise) && rng.next() < BOT.MESSAGE_SUPPORT_SHARE) {
        if (canPromise && (!canSupport || rng.next() < 0.5)) {
          const pool = (honest ? intent.promise : intent.falsePromise)!;
          msg = { type: 'PROMISE', action: rng.pick(pool) };
        } else {
          const option = honest ? intent.support! : intent.decoy ?? intent.support!;
          msg = { type: 'SUPPORT', option };
        }
      } else {
        msg = { type: 'CLAIM_VALUES', card: honest ? me.values : falseCard(me.values) };
      }
    }
    if (out.some((m) => sameMsg(m, msg!))) msg = { type: 'FLAVOR' };
    out.push(msg);
  }
  return out;
}
