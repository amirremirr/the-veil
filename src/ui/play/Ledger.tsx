// G1: "See the money", a tap under every round result listing each line of the round's money and score.
// UI V4 (V1): it opens in place, in the screen's own content area (no pop-up on top).
import { t } from '../i18n';
import type { ViewState } from '../../engine/types';
import { ledgerRows } from './logic';
import { useStagePanel } from './OnAir';

const sign = (n: number) => `${n > 0 ? '+' : ''}${n}`;

/** The ledger's lines (money, then score), as shown in the panel. */
export function LedgerBody({ v }: { v: ViewState }) {
  const rows = ledgerRows(v);
  if (!rows) return null;
  return (
    <div data-ledger-body>
      <p className="font-bold">{t('play.ledger.moneyTitle', { a: rows.from, b: rows.to })}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.money.map((r) => (
          <li key={r.key} className="flex justify-between gap-2">
            <span>{t(`play.ledger.k.${r.key}`)}</span>
            <span className="font-semibold tabular-nums">{sign(r.n)}</span>
          </li>
        ))}
      </ul>
      {rows.score.length > 0 && (
        <>
          <p className="mt-3 font-bold">{t('play.ledger.scoreTitle', { a: rows.scoreFrom, b: rows.scoreTo })}</p>
          <ul className="mt-1 space-y-0.5">
            {rows.score.map((r) => (
              <li key={r.key} className="flex justify-between gap-2">
                <span>{t(`play.ledger.s.${r.key}`)}</span>
                <span className="font-semibold tabular-nums">{sign(r.n)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-small text-soft">{t('play.ledger.rounded')}</p>
    </div>
  );
}

export function MoneyLedger({ v }: { v: ViewState }) {
  const open = useStagePanel();
  const rows = ledgerRows(v);
  if (!rows || !open) return null;
  // Inline link inside the bank line (no extra height); the padding gives it a 44 px tap area.
  return (
    <>
      {' '}
      <button
        type="button"
        className="-my-3 inline py-3 font-bold underline"
        onClick={(e) => {
          e.stopPropagation();
          open({ title: t('play.ledger.show'), body: <LedgerBody v={v} /> });
        }}
        data-ledger
      >
        {t('play.ledger.show')}
      </button>
    </>
  );
}
