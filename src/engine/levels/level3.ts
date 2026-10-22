// LEVEL 3: SHOCKS AND INSURANCE. Adverse selection, moral hazard, and the mandate.
import { BOT, L3 } from '../params';
import { botParams, botRng, finishRound, gameRng, headline, ids, idx, playerOf, pluralityResolve } from '../core';
import { equalShares, mean, ownNet, roundScore } from '../scoring';
import { missionValue } from '../play/rules';
import { PLAY } from '../play/params';
import { activeEvent, isPlay, playNet, playRoundValue, roundsLeft } from '../play/rules';
import { audienceBelief, beliefAfterClaim, checkClaims, chooseClaim, initFactBeliefs, observe, postClaims, revealFacts, SILENT } from '../play/claims';
import { reliabilityOf } from '../core';
import { ceOfLottery, logitChoice, logitProbs } from '../bots/utility';
import { flavorIndex } from '../rng';
import type { GameState, Phase, PlayerId, ValuesCard } from '../types';
import type { LevelDefinition } from './types';

export type Regime = 'VOL' | 'M50' | 'M100';
export const REGIMES: Regime[] = ['VOL', 'M50', 'M100'];
export type RiskType = 'LOW' | 'HIGH';
/** Play (D-128): the second hidden card of Episode 3. */
export type Worry = 'WORRIER' | 'CALM';
export interface Choice {
  buy: boolean;
  gym: boolean;
  /** Play v2 only, on the decision: a pool member's bar vote (an applicant, or null for no one). */
  bar?: PlayerId | null;
  /** Play only (D-142): a gift to one other contestant this round, or null. */
  gift?: Gift | null;
}

/** D-142: a gift of `amount` coins (one of PLAY.GIFT_AMOUNTS) to `to`. */
export interface Gift {
  to: PlayerId;
  amount: number;
}

/**
 * Play v2 Section 4, the Bar: last round's members each vote to bar one applicant. D-133: an applicant is
 * barred with votes from at least half of the members who aren't that applicant; everyone who reaches it is.
 */
export interface L3Bar {
  members: PlayerId[];
  votes: Record<PlayerId, PlayerId | null>;
  barred: PlayerId[];
  /** The barred contestants who had applied for cover and were turned away. */
  refused: PlayerId[];
}

/** D-133: the votes an applicant needs: at least half of the members who aren't the applicant (and at least one). */
export function barNeeds(members: readonly PlayerId[], applicant: PlayerId): number {
  const voters = members.filter((m) => m !== applicant).length;
  return voters ? Math.max(1, Math.ceil(voters / 2)) : Infinity;
}

export interface L3Round {
  regime: Regime;
  premium: number | null;
  T?: number;
  choices: Record<PlayerId, Choice>;
  pEff: Record<PlayerId, number>;
  events: Record<PlayerId, boolean>;
  eventCards: Record<PlayerId, number>;
  W: Record<PlayerId, number>;
  nextPremium: number | null;
  /** Play only: the insurer's price this round before an event discount (D-98). */
  listPrice?: number | null;
  /** Play v2 only: the bar vote of this round (absent when no bar was possible). */
  bar?: L3Bar;
  /** Play v2 only: who applied for cover (a barred applicant applied but is not covered). */
  applied?: Record<PlayerId, boolean>;
  /** Play v2 only: the launch round, when SafeHands signed everyone up (D-121). */
  launch?: boolean;
  /**
   * Play only (D-142): this round's gifts by giver, with what the recipient got (match included), and each
   * contestant's net from gifts. `W` is the money before gifts; the banks move by W plus the gift net.
   */
  gifts?: Record<PlayerId, Gift & { received: number }>;
  giftNet?: Record<PlayerId, number>;
}

export interface L3Debrief {
  types: Record<PlayerId, RiskType>;
  rounds: L3Round[];
  premiumPath: Array<number | null>;
  pools: Array<{ round: number; buyers: PlayerId[]; meanP: number | null }>;
  gym: { insured: [number, number]; uninsured: [number, number]; mandatory: [number, number] };
  expectedByType: Record<Regime, Record<RiskType, number>>;
  /** Prices the voluntary market would have had in every round with this table's types (D-80). */
  volPath: Array<number | null>;
  highShare: number;
  regimeVotes?: Record<PlayerId, Regime>;
  regime: Regime;
  bestRegimeForType: Record<RiskType, Regime>;
  unraveled: boolean;
  /** Round 1 buy decision: the human's card's best choice (risk neutral apart from hardship) vs. theirs. */
  cardBest?: { best: boolean; chose: boolean };
  /** Per human (D-43, D-62). visibleState merges the viewer's entry into the fields above. */
  byHuman?: Record<PlayerId, { cardBest: { best: boolean; chose: boolean } }>;
}

export interface L3State {
  types: Record<PlayerId, RiskType>;
  regime: Regime;
  insurerActive: boolean;
  nextPremium: number | null;
  regimeVotes?: Record<PlayerId, Regime>;
  regimeCounts?: number[];
  regimeTie?: boolean;
  rounds: L3Round[];
  debrief?: L3Debrief;
  /** Play v2: the round Leaked Medical Files made every risk type public (absent if it never drew). */
  leaked?: number;
  /** Play v2: the end reveal has flipped every risk card. */
  cardsRevealed?: boolean;
  /** Play (D-128): each contestant's worry card (private until the end reveal; never leaked). */
  worry?: Record<PlayerId, Worry>;
}

const st = (s: GameState) => s.levelState as L3State;

/**
 * The Level 3 numbers in force (Play spec 3.1): Study's params, plus the Play overrides and this round's
 * event in a Play game. The extra fields are neutral in Study (multiply by 1, add 0, no cap below 1).
 */
export type L3Params = typeof L3 & {
  /** Event multiplier on every risk this round, and its cap (Storm Season). */
  RISK_MULT: number;
  RISK_CAP: number;
  /** Event multiplier on the price charged this round (Price War). */
  PREMIUM_MULT: number;
  /** Event addition to the mandatory contribution (Paperwork Week). */
  MANDATE_EXTRA: number;
  /** The loss the insurer prices with: the level's loss, never an event's (D-98). */
  PRICE_LOSS: number;
};
export const STUDY_L3: L3Params = { ...L3, RISK_MULT: 1, RISK_CAP: 1, PREMIUM_MULT: 1, MANDATE_EXTRA: 0, PRICE_LOSS: L3.LOSS };

/**
 * Everything a Level 3 calculation needs besides the state: the numbers, the score a player maximizes
 * for one outcome, and the simple selfish value of `w` coins for player j (the model bots use for others).
 */
export interface L3Ctx {
  p: L3Params;
  score(card: ValuesCard, W: readonly number[], i: number, effortShares: readonly number[]): number;
  /** `mult`: the debt-stress multiplier assumed for player j (D-128: a Worrier's; 1 when calm or unknown). */
  net(j: number, w: number, mult?: number): number;
}
export const STUDY_CTX: L3Ctx = { p: STUDY_L3, score: roundScore, net: (_j, w) => ownNet(w) };

