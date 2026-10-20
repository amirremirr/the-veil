// Play mode's screens (Play spec 7; redesign D-108). One beat per screen, one big element, one voice.
// Same screen flow as Study (src/shared/flow.ts): the beats inside a screen are presentation only, and the
// last beat's button performs that screen's one engine step.
import { useEffect, useState } from 'react';
import type { ValuesCard, ViewState } from '../../engine/types';
import { VALUES_CARDS } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct, signed } from '../labels';
import { nameOf, shortName, useView } from '../game';
import { Avatar, FlipCard, useMotionOff } from '../components/common';
import { Sheet as TableSheet } from '../components/TableParts';
import { LockedInPanel, useOnline, useWaiting } from '../components/Online';
import { screenDecisionPhase } from '../../shared/flow';
import { BigButton, Bubble, Stage } from './OnAir';
import { ChoiceScreen, PriceBeat, RegimeScreen, VoteInBeat, WheelBeat, hasPriceBeat, type L3View } from './Episode3';
import { biggestMoment, eventText, hostLine, missionName, pick } from './logic';


/** "What was really going on?": three lines on the mechanism (Play spec 7.5). */
function ReallySheet({ v, onClose }: { v: ViewState; onClose: () => void }) {
  const online = useOnline();
  const chooseMode = useStore((s) => s.chooseMode);
  return (
    <TableSheet title={t('play.really.button')} closeLabel={t('play.really.close')} onClose={onClose}>
      <ul className="space-y-2" data-really>
        {[0, 1, 2].map((i) => (
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

function MissionReveal({ v }: { v: ViewState }) {
  const me = v.players.find((p) => p.id === v.viewer)!;
  const off = useMotionOff();
  const [flipped, setFlipped] = useState(off);
  const act = useStore((s) => s.act);
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), off ? 0 : 400);
    return () => clearTimeout(id);
  }, [off]);
  return (
    <Stage v={v} bar={false} footer={<BigButton onClick={() => act()}>{t('play.values.accept')}</BigButton>}>
      <p className="h-show mt-2 text-center text-lg text-spot">{t('play.show')}</p>
      <FlipCard
        className="mx-auto mt-4 h-72 w-full"
        flipped={flipped}
        back={
          <div className="flex h-full items-center justify-center rounded-3xl bg-card">
            <span className="h-show text-3xl text-spot">{t('play.show')}</span>
          </div>
        }
        front={
          <div className="flex h-full flex-col justify-center rounded-3xl bg-spot p-6 text-onspot">
            <p className="text-xs font-bold uppercase tracking-wider">{t('play.values.title')}</p>
            <p className="h-show mt-2 text-5xl leading-none">{missionName(me.values!)}</p>
            <p className="mt-3 text-base">{t(`play.missions.${me.values}.line`)}</p>
          </div>
        }
      />
      <p className="mt-5 text-center text-sm text-soft">{t('play.values.private')}</p>
    </Stage>
  );
}

function EpisodeIntro({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const n = v.play!.l3!;
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.intro.go')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">
        {t('play.modes.ep', { n: v.levelIndex })} · {t('play.episodes.3.sponsor')}
      </p>
      <h1 className="h-show mt-1 text-5xl leading-none text-spot">{t(`play.episodes.${v.levelIndex}.name`)}</h1>
      <ol className="mt-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3 text-base leading-snug">
            <span className="h-show text-2xl text-stamp">{i + 1}</span>
            <span>{t(`play.episodes.3.how.${i}`, { income: n.baseIncome, living: n.livingCost, loss: n.loss })}</span>
          </li>
        ))}
      </ol>
      <div className="mt-auto pt-4">
        <Bubble who="Dash" host text={hostLine('welcome', pick(v, 'welcome', 6))} />
      </div>
    </Stage>
  );
}

