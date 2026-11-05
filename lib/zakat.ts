/**
 * Zakat calculation.
 *
 * Zakat is 2.5% of qualifying wealth held for one lunar year (hawl) once it
 * exceeds the nisab — the value of 87.48 g of gold or 612.36 g of silver.
 * Scholars differ on which nisab to use; the silver nisab is lower, so it is
 * the safer of the two for the poor and is used as the default here.
 *
 * Pure functions only: the screen owns all state, this module owns the maths.
 */

export type NisabBasis = 'silver' | 'gold';

/** Nisab thresholds in grams. */
export const NISAB_GRAMS = {
  gold: 87.48,
  silver: 612.36,
} as const;

/** Zakat rate: one fortieth. */
export const ZAKAT_RATE = 0.025;

export interface ZakatAssets {
  cash: number;
  bankAccounts: number;
  goldGrams: number;
  silverGrams: number;
  investments: number;
  businessStock: number;
  moneyOwedToYou: number;
}

export interface ZakatLiabilities {
  debts: number;
  billsDue: number;
}

export interface ZakatPrices {
  goldPerGram: number;
  silverPerGram: number;
}

export interface ZakatBreakdownRow {
  key: string;
  label: string;
  /** Monetary value contributed by this row. */
  value: number;
  /** Secondary line shown under the label (e.g. grams × price). */
  detail?: string;
}

export interface ZakatResult {
  breakdown: ZakatBreakdownRow[];
  grossAssets: number;
  liabilities: number;
  netWealth: number;
  nisabValue: number;
  nisabBasis: NisabBasis;
  isEligible: boolean;
  /** Value the 2.5% is applied to: 0 when below nisab. */
  zakatableWealth: number;
  zakatDue: number;
}

export const EMPTY_ASSETS: ZakatAssets = {
  cash: 0,
  bankAccounts: 0,
  goldGrams: 0,
  silverGrams: 0,
  investments: 0,
  businessStock: 0,
  moneyOwedToYou: 0,
};

export const EMPTY_LIABILITIES: ZakatLiabilities = {
  debts: 0,
  billsDue: 0,
};

/** Gold is commonly quoted per gram; 24k is the pure baseline. */
export const DEFAULT_PRICES: ZakatPrices = {
  goldPerGram: 0,
  silverPerGram: 0,
};

function num(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Rounds to 2 dp — money, not floats. */
export function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateZakat(
  assets: ZakatAssets,
  liabilities: ZakatLiabilities,
  prices: ZakatPrices,
  basis: NisabBasis = 'silver',
): ZakatResult {
  const goldValue = num(assets.goldGrams) * num(prices.goldPerGram);
  const silverValue = num(assets.silverGrams) * num(prices.silverPerGram);

  const breakdown: ZakatBreakdownRow[] = [
    { key: 'cash', label: 'Cash in hand', value: num(assets.cash) },
    { key: 'bankAccounts', label: 'Bank accounts', value: num(assets.bankAccounts) },
    {
      key: 'gold',
      label: 'Gold',
      value: goldValue,
      detail: assets.goldGrams > 0 && prices.goldPerGram > 0
        ? `${assets.goldGrams} g × ${roundMoney(prices.goldPerGram)}`
        : undefined,
    },
    {
      key: 'silver',
      label: 'Silver',
      value: silverValue,
      detail: assets.silverGrams > 0 && prices.silverPerGram > 0
        ? `${assets.silverGrams} g × ${roundMoney(prices.silverPerGram)}`
        : undefined,
    },
    { key: 'investments', label: 'Investments & shares', value: num(assets.investments) },
    { key: 'businessStock', label: 'Business stock', value: num(assets.businessStock) },
    { key: 'moneyOwedToYou', label: 'Money owed to you', value: num(assets.moneyOwedToYou) },
  ];

  const grossAssets = breakdown.reduce((sum, row) => sum + row.value, 0);
  const totalLiabilities = num(liabilities.debts) + num(liabilities.billsDue);
  const netWealth = Math.max(grossAssets - totalLiabilities, 0);

  const nisabValue = basis === 'gold'
    ? NISAB_GRAMS.gold * num(prices.goldPerGram)
    : NISAB_GRAMS.silver * num(prices.silverPerGram);

  // Without a price the nisab cannot be evaluated; treat it as "unknown" and
  // never claim zakat is due, which spares the user from a wrong obligation.
  const nisabKnown = nisabValue > 0;
  const isEligible = nisabKnown && netWealth >= nisabValue;
  const zakatableWealth = isEligible ? netWealth : 0;
  const zakatDue = roundMoney(zakatableWealth * ZAKAT_RATE);

  return {
    breakdown,
    grossAssets: roundMoney(grossAssets),
    liabilities: roundMoney(totalLiabilities),
    netWealth: roundMoney(netWealth),
    nisabValue: roundMoney(nisabValue),
    nisabBasis: basis,
    isEligible,
    zakatableWealth: roundMoney(zakatableWealth),
    zakatDue,
  };
}

/** Formats a number as `1,234.56` without pulling in Intl on Hermes. */
export function formatMoney(value: number, currency = ''): string {
  const rounded = roundMoney(value);
  const [whole, decimals] = rounded.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency}${currency ? ' ' : ''}${grouped}.${decimals}`;
}
