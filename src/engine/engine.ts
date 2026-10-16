// The pure reducer: (state, action) => state. Bots act inside the reducer.
import { BOT_ORDER, BOT_PROFILES, DIFFICULTY, SCORE, VALUES_DECK, BOT, TALK } from './params';
import {
  botRng,
  gameRng,
  ids,
  initBeliefs,
  isRevealPrivate,
  messageAllowed,
  playerOf,
} from './core';
import { initRng, flavorIndex } from './rng';
import { argmaxCard, updateFromDecisions, updateFromMessage } from './bots/beliefs';
import { botMessages } from './bots/messaging';
import { LEVELS } from './levels';
import { level4Counterfactual } from './counterfactual';
import type {
  Action,
  GameState,
  LevelId,
  Phase,
  Player,
  PlayerId,
  SetupConfig,
  StructuredMessage,
  ValuesCard,
  ViewState,
} from './types';

export const HUMAN_ID = 'you';

export function createInitialState(config: SetupConfig): GameState {
  const seed = config.seed || 'meritopia';
  const s: GameState = {
    version: 1,
    seed,
    rng: initRng(seed),
    mode: config.mode,
    difficulty: config.difficulty,
    config,
    players: [],
    levelIndex: config.mode === 'SINGLE_LEVEL' ? config.level ?? 1 : 1,
    round: 0,
    phase: { kind: 'VALUES_REVEAL', round: 0 },
    phaseQueue: [],
    phaseIdx: 0,
    pending: {},
    talkSent: {},
    levelState: null,
    levelsPlayed: [],
    history: [],
    messages: [],
    nextMessageId: 1,
    reliability: {},
    botBeliefs: {},
    scores: {},
    botSamples: config.botSamples ?? BOT.MC_SAMPLES,
    levelResults: {},
    log: [],
  };
  const g = gameRng(s);
  const n = config.nPlayers;
  const nBots = config.allBots ? n : n - 1;
  const botKeys = g.shuffle(BOT_ORDER).slice(0, nBots);
  const cards = g.shuffle(VALUES_DECK);
  const diff = DIFFICULTY[config.difficulty];
  const players: Player[] = [];
  if (!config.allBots) {
    players.push({
      id: HUMAN_ID,
      name: config.humanName || 'You',
      isHuman: true,
      values: cards[0],
      privateInfo: {},
      publicInfo: {},
    });
  }
  botKeys.forEach((key) => {
    const prof = BOT_PROFILES[key];
    players.push({
      id: key,
      name: prof.name,
      isHuman: false,
      botProfile: {
        key,
        rho: prof.rho,
        lambda: prof.lambda * diff.lambdaMult,
        honesty: Math.max(prof.honesty * diff.honestyMult, diff.honestyFloor),
        sigma: prof.sigma,
      },
      values: cards[players.length],
      privateInfo: {},
      publicInfo: {},
    });
  });
  s.players = players;
  for (const p of players) {
    s.scores[p.id] = { byLevel: [0, 0, 0, 0, 0], guessBonus: 0 };
    s.reliability[p.id] = { made: 0, kept: 0 };
  }
  initBeliefs(s);
  const hasHuman = players.some((p) => p.isHuman);
  if (hasHuman) {
    s.phaseQueue = [{ kind: 'VALUES_REVEAL', round: 0 }];
    s.phaseIdx = 0;
    s.phase = s.phaseQueue[0];
  } else {
    startLevel(s, s.levelIndex);
  }
  return s;
}

function def(s: GameState) {
  return LEVELS[s.levelIndex];
}

export function _startLevel(s: GameState, level: LevelId): void {
  startLevel(s, level);
}

function startLevel(s: GameState, level: LevelId): void {
  s.levelIndex = level;
  s.round = 1;
  s.levelsPlayed.push(level);
  // Messages and private info are per level.
  for (const p of s.players) p.privateInfo = {};
  for (const p of s.players) p.publicInfo = {};
  const d = LEVELS[level];
  d.init(s);
  s.phaseQueue = [{ kind: 'INTRO', round: 1 }, ...d.phases(s), { kind: 'LEVEL_DEBRIEF', round: d.rounds }];
  s.phaseIdx = 0;
  enterPhase(s);
}

