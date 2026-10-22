// The opening of Play mode (D-139): three swipeable cards that tell a new player what the game is, shown
// the first time Play mode opens (before "Pick your show") and again from "What is this game?". Presentation
// only: no engine state, no logged action. Seen once is remembered in this browser; if storage fails, the
// cards simply show again.
import { useRef, useState } from 'react';
import { t } from '../i18n';

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

const CARDS = [1, 2, 3] as const;

export function PlayOpening({ onDone }: { onDone: () => void }) {
  const [k, setK] = useState(0);
  const startX = useRef<number | null>(null);
  const done = () => {
    markSeen();
    onDone();
  };
  const next = () => (k < CARDS.length - 1 ? setK(k + 1) : done());
  const prev = () => setK(Math.max(0, k - 1));
  const n = CARDS[k];
  const last = k === CARDS.length - 1;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-paper text-ink"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-title"
      data-opening={n}
      // Inside a game the cards sit on a tap-to-advance screen: keep their taps to themselves.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (dx < -50) next();
        else if (dx > 50) prev();
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex justify-end">
          <button type="button" className="min-h-[44px] px-2 text-sm font-semibold underline" onClick={done} data-opening-skip>
            {t('play.opening.skip')}
          </button>
        </div>
        <div className="my-auto">
          <h1 id="opening-title" className="h-show text-5xl leading-none text-spot">
            {t(`play.opening.c${n}.headline`)}
          </h1>
          {n === 2 ? (
            <>
              <p className="mt-4 text-lg">{t('play.opening.c2.intro')}</p>
              <ul className="mt-2 space-y-2">
                {(['claim', 'read', 'move', 'reveal'] as const).map((b) => (
                  <li key={b} className="rounded-2xl bg-card px-3 py-2 text-base">
                    {t(`play.opening.c2.${b}`)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-lg leading-snug">{t(`play.opening.c${n}.body`)}</p>
          )}
          {n === 1 && <p className="mt-4 text-base italic text-soft">{t('play.tagline')}</p>}
          {n === 3 && <p className="mt-4 text-sm text-soft">{t('play.opening.c3.small')}</p>}
        </div>
        <div className="mb-3 flex justify-center gap-2" aria-label={t('play.opening.dots', { n: k + 1, of: CARDS.length })} role="img">
          {CARDS.map((c, i) => (
            <span key={c} className={`h-2 w-2 rounded-full ${i === k ? 'bg-spot' : 'bg-line'}`} />
          ))}
        </div>
        <button type="button" className="min-h-[52px] w-full rounded-full bg-stamp text-lg font-bold text-onspot" onClick={next} data-opening-next>
          {last ? t('play.opening.go') : t('play.opening.next')}
        </button>
      </div>
    </div>
  );
}
