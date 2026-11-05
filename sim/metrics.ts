// Per-episode statistics for sim/episodes.ts. Each metric is a ratio of sums over games: finish() returns
// [numerator, denominator] per key for one game. Gating metrics are the mechanism checks (E1 to E5);
// everything else is reported (RUNPLAN B.4, v2 Section 8.2).
import { PLAY } from '../src/engine/play/params';
import type { GameState } from '../src/engine/types';
import type { P4Round, P4State } from '../src/engine/play/ep4';
import { p2Params, readEffort } from '../src/engine/play/ep2';
import { playScore } from '../src/engine/play/rules';

export interface Metric {
  key: string;
  label: string;
  min?: number;
  max?: number;
  gate?: boolean;
  pct?: boolean;
}

export interface EpisodeMetrics {
  metrics: Metric[];
  watch?: (s: GameState) => void;
  finish: (s: GameState) => Record<string, [number, number]>;
}

const b = (x: boolean): [number, number] => [x ? 1 : 0, 1];

/** Shared fun targets: some contestant in debt (F-f), a big moment (F-d), bot lies where lying pays (S-a). */
function common(s: GameState, level: number, extraMoment: boolean): Record<string, [number, number]> {
  const pl = s.play!;
  const hist = pl.bankHistory.filter((h) => h.level === level);
  const anyDebt = hist.some((h) => Object.values(h.banks).some((x) => x < 0));
  const swing = hist.some((h) => {
    const ws = Object.values(h.W).sort((a, c) => a - c);
    const med = (ws[Math.floor((ws.length - 1) / 2)] + ws[Math.ceil((ws.length - 1) / 2)]) / 2;
    return ws.some((w) => Math.abs(w - med) >= 80);
  });
  const event = pl.events.some((e) => e.level === level && e.id !== 'QUIET');
  const chances = pl.claimLog.filter((c) => c.level === level && c.lieGain !== null && c.lieGain > 1e-9);
  return {
    ff: b(anyDebt),
    fd: b(event || swing || extraMoment),
    sa: [chances.filter((c) => c.lied).length, chances.length],
  };
}

const COMMON: Metric[] = [
  { key: 'sa', label: 'S-a bots lie where lying would pay', min: 0.15, max: 0.5, pct: true },
  { key: 'fd', label: 'F-d big moment (an event, an 80+ coin gap to the round median, or a lie that changed an outcome)', min: 0.9, pct: true },
  { key: 'ff', label: 'F-f some contestant goes into debt', min: 0.3, max: 0.7, pct: true },
];

