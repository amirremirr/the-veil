import { useEffect, useState } from 'react';
import type { LevelId, ValuesCard, ViewState } from '../../engine/types';
import { VALUES_CARDS } from '../../engine/types';
import type { L1Debrief } from '../../engine/levels/level1';
import type { L2Debrief } from '../../engine/levels/level2';
import type { L3Debrief } from '../../engine/levels/level3';
import type { L4Debrief } from '../../engine/levels/level4';
import type { L5Debrief } from '../../engine/levels/level5';
import { useStore } from '../store';
import { t } from '../i18n';
import { cardName, cardTitle, coins, pct } from '../labels';
import { HUMAN_ID, currentRecord, headlineText, nameOf, useView } from '../game';
import { Collapsible, FlipCard, FormCard, Page, Stamp, useMotionOff } from '../components/common';
import { ChatFeed, ContinueBar, PlayerStrip, PrimaryBar, RoundSummary, TalkComposer, TopBar } from '../components/TableParts';
import { L1UI } from '../levels/L1';
import { L2UI } from '../levels/L2';
import { L3UI } from '../levels/L3';
import { L4UI } from '../levels/L4';
import { L5UI } from '../levels/L5';
import type { LevelUI } from '../levels/types';

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
  const me = v.players.find((p) => p.id === HUMAN_ID)!;
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
      <div className="mt-4">
        <Collapsible title={t('ui.howTitle')}>
          <p>{t(`levels.${level}.how`)}</p>
          <div className="mt-3">
            <Collapsible title={t('ui.formulasTitle')}>
              <p className="num text-xs leading-relaxed">{t(`levels.${level}.formulas`)}</p>
            </Collapsible>
          </div>
        </Collapsible>
      </div>
      <ContinueBar />
    </Page>
  );
}

function Center({ v }: { v: ViewState }) {
  const ui = UI[v.levelIndex];
  const k = v.phase.kind;
  if (k === 'BRIEFING') {
    const text = ui.briefing(v);
    return (
      <FormCard form={`${t(`levels.${v.levelIndex}.name`)} · R${v.round}`}>
        <p className="font-mono text-sm leading-relaxed">{text}</p>
        <ContinueBar />
      </FormCard>
    );
  }
  if (k === 'TALK') return <TalkComposer v={v} />;
  if (k === 'DECIDE') return <ui.Decide v={v} />;
  if (k === 'REVEAL') return <ui.Reveal v={v} />;
  if (k === 'ROUND_SUMMARY') return <RoundSummary v={v} />;
  return null;
}

