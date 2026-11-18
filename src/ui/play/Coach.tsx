// UI V3 (U3): teach in play. UI V4 (V1): no pop-ups, so a coach mark is now one hint line in the screen
// itself, under the thing it explains, shown the first time only (remembered in this browser; try/catch:
// blocked storage shows it again next time). Off under browser automation unless a capture turns it on
// (`veil.play.coach` = 1), so tests read the screens as before.
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { PLAY } from '../../engine/play/params';

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

// UI V4 (V2): at most one hint on a screen; another waits for a later screen.
let current: string | null = null;

/** Whether this hint shows on this screen (the first time only). Marks it seen once shown. */
export function useFirstTime(id: string, active = true): boolean {
  const [show] = useState(() => {
    const ok = active && enabled() && !seen(id) && (current === null || current === id);
    if (ok) current = id;
    return ok;
  });
  useEffect(() => {
    if (!show) return;
    current = id;
    try {
      localStorage.setItem(key(id), '1');
    } catch {
      // Storage blocked: the hint shows again next time.
    }
    return () => {
      if (current === id) current = null;
    };
  }, [show, id]);
  return show;
}

export function Coach({ id }: { id: 'claim' | 'move' | 'call' }) {
  const show = useFirstTime(id);
  if (!show) return null;
  return (
    <p className="mt-1 text-small font-semibold leading-snug text-spot" role="note" data-coach={id}>
      {t(`play.coach.${id}`, { win: PLAY.CALL_PAYOUT, n: PLAY.CALL_STAKE })}
    </p>
  );
}
