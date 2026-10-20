// Level 4 counterfactual decomposition: re-run the level with altered parameters (Section 4, Level 4).
// Every replay holds HireBot's rule at No Change (D-79), so a different referendum result cannot leak
// into the belief or childcare channels. The scenarios of a replay start from the same random streams.
// The game's draws (childcare odds, training costs, test results, tie-breaks) stay aligned across them;
// the bots' draws only partly, because a bot draws for its schedule only when it holds a good job, and job
// assignments differ between scenarios (in the review's check, 74 of 270 scenario pairs kept identical
// bot draws; D-90). That adds noise to the paired differences, not bias. The average column reports the
// standard error of the paired per-replay differences.
import { L4 } from './params';
import { initBeliefs } from './core';
import { mean } from './scoring';
import { initRng } from './rng';
import { _startLevel, step, waitingOn } from './engine';
import { bestSchedule, groupGap, investGain, type CfScenario, type Decomposition, type L4Debrief, type L4State, type Schedule } from './levels/level4';
import type { GameState, PlayerId, RngState } from './types';

type Cf = NonNullable<GameState['cf']>;

/** Standard error of a mean (sample SD / sqrt(n)); 0 for fewer than two values. */
export function stdErr(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1) / xs.length);
}

const SCENARIOS: Array<{ key: CfScenario['key']; cf: Cf }> = [
  { key: 'BASELINE', cf: {} },
  { key: 'EQUAL_PRIORS', cf: { priorCircle: L4.CF_EQUAL_PRIOR, priorSquare: L4.CF_EQUAL_PRIOR } },
  { key: 'EQUAL_CARE', cf: { careCircle: L4.CF_EQUAL_CARE, careSquare: L4.CF_EQUAL_CARE } },
  {
    key: 'BOTH',
    cf: {
      priorCircle: L4.CF_EQUAL_PRIOR,
      priorSquare: L4.CF_EQUAL_PRIOR,
      careCircle: L4.CF_EQUAL_CARE,
      careSquare: L4.CF_EQUAL_CARE,
    },
  },
];

type Plan = { invest: boolean[]; schedule: Array<Schedule | null>; policy?: string } | null;
/** Each human's logged decisions, by seat (D-24: every human's choices are replayed where they still apply). */
type Plans = Record<PlayerId, Plan>;

function sandbox(base: GameState, cf: Cf, rng: RngState, botSamples: number): GameState {
  const s: GameState = structuredClone({
    ...base,
    history: [],
    messages: [],
    levelResults: {},
    levelsPlayed: [],
    log: [],
    levelState: null,
    guesses: undefined,
  });
  s.cf = cf;
  s.rng = { ...rng };
  s.botSamples = botSamples;
  s.mode = 'SINGLE_LEVEL';
  for (const p of s.players) {
    s.scores[p.id] = { byLevel: [0, 0, 0, 0, 0], points: [0, 0, 0, 0, 0], guessBonus: 0 };
    s.reliability[p.id] = { made: 0, kept: 0 };
  }
  initBeliefs(s);
  _startLevel(s, 4);
  return s;
}

function humanDecision(s: GameState, pid: PlayerId, stepId: string, plan: Plan): unknown {
  const l = s.levelState as L4State;
  const r = s.round - 1;
  if (stepId === 'INVEST') {
    if (plan && plan.invest[r] !== undefined) return plan.invest[r];
    const prior = l.policy === 'B' && l.priors.POOL !== null ? l.priors.POOL : l.priors[l.groups[pid]];
    return investGain(prior, l.care[pid], l.policy, l.costs[pid]) > 0;
  }
  if (stepId === 'SCHEDULE') return plan?.schedule[r] ?? bestSchedule(l.care[pid], l.policy);
  if (stepId === 'POLICY') return plan?.policy ?? 'A';
  return null;
}

function run(base: GameState, cf: Cf, rng: RngState, botSamples: number, plans: Plans, fast: boolean) {
  const s = sandbox(base, { ...cf, fast, fixedPolicy: 'A' }, rng, botSamples);
  let guard = 0;
  while (s.phase.kind !== 'LEVEL_DEBRIEF' && guard++ < 1000) {
    if (s.phase.kind === 'DECIDE') {
      const w = waitingOn(s);
      if (!w.length) break;
      for (const pid of w) step(s, { type: 'SUBMIT_DECISION', from: pid, decision: humanDecision(s, pid, s.phase.step!, plans[pid] ?? null) });
    } else step(s, { type: 'ADVANCE' });
  }
  const l = s.levelState as L4State;
  const gaps = l.rounds.map((r) => groupGap(r.W, l.groups).gap);
  return { gap: mean(gaps), roundGaps: gaps, piSquare: [l.rounds[0]?.priorsBefore.SQUARE ?? 0, ...l.rounds.map((r) => r.priorsAfter.SQUARE)] };
}

function decompose(g: Record<CfScenario['key'], number>): Decomposition {
  const stereotype = g.BASELINE - g.EQUAL_PRIORS;
  const care = g.BASELINE - g.EQUAL_CARE;
  const total = g.BASELINE - g.BOTH;
  return { stereotype, care, interaction: total - stereotype - care, total };
}

export function level4Counterfactual(s: GameState): NonNullable<L4Debrief['counterfactual']> {
  const l = s.levelState as L4State;
  const plans: Plans = {};
  for (const h of s.players.filter((p) => p.isHuman)) {
    plans[h.id] = {
      invest: l.rounds.map((r) => r.invest[h.id]),
      schedule: l.rounds.map((r) => r.schedule[h.id]),
      policy: l.policyVotes?.[h.id],
    };
  }
  const same = SCENARIOS.map((sc) => ({ key: sc.key, ...run(s, sc.cf, l.startRng, s.botSamples, plans, false) }));
  const sameGaps = Object.fromEntries(same.map((x) => [x.key, x.gap])) as Record<CfScenario['key'], number>;
  // Each replay k runs all four scenarios on the same fresh streams; its decomposition is a paired difference.
  const perReplay: Array<Record<CfScenario['key'], number>> = [];
  for (let k = 0; k < L4.CF_REPLAYS; k++) {
    const rng = initRng(`${s.seed}|cf|${k}`);
    perReplay.push(Object.fromEntries(SCENARIOS.map((sc) => [sc.key, run(s, sc.cf, rng, L4.CF_BOT_SAMPLES, {}, true).gap])) as Record<CfScenario['key'], number>);
  }
  const parts: Array<keyof Decomposition> = ['stereotype', 'care', 'interaction', 'total'];
  const decs = perReplay.map(decompose);
  const avg = Object.fromEntries(parts.map((p) => [p, mean(decs.map((d) => d[p]))])) as unknown as Decomposition;
  const se = Object.fromEntries(parts.map((p) => [p, stdErr(decs.map((d) => d[p]))])) as unknown as Decomposition;
  return {
    scenarios: same.map((x) => ({
      key: x.key,
      gap: x.gap,
      roundGaps: x.roundGaps,
      avgGap: mean(perReplay.map((g) => g[x.key])),
      avgGapSe: stdErr(perReplay.map((g) => g[x.key])),
      piSquare: x.piSquare,
    })),
    policy: 'A',
    sameSeed: decompose(sameGaps),
    average: { ...avg, replays: L4.CF_REPLAYS, se },
  };
}
