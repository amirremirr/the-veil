// Play Episode 2, "First Hustle" (v2 Section 4, D-153): the tax vote, the hustle meter with a claim, the
// incomes, and the Hustle Prize. One beat per screen, as Episode 3. Every string comes from play.l2.*.
import { useState } from 'react';
import type { ViewState } from '../../engine/types';
import type { P2Preview, P2Round } from '../../engine/play/ep2';
import { BANDS } from '../../engine/play/ep2';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { fmt1 } from '../components/Money';
import { nameOf, shortName } from '../game';
import { BigButton, Bubble, Face, Stage } from './OnAir';
import { GiftSheet, Stamps, Tile, previewText } from './Episode3';
import { timesWord, bankLineText, roundMoney } from './logic';

type Gift = { to: string; amount: number };

export type L2View = {
  t: number | null;
  tVotes?: Record<string, number>;
  myTalent: number;
  talents?: Record<string, number>;
  rounds: Array<Partial<P2Round>>;
  current?: Partial<P2Round>;
  poll: Record<string, number>;
  preview?: P2Preview;
  myMoney?: number[];
  costK: number;
  talentMult: number;
  meanLuck: number;
  cardsOpen: boolean;
};

const lv2 = (v: ViewState) => v.levelView as L2View;
const bandName = (b: string) => t(`play.l2.band.${b}`);
const signedCoins = (x: number) => (x > 0 ? `+${coins(x)}` : coins(x));

export function MyCards2({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv2(v);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-mycards>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l2.cards.label')}</p>
        <p className="h-show mt-2 text-5xl leading-none text-spot">{t('play.l2.cards.talent', { a: lv.myTalent })}</p>
        <p className="mt-3 text-base">{t('play.l2.cards.how', { per: fmt1(lv.talentMult * lv.myTalent) })}</p>
        <p className="mt-3 text-base">{t('play.l2.cards.secret')}</p>
      </div>
    </Stage>
  );
}

/** Loop cycle 4: the tax vote's result and who voted what, before the first hustle. */
export function TaxIn({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv2(v);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-vote>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l2.taxIn.label')}</p>
        <p className="h-show mt-2 text-5xl leading-none text-spot">{pct(lv.t ?? 0)}</p>
        <p className="mt-2 text-base">{t('play.l2.taxIn.how')}</p>
        <p className="mt-3 text-sm">{v.players.map((p) => `${shortName(v, p.id)}: ${pct(lv.tVotes?.[p.id] ?? 0)}`).join(', ')}</p>
      </div>
    </Stage>
  );
}

export function TaxScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<number | null>(null);
  const pv = lv2(v).preview?.tax;
  return (
    <Stage v={v} footer={<BigButton disabled={x === null} onClick={() => act(x)}>{t('play.l2.tax.submit')}</BigButton>}>
      <h1 className="h-show text-4xl leading-tight">{t('play.l2.tax.title')}</h1>
      <p className="mt-1 text-sm">{t('play.l2.tax.how')}</p>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-3" role="group" aria-label={t('play.l2.tax.title')}>
        {PLAY.L2.TAX_OPTIONS.map((o) => (
          <Tile key={o} on={x === o} title={pct(o)} desc={t(o === 0 ? 'play.l2.tax.none' : 'play.l2.tax.shared')} note={previewText(pv?.[String(o)])} onClick={() => setX(o)} />
        ))}
      </div>
    </Stage>
  );
}

