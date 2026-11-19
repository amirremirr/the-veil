// The end of a life (v2 Sections 3.4 and 7, D-155): the Receipts reel, then the result card v2.
// Only public facts at this point (every card and claim is revealed); the card shows the viewer's own data only.
import { challengeLine } from './Challenge';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LevelId, Message, ValuesCard, ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { shortName } from '../game';
import { useMotionOff } from '../components/common';
import { BigButton, Stage } from './OnAir';
import type { CastCue, CastStamp } from './Cast';
import { ShapePerson, type Expr } from './Characters';
import { castKind } from './Cast';
import { sfx } from './sound';
import { DURATION, revealPick } from './tokens';
import { callLine } from './Call';
import { PlaytestPanel } from './Playtest';
import { onTap, playtestOn } from '../playtest';
import { earned, isDaily, rivalLine, saveAchievements, shareText, type Achievement } from './retention';

export interface Receipt {
  kind: 'worked' | 'caught' | 'betrayal' | 'call';
  level: LevelId;
  pid: string;
  text: string;
}

/** Each contestant's bank change per episode, from the public bank history. */
export function episodeChanges(v: ViewState): Record<string, Record<number, number>> {
  const out: Record<string, Record<number, number>> = {};
  const hist = v.play!.bankHistory;
  for (const p of v.players) {
    out[p.id] = {};
    let prev = PLAY.LIFE_STARTING_BANK;
    for (const l of [1, 2, 3, 4, 5]) {
      const last = hist.filter((h) => h.level === l).slice(-1)[0];
      if (!last) continue;
      // Loop cycle 14: from rounded banks, so "bank -72" matches the banks shown (387 to 315).
      out[p.id][l] = Math.round(last.banks[p.id]) - Math.round(prev);
      prev = last.banks[p.id];
    }
  }
  return out;
}

function claimText(m: Message): string {
  if (m.msg.type !== 'CLAIM') return '';
  const raw = m.msg.value.includes(':') ? m.msg.value.split(':')[1] : m.msg.value;
  return t(`play.receipts.said.${m.msg.topic}.${raw}`);
}

/**
 * D-155: a lie "worked" when the liar's bank grew more that episode than the table's median change (the lie
 * was not punished where it counts); otherwise it was caught. Betrayals: Episode 5 donations voted against.
 */
export function receipts(v: ViewState): Receipt[] {
  const ch = episodeChanges(v);
  const out: Receipt[] = [];
  for (const m of v.messages as Message[]) {
    if (m.msg.type !== 'CLAIM' || m.kept !== false) continue;
    const xs = v.players.map((p) => ch[p.id][m.level] ?? 0).sort((a, b) => a - b);
    const med = (xs[Math.floor((xs.length - 1) / 2)] + xs[Math.ceil((xs.length - 1) / 2)]) / 2;
    const worked = (ch[m.from][m.level] ?? 0) > med;
    out.push({ kind: worked ? 'worked' : 'caught', level: m.level as LevelId, pid: m.from, text: t(`play.receipts.${worked ? 'worked' : 'caught'}`, { name: shortName(v, m.from), said: claimText(m), ep: `${m.level} R${m.round}` }) });
  }
  const lv5 = v.levelIndex === 5 ? (v.levelView as { lobby?: Record<string, { donateTo: string | null; amount: number }>; amendments?: Array<{ proposer: string; votes: Record<string, boolean>; withdrawn?: boolean }> }) : null;
  for (const [from, lb] of Object.entries(lv5?.lobby ?? {})) {
    if (!lb.donateTo || lb.amount <= 0) continue;
    const a = lv5?.amendments?.find((x) => x.proposer === from && !x.withdrawn);
    if (a && !a.votes[lb.donateTo]) out.push({ kind: 'betrayal', level: 5, pid: lb.donateTo, text: t('play.receipts.betrayal', { name: shortName(v, lb.donateTo), donor: shortName(v, from), n: lb.amount }) });
  }
  // H4 (D-194): every call, in the order it happened ("Ugo called Chet. Chet was lying. +20.").
  for (const c of v.play?.calls ?? []) out.push({ kind: 'call', level: c.level as LevelId, pid: c.caller, text: `Ep${c.level}: ${callLine(v, c)}` });
  const order = { worked: 0, caught: 1, call: 2, betrayal: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.level - b.level);
}

