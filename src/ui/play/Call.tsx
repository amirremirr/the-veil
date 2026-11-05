// H4 (D-194): "Call it", on the move screen of every episode, and the round's call results with stamps.
import type { CallRecord } from '../../engine/play/types';
import type { Message, ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { t } from '../i18n';
import { shortName } from '../game';
import { hostLine, pick } from './logic';
import { Bubble } from './OnAir';

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

/** The call chips: "Call it (10): No one, Ana, Chet". Compact, so the move screen stays within its words. */
export function CallChips({ v, claimants, value, onPick }: { v: ViewState; claimants: string[]; value: string | null; onPick: (x: string | null) => void }) {
  if (!claimants.length) return null;
  const opts: Array<string | null> = [null, ...claimants];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t('play.call.label', { n: PLAY.CALL_STAKE })} data-call>
      <span className="text-sm font-bold">{t('play.call.label', { n: PLAY.CALL_STAKE })}</span>
      {opts.map((o) => (
        <button key={o ?? 'none'} type="button" aria-pressed={value === o} onClick={() => onPick(o)} className={`min-h-[44px] min-w-[44px] rounded-xl px-2 text-sm font-bold ${value === o ? 'bg-stamp text-onspot' : 'bg-card'}`}>
          {o ? shortName(v, o) : t('play.call.none')}
        </button>
      ))}
    </div>
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
  if (!calls.length) return null;
  const anyLie = calls.some((c) => c.lie);
  return (
    <div className="mt-2" data-calls>
      {calls.map((c, k) => (
        <p key={k} className="text-sm">
          <span className={`mr-1 rounded px-1 text-xs font-bold ${c.lie ? 'bg-stamp text-onspot' : 'bg-card'}`}>{t(c.lie ? 'play.call.stampCaught' : 'play.call.stampWrong')}</span>
          {callLine(v, c)}
        </p>
      ))}
      <div className="mt-1">
        <Bubble who="Dash" host text={hostLine(anyLie ? 'caught' : 'calledWrong', pick(v, `call-${anyLie}`, 6))} />
      </div>
    </div>
  );
}
