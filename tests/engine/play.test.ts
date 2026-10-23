// Play mode (PLAY_MODE_SPEC.md Section 11): ruleset plumbing, bank and debt stress, events, scoring,
// card guesses, privacy and rules versions. Study behavior itself is pinned by golden.test.ts.
import { describe, expect, it } from 'vitest';
import { createInitialState, reduce, replay, step, visibleState, waitingOn, HUMAN_ID } from '../../src/engine/engine';
import { autoDecision } from '../../src/engine/auto';
import { act, newTable, screenKind, tableStep, type Table } from '../../src/shared/flow';
import { PLAY } from '../../src/engine/play/params';
import { observe } from '../../src/engine/play/claims';
import { debtStressFor, futureStress, playScore, roundsLeft } from '../../src/engine/play/rules';
import { baselineBanks } from '../../src/engine/play/nearMiss';
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
  it('Episode 3 (The Pool) has 4 rounds of claim then move, the regime vote after round 3, the card reveal, then the guess', () => {
    const s = createInitialState(cfg('phases'));
    const g = act(s, HUMAN_ID);
    const q = g.phaseQueue;
    expect(Math.max(...q.map((p) => p.round))).toBe(4);
    expect(q.some((p) => p.kind === 'TALK')).toBe(false);
    for (let r = 1; r <= 4; r++) {
      const claim = q.findIndex((p) => p.step === 'CLAIM' && p.round === r);
      expect(q[claim + 1]).toEqual({ kind: 'DECIDE', step: 'CHOICE', round: r });
    }
    expect(q.findIndex((p) => p.step === 'REGIME')).toBeGreaterThan(q.findIndex((p) => p.kind === 'ROUND_SUMMARY' && p.round === 3));
    expect(q.findIndex((p) => p.step === 'REGIME')).toBeLessThan(q.findIndex((p) => p.kind === 'BRIEFING' && p.round === 4));
    expect(q.slice(-3).map((p) => `${p.kind}:${p.step ?? ''}`)).toEqual(['REVEAL:CARDS', 'GUESS:EPISODE', 'LEVEL_DEBRIEF:']);
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
      expect(pl.bankHistory).toHaveLength(4);
      for (const h of pl.bankHistory)
        for (const p of s.players) {
          banks[p.id] += h.W[p.id] - PLAY.LIVING_COST;
          expect(h.banks[p.id]).toBeCloseTo(banks[p.id], 9);
          const worry = (s.levelState as { worry: Record<string, string> }).worry[p.id];
          expect(h.stress[p.id]).toBe((worry === 'WORRIER' ? PLAY.WORRIER_STRESS_MULT : 1) * debtStressFor(banks[p.id]));
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
      expect(s.play!.events.map((e) => e.round)).toEqual([1, 2, 3, 4]);
      for (const e of s.play!.events) expect(['QUIET', ...PLAY.L3_DECK]).toContain(e.id);
    }
  });
  it('the event chance is 0.4 and Leaked Medical Files only draws from round 2, into an open pool', () => {
    expect(PLAY.EVENT_CHANCE).toBe(0.4);
    for (const s of games) {
      const d = s.levelResults[3] as L3Debrief;
      for (const e of s.play!.events) if (e.id === 'LEAKED') {
        expect(e.round).toBeGreaterThanOrEqual(PLAY.LEAKED_FROM_ROUND);
        expect(d.rounds[e.round - 1].regime).toBe('VOL');
      }
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
      const lv = v.levelView as { types?: unknown; leaked?: number | null; cardsRevealed?: boolean; rounds: Array<{ pEff: Record<string, number> }> } | null;
      // Risk types are public only once leaked (v2 Section 5) or at the end reveal (v2 Section 3.4).
      if (lv?.leaked || lv?.cardsRevealed) expect(lv.types).toEqual((s.levelState as { types: unknown }).types);
      else expect(lv?.types).toBeUndefined();
      // Honesty traits, bots' own beliefs and the claim log (it holds the truth) never reach a view.
      expect(Object.keys(v.play!).filter((k) => ['honesty', 'belief', 'belief2', 'joint', 'claimLog', 'barReads'].includes(k))).toEqual([]);
      // D-128: your own worry card only, until the cards flip (a leak never shows worry).
      const lw = v.levelView as { myWorry?: string; worry?: unknown; cardsRevealed?: boolean } | null;
      if (lw && s.levelState) {
        expect(lw.myWorry).toBe((s.levelState as { worry: Record<string, string> }).worry[HUMAN_ID]);
        if (!lw.cardsRevealed) expect(lw.worry).toBeUndefined();
      }
      for (const r of lv?.rounds ?? []) expect(Object.keys(r.pEff)).toEqual([HUMAN_ID]);
      expect(v.botBeliefs).toBeUndefined();
    }
  });
  it('the audience poll is the other bots\' average belief that each contestant is high risk', () => {
    const shown = states.filter((s) => visibleState(s, HUMAN_ID).play!.poll);
    expect(shown.length).toBeGreaterThan(0);
    for (const s of shown) {
      const poll = visibleState(s, HUMAN_ID).play!.poll!;
      expect(Object.keys(poll).sort()).toEqual(s.players.map((p) => p.id).sort());
      for (const p of s.players) {
        const judges = Object.entries(s.play!.belief).filter(([b]) => b !== p.id).map(([, m]) => m[p.id]);
        expect(poll[p.id]).toBeCloseTo(judges.reduce((a, b) => a + b, 0) / judges.length, 12);
      }
    }
    for (const s of states.filter((x) => x.phase.kind === 'INTRO')) expect(visibleState(s, HUMAN_ID).play!.poll).toBeNull();
  });
});