/** The viewer's honesty record over the life: claims made, lies told, lies caught. */
export function honesty(v: ViewState, id = v.viewer): { made: number; lies: number; caught: number } {
  const mine = (v.messages as Message[]).filter((m) => m.from === id && m.msg.type === 'CLAIM' && m.resolved);
  const rs = receipts(v);
  const lies = mine.filter((m) => m.kept === false).length;
  const caught = rs.filter((r) => r.kind === 'caught' && r.pid === id).length;
  return { made: mine.length, lies, caught };
}

/** v2 Section 7: a title from honesty x the fair-answer shift x the final rank (at least 20 titles). */
export function lifeTitle(v: ViewState): string {
  const h = honesty(v);
  const hk = h.made === 0 ? 'quiet' : h.lies / h.made <= 0.1 ? 'honest' : h.lies / h.made <= 0.4 ? 'some' : 'liar';
  const lv = v.levelView as { fair1?: Record<string, number>; fair2?: Record<string, number>; incomes?: Record<string, number> };
  const d = (lv.fair2?.[v.viewer] ?? 0) - (lv.fair1?.[v.viewer] ?? 0);
  const inc = lv.incomes ?? {};
  const sorted = Object.keys(inc).sort((a, b) => inc[a] - inc[b]);
  const rich = sorted.indexOf(v.viewer) >= sorted.length / 2;
  const sk = Math.abs(d) < 1e-9 ? 'steady' : (rich && d < 0) || (!rich && d > 0) ? 'payday' : 'principled';
  const sc = v.play!.finalScores ?? {};
  const rank = 1 + v.players.filter((p) => (sc[p.id] ?? 0) > (sc[v.viewer] ?? 0) + 1e-9).length;
  const rk = rank === 1 ? 'won' : rank === v.players.length ? 'last' : 'mid';
  if (hk === 'quiet') return t(`play.titles.quiet.${rk}`);
  return t(`play.titles.${hk}.${sk === 'steady' ? 'principled' : sk}.${rk}`);
}

/** How a receipt lands on its contestant: a stamp and a face (UI V3 U2). */
function receiptMark(r: Receipt): { stamp: CastStamp; expr: Expr } {
  if (r.kind === 'worked') return { stamp: { text: t('play.cast.r.worked'), tone: 'good' }, expr: 'smug' };
  if (r.kind === 'caught') return { stamp: { text: t('play.call.stampCaught'), tone: 'stamp' }, expr: 'caught' };
  if (r.kind === 'betrayal') return { stamp: { text: t('play.cast.r.betrayal'), tone: 'stamp' }, expr: 'smug' };
  const right = /\+\d/.test(r.text);
  return { stamp: { text: t('play.cast.r.call'), tone: right ? 'good' : 'ink' }, expr: right ? 'pleased' : 'sad' };
}

/**
 * The Receipts (v2 3.4), staged (UI V3 U2): one moment at a time, the spotlight on the contestant, a stamp
 * on them, the line in a card. At most 20 seconds, skippable; the end (shown at once under reduced motion)
 * keeps each contestant's tally on their podium and the latest lines.
 */
