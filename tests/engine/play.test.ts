// Play mode (PLAY_MODE_SPEC.md Section 11): ruleset plumbing, bank and debt stress, events, scoring,
// card guesses, privacy and rules versions. Study behavior itself is pinned by golden.test.ts.
import { describe, expect, it } from 'vitest';
import { createInitialState, reduce, replay, step, visibleState, waitingOn, HUMAN_ID } from '../../src/engine/engine';
import { autoDecision } from '../../src/engine/auto';
import { act, newTable, screenKind, tableStep, type Table } from '../../src/shared/flow';
import { PLAY } from '../../src/engine/play/params';
import { debtStressFor, playScore } from '../../src/engine/play/rules';
import { canResume, currentRules, gameRecord, paramsHash, RulesMismatchError } from '../../src/engine/version';
import type { L3Debrief } from '../../src/engine/levels/level3';
import type { GameState, SetupConfig } from '../../src/engine/types';

const cfg = (seed: string, extra: Partial<SetupConfig> = {}): SetupConfig => ({ mode: 'EPISODE', level: 3, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed, botSamples: 30, ...extra });

/** A Play episode for one human through the screen flow, deciding with the bot code. */
function playSolo(seed: string, guess = true): GameState[] {
  let g = reduce(null as unknown as GameState, { type: 'START_RUN', config: cfg(seed) });
  const states = [g];
  g = act(g, HUMAN_ID);
  for (let i = 0; i < 500 && g.phase.kind !== 'END'; i++) {
    const k = screenKind(g);
    if (k === 'predecision') {
      const peek = reduce(g, { type: 'ADVANCE' });
      g = act(g, HUMAN_ID, peek.phase.kind === 'DECIDE' && waitingOn(peek).includes(HUMAN_ID) ? autoDecision(peek, HUMAN_ID) : undefined);
    } else if (k === 'decision') g = act(g, HUMAN_ID, autoDecision(g, HUMAN_ID));
    else if (k === 'guess') g = act(g, HUMAN_ID, undefined, guess ? { [g.players[1].id]: 'EGOIST' } : {});
    else g = act(g, HUMAN_ID);
    states.push(g);
  }
  return states;
}

function botsOnly(seed: string): GameState {
  const s = createInitialState({ ...cfg(seed), allBots: true });
  while (s.phase.kind !== 'END') if (!step(s, { type: 'ADVANCE' })) throw new Error('stuck');
  return s;
}

describe('ruleset plumbing', () => {
  it('Study configs and states carry no Play fields', () => {
    const s = createInitialState({ mode: 'SINGLE_LEVEL', level: 3, nPlayers: 4, difficulty: 'NORMAL', seed: 'x' });
    expect('ruleset' in s).toBe(false);
    expect('play' in s).toBe(false);
    expect('play' in visibleState(s, HUMAN_ID)).toBe(false);
  });
  it('a ruleset accepts only its own modes; LIFE is not built yet', () => {
    expect(() => createInitialState({ ...cfg('x'), ruleset: undefined })).toThrow();
    expect(() => createInitialState({ ...cfg('x'), mode: 'SINGLE_LEVEL' })).toThrow();
    expect(() => createInitialState({ ...cfg('x'), mode: 'LIFE' })).toThrow(/P3/);
    expect(() => createInitialState({ ...cfg('x'), level: 2 })).toThrow(/not built/);
  });
  it('Episode 3 has 3 rounds, the regime vote after round 2, and a card guess before the summary', () => {
    const s = createInitialState(cfg('phases'));
    const g = act(s, HUMAN_ID);
    const q = g.phaseQueue;
    expect(Math.max(...q.map((p) => p.round))).toBe(3);
    expect(q.findIndex((p) => p.step === 'REGIME')).toBeGreaterThan(q.findIndex((p) => p.kind === 'ROUND_SUMMARY' && p.round === 2));
    expect(q.slice(-2).map((p) => p.kind)).toEqual(['GUESS', 'LEVEL_DEBRIEF']);
  });
});

describe('rules version', () => {
  it('the Study params hash is still main\'s (Play params are kept out of it)', () => expect(paramsHash()).toBe('5ba140feb4eef1b7'));
  it('Play and Study versions differ; the rules field is the same source hash', () => {
    const study = currentRules('STUDY');
    const play = currentRules('PLAY');
    expect(play.rules).toBe(study.rules);
    expect(play.params).not.toBe(study.params);
  });
  it('a Play save cannot load as Study, and the reverse', () => {
    const [, ...rest] = playSolo('save');
    const g = rest[rest.length - 1];
    expect(canResume(g)).toBe(true);
    expect(canResume({ ...g, ruleset: undefined, config: { ...g.config, ruleset: undefined } })).toBe(false);
    const study = createInitialState({ mode: 'SINGLE_LEVEL', level: 3, nPlayers: 4, difficulty: 'NORMAL', seed: 'y' });
    expect(canResume(study)).toBe(true);
    expect(canResume({ ...study, ruleset: 'PLAY' })).toBe(false);
    const rec = gameRecord(g);
    expect(() => replay(g.log, { ...rec, config: { ...rec.config, ruleset: undefined } } as never)).toThrow(RulesMismatchError);
    expect(replay(g.log, rec)).toEqual(g);
  });
});