function enterPhase(s: GameState): void {
  const phase = s.phaseQueue[s.phaseIdx];
  s.phase = phase;
  if (phase.round > 0) s.round = phase.round;
  s.pending = {};
  if (s.phase.kind === 'VALUES_REVEAL' || s.phase.kind === 'GUESS' || s.phase.kind === 'RUN_DEBRIEF' || s.phase.kind === 'END') return;
  const d = def(s);
  d.onEnter?.(s, phase);
  switch (phase.kind) {
    case 'TALK': {
      s.talkSent = {};
      if (s.cf?.fast) break;
      for (const p of s.players) {
        if (p.isHuman) continue;
        for (const msg of botMessages(s, d, phase, p.id)) sendMessage(s, p.id, msg);
      }
      break;
    }
    case 'DECIDE': {
      const deciders = d.deciders(s, phase.step!);
      for (const pid of deciders) {
        if (playerOf(s, pid).isHuman) continue;
        s.pending[pid] = d.botDecide(s, pid, phase.step!);
      }
      if (deciders.every((pid) => pid in s.pending)) resolveDecide(s);
      break;
    }
    case 'LEVEL_DEBRIEF': {
      // Drop unchecked claims that never met their decision.
      for (const m of s.messages) if (m.level === s.levelIndex && !m.resolved) m.resolved = true;
      const result = d.debrief(s) as Record<string, unknown>;
      if (s.levelIndex === 4 && !s.cf && !s.config.skipCounterfactual) result.counterfactual = level4Counterfactual(s);
      s.levelResults[s.levelIndex] = result;
      break;
    }
    default:
      break;
  }
}

function resolveDecide(s: GameState): void {
  const d = def(s);
  const step = s.phase.step!;
  const decisions = { ...s.pending };
  d.resolve(s, step, decisions);
  // Reliability (Section 6.3).
  for (const m of s.messages) {
    if (m.level !== s.levelIndex || m.resolved || m.checkStep !== step) continue;
    if (!(m.from in decisions)) continue;
    if (m.msg.type !== 'SUPPORT' && m.msg.type !== 'PROMISE') {
      m.resolved = true;
      continue;
    }
    m.resolved = true;
    m.kept = d.messageKept(s, step, m.msg, decisions[m.from]);
    s.reliability[m.from].made++;
    if (m.kept) s.reliability[m.from].kept++;
  }
  if (d.observable.includes(step) && !s.cf?.fast) updateFromDecisions(s, d, step, decisions);
  advance(s);
}

function advance(s: GameState): void {
  const cur = s.phase.kind;
  if (cur === 'VALUES_REVEAL') {
    startLevel(s, s.levelIndex);
    return;
  }
  if (cur === 'LEVEL_DEBRIEF') {
    if (s.mode === 'FULL_RUN' && s.levelIndex < 5) {
      startLevel(s, (s.levelIndex + 1) as LevelId);
      return;
    }
    if (s.mode === 'FULL_RUN') {
      const hasHuman = s.players.some((p) => p.isHuman);
      if (hasHuman) {
        s.phaseQueue = [{ kind: 'GUESS', round: 0 }, { kind: 'RUN_DEBRIEF', round: 0 }, { kind: 'END', round: 0 }];
        s.phaseIdx = 0;
        enterPhase(s);
      } else {
        applyGuesses(s, {});
        s.phaseQueue = [{ kind: 'RUN_DEBRIEF', round: 0 }, { kind: 'END', round: 0 }];
        s.phaseIdx = 0;
        enterPhase(s);
      }
      return;
    }
    s.phaseQueue = [{ kind: 'END', round: 0 }];
    s.phaseIdx = 0;
    enterPhase(s);
    return;
  }
  if (s.phaseIdx + 1 < s.phaseQueue.length) {
    s.phaseIdx++;
    enterPhase(s);
  }
}