export function ReceiptsReel({ v, next }: { v: ViewState; next: () => void }) {
  const off = useMotionOff();
  const all = useMemo(() => receipts(v), [v]);
  // UI V4 (V4): each staged moment at least 1.5 s, at most 6 s in all; the end lists the latest of them all.
  const items = useMemo(() => revealPick(all.length).map((i) => all[i]), [all]);
  const [k, setK] = useState(off ? items.length : 0);
  const step = DURATION.revealStep;
  useEffect(() => {
    if (off || k >= items.length) return;
    const id = setTimeout(() => setK((x) => x + 1), step);
    return () => clearTimeout(id);
  }, [k, off, items.length, step]);
  const done = k >= items.length;
  const cur = done ? null : items[k];
  const tally = (id: string) => all.filter((r) => r.pid === id && (r.kind === 'worked' || r.kind === 'caught' || r.kind === 'betrayal')).length;
  const cue: CastCue = cur
    ? { focus: cur.pid, stamps: { [cur.pid]: receiptMark(cur).stamp }, expr: { [cur.pid]: receiptMark(cur).expr } }
    : {
        stamps: Object.fromEntries(v.players.filter((p) => tally(p.id)).map((p) => [p.id, { text: t(tally(p.id) === 1 ? 'play.cast.r.tallyOne' : 'play.cast.r.tally', { n: tally(p.id) }), tone: 'stamp' as const }])),
        expr: Object.fromEntries(v.players.map((p) => [p.id, tally(p.id) ? 'smug' : 'pleased'])),
      };
  const recent = all.slice(-5);
  return (
    <Stage v={v} cast={cue} onTap={done ? undefined : () => setK(items.length)} footer={<BigButton beatNext={done} onClick={done ? next : () => setK(items.length)}>{done ? t('play.receipts.next') : t('play.receipts.skip')}</BigButton>}>
      <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.receipts.label')}</p>
      <h1 className="h-show text-title leading-tight text-spot">{t('play.receipts.title')}</h1>
      {cur ? (
        <p key={k} className={`mt-3 rounded-2xl p-3 text-lead font-bold leading-snug ${cur.kind === 'worked' ? 'bg-good text-onspot' : cur.kind === 'caught' ? 'bg-card' : 'bg-stamp text-onspot'}`} data-receipt={cur.kind} aria-live="polite">
          {cur.text}
        </p>
      ) : (
        <ul className="mt-2 space-y-1" data-receipts>
          {recent.map((r, i) => (
            <li key={`${r.level}-${i}-${r.text}`} className={`rounded-xl px-2 py-1 text-small ${r.kind === 'worked' ? 'bg-good text-onspot' : r.kind === 'caught' ? 'bg-card' : 'bg-stamp text-onspot'}`}>
              {r.text}
            </li>
          ))}
          {all.length > recent.length && <li className="text-small text-soft">{t('play.cast.r.more', { n: all.length - recent.length })}</li>}
          {!all.length && <li className="text-body">{t('play.receipts.none')}</li>}
        </ul>
      )}
    </Stage>
  );
}

/** The result card v2 as a PNG: canvas, then Web Share with a file on phones, else a download. */
function drawCard(title: string, lines: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b1030';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#ffd23f';
  g.font = 'bold 56px sans-serif';
  g.fillText(t('play.show'), 80, 140);
  g.font = 'bold 84px sans-serif';
  const words = title.split(' ');
  let y = 300;
  let line = '';
  for (const w of words) {
    if (g.measureText(`${line} ${w}`).width > 920) {
      g.fillText(line.trim(), 80, y);
      y += 100;
      line = '';
    }
    line += ` ${w}`;
  }
  g.fillText(line.trim(), 80, y);
  g.fillStyle = '#ffffff';
  g.font = '44px sans-serif';
  y += 120;
  for (const l of lines) {
    g.fillText(l, 80, y);
    y += 70;
  }
  g.font = '32px sans-serif';
  g.fillStyle = '#bbbbbb';
  g.fillText(t('play.card.small'), 80, 1270);
  return c;
}

