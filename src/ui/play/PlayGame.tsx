// Play mode's screens (Play spec 7; redesign D-108). One beat per screen, one big element, one voice.
// Same screen flow as Study (src/shared/flow.ts): the beats inside a screen are presentation only, and the
// last beat's button performs that screen's one engine step.
import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { nameOf, shortName, useView } from '../game';
import { useMotionOff } from '../components/common';
import { LockedInPanel, useOnline, useWaiting } from '../components/Online';
import { screenDecisionPhase } from '../../shared/flow';
import { AutoButton, BannerContext, BigButton, Bubble, Stage, useStagePanel } from './OnAir';
import type { CastCue } from './Cast';
import { ChoicesDid } from './Choices';
import { HowItWorks } from './HowItWorks';
import { sfx } from './sound';
import { CardsReveal, ClaimScreen, MoveScreen, MyCardsBeat, RegimeScreen, WheelBeat, claimsOpen, regimeName, type L3View } from './Episode3';
import { eventText, hostLine, pick, timesWord, verbOn } from './logic';
import { CardsReveal1, ClaimScreen1, IncomesBeat, PeekScreen, VoteScreen1, summary1 } from './Episode1';
import { CardsReveal2, EffortScreen, IncomeScreen, MyCards2, PrizeBeat, PrizeScreen, TaxScreen, summary2 } from './Episode2';
import { AmendReveal, AmendScreen, ClaimScreen5, FairScreen, Finale, IncomesScreen, LobbyScreen, VeilScreen, WholeBankBeat, summary5 } from './Episode5';
import { LifeEnd } from './LifeEnd';
import { PlaytestPanel } from './Playtest';
import { onScreen, onTap, playtestOn } from '../playtest';
import { CardsReveal4, ClaimScreen4, HiresBeat, JudgeScreen, MyCards4, PolicyScreen, TrainScreen, summary4, type L4View } from './Episode4';
import type { NearMiss } from '../../engine/play/types';


/** E5 fix: the viewer's bank when this episode started (a life carries banks over; the summary used the life's start). */
function episodeStartBank(v: ViewState): number {
  const prev = v.play!.bankHistory.filter((h) => h.level < v.levelIndex).slice(-1)[0];
  return prev ? prev.banks[v.viewer] : v.play!.startingBank;
}

function EpisodeIntro({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  // UI V3 (U2): the episode fanfare.
  useEffect(() => {
    sfx('fanfare');
  }, [v.levelIndex]);
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.intro.go')}</BigButton>}>
      {/* UI V4 (V2): "How this episode works", the episode's one rules card. */}
      <HowItWorks v={v} />
      <Bubble who="Dash" host mood="excited" text={hostLine('welcome', (pick({ ...v, levelIndex: 1, round: 0 }, 'welcome', 6) + v.levelIndex) % 6)} />
    </Stage>
  );
}

/** UI V4 (V2): the round's event card as its own beat before the round's first decision. */
function EventBeat({ v, next }: { v: ViewState; next: () => void }) {
  const ev = v.play!.event!;
  const txt = eventText(v.levelIndex, ev.id, v.mode === 'LIFE');
  return (
    <Stage v={v} onTap={next} footer={<AutoButton onClick={next}>{t('play.stage.tap')}</AutoButton>}>
      <div className="my-auto" data-event={ev.id}>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.stage.eventLabel')}</p>
        <h1 className="h-show mt-1 text-hero leading-tight text-spot">{txt.name}</h1>
        <p className="mt-3 text-body font-semibold">{txt.effect}</p>
        <p className="mt-2 text-small italic text-soft">{txt.text}</p>
        <Bubble who="Dash" host mood="excited" text={hostLine('eventIntro', pick(v, 'eventIntro', 6), { event: txt.name })} />
      </div>
    </Stage>
  );
}

/**
 * The beats before a decision, then the decision. The round's first screen (the claim, or the move when
 * there is nothing to claim) carries the vote result and the event card; the move carries the claims.
 */
