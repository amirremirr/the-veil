// Level 4 counterfactual decomposition: re-run the level with altered parameters (Section 4, Level 4).
import { L4 } from './params';
import { initBeliefs, humanOf } from './core';
import { mean } from './scoring';
import { initRng } from './rng';
import { _startLevel, step, waitingOn } from './engine';
import { bestSchedule, groupGap, investGain, type CfScenario, type L4Debrief, type L4State, type Schedule } from './levels/level4';
import type { GameState, PlayerId, RngState } from './types';

type Cf = NonNullable<GameState['cf']>;

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
    s.scores[p.id] = { byLevel: [0, 0, 0, 0, 0], guessBonus: 0 };
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
    return investGain(prior, l.care[pid], l.policy) > l.costs[pid];
  }
  if (stepId === 'SCHEDULE') return plan?.schedule[r] ?? bestSchedule(l.care[pid], l.policy);
  if (stepId === 'POLICY') return plan?.policy ?? 'A';
  return null;
}

function run(base: GameState, cf: Cf, rng: RngState, botSamples: number, plan: Plan, fast: boolean) {
  const s = sandbox(base, { ...cf, fast }, rng, botSamples);
  let guard = 0;
  while (s.phase.kind !== 'LEVEL_DEBRIEF' && guard++ < 1000) {
    if (s.phase.kind === 'DECIDE') {
      const w = waitingOn(s);
      if (!w.length) break;
      for (const pid of w) step(s, { type: 'SUBMIT_DECISION', from: pid, decision: humanDecision(s, pid, s.phase.step!, plan) });
    } else step(s, { type: 'ADVANCE' });
  }
  const l = s.levelState as L4State;
  const gaps = l.rounds.map((r) => groupGap(r.W, l.groups).gap);
  return { gap: mean(gaps), piSquare: [l.rounds[0]?.priorsBefore.SQUARE ?? 0, ...l.rounds.map((r) => r.priorsAfter.SQUARE)] };
}

function decompose(g: Record<CfScenario['key'], number>) {
  const stereotype = g.BASELINE - g.EQUAL_PRIORS;
  const care = g.BASELINE - g.EQUAL_CARE;
  const total = g.BASELINE - g.BOTH;
  return { stereotype, care, interaction: total - stereotype - care, total };
}

export function level4Counterfactual(s: GameState): NonNullable<L4Debrief['counterfactual']> {
  const l = s.levelState as L4State;
  const h = humanOf(s);
  let plan: Plan = null;
  if (h) {
    plan = {
      invest: l.rounds.map((r) => r.invest[h.id]),
      schedule: l.rounds.map((r) => r.schedule[h.id]),
      policy: l.policyVotes?.[h.id],
    };
  }
  const same = SCENARIOS.map((sc) => ({ key: sc.key, ...run(s, sc.cf, l.startRng, s.botSamples, plan, false) }));
  const sameGaps = Object.fromEntries(same.map((x) => [x.key, x.gap])) as Record<CfScenario['key'], number>;
  const avgGaps = { BASELINE: 0, EQUAL_PRIORS: 0, EQUAL_CARE: 0, BOTH: 0 } as Record<CfScenario['key'], number>;
  for (let k = 0; k < L4.CF_REPLAYS; k++) {
    const rng = initRng(`${s.seed}|cf|${k}`);
    for (const sc of SCENARIOS) avgGaps[sc.key] += run(s, sc.cf, rng, L4.CF_BOT_SAMPLES, null, true).gap / L4.CF_REPLAYS;
  }
  return {
    scenarios: same.map((x) => ({ key: x.key, gap: x.gap, avgGap: avgGaps[x.key], piSquare: x.piSquare })),
    sameSeed: decompose(sameGaps),
    average: { ...decompose(avgGaps), replays: L4.CF_REPLAYS },
  };
}