export function ResultCard({ v }: { v: ViewState }) {
  const { go, replay } = useStore();
  const me = v.players.find((p) => p.id === v.viewer)!;
  const sc = v.play!.finalScores ?? {};
  const rank = 1 + v.players.filter((p) => (sc[p.id] ?? 0) > (sc[v.viewer] ?? 0) + 1e-9).length;
  const h = honesty(v);
  const title = lifeTitle(v);
  const ch = episodeChanges(v)[v.viewer];
  const eps = Object.keys(ch).map(Number);
  const best = eps.reduce((a, b) => (ch[b] > ch[a] ? b : a), eps[0]);
  const worst = eps.reduce((a, b) => (ch[b] < ch[a] ? b : a), eps[0]);
  const challenge = challengeLine(v);
  const lines = [
    t('play.card.rank', { name: me.name || t('play.card.you'), r: rank, n: v.players.length }),
    t('play.card.best', { ep: best, name: t(`play.episodes.${best}.name`), n: `${(ch[best] ?? 0) >= 0 ? '+' : ''}${coins(ch[best] ?? 0)}` }),
    t('play.card.worst', { ep: worst, name: t(`play.episodes.${worst}.name`), n: `${(ch[worst] ?? 0) >= 0 ? '+' : ''}${coins(ch[worst] ?? 0)}` }),
    t('play.card.bank', { n: coins(v.play!.banks[v.viewer]) }),
    t('play.card.playedLike', { name: BOT_NAME[playedLike(v).top] }),
    !h.made ? t('play.card.noClaims') : h.lies ? t('play.card.honesty', { lies: h.lies, made: h.made, caught: h.caught }) : t('play.card.allTrue', { made: h.made }),
    // V6 (D-220): the challenge, done or not (it never changes the score).
    ...(challenge ? [challenge.text] : []),
  ];
  const ref = useRef<HTMLDivElement>(null);
  const mineNow = useMemo(() => earned(v), [v]);
  const [all, setAll] = useState<Achievement[]>([]);
  useEffect(() => setAll(saveAchievements(mineNow)), [mineNow]);
  const [copied, setCopied] = useState(false);
  const shareTextNow = async () => {
    const text = shareText(v);
    const nav = navigator as Navigator & { share?: (d: unknown) => Promise<void> };
    try {
      if (nav.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await nav.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const share = async () => {
    const canvas = drawCard(title, mineNow.length ? [...lines, mineNow.map((a) => t(`play.ach.${a}.name`)).join(', ')] : lines);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'the-veil-live.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    try {
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: t('play.show') });
        return;
      }
    } catch {
      /* fall through to the download */
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'the-veil-live.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <Stage
      v={v}
      bar={false}
      footer={
        <div className="flex gap-2">
          <button type="button" className="min-h-[52px] flex-1 rounded-full bg-card font-bold" onClick={() => { onTap('again'); replay(false); }}>
            {t('play.summary.again')}
          </button>
          <div className="flex-1">
            <BigButton onClick={() => go('title')}>{t('play.summary.menu')}</BigButton>
          </div>
        </div>
      }
    >
      {/* Review cycle 2: a win is a gold card with the winner's grin; a bottom-half finish is a dark card with a slump. */}
      <div className="-mt-2 mb-1 flex justify-center" aria-hidden>
        <ShapePerson kind={castKind(me)} expr={rank === 1 ? 'pleased' : rank > v.players.length / 2 ? 'sad' : 'smug'} size={44} />
      </div>
      <div ref={ref} className={`rounded-3xl p-5 ${rank === 1 ? 'bg-spot text-onspot' : rank > v.players.length / 2 ? 'border-2 border-stamp bg-card text-ink' : 'bg-card text-ink'}`} data-result-card data-rank={rank}>
        <p className="text-small font-bold uppercase tracking-wider">{t('play.show')}</p>
        <h1 className="h-show mt-1 text-hero leading-tight">{title}</h1>
        <ul className="mt-3 space-y-1 text-small">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-3 text-small">{t('play.card.small')}</p>
      </div>
      {mineNow.length > 0 && (
        <p className="mt-2 text-small font-semibold" data-achievements>
          {t('play.ach.label', { n: all.length, max: 12 })} {mineNow.map((a) => t(`play.ach.${a}.name`)).join(', ')}
        </p>
      )}
      {playtestOn() && <PlaytestPanel v={v} />}
      <p className="mt-2 text-small font-semibold" data-rival>
        {rivalLine(v)} {t('play.rival.ask')}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" className="min-h-[48px] rounded-full bg-card text-small font-bold" onClick={share} data-share>
          {t('play.card.share')}
        </button>
        <button type="button" className="min-h-[48px] rounded-full bg-card text-small font-bold" onClick={shareTextNow} data-share-text>
          {copied ? t('play.daily.copied') : t(isDaily(v) ? 'play.daily.shareDaily' : 'play.daily.shareText')}
        </button>
        <button type="button" className="min-h-[48px] rounded-full bg-card text-small font-bold" onClick={() => replay(true)} data-rematch>
          {t('play.rival.rematch')}
        </button>
      </div>
    </Stage>
  );
}

// V5 N1: "You played like...". No missions: the human's own choices over the life, mapped to the four
// principles the bots carry as traits (Chet looks after himself, Marigold protects the poorest, Ugo grows the
// total, Dot rewards effort), with one example, and their first fair-tax answer against how they voted.
const BOT_NAME: Record<ValuesCard, string> = { EGOIST: 'Chet', RAWLSIAN: 'Marigold', UTILITARIAN: 'Ugo', MERITOCRAT: 'Dot' };
type Lean = { card: ValuesCard; w: number; ex: string; vars?: Record<string, string | number> };

