// The opening of Play mode (D-139; one card since UI V3 U3): cards that tell a new player what the game is, shown
// the first time Play mode opens (before "Pick your show") and again from "What is this game?". Presentation
// only: no engine state, no logged action. Seen once is remembered in this browser; if storage fails, the
// cards simply show again.
import { t } from '../i18n';
import { DashHost, ShapePerson } from './Characters';

const KEY = 'veil.play.opening.seen';

export function openingSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Storage blocked: the cards show again next time, which is harmless.
  }
}

/**
 * UI V3 (U3): one card and a Skip link; the rest is taught in play by hint lines (Coach.tsx). UI V4 (V1): a
 * screen of its own (no pop-up); `inline` shows the same card inside the menu.
 */
export function PlayOpening({ onDone, inline = false }: { onDone: () => void; inline?: boolean }) {
  const done = () => {
    markSeen();
    onDone();
  };
  return (
    <section className={`flex flex-col bg-paper text-ink ${inline ? '' : 'min-h-[100dvh]'}`} aria-labelledby="opening-title" data-opening={1} onClick={(e) => e.stopPropagation()}>
      <div className={`mx-auto flex w-full max-w-md flex-1 flex-col ${inline ? '' : 'px-4 pb-4 pt-3'}`}>
        <div className={`flex justify-end ${inline ? 'hidden' : ''}`}>
          <button type="button" className="min-h-[44px] px-2 text-small font-semibold underline" onClick={done} data-opening-skip>
            {t('play.opening.skip')}
          </button>
        </div>
        <div className="my-auto">
          <div className="flex items-end justify-center gap-1" aria-hidden>
            <DashHost expr="excited" size={64} />
            {(['marigold', 'chet', 'ugo', 'dot'] as const).map((k, i) => (
              <ShapePerson key={k} kind={k} expr={i % 2 ? 'smug' : 'pleased'} size={56} />
            ))}
          </div>
          <h1 id="opening-title" className="h-show mt-4 text-hero leading-none text-spot">
            {t('play.opening.c1.headline')}
          </h1>
          <p className="mt-3 text-body leading-snug">{t('play.opening.c1.body')}</p>
          <p className="mt-3 text-body leading-snug">{t('play.opening.one.loop')}</p>
          <p className="mt-3 text-body leading-snug">{t('play.opening.one.win')}</p>
          <p className="mt-3 text-small text-soft">{t('play.opening.c3.small')}</p>
        </div>
        <button type="button" className="min-h-[52px] w-full rounded-full bg-action text-lead font-bold text-onaction" onClick={done} data-opening-next>
          {t('play.opening.go')}
        </button>
      </div>
    </section>
  );
}