/** The move: the hustle meter (private), a claim about it (public), and a gift. */
export function EffortScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv2(v);
  const [e, setE] = useState(5);
  const [claim, setClaim] = useState<string>('SILENT');
  const [gift, setGift] = useState<Gift | null>(null);
  const [giving, setGiving] = useState(false);
  const pv = lv.preview;
  const note = previewText(pv?.effort?.[e]);
  return (
    <Stage v={v} footer={<BigButton onClick={() => act({ effort: e, claim, gift })}>{t('play.stage.lock')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l2.effort.tax', { t: pct(lv.t ?? 0) })}</p>
      <label className="mt-1 block">
        <span className="h-show text-3xl leading-tight">{t('play.l2.effort.title', { e })}</span>
        <input type="range" min={0} max={10} step={1} value={e} onChange={(ev) => setE(Number(ev.target.value))} className="mt-2 w-full" aria-label={t('play.l2.effort.aria')} />
      </label>
      <p className="text-sm">
        {t('play.l2.effort.money', { w: coins(lv.myMoney?.[e] ?? 0) })}
        {note && <span className="ms-1 font-bold">{note}</span>}
      </p>
      <p className="mt-2 text-sm font-bold">{t('play.l2.effort.claim')}</p>
      <div className="mt-1 grid grid-cols-4 gap-1.5" role="group" aria-label={t('play.l2.effort.claim')}>
        {[...BANDS, 'SILENT'].map((b) => (
          <button key={b} type="button" aria-pressed={claim === b} onClick={() => setClaim(b)} className={`min-h-[44px] rounded-xl px-1 text-xs font-bold ${claim === b ? 'bg-spot text-onspot' : 'bg-card'}`}>
            {b === 'SILENT' ? t('play.l2.silent') : bandName(b)}
          </button>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <Tile
          on={!!gift}
          title={t('play.gift.title')}
          desc={gift ? t('play.gift.picked', { n: gift.amount, name: shortName(v, gift.to) }) : t('play.gift.desc', { max: Math.max(...PLAY.GIFT_AMOUNTS) })}
          note={gift ? previewText(pv?.gift[gift.to]?.[gift.amount]) : null}
          onClick={() => setGiving(true)}
        />
      </div>
      {giving && (
        <GiftSheet
          v={v}
          gift={gift}
          previews={pv?.gift}
          onPick={(g) => {
            setGift(g);
            setGiving(false);
          }}
          onClose={() => setGiving(false)}
        />
      )}
    </Stage>
  );
}

/** The incomes: gross money for everyone, claims beside them, your own die. Effort and others' luck stay hidden. */
export function IncomeScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv2(v);
  const c = lv.current!;
  const me = v.viewer;
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.l2.inc.next')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l2.inc.label', { r: v.round })}</p>
      <h1 className="h-show mt-1 text-3xl leading-tight text-spot">{t('play.l2.inc.you', { y: coins(c.y?.[me] ?? 0), d: signedCoins(c.luck?.[me] ?? 0) })}</h1>
      <p className="mt-1 text-sm">{t('play.l2.inc.how', { h: c.effort?.[me] ?? 0, per: fmt1(lv.talentMult * lv.myTalent), w: coins((c.effort?.[me] ?? 0) * lv.talentMult * lv.myTalent), d: signedCoins(c.luck?.[me] ?? 0) })}</p>
      <ul className="mt-3 space-y-1.5" data-outcome>
        {v.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
            <Face v={v} p={p} size={24} />
            <span className="w-16 truncate text-sm font-bold">{shortName(v, p.id)}</span>
            <span className="h-show w-12 text-lg">{coins(c.y?.[p.id] ?? 0)}</span>
            <span className="flex-1 text-xs">{c.claims?.[p.id] && c.claims[p.id] !== 'SILENT' ? t('play.l2.said', { b: bandName(c.claims[p.id]) }) : t('play.l2.silent')}</span>
            {c.cameras && c.effort?.[p.id] !== undefined && <span className="text-xs font-bold">{t('play.l2.cam', { e: c.effort[p.id] })}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm">{t(c.cameras ? 'play.l2.inc.cameras' : 'play.l2.inc.hidden')}</p>
    </Stage>
  );
}

/** READ: the Hustle Prize vote. Rows show income, claim, the audience poll and the mission preview. */
export function PrizeScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv2(v);
  const c = lv.current!;
  const [x, setX] = useState<string | null>(null);
  const poll = v.play!.pollMode === 'NEVER' ? {} : lv.poll;
  return (
    <Stage v={v} footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.l2.prize.submit')}</BigButton>}>
      <h1 className="h-show text-3xl leading-tight">{t('play.l2.prize.title', { n: PLAY.HUSTLE_PRIZE })}</h1>
      <p className="mt-1 text-sm">{t('play.l2.prize.how')}</p>
      <ul className="mt-2 space-y-1.5" aria-label={t('play.l2.prize.title', { n: PLAY.HUSTLE_PRIZE })}>
        {v.players
          .filter((p) => p.id !== v.viewer)
          .map((p) => {
            const note = previewText(lv.preview?.prize?.[p.id]);
            return (
              <li key={p.id}>
                <button type="button" aria-pressed={x === p.id} onClick={() => setX(p.id)} className={`flex min-h-[48px] w-full items-center gap-2 rounded-xl px-2 text-start ${x === p.id ? 'bg-spot text-onspot' : 'bg-card'}`}>
                  <Face v={v} p={p} size={24} />
                  <span className="w-16 truncate text-sm font-bold">{shortName(v, p.id)}</span>
                  <span className="h-show w-10">{coins(c.y?.[p.id] ?? 0)}</span>
                  <span className="flex-1 text-xs">{c.claims?.[p.id] && c.claims[p.id] !== 'SILENT' ? bandName(c.claims[p.id]) : t('play.l2.silent')}</span>
                  {poll[p.id] !== undefined && <span className="text-[11px] font-semibold">{t('play.l2.poll', { p: pct(poll[p.id]) })}</span>}
                  {note && <span className="text-[10px] font-bold">{note}</span>}
                </button>
              </li>
            );
          })}
      </ul>
    </Stage>
  );
}

export function PrizeBeat({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv2(v);
  const r = lv.rounds[lv.rounds.length - 1];
  const w = r.winners ?? [];
  const last = v.round >= PLAY.L2.ROUNDS;
  // Loop cycle 16: gifts given and received this round, shown apart from the net income.
  const giftNet = Object.entries(r.gifts ?? {}).reduce((a, [from, g]) => a + (g.to === v.viewer ? g.amount : 0) - (from === v.viewer ? g.amount : 0), 0);
  const head = w.length === 1 ? (w[0] === v.viewer ? t('play.l2.won.you', { n: PLAY.HUSTLE_PRIZE }) : t('play.l2.won.one', { name: shortName(v, w[0]), n: PLAY.HUSTLE_PRIZE })) : t('play.l2.won.split', { names: w.map((x) => shortName(v, x)).join(t('play.barBeat.and')) });
  return (
    <Stage v={v} onTap={next} footer={<BigButton onClick={next}>{last ? t('play.l1.toReveal') : t('play.stage.nextRound', { r: v.round + 1 })}</BigButton>}>
      <div className="my-auto" data-outcome>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l2.won.label')}</p>
        <h1 className="h-show mt-1 text-4xl leading-tight text-spot">{head}</h1>
        <p className="mt-3 text-sm">{v.players.map((p) => `${shortName(v, p.id)}: ${r.votes?.[p.id] ? shortName(v, r.votes[p.id]!) : ''}`).join(', ')}</p>
        <p className="mt-2 text-sm" data-net>{t('play.l2.won.net', { y: coins(r.y?.[v.viewer] ?? 0), t: pct(lv.t ?? 0), k: coins((roundMoney(v) ?? r.W?.[v.viewer] ?? 0) - (r.prize?.[v.viewer] ?? 0) - giftNet) })}{r.prize?.[v.viewer] ? ` ${t('play.l2.won.netPrize', { n: coins(r.prize[v.viewer]) })}` : ''}{giftNet ? ` ${t('play.l2.won.netGifts', { n: `${giftNet > 0 ? '+' : ''}${coins(giftNet)}` })}` : ''}</p>
        {bankLineText(v) && <p className="mt-2 text-sm font-semibold" data-bankline>{bankLineText(v)}</p>}
      </div>
    </Stage>
  );
}

/** The peak: true effort next to every claim, and the luck dice at last. */
export function CardsReveal2({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv2(v);
  const me = v.viewer;
  const wins = (id: string) => lv.rounds.filter((r) => r.winners?.includes(id)).length;
  const star = v.players.slice().sort((a, b) => wins(b.id) - wins(a.id))[0];
  const sw = wins(star.id);
  const avgE = (id: string) => lv.rounds.reduce((a, r) => a + (r.effort?.[id] ?? 0), 0) / Math.max(1, lv.rounds.length);
  const bestLuck = (id: string) => Math.max(...lv.rounds.map((r) => r.luck?.[id] ?? 0));
  const peak = sw
    ? t(star.id === me ? 'play.l2.peak.starYou' : 'play.l2.peak.star', { name: shortName(v, star.id), n: sw, e: avgE(star.id).toFixed(1), d: signedCoins(bestLuck(star.id)) })
    : t('play.l2.peak.none');
  // The twin of "Just a Worrier": a hard worker with bad dice.
  const unlucky = v.players.find((p) => avgE(p.id) >= 7 && Math.min(...lv.rounds.map((r) => r.luck?.[p.id] ?? 0)) < 0);
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.stage.tap')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.cards.label')}</p>
      <h1 className="h-show text-3xl leading-tight text-spot">{t('play.l2.peak.title')}</h1>
      <ul className="mt-2 space-y-1" data-cards>
        {v.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1">
            <Face v={v} p={p} size={22} />
            <span className="w-14 truncate text-xs font-bold">{shortName(v, p.id)}</span>
            <span className="flex-1 text-[11px] leading-tight">
              <Stamps items={lv.rounds
                .map((r, k) => {
                  const c = r.claims?.[p.id];
                  const e = r.effort?.[p.id] ?? 0;
                  const b = e <= PLAY.L2.BANDS[0] ? 'LITTLE' : e <= PLAY.L2.BANDS[1] ? 'SOME' : 'LOT';
                  const stamp = !c || c === 'SILENT' ? t('play.l4.peak.silent') : c === b ? t('play.cards.TRUE') : t('play.cards.LIE');
                  return t('play.l2.peak.stamp', { r: k + 1, e, d: signedCoins(r.luck?.[p.id] ?? 0), stamp });
                })
                } />
            </span>
          </li>
        ))}
      </ul>
      <p className="h-show mt-3 text-xl leading-tight">{peak}</p>
      {unlucky && <p className="mt-1 text-sm font-semibold">{t('play.l2.peak.unlucky', { name: shortName(v, unlucky.id) })}</p>}
      <div className="mt-2">
        <Bubble who="Dash" host text={t('play.l2.peak.host')} />
      </div>
    </Stage>
  );
}

export function summary2(v: ViewState): { lie: string } {
  const lv = lv2(v);
  const lies = (id: string) => lv.rounds.filter((r) => {
    const c = r.claims?.[id];
    const e = r.effort?.[id] ?? 0;
    const b = e <= PLAY.L2.BANDS[0] ? 'LITTLE' : e <= PLAY.L2.BANDS[1] ? 'SOME' : 'LOT';
    return c && c !== 'SILENT' && c !== b;
  }).length;
  const top = v.players.slice().sort((a, b) => lies(b.id) - lies(a.id))[0];
  const n = lies(top.id);
  return { lie: n ? t(top.id === v.viewer ? 'play.l2.sum.lieYou' : 'play.l2.sum.lie', { name: nameOf(v, top.id), n: timesWord(n) }) : t('play.summary.noLie') };
}