describe('bank and debt stress', () => {
  it('debt stress is one point per coin of debt, capped per round', () => {
    expect(debtStressFor(5)).toBe(0);
    expect(debtStressFor(0)).toBe(0);
    expect(debtStressFor(-10)).toBe(10 * PLAY.DEBT_POINTS_PER_COIN);
    expect(debtStressFor(-1000)).toBe(PLAY.DEBT_PENALTY_CAP);
  });
  it('every round moves each bank by W minus living cost and takes that round\'s stress', () => {
    for (const seed of ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']) {
      const s = botsOnly(seed);
      const pl = s.play!;
      let banks = { ...pl.episodeStart[3]! };
      let stress = Object.fromEntries(s.players.map((p) => [p.id, 0]));
      expect(pl.bankHistory).toHaveLength(3);
      for (const h of pl.bankHistory)
        for (const p of s.players) {
          banks[p.id] += h.W[p.id] - PLAY.LIVING_COST;
          expect(h.banks[p.id]).toBeCloseTo(banks[p.id], 9);
          expect(h.stress[p.id]).toBe(debtStressFor(banks[p.id]));
          stress[p.id] += h.stress[p.id];
        }
      for (const p of s.players) expect(pl.debtStress[p.id]).toBeCloseTo(stress[p.id], 9);
      expect(pl.episodeStart[3]![s.players[0].id]).toBe(PLAY.EPISODE_STARTING_BANK);
    }
  });
  it('final score = bank half + mission half - debt stress + guess points', () => {
    const s = botsOnly('score');
    const banks = s.players.map((p) => s.play!.banks[p.id]);
    s.players.forEach((p, i) => {
      const metric = { EGOIST: banks[i], RAWLSIAN: Math.min(...banks), UTILITARIAN: banks.reduce((a, b) => a + b, 0) / banks.length } as Record<string, number>;
      if (p.values !== 'MERITOCRAT')
        expect(playScore(s, p.id)).toBeCloseTo(PLAY.BANK_WEIGHT * banks[i] + PLAY.MISSION_WEIGHT * PLAY.MISSION_SCALE[p.values] * metric[p.values] - s.play!.debtStress[p.id] + s.play!.guessPoints[p.id], 9);
    });
  });
});