/** Play's Episode 3 numbers, with this round's event when `withEvent` (D-94, D-98). */
export function playL3Params(s: GameState, withEvent = true): L3Params {
  const base: L3Params = { ...STUDY_L3, ...PLAY.L3, PRICE_LOSS: PLAY.L3.LOSS };
  const ev = withEvent ? activeEvent(s) : null;
  if (!ev) return base;
  return { ...base, ...(PLAY.L3_EVENTS as Record<string, Partial<L3Params>>)[ev.id] };
}

/** The context for the current state: Study's, or Play's with banks, debt stress and the event. */
export function ctxOf(s: GameState, withEvent = true, multOf?: (i: number) => number): L3Ctx {
  if (!isPlay(s)) return STUDY_CTX;
  const p = playL3Params(s, withEvent);
  // D-122: with DEBT_HORIZON, debt also costs stress in the episode's later rounds, on a bank that drifts by
  // income minus living cost minus the pooled price each round.
  const drift = PLAY.DEBT_HORIZON ? p.BASE_INCOME - PLAY.LIVING_COST - premiumFor(p.P_BAR, p) : null;
  return {
    p,
    // Each player values outcomes with its own worry card, unless `multOf` says otherwise (D-128).
    score: (card, W, i, eff) => playRoundValue(s, card, W, i, eff, drift, multOf ? multOf(i) : undefined),
    net: (j, w, mult) => playNet(s, j, w, drift, mult),
  };
}

const pOf = (type: RiskType, p: L3Params = STUDY_L3) => (type === 'HIGH' ? p.P_HIGH : p.P_LOW);
const coverage = (r: Regime, p: L3Params = STUDY_L3) => (r === 'M50' ? p.COVERAGE_OPTIONS[0] : p.COVERAGE_OPTIONS[1]);

export function premiumFor(meanP: number, p: L3Params = STUDY_L3): number {
  return p.LOADING * p.PRICE_LOSS * meanP;
}

export function mandatoryContribution(c: number, pEffAll: readonly number[], p: L3Params = STUDY_L3): number {
  const T = p.LOADING * c * p.LOSS * mean(pEffAll);
  return p.MANDATE_EXTRA ? T + p.MANDATE_EXTRA : T;
}

export function wealthL3(
  regime: Regime,
  premium: number | null,
  choices: readonly Choice[],
  pEff: readonly number[],
  events: readonly boolean[],
  p: L3Params = STUDY_L3,
): { W: number[]; T?: number } {
  if (regime === 'VOL') {
    const W = choices.map((c, i) => {
      const buy = c.buy && premium !== null;
      return p.BASE_INCOME - (buy ? premium! : 0) - (c.gym ? p.GYM_COST : 0) - (events[i] && !buy ? p.LOSS : 0);
    });
    return { W };
  }
  const c = coverage(regime, p);
  const T = mandatoryContribution(c, pEff, p);
  const W = choices.map((ch, i) => p.BASE_INCOME - T - (ch.gym ? p.GYM_COST : 0) - (events[i] ? (1 - c) * p.LOSS : 0));
  return { W, T };
}

/**
 * Expected own money minus hardship for one choice (risk neutral apart from the hardship line).
 * Under a mandate the contribution is estimated from the population average risk.
 */
export function rnValue(type: RiskType, regime: Regime, premium: number | null, ch: Choice, ctx: L3Ctx = STUDY_CTX, j = -1, mult = 1): number {
  const p = ctx.p;
  const net = (w: number) => ctx.net(j, w, mult);
  const pe = pEffOf(type, ch.gym, p);
  const gym = ch.gym ? p.GYM_COST : 0;
  if (regime === 'VOL') {
    if (ch.buy && premium !== null) return net(p.BASE_INCOME - premium - gym);
    return (1 - pe) * net(p.BASE_INCOME - gym) + pe * net(p.BASE_INCOME - gym - p.LOSS);
  }
  const c = coverage(regime, p);
  const T = mandatoryContribution(c, [p.P_BAR], p);
  return (1 - pe) * net(p.BASE_INCOME - T - gym) + pe * net(p.BASE_INCOME - T - gym - (1 - c) * p.LOSS);
}

/**
 * Risk-neutral selfish choice for a type (the simple model bots use for others), counting the hardship
 * line in Study and debt stress on player j's bank in Play.
 */
export function rnChoice(type: RiskType, regime: Regime, premium: number | null, ctx: L3Ctx = STUDY_CTX, j = -1): Choice {
  const opts: Choice[] = [
    { buy: false, gym: false },
    { buy: false, gym: true },
  ];
  if (regime === 'VOL' && premium !== null) opts.push({ buy: true, gym: false });
  let best = opts[0];
  for (const o of opts) if (rnValue(type, regime, premium, o, ctx, j) > rnValue(type, regime, premium, best, ctx, j) + 1e-9) best = o;
  return best;
}

/** Effective risk this round (an event can raise it, up to its cap). */
function pEffOf(type: RiskType, gym: boolean, p: L3Params = STUDY_L3): number {
  const pe = pOf(type, p) * (gym ? p.GYM_FACTOR : 1);
  return p.RISK_MULT === 1 ? pe : Math.min(p.RISK_CAP, pe * p.RISK_MULT);
}

/** Risk without this round's event: what the insurer prices next round from (D-98). Equal to pEffOf in Study. */
function pBaseOf(type: RiskType, gym: boolean, p: L3Params = STUDY_L3): number {
  return pOf(type, p) * (gym ? p.GYM_FACTOR : 1);
}

function optionsFor(regime: Regime, premium: number | null): Choice[] {
  const base = [
    { buy: false, gym: false },
    { buy: false, gym: true },
  ];
  if (regime === 'VOL' && premium !== null) base.push({ buy: true, gym: false }, { buy: true, gym: true });
  return base;
}

/**
 * CE of each own option under a regime, with others' types and actions modeled (Section 5.4).
 * Exact enumeration (D-52): every combination of the other players' risk types and every player's
 * bad-luck outcome, weighted by its probability. No Monte Carlo noise, no random draws.
 */
function choiceCE(
  n: number,
  i: number,
  myType: RiskType | null,
  card: ValuesCard,
  rho: number,
  regime: Regime,
  premium: number | null,
  ctx: L3Ctx = STUDY_CTX,
): { options: Choice[]; ce: number[] } {
  const P = ctx.p;
  const options = optionsFor(regime, premium);
  const lotteries: Array<Array<[number, number]>> = options.map(() => []);
  const eq = equalShares(n);
  const free = Array.from({ length: n }, (_, j) => j).filter((j) => j !== i || !myType);
  for (let tm = 0; tm < 1 << free.length; tm++) {
    const types: RiskType[] = Array.from({ length: n }, () => myType ?? 'LOW');
    let pTypes = 1;
    free.forEach((j, k) => {
      const high = (tm >> k) & 1;
      types[j] = high ? 'HIGH' : 'LOW';
      pTypes *= high ? P.P_HIGH_SHARE : 1 - P.P_HIGH_SHARE;
    });
    const others = types.map((t, j) => rnChoice(t, regime, premium, ctx, j));
    options.forEach((opt, k) => {
      const choices = others.slice();
      choices[i] = opt;
      const pEff = choices.map((c, j) => pEffOf(types[j], c.gym, P));
      for (let em = 0; em < 1 << n; em++) {
        let p = pTypes;
        const events = pEff.map((pe, j) => {
          const ev = ((em >> j) & 1) === 1;
          p *= ev ? pe : 1 - pe;
          return ev;
        });
        if (p === 0) continue;
        const { W } = wealthL3(regime, premium, choices, pEff, events, P);
        lotteries[k].push([p, ctx.score(card, W, i, eq)]);
      }
    });
  }
  return { options, ce: lotteries.map((lot) => ceOfLottery(lot, rho)) };
}

