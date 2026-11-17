// UI V3 (U1, U2): the stage. Every contestant stands at a podium with their name and bank; claims are
// speech bubbles above them; stamps land on them; their faces react to what just happened. Presentation
// only: everything shown comes from the view the engine gives this player.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Message, ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { t } from '../i18n';
import { coins } from '../labels';
import { shortName } from '../game';
import { useMotionOff } from '../components/common';
import { myAvatar, ShapePerson, type CastKind, type Expr } from './Characters';
import { DURATION } from './tokens';
import { buzz, sfx } from './sound';

export type StampTone = 'stamp' | 'good' | 'ink';
export type CastStamp = { text: string; tone?: StampTone };
/** What a screen asks the stage to show. Anything left out is worked out from the view. */
export type CastCue = {
  bubbles?: Record<string, string>;
  expr?: Record<string, Expr>;
  stamps?: Record<string, CastStamp>;
  /** One contestant in the spotlight (a staged reveal); the others dim. */
  focus?: string | null;
  /** A flash on one contestant: a gain glows yellow, a hit flashes pink. */
  flash?: Record<string, 'gain' | 'hit'>;
  /** Hide the bank on the podiums (a reveal that counts its own money). */
  noBanks?: boolean;
  /** A small badge on a character (a vote mark). */
  marks?: Record<string, string>;
  /** Characters to dim (barred, out). */
  dim?: string[];
  /** Banks to show instead of the current ones (before a reveal lands, so they can count to the new ones). */
  banks?: Record<string, number>;
};

export type CallReg = { claimants: string[]; value: string | null; onPick: (x: string | null) => void };
export const CallContext = createContext<((r: CallReg | null) => void) | null>(null);
/** Lets a part of a screen (the call results, a ballot) put stamps and faces on the stage. */
export const CueContext = createContext<((key: string, c: CastCue | null) => void) | null>(null);

/** Merge cues: later ones win per contestant. */
export function mergeCues(...cs: Array<CastCue | undefined | null>): CastCue {
  const out: CastCue = {};
  for (const c of cs) {
    if (!c) continue;
    if (c.bubbles) out.bubbles = { ...(out.bubbles ?? {}), ...c.bubbles };
    if (c.expr) out.expr = { ...(out.expr ?? {}), ...c.expr };
    if (c.stamps) out.stamps = { ...(out.stamps ?? {}), ...c.stamps };
    if (c.flash) out.flash = { ...(out.flash ?? {}), ...c.flash };
    if (c.focus !== undefined) out.focus = c.focus;
    if (c.noBanks) out.noBanks = true;
    if (c.banks) out.banks = c.banks;
    if (c.marks) out.marks = { ...(out.marks ?? {}), ...c.marks };
    if (c.dim) out.dim = [...(out.dim ?? []), ...c.dim];
  }
  return out;
}

/** Put a cue on the enclosing stage while this component is shown. */
export function useStageCue(key: string, cue: CastCue | null) {
  const set = useContext(CueContext);
  const json = JSON.stringify(cue);
  useEffect(() => {
    if (!set) return;
    set(key, cue);
    return () => set(key, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, key, json]);
}

/** The kind of character a seat shows: a bot's motif, or the human's chosen shape. */
export function castKind(p: ViewState['players'][number]): CastKind {
  if (p.botKey) return p.botKey;
  if (p.isHuman) return myAvatar();
  return 'hex';
}

/** The words of a claim, as the speaker says them. */
export function claimWords(v: ViewState, value: string): string {
  if (v.levelIndex === 1) return t('play.cast.claim.vote', { rule: t(`play.l1.rule.${value}.name`) });
  if (v.levelIndex === 2) return t('play.cast.claim.effort', { b: t(`play.l2.band.${value}`).toLowerCase() });
  if (v.levelIndex === 4) return t('play.cast.claim.trained');
  if (v.levelIndex === 5) return t(`play.cast.claim.l5.${value.includes(':') ? value.split(':')[1] : value}`);
  return t(`play.claims.RISK.${value}`);
}

/** This round's public claims, as bubble text (silence shows no bubble). */
export function claimBubbles(v: ViewState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of v.messages as Message[]) {
    if (m.level !== v.levelIndex || m.round !== v.round || m.msg.type !== 'CLAIM') continue;
    const value = (m.msg as { value: string }).value;
    // Episode 5 claims are per amendment; its vote screen passes its own bubbles.
    if (value === 'SILENT' || v.levelIndex === 5) continue;
    out[m.from] = claimWords(v, value);
  }
  return out;
}