function ep4(): EpisodeMetrics {
  return {
    metrics: [
      { key: 'e4a', label: 'E4a Circle minus Square gap positive (bot judges)', min: 0.7, gate: true, pct: true },
      { key: 'e4b', label: 'E4b passing Squares hired complex in round 1 without Hiring Spree ("rarely": at most 10%)', max: 0.1, gate: true, pct: true },
      { key: 'e4bAll', label: 'E4b with Hiring Spree rounds included', pct: true },
      { key: 'gap', label: 'Mean gap, Circle minus Square worker pay (coins per worker-round)' },
      { key: 'lie', label: 'Lie success (claimed "I trained" untrained, and hired complex)', min: 0.3, max: 0.75, pct: true },
      { key: 'sb', label: 'S-b reader (judge read >= 0.5) judges a claim TRUE or LIE right', min: 0.55, max: 0.8, pct: true },
      { key: 'contested', label: 'Contested hires (judge read between 0.35 and 0.65)', min: 0.2, pct: true },
      { key: 'sc', label: 'S-c some hire differs from the full-information hire', min: 0.2, max: 0.5, pct: true },
      { key: 'b1', label: 'B.1 reader of training from the public action (the test result): accuracy, about 80% at most', max: 0.8, pct: true },
      { key: 'b1c', label: 'B.1 best reader using the claim too (claim, test and claim, either), R2 target at most 85%', max: 0.85, pct: true },
      { key: 'trainC', label: 'Training rate, Circles', pct: true },
      { key: 'trainS', label: 'Training rate, Squares', pct: true },
      { key: 'polB', label: 'Policy B (blind) won the vote', pct: true },
      { key: 'polC', label: 'Policy C (quota) won the vote', pct: true },
      { key: 'polD', label: 'Policy D (childcare) won the vote', pct: true },
      ...COMMON,
    ],
    finish(s) {
      const l = s.levelState as P4State;
      const rounds: P4Round[] = l.rounds;
      const g = l.groups;
      const res = s.levelResults[4] as { gap: number } | undefined;
      const gap = res?.gap ?? 0;
      const r1 = rounds[0];
      const passSq = r1.workers.filter((w) => g[w] === 'SQUARE' && r1.pass[w]);
      let lies = 0;
      let liesHired = 0;
      let claims = 0;
      let sbRight = 0;
      let reads = 0;
      let contested = 0;
      let differs = false;
      const readers = [0, 0, 0, 0];
      let workers = 0;
      const tr = { CIRCLE: [0, 0], SQUARE: [0, 0] };
      for (const r of rounds)
        for (const w of r.workers) {
          workers++;
          tr[g[w]][0] += r.train[w] ? 1 : 0;
          tr[g[w]][1]++;
          const claimed = r.claims[w] === 'TRAINED';
          if (claimed) {
            claims++;
            const lied = !r.train[w];
            if (lied) {
              lies++;
              if (r.job[w] === 'COMPLEX') liesHired++;
            }
            if ((r.reads[w] >= 0.5) === !lied) sbRight++;
          }
          reads++;
          if (r.reads[w] >= 0.35 && r.reads[w] <= 0.65) contested++;
          if ((r.job[w] === 'COMPLEX') !== r.train[w]) differs = true;
          const guesses = [r.pass[w], claimed, r.pass[w] && claimed, r.pass[w] || claimed];
          guesses.forEach((x, k) => (readers[k] += x === r.train[w] ? 1 : 0));
        }
      const c = common(s, 4, liesHired > 0);
      const spree1 = s.play!.events.some((e) => e.level === 4 && e.round === 1 && e.id === 'SPREE');
      const hiredSq = passSq.filter((w) => r1.job[w] === 'COMPLEX' && !r1.quotaPicks.includes(w)).length;
      return {
        e4a: b(gap > 0),
        e4b: spree1 ? [0, 0] : [hiredSq, passSq.length],
        e4bAll: [hiredSq, passSq.length],
        gap: [gap, 1],
        lie: [liesHired, lies],
        sb: [sbRight, claims],
        contested: [contested, reads],
        sc: b(differs),
        b1: [readers[0], workers],
        b1c: [Math.max(readers[1], readers[2], readers[3]), workers],
        trainC: [tr.CIRCLE[0], tr.CIRCLE[1]],
        trainS: [tr.SQUARE[0], tr.SQUARE[1]],
        polB: b(l.policy === 'B'),
        polC: b(l.policy === 'C'),
        polD: b(l.policy === 'D'),
        ...c,
      };
    },
  };
}

