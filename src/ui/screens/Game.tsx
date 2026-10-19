import { useEffect, useState } from 'react';
import type { LevelId, ValuesCard, ViewState } from '../../engine/types';
import { VALUES_CARDS } from '../../engine/types';
import type { L2Debrief } from '../../engine/levels/level2';
import type { L5Debrief } from '../../engine/levels/level5';
import { useStore } from '../store';
import { t } from '../i18n';
import { cardName, cardTitle, coins, pct } from '../labels';
import { currentRecord, headlineText, nameOf, useView } from '../game';
import { Collapsible, FlipCard, FormCard, Page, Stamp, useMotionOff } from '../components/common';
import { ChatFeed, ChatStrip, ContinueBar, MessageComposer, PlayerStrip, PrimaryBar, ResultsContext, Sheet, SummaryBlock, TopBar } from '../components/TableParts';
import { isBannerReveal, screenDecisionPhase } from '../../shared/flow';
import type { Phase } from '../../engine/types';
import { L1UI } from '../levels/L1';
import { L2UI } from '../levels/L2';
import { L3UI } from '../levels/L3';
import { L4UI } from '../levels/L4';
import { L5UI } from '../levels/L5';
import type { LevelUI } from '../levels/types';
import { LockedInPanel, ReadyButton, useOnline, useWaiting } from '../components/Online';

const UI: Record<LevelId, LevelUI> = { 1: L1UI, 2: L2UI, 3: L3UI, 4: L4UI, 5: L5UI };

function ValuesCardFace({ card }: { card: ValuesCard }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-lg border-4 border-double border-ink bg-card p-5">
      <div className="label">{t('values.formTitle')}</div>
      <div>
        <div className="h-display text-4xl">{cardName(card)}</div>
        <div className="mt-1 text-lg italic">“{cardTitle(card)}”</div>
      </div>
      <Stamp rotate={-8}>{t('stamps.APPROVED')}</Stamp>
    </div>
  );
}

function ValuesReveal({ v }: { v: ViewState }) {
  const me = v.players.find((p) => p.id === v.viewer)!;
  const [flipped, setFlipped] = useState(false);
  const off = useMotionOff();
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), off ? 0 : 500);
    return () => clearTimeout(id);
  }, [off]);
  return (
    <Page narrow>
      <FlipCard
        className="mx-auto h-72 max-w-sm"
        flipped={flipped}
        back={
          <div className="flex h-full items-center justify-center rounded-lg border-4 border-double border-ink bg-ink text-paper">
            <span className="h-display text-3xl">{t('app.title')}</span>
          </div>
        }
        front={<ValuesCardFace card={me.values!} />}
      />
      <div className="mt-6 space-y-3 text-sm leading-relaxed" aria-live="polite">
        {flipped && (
          <>
            <p className="font-semibold">{t(`values.${me.values}.blurb`)}</p>
            <p>{t('values.scoring')}</p>
            <p>{t(`values.${me.values}.metric`)}</p>
            <p className="rounded-md border-2 border-stamp p-3 text-stamp">{t('values.private')}</p>
            <p className="text-soft">{t('values.deck')}</p>
          </>
        )}
      </div>
      <ContinueBar label={t('values.accept')} />
    </Page>
  );
}