/** The price charged now: the insurer's price, times this round's event multiplier in Play (Price War). */
function currentPremium(s: GameState, ctx: L3Ctx = ctxOf(s)): number | null {
  const l = st(s);
  const price = l.regime === 'VOL' && l.insurerActive ? l.nextPremium : null;
  return price === null || ctx.p.PREMIUM_MULT === 1 ? price : price * ctx.p.PREMIUM_MULT;
}

function regimeCE(s: GameState, n: number, i: number, myType: RiskType | null, card: ValuesCard, rho: number, multOf?: (i: number) => number): number[] {
  const l = st(s);
  const ctx = ctxOf(s, true, multOf);
  return REGIMES.map((r) => {
    const prem = r === 'VOL' && l.insurerActive ? l.nextPremium : null;
    const { ce } = choiceCE(n, i, myType, card, rho, r, prem, ctx);
    return Math.max(...ce);
  });
}

/**
 * The voluntary market's price path if it ran every round (D-80), with every player choosing by the
 * risk-neutral rule that counts the hardship line (`rnChoice`): each round the types that buy at the
 * current price set next round's price from their average risk, and if nobody buys the insurer leaves
 * for good. Deterministic: it uses the table's mix of types, not anyone's luck.
 */
export function voluntaryPath(nHigh: number, n: number, ctx: L3Ctx = STUDY_CTX): Array<number | null> {
  const P = ctx.p;
  const out: Array<number | null> = [];
  let premium: number | null = premiumFor(P.P_BAR, P);
  for (let r = 0; r < P.ROUNDS; r++) {
    out.push(premium);
    if (premium === null) continue;
    const counts: Record<RiskType, number> = { HIGH: nHigh, LOW: n - nHigh };
    let buyers = 0;
    let riskSum = 0;
    for (const type of ['LOW', 'HIGH'] as RiskType[]) {
      const c = rnChoice(type, 'VOL', premium, ctx);
      if (!c.buy || counts[type] === 0) continue;
      buyers += counts[type];
      riskSum += counts[type] * pEffOf(type, c.gym, P);
    }
    premium = buyers ? premiumFor(riskSum / buyers, P) : null;
  }
  return out;
}

/**
 * Risk-neutral expectation per type and round, averaged over the level's rounds, under each regime for a
 * table with `nHigh` High types out of `n`. Voluntary insurance is valued along `voluntaryPath`, not at
 * the opening price (D-80). With `net`, each outcome counts own money minus the hardship penalty (used to
 * pick a type's best regime).
 */
export function expectedByType(nHigh: number, n: number, net = false, ctx: L3Ctx = STUDY_CTX): Record<Regime, Record<RiskType, number>> {
  const P = ctx.p;
  const f = net ? (w: number) => ctx.net(-1, w) : (w: number) => w;
  const highShare = n > 0 ? nHigh / n : 0;
  const path = voluntaryPath(nHigh, n, ctx);
  const volRound = (type: RiskType, prem: number | null) => {
    const c = rnChoice(type, 'VOL', prem, ctx);
    const gym = c.gym ? P.GYM_COST : 0;
    if (c.buy && prem !== null) return f(P.BASE_INCOME - prem - gym);
    const p = pEffOf(type, c.gym, P);
    return (1 - p) * f(P.BASE_INCOME - gym) + p * f(P.BASE_INCOME - gym - P.LOSS);
  };
  const vol = (type: RiskType) => mean(path.map((prem) => volRound(type, prem)));
  const mand = (r: Regime) => {
    const cv = coverage(r, P);
    const gymL = rnChoice('LOW', r, null, ctx).gym;
    const gymH = rnChoice('HIGH', r, null, ctx).gym;
    const meanP = highShare * pEffOf('HIGH', gymH, P) + (1 - highShare) * pEffOf('LOW', gymL, P);
    const T = mandatoryContribution(cv, [meanP], P);
    const w = (type: RiskType, gym: boolean) => {
      const base = P.BASE_INCOME - T - (gym ? P.GYM_COST : 0);
      const p = pEffOf(type, gym, P);
      return (1 - p) * f(base) + p * f(base - (1 - cv) * P.LOSS);
    };
    return { LOW: w('LOW', gymL), HIGH: w('HIGH', gymH) };
  };
  return { VOL: { LOW: vol('LOW'), HIGH: vol('HIGH') }, M50: mand('M50'), M100: mand('M100') };
}

/** Round 1: would the human's card (risk neutral apart from hardship, no noise) buy at the opening price? */
function cardBestBuy(s: GameState, pid: PlayerId): { best: boolean; chose: boolean } {
  const l = st(s);
  const me = playerOf(s, pid);
  const r1 = l.rounds[0];
  const premium = r1.premium;
  const { options, ce } = choiceCE(s.players.length, idx(s, pid), l.types[pid], me.values, 0, 'VOL', premium, ctxOf(s, false));
  return { best: options[ce.indexOf(Math.max(...ce))].buy, chose: r1.choices[pid].buy };
}

// ---- Play v2 (PLAY_V2_SPEC.md Section 4, The Pool). Study never reaches these. ----

/** D-121: with L3_LAUNCH, SafeHands signs everyone up in round 1 at the pooled price. */
export const isLaunch = (s: GameState) => isPlay(s) && PLAY.L3_LAUNCH && s.round === 1;

/** The market is open for voluntary cover now. */
const marketOpen = (s: GameState) => st(s).regime === 'VOL' && st(s).insurerActive;

/** Last round's pool members, who vote on the bar this round (none in round 1 or once the market closed). */
export function membersOf(s: GameState): PlayerId[] {
  const l = st(s);
  if (!isPlay(s) || !marketOpen(s) || !l.rounds.length) return [];
  const last = l.rounds[l.rounds.length - 1];
  if (last.regime !== 'VOL' || last.premium === null) return [];
  return ids(s).filter((id) => last.choices[id].buy);
}

const playPrior = (s: GameState) => ctxOf(s, false).p.P_HIGH_SHARE;

/** A voter's belief that `j` is high risk: a bot's own, or (a human seat) the audience poll. */
function voterBelief(s: GameState, voter: PlayerId, j: PlayerId): number {
  return s.play!.belief[voter]?.[j] ?? audienceBelief(s, j) ?? playPrior(s);
}

/** A contestant's expected risk (no gym), given a belief that they are high risk. */
const expectedRisk = (b: number, P: L3Params) => b * P.P_HIGH + (1 - b) * P.P_LOW;

