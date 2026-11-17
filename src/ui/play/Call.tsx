// H4 (D-194): "Call it", on the move screen of every episode, and the round's call results with stamps.
import type { CallRecord } from '../../engine/play/types';
import type { Message, ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { t } from '../i18n';
import { shortName } from '../game';
import { hostLine, pick } from './logic';
import { Bubble } from './OnAir';
import { useCallRegistration, useStageCue, type CastCue } from './Cast';
import { useFirstTime } from './Coach';

/** Other contestants with a claim this round (optionally only claims matching `filter`), callable now. */
export function claimantsNow(v: ViewState, filter?: (value: string) => boolean): string[] {
  if (!PLAY.CALL_ENABLED) return [];
  const out = new Set<string>();
  for (const m of v.messages as Message[]) {
    if (m.level !== v.levelIndex || m.round !== v.round || m.msg.type !== 'CLAIM' || m.from === v.viewer) continue;
    const value = (m.msg as { value: string }).value;
    if (value === 'SILENT' || (filter && !filter(value))) continue;
    out.add(m.from);
  }
  return [...out];
}

/**
 * UI V3 (U1): "Call it" is a tap on a claimant's speech bubble on the stage (then "Call it for 10?").
 * This registers the move screen's call with the stage and shows one line saying how, or who you call.
 */
export function CallChips({ v, claimants, value, onPick }: { v: ViewState; claimants: string[]; value: string | null; onPick: (x: string | null) => void }) {
  useCallRegistration({ claimants, value, onPick });
  // UI V4 (V1): the first time, the line under the bubbles is the coach hint for calling.
  const first = useFirstTime('call', claimants.length > 0);
  if (!claimants.length) return null;
  return (
    <p className={`mt-1 text-small ${value ? 'font-bold text-stamp' : first ? 'font-semibold text-spot' : 'text-soft'}`} data-call data-coach={first && !value ? 'call' : undefined} aria-live="polite">
      {value ? t('play.cast.callingLine', { name: shortName(v, value), n: PLAY.CALL_STAKE }) : first ? t('play.coach.call', { win: PLAY.CALL_PAYOUT, n: PLAY.CALL_STAKE }) : t('play.cast.callHint', { n: PLAY.CALL_STAKE })}
    </p>
  );
}

/** One call as a line: "Ugo called Chet. Chet was lying. +20." */
export function callLine(v: ViewState, c: CallRecord): string {
  const you = c.caller === v.viewer;
  return t(c.lie ? (you ? 'play.call.caughtYou' : 'play.call.caught') : you ? 'play.call.wrongYou' : 'play.call.wrong', {
    caller: shortName(v, c.caller),
    target: shortName(v, c.target),
    n: c.lie ? PLAY.CALL_PAYOUT : PLAY.CALL_STAKE,
  });
}

/** This round's call results with CAUGHT / CALLED WRONG stamps and one line from Dash. */
export function CallResults({ v }: { v: ViewState }) {
  const calls = (v.play?.calls ?? []).filter((c) => c.level === v.levelIndex && c.round === v.round);
  // UI V3 (U1): CAUGHT lands on the liar, CALLED WRONG on the caller.
  const cue: CastCue = { stamps: {}, expr: {} };
  for (const c of calls) {
    if (c.lie) {
      cue.stamps![c.target] = { text: t('play.call.stampCaught'), tone: 'stamp' };
      cue.expr![c.target] = 'caught';
      cue.expr![c.caller] = 'smug';
    } else {
      cue.stamps![c.caller] = { text: t('play.call.stampWrong'), tone: 'ink' };
      cue.expr![c.caller] = 'sad';
      cue.expr![c.target] = 'pleased';
    }
  }
  useStageCue('calls', calls.length ? cue : null);
  if (!calls.length) return null;
  const anyLie = calls.some((c) => c.lie);
  return (
    <div className="mt-2" data-calls>
      {calls.map((c, k) => (
        <p key={k} className="text-small">
          {callLine(v, c)}
        </p>
      ))}
      <div className="mt-1">
        <Bubble who="Dash" host text={hostLine(anyLie ? 'caught' : 'calledWrong', pick(v, `call-${anyLie}`, 6))} />
      </div>
    </div>
  );
}