function ep1(): EpisodeMetrics {
  const DECK = [10, 40, 110, 300];
  return {
    metrics: [
      { key: 'e1', label: 'E1 bot peekers: share voting Free Market (least redistribution), top two incomes minus bottom two (must be > 0)', min: 0.0001, gate: true },
      ...DECK.map((y) => ({ key: `p1_${y}`, label: `Bot peekers with income ${y}: share voting Free Market`, pct: true })),
      { key: 'nonP1', label: 'Non-peekers in round 2: share voting Free Market', pct: true },
      { key: 'peek', label: 'Bots who peek in round 2', pct: true },
      { key: 'broken', label: 'Broken promises (claimed one rule, voted another) per claim', pct: true },
      { key: 'lie', label: 'Lie success (D-152: a broken promise whose real vote won)', min: 0.5, max: 0.75, pct: true },
      { key: 'sb', label: 'S-b reader (trusts every claim) judges a claim TRUE or LIE right', min: 0.55, max: 0.8, pct: true },
      { key: 'r1P1', label: 'Round 1 (pure veil): share voting Free Market', pct: true },
      ...COMMON,
    ],
    finish(s) {
      const rounds = (s.levelState as { rounds: Array<{ incomes: Record<string, number>; peeked: string[]; votes: Record<string, string>; claims: Record<string, string>; winner: string }> }).rounds;
      const out: Record<string, [number, number]> = {};
      const r2 = rounds[1];
      const by: Record<number, [number, number]> = Object.fromEntries(DECK.map((y) => [y, [0, 0]]));
      let nonP1: [number, number] = [0, 0];
      for (const p of s.players) {
        const y = r2.incomes[p.id];
        const p1 = r2.votes[p.id] === 'P1' ? 1 : 0;
        if (r2.peeked.includes(p.id)) {
          const k = DECK.indexOf(y) >= 0 ? y : DECK.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
          by[k][0] += p1;
          by[k][1]++;
        } else nonP1 = [nonP1[0] + p1, nonP1[1] + 1];
      }
      DECK.forEach((y) => (out[`p1_${y}`] = by[y]));
      // E1 as a per-game contribution: difference of pooled shares is computed from these sums in the report.
      out.e1hi = [by[110][0] + by[300][0], by[110][1] + by[300][1]];
      out.e1lo = [by[10][0] + by[40][0], by[10][1] + by[40][1]];
      out.nonP1 = nonP1;
      out.peek = [r2.peeked.length, s.players.length];
      let claims = 0;
      let broken = 0;
      let won = 0;
      for (const r of rounds)
        for (const p of s.players) {
          const c = r.claims[p.id];
          if (!c || c === 'SILENT') continue;
          claims++;
          if (c !== r.votes[p.id]) {
            broken++;
            if (r.votes[p.id] === r.winner) won++;
          }
        }
      out.broken = [broken, claims];
      out.lie = [won, broken];
      out.sb = [claims - broken, claims];
      const r1 = rounds[0];
      out.r1P1 = [s.players.filter((p) => r1.votes[p.id] === 'P1').length, s.players.length];
      return { ...out, ...common(s, 1, won > 0) };
    },
  };
}

