// G1: "See the money", a tap under every round result listing each line of the round's money and score.
import { useState } from 'react';
import { t } from '../i18n';
import type { ViewState } from '../../engine/types';
import { ledgerRows } from './logic';

const sign = (n: number) => `${n > 0 ? '+' : ''}${n}`;

export function MoneyLedger({ v }: { v: ViewState }) {
  const [open, setOpen] = useState(false);
  const rows = ledgerRows(v);
  if (!rows) return null;
  // Inline link inside the bank line (no extra height); the padding gives it a 44 px tap area.
  return (
    <>
      {' '}
      <button type="button" className="-my-3 inline py-3 font-bold underline" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(true); }} data-ledger>
        {t('play.ledger.show')}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t('play.ledger.show')} onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-paper p-4 text-sm text-ink" onClick={(e) => e.stopPropagation()}>
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
            <button type="button" className="mt-3 min-h-[44px] w-full rounded-full bg-card font-bold" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
              {t('play.ledger.hide')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