function sendMessage(s: GameState, from: PlayerId, msg: StructuredMessage): boolean {
  if (s.phase.kind !== 'TALK') return false;
  const sent = s.talkSent[from] ?? 0;
  if (sent >= TALK.MAX_MESSAGES) return false;
  const d = def(s);
  if (!messageAllowed(d.talkMenu(s, s.phase), msg, s, from)) return false;
  s.talkSent[from] = sent + 1;
  const m = {
    id: s.nextMessageId++,
    from,
    msg,
    level: s.levelIndex,
    round: s.round,
    variant: flavorIndex(s.seed, `msg-${s.nextMessageId}`, 997),
    checkStep: d.checkStep(s, s.phase, msg),
  };
  s.messages.push(m);
  updateFromMessage(s, m);
  return true;
}

function applyGuesses(s: GameState, human: Record<PlayerId, ValuesCard>): void {
  const bots: Record<PlayerId, Record<PlayerId, ValuesCard>> = {};
  for (const p of s.players) {
    if (p.isHuman) continue;
    bots[p.id] = {};
    for (const [target, b] of Object.entries(s.botBeliefs[p.id])) {
      const g = argmaxCard(b);
      bots[p.id][target] = g;
      if (playerOf(s, target).values === g) s.scores[p.id].guessBonus += SCORE.GUESS_BONUS;
    }
  }
  const humanP = s.players.find((p) => p.isHuman);
  if (humanP) {
    for (const [target, g] of Object.entries(human)) {
      if (target === humanP.id) continue;
      if (playerOf(s, target)?.values === g) s.scores[humanP.id].guessBonus += SCORE.GUESS_BONUS;
    }
  }
  s.guesses = { human, bots };
}

/** Mutating step. Returns false if the action was invalid in the current state. */
export function step(s: GameState, action: Action): boolean {
  switch (action.type) {
    case 'START_RUN':
      return false;
    case 'ADVANCE': {
      const k = s.phase.kind;
      if (k === 'DECIDE' || k === 'GUESS' || k === 'END') return false;
      if (k === 'RUN_DEBRIEF') {
        s.phaseIdx++;
        enterPhase(s);
        return true;
      }
      advance(s);
      return true;
    }
    case 'SEND_MESSAGE': {
      if (!playerOf(s, action.from)?.isHuman) return false;
      return sendMessage(s, action.from, action.msg);
    }
    case 'SUBMIT_DECISION': {
      if (s.phase.kind !== 'DECIDE') return false;
      const d = def(s);
      const stepId = s.phase.step!;
      if (!d.deciders(s, stepId).includes(action.from)) return false;
      if (action.from in s.pending) return false;
      const v = d.validate(s, stepId, action.from, action.decision);
      if (v === null) return false;
      s.pending[action.from] = v;
      if (d.deciders(s, stepId).every((pid) => pid in s.pending)) resolveDecide(s);
      return true;
    }
    case 'SUBMIT_GUESSES': {
      if (s.phase.kind !== 'GUESS') return false;
      applyGuesses(s, action.guesses);
      s.phaseIdx++;
      enterPhase(s);
      return true;
    }
  }
}

/** Pure reducer. Invalid actions return the same state object. */
export function reduce(state: GameState, action: Action): GameState {
  if (action.type === 'START_RUN') {
    const s = createInitialState(action.config);
    s.log.push({ action });
    return s;
  }
  const s = structuredClone(state);
  if (!step(s, action)) return state;
  s.log.push({ action });
  return s;
}

/** Replay a log from scratch. */
export function replay(log: GameState['log']): GameState {
  let s: GameState | null = null;
  for (const { action } of log) {
    if (action.type === 'START_RUN') s = reduce(null as unknown as GameState, action);
    else if (s) s = reduce(s, action);
  }
  if (!s) throw new Error('empty log');
  return s;
}