function LevelIntro({ v }: { v: ViewState }) {
  const level = v.levelIndex;
  const memo = t(`levels.${level}.memo`);
  const off = useMotionOff();
  const [n, setN] = useState(off ? memo.length : 0);
  useEffect(() => {
    if (off) {
      setN(memo.length);
      return;
    }
    const id = setInterval(() => setN((x) => (x >= memo.length ? x : x + 4)), 16);
    return () => clearInterval(id);
  }, [memo, off]);
  return (
    <Page narrow>
      <p className="label">
        {t('mode.level', { n: level })} · {v.mode === 'FULL_RUN' ? t('mode.fullRun') : t('mode.single')}
      </p>
      <h1 className="h-display mt-1 text-4xl">{t(`levels.${level}.name`)}</h1>
      <p className="mt-1 text-soft">{t(`levels.${level}.question`)}</p>
      <div className="mt-4" />
      <FormCard form={t('ui.memoHead')}>
        <p className="font-mono text-sm leading-relaxed" aria-label={memo}>
          <span aria-hidden>{memo.slice(0, n)}</span>
          {n < memo.length && <span aria-hidden className="animate-pulse">▌</span>}
        </p>
        {n < memo.length && (
          <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => setN(memo.length)}>
            {t('ui.skip')}
          </button>
        )}
      </FormCard>
      <section className="mt-5" aria-labelledby="how-title">
        <h2 id="how-title" className="label">{t('ui.howTitle')}</h2>
        <ol className="mt-2 list-decimal space-y-2 ps-5 leading-relaxed">
          {t(`levels.${level}.how`)
            .split('\n')
            .filter((s) => s.trim())
            .map((step, i) => (
              <li key={i}>{step}</li>
            ))}
        </ol>
        <div className="mt-4">
          <Collapsible title={t('ui.formulasTitle')}>
            <p className="num text-xs leading-relaxed">{t(`levels.${level}.formulas`)}</p>
          </Collapsible>
        </div>
      </section>
      <ContinueBar />
    </Page>
  );
}

/** Banners for the decision screen: the round's briefing line and any short result just before it. */
function banners(v: ViewState): { briefing?: Phase; reveal?: Phase } {
  const out: { briefing?: Phase; reveal?: Phase } = {};
  for (let i = v.phaseIdx - 1; i >= 0; i--) {
    const p = v.queue[i];
    if (p.kind === 'TALK') continue;
    if (p.kind === 'BRIEFING') {
      out.briefing = p;
      continue;
    }
    if (isBannerReveal(v.levelIndex, p)) {
      out.reveal = p;
      continue;
    }
    break;
  }
  return out;
}

function DecisionScreen({ v, onReply }: { v: ViewState; onReply: () => void }) {
  const ui = UI[v.levelIndex];
  const dp = screenDecisionPhase(v, v.queue);
  const dv = dp && dp !== v.phase ? { ...v, phase: dp } : v;
  const { briefing, reveal } = banners(v);
  const brief = briefing ? ui.briefing({ ...v, phase: briefing }) : '';
  const online = useOnline();
  // Online, once this player's choice is in, the form gives way to a short note (the talk stays open).
  const { done } = useWaiting(v);
  return (
    <div className="space-y-3">
      {brief && <p className="border-s-4 border-ink ps-3 text-sm leading-snug text-soft">{brief}</p>}
      {reveal && ui.Banner && <ui.Banner v={v} step={reveal.step ?? ''} />}
      {v.phase.kind === 'TALK' && <ChatStrip v={v} onReply={onReply} />}
      {online && done ? <LockedInPanel v={v} /> : <ui.Decide v={dv} />}
      {online && !done && <p className="text-xs text-soft">{t('room.autoNote')}</p>}
    </div>
  );
}

/** A reveal and the round summary on one screen, with one Continue for both. */
function ResultsScreen({ v }: { v: ViewState }) {
  const ui = UI[v.levelIndex];
  const act = useStore((s) => s.act);
  const next = v.queue[v.phaseIdx + 1];
  const poll = next?.kind === 'DECIDE' && next.step === 'POLL';
  const online = useOnline();
  const { done } = useWaiting(v);
  return (
    <div className="space-y-4">
      <ResultsContext.Provider value>
        <ui.Reveal v={v} />
        {/* Levels 2 to 4 already list everyone's money in the reveal. */}
        <SummaryBlock v={v} showMoney={![2, 3, 4].includes(v.levelIndex)} />
        {poll && (online && done ? <LockedInPanel v={v} /> : <ui.Decide v={{ ...v, phase: next }} />)}
      </ResultsContext.Provider>
      {!poll && (
        <PrimaryBar>
          <ReadyButton v={v} label={t('app.continue')} onClick={() => act()} />
        </PrimaryBar>
      )}
    </div>
  );
}