function EventBeat({ v, next }: { v: ViewState; next: () => void }) {
  const ev = v.play!.event!;
  const txt = eventText(v.levelIndex, ev.id);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-event={ev.id}>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.stage.eventLabel')}</p>
        <p className="h-show mt-2 text-5xl leading-none text-spot">{txt.name}</p>
        <p className="mt-3 text-base italic text-soft">{txt.text}</p>
        <p className="mt-3 rounded-2xl bg-card p-3 text-base font-semibold">{txt.effect}</p>
        <div className="mt-4">
          <Bubble who="Dash" host text={hostLine('eventIntro', pick(v, 'eventIntro', 6), { event: txt.name })} />
        </div>
      </div>
    </Stage>
  );
}

function PollBeat({ v, next }: { v: ViewState; next: () => void }) {
  const poll = v.play!.poll!;
  const you = poll.target === v.viewer;
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto text-center" data-poll>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.stage.pollLabel')}</p>
        <p className="h-show mt-2 text-8xl leading-none text-spot">{pct(poll.share)}</p>
        <p className="mt-3 text-lg">{t(you ? 'play.stage.pollLineYou' : 'play.stage.pollLine', { name: nameOf(v, poll.target), mission: missionName(poll.card) })}</p>
      </div>
    </Stage>
  );
}

/** The pre-decision beats of a round (vote result, event card, audience poll), then the decision itself. */
function DecisionFlow({ v }: { v: ViewState }) {
  const dp = screenDecisionPhase(v, v.queue);
  const dv = dp && dp !== v.phase ? { ...v, phase: dp } : v;
  const online = useOnline();
  const { done } = useWaiting(v);
  const regimeVote = dv.phase.step === 'REGIME';
  const lv = v.levelView as L3View;
  const ev = v.play!.event;
  const beats: Array<'vote' | 'event' | 'poll'> = [];
  if (!regimeVote) {
    if (v.round === 3 && lv.regimeVotes) beats.push('vote');
    if (ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) beats.push('event');
    if (v.round === PLAY.POLL_FROM_ROUND && v.play!.poll) beats.push('poll');
  }
  const [k, setK] = useState(0);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) {
    const b = beats[k];
    if (b === 'vote') return <VoteInBeat v={v} next={next} />;
    if (b === 'event') return <EventBeat v={v} next={next} />;
    return <PollBeat v={v} next={next} />;
  }
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  return regimeVote ? <RegimeScreen v={dv} /> : <ChoiceScreen v={dv} />;
}

