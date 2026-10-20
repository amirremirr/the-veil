// Records the golden Study replay fixture (Play mode spec, Section 0.2). Run once, before any Play-mode
// work, on the Study engine as merged in main (a73559d):  npx tsx tests/engine/golden/record.ts
// The fixture holds fixed seeds, their full action logs and the final-state hashes. The test
// (golden.test.ts) replays every log and requires identical hashes. Never re-record to make it pass.
import { writeFileSync } from 'node:fs';
import { reduce, visibleState, waitingOn, HUMAN_ID } from '../../../src/engine/engine';
import { autoDecision } from '../../../src/engine/auto';
import { LEVELS } from '../../../src/engine/levels';
import { standalone, hashString } from '../../../src/engine/rng';
import { act, newTable, screenKind, tableStep, type Table } from '../../../src/shared/flow';
import { VALUES_CARDS, type Action, type GameState, type SetupConfig, type StructuredMessage } from '../../../src/engine/types';
import { sha, stateHash, type GoldenGame } from './hash';

type Rng = ReturnType<typeof standalone>;

/** A scripted human: the bots' own evaluation for its card, with varied unpaid answers. */
function decide(g: GameState, pid: string, rng: Rng): unknown {
  const step = g.phase.step!;
  if (step === 'POLL') return rng.int(101);
  if (step === 'BONUS') return rng.int(101);
  return autoDecision(g, pid);
}

/** A message from this phase's menu, or null. */
function message(g: GameState, pid: string, rng: Rng): StructuredMessage | null {
  const menu = LEVELS[g.levelIndex].talkMenu(g, g.phase);
  const others = g.players.filter((p) => p.id !== pid);
  const opts: StructuredMessage[] = [
    ...menu.support.map((option) => ({ type: 'SUPPORT' as const, option })),
    ...menu.oppose.map((option) => ({ type: 'OPPOSE' as const, option })),
    ...menu.promise.map((action) => ({ type: 'PROMISE' as const, action })),
    { type: 'CLAIM_VALUES', card: rng.pick(VALUES_CARDS) },
    { type: 'ACCUSE', target: rng.pick(others).id, card: rng.pick(VALUES_CARDS) },
    { type: 'FLAVOR' },
  ];
  return rng.next() < 0.6 ? rng.pick(opts) : null;
}

function guesses(g: GameState, pid: string, rng: Rng) {
  return Object.fromEntries(g.players.filter((p) => p.id !== pid && rng.next() < 0.7).map((p) => [p.id, rng.pick(VALUES_CARDS)]));
}

/** Solo play straight through the reducer, as the simulator and older tests do. */
function playReducer(config: SetupConfig): GameState {
  const rng = standalone(hashString(`golden|${config.seed}`));
  let g = reduce(null as unknown as GameState, { type: 'START_RUN', config });
  for (let i = 0; i < 20000 && g.phase.kind !== 'END'; i++) {
    let a: Action = { type: 'ADVANCE' };
    if (g.phase.kind === 'TALK' && (g.talkSent[HUMAN_ID] ?? 0) < 2) {
      const m = message(g, HUMAN_ID, rng);
      if (m) {
        const n = reduce(g, { type: 'SEND_MESSAGE', from: HUMAN_ID, msg: m });
        if (n !== g) {
          g = n;
          continue;
        }
      }
    }
    if (g.phase.kind === 'DECIDE') a = { type: 'SUBMIT_DECISION', from: HUMAN_ID, decision: decide(g, HUMAN_ID, rng) };
    if (g.phase.kind === 'GUESS') a = { type: 'SUBMIT_GUESSES', from: HUMAN_ID, guesses: guesses(g, HUMAN_ID, rng) };
    const n = reduce(g, a);
    if (n === g) throw new Error(`stuck at ${g.phase.kind}:${g.phase.step}`);
    g = n;
  }
  return g;
}

/** Solo play through the shared screen flow, as the UI does (one tap per screen). */
function playFlow(config: SetupConfig): GameState {
  const rng = standalone(hashString(`golden-flow|${config.seed}`));
  let g = reduce(null as unknown as GameState, { type: 'START_RUN', config });
  g = act(g, HUMAN_ID); // values card
  for (let i = 0; i < 5000 && g.phase.kind !== 'END'; i++) {
    const k = screenKind(g);
    if (k === 'predecision') {
      if (g.phase.kind === 'TALK' && rng.next() < 0.5) {
        const m = message(g, HUMAN_ID, rng);
        if (m) g = reduce(g, { type: 'SEND_MESSAGE', from: HUMAN_ID, msg: m });
      }
      // Peek at the decision screen to compute the decision the human makes there.
      const peek = reduce(g, { type: 'ADVANCE' });
      const d = peek.phase.kind === 'DECIDE' && waitingOn(peek).includes(HUMAN_ID) ? decide(peek, HUMAN_ID, rng) : undefined;
      g = act(g, HUMAN_ID, d);
    } else if (k === 'decision') g = act(g, HUMAN_ID, decide(g, HUMAN_ID, rng));
    else if (k === 'guess') g = act(g, HUMAN_ID, undefined, guesses(g, HUMAN_ID, rng));
    else g = act(g, HUMAN_ID);
  }
  if (g.phase.kind !== 'END') throw new Error('flow game did not finish');
  return g;
}