describe('v2 spine: claims, honesty and beliefs (PLAY_V2_SPEC.md Section 3)', () => {
  const games = Array.from({ length: 30 }, (_, k) => botsOnly(`spine-${k}`));
  it('honesty traits are drawn once per life inside each personality\'s range, the same for the same seed', () => {
    for (const s of games)
      for (const p of s.players) {
        const [lo, hi] = PLAY.HONESTY_RANGE[p.botProfile!.key];
        expect(s.play!.honesty[p.id]).toBeGreaterThanOrEqual(lo);
        expect(s.play!.honesty[p.id]).toBeLessThanOrEqual(hi);
      }
    expect(botsOnly('spine-0').play!.honesty).toEqual(games[0].play!.honesty);
    const human = createInitialState(cfg('h'));
    expect(Object.keys(human.play!.honesty)).not.toContain(HUMAN_ID);
  });
  it('claims are messages from the CLAIM step, stamped TRUE or LIE at the end reveal, and feed the public record', () => {
    let lies = 0;
    for (const s of games) {
      const types = (s.levelState as { types: Record<string, string> }).types;
      const claims = s.messages.filter((m) => m.msg.type === 'CLAIM');
      for (const m of claims) {
        expect(m.resolved).toBe(true);
        expect(m.kept).toBe((m.msg as { value: string }).value === types[m.from]);
        if (!m.kept) lies++;
      }
      for (const p of s.players) {
        const mine = claims.filter((m) => m.from === p.id);
        expect(s.reliability[p.id]).toEqual({ made: mine.length, kept: mine.filter((m) => m.kept).length });
      }
      // Every claim decision (silence too) is in the private log; only real claims are messages.
      expect(s.play!.claimLog.filter((c) => c.said !== 'SILENT')).toHaveLength(claims.length);
    }
    expect(lies).toBeGreaterThan(0);
  });
  it('a lie only happens where the rule says it pays: gain x (1 - honesty) above the credibility cost', () => {
    for (const s of games) for (const c of s.play!.claimLog) if (c.lied) expect(c.lieGain! * (1 - s.play!.honesty[c.pid])).toBeGreaterThan(0);
  });
  it('the human claims through a logged SUBMIT_DECISION, and LOW, HIGH or SILENT are the only answers', () => {
    const states = playSolo('claim-human');
    const g = states[states.length - 1];
    const atClaim = states.find((x) => x.phase.kind === 'DECIDE' && x.phase.step === 'CLAIM')!;
    expect(reduce(atClaim, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: 'MAYBE' })).toBe(atClaim);
    const ok = reduce(atClaim, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: 'LOW' });
    expect(ok.messages.some((m) => m.from === HUMAN_ID && m.msg.type === 'CLAIM' && m.round === atClaim.round)).toBe(true);
    expect(g.log.some(({ action }) => action.type === 'SUBMIT_DECISION' && action.from === HUMAN_ID && ['LOW', 'HIGH', 'SILENT'].includes(action.decision as string))).toBe(true);
  });
});

