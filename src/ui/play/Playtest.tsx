// Playtest kit UI (RUNPLAN F1, D-166): a skippable survey after an episode or a life, the results code, and
// the results page (?playtest=results). Shown only in playtest mode; normal play never renders any of it.
import { useState } from 'react';
import type { Message, ViewState } from '../../engine/types';
import { t } from '../i18n';
import { compact, currentLog, decodeResults, encodeResults, setActs, setSurvey, type Survey } from '../playtest';

/** This player's own choices in the episode or life (never anyone else's private cards). */
function actsOf(v: ViewState): { lied: number; barred: number; gave: number; peeked: number } {
  const me = v.viewer;
  const lied = (v.messages as Message[]).filter((m) => m.from === me && m.msg.type === 'CLAIM' && m.kept === false).length;
  const res = v.levelResults as unknown as Record<number, { rounds?: Array<Record<string, unknown>> }>;
  const lv = v.levelView as { rounds?: Array<Record<string, unknown>> } | null;
  const rounds = [...Object.values(res).flatMap((r) => r?.rounds ?? []), ...(lv?.rounds ?? [])];
  let barred = 0;
  let gave = 0;
  let peeked = 0;
  for (const r of rounds) {
    const bar = r.bar as { votes?: Record<string, string | null> } | undefined;
    if (bar?.votes?.[me]) barred++;
    const gifts = r.gifts as Record<string, unknown> | undefined;
    if (gifts?.[me]) gave++;
    if ((r.peeked as string[] | undefined)?.includes(me)) peeked++;
  }
  return { lied, barred, gave, peeked };
}

const CHOICES = {
  cared: ['claim', 'move', 'vote', 'read', 'give', 'none'],
  surprised: ['lie', 'reveal', 'result', 'price', 'nothing'],
  changed: ['lot', 'little', 'none'],
  again: ['yes', 'maybe', 'no'],
  withWhom: ['friend', 'family', 'partner', 'colleague', 'nobody'],
  unclear: ['yes', 'no'],
  missionChanged: ['yes', 'bit', 'no'],
} as const;

