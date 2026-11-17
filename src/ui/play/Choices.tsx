// UI V4 (V3): "What your choices did". After each round, one row per decision you made with its effect,
// one row for luck, one for everyone else and one for the usual pay and living costs. The rows come from the
// round's ledger (G1), split where a line mixes your choice with others' (gifts, calls), so they add up to
// the bank change shown, to the coin. Presentation only: it reads the viewer's own view.
import type { ViewState } from '../../engine/types';
import { PLAY } from '../../engine/play/params';
import { t } from '../i18n';
import { coins, pct } from '../labels';
import { shortName } from '../game';
import { ledgerRows } from './logic';
import { MoneyLedger } from './Ledger';
import { bandOf } from '../../engine/play/ep2';
import { useEffect } from 'react';
import { sfxMoney } from './sound';
import type { L1View } from './Episode1';
import type { L2View } from './Episode2';
import type { L3View } from './Episode3';
import type { L4View } from './Episode4';
import type { L5View } from './Episode5';

export type ChoiceRow = { kind: 'choice' | 'luck' | 'others' | 'usual'; text: string; n: number };
type Gift = { to: string; amount: number };

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Split a net gift line into what you gave (your choice) and what you got (others). */
function giftRows(v: ViewState, net: number, gifts: Record<string, Gift | null | undefined> | undefined): ChoiceRow[] {
  const mine = gifts?.[v.viewer];
  const gave = mine && mine.amount ? -mine.amount : 0;
  const got = net - gave;
  const out: ChoiceRow[] = [];
  if (mine && gave) out.push({ kind: 'choice', text: t('play.did.gave', { n: mine.amount, name: shortName(v, mine.to) }), n: gave });
  if (got) {
    const from = Object.entries(gifts ?? {}).filter(([f, g]) => f !== v.viewer && g?.to === v.viewer).map(([f]) => shortName(v, f));
    out.push({ kind: 'others', text: t('play.did.gotGift', { names: from.join(t('play.barBeat.and')) || t('play.did.someone') }), n: got });
  }
  return out;
}

/** Split a net call line into your own call (your choice) and calls on you (others). */
function callRows(v: ViewState, net: number): ChoiceRow[] {
  const calls = (v.play?.calls ?? []).filter((c) => c.level === v.levelIndex && c.round === v.round);
  const mine = calls.find((c) => c.caller === v.viewer);
  const mineN = mine ? (mine.lie ? PLAY.CALL_PAYOUT : -PLAY.CALL_STAKE) : 0;
  const out: ChoiceRow[] = [];
  if (mine) out.push({ kind: 'choice', text: t(mine.lie ? 'play.did.callRight' : 'play.did.callWrong', { name: shortName(v, mine.target) }), n: mineN });
  const rest = net - mineN;
  if (rest) {
    const by = calls.filter((c) => c.target === v.viewer).map((c) => shortName(v, c.caller));
    out.push({ kind: 'others', text: t(rest < 0 ? 'play.did.calledCaught' : 'play.did.calledWrong', { names: by.join(t('play.barBeat.and')) || t('play.did.someone') }), n: rest });
  }
  return out;
}

/** Your claim this round and what came of it (no money of its own). */
function claimRow(v: ViewState, words: string, lie: boolean | null, extra = ''): ChoiceRow {
  const calls = (v.play?.calls ?? []).filter((c) => c.level === v.levelIndex && c.round === v.round && c.target === v.viewer);
  const how = lie === null ? '' : t(lie ? 'play.did.aLie' : 'play.did.true');
  const fate = calls.length ? (calls.some((c) => c.lie) ? t('play.did.caught') : t('play.did.calledButTrue')) : t('play.did.notCalled');
  return { kind: 'choice', text: `${t('play.did.said', { words: words.replace(/[.!]$/, ''), how })} ${fate}${extra}`, n: 0 };
}

function myClaim(v: ViewState): string | null {
  for (const m of v.messages) {
    if (m.level !== v.levelIndex || m.round !== v.round || m.from !== v.viewer || m.msg.type !== 'CLAIM') continue;
    const value = (m.msg as { value: string }).value;
    return value === 'SILENT' ? null : value;
  }
  return null;
}