/**
 * D-133: what barring `target` is worth to member `voter`, in coins: how much it lowers the price the member
 * expects to pay next round, times the chance the member stays in. SafeHands prices next round from this
 * round's pool, assumed to be last round's members (who stay) plus the target: price = LOADING x PRICE_LOSS x
 * mean risk. Others' risks come from the voter's beliefs, its own from `selfRisk`. Zero in the last round.
 * Scaled by BAR_GAIN_SCALE.
 */
function barGain(s: GameState, pool: PlayerId[], voter: PlayerId, target: PlayerId, beliefOf: (k: PlayerId) => number, selfRisk: number, pStay: number): number {
  if (roundsLeft(s) <= 0) return 0;
  const P = ctxOf(s, false).p;
  const inPool = [...new Set([...pool, voter, target])];
  const without = inPool.filter((k) => k !== target);
  const risk = (k: PlayerId) => (k === voter ? selfRisk : expectedRisk(beliefOf(k), P));
  const diff = P.LOADING * P.PRICE_LOSS * (mean(inPool.map(risk)) - mean(without.map(risk)));
  return PLAY.BAR_GAIN_SCALE * PLAY.DIFFICULTY[s.difficulty].barScale * pStay * diff;
}

/** A member's bar options (no one, then every other contestant) and their values in coins (D-133). */
function barOptions(s: GameState, pool: PlayerId[], voter: PlayerId, belief: (j: PlayerId) => number, selfRisk: number, pStay: number): { options: Array<PlayerId | null>; u: number[] } {
  const others = ids(s).filter((id) => id !== voter);
  return { options: [null, ...others], u: [0, ...others.map((j) => barGain(s, pool, voter, j, belief, selfRisk, pStay))] };
}

/** A bot member's vote: its own beliefs, its own risk, and its own chance of buying as the chance it stays in. */
function botBarVote(s: GameState, voter: PlayerId, pStay: number): PlayerId | null {
  const members = membersOf(s);
  if (!members.includes(voter)) return null;
  const selfRisk = pOf(st(s).types[voter], ctxOf(s, false).p);
  const { options, u } = barOptions(s, members, voter, (j) => voterBelief(s, voter, j), selfRisk, pStay);
  return options[logitChoice(u, botParams(s, voter).lambda, botRng(s))];
}

/**
 * D-133: how likely member m is to buy, as `observer` sees it (public model, no private card): the logit rule
 * on rnValue for each risk type, weighted by the observer's belief that m is high risk, Calm multiplier.
 */
function publicBuyChance(s: GameState, m: PlayerId, bHigh: number): number {
  const premium = currentPremium(s);
  if (premium === null) return 0;
  const ctx = ctxOf(s);
  const j = idx(s, m);
  const pBuy = (type: RiskType) => {
    const vNo = Math.max(rnValue(type, 'VOL', premium, { buy: false, gym: false }, ctx, j), rnValue(type, 'VOL', premium, { buy: false, gym: true }, ctx, j));
    return logitProbs([vNo, rnValue(type, 'VOL', premium, { buy: true, gym: false }, ctx, j)], BOT.BELIEF_LAMBDA)[1];
  };
  return bHigh * pBuy('HIGH') + (1 - bHigh) * pBuy('LOW');
}

/**
 * The chance `target` is barred this round if every member's belief about it were `beliefOf(member)`:
 * each member votes by the logit rule (a human seat with the belief model's lambda), a strict majority bars.
 */
function barChance(s: GameState, members: PlayerId[], target: PlayerId, beliefOf: (m: PlayerId) => number): number {
  let dist = [1];
  for (const m of members) {
    let q = 0;
    if (m !== target) {
      // The target predicts m's vote from public information: its own belief about m's risk and m's chance of staying in.
      const bm = voterBelief(s, target, m);
      const P = ctxOf(s, false).p;
      const { options, u } = barOptions(s, members, m, (j) => (j === target ? beliefOf(m) : voterBelief(s, m, j)), expectedRisk(bm, P), publicBuyChance(s, m, bm));
      const lam = playerOf(s, m).isHuman ? BOT.BELIEF_LAMBDA : botParams(s, m).lambda;
      q = logitProbs(u, lam)[options.indexOf(target)];
    }
    const next: number[] = new Array(dist.length + 1).fill(0);
    dist.forEach((p, k) => {
      next[k] += p * (1 - q);
      next[k + 1] += p * q;
    });
    dist = next;
  }
  const need = barNeeds(members, target);
  return dist.reduce((a, p, k) => (k >= need ? a + p : a), 0);
}

/**
 * D-112: what a claim is worth to `pid` this round, before credibility: minus the chance of being barred
 * after it times the value of cover (best plan with cover minus best without, as the bot values it). In
 * round 1 there are no members yet, so the claim is valued against the bar it will face next round, as if
 * every other contestant were a member.
 */
function claimGainFn(s: GameState, pid: PlayerId): (value: string) => number {
  const l = st(s);
  const premium = currentPremium(s);
  if (!marketOpen(s) || premium === null) return () => 0;
  let members = membersOf(s);
  if (!l.rounds.length) members = ids(s).filter((id) => id !== pid);
  if (!members.some((m) => m !== pid)) return () => 0;
  const { rho } = botParams(s, pid);
  const ctx = ctxOf(s);
  const { options, ce } = choiceCE(s.players.length, idx(s, pid), l.types[pid], playerOf(s, pid).values, rho, l.regime, premium, ctx);
  const best = (buy: boolean) => Math.max(...options.map((o, k) => (o.buy === buy ? ce[k] : -Infinity)));
  const cover = Math.max(0, best(true) - best(false));
  if (cover <= 0) return () => 0;
  const rel = reliabilityOf(s, pid);
  return (value) =>
    -cover *
    barChance(s, members, pid, (m) => {
      const b = voterBelief(s, m, pid);
      if (value === SILENT) return b;
      if (s.play!.joint[m]) return beliefAfterClaim(s, m, pid, value === 'HIGH', rel);
      const k = PLAY.CLAIM_WEIGHT * rel;
      return (1 - k) * b + k * (value === 'HIGH' ? 1 : 0);
    });
}

function botClaim(s: GameState, pid: PlayerId): { value: string; lieGain: number } {
  const type = st(s).types[pid];
  return chooseClaim(s, pid, type, type === 'HIGH' ? 'LOW' : 'HIGH', claimGainFn(s, pid));
}

/**
 * D-142, D-143: an expectation over this round under the model bots use for others (choiceCE): every other
 * contestant's risk card at the prior, their cover and gym by the risk-neutral rule (everyone covered in
 * the launch round; `barred` loses cover), and every wheel outcome. `mine` is contestant i's own choice and
 * its own card is known. `f` maps the round's money W (seat order) to a list of values; returns their means.
 */