describe('events', () => {
  const games = Array.from({ length: 40 }, (_, k) => botsOnly(`ev-${k}`));
  it('one event or quiet week is drawn and recorded before every round', () => {
    for (const s of games) {
      expect(s.play!.events.map((e) => e.round)).toEqual([1, 2, 3]);
      for (const e of s.play!.events) expect(['QUIET', 'STORM', 'GYM_SALE', 'PRICE_WAR', 'BREAKTHROUGH', 'PAPERWORK']).toContain(e.id);
    }
  });
  it('Paperwork Week only happens under a mandate', () => {
    for (const s of games) for (const e of s.play!.events) if (e.id === 'PAPERWORK') expect((s.levelResults[3] as L3Debrief).rounds[e.round - 1].regime).not.toBe('VOL');
  });
  it('an event changes its own round only', () => {
    let checked = 0;
    for (const s of games) {
      const d = s.levelResults[3] as L3Debrief;
      s.play!.events.forEach((e) => {
        const r = d.rounds[e.round - 1];
        for (const p of s.players) {
          const c = r.choices[p.id];
          const gym = e.id === 'GYM_SALE' ? PLAY.L3_EVENTS.GYM_SALE.GYM_COST : PLAY.L3.GYM_COST;
          const loss = e.id === 'BREAKTHROUGH' ? PLAY.L3_EVENTS.BREAKTHROUGH.LOSS : PLAY.L3.LOSS;
          if (r.regime === 'VOL') {
            const bought = c.buy && r.premium !== null;
            expect(r.W[p.id]).toBeCloseTo(100 - (bought ? r.premium! : 0) - (c.gym ? gym : 0) - (r.events[p.id] && !bought ? loss : 0), 9);
            checked++;
          }
        }
        if (r.regime === 'VOL' && r.premium !== null) expect(r.premium).toBeCloseTo(r.listPrice! * (e.id === 'PRICE_WAR' ? PLAY.L3_EVENTS.PRICE_WAR.PREMIUM_MULT : 1), 9);
        if (e.id === 'STORM') for (const p of s.players) expect(r.pEff[p.id]).toBeLessThanOrEqual(PLAY.L3_EVENTS.STORM.RISK_CAP);
      });
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('card guess', () => {
  it('a correct guess is worth GUESS_POINTS; more than one target is refused', () => {
    const states = playSolo('guess');
    const atGuess = states.find((s) => s.phase.kind === 'GUESS')!;
    const target = atGuess.players[1];
    const wrong = target.values === 'EGOIST' ? 'RAWLSIAN' : 'EGOIST';
    const two = reduce(atGuess, { type: 'SUBMIT_GUESSES', from: HUMAN_ID, guesses: { [target.id]: target.values, [atGuess.players[2].id]: 'EGOIST' } });
    expect(two).toBe(atGuess);
    const right = reduce(atGuess, { type: 'SUBMIT_GUESSES', from: HUMAN_ID, guesses: { [target.id]: target.values } });
    expect(right.play!.guessPoints[HUMAN_ID]).toBe(PLAY.GUESS_POINTS);
    const no = reduce(atGuess, { type: 'SUBMIT_GUESSES', from: HUMAN_ID, guesses: { [target.id]: wrong } });
    expect(no.play!.guessPoints[HUMAN_ID]).toBe(0);
    expect(right.phase.kind).toBe('LEVEL_DEBRIEF');
  });
});

describe('replay determinism', () => {
  it('solo Play episodes replay exactly from seed and log', () => {
    for (const seed of ['r1', 'r2', 'r3']) {
      const states = playSolo(seed);
      const g = states[states.length - 1];
      expect(g.phase.kind).toBe('END');
      expect(replay(g.log)).toEqual(g);
    }
  });
  it('a table with timeouts and auto decisions replays exactly', () => {
    const humans = ['h1', 'h2'];
    let t: Table = newTable(reduce(null as unknown as GameState, { type: 'START_RUN', config: cfg('tbl', { humans: [{ id: 'h1', name: 'Ana' }, { id: 'h2', name: 'Bo' }] }) }));
    for (let i = 0; i < 400 && t.game.phase.kind !== 'END'; i++) {
      const k = screenKind(t.game);
      const n = k === 'info' ? tableStep(t, { type: 'READY', from: 'h1' }, ['h1']) : tableStep(t, { type: 'TIMEOUT' }, humans);
      if (n) t = n;
    }
    expect(t.game.phase.kind).toBe('END');
    expect(t.game.log.some(({ action }) => action.type === 'SUBMIT_DECISION' && action.auto)).toBe(true);
    expect(replay(t.game.log)).toEqual(t.game);
  });
});

describe('privacy', () => {
  // Every engine state the game passed through (one per logged action), not just one per screen.
  const solo = playSolo('privacy');
  const states: GameState[] = [];
  for (const { action } of solo[solo.length - 1].log) states.push(action.type === 'START_RUN' ? reduce(null as unknown as GameState, action) : reduce(states[states.length - 1], action));
  it('before the summary, no view holds another contestant\'s mission, risk type, score or guess', () => {
    const before = states.filter((s) => !['LEVEL_DEBRIEF', 'END'].includes(s.phase.kind));
    expect(before.length).toBeGreaterThan(10);
    for (const s of before) {
      const v = visibleState(s, HUMAN_ID);
      for (const p of v.players) if (p.id !== HUMAN_ID) {
        expect(p.values).toBeUndefined();
        expect(p.privateInfo).toBeUndefined();
        expect(v.scores[p.id]).toBeUndefined();
      }
      expect(v.play!.finalScores).toBeNull();
      expect(v.play!.mission!.card).toBe(s.players[0].values);
      for (const byGuesser of Object.values(v.play!.guesses)) expect(Object.keys(byGuesser ?? {}).every((g) => g === HUMAN_ID)).toBe(true);
      // Ranks are whole numbers only.
      for (const r of Object.values(v.play!.ranks ?? {})) expect(Number.isInteger(r)).toBe(true);
      if (!s.play!.bankHistory.some((h) => h.level === s.levelIndex)) expect(v.play!.ranks).toBeNull();
      const lv = v.levelView as { types?: unknown; rounds: Array<{ pEff: Record<string, number> }> } | null;
      expect(lv?.types).toBeUndefined();
      for (const r of lv?.rounds ?? []) expect(Object.keys(r.pEff)).toEqual([HUMAN_ID]);
      expect(v.botBeliefs).toBeUndefined();
    }
  });
  it('the audience poll is shown from round 2 and only names a card share', () => {
    const shown = states.map((s) => visibleState(s, HUMAN_ID).play!.poll).filter(Boolean);
    expect(shown.length).toBeGreaterThan(0);
    for (const p of shown) expect(Object.keys(p!).sort()).toEqual(['card', 'share', 'target']);
    for (const s of states.filter((x) => x.round === 1 && x.phase.kind !== 'LEVEL_DEBRIEF')) expect(visibleState(s, HUMAN_ID).play!.poll).toBeNull();
  });
});
