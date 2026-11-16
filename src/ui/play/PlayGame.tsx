// Play mode's screens (Play spec 7; redesign D-108). One beat per screen, one big element, one voice.
// Same screen flow as Study (src/shared/flow.ts): the beats inside a screen are presentation only, and the
// last beat's button performs that screen's one engine step.
import { useEffect, useState } from 'react';
import type { ValuesCard, ViewState } from '../../engine/types';
import { VALUES_CARDS } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import en from '../copy/en.json';
import { coins, pct } from '../labels';
import { nameOf, shortName, useView } from '../game';
import { FlipCard, useMotionOff } from '../components/common';
import { Sheet as TableSheet } from '../components/TableParts';
import { LockedInPanel, useOnline, useWaiting } from '../components/Online';
import { screenDecisionPhase } from '../../shared/flow';
import { BannerContext, BigButton, Bubble, Face, Stage } from './OnAir';
import { sfx } from './sound';
import { BarBeat, CardsReveal, ClaimScreen, MoveScreen, MyCardsBeat, PriceBeat, RegimeScreen, VoteInBeat, WheelBeat, claimsOpen, hasPriceBeat, regimeName, type L3View } from './Episode3';
import { eventText, hostLine, missionName, pick, timesWord } from './logic';
import { CardsReveal1, ClaimScreen1, IncomesBeat, PeekScreen, Unborn, VoteScreen1, VotesBeat, summary1 } from './Episode1';
import { CardsReveal2, TaxIn, EffortScreen, IncomeScreen, MyCards2, PrizeBeat, PrizeScreen, TaxScreen, summary2 } from './Episode2';
import { AmendReveal, AmendScreen, ClaimScreen5, FairScreen, Finale, IncomesScreen, LobbyScreen, VeilScreen, summary5 } from './Episode5';
import { LifeEnd } from './LifeEnd';
import { PlaytestPanel } from './Playtest';
import { onScreen, onTap, playtestOn } from '../playtest';
import { BeliefBeat, CardsReveal4, ClaimScreen4, HiresBeat, JudgeScreen, MyCards4, PolicyIn, PolicyScreen, TrainScreen, summary4, type L4View } from './Episode4';
import type { NearMiss } from '../../engine/play/types';


/** E5 fix: the viewer's bank when this episode started (a life carries banks over; the summary used the life's start). */
function episodeStartBank(v: ViewState): number {
  const prev = v.play!.bankHistory.filter((h) => h.level < v.levelIndex).slice(-1)[0];
  return prev ? prev.banks[v.viewer] : v.play!.startingBank;
}

/** How many "What was really going on?" lines an episode has. */
const reallyCount = (level: number) => ((en as unknown as { play: { really: Record<string, string[]> } }).play.really[`L${level}`] ?? []).length;

/** "What was really going on?": three lines on the mechanism (Play spec 7.5). */
function ReallySheet({ v, onClose }: { v: ViewState; onClose: () => void }) {
  const online = useOnline();
  const chooseMode = useStore((s) => s.chooseMode);
  return (
    <TableSheet title={t('play.really.button')} closeLabel={t('play.really.close')} onClose={onClose}>
      <ul className="space-y-2" data-really>
        {Array.from({ length: reallyCount(v.levelIndex) }, (_, i) => i).map((i) => (
          <li key={i}>{t(`play.really.L${v.levelIndex}.${i}`)}</li>
        ))}
      </ul>
      {!online && (
        <button type="button" className="font-semibold underline" onClick={() => chooseMode('SINGLE_LEVEL', v.levelIndex)}>
          {t('play.really.link')}
        </button>
      )}
    </TableSheet>
  );
}

/** Intros already shown on the mission screen (UI V3 U3): that INTRO moves on by itself. */
const introMerged = new Set<string>();
const introKey = (v: ViewState, level: number) => `${v.seed ?? ''}|${v.mode}|${level}`;

/**
 * UI V3 (U3): your secret mission and the first episode's intro on one screen, so the first decision comes
 * sooner. "Roll the cameras" accepts the mission and the intro then moves on by itself (not in rooms).
 */
