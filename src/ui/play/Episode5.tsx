// Play Episode 5, "Grand Finale" (v2 Section 4, D-154): rules behind the veil, the bank ceremony, secret
// donations, vote claims, and the ballots landing one at a time. Every string comes from play.l5.*.
import { useState } from 'react';
import type { ViewState } from '../../engine/types';
import type { Amend5, Lobby5, P5Preview } from '../../engine/play/ep5';
import { ALL_CONSTITUTIONS, type Constitution } from '../../engine/levels/level5';
import { L5 } from '../../engine/params';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { nameOf, shortName } from '../game';
import { BigButton, Bubble, Face, Stage } from './OnAir';
import { previewText } from './Episode3';
import { timesWord, bankLineText } from './logic';

export type L5View = {
  veil?: Record<string, Constitution>;
  adopted?: Constitution;
  current?: Constitution;
  incomes?: Record<string, number>;
  lobby?: Record<string, Lobby5>;
  order: string[];
  claims?: Record<string, Record<string, string>>;
  amendments: Amend5[];
  fair1?: Record<string, number>;
  fair2?: Record<string, number>;
  myFair1?: number;
  myFair2?: number;
  W?: Record<string, number>;
  leaked: boolean;
  maxDonation: number;
  need: number;
  preview?: P5Preview;
};

const lv5 = (v: ViewState) => v.levelView as L5View;
export const rules = (c: Constitution) => t('play.l5.rules', { t: pct(c.t), F: coins(c.F) });
const sameC = (a: Constitution, b: Constitution) => Math.abs(a.t - b.t) < 1e-9 && a.F === b.F;

