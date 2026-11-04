// Per-episode statistics for sim/episodes.ts. Each metric is a ratio of sums over games: finish() returns
// [numerator, denominator] per key for one game. Gating metrics are the mechanism checks (E1 to E5);
// everything else is reported (RUNPLAN B.4, v2 Section 8.2).
import { PLAY } from '../src/engine/play/params';
import type { GameState } from '../src/engine/types';
import type { P4Round, P4State } from '../src/engine/play/ep4';

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
      { key: 'lie', label: 'Lie success (claimed "I trained" untrained, and hired complex)', min: 0.5, max: 0.75, pct: true },
      { key: 'sb', label: 'S-b reader (judge read >= 0.5) judges a claim TRUE or LIE right', min: 0.55, max: 0.8, pct: true },
      { key: 'contested', label: 'Contested hires (judge read between 0.35 and 0.65)', min: 0.2, pct: true },
      { key: 'sc', label: 'S-c some hire differs from the full-information hire', min: 0.2, max: 0.5, pct: true },
      { key: 'b1', label: 'B.1 reader of training from the public action (the test result): accuracy, about 80% at most', max: 0.8, pct: true },
      { key: 'b1c', label: 'B.1 best reader using the claim too (claim, test and claim, either)', max: 0.8, pct: true },
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

export function episodeMetrics(ep: number): EpisodeMetrics {
  if (ep === 4) return ep4();
  return { metrics: [...COMMON], finish: (s) => common(s, s.levelIndex, false) };
}

void PLAY;
