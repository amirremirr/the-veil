// Several humans at one table (Milestone 1): every level plays to the end with 2, 3 and 4 humans,
// replays are exact (auto decisions included), nobody sees another player's secrets, and one human
// locking in does not close the talk for the others.
import { describe, expect, it } from 'vitest';
import { reduce, replay, visibleState } from '../../src/engine/engine';
import { LEVELS } from '../../src/engine/levels';
import { isRevealPrivate } from '../../src/engine/core';
import {
  lockedIn,
  newTable,
  pendingHumans,
  screenDecisionPhase,
  screenKey,
  screenKind,
  tableStep,
  type Table,
  type TableAction,
} from '../../src/shared/flow';
import type { GameState, LevelId, PlayerId, SetupConfig } from '../../src/engine/types';

const SEED = 'secret-seed-7781';

function start(nHumans: number, cfg: Partial<SetupConfig> = {}): Table {
  const humans = Array.from({ length: nHumans }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` }));
  const config: SetupConfig = { mode: 'FULL_RUN', nPlayers: 4, difficulty: 'NORMAL', seed: SEED, botSamples: 30, humans, ...cfg };
  return newTable(reduce(null as unknown as GameState, { type: 'START_RUN', config }));
}

/** A scripted decision that differs a little between seats. */
function script(g: GameState, step: string, pid: PlayerId, k: number): unknown {
  const other = g.players.find((p) => p.id !== pid)!.id;
  const map: Record<string, unknown> = {
    VOTE: ['P1', 'P2', 'P3', 'P4'][k % 4],
    TAX: [0, 0.2, 0.4, 0.6][k % 4],
    EFFORT: 3 + (k % 4),
    POLL: 20 + 10 * k,
    BONUS: 30 + 10 * k,
    CHOICE: { buy: k % 2 === 0, gym: k % 3 === 0 },
    REGIME: ['VOL', 'M50', 'M100'][k % 3],
    INVEST: k % 2 === 0,
    SCHEDULE: k % 2 ? 'FLEX' : 'GREEDY',
    POLICY: ['A', 'B', 'C', 'D'][k % 4],
    VEIL: { t: [0.1, 0.3, 0.5, 0.7][k % 4], F: 25 },
    FAIR_1: 0.3,
    FAIR_2: [0.1, 0.2, 0.3, 0.4][k % 4],
    LOBBY: { donateTo: k % 2 ? other : null, amount: k % 2 ? 5 : 0, proposal: k % 3 === 2 ? null : { t: 0.2, F: 25 } },
  };
  return step.startsWith('AMEND_') ? k % 2 === 0 : map[step];
}

interface DriveOpts {
  /** Seats that never act on decision screens (the timeout rule decides for them). */
  idle?: PlayerId[];
  /** Every n-th decision screen, the last human lets the timer run out. */
  lateEvery?: number;
  /** Called after every table change. */
  onState?: (t: Table) => void;
}

/** Play to the end with scripted humans. Returns the final table and how many auto decisions were logged. */
function drive(t: Table, opts: DriveOpts = {}): { t: Table; autos: number; steps: number } {
  const humans = t.game.players.filter((p) => p.isHuman).map((p) => p.id);
  let decisionScreens = 0;
  let steps = 0;
  const go = (a: TableAction) => {
    const n = tableStep(t, a, humans);
    if (!n) throw new Error(`refused ${JSON.stringify(a)} at ${t.game.phase.kind}:${t.game.phase.step}`);
    t = n;
    steps++;
    opts.onState?.(t);
  };
  for (let guard = 0; guard < 4000 && screenKind(t.game) !== 'end'; guard++) {
    const g = t.game;
    const key = screenKey(g);
    const k = screenKind(g);
    if (k === 'info') {
      for (const h of humans) if (screenKey(t.game) === key) go({ type: 'READY', from: h });
      continue;
    }
    decisionScreens++;
    const late = opts.lateEvery && decisionScreens % opts.lateEvery === 0 ? humans[humans.length - 1] : undefined;
    if (g.phase.kind === 'TALK')
      for (const h of humans) if (!opts.idle?.includes(h)) go({ type: 'SEND_MESSAGE', from: h, msg: { type: 'CLAIM_VALUES', card: 'RAWLSIAN' } });
    const step = screenDecisionPhase(g, g.phaseQueue)?.step;
    for (const h of pendingHumans(t)) {
      if (screenKey(t.game) !== key) break;
      if (opts.idle?.includes(h) || h === late) continue;
      if (k === 'guess') {
        const guesses = Object.fromEntries(t.game.players.filter((p) => p.id !== h).map((p) => [p.id, 'EGOIST' as const]));
        go({ type: 'GUESSES', from: h, guesses });
      } else go({ type: 'DECIDE', from: h, decision: script(t.game, step!, h, humans.indexOf(h)) });
    }
    if (screenKey(t.game) === key) go({ type: 'TIMEOUT' });
  }
  const autos = t.game.log.filter((x) => 'auto' in x.action && x.action.auto).length;
  return { t, autos, steps };
}

describe('several humans play every level to the end', () => {
  for (const nHumans of [2, 3, 4]) {
    for (const level of [1, 2, 3, 4, 5] as LevelId[]) {
      it(`${nHumans} humans + ${4 - nHumans} bots, Level ${level}`, () => {
        const { t, autos } = drive(start(nHumans, { mode: 'SINGLE_LEVEL', level, seed: `${SEED}-${nHumans}-${level}` }), { lateEvery: 3 });
        expect(t.game.phase.kind).toBe('END');
        expect(autos).toBeGreaterThan(0);
        // Replay from seed plus log, auto decisions included, gives an identical final state.
        expect(replay(t.game.log)).toEqual(t.game);
      });
    }
  }
  it('3 humans in a 3-seat full run, with one seat always timing out', () => {
    const { t, autos } = drive(start(3, { nPlayers: 3, seed: `${SEED}-full3` }), { idle: ['p2'] });
    expect(t.game.phase.kind).toBe('END');
    expect(autos).toBeGreaterThan(20);
    expect(replay(t.game.log)).toEqual(t.game);
    // Every human guessed; the idle seat's guesses were made by the timeout rule (none).
    expect(Object.keys(t.game.guesses!.byHuman!).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(t.game.guesses!.byHuman!.p2).toEqual({});
    expect(Object.keys(t.game.guesses!.byHuman!.p1).sort()).toEqual(['p2', 'p3']);
  });
});

describe('hidden information with several humans', () => {
  // Markers planted in a copy of each state: if a viewer's view contains one, a secret leaked.
  function plant(s: GameState, viewer: PlayerId): GameState {
    const c = structuredClone(s);
    for (const p of c.players) {
      if (p.id === viewer) continue;
      (p as { values: string }).values = `__CARD_${p.id}__`;
      p.privateInfo = { secret: `__PRIVATE_${p.id}__` };
      if (p.id in c.pending) c.pending[p.id] = `__PENDING_${p.id}__`;
    }
    const l = c.levelState as Record<string, any>;
    const mark = (rec: Record<string, unknown> | undefined, what: string) => {
      if (!rec) return;
      for (const id of Object.keys(rec)) if (id !== viewer) rec[id] = `__${what}_${id}__`;
    };
    if (c.levelIndex === 2 && l) mark(l.talents, 'TALENT');
    if (c.levelIndex === 3 && l) {
      mark(l.types, 'RISK');
      for (const r of l.rounds ?? []) mark(r.pEff, 'RISK');
    }
    if (c.levelIndex === 4 && l) {
      mark(l.costs, 'COST');
      for (const r of [...(l.rounds ?? []), l.current]) if (r) mark(r.costs, 'COST');
    }
    if (c.levelIndex === 5 && l) {
      mark(l.fair1, 'FAIR');
      mark(l.fair2, 'FAIR');
    }
    return c;
  }

  const seen: GameState[] = [];
  const runs = [
    drive(start(4, { seed: `${SEED}-priv4` }), { lateEvery: 4, onState: (t) => seen.push(t.game) }),
    drive(start(2, { nPlayers: 3, seed: `${SEED}-priv2` }), { lateEvery: 5, onState: (t) => seen.push(t.game) }),
  ];

  it('both full runs end', () => {
    for (const r of runs) expect(r.t.game.phase.kind).toBe('END');
    expect(seen.length).toBeGreaterThan(400);
  });

  it("no human's view holds another player's card, private info, talent, risk type, training cost, fair-tax answers or pending decision", () => {
    let checked = 0;
    for (const s of seen) {
      const revealValues = s.phase.kind === 'RUN_DEBRIEF' || s.phase.kind === 'END' || (s.mode === 'SINGLE_LEVEL' && s.phase.kind === 'LEVEL_DEBRIEF');
      const revealPrivate = isRevealPrivate(s.phase);
      for (const viewer of s.players.filter((p) => p.isHuman).map((p) => p.id)) {
        const json = JSON.stringify(visibleState(plant(s, viewer), viewer, { hideSeed: true }));
        if (!revealValues) expect(json).not.toMatch(/__CARD_/);
        if (!revealPrivate) expect(json).not.toMatch(/__(PRIVATE|TALENT|RISK|COST|FAIR)_/);
        expect(json).not.toMatch(/__PENDING_/);
        // Per-human debrief lines are merged for the viewer only.
        expect(json).not.toMatch(/"byHuman"|"bonusBy"|"pollTargets"|"polls":\{/);
        // The seed would let a client recompute every hidden draw.
        if (s.phase.kind !== 'END') expect(json).not.toContain(SEED);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('Level 2: only your own poll answers and your own Bonus Pot pair', () => {
    const s = seen.find((x) => x.levelIndex === 2 && x.phase.kind === 'LEVEL_DEBRIEF' && x.players.filter((p) => p.isHuman).length === 4)!;
    const v1 = visibleState(s, 'p1');
    const v2 = visibleState(s, 'p2');
    const d1 = v1.levelResults[2] as any;
    const d2 = v2.levelResults[2] as any;
    expect(d1.polls.length).toBeGreaterThan(0);
    expect(d1.polls[0].answer).not.toBe(d2.polls[0].answer);
    expect(d1.bonus.a.id).not.toBe('p1');
    expect(d1.bonus.b.id).not.toBe('p1');
    for (const r of d1.rounds) expect(r.poll === undefined || r.pollTarget !== 'p1').toBe(true);
  });

  it("each human's card's-best line is their own", () => {
    const s = seen.find((x) => x.levelIndex === 1 && x.phase.kind === 'LEVEL_DEBRIEF' && x.players.filter((p) => p.isHuman).length === 4)!;
    const rounds = (s.levelResults[1] as any).rounds as Array<{ votes: Record<string, string> }>;
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      const d = visibleState(s, id).levelResults[1] as any;
      expect(d.cardBest.chose).toEqual(rounds.map((r) => r.votes[id]));
    }
  });

  it('Level 5 verdicts are per human', () => {
    const s = seen.find((x) => x.levelIndex === 5 && x.phase.kind === 'LEVEL_DEBRIEF' && x.players.filter((p) => p.isHuman).length === 4)!;
    for (const id of ['p1', 'p2', 'p3', 'p4']) expect((visibleState(s, id).levelResults[5] as any).verdict).toBeTruthy();
  });
});

describe('talk with several humans (D-64)', () => {
  const atTalk = () => {
    let t = start(2, { mode: 'SINGLE_LEVEL', level: 1, seed: `${SEED}-talk` });
    while (t.game.phase.kind !== 'TALK') t = tableStep(t, { type: 'READY', from: 'p1' }, ['p1'])!;
    return t;
  };

  it('one human locking in does not close the talk for the others', () => {
    let t = atTalk();
    t = tableStep(t, { type: 'DECIDE', from: 'p2', decision: 'P3' }, ['p1', 'p2'])!;
    expect(t.game.phase.kind).toBe('TALK');
    expect(lockedIn(t)).toEqual(['p2']);
    // The other human can still talk, and so can the one who locked in.
    const n = tableStep(t, { type: 'SEND_MESSAGE', from: 'p1', msg: { type: 'SUPPORT', option: 'P2' } }, ['p1', 'p2']);
    expect(n).not.toBeNull();
    t = tableStep(n!, { type: 'SEND_MESSAGE', from: 'p2', msg: { type: 'FLAVOR' } }, ['p1', 'p2'])!;
    expect(t.game.phase.kind).toBe('TALK');
    // A second lock-in by the same seat is refused, and nobody sees what was chosen.
    expect(tableStep(t, { type: 'DECIDE', from: 'p2', decision: 'P1' }, ['p1', 'p2'])).toBeNull();
    expect(JSON.stringify(visibleState(t.game, 'p1'))).not.toMatch(/"pending"/);
    const before = t.game.log.length;
    t = tableStep(t, { type: 'DECIDE', from: 'p1', decision: 'P2' }, ['p1', 'p2'])!;
    // Last lock-in: ADVANCE, then the held decisions in seat order (p1 before p2, whoever locked first).
    const added = t.game.log.slice(before).map((x) => x.action);
    expect(added[0]).toEqual({ type: 'ADVANCE' });
    expect(added[1]).toEqual({ type: 'SUBMIT_DECISION', from: 'p1', decision: 'P2' });
    expect(added[2]).toEqual({ type: 'SUBMIT_DECISION', from: 'p2', decision: 'P3' });
    expect(t.game.phase.kind).toBe('REVEAL');
  });

  it('a timed-out human is decided for without touching the game or bot streams', () => {
    const base = tableStep(atTalk(), { type: 'DECIDE', from: 'p1', decision: 'P2' }, ['p1', 'p2'])!;
    const timedOut = tableStep(base, { type: 'TIMEOUT' }, ['p1', 'p2'])!;
    const auto = timedOut.game.log.map((x) => x.action).find((a) => a.type === 'SUBMIT_DECISION' && a.from === 'p2')!;
    expect(auto).toMatchObject({ auto: true });
    const chosen = (auto as { decision: unknown }).decision;
    const manual = tableStep(base, { type: 'DECIDE', from: 'p2', decision: chosen }, ['p1', 'p2'])!;
    expect(timedOut.game.rng).toEqual(manual.game.rng);
    expect(timedOut.game.history).toEqual(manual.game.history);
    // The same seat at the same step always gets the same answer.
    const again = tableStep(base, { type: 'TIMEOUT' }, ['p1', 'p2'])!;
    expect(again.game).toEqual(timedOut.game);
  });

  it('information screens wait for every connected human, or the timer', () => {
    let t = start(3, { mode: 'SINGLE_LEVEL', level: 1, seed: `${SEED}-ready` });
    expect(screenKind(t.game)).toBe('info');
    const key = screenKey(t.game);
    t = tableStep(t, { type: 'READY', from: 'p1' }, ['p1', 'p2'])!;
    expect(screenKey(t.game)).toBe(key);
    expect(tableStep(t, { type: 'READY', from: 'p1' }, ['p1', 'p2'])).toBeNull();
    // p3 is disconnected, so p2's Ready is the last one needed.
    t = tableStep(t, { type: 'READY', from: 'p2' }, ['p1', 'p2'])!;
    expect(screenKey(t.game)).not.toBe(key);
    const key2 = screenKey(t.game);
    const timed = tableStep(t, { type: 'TIMEOUT' }, ['p1', 'p2'])!;
    expect(screenKey(timed.game)).not.toBe(key2);
  });

  it('a seat id can never act for another seat', () => {
    const t = atTalk();
    expect(tableStep(t, { type: 'DECIDE', from: 'chet', decision: 'P1' }, ['p1'])).toBeNull();
    expect(tableStep(t, { type: 'DECIDE', from: 'p9', decision: 'P1' }, ['p1'])).toBeNull();
    expect(LEVELS[1].validate(t.game, 'VOTE', 'p1', 'P9')).toBeNull();
    expect(tableStep(t, { type: 'DECIDE', from: 'p1', decision: 'P9' }, ['p1'])).toBeNull();
  });
});

describe('Level 4 counterfactual with several humans (D-24)', () => {
  it("replays every human's logged decisions: the same-seed baseline reproduces the real gap", () => {
    const { t } = drive(start(3, { mode: 'SINGLE_LEVEL', level: 4, seed: `${SEED}-cf` }), { lateEvery: 2 });
    const d = t.game.levelResults[4] as any;
    const base = d.counterfactual.scenarios.find((x: { key: string }) => x.key === 'BASELINE');
    expect(base.gap).toBeCloseTo(d.gap, 9);
  });
});
