// "Where every coin goes" lines (DECISIONS.md D-47). Numbers here are recomputed from public values
// already on screen (incomes, the tax rate, choices), never from anything private.
import type { ReactNode } from 'react';
import { t } from '../i18n';

/** One decimal, trailing ".0" dropped: 29.5, 40, 9.2. */
export const fmt1 = (x: number) => String(Math.round(x * 10) / 10);

/** A small "where your money came from" line under a player's row. */
export function MoneyLine({ children, mine = false }: { children: ReactNode; mine?: boolean }) {
  return <p className={`num mt-0.5 text-xs leading-snug ${mine ? 'text-ink' : 'text-soft'}`}>{children}</p>;
}

export function MoneyBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-line bg-paper/60 px-3 py-2 text-sm">
      <div className="label">{t('summary.money.title')}</div>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

/** Flat-tax pool with leakage: collected t Y, lost kappa t^2 Y, shared R / n. */
export function taxPool(incomes: number[], tax: number, kappa: number) {
  const Y = incomes.reduce((a, b) => a + b, 0);
  const collected = tax * Y;
  const lost = kappa * tax * tax * Y;
  return { collected, lost, net: collected - lost, share: (collected - lost) / incomes.length };
}

/** "At 40% tax, 16% of what is collected is lost." */
export function lossLine(tax: number, kappa: number): string {
  return t('taxInfo.lossAt', { t: Math.round(tax * 100), l: Math.round(kappa * tax * 100) });
}

export function TaxInfo({ children }: { children: ReactNode }) {
  return <div className="mb-3 space-y-1 rounded-md border border-line bg-paper/60 px-3 py-2 text-sm leading-snug">{children}</div>;
}
