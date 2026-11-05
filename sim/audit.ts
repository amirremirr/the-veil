// Game-logic audit (RUNPLAN E3), bot-only: (1) how often bots pick each option of each decision; (2) one seat
// on a fixed rule against the same seat playing adaptively, same seeds (paired), mean final Play score ± SE.
//   npx tsx sim/audit.ts --games 150 --out docs/review/logic-audit-data.json
// The fixed rules patch that seat's bot decisions in this process only; the engine is unchanged.
import { writeFileSync } from 'node:fs';
import { createInitialState, step } from '../src/engine/engine';
import { LEVELS } from '../src/engine/levels';
import { playScore } from '../src/engine/play/rules';
import type { GameState, LevelId } from '../src/engine/types';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const games = Number(arg('games', '150'));
const out = arg('out', '');

type Rule = (s: GameState, pid: string, stepId: string, adaptive: unknown) => unknown;
const keep = (_s: GameState, _p: string, _st: string, a: unknown) => a;
const other = (s: GameState, pid: string) => s.players.find((p) => p.id !== pid)!.id;
const poorest = (s: GameState, pid: string) => s.players.filter((p) => p.id !== pid).sort((a, b) => s.play!.banks[a.id] - s.play!.banks[b.id])[0].id;

const RULES: Record<number, Record<string, Rule>> = {
  1: {
    'always peek': (_s, _p, st, a) => (st === 'PEEK' ? true : a),
    'never peek': (_s, _p, st, a) => (st === 'PEEK' ? false : a),
    'always silent': (_s, _p, st, a) => (st === 'CLAIM' ? 'SILENT' : a),
    'always claim Safety Net': (_s, _p, st, a) => (st === 'CLAIM' ? 'P2' : a),
    'always give 10 to the poorest': (s, p, st, a) => (st === 'VOTE' ? { ...(a as object), gift: { to: poorest(s, p), amount: 10 } } : a),
  },
  2: {
    'always claim a lot': (_s, _p, st, a) => (st === 'EFFORT' ? { ...(a as object), claim: 'LOT' } : a),
    'always silent': (_s, _p, st, a) => (st === 'EFFORT' ? { ...(a as object), claim: 'SILENT' } : a),
    'always truthful': (_s, _p, st, a) => {
      if (st !== 'EFFORT') return a;
      const e = (a as { effort: number }).effort;
      return { ...(a as object), claim: e <= 3 ? 'LITTLE' : e <= 6 ? 'SOME' : 'LOT' };
    },
    'always give 10 to the poorest': (s, p, st, a) => (st === 'EFFORT' ? { ...(a as object), gift: { to: poorest(s, p), amount: 10 } } : a),
    'never give': (_s, _p, st, a) => (st === 'EFFORT' ? { ...(a as object), gift: null } : a),
  },
  3: {
    'always buy cover': (_s, _p, st, a) => (st === 'CHOICE' ? { ...(a as object), buy: true } : a),
    'never buy cover': (_s, _p, st, a) => (st === 'CHOICE' ? { ...(a as object), buy: false } : a),
    'always claim low risk': (_s, _p, st, a) => (st === 'CLAIM' ? 'LOW' : a),
    'always silent': (_s, _p, st, a) => (st === 'CLAIM' ? 'SILENT' : a),
    'never bar': (_s, _p, st, a) => (st === 'CHOICE' ? { ...(a as object), bar: null } : a),
    'always bar someone': (s, p, st, a) => (st === 'CHOICE' ? { ...(a as object), bar: (a as { bar?: string }).bar ?? other(s, p) } : a),
    'never give': (_s, _p, st, a) => (st === 'CHOICE' ? { ...(a as object), gift: null } : a),
  },
  4: {
    'always claim I trained': (_s, _p, st, a) => (st === 'CLAIM' ? 'TRAINED' : a),
    'always silent': (_s, _p, st, a) => (st === 'CLAIM' ? 'SILENT' : a),
    'always train': (_s, _p, st, a) => (st === 'TRAIN' ? { ...(a as object), train: true } : a),
    'never train': (_s, _p, st, a) => (st === 'TRAIN' ? { ...(a as object), train: false } : a),
    'always give 10 to the poorest': (s, p, st, a) => (st === 'TRAIN' || st === 'HIRE' ? { ...(a as object), gift: { to: poorest(s, p), amount: 10 } } : a),
  },
  5: {
    'always donate the maximum': (s, p, st, a) => {
      if (st !== 'LOBBY') return a;
      const yes = s.players.filter((q) => q.id !== p && (s.levelState as { claims?: Record<string, Record<string, string>> }).claims?.[q.id]?.[p] === 'YES');
      return { donateTo: (yes[0] ?? s.players.find((q) => q.id !== p)!).id, amount: 40 };
    },
    'never donate': (_s, _p, st, a) => (st === 'LOBBY' ? { donateTo: null, amount: 0 } : a),
    'always claim yes': (_s, _p, st, a) => (st === 'CLAIM' ? Object.fromEntries(Object.keys(a as object).map((k) => [k, 'YES'])) : a),
    'always silent': (_s, p, st, a) => (st === 'CLAIM' ? Object.fromEntries(Object.keys(a as object).map((k) => [k, k === p ? 'YES' : 'SILENT'])) : a),
  },
};

