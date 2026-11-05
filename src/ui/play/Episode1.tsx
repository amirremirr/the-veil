// Play Episode 1, "Born" (v2 Section 4, D-152): claim your vote, vote before you know your income, and in
// round 2 the Peek. One beat per screen, as Episode 3. Every string comes from play.l1.*.
import { useState } from 'react';
import type { ViewState } from '../../engine/types';
import type { PrincipleId } from '../../engine/tax';
import { PRINCIPLES } from '../../engine/tax';
import type { P1Preview, P1Round } from '../../engine/play/ep1';
import { CLAIMABLE } from '../../engine/play/ep1';
import { PLAY } from '../../engine/play/params';
import { useStore } from '../store';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { nameOf, shortName } from '../game';
import { BigButton, Bubble, Face, Stage } from './OnAir';
import { GiftSheet, Stamps, Tile, previewText } from './Episode3';
import { hostLine, pick, timesWord, bankLineText } from './logic';

type Gift = { to: string; amount: number };

export type L1View = {
  rounds: P1Round[];
  peeked: string[];
  claims?: Record<string, string>;
  myIncome?: number;
  deck: number[];
  peekCost: number;
  preview?: P1Preview;
};

const lv1 = (v: ViewState) => v.levelView as L1View;
export const ruleName = (p: string) => t(`play.l1.rule.${p}.name`);

/** Before the first claim: what you know (nothing) and the deck. */
export function Unborn({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv1(v);
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-mycards>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l1.unborn.label')}</p>
        <p className="h-show mt-2 text-4xl leading-tight text-spot">{t('play.l1.unborn.title')}</p>
        <p className="mt-3 text-base">{t('play.l1.unborn.deck', { a: coins(lv.deck[0]), b: coins(lv.deck[1]), c: coins(lv.deck[2]), d: coins(lv.deck[3]) })}</p>
        <p className="mt-3 text-base">{t('play.l1.unborn.rules')}</p>
      </div>
    </Stage>
  );
}

/** Round 2: pay to see your income first. Everyone will see that you peeked. */
export function PeekScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<boolean | null>(null);
  const lv = lv1(v);
  return (
    <Stage v={v} footer={<BigButton disabled={x === null} onClick={() => act(x)}>{t('play.l1.peek.submit')}</BigButton>}>
      <h1 className="h-show text-4xl leading-tight">{t('play.l1.peek.title')}</h1>
      <p className="mt-2 text-base">{t('play.l1.peek.how', { c: lv.peekCost })}</p>
      <p className="mt-2 text-sm font-semibold">{t('play.l1.peek.public')}</p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <Tile on={x === true} title={t('play.l1.peek.yes')} desc={t('play.l1.peek.yesDesc', { c: lv.peekCost })} onClick={() => setX(true)} />
        <Tile on={x === false} title={t('play.l1.peek.no')} desc={t('play.l1.peek.noDesc')} onClick={() => setX(false)} />
      </div>
    </Stage>
  );
}

function knowLine(v: ViewState): string {
  const lv = lv1(v);
  return lv.myIncome !== undefined ? t('play.l1.youKnow', { y: coins(lv.myIncome) }) : t('play.l1.youDont');
}