function MissionReveal({ v }: { v: ViewState }) {
  const me = v.players.find((p) => p.id === v.viewer)!;
  const off = useMotionOff();
  const online = useOnline();
  const [flipped, setFlipped] = useState(off);
  const act = useStore((s) => s.act);
  // In Play the mission is dealt once, right before the first episode's intro.
  const merge = !online;
  const level = v.levelIndex;
  if (merge) introMerged.add(introKey(v, level));
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), off ? 0 : 400);
    return () => clearTimeout(id);
  }, [off]);
  return (
    <Stage v={v} bar={false} footer={<BigButton onClick={() => act()}>{merge ? t('play.intro.go') : t('play.values.accept')}</BigButton>}>
      <FlipCard
        className="mx-auto mt-2 h-44 w-full"
        flipped={flipped}
        back={
          <div className="flex h-full items-center justify-center rounded-3xl bg-card">
            <span className="h-show text-title text-spot">{t('play.show')}</span>
          </div>
        }
        front={
          <div className="flex h-full flex-col justify-center rounded-3xl bg-spot p-5 text-onspot">
            <p className="text-small font-bold uppercase tracking-wider">{t('play.values.title')}</p>
            <p className="h-show mt-1 text-hero leading-none">{missionName(me.values!)}</p>
            <p className="mt-2 text-small">{t(`play.missions.${me.values}.line`)}</p>
          </div>
        }
      />
      <p className="mt-2 text-center text-small text-soft">{t('play.values.private')}</p>
      {merge && (
        <div className="mt-3" data-intro-merged>
          <p className="text-small font-bold uppercase tracking-wider text-soft">
            {t('play.modes.ep', { n: level })} · {t(`play.episodes.${level}.sponsor`)}{v.difficulty !== 'NORMAL' ? ` · ${t(`play.setup.badge.${v.difficulty}`)}` : ''}
          </p>
          <h1 className="h-show text-title leading-none text-spot">{t(`play.episodes.${level}.name`)}</h1>
          <p className="mt-2 text-small leading-snug" data-intro>
            {t(v.mode === 'LIFE' && level === 5 ? 'play.episodes.5.introLife' : `play.episodes.${level}.intro`, { loss: v.play!.l3?.loss ?? 0 })}
          </p>
          <div className="mt-2">
            <Bubble who="Dash" host mood="excited" text={hostLine('welcome', (pick({ ...v, levelIndex: 1, round: 0 }, 'welcome', 6) + level) % 6)} />
          </div>
        </div>
      )}
    </Stage>
  );
}

function EpisodeIntro({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const n = v.play!.l3;
  const merged = introMerged.has(introKey(v, v.levelIndex));
  // UI V3 (U2): the episode fanfare; (U3) an intro already shown with the mission moves straight on.
  useEffect(() => {
    if (merged) {
      introMerged.delete(introKey(v, v.levelIndex));
      act();
      return;
    }
    sfx('fanfare');
  }, [v.levelIndex]);
  if (merged) return null;
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.intro.go')}</BigButton>}>
      <p className="text-small font-bold uppercase tracking-wider text-soft">
        {t('play.modes.ep', { n: v.levelIndex })} · {t(`play.episodes.${v.levelIndex}.sponsor`)}{v.difficulty !== 'NORMAL' ? ` · ${t(`play.setup.badge.${v.difficulty}`)}` : ''}
      </p>
      <h1 className="h-show mt-1 text-hero leading-none text-spot">{t(`play.episodes.${v.levelIndex}.name`)}</h1>
      <p className="mt-3 text-body leading-snug" data-intro>
        {t(v.mode === 'LIFE' && v.levelIndex === 5 ? 'play.episodes.5.introLife' : `play.episodes.${v.levelIndex}.intro`, { loss: n?.loss ?? 0 })}
      </p>
      <div className="mt-auto pt-4">
        <Bubble who="Dash" host mood="excited" text={hostLine('welcome', (pick({ ...v, levelIndex: 1, round: 0 }, 'welcome', 6) + v.levelIndex) % 6)} />
      </div>
    </Stage>
  );
}

