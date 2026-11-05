// G2: how differently bots with each mission decide. For each episode, plays bot-only games and reports,
// per mission, the share of decisions with a feature that mission should care about (redistributive vote,
// high tax, buy cover, give, give to the poorest, vote for the mandate, train, donate, yes on a tax rise).
// Usage: npx tsx sim/missions.ts --games 100 [--episodes 1,2,3,4,5] [--out file.json]
// Bots only (a proxy, not human evidence).
import { writeFileSync } from 'node:fs';
import { createInitialState, step } from '../src/engine/engine';
import { LEVELS } from '../src/engine/levels';
import type { GameState, LevelId, ValuesCard } from '../src/engine/types';

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const games = Number(arg('games', '100'));
const episodes = arg('episodes', '1,2,3,4,5').split(',').map(Number) as LevelId[];
const out = arg('out', '');
const CARDS: ValuesCard[] = ['EGOIST', 'RAWLSIAN', 'UTILITARIAN', 'MERITOCRAT'];

type Tally = Record<string, Record<ValuesCard, { n: number; k: number }>>;
const add = (t: Tally, f: string, card: ValuesCard, hit: boolean) => {
  t[f] ??= Object.fromEntries(CARDS.map((c) => [c, { n: 0, k: 0 }])) as Record<ValuesCard, { n: number; k: number }>;
  t[f][card].n++;
  if (hit) t[f][card].k++;
};

function poorest(g: GameState, except: string): string {
  return g.players.filter((p) => p.id !== except).sort((a, b) => g.play!.banks[a.id] - g.play!.banks[b.id])[0].id;
}

function features(g: GameState, pid: string, st: string, x: unknown, t: Tally): void {
  const card = g.players.find((p) => p.id === pid)!.values;
  const o = (x ?? {}) as Record<string, unknown>;
  const gift = o.gift as { to: string; amount: number } | null | undefined;
  if (['VOTE', 'EFFORT', 'CHOICE', 'TRAIN', 'HIRE'].includes(st)) {
    add(t, `${st} give`, card, !!gift);
    if (gift) add(t, `${st} give goes to the poorest`, card, gift.to === poorest(g, pid));
  }
  if (st === 'VOTE') for (const r of ['P1', 'P2', 'P3', 'P4']) add(t, `VOTE ${{ P1: 'Free Market', P2: 'Safety Net', P3: 'Middle Way (Limit the Gap)', P4: 'Help the Poorest' }[r]}`, card, o.vote === r);
  if (st === 'TAX') add(t, 'TAX vote 40% or more', card, Number(x) >= 0.4 - 1e-9);
  if (st === 'EFFORT') add(t, 'EFFORT 7 hours or more', card, Number(o.effort) >= 7);
  if (st === 'CHOICE') {
    add(t, 'CHOICE buy cover', card, !!o.buy);
    add(t, 'CHOICE bar someone', card, !!o.bar);
  }
  if (st === 'REGIME') add(t, 'REGIME vote for the mandate', card, x !== 'VOL');
  if (st === 'TRAIN') add(t, 'TRAIN train', card, !!o.train);
  if (st === 'POLICY') add(t, 'POLICY Cheaper Childcare or quota', card, x === 'C' || x === 'D');
  if (st === 'VEIL') add(t, 'VEIL tax 40% or more', card, Number(o.t) >= 0.4 - 1e-9);
  if (st === 'LOBBY') add(t, 'LOBBY donate', card, !!o.donateTo && Number(o.amount) > 0);
  if (st.startsWith('AMEND_')) {
    const l = g.levelState as { order?: string[]; lobby?: Record<string, { proposal?: { t: number } }>; current?: { t: number } };
    const k = Number(st.slice(6));
    const prop = l.lobby?.[l.order?.[k] ?? '']?.proposal;
    if (prop && l.current) {
      if (prop.t > l.current.t + 1e-9) add(t, 'AMEND yes on a tax rise', card, x === true);
      if (prop.t < l.current.t - 1e-9) add(t, 'AMEND yes on a tax cut', card, x === true);
    }
  }
}

const report: Record<string, unknown> = {};
for (const level of episodes) {
  const t: Tally = {};
  const d = LEVELS[level];
  const orig = d.botDecide;
  d.botDecide = (g, pid, st) => {
    const a = orig(g, pid, st);
    features(g, pid, st, a, t);
    return a;
  };
  try {
    for (let k = 0; k < games; k++) {
      const s = createInitialState({ mode: 'EPISODE', level, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: `missions-${level}-${k}`, allBots: true } as Parameters<typeof createInitialState>[0]);
      let guard = 0;
      while (s.phase.kind !== 'END' && guard++ < 20000) step(s, { type: 'ADVANCE' });
    }
  } finally {
    d.botDecide = orig;
  }
  const rows: Record<string, Record<string, string>> = {};
  console.log(`\nEpisode ${level} (${games} games, share of decisions, per mission)`);
  for (const [f, m] of Object.entries(t)) {
    const r = Object.fromEntries(CARDS.map((c) => [c, m[c].n ? (100 * m[c].k) / m[c].n : NaN]));
    const vals = Object.values(r).filter((x) => !Number.isNaN(x));
    const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
    rows[f] = Object.fromEntries([...CARDS.map((c) => [c, `${r[c].toFixed(1)}% (n=${m[c].n})`]), ['spread', `${spread.toFixed(1)} points`]]);
    console.log(`  ${f}: ${CARDS.map((c) => `${c[0]} ${r[c].toFixed(1)}%`).join(', ')}  spread ${spread.toFixed(1)}`);
  }
  report[`ep${level}`] = rows;
}
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