function ep2(): EpisodeMetrics {
  const MID: Record<string, number> = { LITTLE: 1.5, SOME: 5, LOT: 8.5 };
  const band = (e: number) => (e <= 3 ? 'LITTLE' : e <= 6 ? 'SOME' : 'LOT');
  return {
    metrics: [
      { key: 'e2', label: 'E2 slope of mean bot effort on the tax rate, across games (must be < 0)', max: -0.0001, gate: true },
      { key: 'e2b', label: 'E2 added: mean claimed effort minus mean true effort of claimers, hours (must be > 0)', min: 0.0001, gate: true },
      { key: 'effort', label: 'Mean bot effort (hours)' },
      { key: 'tax', label: 'Mean tax rate chosen' },
      { key: 'lie', label: 'Lie success (overclaimed effort and won or shared the prize that round)', min: 0.5, max: 0.75, pct: true },
      { key: 'lies', label: 'Lies per claim', pct: true },
      { key: 'sb', label: 'S-b reader (audience belief that the claimed band is true >= 0.5) judges a claim right', min: 0.55, max: 0.8, pct: true },
      { key: 'b1', label: 'B.1 reader of the effort band from gross income alone: accuracy, about 80% at most', max: 0.8, pct: true },
      { key: 'contested', label: 'Contested reads (belief "a lot" between 0.35 and 0.65)', min: 0.2, pct: true },
      { key: 'sc', label: 'S-c the prize misses the hardest worker in some round', min: 0.2, max: 0.5, pct: true },
      ...COMMON,
    ],
    finish(s) {
      const rounds = (s.levelState as { t: number; rounds: Array<{ effort: Record<string, number>; claims: Record<string, string>; winners: string[]; beliefs: Record<string, Record<string, number[]>>; y: Record<string, number> }> }).rounds;
      const t = (s.levelState as { t: number }).t;
      const bots = s.players.filter((p) => !p.isHuman).map((p) => p.id);
      const effs = rounds.flatMap((r) => bots.map((b) => r.effort[b]));
      let claimMid = 0;
      let claimTrue = 0;
      let claims = 0;
      let lies = 0;
      let liesWon = 0;
      let sbRight = 0;
      let b1 = 0;
      let reads = 0;
      let contested = 0;
      let missed = false;
      for (const r of rounds) {
        const maxE = Math.max(...Object.values(r.effort));
        if (!r.winners.some((w) => r.effort[w] === maxE)) missed = true;
        for (const p of s.players) {
          const c = r.claims[p.id];
          const others = Object.entries(r.beliefs).filter(([o]) => o !== p.id).map(([, m]) => m[p.id]).filter(Boolean);
          const avg = [0, 1, 2].map((k) => others.reduce((a, x) => a + x[k], 0) / Math.max(1, others.length));
          if (c && c !== 'SILENT') {
            claims++;
            claimMid += MID[c];
            claimTrue += r.effort[p.id];
            const lied = band(r.effort[p.id]) !== c;
            if (lied) {
              lies++;
              if (r.winners.includes(p.id)) liesWon++;
            }
            const k = ['LITTLE', 'SOME', 'LOT'].indexOf(c);
            if ((avg[k] >= 0.5) === !lied) sbRight++;
          }
          for (const x of others) {
            reads++;
            if (x[2] >= 0.35 && x[2] <= 0.65) contested++;
          }
        }
      }
      // B.1: an income-only read (claims ignored, no cameras), by each other contestant, argmax band.
      let b1n = 0;
      const P = p2Params(s);
      for (const r of rounds)
        for (const p of s.players)
          for (const o of s.players) {
            if (o.id === p.id) continue;
            const m = readEffort(s, o.id, p.id, r.y[p.id], undefined, 0, P, null);
            b1 += ['LITTLE', 'SOME', 'LOT'][m.indexOf(Math.max(...m))] === band(r.effort[p.id]) ? 1 : 0;
            b1n++;
          }
      return {
        e2x: [t, 1],
        e2y: [effs.reduce((a, b) => a + b, 0) / Math.max(1, effs.length), 1],
        e2c: [claimMid, claims],
        e2t: [claimTrue, claims],
        effort: [effs.reduce((a, b) => a + b, 0), effs.length],
        tax: [t, 1],
        lie: [liesWon, lies],
        lies: [lies, claims],
        sb: [sbRight, claims],
        b1: [b1, b1n],
        contested: [contested, reads],
        sc: b(missed),
        ...common(s, 2, liesWon > 0),
      };
    },
  };
}