/** A round's results as beats: the wheel (with everyone else in one row), then the price, if any. */
function ResultsFlow({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const price = hasPriceBeat(v);
  const [k, setK] = useState(0);
  const [really, setReally] = useState(false);
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
  const [target, setTarget] = useState(others[0]?.id ?? '');
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
            <BigButton disabled={!card} onClick={() => card && act(undefined, { [target]: card })}>
              {t('play.guess.submit')}
            </BigButton>
          </div>
        </div>
      }
    >
      <h1 className="h-show text-4xl">{t('play.guess.title')}</h1>
      <p className="mt-1 text-sm text-soft">{t('play.guess.intro', { pts: PLAY.GUESS_POINTS })}</p>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={t('play.guess.pick')}>
        {others.map((p) => (
          <button key={p.id} type="button" aria-pressed={target === p.id} onClick={() => setTarget(p.id)} className={`flex flex-col items-center gap-1 rounded-2xl p-2 ${target === p.id ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <Avatar bot={p.botKey} human={p.isHuman} size={32} />
            <span className="truncate text-sm font-bold">{shortName(v, p.id)}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={t('play.guess.mission')}>
        {VALUES_CARDS.map((c) => (
          <button key={c} type="button" aria-pressed={card === c} onClick={() => setCard(c)} className={`min-h-[64px] rounded-2xl p-2 text-start ${card === c ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show text-lg leading-tight">{missionName(c)}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** Section 7.6: one short screen; the only place the ranking appears. */
function EpisodeSummary({ v }: { v: ViewState }) {
  const { go, replay, online, leaveOnline, act } = useStore();
  const pl = v.play!;
  const [sheet, setSheet] = useState<null | 'really'>(null);
  const scores = pl.finalScores ?? {};
  const ranked = v.players.slice().sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const winner = ranked[0];
  const moment = biggestMoment(pl, v.levelIndex);
  const m = pl.mission!;
  const complete = m.scale * m.value >= m.goal;
  const myGuess = pl.guesses[v.levelIndex]?.[v.viewer];
  const guessLine = myGuess
    ? hostLine(myGuess.correct ? 'guessRight' : 'guessWrong', pick(v, 'guess', 6), { name: nameOf(v, myGuess.target) })
    : hostLine('guessNone', pick(v, 'guess', 6));
  let momentText = '';
  if (moment?.kind === 'event') momentText = t('play.summary.momentEvent', { r: moment.round, event: eventText(v.levelIndex, moment.id).name });
  else if (moment) momentText = t(moment.who === v.viewer ? 'play.summary.momentSwingYou' : 'play.summary.momentSwing', { r: moment.round, name: nameOf(v, moment.who), change: signed(moment.change) });
  const menu = () => {
    if (online) return leaveOnline();
    if (v.phase.kind === 'LEVEL_DEBRIEF') act();
    go('title');
  };
  return (
    <Stage
      v={v}
      bar={false}
      footer={
        <div className="flex gap-2">
          {!online && (
            <button type="button" className="min-h-[52px] flex-1 rounded-full bg-card font-bold" onClick={() => replay(false)}>
              {t('play.summary.again')}
            </button>
          )}
          <div className="flex-1">
            <BigButton onClick={menu}>{t('play.summary.menu')}</BigButton>
          </div>
        </div>
      }
    >
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.summary.title')}</p>
      <h1 className="h-show mt-1 text-3xl leading-tight text-spot">{winner.id === v.viewer ? t('play.summary.winnerYou') : t('play.summary.winner', { name: shortName(v, winner.id) })}</h1>
      <ol className="mt-3 space-y-1" aria-label={t('play.stage.ranking')}>
        {ranked.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-2 rounded-xl px-2 py-1 ${p.id === v.viewer ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show w-5 text-lg">{i + 1}</span>
            <span className="flex-1 truncate text-sm font-bold">{shortName(v, p.id)}</span>
            <span className="truncate text-xs">{p.values ? missionName(p.values) : ''}</span>
            <span className="h-show w-10 text-end">{coins(scores[p.id] ?? 0)}</span>
          </li>
        ))}
      </ol>
      <dl className="mt-3 space-y-1 text-sm">
        {momentText && (
          <div className="flex gap-2">
            <dt className="text-soft">{t('play.summary.moment')}:</dt>
            <dd className="font-semibold">{momentText}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-soft">{t('play.bar.bank')}:</dt>
          <dd className="font-semibold">{t('play.summary.bankChange', { from: coins(pl.startingBank), to: coins(pl.banks[v.viewer]) })}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-soft">{missionName(m.card)}:</dt>
          <dd className={`font-semibold ${complete ? 'text-good' : 'text-stamp'}`}>{complete ? t('play.summary.missionDone') : t('play.summary.missionMissed')}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <Bubble who="Dash" host text={guessLine} />
      </div>
      <button type="button" className="mt-3 self-start text-sm font-semibold underline" onClick={() => setSheet('really')}>
        {t('play.really.button')}
      </button>
      {v.seed && <p className="mt-2 text-[11px] text-soft">{t('play.summary.seed', { seed: v.seed })}</p>}
      {sheet === 'really' && <ReallySheet v={v} onClose={() => setSheet(null)} />}
    </Stage>
  );
}

export function PlayGameScreen() {
  const v = useView();
  const off = useMotionOff();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: off ? 'auto' : 'smooth' });
  }, [v?.phaseIdx, v?.levelIndex, v?.phase.kind, off]);
  if (!v || !v.play) return null;
  const k = v.phase.kind;
  const next = v.queue[v.phaseIdx + 1];
  if (k === 'VALUES_REVEAL') return <MissionReveal v={v} />;
  if (k === 'INTRO') return <EpisodeIntro v={v} />;
  if (k === 'GUESS') return <EpisodeGuess v={v} />;
  if (k === 'LEVEL_DEBRIEF' || k === 'END') return <EpisodeSummary v={v} />;
  if (k === 'TALK' || k === 'DECIDE') return <DecisionFlow key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
  if (k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY') return <ResultsFlow key={`${v.levelIndex}-${v.phaseIdx}`} v={v} />;
  return null;
}