// Reactions: each face compares its bank with the bank on the previous engine screen.
let moodKey = '';
let moodBase: Record<string, number> = {};
let moodNow: Record<string, number> = {};
function bankDeltas(v: ViewState): Record<string, number> {
  const key = `${v.levelIndex}-${v.phaseIdx}`;
  const banks = v.play?.banks ?? {};
  if (key !== moodKey) {
    moodBase = Object.keys(moodNow).length ? moodNow : { ...banks };
    moodNow = { ...banks };
    moodKey = key;
  }
  const out: Record<string, number> = {};
  for (const id of Object.keys(banks)) out[id] = (banks[id] ?? 0) - (moodBase[id] ?? banks[id] ?? 0);
  return out;
}

const flashed = new Set<string>();
/** A whole-stage flash for your own big win or loss, once per engine screen (U2: a hit and a gain look different). */
export function screenFlash(v: ViewState): 'hit' | 'gain' | null {
  const key = `${v.levelIndex}-${v.phaseIdx}`;
  const d = bankDeltas(v)[v.viewer] ?? 0;
  if (flashed.has(key) || Math.abs(d) < 20) return null;
  flashed.add(key);
  return d < 0 ? 'hit' : 'gain';
}

/** The face a contestant shows now, unless the screen says otherwise. */
export function autoExpr(bank: number, delta: number): Expr {
  if (delta <= -20) return 'shocked';
  if (delta >= 5) return 'pleased';
  if (bank < 0) return 'sad';
  if (delta < 0) return 'sad';
  return 'neutral';
}

/** A bank that counts to its new value: yellow while it rises, pink while it falls (U2). Yours also sounds. */
function Bank({ value, mine }: { value: number; mine: boolean }) {
  const off = useMotionOff();
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (off || Math.round(start) === Math.round(value)) {
      setShown(value);
      from.current = value;
      return;
    }
    const d = value > start ? 1 : -1;
    setDir(d);
    // UI V4 (V4): the money sound comes once per round result ("What your choices did"), sized by the change.
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION.count);
      setShown(start + (value - start) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        from.current = value;
        setTimeout(() => setDir(0), 500);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, off, mine]);
  return <span className={dir > 0 ? 'text-spot' : dir < 0 ? 'text-stamp' : undefined}>{coins(shown)}</span>;
}