export function ClaimScreen1({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<string | null>(null);
  return (
    <Stage v={v} footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.claim.submit')}</BigButton>}>
      <h1 className="h-show text-4xl leading-tight">{t('play.claim.title')}</h1>
      <div className="mt-3 rounded-2xl bg-card p-3">
        <p className="h-show text-2xl leading-tight">{knowLine(v)}</p>
      </div>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.claim.title')}>
        {[...CLAIMABLE, 'SILENT'].map((o) => (
          <button key={o} type="button" aria-pressed={x === o} onClick={() => setX(o)} className={`block w-full rounded-2xl p-3 text-start ${x === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-xl leading-tight">{o === 'SILENT' ? t('play.claim.opts.SILENT.title') : t('play.l1.claimOpt', { rule: ruleName(o) })}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** The move: vote for a rule (secret), and a gift. Each rule shows its mission preview. */
export function VoteScreen1({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv1(v);
  const [vote, setVote] = useState<PrincipleId | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [giving, setGiving] = useState(false);
  const pv = lv.preview;
  return (
    <Stage v={v} footer={<BigButton disabled={!vote} onClick={() => act({ vote, gift })}>{t('play.l1.vote.submit')}</BigButton>}>
      <p className="text-base font-semibold leading-snug">{knowLine(v)}</p>
      {lv.peeked.length > 0 && <p className="text-sm">{t('play.l1.peekers', { names: lv.peeked.map((id) => shortName(v, id)).join(', ') })}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={t('play.l1.vote.title')}>
        {PRINCIPLES.map((p) => (
          <Tile key={p} on={vote === p} title={ruleName(p)} desc={t(`play.l1.rule.${p}.desc`)} note={previewText(pv?.vote[p])} onClick={() => setVote(p)} />
        ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
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

/** Results beat 1: votes flip one at a time (all at once under reduced motion), with broken-promise stamps. */
export function VotesBeat({ v, next }: { v: ViewState; next: () => void }) {
  const lv = lv1(v);
  const r = lv.rounds[lv.rounds.length - 1];
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext onClick={next}>{t('play.stage.tap')}</BigButton>}>
      <div className="my-auto" data-vote>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l1.votes.label', { r: v.round })}</p>
        <h1 className="h-show mt-1 text-4xl leading-tight text-spot">{ruleName(r.winner)}</h1>
        <p className="mt-1 text-sm">{t('play.l1.votes.tax', { t: pct(r.t) })}{r.tie ? ` ${t('play.l1.votes.tie')}` : ''}</p>
        <ul className="mt-3 space-y-1.5">
          {v.players.map((p) => {
            const c = r.claims[p.id];
            const broke = c && c !== 'SILENT' && c !== r.votes[p.id];
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
                <Face v={v} p={p} size={24} />
                <span className="w-16 truncate text-sm font-bold">{shortName(v, p.id)}</span>
                <span className="flex-1 text-sm">{ruleName(r.votes[p.id])}</span>
                {r.peeked.includes(p.id) && <span className="text-[11px] font-bold">{t('play.l1.peekedTag')}</span>}
                {broke && <span className="rounded bg-stamp px-1 text-[11px] font-bold text-onspot">{t('play.l1.votes.broke', { rule: ruleName(c) })}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </Stage>
  );
}

/** Results beat 2: incomes flip poorest first, then money after the rule. */
export function IncomesBeat({ v, next, last }: { v: ViewState; next: () => void; last: boolean }) {
  const lv = lv1(v);
  const r = lv.rounds[lv.rounds.length - 1];
  const order = v.players.slice().sort((a, b) => r.incomes[a.id] - r.incomes[b.id]);
  const me = v.viewer;
  return (
    <Stage v={v} onTap={next} footer={<BigButton beatNext={!last} onClick={next}>{last ? t('play.l1.toReveal') : t('play.stage.nextRound', { r: v.round + 1 })}</BigButton>}>
      <div className="my-auto" data-outcome>
        <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.l1.inc.label')}</p>
        <h1 className="h-show mt-1 text-3xl leading-tight text-spot">{t('play.l1.inc.you', { y: coins(r.incomes[me]), w: coins(r.W[me]) })}</h1>
        <ul className="mt-3 space-y-1.5">
          {order.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
              <Face v={v} p={p} size={24} />
              <span className="w-16 truncate text-sm font-bold">{shortName(v, p.id)}</span>
              <span className="flex-1 text-sm">{t('play.l1.inc.row', { y: coins(r.incomes[p.id]), w: coins(r.W[p.id]) })}</span>
              {r.peeked.includes(p.id) && <span className="text-[11px] font-bold">{t('play.l1.peekedTag')}</span>}
            </li>
          ))}
        </ul>
        {r.peeked.includes(me) && <p className="mt-2 text-sm">{t('play.l1.inc.peekCost', { c: lv.peekCost })}</p>}
        {r.inheritance && <p className="mt-2 text-sm">{t('play.l1.inc.inherit', { name: shortName(v, r.inheritance) })}</p>}
        {bankLineText(v) && <p className="mt-2 text-sm font-semibold" data-bankline>{bankLineText(v)}</p>}
      </div>
    </Stage>
  );
}

/** The peak: peekers' votes next to their incomes, and every claim stamped TRUE or LIE. */
export function CardsReveal1({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv1(v);
  const r2 = lv.rounds[lv.rounds.length - 1];
  const me = v.viewer;
  const peekLines = r2.peeked.map((id) =>
    t(id === me ? 'play.l1.peak.peekYou' : 'play.l1.peak.peek', { name: shortName(v, id), y: coins(r2.incomes[id]), rule: ruleName(r2.votes[id]) }),
  );
  const lies = v.players.map((p) => ({ id: p.id, n: lv.rounds.filter((r) => r.claims[p.id] && r.claims[p.id] !== 'SILENT' && r.claims[p.id] !== r.votes[p.id]).length })).sort((a, b) => b.n - a.n)[0];
  return (
    <Stage v={v} footer={<BigButton onClick={() => act()}>{t('play.stage.tap')}</BigButton>}>
      <p className="text-xs font-bold uppercase tracking-wider text-soft">{t('play.cards.label')}</p>
      <h1 className="h-show text-3xl leading-tight text-spot">{t('play.l1.peak.title')}</h1>
      <ul className="mt-2 space-y-1" data-cards>
        {v.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1">
            <Face v={v} p={p} size={22} />
            <span className="w-14 truncate text-xs font-bold">{shortName(v, p.id)}</span>
            <span className="flex-1 text-[11px] leading-tight">
              <Stamps items={lv.rounds
                .map((r, k) => {
                  const c = r.claims[p.id];
                  const stamp = !c || c === 'SILENT' ? t('play.l4.peak.silent') : c === r.votes[p.id] ? t('play.cards.TRUE') : t('play.cards.LIE');
                  return t('play.l1.peak.stamp', { r: k + 1, rule: ruleName(r.votes[p.id]), stamp });
                })
                } />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 space-y-1">
        {peekLines.length ? peekLines.map((x) => <p key={x} className="h-show text-lg leading-tight">{x}</p>) : <p className="h-show text-lg leading-tight">{t('play.l1.peak.noPeek')}</p>}
      </div>
      <div className="mt-2">
        <Bubble who="Dash" host text={lies && lies.n ? t(lies.id === me ? 'play.cards.peakLieYou' : 'play.l1.peak.lie', { name: nameOf(v, lies.id), n: timesWord(lies.n) }) : hostLine('peakHonest', pick(v, 'peakHonest', 6))} />
      </div>
    </Stage>
  );
}

export function summary1(v: ViewState): { lie: string } {
  const lv = lv1(v);
  const top = v.players
    .map((p) => {
      const rs = lv.rounds.filter((r) => r.claims[p.id] && r.claims[p.id] !== 'SILENT' && r.claims[p.id] !== r.votes[p.id]);
      return { id: p.id, n: rs.length, said: rs[0]?.claims[p.id], did: rs[0]?.votes[p.id] };
    })
    .sort((a, b) => b.n - a.n)[0];
  return { lie: top && top.n ? t(top.id === v.viewer ? 'play.l1.sum.lieYou' : 'play.l1.sum.lie', { name: nameOf(v, top.id), said: ruleName(top.said!), did: ruleName(top.did!) }) : t('play.summary.noLie') };
}