function expectRound(s: GameState, i: number, mine: Choice, f: (W: number[]) => number[], barred: PlayerId | null = null): number[] {
  const l = st(s);
  const ctx = ctxOf(s);
  const P = ctx.p;
  const n = s.players.length;
  const pids = ids(s);
  const premium = currentPremium(s, ctx);
  const launch = isLaunch(s);
  const myType = l.types[pids[i]];
  const free = pids.map((_, j) => j).filter((j) => j !== i);
  let acc: number[] | null = null;
  for (let tm = 0; tm < 1 << free.length; tm++) {
    const types: RiskType[] = pids.map(() => myType);
    let pTypes = 1;
    free.forEach((j, k) => {
      const high = (tm >> k) & 1;
      types[j] = high ? 'HIGH' : 'LOW';
      pTypes *= high ? P.P_HIGH_SHARE : 1 - P.P_HIGH_SHARE;
    });
    const choices = types.map((t, j) => {
      if (j === i) return { buy: mine.buy && premium !== null, gym: mine.gym };
      const c = rnChoice(t, l.regime, premium, ctx, j);
      const buy = (launch && premium !== null) || c.buy;
      return { buy: buy && pids[j] !== barred, gym: c.gym };
    });
    const pEff = choices.map((c, j) => pEffOf(types[j], c.gym, P));
    for (let em = 0; em < 1 << n; em++) {
      let p = pTypes;
      const events = pEff.map((pe, j) => {
        const ev = ((em >> j) & 1) === 1;
        p *= ev ? pe : 1 - pe;
        return ev;
      });
      if (p === 0) continue;
      const v = f(wealthL3(l.regime, premium, choices, pEff, events, P).W);
      if (!acc) acc = v.map(() => 0);
      v.forEach((x, k) => (acc![k] += p * x));
    }
  }
  return acc ?? [];
}

/** Every gift option for contestant i: each other contestant, each amount. */
const giftOptions = (s: GameState, i: number): Gift[] =>
  ids(s)
    .filter((_, j) => j !== i)
    .flatMap((to) => PLAY.GIFT_AMOUNTS.map((amount) => ({ to, amount })));

/** The round's money with a gift from i: i pays the amount, the recipient gets it plus SafeHands' match. */
function withGift(s: GameState, W: readonly number[], i: number, g: Gift): number[] {
  const out = W.slice();
  out[i] -= g.amount;
  out[idx(s, g.to)] += g.amount * (1 + PLAY.GIFT_MATCH);
  return out;
}

/**
 * D-142, a bot's gift: it values each gift as the expected change in its own Play score (bank, mission and
 * debt stress, as it values everything else) against giving nothing, then decides whether to give its best
 * gift by the binary logit rule, like buying cover. An Egoist never gives: its mission is its own bank, so
 * a gift only costs it, and a gift cannot lower its chance of being barred (members bar on risk and price).
 */
function botGift(s: GameState, botId: PlayerId, mine: Choice, lambda: number): Gift | null {
  const me = playerOf(s, botId);
  if (me.values === 'EGOIST' || !PLAY.GIFT_AMOUNTS.length) return null;
  const i = idx(s, botId);
  const ctx = ctxOf(s);
  const eq = equalShares(s.players.length);
  const opts = giftOptions(s, i);
  const vals = expectRound(s, i, mine, (W) => [ctx.score(me.values, W, i, eq), ...opts.map((g) => ctx.score(me.values, withGift(s, W, i, g), i, eq))]);
  const u = vals.slice(1).map((x) => x - vals[0]);
  const k = u.indexOf(Math.max(...u));
  return logitChoice([0, u[k]], lambda, botRng(s)) === 1 ? opts[k] : null;
}

/** D-143: the mission preview on the move screen, in mission points (k x mission), each against doing nothing. */
export interface L3Preview {
  cover: number | null;
  gym: number;
  bar: Record<PlayerId, number>;
  gift: Record<PlayerId, Record<number, number>>;
}

/**
 * D-143: how each choice on the move screen changes your mission this round, in mission points against
 * doing nothing (no cover unless the launch round signs you up, no gym, no bar vote, no gift), as an
 * expected value under the bots' model (expectRound). Your bar vote counts only when it decides the vote:
 * the other members are modelled with the bots' bar rule on public beliefs (the audience poll where it is
 * shown, else the prior), and the preview is that chance times the mission change if the target is barred.
 */
export function missionPreview(s: GameState, pid: PlayerId): L3Preview {
  const me = playerOf(s, pid);
  const i = idx(s, pid);
  const pl = s.play!;
  const card = me.values;
  const k = PLAY.MISSION_SCALE[card];
  const eff = equalShares(s.players.length);
  const banks = (W: readonly number[]) => s.players.map((p, j) => pl.banks[p.id] + W[j] - PLAY.LIVING_COST);
  const mission = (W: readonly number[]) => k * missionValue(card, banks(W), i, eff);
  const premium = currentPremium(s);
  const launch = isLaunch(s);
  const none: Choice = { buy: launch, gym: false };
  const opts = giftOptions(s, i);
  const [base, ...gifts] = expectRound(s, i, none, (W) => [mission(W), ...opts.map((g) => mission(withGift(s, W, i, g)))]);
  const cover = premium !== null && !launch && st(s).regime === 'VOL' ? expectRound(s, i, { buy: true, gym: false }, (W) => [mission(W)])[0] - base : null;
  const gym = expectRound(s, i, { buy: launch, gym: true }, (W) => [mission(W)])[0] - base;
  const gift: L3Preview['gift'] = {};
  opts.forEach((g, n) => ((gift[g.to] ??= {})[g.amount] = gifts[n] - base));
  const bar: Record<PlayerId, number> = {};
  const members = membersOf(s);
  if (members.includes(pid)) {
    const P = ctxOf(s, false).p;
    const shown = PLAY.DIFFICULTY[s.difficulty].poll !== 'NEVER';
    const pub = (j: PlayerId) => (shown ? (audienceBelief(s, j) ?? playPrior(s)) : playPrior(s));
    for (const x of ids(s)) {
      if (x === pid) continue;
      let dist = [1];
      for (const m of members) {
        if (m === pid || m === x) continue;
        const { options, u } = barOptions(s, members, m, pub, expectedRisk(pub(m), P), publicBuyChance(s, m, pub(m)));
        const q = logitProbs(u, BOT.BELIEF_LAMBDA)[options.indexOf(x)];
        const next: number[] = new Array(dist.length + 1).fill(0);
        dist.forEach((p, c) => {
          next[c] += p * (1 - q);
          next[c + 1] += p * q;
        });
        dist = next;
      }
      const decisive = dist[barNeeds(members, x) - 1] ?? 0;
      bar[x] = decisive * (expectRound(s, i, none, (W) => [mission(W)], x)[0] - base);
    }
  }
  return { cover, gym, bar, gift };
}

/**
 * D-110: what a finished round tells every bot about each contestant's risk. Buying (applying for cover),
 * the gym when uninsured, and the wheel's result are each read by Bayes' rule, with the public model of a
 * contestant's choice (the logit rule on rnValue, with the belief lambda) and the true odds of the wheel.
 */