/** UI V3 (U3): the event card as a banner on the round's first screen; it opens to the joke and Dash's line. */
function EventBanner({ v }: { v: ViewState }) {
  const ev = v.play!.event!;
  const txt = eventText(v.levelIndex, ev.id, v.mode === 'LIFE');
  return (
    <details className="mb-2 rounded-2xl border-2 border-spot bg-card px-3 py-1.5" data-event={ev.id} data-event-banner>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2">
        <span className="rounded-full bg-spot px-2 text-small font-bold uppercase text-onspot">{t('play.stage.eventLabel')}</span>
        <span className="flex-1 text-small font-semibold leading-snug">
          <span className="h-show text-body text-spot">{txt.name}.</span> {txt.effect}
        </span>
      </summary>
      <p className="mt-1 text-small italic text-soft">{txt.text}</p>
      <div className="mt-1 pb-1">
        <Bubble who="Dash" host mood="excited" text={hostLine('eventIntro', pick(v, 'eventIntro', 6), { event: txt.name })} />
      </div>
    </details>
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
  const beats: Array<'cards' | 'vote'> = [];
  if (first && v.round === 1) beats.push('cards');
  if (first) {
    if (v.round === PLAY.L3.VOLUNTARY_ROUNDS + 1 && lv.regimeVotes) beats.push('vote');
    if (ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) evBanner = true;
  }
  const [k, setK] = useState(0);
  const wrap = (x: JSX.Element) => (evBanner ? <BannerContext.Provider value={<EventBanner v={v} />}>{x}</BannerContext.Provider> : x);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) {
    const b = beats[k];
    if (b === 'cards') return <MyCardsBeat v={v} next={next} />;
    return <VoteInBeat v={v} next={next} />;
  }
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

/** Episode 1's beats and decision screens (D-152). */
function DecisionFlow1({ v }: { v: ViewState }) {
  const online = useOnline();
  const { done } = useWaiting(v);
  const stepId = v.phase.step;
  const ev = v.play!.event;
  const firstScreen = stepId === 'PEEK' || stepId === 'FAIR_1' || (stepId === 'CLAIM' && v.round < PLAY.L1.PEEK_FROM_ROUND && v.mode !== 'LIFE');
  let evBanner = false;
  const beats: Array<'cards'> = [];
  if (firstScreen && v.round === 1) beats.push('cards');
  if (firstScreen && ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) evBanner = true;
  const [k, setK] = useState(0);
  const wrap = (x: JSX.Element) => (evBanner ? <BannerContext.Provider value={<EventBanner v={v} />}>{x}</BannerContext.Provider> : x);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) {
    return <Unborn v={v} next={next} />;
  }
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  if (stepId === 'PEEK') return wrap(<PeekScreen v={v} />);
  if (stepId === 'FAIR_1') return wrap(<FairScreen v={v} />);
  if (stepId === 'CLAIM') return wrap(<ClaimScreen1 v={v} />);
  return wrap(<VoteScreen1 v={v} />);
}

function ResultsFlow1({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [k, setK] = useState(0);
  if (k === 0) return <VotesBeat v={v} next={() => setK(1)} />;
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
  const beats: Array<'cards' | 'tax'> = [];
  if (firstScreen && v.round === 1) beats.push('cards');
  if (stepId === 'EFFORT' && v.round === 1) beats.push('tax');
  if (firstScreen && ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) evBanner = true;
  const [k, setK] = useState(0);
  const wrap = (x: JSX.Element) => (evBanner ? <BannerContext.Provider value={<EventBanner v={v} />}>{x}</BannerContext.Provider> : x);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) return beats[k] === 'cards' ? <MyCards2 v={v} next={next} /> : <TaxIn v={v} next={next} />;
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
  const wrap = (x: JSX.Element) => (evBanner ? <BannerContext.Provider value={<EventBanner v={v} />}>{x}</BannerContext.Provider> : x);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) return <Finale v={v} next={next} />;
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

/** v1 Section 6.3: the comeback card, offered on air to the contestant in last place after Episode 3. */
function ComebackScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  return (
    <Stage v={v} footer={null}>
      <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.comeback.label')}</p>
      <h1 className="h-show mt-1 text-hero leading-tight text-spot">{t('play.comeback.title')}</h1>
      <p className="mt-2 text-body">{t('play.comeback.how', { c: PLAY.COMEBACK.COINS, p: PLAY.COMEBACK.POINTS })}</p>
      <p className="mt-2 text-small">{t('play.comeback.rate', { c: PLAY.COMEBACK.COINS, half: PLAY.COMEBACK.COINS * PLAY.BANK_WEIGHT })}</p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <BigButton onClick={() => act('COINS')}>{t('play.comeback.coins', { c: PLAY.COMEBACK.COINS })}</BigButton>
        <BigButton onClick={() => act('POINTS')}>{t('play.comeback.points', { p: PLAY.COMEBACK.POINTS })}</BigButton>
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
  const beats: Array<'cards' | 'vote'> = [];
  if (isFirstScreen && v.round === 1) beats.push('cards');
  if (isFirstScreen && v.round === PLAY.L4.BASELINE_ROUNDS + 1 && lv.policyVotes) beats.push('vote');
  if (isFirstScreen && ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) evBanner = true;
  const [k, setK] = useState(0);
  const wrap = (x: JSX.Element) => (evBanner ? <BannerContext.Provider value={<EventBanner v={v} />}>{x}</BannerContext.Provider> : x);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) {
    const b = beats[k];
    if (b === 'cards') return <MyCards4 v={v} next={next} />;
    return <PolicyIn v={v} next={next} />;
  }
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  if (stepId === 'COMEBACK') return wrap(<ComebackScreen v={v} />);
  if (stepId === 'POLICY') return wrap(<PolicyScreen v={v} />);
  if (stepId === 'CLAIM') return wrap(<ClaimScreen4 v={v} />);
  if (stepId === 'HIRE') return wrap(<JudgeScreen v={v} />);
  return wrap(<TrainScreen v={v} />);
}