function DecisionFlow({ v }: { v: ViewState }) {
  const dp = screenDecisionPhase(v, v.queue);
  const dv = dp && dp !== v.phase ? { ...v, phase: dp } : v;
  const online = useOnline();
  const { done } = useWaiting(v);
  const stepId = dv.phase.step;
  const lv = v.levelView as L3View;
  const ev = v.play!.event;
  const first = stepId === 'CLAIM' || (stepId === 'CHOICE' && !claimsOpen(v));
  // UI V3 (U1): the claims show as speech bubbles on the move screen, so "The claims are in" is gone.
  let evBanner = false;
  const beats: Array<'cards'> = [];
  if (first && v.round === 1) beats.push('cards');
  if (first && ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) evBanner = true;
  const [k, setK] = useState(0);
  // V5 N3: last round's result (and the new price, and the vote) sits at the top of this round's first screen.
  const wrap = (x: JSX.Element) => (first && v.round > 1 ? <BannerContext.Provider value={<ChoicesDid v={v} carry extra={<Extra3 v={v} lv={lv} />} />}>{x}</BannerContext.Provider> : x);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) return <MyCardsBeat v={v} next={next} />;
  // UI V4 (V2): the event card is its own beat, so the decision screen keeps its words for the question.
  if (evBanner && k === beats.length) return <EventBeat v={v} next={next} />;
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  if (stepId === 'REGIME') return wrap(<RegimeScreen v={dv} />);
  if (stepId === 'CLAIM') return wrap(<ClaimScreen v={dv} />);
  return wrap(<MoveScreen v={dv} />);
}

