// Play mode's screens (PLAY_MODE_SPEC.md Section 7). Same screen flow as Study (src/shared/flow.ts: two
// screens per round), the same engine view, Play presentation. Only Episode 3 exists in P1.
import { useEffect, useMemo, useState } from 'react';
import type { L3Debrief } from '../../engine/levels/level3';
import type { ValuesCard, ViewState } from '../../engine/types';
import { VALUES_CARDS } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct, signed } from '../labels';
import { nameOf, shortName, useView } from '../game';
import { Avatar, Collapsible, FlipCard, Page, Stamp, useMotionOff } from '../components/common';
import { ChatFeed, ChatStrip, MessageComposer, PrimaryBar, Sheet } from '../components/TableParts';
import { LockedInPanel, ReadyButton, useOnline, useWaiting } from '../components/Online';
import { screenDecisionPhase } from '../../shared/flow';
import { BankStrip, OnAirBar } from './OnAir';
import { Decide3, PriceTicker, RegimeBanner, WheelReveal, type L3View } from './Episode3';
import {
  REACTIONS,
  REACTION_ICON,
  biggestMoment,
  botReactions,
  brokenPromises,
  confessional,
  confessor,
  eventText,
  hostLine,
  missionName,
  pick,
  roundOutcome,
  type ReactionKind,
} from './logic';

/** Dash Fortuna says something. */
function Host({ line }: { line: string }) {
  if (!line) return null;
  return (
    <figure className="flex items-start gap-2 rounded-md bg-spot/25 px-3 py-2" data-host>
      <span aria-hidden className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stamp font-bold text-paper">
        DF
      </span>
      <div className="min-w-0">
        <figcaption className="font-mono text-[10px] uppercase tracking-wider text-soft">{t('play.hostName')}</figcaption>
        <blockquote className="font-semibold leading-snug">{line}</blockquote>
      </div>
    </figure>
  );
}

function MissionCard({ card }: { card: ValuesCard }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl border-4 border-stamp bg-card p-5">
      <div className="label">{t('play.values.title')}</div>
      <div>
        <div className="h-show text-4xl">{missionName(card)}</div>
        <div className="mt-1 text-base">{t(`play.missions.${card}.line`)}</div>
      </div>
      <Stamp rotate={-6}>{t('play.onAir')}</Stamp>
    </div>
  );
}

function MissionReveal({ v }: { v: ViewState }) {
  const me = v.players.find((p) => p.id === v.viewer)!;
  const [flipped, setFlipped] = useState(false);
  const off = useMotionOff();
  const act = useStore((s) => s.act);
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), off ? 0 : 400);
    return () => clearTimeout(id);
  }, [off]);
  return (
    <Page narrow>
      <p className="h-show text-center text-xl">{t('play.show')}</p>
      <FlipCard
        className="mx-auto mt-3 h-64 max-w-sm"
        flipped={flipped}
        back={
          <div className="flex h-full items-center justify-center rounded-xl border-4 border-stamp bg-ink text-paper">
            <span className="h-show text-3xl">{t('play.show')}</span>
          </div>
        }
        front={<MissionCard card={me.values!} />}
      />
      <div className="mt-5 space-y-2 text-sm leading-relaxed" aria-live="polite">
        {flipped && (
          <>
            <p>{t('play.values.score')}</p>
            <p className="rounded-md border-2 border-stamp p-2 text-stamp">{t('play.values.private')}</p>
          </>
        )}
      </div>
      <PrimaryBar>
        <ReadyButton v={v} label={t('play.values.accept')} onClick={() => act()} />
      </PrimaryBar>
    </Page>
  );
}