function readRound(s: GameState, r: L3Round): void {
  const l = st(s);
  if (l.leaked) return;
  const ctx = ctxOf(s);
  const P = ctx.p;
  const lam = BOT.BELIEF_LAMBDA;
  ids(s).forEach((id, j) => {
    const ch = r.choices[id];
    // D-128: every combination of risk and worry card, each with its own choice model.
    const likOf = (type: RiskType, worrier: boolean) => {
      const m = worrier ? PLAY.WORRIER_STRESS_MULT : 1;
      let lik = 1;
      if (r.regime === 'VOL' && r.premium !== null && !r.launch) {
        const vNo = Math.max(rnValue(type, 'VOL', r.premium, { buy: false, gym: false }, ctx, j, m), rnValue(type, 'VOL', r.premium, { buy: false, gym: true }, ctx, j, m));
        const vBuy = rnValue(type, 'VOL', r.premium, { buy: true, gym: false }, ctx, j, m);
        const pBuy = logitProbs([vNo, vBuy], lam)[1];
        lik *= r.applied?.[id] ? pBuy : 1 - pBuy;
      }
      const insured = (r.regime === 'VOL' && r.premium !== null && ch.buy) || r.regime === 'M100';
      if (!insured) {
        const prem = r.regime === 'VOL' ? r.premium : null;
        const g = [false, true].map((gym) => rnValue(type, r.regime, prem, { buy: false, gym }, ctx, j, m));
        const pGym = logitProbs(g, lam)[1];
        lik *= ch.gym ? pGym : 1 - pGym;
      }
      const pe = pEffOf(type, ch.gym, P);
      return lik * (r.events[id] ? pe : 1 - pe);
    };
    const table = { HH: likOf('HIGH', true), HC: likOf('HIGH', false), LH: likOf('LOW', true), LC: likOf('LOW', false) };
    observe(s, id, (high, worrier) => table[`${high ? 'H' : 'L'}${worrier ? 'H' : 'C'}` as keyof typeof table]);
  });
}