function Table({ v }: { v: ViewState }) {
  const go = useStore((s) => s.go);
  const [menu, setMenu] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const ui = UI[v.levelIndex];
  const count = v.messages.filter((m) => m.level === v.levelIndex).length;
  const announce = `${t(`phase.${v.phase.kind}`)}. ${v.phase.kind === 'ROUND_SUMMARY' ? headlineText(currentRecord(v)) : ''}`;
  return (
    <>
      <TopBar v={v} onMenu={() => setMenu(true)} />
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      <div className="mx-auto grid max-w-page grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <PlayerStrip v={v} />
          <div key={v.phaseIdx}>
            <Center v={v} />
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
          </FormCard>
        </aside>
      </div>
      {v.phase.kind !== 'TALK' && (
        <button
          type="button"
          className="btn-ghost fixed bottom-20 start-4 z-30 shadow-md lg:hidden"
          aria-expanded={chatOpen}
          onClick={() => setChatOpen(true)}
        >
          {t('table.openTranscript', { n: count })}
        </button>
      )}
      {chatOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-paper lg:hidden" role="dialog" aria-modal="true" aria-label={t('table.transcript')}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="label">{t('table.transcript')}</span>
            <button type="button" className="btn-ghost" onClick={() => setChatOpen(false)}>
              {t('app.back')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ChatFeed v={v} />
          </div>
        </div>
      )}
      {menu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label={t('table.menu')}>
          <div className="form-card w-full max-w-sm p-4">
            <p className="mb-4 text-sm">{t('table.quitConfirm')}</p>
            <div className="flex flex-col gap-2">
              <button type="button" className="btn-primary" autoFocus onClick={() => setMenu(false)}>
                {t('table.resume')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => go('archives')}>
                {t('app.archives')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => go('title')}>
                {t('table.quit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Guess({ v }: { v: ViewState }) {
  const dispatch = useStore((s) => s.dispatch);
  const bots = v.players.filter((p) => !p.isHuman);
  const [g, setG] = useState<Record<string, ValuesCard>>(Object.fromEntries(bots.map((b) => [b.id, 'EGOIST' as ValuesCard])));
  return (
    <Page narrow>
      <FormCard form={t('guess.title')}>
        <p className="mb-4 text-sm">{t('guess.intro')}</p>
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
          <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'SUBMIT_GUESSES', guesses: g })}>
            {t('guess.submit')}
          </button>
        </PrimaryBar>
      </FormCard>
    </Page>
  );
}

function ideology(v: ViewState) {
  const d1 = v.levelResults[1] as L1Debrief | undefined;
  const d2 = v.levelResults[2] as L2Debrief | undefined;
  const d3 = v.levelResults[3] as L3Debrief | undefined;
  const d4 = v.levelResults[4] as L4Debrief | undefined;
  const d5 = v.levelResults[5] as L5Debrief | undefined;
  const votes = d1?.rounds.map((r) => r.votes[HUMAN_ID]) ?? [];
  const top = (['P1', 'P2', 'P3', 'P4'] as const).map((p) => [p, votes.filter((x) => x === p).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const l2 = d2?.bonus?.classification?.[0] ?? 'none';
  const l3 = d3?.regimeVotes?.[HUMAN_ID] ?? d3?.regime ?? 'VOL';
  const verdict = d5?.verdict ?? 'none';
  return {
    line: t('run.ideologyLine', { l1: t(`run.l1.${top}`), l2: t(`run.l2.${l2}`), l3: t(`run.l3.${l3}`), tail: t(`run.tails.${verdict}`) }),
    policy: d4?.policyVotes?.[HUMAN_ID] ? t('run.policyLine', { policy: t(`levels.4.policies.${d4.policyVotes[HUMAN_ID]}.name`) }) : '',
    label: t(`run.labels.${verdict}`),
  };
}

function RunDebrief({ v }: { v: ViewState }) {
  const { go, game, replay } = useStore();
  const total = (id: string) => (v.scores[id]?.byLevel.reduce((a, b) => a + b, 0) ?? 0) + (v.scores[id]?.guessBonus ?? 0);
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
                  <tr key={p.id} className={p.id === HUMAN_ID ? 'font-semibold' : ''}>
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
                    <td className="num text-end">{coins(v.scores[p.id]?.byLevel.reduce((a, b) => a + b, 0) ?? 0)}</td>
                    <td className="num text-end">{v.scores[p.id]?.guessBonus ?? 0}</td>
                    <td className="num text-end">{coins(total(p.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormCard>
        <FormCard form={t('run.ideology')}>
          <p className="text-lg leading-snug">{ide.line}</p>
          {ide.policy && <p className="mt-2 text-sm">{ide.policy}</p>}
          <p className="h-display mt-4 text-2xl">{t('run.filed', { label: ide.label })}</p>
        </FormCard>
        <FormCard form={t('run.botGuesses')}>
          <ul className="space-y-2 text-sm">
            {Object.entries(v.botBeliefs ?? {}).map(([bot, belief]) => {
              const guess = v.guesses?.bots[bot]?.[HUMAN_ID];
              const mine = v.players.find((p) => p.id === HUMAN_ID)?.values;
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
      <p className="label mt-6">{t('run.seed', { seed: v.seed })}</p>
      <div className="sticky bottom-0 -mx-4 mt-4 flex flex-wrap justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <button type="button" className="btn-ghost" onClick={download}>
          {t('run.download')}
        </button>
        <button type="button" className="btn-ghost" onClick={() => replay(true)}>
          {t('debrief.replaySame')}
        </button>
        <button type="button" className="btn-primary" onClick={() => go('title')}>
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