/** What each of the human's choices leans toward, in order (an example sentence for each). */
function leans(v: ViewState): Lean[] {
  const out: Lean[] = [];
  for (const it of v.play?.trail ?? []) {
    const d = it.d as Record<string, unknown> | number | string | boolean | null;
    const ep = it.level;
    const obj = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
    if (obj.gift) out.push({ card: 'RAWLSIAN', w: 1, ex: 'gift', vars: { ep } });
    if (ep === 1 && it.step === 'VOTE') {
      const r = obj.vote as string;
      out.push(r === 'P1' ? { card: 'UTILITARIAN', w: 1, ex: 'rule', vars: { ep, rule: t('play.l1.rule.P1.name') } } : { card: 'RAWLSIAN', w: r === 'P3' ? 0.5 : 1, ex: 'rule', vars: { ep, rule: t(`play.l1.rule.${r}.name`) } });
    }
    if (ep === 1 && it.step === 'PEEK' && d === true) out.push({ card: 'EGOIST', w: 1, ex: 'peek', vars: { ep } });
    if (ep === 2 && it.step === 'TAX' && typeof d === 'number') out.push(d === 0 ? { card: 'MERITOCRAT', w: 1, ex: 'tax', vars: { ep, t: pct(d) } } : d >= 0.6 ? { card: 'RAWLSIAN', w: 1, ex: 'tax', vars: { ep, t: pct(d) } } : { card: 'UTILITARIAN', w: 0.5, ex: 'tax', vars: { ep, t: pct(d) } });
    if (ep === 2 && it.step === 'EFFORT') {
      const e = Number(obj.effort ?? 0);
      if (e >= 7) out.push({ card: 'MERITOCRAT', w: 1, ex: 'hours', vars: { ep, e } });
      if (e <= 2) out.push({ card: 'EGOIST', w: 0.5, ex: 'hours', vars: { ep, e } });
      const c = obj.claim as string | undefined;
      if (c && c !== 'SILENT' && ['LITTLE', 'SOME', 'LOT'].indexOf(c) > (e <= 3 ? 0 : e <= 6 ? 1 : 2)) out.push({ card: 'EGOIST', w: 1, ex: 'overclaim', vars: { ep } });
    }
    if (ep === 2 && it.step === 'PRIZE') out.push({ card: 'MERITOCRAT', w: 0.5, ex: 'prize', vars: { ep } });
    if (ep === 3 && it.step === 'CHOICE') {
      if (obj.bar) out.push({ card: 'EGOIST', w: 1, ex: 'bar', vars: { ep } });
      if (obj.gym) out.push({ card: 'MERITOCRAT', w: 0.5, ex: 'gym', vars: { ep } });
    }
    if (ep === 3 && it.step === 'REGIME') out.push(d === 'VOL' ? { card: 'EGOIST', w: 0.5, ex: 'regime', vars: { ep, rule: t('play.l3.regimes.VOL.name') } } : { card: 'RAWLSIAN', w: 1, ex: 'regime', vars: { ep, rule: t(`play.l3.regimes.${d as string}.name`) } });
    if (ep === 4 && it.step === 'TRAIN' && obj.train) out.push({ card: 'MERITOCRAT', w: 1, ex: 'train', vars: { ep } });
    if (ep === 4 && it.step === 'POLICY') {
      const name = t(`levels.4.policies.${d as string}.name`);
      out.push(d === 'B' ? { card: 'MERITOCRAT', w: 1, ex: 'policy', vars: { ep, rule: name } } : d === 'A' ? { card: 'EGOIST', w: 0.5, ex: 'policy', vars: { ep, rule: name } } : { card: 'RAWLSIAN', w: 1, ex: 'policy', vars: { ep, rule: name } });
    }
    if (ep === 5 && it.step === 'VEIL') {
      const tx = Number(obj.t ?? 0);
      const F = Number(obj.F ?? 0);
      out.push(tx >= 0.5 || F >= 40 ? { card: 'RAWLSIAN', w: 1, ex: 'veil', vars: { ep, t: pct(tx), F } } : tx === 0 && F === 0 ? { card: 'MERITOCRAT', w: 1, ex: 'veil', vars: { ep, t: pct(tx), F } } : { card: 'UTILITARIAN', w: 1, ex: 'veil', vars: { ep, t: pct(tx), F } });
    }
    if (ep === 5 && it.step === 'LOBBY' && obj.donateTo) out.push({ card: 'EGOIST', w: 1, ex: 'lobby', vars: { ep } });
  }
  return out;
}