function Center({ v, onReply }: { v: ViewState; onReply: () => void }) {
  const ui = UI[v.levelIndex];
  const k = v.phase.kind;
  const next = v.queue[v.phaseIdx + 1];
  if (k === 'TALK' || k === 'DECIDE') return <DecisionScreen v={v} onReply={onReply} />;
  if (k === 'REVEAL') {
    const merged = next?.kind === 'ROUND_SUMMARY' || (next?.kind === 'DECIDE' && next.step === 'POLL');
    return merged ? <ResultsScreen v={v} /> : <ui.Reveal v={v} />;
  }
  if (k === 'ROUND_SUMMARY')
    return (
      <>
        <SummaryBlock v={v} />
        <ContinueBar />
      </>
    );
  return null;
}

function Table({ v }: { v: ViewState }) {
  const go = useStore((s) => s.go);
  const online = useOnline();
  const leaveOnline = useStore((s) => s.leaveOnline);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | 'chat' | 'reply'>(null);
  const ui = UI[v.levelIndex];
  const canTalk = v.phase.kind === 'TALK';
  const announce = `${t(`phase.${v.phase.kind}`)}. ${v.phase.kind === 'REVEAL' ? headlineText(currentRecord(v), v) : ''}`;
  return (
    <>
      <TopBar v={v} onMenu={() => setMenu(true)} onChat={() => setSheet('chat')} />
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      <main className="mx-auto grid max-w-page grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 lg:py-4">
        <div className="min-w-0 space-y-3">
          <PlayerStrip v={v} />
          <div key={v.phaseIdx}>
            <Center v={v} onReply={() => setSheet('reply')} />
          </div>
          <div className="lg:hidden">
            <Collapsible title={t('table.info')}>
              <ui.Info v={v} />
            </Collapsible>
          </div>
        </div>
        <aside className="hidden space-y-4 lg:block">
          <FormCard form={t('table.info')}>
            <ui.Info v={v} />
          </FormCard>
          <FormCard form={t('table.transcript')}>
            <div className="max-h-[50vh] overflow-y-auto pe-1">
              <ChatFeed v={v} />
            </div>
            {canTalk && (
              <button type="button" className="btn-ghost mt-3 w-full" onClick={() => setSheet('reply')}>
                {t('flow.reply')}
              </button>
            )}
          </FormCard>
        </aside>
      </main>
      {sheet && (
        <Sheet title={t('table.transcript')} closeLabel={sheet === 'reply' ? t('flow.sheetDone') : t('app.back')} onClose={() => setSheet(null)}>
          <ChatFeed v={v} />
          {canTalk && (sheet === 'reply' || sheet === 'chat') && <MessageComposer v={v} />}
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
              <button type="button" className="btn-ghost" onClick={() => go('archives')}>
                {t('app.archives')}
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

function Guess({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const online = useOnline();
  const { done } = useWaiting(v);
  // Everyone else at the table (in solo play, the bots).
  const bots = v.players.filter((p) => p.id !== v.viewer);
  const [g, setG] = useState<Record<string, ValuesCard>>(Object.fromEntries(bots.map((b) => [b.id, 'EGOIST' as ValuesCard])));
  return (
    <Page narrow>
      <FormCard form={t('guess.title')}>
        <p className="mb-4 text-sm">{t('guess.intro')}</p>
        {online && done ? (
          <LockedInPanel v={v} />
        ) : (
          <>
            <div className="space-y-4">
              {bots.map((b) => (
                <fieldset key={b.id}>
                  <legend className="font-semibold">{b.name}</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={b.name}>
                    {VALUES_CARDS.map((c) => (
                      <button key={c} type="button" aria-pressed={g[b.id] === c} className="choice justify-center px-2 text-sm" onClick={() => setG({ ...g, [b.id]: c })}>
                        {cardName(c)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <PrimaryBar>
              <button type="button" className="btn-primary" onClick={() => act(undefined, g)}>
                {t('guess.submit')}
              </button>
            </PrimaryBar>
          </>
        )}
      </FormCard>
    </Page>
  );
}

/**
 * Built only from answers that never affected the score (D-42): fair-tax answers, Bonus Pot, luck guesses.
 * It describes what you said; it does not diagnose why your fair-tax answer moved (D-73).
 */
function ideology(v: ViewState) {
  const d2 = v.levelResults[2] as L2Debrief | undefined;
  const d5 = v.levelResults[5] as L5Debrief | undefined;
  const ideal = d2?.bonus?.classification?.[0] ?? 'none';
  const lines: string[] = [];
  if (d5?.fair1?.[v.viewer] !== undefined && d5.fair2?.[v.viewer] !== undefined)
    lines.push(t('run.fairLine', { f1: `${Math.round(d5.fair1[v.viewer] * 100)}%`, f2: `${Math.round(d5.fair2[v.viewer] * 100)}%` }));
  if (d2?.bonus?.classification?.length) lines.push(t('run.bonusLine', { ideal: t(`run.l2.${ideal}`) }));
  if (d2?.polls?.length) {
    const belief = Math.round((d2.polls.reduce((x, p) => x + p.answer, 0) / d2.polls.length) * 100);
    const truth = Math.round((d2.polls.reduce((x, p) => x + p.truth, 0) / d2.polls.length) * 100);
    lines.push(t('run.luckLine', { belief, truth }));
  }
  return { lines, label: t(`run.labels.${ideal}`) };
}

function RunDebrief({ v }: { v: ViewState }) {
  const { go, game, replay, online, leaveOnline } = useStore();
  // Level points (D-45): each level counts the same. Raw scores stay in the level summaries.
  const points = (id: string) => v.scores[id]?.points?.reduce((a, b) => a + b, 0) ?? 0;
  const total = (id: string) => points(id) + (v.scores[id]?.guessBonus ?? 0);
  const ranked = v.players.slice().sort((a, b) => total(b.id) - total(a.id));
  const ide = ideology(v);
  const off = useMotionOff();
  const [flipped, setFlipped] = useState(off);
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), off ? 0 : 400);
    return () => clearTimeout(id);
  }, [off]);
  const download = () => {
    if (!game) return;
    const blob = new Blob([JSON.stringify({ seed: game.seed, config: game.config, log: game.log, history: game.history }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-veil-${game.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display text-3xl">{t('run.title')}</h1>
        <Stamp>{t('run.stamp')}</Stamp>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormCard form={t('run.ranking')}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('run.colCitizen')}</th>
                  <th>{t('run.colCard')}</th>
                  <th className="text-end">{t('run.colLevels')}</th>
                  <th className="text-end">{t('run.colGuess')}</th>
                  <th className="text-end">{t('run.colTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p, i) => (
                  <tr key={p.id} className={p.id === v.viewer ? 'font-semibold' : ''}>
                    <td className="num">{i + 1}</td>
                    <td>{nameOf(v, p.id)}</td>
                    <td>
                      {p.values && (
                        <FlipCard
                          className="h-6 w-28"
                          flipped={flipped}
                          back={<span className="block h-full w-full rounded bg-ink" />}
                          front={<span className="text-sm">{cardName(p.values)}</span>}
                        />
                      )}
                    </td>
                    <td className="num text-end">{coins(points(p.id))}</td>
                    <td className="num text-end">{v.scores[p.id]?.guessBonus ?? 0}</td>
                    <td className="num text-end">{coins(total(p.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-soft">{t('run.pointsNote')}</p>
        </FormCard>
        <FormCard form={t('run.ideology')}>
          <p className="text-lg leading-snug">{ide.lines[0]}</p>
          {ide.lines.slice(1).map((l) => (
            <p key={l} className="mt-2 text-sm">
              {l}
            </p>
          ))}
          <p className="mt-2 text-xs text-soft">{t('run.ideologyNote')}</p>
          <p className="h-display mt-4 text-2xl">{t('run.filed', { label: ide.label })}</p>
        </FormCard>
        <FormCard form={t('run.botGuesses')}>
          <ul className="space-y-2 text-sm">
            {Object.entries(v.botBeliefs ?? {}).map(([bot, belief]) => {
              const guess = v.guesses?.bots[bot]?.[v.viewer];
              const mine = v.players.find((p) => p.id === v.viewer)?.values;
              return (
                <li key={bot}>
                  <div className="flex justify-between">
                    <span className="font-semibold">{t('run.botGuessLine', { bot: nameOf(v, bot), guess: guess ? cardName(guess) : '?' })}</span>
                    <span className={guess === mine ? 'text-good' : 'text-stamp'}>{guess === mine ? t('run.correct') : t('run.wrong')}</span>
                  </div>
                  <div className="num text-xs text-soft">{VALUES_CARDS.map((c) => `${cardName(c)} ${pct(belief?.[c] ?? 0)}`).join(' · ')}</div>
                </li>
              );
            })}
          </ul>
          <div className="label mt-4">{t('run.yourGuesses')}</div>
          <ul className="mt-1 text-sm">
            {Object.entries(v.guesses?.human ?? {}).map(([id, c]) => {
              const truth = v.players.find((p) => p.id === id)?.values;
              return (
                <li key={id}>
                  {nameOf(v, id)}: {cardName(c)} <span className={truth === c ? 'text-good' : 'text-stamp'}>({truth === c ? t('run.correct') : t('run.wrong')})</span>
                </li>
              );
            })}
          </ul>
        </FormCard>
        <FormCard form={t('run.trust')}>
          <ul className="space-y-1 text-sm">
            {v.players.map((p) => {
              const r = v.reliability?.[p.id] ?? { made: 0, kept: 0 };
              return (
                <li key={p.id} className="flex justify-between">
                  <span>{nameOf(v, p.id)}</span>
                  <span className="num">
                    {pct((r.kept + 1) / (r.made + 2))} ({r.kept}/{r.made})
                  </span>
                </li>
              );
            })}
          </ul>
        </FormCard>
      </div>
      {/* Online, the game code stays blank until every card is public (D-65). */}
      {v.seed && (
        <p className="label mt-6" data-seed>
          {t('run.seed', { seed: v.seed })}
        </p>
      )}
      <div className="sticky bottom-0 -mx-4 mt-4 flex flex-wrap justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        {!online && (
          <>
            <button type="button" className="btn-ghost" onClick={download}>
              {t('run.download')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => replay(true)}>
              {t('debrief.replaySame')}
            </button>
          </>
        )}
        <button type="button" className="btn-primary" onClick={() => (online ? leaveOnline() : go('title'))}>
          {t('debrief.menu')}
        </button>
      </div>
    </Page>
  );
}

export function GameScreen() {
  const v = useView();
  const off = useMotionOff();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: off ? 'auto' : 'smooth' });
  }, [v?.phaseIdx, v?.levelIndex, v?.phase.kind, off]);
  if (!v) return null;
  const k = v.phase.kind;
  if (k === 'VALUES_REVEAL') return <ValuesReveal v={v} />;
  if (k === 'INTRO') return <LevelIntro v={v} />;
  if (k === 'LEVEL_DEBRIEF' || (k === 'END' && v.mode === 'SINGLE_LEVEL')) {
    const D = UI[v.levelIndex].Debrief;
    return <D v={v} />;
  }
  if (k === 'GUESS') return <Guess v={v} />;
  if (k === 'RUN_DEBRIEF' || k === 'END') return <RunDebrief v={v} />;
  return <Table v={v} />;
}