export function waitingOn(s: GameState): PlayerId[] {
  if (s.phase.kind === 'DECIDE') return def(s).deciders(s, s.phase.step!).filter((p) => !(p in s.pending));
  return [];
}

export function totalScore(s: GameState, pid: PlayerId): number {
  const sc = s.scores[pid];
  return sc.byLevel.reduce((a, b) => a + b, 0) + sc.guessBonus;
}

/** The only thing the UI renders. Hides private information (Section 9.3). */
export function visibleState(s: GameState, viewer: PlayerId): ViewState {
  const revealPrivate = isRevealPrivate(s.phase);
  const revealValues =
    s.phase.kind === 'RUN_DEBRIEF' ||
    s.phase.kind === 'END' && s.mode === 'FULL_RUN' ||
    (s.mode === 'SINGLE_LEVEL' && (s.phase.kind === 'LEVEL_DEBRIEF' || s.phase.kind === 'END'));
  const level = s.phase.kind === 'VALUES_REVEAL' ? null : LEVELS[s.levelIndex];
  const scoresVisible = revealPrivate;
  const history = s.history.map((r) => {
    if (revealValues) return r;
    const M: Record<string, number> = {};
    const S: Record<string, number> = {};
    if (viewer in r.M) {
      M[viewer] = r.M[viewer];
      S[viewer] = r.S[viewer];
    }
    if (scoresVisible) Object.assign(S, r.S);
    return { ...r, M, S };
  });
  const scores: GameState['scores'] = {};
  for (const p of s.players) {
    if (p.id === viewer || scoresVisible || revealValues) scores[p.id] = structuredClone(s.scores[p.id]);
  }
  const human = s.players.find((p) => p.id === viewer);
  return {
    viewer,
    seed: s.seed,
    mode: s.mode,
    difficulty: s.difficulty,
    players: s.players.map((p) => {
      const mine = p.id === viewer;
      return {
        id: p.id,
        name: p.name,
        isHuman: p.isHuman,
        publicInfo: structuredClone(p.publicInfo),
        botKey: p.botProfile?.key,
        values: mine || revealValues ? p.values : undefined,
        privateInfo: mine || revealPrivate ? structuredClone(p.privateInfo) : undefined,
      };
    }),
    levelIndex: s.levelIndex,
    round: s.round,
    phase: s.phase,
    phaseIdx: s.phaseIdx,
    waitingOn: waitingOn(s),
    hasSubmitted: viewer in s.pending,
    talkSent: s.talkSent[viewer] ?? 0,
    levelView: level ? structuredClone(level.view(s, viewer, revealPrivate)) : null,
    levelResults: revealPrivate ? structuredClone(s.levelResults) : pickPublicResults(s),
    history,
    messages: structuredClone(s.messages),
    scores,
    reliability: revealPrivate ? structuredClone(s.reliability) : undefined,
    botBeliefs:
      (s.phase.kind === 'RUN_DEBRIEF' || s.phase.kind === 'END') && human
        ? Object.fromEntries(Object.entries(s.botBeliefs).map(([b, m]) => [b, structuredClone(m[viewer])]))
        : undefined,
    guesses: s.phase.kind === 'RUN_DEBRIEF' || s.phase.kind === 'END' ? structuredClone(s.guesses) : undefined,
    revealAll: revealValues,
  };
}

function pickPublicResults(s: GameState): ViewState['levelResults'] {
  // Debriefs of finished levels contain only information that the debrief already revealed.
  const out: ViewState['levelResults'] = {};
  for (const [k, v] of Object.entries(s.levelResults)) if (Number(k) !== s.levelIndex) out[Number(k) as LevelId] = structuredClone(v);
  return out;
}

export function phaseLabel(p: Phase): string {
  return p.step ? `${p.kind}:${p.step}` : p.kind;
}

export { ids, botRng };
