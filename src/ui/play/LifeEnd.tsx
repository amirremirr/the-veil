// The end of a life (v2 Sections 3.4 and 7, D-155): the Receipts reel, then the result card v2.
// Only public facts at this point (every card and claim is revealed); the card shows the viewer's own data only.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LevelId, Message, ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins } from '../labels';
import { shortName } from '../game';
import { useMotionOff } from '../components/common';
import { BigButton, Stage } from './OnAir';
import { missionName } from './logic';
import { earned, isDaily, rivalLine, saveAchievements, shareText, type Achievement } from './retention';

export interface Receipt {
  kind: 'worked' | 'caught' | 'betrayal';
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
    let prev = PLAY.STARTING_BANK;
    for (const l of [1, 2, 3, 4, 5]) {
      const last = hist.filter((h) => h.level === l).slice(-1)[0];
      if (!last) continue;
      out[p.id][l] = last.banks[p.id] - prev;
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
    out.push({ kind: worked ? 'worked' : 'caught', level: m.level as LevelId, pid: m.from, text: t(`play.receipts.${worked ? 'worked' : 'caught'}`, { name: shortName(v, m.from), said: claimText(m), ep: m.level }) });
  }
  const lv5 = v.levelIndex === 5 ? (v.levelView as { lobby?: Record<string, { donateTo: string | null; amount: number }>; amendments?: Array<{ proposer: string; votes: Record<string, boolean>; withdrawn?: boolean }> }) : null;
  for (const [from, lb] of Object.entries(lv5?.lobby ?? {})) {
    if (!lb.donateTo || lb.amount <= 0) continue;
    const a = lv5?.amendments?.find((x) => x.proposer === from && !x.withdrawn);
    if (a && !a.votes[lb.donateTo]) out.push({ kind: 'betrayal', level: 5, pid: lb.donateTo, text: t('play.receipts.betrayal', { name: shortName(v, lb.donateTo), donor: shortName(v, from), n: lb.amount }) });
  }
  const order = { worked: 0, caught: 1, betrayal: 2 };
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

/** The Receipts (v2 3.4): at most 20 seconds, skippable; a static list under reduced motion. */
export function ReceiptsReel({ v, next }: { v: ViewState; next: () => void }) {
  const off = useMotionOff();
  const items = useMemo(() => receipts(v), [v]);
  const [k, setK] = useState(off ? items.length : 0);
  const step = Math.min(1500, PLAY.RECEIPTS_MAX_MS / Math.max(1, items.length + 1));
  useEffect(() => {
    if (off || k >= items.length) return;
    const id = setTimeout(() => setK((x) => x + 1), step);
    return () => clearTimeout(id);
  }, [k, off, items.length, step]);
  const shown = items.slice(0, k);
  const done = k >= items.length;
  return (
    <Stage v={v} bar={false} footer={<BigButton beatNext={done} onClick={next}>{done ? t('play.receipts.next') : t('play.receipts.skip')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.receipts.label')}</p>
      <h1 className="h-show text-4xl leading-tight text-spot">{t('play.receipts.title')}</h1>
      <ul className="mt-3 max-h-[440px] space-y-1 overflow-hidden" data-receipts aria-live="polite">
        {(shown.length > 12 ? shown.slice(-12) : shown).map((r, i) => (
          <li key={`${r.level}-${i}-${r.text}`} className={`rounded-xl px-2 py-1 text-sm ${r.kind === 'worked' ? 'bg-good text-onspot' : r.kind === 'caught' ? 'bg-card' : 'bg-stamp text-onspot'}`}>
            {r.text}
          </li>
        ))}
        {!items.length && <li className="text-base">{t('play.receipts.none')}</li>}
      </ul>
      {done && (
        <p className="mt-3 text-sm font-semibold" data-missions>
          {v.players.map((p) => `${shortName(v, p.id)}: ${p.values ? missionName(p.values) : ''}`).join(' · ')}
        </p>
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
  const m = v.play!.mission!;
  const lines = [
    t('play.card.rank', { name: me.name || t('play.card.you'), r: rank, n: v.players.length }),
    t('play.card.best', { ep: best, name: t(`play.episodes.${best}.name`), n: coins(ch[best] ?? 0) }),
    t('play.card.worst', { ep: worst, name: t(`play.episodes.${worst}.name`), n: coins(ch[worst] ?? 0) }),
    t('play.card.bank', { n: coins(v.play!.banks[v.viewer]) }),
    t(m.scale * m.value >= m.goal ? 'play.card.missionDone' : 'play.card.missionMissed', { mission: missionName(m.card) }),
    !h.made ? t('play.card.noClaims') : h.lies ? t('play.card.honesty', { lies: h.lies, made: h.made, caught: h.caught }) : t('play.card.allTrue', { made: h.made }),
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
          <button type="button" className="min-h-[52px] flex-1 rounded-full bg-card font-bold" onClick={() => replay(false)}>
            {t('play.summary.again')}
          </button>
          <div className="flex-1">
            <BigButton onClick={() => go('title')}>{t('play.summary.menu')}</BigButton>
          </div>
        </div>
      }
    >
      <div ref={ref} className="rounded-3xl bg-spot p-5 text-onspot" data-result-card>
        <p className="text-xs font-bold uppercase tracking-wider">{t('play.show')}</p>
        <h1 className="h-show mt-1 text-4xl leading-tight">{title}</h1>
        <ul className="mt-3 space-y-1 text-sm">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px]">{t('play.card.small')}</p>
      </div>
      {mineNow.length > 0 && (
        <p className="mt-2 text-xs font-semibold" data-achievements>
          {t('play.ach.label', { n: all.length, max: 12 })} {mineNow.map((a) => t(`play.ach.${a}.name`)).join(', ')}
        </p>
      )}
      <p className="mt-2 text-sm font-semibold" data-rival>
        {rivalLine(v)} {t('play.rival.ask')}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" className="min-h-[48px] rounded-full bg-card text-sm font-bold" onClick={share} data-share>
          {t('play.card.share')}
        </button>
        <button type="button" className="min-h-[48px] rounded-full bg-card text-sm font-bold" onClick={shareTextNow} data-share-text>
          {copied ? t('play.daily.copied') : t(isDaily(v) ? 'play.daily.shareDaily' : 'play.daily.shareText')}
        </button>
        <button type="button" className="min-h-[48px] rounded-full bg-card text-sm font-bold" onClick={() => replay(true)} data-rematch>
          {t('play.rival.rematch')}
        </button>
      </div>
    </Stage>
  );
}

export function LifeEnd({ v }: { v: ViewState }) {
  const [k, setK] = useState(0);
  return k === 0 ? <ReceiptsReel v={v} next={() => setK(1)} /> : <ResultCard v={v} />;
}
