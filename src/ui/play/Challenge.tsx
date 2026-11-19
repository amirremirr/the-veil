// V6 part 4 (D-220): the challenge offer at the start of a life, and the result line at the end.
import { useState } from 'react';
import type { ViewState } from '../../engine/types';
import { t } from '../i18n';
import { BigButton, Stage } from './OnAir';
import { type Challenge, challengeDone, loadPick, offeredFor, savePick } from './challenges';

/** Three challenges for this life; pick one or skip. It never changes the score. */
export function ChallengePick({ v, onDone }: { v: ViewState; onDone: () => void }) {
  const offer = offeredFor(v.seed ?? '');
  const [x, setX] = useState<Challenge | null>(null);
  const decide = (pick: Challenge | null) => {
    savePick(v.seed ?? '', pick);
    onDone();
  };
  return (
    <Stage
      v={v}
      footer={
        <div className="flex gap-2">
          <button type="button" className="min-h-[52px] flex-1 rounded-full bg-card font-bold" onClick={() => decide(null)} data-beat-next data-challenge-skip>
            {t('play.challenge.skip')}
          </button>
          <div className="flex-1">
            <BigButton disabled={!x} onClick={() => decide(x)}>
              {t('play.challenge.take')}
            </BigButton>
          </div>
        </div>
      }
    >
      <div className="my-auto" data-challenge-offer>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.challenge.label')}</p>
        <h1 className="h-show mt-1 text-title leading-tight">{t('play.challenge.title')}</h1>
        <p className="mt-1 text-small">{t('play.challenge.how')}</p>
        <div className="mt-3 space-y-2" role="group" aria-label={t('play.challenge.title')}>
          {offer.map((c) => (
            <button key={c} type="button" aria-pressed={x === c} onClick={() => setX(c)} className={`block w-full rounded-2xl p-3 text-start ${x === c ? 'bg-spot text-onspot' : 'bg-card'}`} data-challenge={c}>
              <span className="h-show block text-lead leading-tight">{t(`play.challenge.list.${c}.name`)}</span>
              <span className="block text-small">{t(`play.challenge.list.${c}.desc`)}</span>
            </button>
          ))}
        </div>
      </div>
    </Stage>
  );
}

/** Whether this life still needs its challenge offer (a life, at its very start, not yet decided). */
export function needsChallenge(v: ViewState, online: boolean): boolean {
  return !online && v.mode === 'LIFE' && v.levelIndex === 1 && v.phase.kind === 'INTRO' && !loadPick(v.seed ?? '').decided;
}

/** The end-of-life line: the picked challenge, done or not; null when none was picked. */
export function challengeLine(v: ViewState): { text: string; done: boolean } | null {
  const { pick } = loadPick(v.seed ?? '');
  if (!pick) return null;
  const done = challengeDone(v, pick);
  return { text: t(done ? 'play.challenge.done' : 'play.challenge.notDone', { name: t(`play.challenge.list.${pick}.name`) }), done };
}
