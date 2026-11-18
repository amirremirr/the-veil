// Play Episode 1, "Born" (v2 Section 4, D-152): claim your vote, vote before you know your income, and in
// round 2 the Peek. One beat per screen, as Episode 3. Every string comes from play.l1.*.
import { useState } from 'react';
import type { ViewState } from '../../engine/types';
import type { PrincipleId } from '../../engine/tax';
import { PRINCIPLES } from '../../engine/tax';
import type { P1Round } from '../../engine/play/ep1';
import { CLAIMABLE } from '../../engine/play/ep1';
import { useStore } from '../store';
import { t } from '../i18n';
import { ChoicesDid } from './Choices';
import type { CastCue } from './Cast';
import { CallChips, CallResults, claimantsNow } from './Call';
import { coins, pct } from '../labels';
import { nameOf, shortName } from '../game';
import { Chips, Details, StagedReveal, peakMark, spotlightSteps } from './Peak';
import { Coach } from './Coach';
import { BigButton, Bubble, Face, Stage } from './OnAir';
import { GiftBar, Tile, giftLines } from './Episode3';
import { hostLine, pick, timesWord, ledgerRows } from './logic';

type Gift = { to: string; amount: number };

export type L1View = {
  rounds: P1Round[];
  peeked: string[];
  claims?: Record<string, string>;
  myIncome?: number;
  deck: number[];
  peekCost: number;
};

const lv1 = (v: ViewState) => v.levelView as L1View;
export const ruleName = (p: string) => t(`play.l1.rule.${p}.name`);

