// v2 Section 6.1, near misses: on the episode summary, the single change to your own decisions that would
// have left you with the most coins. Like the Level 4 counterfactual (src/engine/counterfactual.ts), it
// re-runs the level in a sandbox from the same seed with one thing changed: here, one of your decisions.
// Every other human decision is replayed as logged, bots decide again as they would, and the game stream
// stays aligned (every round takes the same draws whatever anyone chooses), so your wheels land the same.
// It reads only your own decisions; the line it produces names only your own choice (D-114).
import { autoDecision } from '../auto';
import { createInitialState, humanIds, step, waitingOn } from '../engine';
import type { L3State } from '../levels/level3';
import type { GameState, PlayerId } from '../types';
import { SILENT } from './claims';
import type { NearMiss } from './types';

type Plan = Record<string, unknown>;
const key = (round: number, stepId: string) => `${round}:${stepId}`;

/** Each human's decisions in this episode, by round and step, read from the episode's records. */
function plans(s: GameState): Record<PlayerId, Plan> {
  const l = s.levelState as L3State;
  const out: Record<PlayerId, Plan> = {};
  for (const h of humanIds(s)) {
    const p: Plan = {};
    for (const c of s.play!.claimLog) if (c.pid === h && c.level === s.levelIndex) p[key(c.round, 'CLAIM')] = c.said;
    l.rounds.forEach((r, k) => {
      p[key(k + 1, 'CHOICE')] = { buy: r.applied?.[h] ?? r.choices[h].buy, gym: r.choices[h].gym, bar: r.bar?.votes[h] ?? null };
    });
    const reg = s.phaseQueue.find((q) => q.step === 'REGIME');
    if (reg && l.regimeVotes?.[h]) p[key(reg.round, 'REGIME')] = l.regimeVotes[h];
    out[h] = p;
  }
  return out;
}

/** Run the episode again with every human's plan, one decision replaced; return the final banks. */
function run(s: GameState, all: Record<PlayerId, Plan>, change: { pid: PlayerId; k: string; value: unknown } | null): Record<PlayerId, number> {
  const g = createInitialState({ ...s.config, skipCounterfactual: true });
  for (let guard = 0; guard < 2000; guard++) {
    const k = g.phase.kind;
    if (k === 'GUESS' || k === 'LEVEL_DEBRIEF' || k === 'END') break;
    if (k === 'DECIDE') {
      const waiting = waitingOn(g);
      if (!waiting.length) break;
      for (const pid of waiting) {
        if (g.phase.kind !== 'DECIDE' || !waitingOn(g).includes(pid)) continue;
        const kk = key(g.phase.round, g.phase.step!);
        const planned = change && change.pid === pid && change.k === kk ? change.value : all[pid]?.[kk];
        const ok = planned !== undefined && step(g, { type: 'SUBMIT_DECISION', from: pid, decision: planned });
        if (!ok) step(g, { type: 'SUBMIT_DECISION', from: pid, decision: autoDecision(g, pid) });
      }
    } else if (!step(g, { type: 'ADVANCE' })) break;
  }
  return { ...g.play!.banks };
}

/** The final banks of the sandbox run with nobody's decision changed (tests: it must match the real game). */
export function baselineBanks(s: GameState): Record<PlayerId, number> {
  return run(s, plans(s), null);
}

/** Every human's near miss for the episode just played (null when no single change would have paid). */
export function nearMisses(s: GameState): Record<PlayerId, NearMiss | null> {
  const all = plans(s);
  const base = run(s, all, null);
  const l = s.levelState as L3State;
  const out: Record<PlayerId, NearMiss | null> = {};
  for (const h of humanIds(s)) {
    const p = all[h];
    const tries: Array<{ k: string; value: unknown; nm: Omit<NearMiss, 'gain'> }> = [];
    for (const [k, value] of Object.entries(p)) {
      const [rs, stepId] = k.split(':');
      const round = Number(rs);
      if (stepId === 'CLAIM')
        for (const v of ['LOW', 'HIGH', SILENT]) if (v !== value) tries.push({ k, value: v, nm: { kind: 'CLAIM', round, from: value, to: v } });
      if (stepId === 'REGIME')
        for (const v of ['VOL', 'M50', 'M100']) if (v !== value) tries.push({ k, value: v, nm: { kind: 'REGIME', round, from: value, to: v } });
      if (stepId === 'CHOICE') {
        const c = value as { buy: boolean; gym: boolean; bar: PlayerId | null };
        const r = l.rounds[round - 1];
        const canBuy = r.regime === 'VOL' && r.premium !== null;
        for (const buy of canBuy ? [false, true] : [false])
          for (const gym of [false, true])
            if (buy !== c.buy || gym !== c.gym) tries.push({ k, value: { ...c, buy, gym }, nm: { kind: 'CHOICE', round, from: { buy: c.buy, gym: c.gym }, to: { buy, gym } } });
        if (r.bar?.members.includes(h))
          for (const t of [null, ...s.players.map((x) => x.id).filter((x) => x !== h)])
            if (t !== c.bar) tries.push({ k, value: { ...c, bar: t }, nm: { kind: 'BAR', round, from: c.bar, to: t } });
      }
    }
    let best: NearMiss | null = null;
    for (const t of tries) {
      const gain = run(s, all, { pid: h, k: t.k, value: t.value })[h] - base[h];
      if (gain >= 1 && (!best || gain > best.gain + 1e-9)) best = { ...t.nm, gain: Math.round(gain) };
    }
    out[h] = best;
  }
  return out;
}