export function PlaytestPanel({ v }: { v: ViewState }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Survey>({});
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const send = async () => {
    setActs(actsOf(v));
    setSurvey(s);
    const l = currentLog();
    if (!l) return;
    setCode(await encodeResults(compact(l)));
  };
  const copy = async () => {
    if (!code) return;
    try {
      const nav = navigator as Navigator & { share?: (d: unknown) => Promise<void> };
      if (nav.share && /Mobi|Android/i.test(navigator.userAgent)) await nav.share({ text: code });
      else await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  if (!open)
    return (
      <button type="button" className="mt-2 text-sm font-semibold underline" onClick={() => setOpen(true)} data-playtest-open>
        {t('play.pt.open')}
      </button>
    );
  const chip = (q: keyof typeof CHOICES) => (
    <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label={t(`play.pt.q.${q}`)}>
      {CHOICES[q].map((o) => (
        <button key={o} type="button" aria-pressed={s[q] === o} onClick={() => setS({ ...s, [q]: o })} className={`min-h-[44px] rounded-lg px-2 text-xs font-bold ${s[q] === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
          {t(`play.pt.a.${q}.${o}`)}
        </button>
      ))}
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper p-4" data-playtest role="dialog" aria-label={t('play.pt.title')}>
      <h2 className="h-show text-2xl">{t('play.pt.title')}</h2>
      <p className="text-sm">{t('play.pt.how')}</p>
      <label className="mt-3 block text-sm font-bold">
        {t('play.pt.q.oneSentence')}
        <input className="mt-1 w-full rounded-lg bg-card p-2 text-sm" maxLength={120} value={s.oneSentence ?? ''} onChange={(e) => setS({ ...s, oneSentence: e.target.value })} />
      </label>
      {(['cared', 'surprised', 'changed', 'again', 'withWhom', 'unclear', 'missionChanged'] as const).map((q) => (
        <div key={q} className="mt-3">
          <p className="text-sm font-bold">{t(`play.pt.q.${q}`)}</p>
          {chip(q)}
        </div>
      ))}
      <label className="mt-3 block text-sm font-bold">
        {t('play.pt.q.why')}
        <input className="mt-1 w-full rounded-lg bg-card p-2 text-sm" maxLength={120} value={s.why ?? ''} onChange={(e) => setS({ ...s, why: e.target.value })} />
      </label>
      <div className="mt-4 flex gap-2">
        <button type="button" className="min-h-[48px] flex-1 rounded-full bg-card font-bold" onClick={() => setOpen(false)}>
          {t('play.pt.skip')}
        </button>
        <button type="button" className="min-h-[48px] flex-1 rounded-full bg-spot font-bold text-onspot" onClick={send} data-playtest-send>
          {t('play.pt.send')}
        </button>
      </div>
      {code && (
        <div className="mt-3">
          <p className="text-sm">{t('play.pt.codeHow')}</p>
          <textarea readOnly className="mt-1 h-28 w-full rounded-lg bg-card p-2 text-[11px]" value={code} data-playtest-code />
          <button type="button" className="mt-1 min-h-[44px] w-full rounded-full bg-card font-bold" onClick={copy}>
            {copied ? t('play.daily.copied') : t('play.pt.copy')}
          </button>
        </div>
      )}
    </div>
  );
}

type Row = { c: { n: number; d: string; seed: string; mode: string; ep?: number }; f: number | null; t: number; s: Array<[string, number]>; m: number; b: number; r: number; a: { lied: number; barred: number; gave: number; peeked: number }; q: Survey };

export function PlaytestResults() {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [bad, setBad] = useState(0);
  const read = async () => {
    const codes = text.split(/\s+/).filter(Boolean);
    const ok: Row[] = [];
    let fail = 0;
    for (const c of codes) {
      try {
        ok.push((await decodeResults(c)) as Row);
      } catch {
        fail++;
      }
    }
    setRows(ok);
    setBad(fail);
  };
  const fs = rows.map((r) => r.f).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const median = fs.length ? fs[Math.floor((fs.length - 1) / 2)] : null;
  const slow: Record<string, number> = {};
  for (const r of rows) for (const [k, s] of r.s) slow[k] = (slow[k] ?? 0) + s;
  const answers = (q: keyof Survey) => {
    const m: Record<string, number> = {};
    for (const r of rows) if (r.q?.[q]) m[r.q[q]!] = (m[r.q[q]!] ?? 0) + 1;
    return Object.entries(m).map(([k, n]) => `${k} ${n}`).join(', ');
  };
  return (
    <main className="mx-auto max-w-3xl p-4" data-playtest-results>
      <h1 className="h-show text-3xl">{t('play.pt.results')}</h1>
      <p className="text-sm">{t('play.pt.paste')}</p>
      <textarea className="mt-2 h-32 w-full rounded-lg bg-card p-2 text-xs" value={text} onChange={(e) => setText(e.target.value)} aria-label={t('play.pt.paste')} />
      <button type="button" className="mt-2 min-h-[44px] rounded-full bg-spot px-4 font-bold text-onspot" onClick={read}>
        {t('play.pt.read')}
      </button>
      {bad > 0 && <p className="mt-2 text-sm">{t('play.pt.bad', { n: bad })}</p>}
      {rows.length > 0 && (
        <>
          <h2 className="mt-4 text-xl font-bold">{t('play.pt.totals')}</h2>
          <ul className="text-sm">
            <li>{t('play.pt.tTesters', { n: rows.length })}</li>
            <li>{t('play.pt.tReplay', { n: rows.filter((r) => r.r).length, of: rows.length })}</li>
            <li>{t('play.pt.tFirst', { s: median ?? '-' })}</li>
            <li>{t('play.pt.tSlow', { list: Object.entries(slow).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, s]) => `${k} (${Math.round(s)} s)`).join(', ') })}</li>
            <li>{t('play.pt.tAgain', { list: answers('again') })}</li>
            <li>{t('play.pt.tWho', { list: answers('withWhom') })}</li>
          </ul>
          <h2 className="mt-4 text-xl font-bold">{t('play.pt.rows')}</h2>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  {['#', 'mode', 'seats', 'level', 'code', 'first (s)', 'total (s)', 'replay<10s', 'lied', 'barred', 'gave', 'peeked', 'one sentence', 'again', 'with', 'why'].map((h) => (
                    <th key={h} className="p-1 text-start">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {[i + 1, `${r.c.mode}${r.c.ep ? ` ${r.c.ep}` : ''}`, r.c.n, r.c.d, r.c.seed, r.f ?? '-', r.t, r.r ? 'yes' : 'no', r.a.lied, r.a.barred, r.a.gave, r.a.peeked, r.q?.oneSentence ?? '', r.q?.again ?? '', r.q?.withWhom ?? '', r.q?.why ?? ''].map((x, k) => (
                      <td key={k} className="p-1 align-top">
                        {String(x)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
