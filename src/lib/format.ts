export interface FormatMoneyOptions {
  /** ISO 4217 currency code. Defaults to "INR". */
  currency?: string;
  /** BCP 47 locale. Defaults to "en-IN". */
  locale?: string;
  /** Always render two decimal places. Defaults to true. */
  forceDecimals?: boolean;
  /** Explicit sign prefix rendered before the symbol. Defaults to "". */
  sign?: "+" | "-";
}

/**
 * Format a numeric amount as currency using Intl.NumberFormat.
 * Handles string inputs coming from numeric() columns.
 *
 * @example
 * formatMoney(4850)            // "₹4,850.00"
 * formatMoney("600")           // "₹600.00"
 * formatMoney(600, { sign: "+" }) // "+₹600.00"
 * formatMoney(4850, { forceDecimals: false }) // "₹4,850"
 */
export function formatMoney(value: number | string, options: FormatMoneyOptions = {}): string {
  const { currency = "INR", locale = "en-IN", forceDecimals = true, sign = "" } = options;

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return `${sign}${new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0)}`;
  }

  const signPrefix = sign === "+" ? "+" : sign === "-" ? "-" : "";
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: forceDecimals ? 2 : 0,
    maximumFractionDigits: forceDecimals ? 2 : undefined,
  }).format(sign ? Math.abs(num) : num);

  return `${signPrefix}${formatted}`;
}