/** Round 2: pay to see your income first. Everyone will see that you peeked. */
export function PeekScreen({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<boolean | null>(null);
  const lv = lv1(v);
  return (
    <Stage v={v} footer={<BigButton disabled={x === null} onClick={() => act(x)}>{t('play.l1.peek.submit')}</BigButton>}>
      <h1 className="h-show text-hero leading-tight">{t('play.l1.peek.title')}</h1>
      <p className="mt-2 text-body">{t('play.l1.peek.how', { c: lv.peekCost })}</p>
      <p className="mt-2 text-small font-semibold">{t('play.l1.peek.public')}</p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <Tile on={x === true} title={t('play.l1.peek.yes')} desc={t('play.l1.peek.yesDesc', { c: lv.peekCost })} onClick={() => setX(true)} />
        <Tile on={x === false} title={t('play.l1.peek.no')} desc={t('play.l1.peek.noDesc', { c: lv.peekCost })} onClick={() => setX(false)} />
      </div>
    </Stage>
  );
}

function knowLine(v: ViewState): string {
  const lv = lv1(v);
  // UI V3 (U3): the deck stays on the decision screens, since the beat that showed it now moves on by itself.
  return lv.myIncome !== undefined ? t('play.l1.youKnow', { y: coins(lv.myIncome) }) : t('play.cast.youDontDeck', { a: coins(lv.deck[0]), b: coins(lv.deck[1]), c: coins(lv.deck[2]), d: coins(lv.deck[3]) });
}

export function ClaimScreen1({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const [x, setX] = useState<string | null>(null);
  return (
    <Stage v={v} footer={<BigButton disabled={!x} onClick={() => act(x)}>{t('play.claim.submit')}</BigButton>}>
      <h1 className="h-show text-hero leading-tight">{t('play.claim.title')}</h1>
      <Coach id="claim" />
      <div className="mt-3 rounded-2xl bg-card p-3">
        <p className="h-show text-title leading-tight">{knowLine(v)}</p>
      </div>
      <div className="mt-auto space-y-2 pt-3" role="group" aria-label={t('play.claim.title')}>
        {[...CLAIMABLE, 'SILENT'].map((o) => (
          <button key={o} type="button" aria-pressed={x === o} onClick={() => setX(o)} className={`block w-full rounded-2xl p-3 text-start ${x === o ? 'bg-spot text-onspot' : 'bg-card'}`}>
            <span className="h-show block text-lead leading-tight">{o === 'SILENT' ? t('play.claim.opts.SILENT.title') : t('play.l1.claimOpt', { rule: ruleName(o) })}</span>
          </button>
        ))}
      </div>
    </Stage>
  );
}

/** The move: vote for a rule (secret), and a gift. */
export function VoteScreen1({ v }: { v: ViewState }) {
  const act = useStore((s) => s.act);
  const lv = lv1(v);
  const [vote, setVote] = useState<PrincipleId | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [call, setCall] = useState<string | null>(null);
  return (
    <Stage v={v} cast={{ marks: Object.fromEntries(lv.peeked.map((id) => [id, t('play.l1.peekedTag')])) }} footer={<BigButton disabled={!vote} onClick={() => act({ vote, gift, call })}>{t('play.l1.vote.submit')}</BigButton>}>
      <h1 className="h-show text-title leading-tight">{t('play.l1.vote.title')}</h1>
      <p className="text-small font-semibold leading-snug">{knowLine(v)}</p>
      <Coach id="move" />

      <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={t('play.l1.vote.title')}>
        {PRINCIPLES.map((p) => (
          <Tile key={p} on={vote === p} title={ruleName(p)} desc={t(`play.l1.rule.${p}.desc`)} onClick={() => setVote(p)} />
        ))}
      </div>
      <CallChips v={v} claimants={claimantsNow(v)} value={call} onPick={setCall} />
      <div className="mt-auto pt-2">
        <GiftBar v={v} gift={gift} onPick={setGift} />
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
  // G1: your own "after the rule" comes from the rounded ledger, so it matches the bank line to the coin.
  const lr = ledgerRows(v);
  const myPost = lr ? String(lr.money.filter((x) => x.key === 'income' || x.key === 'rule').reduce((a, x) => a + x.n, 0)) : coins(r.post[me]);
  // V5 N3: the vote's result is on this screen too (the rule that won, kept and broken promises as stamps).
  const cue: CastCue = { stamps: {}, expr: {} };
  for (const p of v.players) {
    const c = r.claims[p.id];
    if (c && c !== 'SILENT' && c !== r.votes[p.id]) {
      cue.stamps![p.id] = { text: t('play.cast.broke'), tone: 'stamp' };
      cue.expr![p.id] = 'smug';
    } else if (c && c !== 'SILENT') cue.stamps![p.id] = { text: t('play.cast.kept'), tone: 'good' };
  }
  return (
    <Stage v={v} cast={cue} onTap={next} footer={<BigButton beatNext={!last} onClick={next}>{last ? t('play.l1.toReveal') : t('play.stage.nextRound', { r: v.round + 1 })}</BigButton>}>
      <div className="my-auto" data-outcome>
        <p className="text-small font-bold uppercase tracking-wider text-soft">{t('play.l1.inc.won', { rule: ruleName(r.winner), t: pct(r.t) })}</p>
        <h1 className="h-show mt-1 text-title leading-tight text-spot">{t('play.cast.l1keep', { w: myPost })}</h1>
        <p className="text-small">{t('play.cast.l1before', { y: coins(r.incomes[me]) })}</p>
        <ul className="mt-3 space-y-1.5">
          {order.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
              <Face v={v} p={p} size={24} />
              <span className="w-16 truncate text-small font-bold">{shortName(v, p.id)}</span>
              <span className="flex-1 text-small">{t('play.l1.inc.row', { y: coins(r.incomes[p.id]), w: p.id === me ? myPost : coins(r.post[p.id]) })}</span>
              {r.peeked.includes(p.id) && <span className="text-small font-bold">{t('play.l1.peekedTag')}</span>}
            </li>
          ))}
        </ul>
        {r.inheritance && <p className="mt-2 text-small">{t('play.l1.inc.inherit', { name: shortName(v, r.inheritance) })}</p>}
        {/* UI V4 (V3): what your choices did; V5 N3: before the last round it shows on the next round's first screen. */}
        {last && <ChoicesDid v={v} />}
        {giftLines(v, r.gifts) && <p className="mt-1 text-small" data-gifts>{giftLines(v, r.gifts)}</p>}
        <CallResults v={v} quiet />
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
  const chipsOf = (id: string) =>
    lv.rounds.map((r, k) => {
      const c = r.claims[id];
      const lie = !!c && c !== 'SILENT' && c !== r.votes[id];
      const stamp = !c || c === 'SILENT' ? t('play.l4.peak.silent') : lie ? t('play.cards.LIE') : t('play.cards.TRUE');
      return { text: t('play.l1.peak.stamp', { r: k + 1, rule: ruleName(r.votes[id]), stamp }), lie };
    });
  const claimsOf = (id: string) => lv.rounds.filter((r) => r.claims[id] && r.claims[id] !== 'SILENT').length;
  const liesOf = (id: string) => lv.rounds.filter((r) => r.claims[id] && r.claims[id] !== 'SILENT' && r.claims[id] !== r.votes[id]).length;
  const order = v.players.slice().sort((a, b) => liesOf(b.id) - liesOf(a.id));
  const { steps, final } = spotlightSteps(
    order.map((p) => ({
      id: p.id,
      ...peakMark(v, p.id, liesOf(p.id), claimsOf(p.id)),
      body: (
        <div className="rounded-2xl bg-card p-3">
          <p className="h-show text-lead">{shortName(v, p.id)}{r2.peeked.includes(p.id) ? ` · ${t('play.l1.peekedTag')}` : ''}</p>
          <div className="mt-2"><Chips items={chipsOf(p.id)} /></div>
        </div>
      ),
    })),
    <>
      <Details>
        <ul className="space-y-1" data-cards-list>
        {v.players.map((p) => (
          <li key={p.id} className="flex items-start gap-2 rounded-xl bg-card px-2 py-1">
            <span className="w-16 shrink-0 truncate text-small font-bold">{shortName(v, p.id)}</span>
            <Chips items={chipsOf(p.id)} />
          </li>
        ))}
      </ul>
      </Details>
      <div className="mt-2 space-y-1">
        {peekLines.length ? peekLines.map((x) => <p key={x} className="h-show text-lead leading-tight">{x}</p>) : <p className="h-show text-lead leading-tight">{t('play.l1.peak.noPeek')}</p>}
      </div>
      <div className="mt-2">
        <Bubble who="Dash" host mood={lies && lies.n ? 'excited' : 'wink'} text={lies && lies.n ? t(lies.id === me ? 'play.cards.peakLieYouPlain' : 'play.l1.peak.lie', { name: nameOf(v, lies.id), n: timesWord(lies.n) }) : hostLine('peakHonest', pick(v, 'peakHonest', 6))} />
      </div>
    </>,
  );
  return <StagedReveal v={v} label={t('play.cards.label')} title={t('play.l1.peak.title')} steps={steps} final={final} onDone={() => act()} />;
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