function ep5(): EpisodeMetrics {
  return {
    metrics: [
      { key: 'e5', label: 'E5 slope of the bots\' fair-answer shift on wealth rank (1 = poorest), programmed (must be < 0)', max: -0.0001, gate: true },
      { key: 'donate', label: 'Bots who donate', pct: true },
      { key: 'bought', label: 'Donations whose recipient voted yes on the donor\'s amendment', pct: true },
      { key: 'betrayed', label: '"Took your money. Voted no." per donation voted on', pct: true },
      { key: 'passed', label: 'Amendments passed per amendment voted', pct: true },
      { key: 'lies', label: 'Vote claims broken', pct: true },
      { key: 'lie', label: 'Lie success (R1: claimed yes, got a donation from that proposer, voted no) per false yes', min: 0.3, max: 0.75, pct: true },
      { key: 'took', label: '"Took your 40. Voted no." happens in a game', min: 0.2, max: 0.6, pct: true },
      { key: 'sc', label: 'S-c some donation changed a vote outcome (a passed amendment won by the recipient\'s yes)', min: 0.2, max: 0.5, pct: true },
      ...COMMON,
    ],
    finish(s) {
      const l = s.levelState as { incomes: Record<string, number>; fair1: Record<string, number>; fair2: Record<string, number>; lobby: Record<string, { donateTo: string | null; amount: number }>; amendments: Array<{ proposer: string; votes: Record<string, boolean>; claims: Record<string, string>; yes: number; need: number; passed: boolean; withdrawn?: boolean }> };
      const pids = s.players.map((p) => p.id);
      const sorted = pids.slice().sort((a, c) => l.incomes[a] - l.incomes[c]);
      const rank = pids.map((id) => sorted.indexOf(id) + 1);
      const dT = pids.map((id) => l.fair2[id] - l.fair1[id]);
      const mr = rank.reduce((a, c) => a + c, 0) / rank.length;
      const md = dT.reduce((a, c) => a + c, 0) / dT.length;
      let sxy = 0;
      let sxx = 0;
      rank.forEach((r, i) => {
        sxy += (r - mr) * (dT[i] - md);
        sxx += (r - mr) ** 2;
      });
      const slope = sxx > 0 ? sxy / sxx : 0;
      let donors = 0;
      let bought = 0;
      let betrayed = 0;
      let votedOn = 0;
      let pivotal = false;
      for (const [from, lb] of Object.entries(l.lobby ?? {})) {
        if (!lb.donateTo || lb.amount <= 0) continue;
        donors++;
        const a = l.amendments.find((x) => x.proposer === from && !x.withdrawn);
        if (!a) continue;
        votedOn++;
        if (a.votes[lb.donateTo]) {
          bought++;
          if (a.passed && a.yes === a.need) pivotal = true;
        } else betrayed++;
      }
      const voted = l.amendments.filter((a) => !a.withdrawn);
      let claims = 0;
      let broken = 0;
      for (const a of voted)
        for (const id of pids) {
          const c = a.claims[id];
          if (c === 'YES' || c === 'NO') {
            claims++;
            if ((c === 'YES') !== !!a.votes[id]) broken++;
          }
        }
      let falseYes = 0;
      let falseYesPaid = 0;
      for (const a of voted)
        for (const id of pids)
          if (a.claims[id] === 'YES' && !a.votes[id]) {
            falseYes++;
            const lb = (l.lobby ?? {})[a.proposer];
            if (lb && lb.donateTo === id && lb.amount > 0) falseYesPaid++;
          }
      return {
        lie: [falseYesPaid, falseYes],
        took: b(betrayed > 0),
        e5x: [slope, 1],
        e5: [slope, 1],
        donate: [donors, pids.length],
        bought: [bought, votedOn],
        betrayed: [betrayed, votedOn],
        passed: [voted.filter((a) => a.passed).length, voted.length],
        lies: [broken, claims],
        sc: b(pivotal),
        ...common(s, 5, betrayed > 0 || pivotal),
      };
    },
  };
}

/** R3: Episode 3's mechanism checks inside a life, from the level state (pooled ratios over lives). */
function e3(s: GameState): Record<string, [number, number]> {
  const l = s.levelState as { types: Record<string, string>; rounds: Array<{ regime: string; premium: number | null; listPrice?: number | null; nextPremium: number | null; applied?: Record<string, boolean>; choices: Record<string, { buy: boolean }>; bar?: { barred: string[] } }> };
  const r2 = l.rounds[1];
  const r3 = l.rounds[2];
  const ids = s.players.map((p) => p.id);
  const applied = (id: string) => (r2?.applied ? r2.applied[id] : r2?.choices[id]?.buy) ?? false;
  const hi = r2 ? ids.filter((id) => l.types[id] === 'HIGH' && applied(id)).length : 0;
  const lo = r2 ? ids.filter((id) => l.types[id] === 'LOW' && applied(id)).length : 0;
  const open2 = r2 && r2.regime === 'VOL' && r2.premium !== null;
  const open3 = r3 && r3.regime === 'VOL' && r3.premium !== null;
  const p2 = r2?.listPrice ?? r2?.premium ?? null;
  const p3 = r3?.listPrice ?? r3?.premium ?? null;
  const bars = l.rounds.flatMap((r) => r.bar?.barred ?? []);
  return {
    e3a: [hi, lo],
    e3b: open2 && open3 && p2 && p3 !== null ? [p3 / p2 - 1, 1] : [0, 0],
    e3c: [bars.filter((id) => l.types[id] === 'HIGH').length, bars.length],
    e3d: open2 && open3 && p2 && r3.nextPremium !== null ? [r3.nextPremium / p2 - 1, 1] : [0, 0],
  };
}