export const level3: LevelDefinition = {
  id: 3,
  rounds: L3.ROUNDS,
  init(s) {
    const P = ctxOf(s, false).p;
    const g = gameRng(s);
    const types: Record<PlayerId, RiskType> = {};
    // D-141: in Play too, every seat's risk card is drawn on its own, P_HIGH_SHARE (50/50) on the game stream.
    // Nobody is told the mix. With L3_MIXED_DEAL, a table of 3 or 4 is redrawn until both cards are in it.
    const draw = () => s.players.map(() => (g.next() < P.P_HIGH_SHARE ? 'HIGH' : 'LOW') as RiskType);
    let dealt = draw();
    if (isPlay(s) && PLAY.L3_MIXED_DEAL && s.players.length >= 3) while (new Set(dealt).size < 2) dealt = draw();
    s.players.forEach((p, k) => {
      types[p.id] = dealt[k];
      p.privateInfo.riskType = types[p.id];
    });
    // Play (D-128, D-141): the worry card, drawn the same way after every risk card, independent of risk.
    let worry: Record<PlayerId, Worry> | undefined;
    if (isPlay(s)) {
      worry = Object.fromEntries(s.players.map((p) => [p.id, (g.next() < PLAY.WORRIER_SHARE ? 'WORRIER' : 'CALM') as Worry]));
      for (const p of s.players) p.privateInfo.worry = worry[p.id];
    }
    s.levelState = {
      types,
      regime: 'VOL',
      insurerActive: true,
      nextPremium: premiumFor(P.P_BAR, P),
      rounds: [],
      ...(worry ? { worry } : {}),
    } satisfies L3State;
    if (isPlay(s)) initFactBeliefs(s, P.P_HIGH_SHARE, PLAY.WORRIER_SHARE);
  },
  phases(s) {
    const P = ctxOf(s, false).p;
    const out: Phase[] = [];
    if (isPlay(s)) {
      // Play v2 Section 4: claim, then the move (bar and cover), then the wheel; the regime vote after round 3;
      // the end reveal of every risk card with the claims stamped. No talk phases: claims are the talk (D-110).
      for (let r = 1; r <= P.ROUNDS; r++) {
        out.push(
          { kind: 'BRIEFING', round: r },
          { kind: 'DECIDE', step: 'CLAIM', round: r },
          { kind: 'DECIDE', step: 'CHOICE', round: r },
          { kind: 'REVEAL', step: 'EVENTS', round: r },
          { kind: 'ROUND_SUMMARY', round: r },
        );
        if (r === P.VOLUNTARY_ROUNDS) out.push({ kind: 'DECIDE', step: 'REGIME', round: r }, { kind: 'REVEAL', step: 'REGIME', round: r });
      }
      out.push({ kind: 'REVEAL', step: 'CARDS', round: P.ROUNDS });
      return out;
    }
    for (let r = 1; r <= P.ROUNDS; r++) {
      out.push(
        { kind: 'BRIEFING', round: r },
        { kind: 'TALK', step: 'ROUND', round: r },
        { kind: 'DECIDE', step: 'CHOICE', round: r },
        { kind: 'REVEAL', step: 'EVENTS', round: r },
        { kind: 'ROUND_SUMMARY', round: r },
      );
      if (r === P.VOLUNTARY_ROUNDS)
        out.push(
          { kind: 'TALK', step: 'REGIME', round: r },
          { kind: 'DECIDE', step: 'REGIME', round: r },
          { kind: 'REVEAL', step: 'REGIME', round: r },
        );
    }
    return out;
  },
  deciders(s, step) {
    // Play v2: claims only while there is a pool to get into, and not once every risk type is public.
    if (step === 'CLAIM') return marketOpen(s) && !st(s).leaked ? ids(s) : [];
    return ids(s);
  },
  onEnter(s, phase) {
    if (!isPlay(s)) return;
    const l = st(s);
    if (phase.kind === 'BRIEFING' && activeEvent(s)?.id === 'LEAKED' && !l.leaked) {
      // v2 Section 5: everyone's risk type is shown, so every belief becomes (almost) certain.
      l.leaked = s.round;
      revealFacts(s, (pid) => l.types[pid] === 'HIGH');
    }
    if (phase.kind === 'REVEAL' && phase.step === 'CARDS') {
      checkClaims(s, (pid) => l.types[pid]);
      l.cardsRevealed = true;
    }
  },
  validate(s, step, pid, d) {
    if (step === 'REGIME') return REGIMES.includes(d as Regime) ? d : null;
    if (step === 'CLAIM') return d === 'LOW' || d === 'HIGH' || d === SILENT ? d : null;
    if (step === 'CHOICE') {
      const c = d as Choice;
      if (!c || typeof c.buy !== 'boolean' || typeof c.gym !== 'boolean') return null;
      const out: Choice = { buy: (c.buy || isLaunch(s)) && currentPremium(s) !== null, gym: c.gym };
      if (isPlay(s)) {
        // A bar vote counts only from a member, against someone else at the table.
        const ok = typeof c.bar === 'string' && c.bar !== pid && membersOf(s).includes(pid) && ids(s).includes(c.bar);
        out.bar = ok ? c.bar! : null;
        // D-142: one gift, of a listed amount, to someone else at the table.
        const gf = c.gift;
        out.gift = gf && typeof gf.to === 'string' && gf.to !== pid && ids(s).includes(gf.to) && PLAY.GIFT_AMOUNTS.includes(gf.amount) ? { to: gf.to, amount: gf.amount } : null;
      }
      return out;
    }
    return null;
  },
  botDecide(s, botId, step) {
    const { lambda, rho } = botParams(s, botId);
    const me = playerOf(s, botId);
    const rng = botRng(s);
    const n = s.players.length;
    const i = idx(s, botId);
    if (step === 'CLAIM') return botClaim(s, botId).value;
    if (step === 'CHOICE') {
      const l = st(s);
      const ctx = ctxOf(s);
      const { options, ce } = choiceCE(n, i, l.types[botId], me.values, rho, l.regime, currentPremium(s, ctx), ctx);
      // Section 5.5: buy is a binary logit (each side valued at its best gym response),
      // then the gym is a binary logit given the purchase decision.
      const best = (buy: boolean) => Math.max(...options.map((o, k) => (o.buy === buy ? ce[k] : -Infinity)));
      const canBuy = options.some((o) => o.buy);
      const buy = canBuy && (isLaunch(s) || logitChoice([best(false), best(true)], lambda, rng) === 1);
      const gymCE = [false, true].map((gym) => ce[options.findIndex((o) => o.buy === buy && o.gym === gym)]);
      const gym = logitChoice(gymCE, lambda, rng) === 1;
      // D-133: the chance of buying now stands in for the chance of staying in the pool next round.
      const pStay = canBuy ? logitProbs([best(false), best(true)], lambda)[1] : 0;
      if (isPlay(s)) {
        const bar = botBarVote(s, botId, pStay);
        return { buy, gym, bar, gift: botGift(s, botId, { buy, gym }, lambda) };
      }
      return { buy, gym };
    }
    const ce = regimeCE(s, n, i, st(s).types[botId], me.values, rho);
    return REGIMES[logitChoice(ce, lambda, rng)];
  },
  resolve(s, step, decisions) {
    const l = st(s);
    const pids = ids(s);
    const g = gameRng(s);
    if (step === 'REGIME') {
      const votes = pids.map((id) => REGIMES.indexOf(decisions[id] as Regime));
      const { winner, tie, counts } = pluralityResolve(votes, REGIMES.length, g);
      l.regimeVotes = decisions as Record<PlayerId, Regime>;
      l.regimeCounts = counts;
      l.regimeTie = tie;
      l.regime = REGIMES[winner];
      return;
    }
    if (step === 'CLAIM') {
      const said = decisions as Record<PlayerId, string>;
      const gains = Object.fromEntries(pids.filter((id) => id in said).map((id) => [id, playerOf(s, id).isHuman ? null : botClaim(s, id).lieGain]));
      postClaims(s, 'RISK', said, (pid) => l.types[pid], (v) => v === 'HIGH', gains);
      return;
    }
    const ctx = ctxOf(s);
    const P = ctx.p;
    const premium = currentPremium(s, ctx);
    const listPrice = l.nextPremium;
    let choices = pids.map((id) => decisions[id] as Choice);
    // Play v2, the Bar: a strict majority of last round's members bars one applicant, who gets no cover.
    let bar: L3Bar | undefined;
    let applied: Record<PlayerId, boolean> | undefined;
    if (isPlay(s)) {
      applied = Object.fromEntries(pids.map((id, i) => [id, choices[i].buy]));
      const members = membersOf(s);
      if (members.length) {
        const votes = Object.fromEntries(members.map((m) => [m, (decisions[m] as Choice).bar ?? null])) as Record<PlayerId, PlayerId | null>;
        const counts: Record<PlayerId, number> = {};
        for (const v of Object.values(votes)) if (v) counts[v] = (counts[v] ?? 0) + 1;
        const barred = pids.filter((j) => (counts[j] ?? 0) >= barNeeds(members, j));
        const refused = barred.filter((j) => choices[pids.indexOf(j)].buy);
        bar = { members, votes, barred, refused };
        for (const m of members)
          for (const [k, j] of pids.entries())
            if (j !== m && choices[k].buy) s.play!.barReads.push({ level: s.levelIndex, round: s.round, member: m, target: j, belief: voterBelief(s, m, j) });
      }
      choices = choices.map((c, i) => ({ buy: c.buy && !bar?.barred.includes(pids[i]), gym: c.gym }));
    }
    const pEff = pids.map((id, i) => pEffOf(l.types[id], choices[i].gym, P));
    const pBase = pids.map((id, i) => pBaseOf(l.types[id], choices[i].gym, P));
    const events = pEff.map((p) => g.next() < p);
    const { W, T } = wealthL3(l.regime, premium, choices, pEff, events, P);
    const rec = <X>(xs: X[]) => Object.fromEntries(pids.map((id, i) => [id, xs[i]])) as Record<PlayerId, X>;
    // D-142: gifts land after the wheel; SafeHands adds GIFT_MATCH to each.
    let gifts: L3Round['gifts'];
    let giftNet: Record<PlayerId, number> | undefined;
    if (isPlay(s)) {
      gifts = {};
      giftNet = rec(pids.map(() => 0));
      for (const id of pids) {
        const gf = (decisions[id] as Choice).gift;
        if (!gf) continue;
        const received = gf.amount * (1 + PLAY.GIFT_MATCH);
        gifts[id] = { ...gf, received };
        giftNet[id] -= gf.amount;
        giftNet[gf.to] += received;
      }
    }
    const Wend = giftNet ? W.map((w, i) => w + giftNet![pids[i]]) : W;
    let exited = false;
    const before = l.nextPremium;
    if (l.regime === 'VOL' && l.insurerActive) {
      const buyers = pids.map((_, i) => i).filter((i) => choices[i].buy);
      if (buyers.length === 0) {
        l.insurerActive = false;
        l.nextPremium = null;
        exited = true;
      } else l.nextPremium = premiumFor(mean(buyers.map((i) => pBase[i])), P);
    }
    const round: L3Round = {
      regime: l.regime,
      premium,
      T,
      choices: rec(choices),
      pEff: rec(pEff),
      events: rec(events),
      eventCards: Object.fromEntries(pids.map((id) => [id, flavorIndex(s.seed, `l3-${s.round}-${id}`, 9973)])),
      W: rec(W),
      nextPremium: l.nextPremium,
      // Play only: the insurer's price before an event's discount (E3 compares these, D-98).
      ...(isPlay(s) ? { listPrice, applied, gifts, giftNet, ...(bar ? { bar } : {}), ...(isLaunch(s) ? { launch: true } : {}) } : {}),
    };
    l.rounds.push(round);
    if (isPlay(s)) readRound(s, round);
    const nEvents = events.filter(Boolean).length;
    let key = 'l3.quiet';
    if (exited) key = 'l3.exit';
    else if (l.regime !== 'VOL') key = 'l3.mandatory';
    else if (before !== null && l.nextPremium !== null && l.nextPremium > before + 1e-9) key = 'l3.premiumUp';
    else if (nEvents * 2 >= pids.length) key = 'l3.manyEvents';
    finishRound(s, Wend, equalShares(pids.length), headline(s, key, { premium: Math.round(l.nextPremium ?? 0), events: nEvents }));
  },
  talkMenu(s, phase) {
    if (phase.step === 'REGIME') return { support: [...REGIMES], oppose: [], promise: [] };
    const promise = currentPremium(s) !== null ? ['BUY', 'GYM'] : ['GYM'];
    return { support: [], oppose: [], promise };
  },
  checkStep(_s, phase, msg) {
    if (msg.type === 'SUPPORT' && phase.step === 'REGIME') return 'REGIME';
    if (msg.type === 'PROMISE') return 'CHOICE';
    return undefined;
  },
  messageKept(_s, step, msg, d) {
    if (step === 'REGIME' && msg.type === 'SUPPORT') return msg.option === d;
    if (step === 'CHOICE' && msg.type === 'PROMISE') {
      const c = d as Choice;
      return msg.action === 'BUY' ? c.buy : c.gym;
    }
    return true;
  },
  botIntent(s, botId, phase) {
    const { rho } = botParams(s, botId);
    const me = playerOf(s, botId);
    const n = s.players.length;
    const i = idx(s, botId);
    if (phase.step === 'REGIME') {
      const ce = regimeCE(s, n, i, st(s).types[botId], me.values, rho);
      const order = REGIMES.map((r, k) => [r, ce[k]] as const).sort((a, b) => b[1] - a[1]);
      return { support: order[0][0], decoy: order[1][0] };
    }
    const l = st(s);
    const ctx = ctxOf(s);
    const { options, ce } = choiceCE(n, i, l.types[botId], me.values, rho, l.regime, currentPremium(s, ctx), ctx);
    const best = options[ce.indexOf(Math.max(...ce))];
    const menu = currentPremium(s, ctx) !== null ? ['BUY', 'GYM'] : ['GYM'];
    const yes = menu.filter((a) => (a === 'BUY' ? best.buy : best.gym));
    return { promise: yes, falsePromise: menu.filter((a) => !yes.includes(a)) };
  },
  observable: ['REGIME'],
  likelihood(s, _observer, actor, _step, decision, card) {
    const n = s.players.length;
    const probs = REGIMES.map(() => 0);
    // Play (D-128): the actor's worry card is private too, so the vote is read under both, equally likely.
    const mults = isPlay(s) ? [1, PLAY.WORRIER_STRESS_MULT] : [null];
    for (const type of ['LOW', 'HIGH'] as RiskType[])
      for (const m of mults) {
        const ce = regimeCE(s, n, idx(s, actor), type, card, BOT.BELIEF_RHO, m === null ? undefined : () => m);
        logitProbs(ce, BOT.BELIEF_LAMBDA).forEach((p, k) => (probs[k] += p / (2 * mults.length)));
      }
    return probs[REGIMES.indexOf(decision as Regime)] ?? 0;
  },
  debrief(s) {
    const l = st(s);
    const pids = ids(s);
    const nHigh = pids.filter((id) => l.types[id] === 'HIGH').length;
    const highShare = nHigh / pids.length;
    const dctx = ctxOf(s, false);
    const exp = expectedByType(nHigh, pids.length, false, dctx);
    const expNet = expectedByType(nHigh, pids.length, true, dctx);
    const best = (type: RiskType) => REGIMES.reduce((a, b) => (expNet[b][type] > expNet[a][type] + 1e-9 ? b : a), 'VOL' as Regime);
    const gym = { insured: [0, 0] as [number, number], uninsured: [0, 0] as [number, number], mandatory: [0, 0] as [number, number] };
    for (const r of l.rounds)
      for (const id of pids) {
        const c = r.choices[id];
        const bucket = r.regime !== 'VOL' ? gym.mandatory : c.buy ? gym.insured : gym.uninsured;
        bucket[1]++;
        if (c.gym) bucket[0]++;
      }
    const vol = l.rounds.filter((r) => r.regime === 'VOL');
    const byHuman = Object.fromEntries(s.players.filter((p) => p.isHuman).map((h) => [h.id, { cardBest: cardBestBuy(s, h.id) }]));
    const d: L3Debrief = {
      types: { ...l.types },
      rounds: l.rounds,
      premiumPath: l.rounds.map((r) => (r.regime === 'VOL' ? r.premium : null)),
      pools: l.rounds.map((r, k) => {
        const buyers = pids.filter((id) => r.choices[id].buy);
        return { round: k + 1, buyers, meanP: buyers.length ? mean(buyers.map((id) => r.pEff[id])) : null };
      }),
      gym,
      expectedByType: exp,
      volPath: voluntaryPath(nHigh, pids.length, dctx),
      highShare,
      regimeVotes: l.regimeVotes,
      regime: l.regime,
      bestRegimeForType: { LOW: best('LOW'), HIGH: best('HIGH') },
      byHuman,
      unraveled: vol.slice(0, dctx.p.VOLUNTARY_ROUNDS).some((r) => r.premium === null || pids.every((id) => !r.choices[id].buy)),
    };
    l.debrief = d;
    return d;
  },
  view(s, viewer, revealPrivate) {
    const l = st(s);
    return {
      myType: l.types[viewer],
      // Play v2: every risk type is public once leaked, and at the end reveal.
      types: revealPrivate || l.leaked || l.cardsRevealed ? l.types : undefined,
      ...(isPlay(s)
        ? {
            leaked: l.leaked ?? null,
            cardsRevealed: !!l.cardsRevealed,
            members: membersOf(s),
            myWorry: l.worry?.[viewer],
            // D-143: your own mission preview, while you decide your move.
            preview: s.phase.kind === 'DECIDE' && s.phase.step === 'CHOICE' && s.players.some((p) => p.id === viewer) ? missionPreview(s, viewer) : undefined,
            worry: revealPrivate || l.cardsRevealed ? l.worry : undefined,
          }
        : {}),
      regime: l.regime,
      insurerActive: l.insurerActive,
      premium: currentPremium(s),
      regimeVotes: l.regimeVotes,
      regimeCounts: l.regimeCounts,
      regimeTie: l.regimeTie,
      rounds: l.rounds.map((r) => ({ ...r, pEff: revealPrivate ? r.pEff : { [viewer]: r.pEff[viewer] } })),
      debrief: revealPrivate ? l.debrief : undefined,
    };
  },
};

/**
 * Simulator only (v2 Section 5, the deck trim rule): each bot's best cover and gym choice now (its highest
 * certainty equivalent), with this round's event or without it.
 */
export function bestOwnChoices(s: GameState, withEvent: boolean): Record<PlayerId, Choice> {
  const l = st(s);
  const ctx = ctxOf(s, withEvent);
  const out: Record<PlayerId, Choice> = {};
  for (const p of s.players) {
    if (p.isHuman) continue;
    const { rho } = botParams(s, p.id);
    const { options, ce } = choiceCE(s.players.length, idx(s, p.id), l.types[p.id], p.values, rho, l.regime, currentPremium(s, ctx), ctx);
    out[p.id] = options[ce.indexOf(Math.max(...ce))];
  }
  return out;
}
