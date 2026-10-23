// Play mode's screens (Play spec 7; redesign D-108). One beat per screen, one big element, one voice.
// Same screen flow as Study (src/shared/flow.ts): the beats inside a screen are presentation only, and the
// last beat's button performs that screen's one engine step.
import { useEffect, useState } from 'react';
import type { ValuesCard, ViewState } from '../../engine/types';
import { VALUES_CARDS } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { nameOf, shortName, useView } from '../game';
import { FlipCard, useMotionOff } from '../components/common';
import { Sheet as TableSheet } from '../components/TableParts';
import { LockedInPanel, useOnline, useWaiting } from '../components/Online';
import { screenDecisionPhase } from '../../shared/flow';
import { BigButton, Bubble, Face, Stage } from './OnAir';
import { BarBeat, CardsReveal, ClaimScreen, ClaimsBeat, MoveScreen, MyCardsBeat, PriceBeat, RegimeScreen, VoteInBeat, WheelBeat, claimsOpen, hasPriceBeat, regimeName, roundClaims, type L3View } from './Episode3';
import { eventText, hostLine, missionName, pick } from './logic';
import type { NearMiss } from '../../engine/play/types';


/** "What was really going on?": three lines on the mechanism (Play spec 7.5). */
function ReallySheet({ v, onClose }: { v: ViewState; onClose: () => void }) {
  const online = useOnline();
  const chooseMode = useStore((s) => s.chooseMode);
  return (
    <TableSheet title={t('play.really.button')} closeLabel={t('play.really.close')} onClose={onClose}>
      <ul className="space-y-2" data-really>
        {[0, 1, 2, 3, 4].map((i) => (
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
      <p className="mt-5 text-lg leading-snug" data-intro>
        {t('play.episodes.3.intro', { loss: n.loss })}
      </p>
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
  const beats: Array<'cards' | 'vote' | 'event' | 'claims'> = [];
  if (first && v.round === 1) beats.push('cards');
  if (first) {
    if (v.round === PLAY.L3.VOLUNTARY_ROUNDS + 1 && lv.regimeVotes) beats.push('vote');
    if (ev && ev.id !== 'QUIET' && ev.round === v.round && ev.level === v.levelIndex) beats.push('event');
  }
  if (stepId === 'CHOICE' && Object.keys(roundClaims(v)).length) beats.push('claims');
  const [k, setK] = useState(0);
  const next = () => setK((x) => x + 1);
  if (k < beats.length) {
    const b = beats[k];
    if (b === 'cards') return <MyCardsBeat v={v} next={next} />;
    if (b === 'vote') return <VoteInBeat v={v} next={next} />;
    if (b === 'event') return <EventBeat v={v} next={next} />;
    return <ClaimsBeat v={v} next={next} />;
  }
  if (online && done)
    return (
      <Stage v={v}>
        <LockedInPanel v={v} />
      </Stage>
    );
  if (stepId === 'REGIME') return <RegimeScreen v={dv} />;
  if (stepId === 'CLAIM') return <ClaimScreen v={dv} />;
  return <MoveScreen v={dv} />;
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
            <Face v={v} p={p} size={32} />
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

/** v2 Section 10 fix 3: after the card guess, its result, then every mission flips with the ranking. */
function MissionsBeat({ v, next }: { v: ViewState; next: () => void }) {
  const pl = v.play!;
  const scores = pl.finalScores ?? {};
  const ranked = v.players.slice().sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const myGuess = pl.guesses[v.levelIndex]?.[v.viewer];
  const guessLine = myGuess
    ? hostLine(myGuess.correct ? 'guessRight' : 'guessWrong', pick(v, 'guess', 6), { name: nameOf(v, myGuess.target) })
    : hostLine('guessNone', pick(v, 'guess', 6));
  return (
    <Stage v={v} bar={false} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-missions>
        <Bubble who="Dash" host text={guessLine} />
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-soft">{t('play.summary.missionsLabel')}</p>
        <h1 className="h-show mt-1 text-3xl leading-tight text-spot">{ranked[0].id === v.viewer ? t('play.summary.winnerYou') : t('play.summary.winner', { name: shortName(v, ranked[0].id) })}</h1>
        <ol className="mt-3 space-y-1.5" aria-label={t('play.stage.ranking')}>
          {ranked.map((p, i) => (
            <li key={p.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${p.id === v.viewer ? 'bg-spot text-onspot' : 'bg-card'}`}>
              <span className="h-show w-5 text-lg">{i + 1}</span>
              <span className="w-20 truncate text-sm font-bold">{shortName(v, p.id)}</span>
              <span className="flex-1 truncate text-sm">{p.values ? missionName(p.values) : ''}</span>
              <span className="h-show w-10 text-end">{coins(scores[p.id] ?? 0)}</span>
            </li>
          ))}
        </ol>
      </div>
    </Stage>
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
  else if (nm.kind === 'CLAIM') change = nm.to === 'SILENT' ? t('play.nm.silent') : t('play.nm.claim', { claim: t(`play.claims.RISK.${nm.to as string}`) });
  else change = t('play.nm.regime', { name: regimeName(nm.to as 'VOL' | 'M50' | 'M100') });
  return t('play.nm.line', { change, r: nm.round, n: nm.gain });
}

/** v2 Section 6.3: one screen, no tables. Biggest lie, biggest wrong read, your bank, mission, near miss. */
function EpisodeSummary({ v }: { v: ViewState }) {
  const { go, replay, online, leaveOnline, act } = useStore();
  const pl = v.play!;
  const [sheet, setSheet] = useState<null | 'really'>(null);
  const [k, setK] = useState(0);
  const lv = v.levelView as L3View;
  const types = lv.types ?? {};
  const m = pl.mission!;
  const complete = m.scale * m.value >= m.goal;
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
  const lieText =
    lies && lies.n
      ? t(lies.id === v.viewer ? 'play.summary.lieYou' : 'play.summary.lie', { name: nameOf(v, lies.id), claim: t(`play.claim.short.${lies.value}`).toLowerCase(), n: lies.n, truth: t(`play.cards.${types[lies.id]}`).toLowerCase() })
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
  if (k === 0) return <MissionsBeat v={v} next={() => setK(1)} />;
  const row = (label: string, text: string, cls = '') => (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-soft">{label}</dt>
      <dd className={`text-base font-semibold leading-snug ${cls}`}>{text}</dd>
    </div>
  );
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
      <h1 className="h-show text-3xl leading-tight text-spot">{t('play.summary.title')}</h1>
      <dl className="mt-3 space-y-3" data-summary>
        {row(t('play.summary.lieLabel'), lieText)}
        {pl.pollMode !== 'NEVER' && row(t('play.summary.readLabel'), readText)}
        {row(t('play.bar.bank'), t('play.summary.bankChange', { from: coins(pl.startingBank), to: coins(pl.banks[v.viewer]) }))}
        {row(missionName(m.card), complete ? t('play.summary.missionDone') : t('play.summary.missionMissed'), complete ? 'text-good' : 'text-stamp')}
        {row(t('play.summary.nearMiss'), nm ? nearMissText(v, nm) : t('play.summary.nearMissNone'))}
      </dl>
      <button type="button" className="mt-4 self-start text-sm font-semibold underline" onClick={() => setSheet('really')}>
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
  if (k === 'REVEAL' && v.phase.step === 'CARDS') return <CardsReveal v={v} />;
  return null;
}