/** A whole life (T6): each episode's E checks under a prefix, plus the per-life fun targets (v1 10.2). */
function life(): EpisodeMetrics {
  const per: Record<string, [number, number]> = {};
  const seen = new Set<number>();
  const pre = (lvl: number, ks: string[]): Metric[] =>
    episodeMetrics(lvl)
      .metrics.filter((m) => ks.includes(m.key))
      .map((m) => ({ ...m, key: `L${lvl}.${m.key}`, label: `Ep${lvl} ${m.label}` }));
  return {
    metrics: [
      ...pre(1, ['e1']),
      ...pre(2, ['e2', 'e2b']),
      ...pre(4, ['e4a', 'e4b']),
      ...pre(5, ['e5']),
      { key: 'L3.e3a', label: 'Ep3 E3a round-2 high-risk / low-risk applicants, pooled (at least 2)', min: 2 },
      { key: 'L3.e3b', label: 'Ep3 E3b round-3 list price over round 2, open markets (at least +15%)', min: 0.15 },
      { key: 'L3.e3c', label: 'Ep3 E3c bars that hit a high-risk contestant (at least 60%)', min: 0.6, pct: true },
      { key: 'L3.e3d', label: 'Ep3 E3d price set by round 3 pool over round 2, open markets (above 0)', min: 0 },
      { key: 'fa', label: 'F-a lead changes per life (mean at least 2)', min: 2 },
      { key: 'fb', label: 'F-b last after Episode 2 finishes first or second', min: 0.2, pct: true },
      { key: 'fc', label: 'F-c first and second within 15% at the end', min: 0.4, pct: true },
      { key: 'fd', label: 'F-d episodes with a big moment', min: 0.9, pct: true },
      { key: 'ff', label: 'F-f someone goes into debt during the life', min: 0.3, max: 0.7, pct: true },
      { key: 'cb', label: 'Comeback card: took the coins', pct: true },
    ],
    watch(s) {
      if (s.phase.kind !== 'LEVEL_DEBRIEF' || seen.has(s.levelIndex)) return;
      seen.add(s.levelIndex);
      const m = s.levelIndex === 3 ? { ...common(s, 3, false), ...e3(s) } : episodeMetrics(s.levelIndex).finish(s);
      for (const [k, v] of Object.entries(m)) per[`L${s.levelIndex}.${k}`] = v;
    },
    finish(s) {
      const pl = s.play!;
      const out: Record<string, [number, number]> = { ...per };
      let changes = 0;
      let leader: string | null = null;
      for (const h of pl.bankHistory) {
        const top = Object.entries(h.ranks).find(([, r]) => r === 1)?.[0] ?? null;
        if (leader !== null && top !== leader) changes++;
        leader = top;
      }
      const after2 = pl.bankHistory.filter((h) => h.level === 2).slice(-1)[0];
      const worst = after2 ? Object.entries(after2.ranks).sort((a, c) => c[1] - a[1])[0][0] : null;
      const sc = s.players.map((p) => playScore(s, p.id));
      const sorted = sc.slice().sort((a, c) => c - a);
      const rankOf = (id: string) => 1 + sc.filter((x) => x > sc[s.players.findIndex((p) => p.id === id)] + 1e-9).length;
      const fd = [1, 2, 3, 4, 5].map((l) => per[`L${l}.fd`]?.[0] ?? 0);
      const debt = pl.bankHistory.some((h) => Object.values(h.banks).some((x) => x < 0));
      out.fa = [changes, 1];
      out.fb = worst ? b(rankOf(worst) <= 2) : [0, 0];
      out.fc = b(sorted[0] > 0 ? (sorted[0] - sorted[1]) / sorted[0] <= 0.15 : false);
      out.fd = [fd.reduce((a, c) => a + c, 0), 5];
      out.ff = b(debt);
      out.cb = pl.comeback ? b(pl.comeback.took === 'COINS') : [0, 0];
      return out;
    },
  };
}

export function episodeMetrics(ep: number): EpisodeMetrics {
  if (ep === 0) return life();
  if (ep === 5) return ep5();
  if (ep === 1) return ep1();
  if (ep === 2) return ep2();
  if (ep === 4) return ep4();
  return { metrics: [...COMMON], finish: (s) => common(s, s.levelIndex, false) };
}

void PLAY;