/** The rows for the round just played, or null when there is no ledger for it. */
export function choiceRows(v: ViewState): { rows: ChoiceRow[]; from: number; to: number } | null {
  const lr = ledgerRows(v);
  if (!lr) return null;
  const m: Record<string, number> = {};
  for (const r of lr.money) m[r.key] = (m[r.key] ?? 0) + r.n;
  const take = (k: string) => {
    const x = m[k] ?? 0;
    delete m[k];
    return x;
  };
  const me = v.viewer;
  const rows: ChoiceRow[] = [];
  const level = v.levelIndex;
  if (level === 1) {
    const lv = v.levelView as L1View;
    const r = lv.rounds[lv.rounds.length - 1];
    const rule = take('rule');
    const won = r.votes[me] === r.winner;
    rows.push({ kind: won ? 'choice' : 'others', text: t(won ? 'play.did.l1won' : 'play.did.l1lost', { rule: t(`play.l1.rule.${r.winner}.name`) }), n: rule });
    if (r.peeked.includes(me)) rows.push({ kind: 'choice', text: t('play.did.peeked'), n: take('peek') });
    rows.push({ kind: 'luck', text: t('play.did.dealt', { y: coins(r.incomes[me]) }), n: take('income') + take('inheritance') });
    rows.push(...giftRows(v, take('gift'), r.gifts));
  } else if (level === 2) {
    const lv = v.levelView as L2View;
    const r = lv.rounds[lv.rounds.length - 1];
    const luck = Math.round(r.luck?.[me] ?? 0);
    rows.push({ kind: 'choice', text: t('play.did.worked', { e: r.effort?.[me] ?? 0 }), n: take('income') + take('hours') - luck });
    const c = myClaim(v);
    if (c) rows.push(claimRow(v, t('play.cast.claim.effort', { b: t(`play.l2.band.${c}`).toLowerCase() }), c !== bandOf(r.effort?.[me] ?? 0)));
    rows.push({ kind: 'luck', text: t(luck >= 0 ? 'play.did.dieUp' : 'play.did.dieDown'), n: luck });
    const prize = take('prize');
    if (prize) rows.push({ kind: 'others', text: t('play.did.prize'), n: prize });
    rows.push({ kind: 'others', text: t('play.did.tax', { t: pct(lv.t ?? 0) }), n: take('rule') });
    rows.push(...giftRows(v, take('gift'), r.gifts as Record<string, Gift>));
  } else if (level === 3) {
    const lv = v.levelView as L3View;
    const r = lv.rounds[lv.rounds.length - 1];
    const ch = r.choices[me];
    const hit = !!r.events[me];
    const loss = v.play!.l3?.loss ?? 0;
    const cover = take('cover');
    const bought = ch.buy && r.premium !== null && !r.launch;
    if (r.launch) rows.push({ kind: 'others', text: t('play.did.launch'), n: cover });
    else if (bought) rows.push({ kind: 'choice', text: t(hit ? 'play.did.coverHit' : 'play.did.coverMiss', { loss: coins(loss) }), n: cover });
    else if (r.regime === 'VOL' && r.premium !== null) rows.push({ kind: 'choice', text: t(r.applied?.[me] ? 'play.did.refused' : hit ? 'play.did.outHit' : 'play.did.outMiss', { p: coins(r.premium) }), n: cover });
    else if (cover) rows.push({ kind: 'others', text: t('play.did.plan'), n: cover });
    const gym = take('gym');
    if (ch.gym) rows.push({ kind: 'choice', text: t('play.did.gym', { p: pct(r.pEff[me]) }), n: gym });
    const c = myClaim(v);
    if (c) {
      const lie = (c === 'LOW') !== (lv.myType === 'LOW');
      const barred = !!r.bar?.barred.includes(me);
      rows.push(claimRow(v, t(`play.claims.RISK.${c}`), lie, barred ? ` ${t('play.did.barred')}` : r.applied?.[me] || bought ? ` ${t('play.did.inPool')}` : ''));
    }
    if (ch.bar) rows.push({ kind: 'choice', text: t(r.bar?.barred.includes(ch.bar) ? 'play.did.barWorked' : 'play.did.barFailed', { name: shortName(v, ch.bar) }), n: 0 });
    const lossN = take('loss');
    rows.push({ kind: 'luck', text: t(hit ? (lossN ? 'play.did.wheelHit' : 'play.did.wheelHitCovered') : 'play.did.wheelMiss'), n: lossN });
    const plan = take('plan');
    if (plan) rows.push({ kind: 'others', text: t('play.did.plan'), n: plan });
    rows.push(...giftRows(v, take('gift'), r.gifts as Record<string, Gift>));
  } else if (level === 4) {
    const lv = v.levelView as L4View;
    const r = lv.rounds[lv.rounds.length - 1];
    if (r.judge === me) {
      const good = (r.workers ?? []).filter((w) => r.job?.[w] === 'COMPLEX' && r.good?.includes(w)).length;
      const bad = (r.workers ?? []).filter((w) => r.job?.[w] === 'COMPLEX' && !r.good?.includes(w)).length;
      rows.push({ kind: 'choice', text: t('play.did.judged', { g: good, b: bad }), n: take('judge') });
    } else {
      rows.push({ kind: 'choice', text: t(r.train?.[me] ? 'play.did.trained' : 'play.did.noTrain', { r: t(r.pass?.[me] ? 'play.did.passed' : 'play.did.failed') }), n: take('training') });
      const c = myClaim(v);
      if (c) rows.push(claimRow(v, t('play.cast.claim.trained'), !r.train?.[me]));
      rows.push({ kind: 'others', text: t(r.job?.[me] === 'COMPLEX' ? 'play.did.jobComplex' : 'play.did.jobSimple', { name: shortName(v, r.judge!) }), n: take('pay') });
    }
    const cb = take('comeback');
    if (cb) rows.push({ kind: 'choice', text: t('play.did.comeback'), n: cb });
    rows.push(...giftRows(v, take('gift'), r.gifts as Record<string, Gift>));
  } else {
    const lv = v.levelView as L5View;
    const mine = lv.lobby?.[me];
    const don = take('donation');
    const gave = mine?.donateTo && mine.amount ? -mine.amount : 0;
    if (gave) rows.push({ kind: 'choice', text: t('play.did.donated', { name: shortName(v, mine!.donateTo!), n: -gave }), n: gave });
    if (don - gave) rows.push({ kind: 'others', text: t('play.did.donatedTo'), n: don - gave });
    rows.push({ kind: 'others', text: t('play.did.rules'), n: take('rule') });
    const inc = take('income') + take('incomeFinale');
    if (v.mode === 'LIFE') rows.push({ kind: 'usual', text: t('play.did.finaleUsual'), n: inc });
    else rows.push({ kind: 'luck', text: t('play.did.dealt', { y: coins(inc) }), n: inc });
  }
  rows.push(...callRows(v, take('call')));
  const usual = take('pay') + take('living') + take('income') + take('incomeFinale');
  const rest = Object.values(m).reduce((a, x) => a + x, 0);
  // One row for luck, one for everyone else: the biggest item names the row, the rest add to it.
  const one = (kind: 'luck' | 'others') => {
    const xs = rows.filter((r) => r.kind === kind);
    if (xs.length <= 1) return xs;
    // The biggest first; each item keeps its few words, so the row says what it adds up.
    const sorted = xs.slice().sort((a, b) => Math.abs(b.n) - Math.abs(a.n));
    return [{ kind, text: sorted.map((r) => r.text.replace(/\.$/, '')).join('; ') + '.', n: xs.reduce((a, r) => a + r.n, 0) }];
  };
  const out = [...rows.filter((r) => r.kind === 'choice'), ...one('luck'), ...one('others')];
  if (rest) out.push({ kind: 'others', text: t('play.did.otherMoney'), n: rest });
  // The usual money (pay and living costs; in a life's finale the finale covers living costs) is one row.
  const usualRows = rows.filter((r) => r.kind === 'usual');
  const usualN = usual + usualRows.reduce((a, r) => a + r.n, 0);
  if (usualN || usualRows.length) out.push({ kind: 'usual', text: usualRows.length ? usualRows[0].text : t('play.did.usual'), n: usualN });
  // Merge a second "others" row (other money) into the first, so there is one row for everyone else.
  const others = out.filter((r) => r.kind === 'others');
  const merged = others.length > 1 ? [...out.filter((r) => r.kind !== 'others' && r.kind !== 'usual'), { kind: 'others' as const, text: others.map((r) => r.text.replace(/\.$/, '')).join('; ') + '.', n: others.reduce((a, r) => a + r.n, 0) }, ...out.filter((r) => r.kind === 'usual')] : out;
  return { rows: merged, from: lr.from, to: lr.to };
}