/** The principle the human's choices lean to most, its example, and the share of each principle. */
export function playedLike(v: ViewState): { top: ValuesCard; ex: string; shares: Record<ValuesCard, number> } {
  const ls = leans(v);
  const tot: Record<ValuesCard, number> = { EGOIST: 0, RAWLSIAN: 0, UTILITARIAN: 0, MERITOCRAT: 0 };
  for (const l of ls) tot[l.card] += l.w;
  const order: ValuesCard[] = ['EGOIST', 'RAWLSIAN', 'UTILITARIAN', 'MERITOCRAT'];
  const top = order.reduce((a, b) => (tot[b] > tot[a] ? b : a), 'EGOIST');
  const ex = ls.filter((l) => l.card === top).sort((a, b) => b.w - a.w)[0];
  const sum = Math.max(1e-9, order.reduce((a, c) => a + tot[c], 0));
  return {
    top,
    ex: ex ? t(`play.played.ex.${ex.ex}`, ex.vars as Record<string, string>) : t('play.played.none'),
    shares: Object.fromEntries(order.map((c) => [c, tot[c] / sum])) as Record<ValuesCard, number>,
  };
}

/** "You said X was fair. You voted for Y." The first fair-tax answer against the tax the human voted for. */
function fairLine(v: ViewState): string | null {
  const first = v.play?.fairFirst;
  if (first === null || first === undefined) return null;
  const trail = v.play?.trail ?? [];
  const veil = trail.find((x) => x.level === 5 && x.step === 'VEIL');
  const tax2 = trail.find((x) => x.level === 2 && x.step === 'TAX');
  const voted = veil ? Number((veil.d as { t?: number }).t ?? 0) : typeof tax2?.d === 'number' ? (tax2.d as number) : null;
  if (voted === null) return t('play.played.fairOnly', { x: pct(first) });
  return t(Math.abs(voted - first) < 0.051 ? 'play.played.fairSame' : 'play.played.fair', { x: pct(first), y: pct(voted) });
}

export function PlayedLike({ v, next }: { v: ViewState; next: () => void }) {
  const p = playedLike(v);
  const me = v.players.find((x) => x.id === v.viewer)!;
  const order: ValuesCard[] = ['RAWLSIAN', 'UTILITARIAN', 'MERITOCRAT', 'EGOIST'];
  const fair = fairLine(v);
  const challenge = challengeLine(v);
  return (
    <Stage v={v} bar={false} cast={false} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-played-like={p.top}>
        <div className="flex items-end justify-center gap-2" aria-hidden>
          <ShapePerson kind={castKind(me)} expr="pleased" size={64} />
          <ShapePerson kind={({ EGOIST: 'chet', RAWLSIAN: 'marigold', UTILITARIAN: 'ugo', MERITOCRAT: 'dot' } as const)[p.top]} expr="smug" size={64} />
        </div>
        <p className="mt-2 text-small font-bold uppercase tracking-wider text-soft">{t('play.played.label')}</p>
        <h1 className="h-show text-hero leading-tight text-spot">{t('play.played.title', { name: BOT_NAME[p.top] })}</h1>
        <p className="mt-1 text-body font-semibold">{t(`play.principles.${p.top}.line`)}</p>
        <p className="mt-2 text-body" data-played-example>{p.ex}</p>
        <ul className="mt-3 space-y-1" aria-label={t('play.played.label')}>
          {order.map((c) => (
            <li key={c} className="flex items-center gap-2 text-small">
              <span className="w-36 truncate font-semibold">{t(`play.principles.${c}.name`)}</span>
              <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-card">
                <span className={`absolute inset-y-0 left-0 rounded-full ${c === p.top ? 'bg-spot' : 'bg-soft'}`} style={{ width: `${Math.round(p.shares[c] * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
        {fair && (
          <p className="mt-3 text-body font-semibold" data-fair-line>
            {fair}
          </p>
        )}
        {challenge && (
          <p className={`mt-2 text-body font-bold ${challenge.done ? 'text-good' : 'text-stamp'}`} data-challenge-end={challenge.done ? 'done' : 'not'}>
            {challenge.text}
          </p>
        )}
      </div>
    </Stage>
  );
}

export function LifeEnd({ v }: { v: ViewState }) {
  const [k, setK] = useState(0);
  // UI V3 (U2): the life-end fanfare plays as the result card comes up.
  useEffect(() => {
    if (k === 2) sfx('finale');
  }, [k]);
  if (k === 0) return <ReceiptsReel v={v} next={() => setK(1)} />;
  if (k === 1) return <PlayedLike v={v} next={() => setK(2)} />;
  return <ResultCard v={v} />;
}