describe('The Pool: the Bar and Leaked Medical Files (PLAY_V2_SPEC.md Sections 4 and 5)', () => {
  const games = Array.from({ length: 40 }, (_, k) => botsOnly(`pool-${k}`));
  it('only last round\'s members vote; at least half of the other members bar an applicant, who gets no cover (D-133)', () => {
    let bars = 0;
    for (const s of games) {
      const d = s.levelResults[3] as L3Debrief;
      d.rounds.forEach((r, k) => {
        if (!r.bar) return;
        const prev = d.rounds[k - 1];
        expect(r.bar.members).toEqual(s.players.map((p) => p.id).filter((id) => prev.choices[id].buy));
        const counts: Record<string, number> = {};
        for (const v of Object.values(r.bar.votes)) if (v) counts[v] = (counts[v] ?? 0) + 1;
        const need = (j: string) => Math.max(1, Math.ceil(r.bar!.members.filter((m) => m !== j).length / 2));
        expect(r.bar.barred).toEqual(s.players.map((p) => p.id).filter((j) => (counts[j] ?? 0) >= need(j)));
        for (const [m, v] of Object.entries(r.bar.votes)) expect(v).not.toBe(m);
        for (const j of r.bar.barred) {
          bars++;
          expect(r.choices[j].buy).toBe(false);
          expect(r.bar.refused.includes(j)).toBe(r.applied![j]);
        }
      });
      expect(d.rounds[0].bar).toBeUndefined();
    }
    expect(bars).toBeGreaterThan(0);
  });
  it('a bar vote from a non-member is dropped', () => {
    const states = playSolo('bar-member');
    for (const g of states.filter((x) => x.phase.kind === 'DECIDE' && x.phase.step === 'CHOICE' && x.round > 1)) {
      const d = reduce(g, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: { buy: false, gym: false, bar: g.players[1].id } });
      if (d === g) continue;
      const r = (d.levelState as { rounds: Array<{ bar?: { votes: Record<string, string | null> } }> }).rounds[g.round - 1];
      const member = !!r.bar && HUMAN_ID in r.bar.votes;
      if (member) expect(r.bar!.votes[HUMAN_ID]).toBe(g.players[1].id);
      else expect(r.bar?.votes[HUMAN_ID]).toBeUndefined();
    }
  });
  it('once files leak, every risk type is public, beliefs match the truth and nobody claims', () => {
    const leaked = Array.from({ length: 120 }, (_, k) => `leak-${k}`)
      .map((seed) => botsOnly(seed))
      .filter((s) => s.play!.events.some((e) => e.id === 'LEAKED'));
    expect(leaked.length).toBeGreaterThan(0);
    for (const s of leaked) {
      const at = s.play!.events.find((e) => e.id === 'LEAKED')!.round;
      const types = (s.levelState as { types: Record<string, string>; leaked?: number }).types;
      expect((s.levelState as { leaked?: number }).leaked).toBe(at);
      for (const c of s.play!.claimLog) expect(c.round).toBeLessThan(at);
      for (const [, m] of Object.entries(s.play!.belief)) for (const [t, b] of Object.entries(m)) expect(b > 0.5).toBe(types[t] === 'HIGH');
    }
  });
});