function EpisodeIntro({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const n = v.play!.l3!;
  const how = useMemo(() => {
    const lines = [0, 1, 2].map((i) => t(`play.episodes.3.how.${i}`, { income: n.baseIncome, living: n.livingCost, loss: n.loss }));
    return lines.filter((l) => !l.startsWith('play.'));
  }, [n]);
  return (
    <Page narrow>
      <p className="label">
        {t('play.modes.ep', { n: v.levelIndex })} · {t('play.episodes.3.sponsor')}
      </p>
      <h1 className="h-show mt-1 text-4xl">{t(`play.episodes.${v.levelIndex}.name`)}</h1>
      <div className="mt-4">
        <Host line={hostLine('welcome', pick(v, 'welcome', 6))} />
      </div>
      <section className="mt-4" aria-labelledby="how">
        <h2 id="how" className="label">
          {t('play.intro.rules')}
        </h2>
        <ol className="mt-2 list-decimal space-y-1.5 ps-5 leading-snug">
          {how.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
      </section>
      <div className="mt-4">
        <BankStrip v={v} />
      </div>
      <p className="mt-3 text-xs text-soft">{t('play.disclaimer')}</p>
      <PrimaryBar>
        <ReadyButton v={v} label={t('play.intro.go')} onClick={() => act()} />
      </PrimaryBar>
    </Page>
  );
}

/** The round's event card, introduced by Dash before any decision (Play spec 6.1). */
function EventCard({ v }: { v: ViewState }) {
  const ev = v.play!.event;
  if (!ev || ev.round !== v.round || ev.level !== v.levelIndex) return null;
  const quiet = ev.id === 'QUIET';
  const txt = eventText(v.levelIndex, ev.id);
  const line = quiet ? hostLine('quietWeek', pick(v, 'quietWeek', 6)) : hostLine('eventIntro', pick(v, 'eventIntro', 6), { event: txt.name });
  return (
    <div className="space-y-2">
      <Host line={line} />
      {!quiet && (
        <section className="rounded-md border-2 border-dashed border-stamp bg-card px-3 py-2" aria-label={t('play.events.title')} data-event={ev.id}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="h-show text-base">{txt.name}</span>
            <span className="label">{t('play.events.title')}</span>
          </div>
          <p className="text-sm italic text-soft">{txt.text}</p>
          <p className="mt-1 text-sm font-semibold">{txt.effect}</p>
        </section>
      )}
    </div>
  );
}

function AudiencePoll({ v }: { v: ViewState }) {
  const poll = v.play!.poll;
  if (!poll || v.round !== PLAY.POLL_FROM_ROUND || v.phase.step === 'REGIME') return null;
  const you = poll.target === v.viewer;
  const text = t(you ? 'play.pollYou' : 'play.poll', { name: nameOf(v, poll.target), mission: missionName(poll.card), pct: pct(poll.share) });
  return (
    <section className="rounded-md border border-line bg-card px-3 py-2" aria-label={t('play.pollTitle')} data-poll>
      <div className="label">{t('play.pollTitle')}</div>
      <p className="text-sm">{text}</p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full bg-teal" style={{ width: pct(poll.share) }} />
      </div>
    </section>
  );
}

function DecisionScreen({ v, onReply }: { v: ViewState; onReply: () => void }) {
  const dp = screenDecisionPhase(v, v.queue);
  const dv = dp && dp !== v.phase ? { ...v, phase: dp } : v;
  const online = useOnline();
  const { done } = useWaiting(v);
  const regimeVote = dv.phase.step === 'REGIME';
  const showBanner = !regimeVote && v.round === 3 && !!(v.levelView as L3View).regimeVotes;
  return (
    <div className="space-y-3">
      {!regimeVote && <EventCard v={v} />}
      {showBanner && <RegimeBanner v={v} />}
      {!regimeVote && <PriceTicker v={v} />}
      <AudiencePoll v={v} />
      {v.phase.kind === 'TALK' && <ChatStrip v={v} onReply={onReply} />}
      {online && done ? <LockedInPanel v={v} /> : <Decide3 v={dv} />}
    </div>
  );
}

function Reactions({ v, keyName }: { v: ViewState; keyName: ReturnType<typeof roundOutcome>['key'] }) {
  const [mine, setMine] = useState<ReactionKind | null>(null);
  const bots = botReactions(v, keyName);
  return (
    <section aria-label={t('play.reactions.label')} className="space-y-1">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('play.reactions.label')}>
        {REACTIONS.map((k) => (
          <button key={k} type="button" aria-pressed={mine === k} className="choice w-auto min-w-[44px] justify-center px-2 py-1 text-lg" onClick={() => setMine(mine === k ? null : k)} aria-label={t(`play.reactions.${k}`)}>
            <span aria-hidden>{REACTION_ICON[k]}</span>
          </button>
        ))}
      </div>
      {bots.length > 0 && (
        <p className="text-xs text-soft">
          {bots.map((b) => t('play.reactions.botReacted', { name: shortName(v, b.from), reaction: `${REACTION_ICON[b.kind]} ${t(`play.reactions.${b.kind}`)}` })).join(' · ')}
        </p>
      )}
    </section>
  );
}

/** A reveal and the round summary on one screen (D-37), with the show around it. */
function ResultsScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = v.levelView as L3View;
  const r = lv.rounds[lv.rounds.length - 1];
  const outcome = roundOutcome(v, r);
  const subjectYou = outcome.subject === v.viewer;
  const line = hostLine(outcome.key, pick(v, `out-${outcome.key}`, 6), { name: outcome.subject ? nameOf(v, outcome.subject) : '' }, subjectYou);
  const bot = confessor(v, outcome.subject);
  const conf = bot?.botKey ? confessional(bot.botKey, outcome.key, pick(v, `conf-${bot.id}`, 4)) : '';
  const broken = brokenPromises(v, 'CHOICE');
  const hist = v.play!.bankHistory;
  const last = hist[hist.length - 1];
  const myFrom = last ? last.banks[v.viewer] - last.W[v.viewer] + PLAY.LIVING_COST : 0;
  return (
    <div className="space-y-3">
      <WheelReveal v={v} />
      {broken.map((b) => (
        <div key={`${b.from}-${b.action}`} className="flex flex-wrap items-center gap-2" data-broken>
          <Stamp small>{t('ui.broken')}</Stamp>
          <span className="text-sm font-semibold">{t(b.from === v.viewer ? 'play.brokenYou' : 'play.broken', { name: nameOf(v, b.from), action: b.action })}</span>
        </div>
      ))}
      <Host line={line} />
      {conf && bot && (
        <figure className="flex items-start gap-2 rounded-md border border-line bg-card px-3 py-2" data-confessional>
          <Avatar bot={bot.botKey} size={28} />
          <div>
            <figcaption className="font-mono text-[10px] uppercase tracking-wider text-soft">
              {t('play.confessional')} · {shortName(v, bot.id)}
            </figcaption>
            <blockquote className="italic leading-snug">“{conf}”</blockquote>
          </div>
        </figure>
      )}
      <PriceTicker v={v} results />
      {last && <p className="num text-sm">{t('play.l3.bankChange', { from: coins(myFrom), to: coins(last.banks[v.viewer]) })}</p>}
      <Reactions v={v} keyName={outcome.key} />
      <PrimaryBar>
        <ReadyButton v={v} label={t('app.continue')} onClick={() => act()} />
      </PrimaryBar>
    </div>
  );
}