/** UI V4 (V2): a screen whose decision is hidden in a life acts at once (the human's default) and shows nothing. */
function AutoAct({ v, value }: { v: ViewState; value: unknown }) {
  const act = useStore((s) => s.act);
  useEffect(() => {
    // Once per engine screen: React's strict mode runs effects twice in development, and the second run
    // finds the game already moved on.
    const g = useStore.getState().game;
    if (!g || g.phaseIdx !== v.phaseIdx || g.levelIndex !== v.levelIndex) return;
    act(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Episode 1's beats and decision screens (D-152). */
function DecisionFlow1({ v }: { v: ViewState }) {
  const online = useOnline();
  const { done } = useWaiting(v);
  const stepId = v.phase.step;
  const ev = v.play!.event;
  const firstScreen = stepId === 'PEEK' || stepId === 'FAIR_1' || (stepId === 'CLAIM' && v.round < PLAY.L1.PEEK_FROM_ROUND && v.mode !== 'LIFE');
  let evBanner = false;
  // V5 N3: the unborn beat is gone; the income deck it showed is the first line of the vote screen.
  const beats: string[] = [];
  if (firstScreen && ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) evBanner = true;
  const [k, setK] = useState(0);
  // V5 N3: round 1's result at the top of round 2's first screen.
  const wrap = (x: JSX.Element) => (firstScreen && v.round > 1 ? <BannerContext.Provider value={<ChoicesDid v={v} carry />}>{x}</BannerContext.Provider> : x);
  const next = () => setK((x) => x + 1);
  // UI V4 (V2): the event card is its own beat, so the decision screen keeps its words for the question.
  if (evBanner && k === beats.length) return <EventBeat v={v} next={next} />;
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  if (stepId === 'PEEK') return wrap(<PeekScreen v={v} />);
  if (stepId === 'FAIR_1') return wrap(<FairScreen v={v} />);
  // UI V4 (V2): in a life, claims unlock in Episode 2, so Episode 1's claim says nothing for you.
  if (stepId === 'CLAIM') return verbOn(v, 'claim') || online ? wrap(<ClaimScreen1 v={v} />) : <AutoAct v={v} value="SILENT" />;
  return wrap(<VoteScreen1 v={v} />);
}

/** V5 N3: one results screen per round (the rule that won, then the incomes); round 1's choices carry over. */
function ResultsFlow1({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  return <IncomesBeat v={v} last={v.round >= PLAY.L1.ROUNDS} next={() => act()} />;
}

/** Episode 2's beats and decision screens (D-153). */
function DecisionFlow2({ v }: { v: ViewState }) {
  const online = useOnline();
  const { done } = useWaiting(v);
  const stepId = v.phase.step;
  const ev = v.play!.event;
  const firstScreen = stepId === 'TAX' || (stepId === 'EFFORT' && v.round > 1);
  let evBanner = false;
  const beats: Array<'cards'> = [];
  if (firstScreen && v.round === 1) beats.push('cards');
  if (firstScreen && ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) evBanner = true;
  const [k, setK] = useState(0);
  // V5 N3: last round's result (and who won the prize) at the top of the next hours screen; your income this
  // round at the top of the prize vote (the incomes screen is folded in).
  const wrap = (x: JSX.Element) =>
    stepId === 'EFFORT' && v.round > 1 ? (
      <BannerContext.Provider value={<ChoicesDid v={v} carry extra={<Extra2 v={v} />} />}>{x}</BannerContext.Provider>
    ) : stepId === 'PRIZE' ? (
      <BannerContext.Provider value={<IncomeLine v={v} />}>{x}</BannerContext.Provider>
    ) : (
      x
    );
  const next = () => setK((x) => x + 1);
  if (k < beats.length) return <MyCards2 v={v} next={next} />;
  // UI V4 (V2): the event card is its own beat, so the decision screen keeps its words for the question.
  if (evBanner && k === beats.length) return <EventBeat v={v} next={next} />;
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  if (stepId === 'TAX') return wrap(<TaxScreen v={v} />);
  if (stepId === 'PRIZE') return wrap(<PrizeScreen v={v} />);
  return wrap(<EffortScreen v={v} />);
}

/** Episode 5's beats and decision screens (D-154). */
function DecisionFlow5({ v }: { v: ViewState }) {
  const online = useOnline();
  const { done } = useWaiting(v);
  const stepId = v.phase.step ?? '';
  const ev = v.play!.event;
  let evBanner = false;
  const beats: Array<'cards'> = [];
  if (stepId === 'VEIL') beats.push('cards');
  if (stepId === 'VEIL' && ev && ev.id !== 'QUIET' && ev.level === v.levelIndex) evBanner = true;
  const [k, setK] = useState(0);
  const wrap = (x: JSX.Element) =>
    stepId === 'FAIR_2' && v.mode === 'LIFE' ? <BannerContext.Provider value={<RulesLine v={v} />}>{x}</BannerContext.Provider> : x;
  const next = () => setK((x) => x + 1);
  if (k < beats.length) return <Finale v={v} next={next} />;
  // UI V4 (V2): the event card is its own beat, so the decision screen keeps its words for the question.
  if (evBanner && k === beats.length) return <EventBeat v={v} next={next} />;
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  if (stepId === 'VEIL') return wrap(<VeilScreen v={v} />);
  if (stepId.startsWith('FAIR')) return wrap(<FairScreen key={stepId} v={v} />);
  if (stepId === 'LOBBY') return wrap(<LobbyScreen v={v} />);
  if (stepId === 'CLAIM') return wrap(<ClaimScreen5 v={v} />);
  return wrap(<AmendScreen key={stepId} v={v} />);
}

/** V5 (D-214): the Second Chance, one screen before Episode 4: whoever is last on score gets the coins. No decision. */
function ComebackScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const cb = v.play!.comeback;
  if (!cb) return null;
  const mine = cb.pid === v.viewer;
  const name = shortName(v, cb.pid);
  const cue: CastCue = { stamps: { [cb.pid]: { text: `+${PLAY.SECOND_CHANCE_COINS}`, tone: 'good' } }, expr: { [cb.pid]: 'pleased' } };
  return (
    <Stage v={v} cast={cue} onTap={() => act()} footer={<BigButton onClick={() => act()}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-comeback>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.comeback.label')}</p>
        <h1 className="h-show mt-1 text-hero leading-tight text-spot">{mine ? t('play.comeback.title') : t('play.comeback.titleOther', { name })}</h1>
        <p className="mt-2 text-body">{mine ? t('play.comeback.you', { c: PLAY.SECOND_CHANCE_COINS }) : t('play.comeback.other', { name, c: PLAY.SECOND_CHANCE_COINS })}</p>
      </div>
    </Stage>
  );
}

/** Episode 4's beats and decision screens (D-151). */
function DecisionFlow4({ v }: { v: ViewState }) {
  const online = useOnline();
  const { done } = useWaiting(v);
  const stepId = v.phase.step;
  const lv = v.levelView as L4View;
  const ev = v.play!.event;
  const isFirstScreen = stepId === 'TRAIN' || (stepId === 'HIRE' && lv.judge === v.viewer);
  let evBanner = false;
  const beats: Array<'cards'> = [];
  if (isFirstScreen && v.round === 1) beats.push('cards');
  if (isFirstScreen && ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) evBanner = true;
  const [k, setK] = useState(0);
  // V5 N3: last round's result (and the new HireBot rule) at the top of this round's first screen.
  const wrap = (x: JSX.Element) => (isFirstScreen && v.round > 1 ? <BannerContext.Provider value={<ChoicesDid v={v} carry extra={<Extra4 v={v} lv={lv} />} />}>{x}</BannerContext.Provider> : x);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) return <MyCards4 v={v} next={next} />;
  // UI V4 (V2): the event card is its own beat, so the decision screen keeps its words for the question.
  if (evBanner && k === beats.length) return <EventBeat v={v} next={next} />;
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  if (stepId === 'POLICY') return wrap(<PolicyScreen v={v} />);
  if (stepId === 'CLAIM') return wrap(<ClaimScreen4 v={v} />);
  if (stepId === 'HIRE') return wrap(<JudgeScreen v={v} />);
  return wrap(<TrainScreen v={v} />);
}

/** V5 N3: one results screen per round; HireBot's new beliefs show on the next train screen. */
function ResultsFlow4({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  return <HiresBeat v={v} last={v.round >= Math.max(...v.queue.map((p) => p.round))} next={() => act()} />;
}

/** A round's results as beats: the Bar (if it voted), the wheel (everyone else in one row), then the price. */
/**
 * V5 N3: one results screen per round, the wheel (with the Bar's result on it). The price change shows at the
 * top of the next round's first screen, with last round's choices.
 */
function ResultsFlow({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  return <WheelBeat v={v} last={v.round >= Math.max(...v.queue.map((p) => p.round))} next={() => act()} />;
}

/** V5 N3: Episode 3's extra lines on the carried result: the new price of cover, and the big vote's result. */
function Extra3({ v, lv }: { v: ViewState; lv: L3View }) {
  const r = lv.rounds[lv.rounds.length - 1];
  const lines: string[] = [];
  if (r && r.regime === 'VOL' && r.premium !== null) {
    const from = r.listPrice ?? r.premium;
    const to = r.nextPremium;
    lines.push(to === null ? t('play.carry.priceGone') : t(to > from + 0.5 ? 'play.carry.priceUp' : to < from - 0.5 ? 'play.carry.priceDown' : 'play.carry.priceSame', { a: coins(from), b: coins(to) }));
  }
  if (lv.regimeVotes && v.round === PLAY.L3.VOLUNTARY_ROUNDS + 1) lines.push(t('play.carry.vote', { rule: regimeName(lv.regime) }));
  return lines.length ? <p className="text-small font-semibold text-spot" data-carry-extra>{lines.join(' ')}</p> : null;
}

/** V5 N3: Episode 2's extra line on the carried result: who won last round's Hustle Prize. */
function Extra2({ v }: { v: ViewState }) {
  const lv = v.levelView as { rounds: Array<{ winners?: string[] }> };
  const w = lv.rounds[lv.rounds.length - 1]?.winners ?? [];
  if (!w.length) return null;
  return <p className="text-small font-semibold text-spot" data-carry-extra>{t('play.carry.prize', { names: w.map((x) => shortName(v, x)).join(t('play.barBeat.and')) })}</p>;
}

/** V5 N3: Episode 4's extra line on the carried result: the HireBot rule the table chose. */
function Extra4({ v, lv }: { v: ViewState; lv: L4View }) {
  if (!lv.policyVotes || v.round !== PLAY.L4.BASELINE_ROUNDS + 1) return null;
  return <p className="text-small font-semibold text-spot" data-carry-extra>{t('play.carry.policy', { rule: t(`levels.4.policies.${lv.policy}.name`) })}</p>;
}

/** V5 N3: Episode 5's incomes screen folded into the next question, in a life: the rules the table wrote. */
function RulesLine({ v }: { v: ViewState }) {
  const lv = v.levelView as { adopted?: { t: number; F: number } };
  if (!lv.adopted) return null;
  return <p className="mb-2 rounded-2xl bg-card px-3 py-2 text-small font-semibold" data-carry>{t('play.carry.rules', { t: pct(lv.adopted.t), F: coins(lv.adopted.F) })}</p>;
}

/** V5 N3: Episode 2's incomes screen folded into the prize vote: your income this round, in one line. */
function IncomeLine({ v }: { v: ViewState }) {
  const c = (v.levelView as { current?: { y?: Record<string, number>; luck?: Record<string, number> } }).current;
  const y = c?.y?.[v.viewer];
  if (y === undefined) return null;
  const d = c?.luck?.[v.viewer] ?? 0;
  return <p className="mb-2 rounded-2xl bg-card px-3 py-2 text-small font-semibold" data-carry>{t('play.carry.income', { y: coins(y), d: `${d > 0 ? '+' : ''}${coins(d)}` })}</p>;
}

/** UI V4 (V3): one line on what helped and what hurt your bank most this episode (from its rounds' ledgers). */
function helpedHurt(v: ViewState): string | null {
  const sums: Record<string, number> = {};
  for (const h of v.play!.bankHistory.filter((x) => x.level === v.levelIndex))
    for (const l of h.ledger?.[v.viewer] ?? []) if (!['living', 'pay', 'other'].includes(l.k)) sums[l.k] = (sums[l.k] ?? 0) + l.n;
  const xs = Object.entries(sums).map(([k, n]) => ({ k, n: Math.round(n) }));
  const up = xs.filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
  const down = xs.filter((x) => x.n < 0).sort((a, b) => a.n - b.n)[0];
  const name = (k: string) => t(`play.ledger.k.${k === 'income' && v.mode === 'LIFE' && v.levelIndex === 5 ? 'incomeFinale' : k}`);
  const parts = [up ? t('play.summary.helped', { what: name(up.k), n: `+${up.n}` }) : '', down ? t('play.summary.hurt', { what: name(down.k), n: `−${-down.n}` }) : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/** UI V4 (V3), V5 N1: the score's change this episode as labelled pieces: the bank (and Second Chance points). */
function scorePieces(v: ViewState): Array<{ key: string; n: number }> {
  const pl = v.play!;
  const hist = pl.bankHistory;
  const recs = hist.filter((h) => h.level === v.levelIndex);
  if (!recs.length) return [];
  const i0 = hist.indexOf(recs[0]);
  const a = (i0 > 0 ? hist[i0 - 1].parts : hist[0].partsStart)?.[v.viewer];
  const b = recs[recs.length - 1].parts?.[v.viewer];
  if (!a || !b) return [];
  return [
    { key: 'bank', n: Math.round(b.bank - a.bank) },
    { key: 'bonus', n: Math.round(b.bonus - a.bonus) },
  ].filter((x) => x.n !== 0 || x.key === 'bank');
}

/**
 * V5 N1: the score is the bank (plus Second Chance points). It shows as one number with the episode's change
 * flying in as labelled pieces (UI V4 V3); the words behind it are one tap away ("See the money").
 */
export function ScoreBar({ v, words, pieces = [] }: { v: ViewState; words: ReactNode; pieces?: Array<{ key: string; n: number }> }) {
  const open = useStagePanel();
  const off = useMotionOff();
  const sc = v.play!.score;
  if (!sc) return null;
  const onWords = () => open?.({ title: t('play.score.wordsTitle'), body: words });
  return (
    <div className="flex items-center gap-3" data-scorebar>
      <span className="text-small font-bold uppercase tracking-wider text-soft">{t('play.summary.scoreLabel')}</span>
      <span className="h-show text-title">{coins(sc.total)}</span>
      <span className="flex flex-wrap gap-1" data-score-pieces>
        {pieces.map((p, i) => (
          <motion.span
            key={p.key}
            className={`rounded-full px-1.5 text-small font-bold leading-snug ${p.n < 0 ? 'bg-stamp text-onspot' : 'bg-spot text-onspot'}`}
            initial={off ? false : { y: 36, opacity: 0, scale: 1.3 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: off ? 0 : 0.6, delay: off ? 0 : 0.4 + 0.35 * i, ease: 'easeOut' }}
            data-piece={p.key}
          >
            {t(`play.score.piece.${p.key}`, { n: p.n > 0 ? `+${p.n}` : p.n < 0 ? `−${-p.n}` : '0' })}
          </motion.span>
        ))}
      </span>
      <button type="button" className="ms-auto min-h-[44px] text-small font-semibold underline" onClick={onWords} data-score-words>
        {t('play.score.words')}
      </button>
    </div>
  );
}

/** The near miss as one sentence (v2 Section 6.1): your own change only. */
function nearMissText(v: ViewState, nm: NearMiss): string {
  let change = '';
  if (nm.kind === 'CHOICE') {
    const from = nm.from as { buy: boolean; gym: boolean };
    const to = nm.to as { buy: boolean; gym: boolean };
    const parts: string[] = [];
    if (from.buy !== to.buy) parts.push(t(to.buy ? 'play.nm.buy' : 'play.nm.out'));
    if (from.gym !== to.gym) parts.push(t(to.gym ? 'play.nm.gym' : 'play.nm.noGym'));
    change = parts.length === 2 ? t('play.nm.and', { a: parts[0], b: parts[1].charAt(0).toLowerCase() + parts[1].slice(1) }) : parts[0];
  } else if (nm.kind === 'BAR') change = nm.to ? t('play.nm.bar', { name: nameOf(v, nm.to as string) }) : t('play.nm.barNone');
  else if (nm.kind === 'CLAIM' && v.levelIndex === 3) change = nm.to === 'SILENT' ? t('play.nm.silent') : t('play.nm.claim', { claim: t(`play.claims.RISK.${nm.to as string}`) });
  else if (nm.kind === 'PEEK') change = t(nm.to ? 'play.nm.peek' : 'play.nm.noPeek');
  else if (nm.kind === 'VOTE') change = t('play.nm.vote', { name: t(`play.l1.rule.${nm.to as string}.name`) });
  else if (nm.kind === 'TRAIN') change = t(nm.to ? 'play.nm.train' : 'play.nm.noTrain');
  else if (nm.kind === 'HIRE') {
    const x = nm.to as { worker: string; job: string };
    change = t(x.job === 'COMPLEX' ? 'play.nm.hireComplex' : 'play.nm.hireSimple', { name: nameOf(v, x.worker) });
  } else if (nm.kind === 'POLICY') change = t('play.nm.policy', { name: t(`levels.4.policies.${nm.to as string}.name`) });
  else if (nm.kind === 'DONATE') change = t('play.nm.noDonate');
  else if (nm.kind === 'TAX') change = t('play.nm.tax', { t: pct(nm.to as number) });
  else if (nm.kind === 'EFFORT') change = t('play.nm.effort', { e: nm.to as number });
  else if (nm.kind === 'PRIZE') change = t('play.nm.prize', { name: nameOf(v, nm.to as string) });
  else if (nm.kind === 'CLAIM' && v.levelIndex === 2) change = nm.to === 'SILENT' ? t('play.nm.silent') : t('play.nm.claim', { claim: t(`play.l2.band.${nm.to as string}`) });
  else if (nm.kind === 'CLAIM' && v.levelIndex === 4) change = t(nm.to === 'SILENT' ? 'play.nm.silent' : 'play.nm.claimT');
  else change = t('play.nm.regime', { name: regimeName(nm.to as 'VOL' | 'M50' | 'M100') });
  return t('play.nm.line', { change, r: nm.round, n: nm.gain });
}

/** v2 Section 6.3: one screen, no tables. Biggest lie, biggest wrong read, your score, near miss. */
function EpisodeSummary({ v }: { v: ViewState }) {
  const { go, replay, online, leaveOnline, act } = useStore();
  const pl = v.play!;
  const lv = v.levelView as L3View;
  const types = lv.types ?? {};
  const res = v.levelResults[v.levelIndex] as { nearMiss?: NearMiss | null } | undefined;
  const nm = res?.nearMiss ?? null;
  // Biggest lie: the contestant with the most claims stamped LIE. Biggest wrong read: the audience's
  // final belief furthest from the truth.
  const lies = v.players
    .map((p) => {
      const ms = v.messages.filter((x) => x.level === v.levelIndex && x.from === p.id && x.msg.type === 'CLAIM' && x.resolved && x.kept === false);
      return { id: p.id, n: ms.length, value: ms[0]?.msg.type === 'CLAIM' ? ms[0].msg.value : '' };
    })
    .sort((a, b) => b.n - a.n)[0];
  const poll = pl.poll ?? {};
  const read = v.players
    .filter((p) => poll[p.id] !== undefined)
    .map((p) => ({ id: p.id, b: poll[p.id], wrong: Math.abs(poll[p.id] - (types[p.id] === 'HIGH' ? 1 : 0)) }))
    .sort((a, b) => b.wrong - a.wrong)[0];
  const lieText = v.levelIndex === 4 ? summary4(v).lie : v.levelIndex === 1 ? summary1(v).lie : v.levelIndex === 2 ? summary2(v).lie : v.levelIndex === 5 ? summary5(v).lie : lies && lies.n
      ? t(lies.id === v.viewer ? 'play.summary.lieYou' : 'play.summary.lie', { name: nameOf(v, lies.id), claim: t(`play.claim.short.${lies.value}`).toLowerCase(), n: timesWord(lies.n), truth: t(`play.cards.${types[lies.id]}`).toLowerCase() })
      : t('play.summary.noLie');
  const readText =
    read && read.wrong >= 0.5
      ? t(read.id === v.viewer ? 'play.summary.readYou' : 'play.summary.read', {
          name: nameOf(v, read.id),
          p: pct(read.b >= 0.5 ? read.b : 1 - read.b),
          said: t(read.b >= 0.5 ? 'play.cards.HIGH' : 'play.cards.LOW').toLowerCase(),
          truth: t(`play.cards.${types[read.id]}`).toLowerCase(),
        })
      : t('play.summary.noRead');
  const menu = () => {
    if (online) return leaveOnline();
    if (v.phase.kind === 'LEVEL_DEBRIEF') act();
    go('title');
  };
  const row = (label: string, text: string, cls = '') => (
    <div>
      <dt className="text-small font-bold uppercase tracking-wider text-soft">{label}</dt>
      <dd className={`text-small font-semibold leading-snug ${cls}`}>{text}</dd>
    </div>
  );
  // V5 N3: at most 50 words: the score and its change (with your place), what helped and hurt most, the biggest
  // lie and the near miss. The ranking bars, the wrong read, "What was really going on?" (now in the menu) and
  // the challenge code left this screen.
  const rk = pl.finalScores ? 1 + v.players.filter((p) => (pl.finalScores![p.id] ?? 0) > (pl.finalScores![v.viewer] ?? 0) + 1e-9).length : pl.ranks?.[v.viewer] ?? 1;
  const hh = helpedHurt(v);
  void readText;
  return (
    <Stage
      v={v}
      cast={false}
      footer={
        v.mode === 'LIFE' && v.phase.kind === 'LEVEL_DEBRIEF' ? (
          <BigButton onClick={() => act()}>{v.levelIndex < 5 ? t('play.life.next', { n: v.levelIndex + 1 }) : t('play.life.receipts')}</BigButton>
        ) : (
          <div className="flex gap-2">
            {!online && (
              <button type="button" className="min-h-[52px] flex-1 rounded-full bg-card font-bold" onClick={() => { onTap('again'); replay(false); }}>
                {t('play.summary.again')}
              </button>
            )}
            <div className="flex-1">
              <BigButton onClick={menu}>{t('play.summary.menu')}</BigButton>
            </div>
          </div>
        )
      }
    >
      <div className="my-auto" data-ranking>
        <ScoreBar v={v} words={<ScoreWords v={v} />} pieces={scorePieces(v)} />
        <p className="text-body font-semibold" data-place>{t('play.summary.place', { r: rk, n: v.players.length })}</p>
        <dl className="mt-3 space-y-2" data-summary>
          {hh && row(t('play.summary.helpedLabel'), hh)}
          {row(t('play.summary.lieLabel'), lieText)}
          {row(t('play.summary.nearMiss'), nm ? nearMissText(v, nm) : t('play.summary.nearMissNone'))}
        </dl>
        {playtestOn() && <PlaytestPanel v={v} />}
      </div>
    </Stage>
  );
}

function ScoreWords({ v }: { v: ViewState }) {
  const pl = v.play!;
  const sc = pl.score!;
  return (
    <>
      <p data-score-text>{t('play.summary.bankChange', { from: coins(episodeStartBank(v)), to: coins(pl.banks[v.viewer]) })}</p>
      <p>{t(sc.bank === pl.banks[v.viewer] ? 'play.score.isBank' : 'play.score.isBankSince', { s: coins(sc.total), b: coins(sc.bank), p: coins(sc.bonus) })}</p>
      {sc.bonus > 0 && <p>{t('play.score.bonusLine', { p: coins(sc.bonus) })}</p>}
      {v.mode === 'LIFE' && PLAY.LIFE_BANK_FROM === 'EP1_END' && <p data-birth-note>{t('play.cast.birthNotScored')}</p>}
      {v.seed && <p className="text-soft">{t('play.summary.seed', { seed: v.seed })}</p>}
    </>
  );
}

export function PlayGameScreen() {
  const v = useView();
  const online = useOnline();
  const off = useMotionOff();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: off ? 'auto' : 'smooth' });
  }, [v?.phaseIdx, v?.levelIndex, v?.phase.kind, off]);
  // F1: time per engine screen, in playtest mode only (onScreen does nothing otherwise).
  useEffect(() => {
    if (v) onScreen(`ep${v.levelIndex}:${v.phase.kind}:${v.phase.step ?? ''}`, v.phase.kind === 'LEVEL_DEBRIEF' || v.phase.kind === 'RUN_DEBRIEF');
  }, [v?.phaseIdx, v?.levelIndex, v?.phase.kind]);
  if (!v || !v.play) return null;
  const k = v.phase.kind;
  const next = v.queue[v.phaseIdx + 1];
  if (k === 'INTRO') return <EpisodeIntro v={v} />;
  if (v.mode === 'LIFE' && (k === 'RUN_DEBRIEF' || k === 'END')) return <LifeEnd v={v} />;
  if (k === 'LEVEL_DEBRIEF' || k === 'END') return <EpisodeSummary v={v} />;
  if (v.levelIndex === 5) {
    if (k === 'DECIDE') return <DecisionFlow5 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    // V5 N3: in a life the incomes are the banks (on the podiums), so the rules the table wrote become one line on
    // the next screen.
    if (k === 'REVEAL' && v.phase.step === 'INCOMES') return v.mode === 'LIFE' && !online ? <AutoAct v={v} value={undefined} /> : <IncomesScreen v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'AMENDMENTS') return <AmendReveal v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'WHOLE_BANK') return <WholeBankBeat v={v} />;
    return null;
  }
  if (v.levelIndex === 2) {
    if (k === 'DECIDE') return <DecisionFlow2 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    // V5 N3: the incomes screen folds into the prize vote (your income line on top), and rounds 1 and 2's prize
    // result into the next hours screen; the last round keeps its result screen. Rooms keep every screen.
    if (k === 'REVEAL' && v.phase.step === 'INCOME') return online ? <IncomeScreen v={v} /> : <AutoAct v={v} value={undefined} />;
    if (k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY')
      return online || v.round >= PLAY.L2.ROUNDS ? <PrizeBeat v={v} next={() => useStore.getState().act()} /> : <AutoAct v={v} value={undefined} />;
    if (k === 'REVEAL' && v.phase.step === 'CARDS') return <CardsReveal2 v={v} />;
    return null;
  }
  if (v.levelIndex === 1) {
    if (k === 'DECIDE') return <DecisionFlow1 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    if (k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY') return <ResultsFlow1 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'CARDS') return <CardsReveal1 v={v} />;
    return null;
  }
  if (v.levelIndex === 4) {
    if (k === 'DECIDE') return <DecisionFlow4 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'COMEBACK') return <ComebackScreen v={v} />;
    if (k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY') return <ResultsFlow4 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'CARDS') return <CardsReveal4 v={v} />;
    return null;
  }
  if (k === 'TALK' || k === 'DECIDE') return <DecisionFlow key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
  if (k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY') return <ResultsFlow key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
  if (k === 'REVEAL' && v.phase.step === 'CARDS') return <CardsReveal v={v} />;
  return null;
}