function ResultsFlow4({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [k, setK] = useState(0);
  const [really, setReally] = useState(false);
  if (k === 0) return <HiresBeat v={v} last={false} next={() => setK(1)} />;
  return (
    <>
      <BeliefBeat v={v} next={() => act()} onReally={() => setReally(true)} />
      {really && <ReallySheet v={v} onClose={() => setReally(false)} />}
    </>
  );
}

/** A round's results as beats: the Bar (if it voted), the wheel (everyone else in one row), then the price. */
function ResultsFlow({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const price = hasPriceBeat(v);
  const lv = v.levelView as L3View;
  const bar = !!lv.rounds[lv.rounds.length - 1]?.bar;
  const [k, setK] = useState(bar ? -1 : 0);
  const [really, setReally] = useState(false);
  if (k === -1) return <BarBeat v={v} next={() => setK(0)} />;
  if (k === 0) return <WheelBeat v={v} last={!price} next={() => (price ? setK(1) : act())} />;
  return (
    <>
      <PriceBeat v={v} next={() => act()} onReally={() => setReally(true)} />
      {really && <ReallySheet v={v} onClose={() => setReally(false)} />}
    </>
  );
}

/** Section 7.4: guess one other contestant's mission. */
function EpisodeGuess({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const others = v.players.filter((p) => p.id !== v.viewer);
  const [target, setTarget] = useState('');
  const [card, setCard] = useState<ValuesCard | null>(null);
  return (
    <Stage
      v={v}
      footer={
        <div className="flex gap-2">
          <button type="button" className="min-h-[52px] flex-1 rounded-full bg-card font-bold" onClick={() => act(undefined, {})}>
            {t('play.guess.skip')}
          </button>
          <div className="flex-[2]">
            <BigButton disabled={!card || !target} onClick={() => card && target && act(undefined, { [target]: card })}>
              {t('play.guess.submit')}
            </BigButton>
          </div>
        </div>
      }
    >
      <h1 className="h-show text-hero">{t('play.guess.title')}</h1>
      <p className="mt-1 text-small text-soft">{t('play.guess.intro', { pts: PLAY.GUESS_POINTS })}</p>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={t('play.guess.pick')}>
        {others.map((p) => (
          <button key={p.id} type="button" aria-pressed={target === p.id} onClick={() => setTarget(p.id)} className={`flex flex-col items-center gap-1 rounded-2xl p-2 ${target === p.id ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <Face v={v} p={p} size={32} />
            <span className="truncate text-small font-bold">{shortName(v, p.id)}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={t('play.guess.mission')}>
        {VALUES_CARDS.map((c) => (
          <button key={c} type="button" aria-pressed={card === c} onClick={() => setCard(c)} className={`min-h-[64px] rounded-2xl p-2 text-start ${card === c ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show text-lead leading-tight">{missionName(c)}</span>
            <span className="block text-small">{t(`play.guess.tell.${c}`)}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** v2 Section 10 fix 3, UI V3 (U3): the card guess's result and the ranking, now part of the one summary screen. */
function RankBlock({ v }: { v: ViewState }) {
  const pl = v.play!;
  const scores = pl.finalScores ?? {};
  // AI playtest (T7): in a life the cards stay hidden until the end, so rank by the public ranks, without scores.
  const hidden = !pl.finalScores;
  const rk = pl.ranks ?? {};
  const ranked = v.players.slice().sort((a, b) => (hidden ? (rk[a.id] ?? 9) - (rk[b.id] ?? 9) : (scores[b.id] ?? 0) - (scores[a.id] ?? 0)));
  const myGuess = pl.guesses[v.levelIndex]?.[v.viewer];
  const guessLine = myGuess
    ? `${hostLine(myGuess.correct ? 'guessRight' : 'guessWrong', pick(v, 'guess', 6), { name: nameOf(v, myGuess.target) })} ${t('play.guess.youGuessed', { name: shortName(v, myGuess.target), card: missionName(myGuess.card) })}`
    : hostLine('guessNone', pick(v, 'guess', 6));
  return (
    <div data-missions>
      <p className="h-show text-lead leading-tight text-spot">{ranked[0].id === v.viewer ? t(hidden ? 'play.summary.leadYou' : 'play.summary.winnerYou') : t(hidden ? 'play.summary.lead' : 'play.summary.winner', { name: shortName(v, ranked[0].id) })}</p>
      <ol className="mt-1 space-y-1" aria-label={t('play.stage.ranking')}>
        {ranked.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-2 rounded-xl px-2 py-0.5 ${p.id === v.viewer ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show w-4 text-body">{i + 1}</span>
            <Face v={v} p={p} size={24} ring={false} />
            <span className="w-20 truncate text-small font-bold">{shortName(v, p.id)}</span>
            <span className="flex-1 truncate text-small">{p.values ? missionName(p.values) : ''}</span>
            {!hidden && <span className="h-show w-10 text-end text-body">{coins(scores[p.id] ?? 0)}</span>}
            {hidden && p.id === v.viewer && <span className="h-show w-10 text-end text-body">{coins(pl.mission?.score ?? 0)}</span>}
          </li>
        ))}
      </ol>
      {hidden && pl.gaps && (
        <p className="mt-1 text-small" data-gaps>
          {[pl.gaps.above !== null ? t(pl.gaps.above ? 'play.summary.gapAbove' : 'play.summary.gapAboveClose', { n: pl.gaps.above }) : '', pl.gaps.below !== null ? t(pl.gaps.below ? 'play.summary.gapBelow' : 'play.summary.gapBelowClose', { n: pl.gaps.below }) : ''].filter(Boolean).join(' ')}
        </p>
      )}
      <p className="mt-1 text-small text-soft" data-guess>{guessLine}</p>
    </div>
  );
}

/**
 * UI V3 (U3): the score as a two-part bar, the bank half and the mission half (and guess points), with debt
 * as a red notch taken off the end. The words behind it are one tap away ("See the money").
 */
export function ScoreBar({ m, onWords }: { m: NonNullable<ViewState['play']>['mission']; onWords: () => void }) {
  if (!m) return null;
  const bankSigned = Math.round(m.bankPart);
  const bank = Math.max(0, bankSigned);
  const mission = Math.max(0, Math.round(m.score) - Math.round(m.bankPart) + Math.round(m.stress) - Math.round(m.guessPoints));
  const guess = Math.max(0, Math.round(m.guessPoints));
  const debt = Math.max(0, Math.round(m.stress));
  const total = Math.max(1, bank + mission + guess);
  const w = (x: number) => `${(x / total) * 100}%`;
  return (
    <div data-scorebar>
      <div className="flex items-center gap-3">
        <span className="text-small font-bold uppercase tracking-wider text-soft">{t('play.summary.scoreLabel')}</span>
        <span className="h-show text-title">{coins(m.score)}</span>
        <button type="button" className="ms-auto min-h-[44px] text-small font-semibold underline" onClick={onWords} data-score-words>
          {t('play.score.words')}
        </button>
      </div>
      <div className="relative flex h-5 overflow-hidden rounded-full bg-paper" role="img" aria-label={t('play.score.a11y', { s: coins(m.score), b: bankSigned, m: mission, g: guess, d: debt })}>
        <div className="h-full bg-spot" style={{ width: w(bank) }} />
        <div className="h-full bg-good" style={{ width: w(mission) }} />
        {guess > 0 && <div className="h-full bg-teal/60" style={{ width: w(guess) }} />}
        {debt > 0 && <div className="absolute inset-y-0 right-0 border-l-2 border-paper bg-stamp" style={{ width: w(Math.min(debt, total)) }} />}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-small">
        <span><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-spot" />{t('play.score.bank', { n: bankSigned })}</span>
        <span><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-good" />{t('play.score.mission', { n: mission })}</span>
        {guess > 0 && <span>{t('play.score.guess', { n: guess })}</span>}
        {debt > 0 && <span className="font-bold text-stamp">{t('play.score.debt', { n: debt })}</span>}
      </p>
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

/** v2 Section 6.3: one screen, no tables. Biggest lie, biggest wrong read, your bank, mission, near miss. */
function EpisodeSummary({ v }: { v: ViewState }) {
  const { go, replay, online, leaveOnline, act } = useStore();
  const pl = v.play!;
  const [sheet, setSheet] = useState<null | 'really' | 'words'>(null);
  const lv = v.levelView as L3View;
  const types = lv.types ?? {};
  const m = pl.mission!;
  // Loop cycle 2 (D-168): complete when the mission's value grew this episode.
  const complete = m.value > m.startValue + 1e-9;
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
  return (
    <Stage
      v={v}
      bar={false}
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
      <h1 className="h-show text-title leading-tight">{t('play.summary.title')}</h1>
      <div className="mt-1">
        <RankBlock v={v} />
      </div>
      <div className="mt-2">
        <ScoreBar m={m} onWords={() => setSheet('words')} />
      </div>
      <dl className="mt-1 space-y-1.5" data-summary>
        {row(missionName(m.card), complete ? t('play.summary.missionDone') : t('play.summary.missionMissed'), complete ? 'text-good' : 'text-stamp')}
        {row(t('play.summary.lieLabel'), lieText)}
        {pl.pollMode !== 'NEVER' && v.levelIndex === 3 && row(t('play.summary.readLabel'), readText)}
        {row(t('play.summary.nearMiss'), nm ? nearMissText(v, nm) : t('play.summary.nearMissNone'))}
      </dl>
      <button type="button" className="mt-1 min-h-[44px] self-start text-small font-semibold underline" onClick={() => setSheet('really')}>
        {t('play.really.button')}
      </button>
      {v.seed && <p className="mt-2 text-small text-soft">{t('play.summary.seed', { seed: v.seed })}</p>}
      {playtestOn() && <PlaytestPanel v={v} />}
      {sheet === 'really' && <ReallySheet v={v} onClose={() => setSheet(null)} />}
      {sheet === 'words' && (
        <TableSheet title={t('play.score.wordsTitle')} closeLabel={t('play.really.close')} onClose={() => setSheet(null)}>
          <p data-score-text>{t('play.summary.bankChange', { from: coins(episodeStartBank(v)), to: coins(pl.banks[v.viewer]) })}</p>
          <p>{`${t('play.summary.score', { s: coins(m.score), b: coins(m.bankPart), m: String(Math.round(m.score) - Math.round(m.bankPart) + Math.round(m.stress) - Math.round(m.guessPoints)), d: coins(m.stress), e: coins(m.episodeStress), g: coins(m.guessPoints) })} ${t(`play.missions.${m.card}.points`)}`}</p>
        </TableSheet>
      )}
    </Stage>
  );
}

export function PlayGameScreen() {
  const v = useView();
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
  if (k === 'VALUES_REVEAL') return <MissionReveal v={v} />;
  if (k === 'INTRO') return <EpisodeIntro v={v} />;
  if (k === 'GUESS') return <EpisodeGuess v={v} />;
  if (v.mode === 'LIFE' && (k === 'RUN_DEBRIEF' || k === 'END')) return <LifeEnd v={v} />;
  if (k === 'LEVEL_DEBRIEF' || k === 'END') return <EpisodeSummary v={v} />;
  if (v.levelIndex === 5) {
    if (k === 'DECIDE') return <DecisionFlow5 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'INCOMES') return <IncomesScreen v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'AMENDMENTS') return <AmendReveal v={v} />;
    return null;
  }
  if (v.levelIndex === 2) {
    if (k === 'DECIDE') return <DecisionFlow2 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'INCOME') return <IncomeScreen v={v} />;
    if (k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY') return <PrizeBeat v={v} next={() => useStore.getState().act()} />;
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
    if (k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY') return <ResultsFlow4 key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
    if (k === 'REVEAL' && v.phase.step === 'CARDS') return <CardsReveal4 v={v} />;
    return null;
  }
  if (k === 'TALK' || k === 'DECIDE') return <DecisionFlow key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
  if (k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY') return <ResultsFlow key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
  if (k === 'REVEAL' && v.phase.step === 'CARDS') return <CardsReveal v={v} />;
  return null;
}