function playOne(level: LevelId, seed: string, rule: Rule | null, counts?: Record<string, Record<string, number>>): number {
  const s = createInitialState({ mode: 'EPISODE', level, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed, allBots: true } as Parameters<typeof createInitialState>[0]);
  const target = s.players[0].id;
  const d = LEVELS[level];
  const orig = d.botDecide;
  d.botDecide = (g, pid, st) => {
    const a = orig(g, pid, st);
    const x = rule && pid === target ? d.validate(g, st, pid, rule(g, pid, st, a)) ?? a : a;
    if (counts) {
      counts[st] ??= {};
      const key = describe(st, x);
      counts[st][key] = (counts[st][key] ?? 0) + 1;
    }
    return x;
  };
  try {
    let guard = 0;
    while (s.phase.kind !== 'END' && guard++ < 20000) step(s, { type: 'ADVANCE' });
  } finally {
    d.botDecide = orig;
  }
  return playScore(s, target);
}

function describe(st: string, x: unknown): string {
  if (typeof x === 'string' || typeof x === 'boolean' || typeof x === 'number') return String(x);
  const o = x as Record<string, unknown>;
  if (st === 'CHOICE') return `buy=${o.buy} gym=${o.gym} bar=${o.bar ? 'yes' : 'no'} gift=${o.gift ? 'yes' : 'no'}`;
  if (st === 'TRAIN') return `train=${o.train} gift=${o.gift ? 'yes' : 'no'}`;
  if (st === 'HIRE') return `complex=${Object.values(o.hires as object).filter((j) => j === 'COMPLEX').length} gift=${o.gift ? 'yes' : 'no'}`;
  if (st === 'VOTE') return `vote=${o.vote} gift=${o.gift ? 'yes' : 'no'}`;
  if (st === 'EFFORT') return `claim=${o.claim} gift=${o.gift ? 'yes' : 'no'}`;
  if (st === 'LOBBY') return `donate=${o.donateTo ? o.amount : 0}`;
  if (st === 'FAIR_2') return `proposal=${o.proposal ? 'yes' : 'no'}`;
  if (st === 'VEIL') return `t=${o.t}`;
  if (st === 'CLAIM') return `claims=${Object.values(o).join('/')}`.slice(0, 40);
  return 'other';
}

const report: Record<string, unknown> = {};
for (const level of [1, 2, 3, 4, 5] as LevelId[]) {
  const counts: Record<string, Record<string, number>> = {};
  const base: number[] = [];
  for (let g = 0; g < games; g++) base.push(playOne(level, `audit-${level}-${g}`, null, counts));
  const rules: Record<string, { mean: number; se: number }> = {};
  for (const [name, rule] of Object.entries(RULES[level])) {
    const diff: number[] = [];
    for (let g = 0; g < games; g++) diff.push(playOne(level, `audit-${level}-${g}`, rule) - base[g]);
    const m = diff.reduce((a, b) => a + b, 0) / diff.length;
    const sd = Math.sqrt(diff.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, diff.length - 1));
    rules[name] = { mean: Number(m.toFixed(2)), se: Number((sd / Math.sqrt(diff.length)).toFixed(2)) };
    console.log(`Ep${level} ${name}: ${m >= 0 ? '+' : ''}${m.toFixed(1)} ± ${(sd / Math.sqrt(diff.length)).toFixed(1)} points vs adaptive`);
  }
  const shares: Record<string, Record<string, number>> = {};
  for (const [st, m] of Object.entries(counts)) {
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    shares[st] = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Number((v / tot).toFixed(4))]));
  }
  report[`ep${level}`] = { games, rules, shares };
}
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
void keep;