function Chips<X extends string | number>({ opts, value, onPick, label, fmt }: { opts: X[]; value: X | null; onPick: (x: X) => void; label: string; fmt: (x: X) => string }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {opts.map((o) => (
        <button key={String(o)} type="button" aria-pressed={value === o} onClick={() => onPick(o)} className={`min-h-[44px] min-w-[44px] rounded-xl px-2 text-sm font-bold ${value === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
          {fmt(o)}
        </button>
      ))}
    </div>
  );
}

export function Finale({ v, next }: { v: ViewState; next: () => void }) {
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-mycards>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l5.cards.label')}</p>
        <p className="h-show mt-2 text-4xl leading-tight text-spot">{t('play.l5.cards.title')}</p>
        <p className="mt-3 text-base">{v.mode === 'LIFE' ? t('play.l5.cards.life') : t('play.l5.cards.deck', { list: L5.INCOME_DECK.map((y) => coins(y * PLAY.L5.INCOME_SCALE)).join(', ') })}</p>
        <p className="mt-3 text-base">{t('play.l5.cards.how')}</p>
      </div>
    </Stage>
  );
}

/** Rules behind the veil: a tax rate and a floor. */
export function VeilScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [tx, setT] = useState<number | null>(null);
  const [F, setF] = useState<number | null>(null);
  const pv = lv5(v).preview;
  const k = tx !== null && F !== null ? ALL_CONSTITUTIONS.findIndex((c) => Math.abs(c.t - tx) < 1e-9 && c.F === F) : -1;
  const note = k >= 0 ? previewText(pv?.constitutions[k]) : null;
  return (
    <Stage v={v} footer={<BigButton disabled={k < 0} onClick={() => act({ t: tx, F })}>{t('play.l5.veil.submit')}</BigButton>}>
      <h1 className="h-show text-3xl leading-tight">{t('play.l5.veil.title')}</h1>
      <p className="mt-1 text-sm">{t(v.mode === 'LIFE' ? 'play.l5.veil.howLife' : 'play.l5.veil.how')}</p>
      <p className="mt-3 text-sm font-bold">{t('play.l5.tax')}</p>
      <Chips opts={L5.TAX_OPTIONS} value={tx} onPick={setT} label={t('play.l5.tax')} fmt={pct} />
      <p className="mt-3 text-sm font-bold">{t('play.l5.floor')}</p>
      <Chips opts={L5.FLOOR_OPTIONS} value={F} onPick={setF} label={t('play.l5.floor')} fmt={coins} />
      {note && <p className="mt-3 text-sm font-bold" data-preview>{note}</p>}
    </Stage>
  );
}

/** The unpaid question, before and after the ceremony. */
export function FairScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<number | null>(null);
  const after = v.phase.step === 'FAIR_2';
  const cur = lv5(v).current;
  const [tx, setT] = useState<number>(cur?.t ?? 0);
  const [F, setF] = useState<number>(cur?.F ?? 0);
  const prop = { t: tx, F };
  const proposing = after && !!cur && !sameC(prop, cur);
  const k = ALL_CONSTITUTIONS.findIndex((c) => Math.abs(c.t - tx) < 1e-9 && c.F === F);
  const note = proposing ? previewText(lv5(v).preview?.constitutions[k]) : null;
  return (
    <Stage v={v} footer={<BigButton disabled={x === null} onClick={() => act(after ? { fair: x, proposal: proposing ? prop : null } : x)}>{t('play.l5.fair.submit')}</BigButton>}>
      <h1 className="h-show text-3xl leading-tight">{t('play.l5.fair.title')}</h1>
      <p className="mt-1 text-sm">{t(after ? 'play.l5.fair.after' : v.levelIndex === 1 ? 'play.l5.fair.born' : v.mode === 'LIFE' ? 'play.l5.fair.beforeLife' : 'play.l5.fair.before')}</p>
      <Chips opts={L5.TAX_OPTIONS} value={x} onPick={setX} label={t('play.l5.fair.title')} fmt={pct} />
      {after && cur && (
        <section className="mt-auto pt-3" aria-label={t('play.l5.lobby.title')}>
          <p className="text-sm font-bold">{proposing ? t('play.l5.lobby.propose', { rules: rules(prop) }) : t('play.l5.lobby.keepNow', { rules: rules(cur) })}</p>
          {note && <p className="text-sm font-bold">{note}</p>}
          <Chips opts={L5.TAX_OPTIONS} value={tx} onPick={setT} label={t('play.l5.tax')} fmt={pct} />
          <Chips opts={L5.FLOOR_OPTIONS} value={F} onPick={setF} label={t('play.l5.floor')} fmt={coins} />
        </section>
      )}
    </Stage>
  );
}

/** The bank ceremony: everyone's income under the adopted rules. */
export function IncomesScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv5(v);
  const inc = lv.incomes ?? {};
  const order = v.players.slice().sort((a, b) => (inc[a.id] ?? 0) - (inc[b.id] ?? 0));
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.l5.inc.next')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l5.inc.label')}</p>
      <h1 className="h-show mt-1 text-3xl leading-tight text-spot">{lv.adopted ? rules(lv.adopted) : ''}</h1>
      <ul className="mt-3 space-y-1.5" data-outcome>
        {order.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
            <Face v={v} p={p} size={24} />
            <span className="flex-1 truncate text-sm font-bold">{shortName(v, p.id)}</span>
            <span className="h-show text-xl">{coins(inc[p.id] ?? 0)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm">{t('play.l5.inc.now')}</p>
    </Stage>
  );
}

/** Propose an amendment (or not) and secretly donate to one contestant. */
export function LobbyScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv5(v);
  const mine = lv.lobby?.[v.viewer]?.proposal;
  const [to, setTo] = useState<string | null>(null);
  const amounts = PLAY.L5.DONATION_OPTIONS_BOT.filter((a) => a > 0 && a <= lv.maxDonation);
  if (lv.maxDonation > Math.max(...amounts)) amounts.push(lv.maxDonation);
  const [amount, setAmount] = useState<number>(amounts[0]);
  const said = (id: string) => t(`play.l5.said.${lv.claims?.[id]?.[v.viewer] ?? 'SILENT'}`);
  return (
    <Stage v={v} footer={<BigButton onClick={() => act({ donateTo: to, amount: to ? amount : 0 })}>{t('play.stage.lock')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l5.lobby.yours', { rules: mine ? rules(mine) : '' })}</p>
      <h1 className="h-show mt-1 text-2xl leading-tight">{t('play.l5.lobby.donate')}</h1>
      <p className="mt-1 text-sm">{t(lv.leaked ? 'play.l5.lobby.howLeaked' : 'play.l5.lobby.how')}</p>
      <Chips opts={['', ...v.players.filter((p) => p.id !== v.viewer).map((p) => p.id)]} value={to ?? ''} onPick={(x) => setTo(x || null)} label={t('play.l5.lobby.donate')} fmt={(x) => (x ? `${shortName(v, x)}: ${said(x)}` : t('play.l5.lobby.nobody'))} />
      {to && <Chips opts={amounts} value={amount} onPick={setAmount} label={t('play.l5.lobby.amount')} fmt={coins} />}
    </Stage>
  );
}

/** Claim how you'll vote on each amendment. */
export function ClaimScreen5({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv5(v);
  const [x, setX] = useState<Record<string, string>>(() => Object.fromEntries(lv.order.map((p) => [p, p === v.viewer ? 'YES' : 'SILENT'])));
  return (
    <Stage v={v} footer={<BigButton onClick={() => act(x)}>{t('play.claim.submit')}</BigButton>}>
      <h1 className="h-show text-3xl leading-tight">{t('play.l5.claim.title')}</h1>
      <ul className="mt-3 space-y-1.5">
        {lv.order.filter((p) => p !== v.viewer).map((p) => (
          <li key={p} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
            <span>
              <Face v={v} p={v.players.find((q) => q.id === p)!} size={24} />
            </span>
            <span className="flex-1 text-sm font-semibold">{t('play.l5.compact', { t: pct(lv.lobby![p].proposal!.t), F: coins(lv.lobby![p].proposal!.F) })}</span>
            {['YES', 'NO'].map((o) => (
              <button key={o} type="button" aria-label={`${t(`play.l5.${o}`)}: ${shortName(v, p)}`} aria-pressed={x[p] === o} onClick={() => setX({ ...x, [p]: x[p] === o ? 'SILENT' : o })} className={`min-h-[44px] rounded-lg px-2 text-xs font-bold ${x[p] === o ? 'bg-spot text-onspot' : 'bg-paper'}`}>
                {t(`play.l5.${o}`)}
              </button>
            ))}
          </li>
        ))}
      </ul>
    </Stage>
  );
}

export function AmendScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv5(v);
  const k = Number((v.phase.step ?? 'AMEND_0').slice(6));
  const proposer = lv.order[k];
  const prop = lv.lobby![proposer].proposal!;
  const got = lv.lobby![proposer].donateTo === v.viewer ? lv.lobby![proposer].amount : 0;
  const [x, setX] = useState<boolean | null>(null);
  return (
    <Stage v={v} footer={<BigButton disabled={x === null} onClick={() => act(x)}>{t('play.l5.amend.submit')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l5.amend.label', { k: k + 1, n: lv.order.length, name: shortName(v, proposer) })}</p>
      <h1 className="h-show mt-1 text-3xl leading-tight">{rules(prop)}</h1>
      <p className="mt-1 text-sm">{t('play.l5.amend.now', { rules: rules(lv.current!), n: lv.need })}</p>
      {got > 0 && <p className="mt-1 text-sm font-bold">{t('play.l5.amend.got', { n: got, name: shortName(v, proposer) })}</p>}
      <p className="mt-2 text-xs">{t('play.l5.amend.claims', { list: v.players.map((p) => `${shortName(v, p.id)} ${t(`play.l5.said.${lv.claims?.[p.id]?.[proposer] ?? 'SILENT'}`)}`).join(', ') })}</p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        {[true, false].map((o) => (
          <button key={String(o)} type="button" aria-pressed={x === o} onClick={() => setX(o)} className={`min-h-[72px] rounded-2xl text-xl font-bold ${x === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
            {t(o ? 'play.l5.YES' : 'play.l5.NO')}
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** The peak: ballots land, with claim stamps and the bought-vote stamps. */
export function AmendReveal({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv5(v);
  const me = v.viewer;
  const stamps: string[] = [];
  for (const [from, lb] of Object.entries(lv.lobby ?? {})) {
    if (!lb.donateTo || lb.amount <= 0) continue;
    const a = lv.amendments.find((x) => x.proposer === from && !x.withdrawn);
    if (!a) continue;
    const key = a.votes[lb.donateTo] ? 'bought' : 'betray';
    stamps.push(t(`play.l5.peak.${key}`, { name: shortName(v, lb.donateTo), donor: shortName(v, from), n: lb.amount }));
  }
  const shift = lv.fair1 && lv.fair2 ? lv.fair2[me] - lv.fair1[me] : 0;
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.stage.tap')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l5.peak.label')}</p>
      <h1 className="h-show text-2xl leading-tight text-spot">{lv.current ? t('play.l5.peak.final', { rules: rules(lv.current) }) : ''}</h1>
      <ul className="mt-2 space-y-1" data-cards>
        {lv.amendments
          .filter((a) => !a.withdrawn)
          .map((a) => (
            <li key={a.proposer} className="rounded-xl bg-card px-2 py-1 text-[11px] leading-tight">
              <span className="font-bold">{t('play.l5.peak.am', { name: shortName(v, a.proposer), rules: rules(a.proposal), res: t(a.passed ? 'play.l5.peak.passed' : 'play.l5.peak.failed'), y: a.yes })}</span>{' '}
              {v.players
                .map((p) => {
                  const c = a.claims[p.id];
                  const stamp = c === 'YES' || c === 'NO' ? ((c === 'YES') === !!a.votes[p.id] ? t('play.l5.peak.kept') : t('play.l5.peak.broke')) : '';
                  return `${shortName(v, p.id)} ${t(a.votes[p.id] ? 'play.l5.YES' : 'play.l5.NO')}${stamp ? ` ${stamp}` : ''}`;
                })
                .join(', ')}
            </li>
          ))}
      </ul>
      {stamps.map((x) => (
        <p key={x} className="h-show mt-2 text-lg leading-tight">
          {x}
        </p>
      ))}
      {bankLineText(v) && <p className="mt-2 text-sm font-semibold" data-bankline>{bankLineText(v)}</p>}
      <p className="mt-2 text-sm">{t('play.l5.peak.shift', { a: pct(lv.fair1?.[me] ?? 0), b: pct(lv.fair2?.[me] ?? 0), d: `${shift >= 0 ? '+' : ''}${Math.round(shift * 100)}` })}</p>
      <div className="mt-2">
        <Bubble who="Dash" host text={stamps.length ? t('play.l5.peak.hostBought') : t('play.l5.peak.hostClean')} />
      </div>
    </Stage>
  );
}

export function summary5(v: ViewState): { lie: string } {
  const lv = lv5(v);
  const top = v.players
    .map((p) => ({ id: p.id, n: lv.amendments.filter((a) => !a.withdrawn && (a.claims[p.id] === 'YES' || a.claims[p.id] === 'NO') && (a.claims[p.id] === 'YES') !== !!a.votes[p.id]).length }))
    .sort((a, b) => b.n - a.n)[0];
  return { lie: top && top.n ? t(top.id === v.viewer ? 'play.l5.sum.lieYou' : 'play.l5.sum.lie', { name: nameOf(v, top.id), n: timesWord(top.n) }) : t('play.summary.noLie') };
}