describe('near misses (PLAY_V2_SPEC.md Section 6.1)', () => {
  it('the summary names one change to your own decisions and the coins it would have kept', () => {
    let found = 0;
    for (const seed of ['nm-1', 'nm-2', 'nm-3']) {
      const states = playSolo(seed);
      const debrief = states.find((x) => x.phase.kind === 'LEVEL_DEBRIEF')!;
      const v = visibleState(debrief, HUMAN_ID);
      const nm = (v.levelResults[3] as { nearMiss?: { kind: string; round: number; gain: number; from: unknown } | null }).nearMiss;
      expect(nm === null || typeof nm === 'object').toBe(true);
      if (!nm) continue;
      found++;
      expect(Number.isInteger(nm.gain)).toBe(true);
      expect(nm.gain).toBeGreaterThanOrEqual(1);
      const l = debrief.levelState as { rounds: Array<{ choices: Record<string, { buy: boolean; gym: boolean }>; applied?: Record<string, boolean> }> };
      if (nm.kind === 'CHOICE') {
        const r = l.rounds[nm.round - 1];
        expect(nm.from).toEqual({ buy: r.applied?.[HUMAN_ID] ?? r.choices[HUMAN_ID].buy, gym: r.choices[HUMAN_ID].gym });
      }
      // The sandbox with nothing changed replays the real episode exactly.
      expect(baselineBanks(debrief)).toEqual(debrief.play!.banks);
      // Another viewer never sees it (it is personal), and the debrief state holds it only under byHuman.
      expect('nearMiss' in (debrief.levelResults[3] as object)).toBe(false);
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('Q1 review fixes (D-120 to D-122)', () => {
  it('a bot reads each contestant on their own: what one does never moves its belief about another (D-141)', () => {
    const s = createInitialState({ ...cfg('prior'), allBots: true });
    step(s, { type: 'ADVANCE' });
    const [a, b, c] = s.players.map((p) => p.id);
    const before = s.play!.belief[a][c];
    observe(s, b, (high) => (high ? 0.9 : 0.1));
    expect(s.play!.belief[a][b]).toBeGreaterThan(0.85);
    expect(s.play!.belief[a][c]).toBeCloseTo(before, 12);
  });
  it('the launch round signs everyone up at the pooled price; no bar until round 2, when every round-1 player is a member', () => {
    expect(PLAY.L3_LAUNCH).toBe(true);
    for (let k = 0; k < 20; k++) {
      const s = botsOnly(`launch-${k}`);
      const d = s.levelResults[3] as L3Debrief;
      const r1 = d.rounds[0];
      expect(r1.launch).toBe(true);
      expect(r1.bar).toBeUndefined();
      for (const p of s.players) expect(r1.choices[p.id].buy).toBe(true);
      if (d.rounds[1].bar) expect(d.rounds[1].bar.members).toEqual(s.players.map((p) => p.id));
    }
    const states = playSolo('launch-human');
    const atChoice = states.find((x) => x.phase.kind === 'DECIDE' && x.phase.step === 'CHOICE' && x.round === 1)!;
    const n = reduce(atChoice, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: { buy: false, gym: false } });
    expect((n.levelState as { rounds: Array<{ choices: Record<string, { buy: boolean }> }> }).rounds[0].choices[HUMAN_ID].buy).toBe(true);
  });
  it('debt horizon: the stress of later rounds, on a bank that drifts by income minus living cost minus the pooled price', () => {
    expect(PLAY.DEBT_HORIZON).toBe(true);
    const s = createInitialState({ ...cfg('horizon'), allBots: true });
    step(s, { type: 'ADVANCE' });
    while (s.round < 2) step(s, { type: 'ADVANCE' });
    expect(roundsLeft(s)).toBe(2);
    const drift = 31.5;
    expect(futureStress(s, -100, drift)).toBeCloseTo(debtStressFor(-68.5) + debtStressFor(-37), 9);
    expect(futureStress(s, 50, drift)).toBe(0);
    expect(futureStress(s, -100, null)).toBe(0);
  });
});

describe('the worry card (D-128)', () => {
  const games = Array.from({ length: 30 }, (_, k) => botsOnly(`worry-${k}`));
  it('every risk and worry card is drawn on its own, 50/50 (D-141; the hidden mixed-deal rule off)', () => {
    const was = PLAY.L3_MIXED_DEAL;
    PLAY.L3_MIXED_DEAL = false;
    const many = Array.from({ length: 200 }, (_, k) => {
      const s = createInitialState({ ...cfg(`deal-${k}`), allBots: true });
      step(s, { type: 'ADVANCE' });
      return s.levelState as { worry: Record<string, string>; types: Record<string, string> };
    });
    PLAY.L3_MIXED_DEAL = was;
    const highs = many.map((l) => Object.values(l.types).filter((x) => x === 'HIGH').length);
    const worriers = many.map((l) => Object.values(l.worry).filter((x) => x === 'WORRIER').length);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(highs) / 4).toBeGreaterThan(0.42);
    expect(mean(highs) / 4).toBeLessThan(0.58);
    expect(mean(worriers) / 4).toBeGreaterThan(0.42);
    expect(mean(worriers) / 4).toBeLessThan(0.58);
    // No fixed mix: tables with every count of high-risk players turn up.
    for (const k of [0, 1, 2, 3, 4]) expect(highs).toContain(k);
    // Worry is independent of risk.
    const both = many.flatMap((l) => Object.keys(l.types).map((id) => [l.types[id] === 'HIGH', l.worry[id] === 'WORRIER']));
    const pHW = both.filter(([h, w]) => h && w).length / both.length;
    expect(Math.abs(pHW - 0.25)).toBeLessThan(0.06);
  });
  it('with the hidden mixed-deal rule (on, D-141), tables of 3 or 4 always hold both risk cards; 2 seats are never redrawn', () => {
    expect(PLAY.L3_MIXED_DEAL).toBe(true);
    const was = PLAY.L3_MIXED_DEAL;
    PLAY.L3_MIXED_DEAL = true;
    try {
      let sameAt2 = 0;
      for (const n of [2, 3, 4] as const)
        for (let k = 0; k < 60; k++) {
          const s = createInitialState({ ...cfg(`mixed-${n}-${k}`), nPlayers: n, allBots: true });
          step(s, { type: 'ADVANCE' });
          const kinds = new Set(Object.values((s.levelState as { types: Record<string, string> }).types));
          if (n >= 3) expect(kinds.size).toBe(2);
          else if (kinds.size === 1) sameAt2++;
        }
      expect(sameAt2).toBeGreaterThan(0);
    } finally {
      PLAY.L3_MIXED_DEAL = was;
    }
  });
  it('bots start from an independent 0.5 per card per player (D-141)', () => {
    const s = createInitialState({ ...cfg('worry-belief'), allBots: true });
    step(s, { type: 'ADVANCE' });
    for (const [obs, m] of Object.entries(s.play!.joint)) {
      expect(Object.keys(m)).toHaveLength(3);
      expect(Object.keys(m)).not.toContain(obs);
      for (const w of Object.values(m)) expect(w).toHaveLength(4);
    }
    for (const m of [...Object.values(s.play!.belief), ...Object.values(s.play!.belief2)]) for (const b of Object.values(m)) expect(b).toBeCloseTo(0.5, 9);
  });
  it('the debt stress of a Worrier in the score is WORRIER_STRESS_MULT times the Calm amount', () => {
    expect(PLAY.WORRIER_STRESS_MULT).toBe(3);
    let checked = 0;
    for (const s of games) {
      const l = s.levelState as { worry: Record<string, string> };
      for (const h of s.play!.bankHistory)
        for (const p of s.players)
          if (h.banks[p.id] < 0) {
            checked++;
            expect(h.stress[p.id]).toBe((l.worry[p.id] === 'WORRIER' ? 3 : 1) * debtStressFor(h.banks[p.id]));
          }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Play seats (D-141)', () => {
  it('a Play table seats the 2, 3 or 4 contestants the setup asks for; the setup starts on 4', async () => {
    const { useStore } = await import('../../src/ui/store');
    for (const n of [2, 3, 4] as const) {
      useStore.getState().start({ mode: 'EPISODE', level: 3, ruleset: 'PLAY', nPlayers: n, difficulty: 'NORMAL', seed: 'seats' });
      expect(useStore.getState().game!.players).toHaveLength(n);
    }
    expect(PLAY.DEFAULT_SEATS).toBe(4);
  });
});

/** Runs a one-human game to its first move screen, deciding everything before it with the timeout rule. */
function toMove(s: GameState): void {
  for (let guard = 0; guard < 200; guard++) {
    if (s.phase.kind === 'DECIDE' && s.phase.step === 'CHOICE') return;
    if (s.phase.kind === 'DECIDE' && waitingOn(s).includes(HUMAN_ID)) step(s, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: autoDecision(s, HUMAN_ID) });
    else if (!step(s, { type: 'ADVANCE' })) throw new Error(`stuck at ${s.phase.kind}`);
  }
}

describe('Give (D-142)', () => {
  const run = (seed: string, extra: Partial<SetupConfig> = {}) => {
    const s = createInitialState({ ...cfg(seed, extra), allBots: true });
    while (s.phase.kind !== 'END') if (!step(s, { type: 'ADVANCE' })) throw new Error('stuck');
    return s;
  };
  it('gifts land after the wheel: each bank moves by its wheel money plus its gift net; the match is paid on top', () => {
    const was = PLAY.GIFT_MATCH;
    PLAY.GIFT_MATCH = 0.5;
    try {
      let gifts = 0;
      for (let k = 0; k < 12; k++) {
        const s = run(`gift-${k}`);
        const d = s.levelResults[3] as L3Debrief;
        const hist = s.play!.bankHistory.filter((h) => h.level === 3);
        d.rounds.forEach((r, n) => {
          for (const p of s.players) expect(hist[n].W[p.id]).toBeCloseTo(r.W[p.id] + r.giftNet![p.id], 9);
          for (const [from, g] of Object.entries(r.gifts!)) {
            gifts++;
            expect(PLAY.GIFT_AMOUNTS).toContain(g.amount);
            expect(g.to).not.toBe(from);
            expect(g.received).toBeCloseTo(g.amount * 1.5, 9);
            // An Egoist never gives.
            expect(s.players.find((p) => p.id === from)!.values).not.toBe('EGOIST');
          }
        });
      }
      expect(gifts).toBeGreaterThan(0);
    } finally {
      PLAY.GIFT_MATCH = was;
    }
  });
  it('a gift must be a listed amount to someone else; anything else is no gift', () => {
    const s = createInitialState(cfg('gift-validate'));
    toMove(s);
    const other = s.players.find((p) => p.id !== HUMAN_ID)!.id;
    const ok = (gift: unknown) => step(structuredClone(s), { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: { buy: false, gym: false, gift } });
    expect(ok({ to: other, amount: 5 })).toBe(true);
    const c = structuredClone(s);
    step(c, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: { buy: false, gym: false, gift: { to: HUMAN_ID, amount: 5 } } });
    const c2 = structuredClone(s);
    step(c2, { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: { buy: false, gym: false, gift: { to: other, amount: 7 } } });
    for (const g of [c, c2]) {
      for (let k = 0; k < 20 && g.phase.kind === 'DECIDE'; k++) if (!step(g, { type: 'ADVANCE' })) break;
      const r = (g.levelState as { rounds: L3Debrief['rounds'] }).rounds.at(-1)!;
      expect(r.gifts![HUMAN_ID]).toBeUndefined();
    }
  });
});

describe('the mission preview (D-143)', () => {
  it('shows each choice against doing nothing, in mission points, for your own mission only', () => {
    let checked = 0;
    for (let k = 0; k < 8; k++) {
      const s = createInitialState(cfg(`preview-${k}`));
      toMove(s);
      const me = s.players.find((p) => p.id === HUMAN_ID)!;
      const pv = (visibleState(s, HUMAN_ID).levelView as { preview: { cover: number | null; gym: number; gift: Record<string, Record<number, number>> } }).preview;
      expect(pv).toBeDefined();
      const other = s.players.find((p) => p.id !== HUMAN_ID)!.id;
      const g5 = pv.gift[other][5];
      // A plain transfer leaves the average bank where it was, and an Egoist's mission is its own bank.
      if (me.values === 'UTILITARIAN' && PLAY.GIFT_MATCH === 0) expect(g5).toBeCloseTo(0, 9);
      if (me.values === 'EGOIST') expect(g5).toBeCloseTo(-5 * PLAY.MISSION_SCALE.EGOIST, 9);
      // Round 1 is the launch round: everyone is signed up, so there is no cover choice to preview.
      expect(pv.cover).toBeNull();
      checked++;
    }
    expect(checked).toBe(8);
  });
});

describe('difficulty in Play (D-145)', () => {
  it('Easy moves honesty ranges up 0.15 and Hard down 0.15, inside 0 to 1; Hard hides the poll and bars harder', () => {
    for (const [d, shift] of [['EASY', 0.15], ['NORMAL', 0], ['HARD', -0.15]] as const) {
      const s = createInitialState({ ...cfg(`diff-${d}`, { difficulty: d }), allBots: true });
      for (const p of s.players) {
        const [lo, hi] = PLAY.HONESTY_RANGE[p.botProfile!.key];
        const h = s.play!.honesty[p.id];
        expect(h).toBeGreaterThanOrEqual(Math.max(0, Math.min(1, lo + shift)) - 1e-12);
        expect(h).toBeLessThanOrEqual(Math.max(0, Math.min(1, hi + shift)) + 1e-12);
      }
    }
    expect(PLAY.DIFFICULTY.HARD.barScale).toBe(1.5);
    const hard = createInitialState(cfg('diff-poll', { difficulty: 'HARD' }));
    toMove(hard);
    const v = visibleState(hard, HUMAN_ID);
    expect(v.play!.poll).toBeNull();
    expect(v.play!.pollMode).toBe('NEVER');
    const easy = createInitialState(cfg('diff-poll', { difficulty: 'EASY' }));
    toMove(easy);
    expect(visibleState(easy, HUMAN_ID).play!.pollMode).toBe('ALWAYS');
    expect(visibleState(easy, HUMAN_ID).play!.poll).not.toBeNull();
  });
});

describe('your name (D-146)', () => {
  it('Play shows the chosen name for you, "You" when blank; Study keeps "You"', async () => {
    const { shortName, nameOf } = await import('../../src/ui/game');
    const named = visibleState(createInitialState(cfg('name', { humanName: 'Ana Lee' })), HUMAN_ID);
    expect(nameOf(named, HUMAN_ID)).toBe('Ana Lee');
    expect(shortName(named, HUMAN_ID)).toBe('Ana');
    const blank = visibleState(createInitialState(cfg('name')), HUMAN_ID);
    expect(shortName(blank, HUMAN_ID)).toBe('You');
    const study = visibleState(createInitialState({ mode: 'SINGLE_LEVEL', level: 3, nPlayers: 4, difficulty: 'NORMAL', seed: 'name', humanName: 'Ana' }), HUMAN_ID);
    expect(shortName(study, HUMAN_ID)).toBe('You');
  });
});
