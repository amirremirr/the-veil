// UI V3 (U3): teach in play. A coach mark on the first claim, the first move and the first call, each shown
// once, dismissible, remembered in this browser (try/catch: blocked storage shows it again next time).
// Off under browser automation unless a capture turns it on (`veil.play.coach` = 1), so tests tap as before.
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { PLAY } from '../../engine/play/params';
import { DashHost } from './Characters';

const key = (id: string) => `veil.play.coach.${id}`;

function enabled(): boolean {
  try {
    if (localStorage.getItem('veil.play.coach') === '1') return true;
  } catch {
    // fall through
  }
  return !(typeof navigator !== 'undefined' && navigator.webdriver);
}

function seen(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === '1';
  } catch {
    return false;
  }
}

export function Coach({ id, after }: { id: 'claim' | 'move' | 'call'; after?: 'claim' | 'move' }) {
  // `after`: wait until that mark has been dismissed, so two marks never show at once.
  const [open, setOpen] = useState(() => enabled() && !seen(id) && (!after || seen(after)));
  // Review cycle 1 (D-198): shown once per mechanic (seen as soon as it shows), gone after 7 seconds.
  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(key(id), '1');
    } catch {
      // Storage blocked: the mark shows again next time.
    }
    const tm = setTimeout(() => setOpen(false), 7000);
    return () => clearTimeout(tm);
  }, [open, id]);
  if (!open) return null;
  const close = () => setOpen(false);
  return (
    <div className="fixed inset-x-0 top-1 z-30 mx-auto w-full max-w-md px-4" role="note" data-coach={id} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-2 rounded-2xl border-2 border-spot bg-white p-2 text-onspot shadow-podium">
        <span aria-hidden className="shrink-0">
          <DashHost expr="wink" size={44} />
        </span>
        <p className="flex-1 text-small font-semibold leading-snug">{t(`play.coach.${id}`, { win: PLAY.CALL_PAYOUT, n: PLAY.CALL_STAKE })}</p>
        <button type="button" className="min-h-[44px] shrink-0 rounded-full bg-onspot px-3 text-small font-bold text-white" onClick={close} data-coach-ok>
          {t('play.coach.ok')}
        </button>
      </div>
    </div>
  );
}