/** Several humans at one table through the room server's Table, with timeouts and auto decisions. */
function playTable(config: SetupConfig): GameState {
  const rng = standalone(hashString(`golden-table|${config.seed}`));
  const humans = config.humans!.map((h) => h.id);
  let t: Table = newTable(reduce(null as unknown as GameState, { type: 'START_RUN', config }));
  const step = (a: Parameters<typeof tableStep>[1]) => {
    const n = tableStep(t, a, humans);
    if (n) t = n;
    return !!n;
  };
  for (let i = 0; i < 20000 && t.game.phase.kind !== 'END'; i++) {
    const g = t.game;
    const k = screenKind(g);
    if (k === 'info') {
      if (rng.next() < 0.1) step({ type: 'TIMEOUT' });
      else for (const h of humans) step({ type: 'READY', from: h });
      continue;
    }
    if (k === 'predecision') {
      if (g.phase.kind === 'TALK') for (const h of humans) {
        const m = message(g, h, rng);
        if (m) step({ type: 'SEND_MESSAGE', from: h, msg: m });
      }
      const peek = reduce(t.game, { type: 'ADVANCE' });
      for (const h of humans) {
        if (t.game !== g && screenKind(t.game) !== 'predecision') break;
        const r = rng.next();
        if (r < 0.15) step({ type: 'AUTO', from: h });
        else if (r < 0.25) continue; // left for the timeout
        else if (peek.phase.kind === 'DECIDE' && waitingOn(peek).includes(h)) step({ type: 'DECIDE', from: h, decision: decide(peek, h, rng) });
      }
      if (t.game === g || screenKind(t.game) === 'predecision') step({ type: 'TIMEOUT' });
      continue;
    }
    if (k === 'decision') {
      for (const h of waitingOn(g).filter((id) => humans.includes(id))) {
        if (rng.next() < 0.2) continue;
        step({ type: 'DECIDE', from: h, decision: decide(t.game, h, rng) });
      }
      if (t.game === g) step({ type: 'TIMEOUT' });
      continue;
    }
    if (k === 'guess') {
      for (const h of waitingOn(g)) if (rng.next() < 0.8) step({ type: 'GUESSES', from: h, guesses: guesses(g, h, rng) });
      if (t.game === g) step({ type: 'TIMEOUT' });
      continue;
    }
  }
  if (t.game.phase.kind !== 'END') throw new Error('table game did not finish');
  return t.game;
}

const base = { difficulty: 'NORMAL' as const, botSamples: 40 };
const games: Array<{ name: string; play: (c: SetupConfig) => GameState; config: SetupConfig }> = [
  { name: 'full-4p-normal-a', play: playReducer, config: { ...base, mode: 'FULL_RUN', nPlayers: 4, seed: 'golden-a' } },
  { name: 'full-4p-normal-b', play: playReducer, config: { ...base, mode: 'FULL_RUN', nPlayers: 4, seed: 'golden-b' } },
  { name: 'full-3p-easy', play: playReducer, config: { ...base, mode: 'FULL_RUN', nPlayers: 3, difficulty: 'EASY', seed: 'golden-c' } },
  { name: 'full-2p-hard', play: playReducer, config: { ...base, mode: 'FULL_RUN', nPlayers: 2, difficulty: 'HARD', seed: 'golden-d' } },
  { name: 'full-4p-flow', play: playFlow, config: { ...base, mode: 'FULL_RUN', nPlayers: 4, seed: 'golden-e', humanName: 'Ana' } },
  ...([1, 2, 3, 4, 5] as const).map((level) => ({
    name: `single-L${level}-4p`,
    play: playReducer,
    config: { ...base, mode: 'SINGLE_LEVEL' as const, level, nPlayers: 4 as const, seed: `golden-single-${level}` },
  })),
  ...([1, 2, 3, 4, 5] as const).map((level) => ({
    name: `single-L${level}-3p-flow`,
    play: playFlow,
    config: { ...base, mode: 'SINGLE_LEVEL' as const, level, nPlayers: 3 as const, seed: `golden-single-flow-${level}` },
  })),
  {
    name: 'table-3-humans-full',
    play: playTable,
    config: { ...base, mode: 'FULL_RUN', nPlayers: 4, seed: 'golden-table-a', humans: [{ id: 'h1', name: 'Ana' }, { id: 'h2', name: 'Bo' }, { id: 'h3', name: 'Cy' }] },
  },
  {
    name: 'table-2-humans-L3',
    play: playTable,
    config: { ...base, mode: 'SINGLE_LEVEL', level: 3, nPlayers: 4, seed: 'golden-table-b', humans: [{ id: 'h1', name: 'Ana' }, { id: 'h2', name: 'Bo' }] },
  },
  { name: 'bots-only-full', play: playReducer, config: { ...base, mode: 'FULL_RUN', nPlayers: 4, seed: 'golden-bots', allBots: true } },
];

const out: GoldenGame[] = [];
for (const { name, play, config } of games) {
  const t0 = Date.now();
  const g = play(config);
  const viewers = g.players.filter((p) => p.isHuman).map((p) => p.id);
  out.push({
    name,
    viewers,
    log: g.log,
    stateHash: stateHash(g),
    viewHashes: Object.fromEntries(viewers.map((v) => [v, sha(visibleState(g, v))])),
  });
  console.log(`${name}: ${g.log.length} actions, ${Date.now() - t0} ms`);
}
writeFileSync(new URL('./study-golden.json', import.meta.url), JSON.stringify({ recordedOn: 'main a73559d, rules 262e9b5b2934d866', games: out }));