function PlayTable({ v }: { v: ViewState }) {
  const go = useStore((s) => s.go);
  const online = useOnline();
  const leaveOnline = useStore((s) => s.leaveOnline);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | 'chat' | 'reply'>(null);
  const k = v.phase.kind;
  const canTalk = k === 'TALK';
  const next = v.queue[v.phaseIdx + 1];
  const results = k === 'REVEAL' && next?.kind === 'ROUND_SUMMARY';
  return (
    <>
      <OnAirBar v={v} onMenu={() => setMenu(true)} onChat={() => setSheet('chat')} />
      <div className="sr-only" aria-live="polite">
        {t(`phase.${k}`)}
      </div>
      <main className="mx-auto grid max-w-page grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4">
        <div className="min-w-0 space-y-3">
          <BankStrip v={v} />
          <div key={v.phaseIdx}>{k === 'TALK' || k === 'DECIDE' ? <DecisionScreen v={v} onReply={() => setSheet('reply')} /> : results ? <ResultsScreen v={v} /> : null}</div>
        </div>
        <aside className="hidden space-y-4 lg:block">
          <section className="form-card p-3">
            <h2 className="label mb-2">{t('table.transcript')}</h2>
            <div className="max-h-[50vh] overflow-y-auto pe-1">
              <ChatFeed v={v} />
            </div>
            {canTalk && (
              <button type="button" className="btn-ghost mt-3 w-full" onClick={() => setSheet('reply')}>
                {t('flow.reply')}
              </button>
            )}
          </section>
        </aside>
      </main>
      {sheet && (
        <Sheet title={t('table.transcript')} closeLabel={sheet === 'reply' ? t('flow.sheetDone') : t('app.back')} onClose={() => setSheet(null)}>
          <ChatFeed v={v} />
          {canTalk && <MessageComposer v={v} />}
        </Sheet>
      )}
      {menu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label={t('table.menu')}>
          <div className="form-card w-full max-w-sm p-4">
            <p className="mb-4 text-sm">{online ? t('room.leaveConfirm') : t('table.quitConfirm')}</p>
            <div className="flex flex-col gap-2">
              <button type="button" className="btn-primary" autoFocus onClick={() => setMenu(false)}>
                {t('table.resume')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => (online ? leaveOnline() : go('title'))}>
                {online ? t('room.leaveGame') : t('table.quit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Section 7.4: guess one other contestant's mission. */
function EpisodeGuess({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const online = useOnline();
  const { done } = useWaiting(v);
  const others = v.players.filter((p) => p.id !== v.viewer);
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [card, setCard] = useState<ValuesCard | null>(null);
  return (
    <>
      <OnAirBar v={v} onMenu={() => undefined} onChat={() => undefined} />
      <Page narrow>
        <section className="form-card p-4">
          <h1 className="h-show text-2xl">{t('play.guess.title')}</h1>
          <p className="mt-1 text-sm">{t('play.guess.intro', { pts: PLAY.GUESS_POINTS })}</p>
          {online && done ? (
            <LockedInPanel v={v} />
          ) : (
            <>
              <fieldset className="mt-3">
                <legend className="label mb-1">{t('play.guess.pick')}</legend>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('play.guess.pick')}>
                  {others.map((p) => (
                    <button key={p.id} type="button" aria-pressed={target === p.id} className="choice flex-col items-center px-1 text-center text-sm" onClick={() => setTarget(p.id)}>
                      <Avatar bot={p.botKey} human={p.isHuman} size={28} />
                      <span className="truncate">{shortName(v, p.id)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-3">
                <legend className="label mb-1">{t('play.guess.mission')}</legend>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('play.guess.mission')}>
                  {VALUES_CARDS.map((c) => (
                    <button key={c} type="button" aria-pressed={card === c} className="choice justify-center px-2 text-sm" onClick={() => setCard(c)}>
                      {missionName(c)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <PrimaryBar>
                <button type="button" className="btn-ghost" onClick={() => act(undefined, {})}>
                  {t('play.guess.skip')}
                </button>
                <button type="button" className="btn-primary" disabled={!card || !target} onClick={() => card && act(undefined, { [target]: card })}>
                  {t('play.guess.submit')}
                </button>
              </PrimaryBar>
            </>
          )}
        </section>
      </Page>
    </>
  );
}

/** Section 7.6: one short screen. Tables only when opened. */
function EpisodeSummary({ v }: { v: ViewState }) {
  const { go, replay, online, leaveOnline, chooseMode } = useStore();
  const pl = v.play!;
  const [really, setReally] = useState(false);
  const scores = pl.finalScores ?? {};
  const ranked = v.players.slice().sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const winner = ranked[0];
  const moment = biggestMoment(pl, v.levelIndex);
  const start = pl.startingBank;
  const m = pl.mission!;
  const complete = m.scale * m.value >= m.goal;
  const myGuess = pl.guesses[v.levelIndex]?.[v.viewer];
  const guessLine = myGuess
    ? hostLine(myGuess.correct ? 'guessRight' : 'guessWrong', pick(v, 'guess', 6), { name: nameOf(v, myGuess.target) })
    : hostLine('guessNone', pick(v, 'guess', 6));
  let momentText = '';
  if (moment?.kind === 'event') momentText = t('play.summary.momentEvent', { r: moment.round, event: eventText(v.levelIndex, moment.id).name });
  else if (moment)
    momentText = t(moment.who === v.viewer ? 'play.summary.momentSwingYou' : 'play.summary.momentSwing', { r: moment.round, name: nameOf(v, moment.who), change: signed(moment.change) });
  const d = v.levelResults[v.levelIndex] as L3Debrief | undefined;
  return (
    <>
      <Page narrow>
        <p className="label">{t('play.summary.title')}</p>
        <h1 className="h-show mt-1 text-3xl">{winner.id === v.viewer ? t('play.summary.winnerYou') : t('play.summary.winner', { name: nameOf(v, winner.id) })}</h1>
        <div className="mt-3">
          <Host line={guessLine} />
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          {momentText && (
            <div>
              <dt className="label">{t('play.summary.moment')}</dt>
              <dd className="font-semibold">{momentText}</dd>
            </div>
          )}
          <div>
            <dt className="label">{t('play.bar.bank')}</dt>
            <dd className="font-semibold">{t('play.summary.bankChange', { from: coins(start), to: coins(pl.banks[v.viewer]) })}</dd>
          </div>
          <div>
            <dt className="label">{t('play.summary.mission', { name: missionName(m.card) })}</dt>
            <dd className="mt-1 flex items-center gap-2">
              <Stamp small rotate={-2} tone={complete ? 'good' : 'stamp'}>
                {complete ? t('play.summary.missionDone') : t('play.summary.missionMissed')}
              </Stamp>
              <span className="num text-xs text-soft">
                {coins(m.scale * m.value)} / {coins(m.goal)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="label">{t('play.guess.title')}</dt>
            <dd>
              {myGuess ? (
                <>
                  {t('play.summary.guess', { name: nameOf(v, myGuess.target), mission: missionName(myGuess.card) })}{' '}
                  {myGuess.correct
                    ? t('play.summary.guessRight', { pts: PLAY.GUESS_POINTS })
                    : t('play.summary.guessWrong', { name: nameOf(v, myGuess.target), mission: missionName(v.players.find((p) => p.id === myGuess.target)!.values!) })}
                </>
              ) : (
                t('play.summary.noGuess')
              )}
            </dd>
          </div>
        </dl>
        <button type="button" className="btn-ghost mt-4 w-full" aria-expanded={really} onClick={() => setReally(!really)}>
          {t('play.really.button')}
        </button>
        {really && (
          <section className="mt-2 rounded-md border-2 border-ink bg-card p-3 text-sm" data-really>
            <ul className="space-y-1.5">
              {[0, 1, 2].map((i) => (
                <li key={i}>{t(`play.really.L${v.levelIndex}.${i}`)}</li>
              ))}
            </ul>
            {!online && (
              <button type="button" className="mt-2 font-semibold underline" onClick={() => chooseMode('SINGLE_LEVEL', v.levelIndex)}>
                {t('play.really.link')}
              </button>
            )}
          </section>
        )}
        <div className="mt-4">
          <Collapsible title={t('play.summary.results')}>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('play.summary.colName')}</th>
                    <th>{t('play.summary.colMission')}</th>
                    <th className="text-end">{t('play.summary.colBank')}</th>
                    <th className="text-end">{t('play.summary.colScore')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p, i) => (
                    <tr key={p.id} className={p.id === v.viewer ? 'font-semibold' : ''}>
                      <td className="num">{i + 1}</td>
                      <td>{shortName(v, p.id)}</td>
                      <td>{p.values ? missionName(p.values) : ''}</td>
                      <td className="num text-end">{coins(pl.banks[p.id])}</td>
                      <td className="num text-end">{coins(scores[p.id] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-soft">{t('play.summary.scoreNote', { k: m.scale })}</p>
            {d && <p className="mt-1 text-xs text-soft">{t('play.l3.regimeResult', { name: t(`play.l3.regimes.${d.regime}.name`) })}</p>}
          </Collapsible>
        </div>
        {v.seed && <p className="label mt-4">{t('play.summary.seed', { seed: v.seed })}</p>}
        <p className="mt-2 text-xs text-soft">{t('play.disclaimer')}</p>
        <PrimaryBar>
          {!online && (
            <button type="button" className="btn-ghost" onClick={() => replay(false)}>
              {t('play.summary.again')}
            </button>
          )}
          {v.phase.kind === 'LEVEL_DEBRIEF' ? (
            <ReadyButton v={v} label={t('app.continue')} onClick={() => useStore.getState().act()} />
          ) : (
            <button type="button" className="btn-primary" onClick={() => (online ? leaveOnline() : go('title'))}>
              {t('play.summary.menu')}
            </button>
          )}
        </PrimaryBar>
      </Page>
    </>
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
  if (k === 'VALUES_REVEAL') return <MissionReveal v={v} />;
  if (k === 'INTRO') return <EpisodeIntro v={v} />;
  if (k === 'GUESS') return <EpisodeGuess v={v} />;
  if (k === 'LEVEL_DEBRIEF' || k === 'END') return <EpisodeSummary v={v} />;
  return <PlayTable v={v} />;
}