/** A number that rolls from one value to another (prices, U2). Whole numbers; static under reduced motion. */
export function RollNumber({ from, to, ms = 900 }: { from: number; to: number; ms?: number }) {
  const off = useMotionOff();
  const [x, setX] = useState(off ? to : from);
  useEffect(() => {
    if (off) return setX(to);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setX(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, off, ms]);
  return <span className="tabular-nums">{Math.round(x)}</span>;
}

/** Coins fly between your podium and your bank in the top bar when your bank changes (U2). */
function CoinFly({ viewer, delta }: { viewer: string; delta: number }) {
  const [path, setPath] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  useLayoutEffect(() => {
    const pod = document.querySelector(`[data-podium="${viewer}"]`)?.getBoundingClientRect();
    const top = document.querySelector('[data-bank-top]')?.getBoundingClientRect();
    if (!pod) return;
    const a = { x: pod.left + pod.width / 2, y: pod.top + pod.height / 2 };
    const b = top ? { x: top.left + top.width / 2, y: top.top + top.height / 2 } : { x: a.x, y: Math.max(0, a.y - 90) };
    setPath(delta > 0 ? { x0: b.x, y0: b.y, x1: a.x, y1: a.y } : { x0: a.x, y0: a.y, x1: b.x, y1: b.y });
  }, [viewer, delta]);
  if (!path) return null;
  const n = Math.min(6, Math.max(2, Math.round(Math.abs(delta) / 15)));
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40" data-coins={delta > 0 ? 'in' : 'out'}>
      {Array.from({ length: n }, (_, i) => (
        <motion.span
          key={i}
          className={`absolute h-4 w-4 rounded-full border-2 border-onspot ${delta > 0 ? 'bg-spot' : 'bg-stamp'}`}
          style={{ left: -8, top: -8 }}
          initial={{ x: path.x0, y: path.y0, opacity: 0, scale: 0.6 }}
          animate={{ x: [path.x0, (path.x0 + path.x1) / 2 + (i - n / 2) * 10, path.x1], y: [path.y0, Math.min(path.y0, path.y1) - 40, path.y1], opacity: [0, 1, 1, 0], scale: [0.6, 1, 0.8] }}
          transition={{ duration: DURATION.coinFly / 1000, delay: i * 0.07, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/** A rubber stamp that lands on a character with a thump. It never gets wider than its podium (it shrinks). */
function CastStampMark({ s, delay }: { s: CastStamp; delay: number }) {
  const off = useMotionOff();
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.closest('[data-podium]') as HTMLElement | null;
    if (!el || !box) return;
    // The stamp is turned 8 degrees, so its width on screen includes a little of its height.
    const w = el.offsetWidth * Math.cos(0.14) + el.offsetHeight * Math.sin(0.14);
    const room = box.clientWidth - 2;
    setFit(w > room ? room / w : 1);
  }, [s.text]);
  useEffect(() => {
    const id = setTimeout(() => {
      sfx('stamp');
      if (!off) buzz(30);
    }, off ? 0 : delay * 1000 + 120);
    return () => clearTimeout(id);
  }, [s.text, off, delay]);
  // V5 N2 (D-211): studio stamps are cream cards with a red, green or ink rim and matching text.
  const color = s.tone === 'good' ? 'border-[#13675a] text-[#13675a]' : s.tone === 'ink' ? 'border-[#10242a] text-[#10242a]' : 'border-[#c2341f] text-[#c2341f]';
  return (
    <motion.span
      className="pointer-events-none absolute left-1/2 top-[48%] z-10"
      initial={off ? { x: '-50%', y: '-50%', rotate: -8 } : { x: '-50%', y: '-50%', scale: 2.4, opacity: 0, rotate: -16 }}
      animate={{ x: '-50%', y: '-50%', scale: 1, opacity: 1, rotate: -8 }}
      transition={off ? { duration: 0 } : { type: 'spring', stiffness: 560, damping: 20, delay }}
    >
      <span
        ref={ref}
        className={`h-show block whitespace-nowrap rounded-lg border-[3px] bg-[#fff4e0] px-1 py-0.5 text-[14px] uppercase leading-none shadow-stamp ${color}`}
        style={fit < 1 ? { transform: `scale(${fit})` } : undefined}
        data-cast-stamp={s.text}
      >
        {s.text}
      </span>
    </motion.span>
  );
}

const sizes = [72, 58, 46, 36];

/** The podium row. `fit` shrinks the characters when a screen is full (0 = 72 px, 1 = 58, 2 = 46, 3 = 36 and one-line podiums). */
export function CastStage({ v, cue = {}, fit = 0, call }: { v: ViewState; cue?: CastCue; fit?: number; call?: CallReg | null }) {
  const off = useMotionOff();
  const pl = v.play!;
  const deltas = bankDeltas(v);
  const [confirm, setConfirm] = useState<string | null>(null);
  const myBank = Math.round(cue.banks?.[v.viewer] ?? pl.banks[v.viewer] ?? 0);
  const lastMine = useRef(myBank);
  const [fly, setFly] = useState<{ k: number; d: number } | null>(null);
  useEffect(() => {
    const d = myBank - lastMine.current;
    lastMine.current = myBank;
    if (!d || off || cue.noBanks) return;
    setFly((f) => ({ k: (f?.k ?? 0) + 1, d }));
    const id = setTimeout(() => setFly(null), DURATION.coinFly + 600);
    return () => clearTimeout(id);
  }, [myBank, off]);
  const isDecide = v.phase.kind === 'DECIDE' || v.phase.kind === 'TALK';
  const bubbles = cue.bubbles ?? (isDecide && v.phase.step !== 'CLAIM' ? claimBubbles(v) : {});
  const ids = Object.keys(bubbles);
  const size = sizes[Math.min(fit, sizes.length - 1)];
  const order = v.players.map((p) => p.id);
  const bubbleIdx = (id: string) => ids.indexOf(id);
  useEffect(() => {
    if (!ids.length || off) return;
    const timers = ids.map((_, i) => setTimeout(() => sfx('pop'), i * DURATION.bubbleGap));
    return () => timers.forEach(clearTimeout);
    // A new set of bubbles pops once per screen.
  }, [ids.join(','), off]);
  return (
    <section className="relative mt-1" aria-label={t('play.cast.stage')} data-cast-stage>
      {ids.length > 0 && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(0, 1fr))` }}>
          {order.map((id) => {
            const text = bubbles[id];
            if (!text) return <span key={id} />;
            const callable = !!call && call.claimants.includes(id);
            const on = call?.value === id;
            const inner = (
              <>
                <span className="block text-small font-semibold leading-tight">{text}</span>
                {callable && <span className={`mt-0.5 inline-block rounded-full px-1.5 text-small font-bold leading-snug text-white ${on ? 'bg-[#b0124f]' : 'bg-onspot'}`}>{on ? t('play.cast.calling') : t('play.cast.tapToCall')}</span>}
              </>
            );
            return (
              <motion.div
                key={id}
                initial={off ? false : { opacity: 0, y: 8, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={off ? { duration: 0 } : { delay: (bubbleIdx(id) * DURATION.bubbleGap) / 1000, type: 'spring', stiffness: 420, damping: 24 }}
                className="relative flex"
              >
                {callable && confirm === id ? (
                  // UI V4 (V1): the call is confirmed inside the bubble itself, never in a pop-up.
                  <div className="w-full rounded-2xl border-2 border-stamp bg-white px-1 py-1 text-center text-onspot" onClick={(e) => e.stopPropagation()} data-bubble={id} data-call-confirm>
                    <span className="sr-only">{t('play.cast.confirm', { name: shortName(v, id), n: PLAY.CALL_STAKE })}</span>
                    <button
                      type="button"
                      className="min-h-[44px] w-full rounded-xl bg-action px-1 text-small font-bold leading-tight text-onaction"
                      onClick={() => {
                        sfx('lock');
                        call!.onPick(id);
                        setConfirm(null);
                      }}
                      data-call-yes
                    >
                      {t('play.cast.callItN', { n: PLAY.CALL_STAKE })}
                    </button>
                    <button type="button" className="mt-1 min-h-[44px] w-full rounded-xl bg-[#e9e6f2] px-1 text-small font-bold leading-tight text-onspot" onClick={() => setConfirm(null)} data-call-cancel>
                      {t('play.cast.cancel')}
                    </button>
                  </div>
                ) : callable ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (on) call!.onPick(null);
                      else setConfirm(id);
                    }}
                    aria-label={t(on ? 'play.cast.uncallA11y' : 'play.cast.callA11y', { name: shortName(v, id), claim: text, n: PLAY.CALL_STAKE })}
                    aria-pressed={on}
                    className={`min-h-[44px] w-full rounded-2xl border-2 bg-white px-1.5 py-1 text-center text-onspot ${on ? 'border-stamp' : 'border-white'}`}
                    data-bubble={id}
                    data-call-bubble={id}
                  >
                    {inner}
                  </button>
                ) : (
                  <p className="w-full rounded-2xl bg-white px-1.5 py-1 text-center text-onspot" data-bubble={id}>
                    <span className="sr-only">{shortName(v, id)}: </span>
                    {inner}
                  </p>
                )}
                <span aria-hidden className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
              </motion.div>
            );
          })}
        </div>
      )}
      <ul className="mt-2 grid items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(0, 1fr))` }} aria-label={t('play.bar.ranking')}>
        {v.players.map((p) => {
          const bank = cue.banks?.[p.id] ?? pl.banks[p.id] ?? 0;
          const debt = bank < 0;
          const me = p.id === v.viewer;
          const expr = cue.expr?.[p.id] ?? autoExpr(bank, deltas[p.id] ?? 0);
          const stamp = cue.stamps?.[p.id];
          const dim = (cue.focus && cue.focus !== p.id) || cue.dim?.includes(p.id);
          const mark = cue.marks?.[p.id];
          const flash = cue.flash?.[p.id];
          return (
            <li
              key={p.id}
              className="relative flex flex-col items-center"
              aria-label={t(debt ? 'play.cast.podiumDebtA11y' : 'play.cast.podiumA11y', { name: shortName(v, p.id), bank: coins(bank) })}
              data-podium={p.id}
              data-expr={expr}
            >
              <motion.span
                aria-hidden
                className={`relative block transition-opacity ${dim ? 'opacity-40' : ''}`}
                style={flash ? { filter: `drop-shadow(0 0 8px ${flash === 'hit' ? 'rgb(255 62 127 / 0.9)' : 'rgb(255 210 63 / 0.9)'})` } : undefined}
                animate={off || !flash ? {} : flash === 'hit' ? { x: [0, -6, 6, -4, 4, 0] } : { y: [0, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <ShapePerson kind={castKind(p)} expr={expr} size={size} />
                {/* Fix 2: the stamp sits on the character's body, above the podium, never over the name. */}
                <AnimatePresence>{stamp && <CastStampMark key={stamp.text} s={stamp} delay={0} />}</AnimatePresence>
              </motion.span>
              {mark && (
                <span className="absolute right-0 top-0 z-10 rounded-full border-2 border-onspot bg-spot px-1.5 text-small font-bold leading-snug text-onspot" data-mark={p.id}>
                  {mark}
                </span>
              )}
              <div
                aria-hidden
                className={`relative -mt-1 w-full overflow-hidden rounded-xl border-2 px-1 py-0.5 text-center shadow-podium ${me ? 'border-spot' : 'border-line'} ${debt ? 'bg-paper' : 'bg-card'}`}
                data-me={me ? '' : undefined}
              >
                {debt && (
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 80 40" preserveAspectRatio="none" aria-hidden>
                    <path d="M6 0 L11 12 L5 22 L12 40" fill="none" stroke="rgb(255 62 127 / 0.7)" strokeWidth="1.5" />
                  </svg>
                )}
                <span data-podium-name className={`relative ${fit >= 3 ? 'inline' : 'block'} truncate text-small font-bold leading-tight`}>{shortName(v, p.id)}</span>
                {!cue.noBanks && (
                  <span className={`h-show relative ${fit >= 3 ? 'ms-1 inline text-small' : 'block text-body'} leading-tight ${debt ? 'text-stamp' : ''}`} data-bank={p.id}>
                    <Bank value={bank} mine={me} />
                  </span>
                )}
                {debt && !cue.noBanks && fit < 3 && <span className="relative block text-small font-bold leading-tight text-stamp">{t('play.cast.inDebt')}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {fly && <CoinFly key={fly.k} viewer={v.viewer} delta={fly.d} />}
    </section>
  );
}

/** The call control on a move screen: registers with the stage, so a tap on a bubble calls it. */
export function useCallRegistration(reg: CallReg) {
  const set = useContext(CallContext);
  const pick = useRef(reg.onPick);
  pick.current = reg.onPick;
  const key = `${reg.claimants.join(',')}|${reg.value}`;
  useEffect(() => {
    if (!set) return;
    set(reg.claimants.length ? { claimants: reg.claimants, value: reg.value, onPick: (x) => pick.current(x) } : null);
    return () => set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, set]);
}

export function CastNote({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-small text-soft">{children}</p>;
}