const label: Record<ChoiceRow['kind'], string> = { choice: '', luck: 'play.did.luck', others: 'play.did.others', usual: '' };

/** The block itself: the rows, then the bank change they add up to, with "See the money" beside it. */
const sounded = new Set<string>();

export function ChoicesDid({ v }: { v: ViewState }) {
  const x = choiceRows(v);
  const total = x ? x.to - x.from : 0;
  // UI V4 (V4): one money sound per round result: a rising jingle for a gain, a "wah-wah" for a loss, longer
  // the bigger it is, and a tick for no change.
  const key = `${v.seed ?? ''}|${v.levelIndex}|${v.round}|${v.phaseIdx}`;
  useEffect(() => {
    if (!x || sounded.has(key)) return;
    sounded.add(key);
    sfxMoney(total, 0.45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!x) return null;
  return (
    <section className="mt-2 rounded-2xl bg-card px-3 py-2" aria-labelledby="did-title" data-choices-did>
      <h2 id="did-title" className="text-small font-bold uppercase tracking-wider text-soft">
        {t('play.did.title')}
      </h2>
      <ul className="mt-1 space-y-0.5 text-small">
        {x.rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2" data-did={r.kind}>
            <span className="flex-1 leading-snug">
              {label[r.kind] && <span className="font-bold">{t(label[r.kind])} </span>}
              {r.text}
            </span>
            <span className={`h-show shrink-0 tabular-nums ${r.n > 0 ? 'text-spot' : r.n < 0 ? 'text-stamp' : 'text-soft'}`}>{sign(r.n)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 flex items-center gap-2 border-t border-line pt-1 text-small font-bold" data-did-total>
        <span className="flex-1">
          {t('play.did.total', { from: x.from, to: x.to })}
          <MoneyLedger v={v} />
        </span>
        <span className={`h-show tabular-nums ${total > 0 ? 'text-spot' : total < 0 ? 'text-stamp' : ''}`}>{sign(total)}</span>
      </p>
    </section>
  );
}
