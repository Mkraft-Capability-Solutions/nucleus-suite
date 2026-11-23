/**
 * Currencies a salary can be set in (ISO 4217), with how many minor units each has. Salaries are
 * stored as integers in minor units (`employees.basic_salary_minor`) next to their currency
 * (`employees.currency`), so the two must always be read and written together: 1,500.50 USD is
 * 150050, ¥250,000 is 250000 (yen has no minor unit) and 1.250 KWD is 1250.
 */

export type Currency = { code: string; name: string; digits: 0 | 2 | 3 };

export const SALARY_CURRENCIES: readonly Currency[] = [
  { code: "INR", name: "Indian rupee", digits: 2 },
  { code: "USD", name: "US dollar", digits: 2 },
  { code: "EUR", name: "Euro", digits: 2 },
  { code: "GBP", name: "Pound sterling", digits: 2 },
  { code: "AED", name: "UAE dirham", digits: 2 },
  { code: "SAR", name: "Saudi riyal", digits: 2 },
  { code: "QAR", name: "Qatari riyal", digits: 2 },
  { code: "KWD", name: "Kuwaiti dinar", digits: 3 },
  { code: "BHD", name: "Bahraini dinar", digits: 3 },
  { code: "OMR", name: "Omani rial", digits: 3 },
  { code: "SGD", name: "Singapore dollar", digits: 2 },
  { code: "MYR", name: "Malaysian ringgit", digits: 2 },
  { code: "THB", name: "Thai baht", digits: 2 },
  { code: "HKD", name: "Hong Kong dollar", digits: 2 },
  { code: "CNY", name: "Chinese yuan", digits: 2 },
  { code: "JPY", name: "Japanese yen", digits: 0 },
  { code: "AUD", name: "Australian dollar", digits: 2 },
  { code: "NZD", name: "New Zealand dollar", digits: 2 },
  { code: "CAD", name: "Canadian dollar", digits: 2 },
  { code: "CHF", name: "Swiss franc", digits: 2 },
  { code: "SEK", name: "Swedish krona", digits: 2 },
  { code: "NOK", name: "Norwegian krone", digits: 2 },
  { code: "DKK", name: "Danish krone", digits: 2 },
  { code: "ZAR", name: "South African rand", digits: 2 },
  { code: "LKR", name: "Sri Lankan rupee", digits: 2 },
  { code: "NPR", name: "Nepalese rupee", digits: 2 },
  { code: "BDT", name: "Bangladeshi taka", digits: 2 },
];

export const SALARY_CURRENCY_CODES = SALARY_CURRENCIES.map((currency) => currency.code) as [string, ...string[]];

export function isSalaryCurrency(code: unknown): code is string {
  return typeof code === "string" && SALARY_CURRENCY_CODES.includes(code);
}

/** Minor units in the currency (2 for INR and USD, 0 for JPY, 3 for KWD); 2 for anything unknown. */
export function currencyDigits(code: string | null | undefined): number {
  return SALARY_CURRENCIES.find((currency) => currency.code === code)?.digits ?? 2;
}

/** The currency's symbol as the browser writes it ("₹", "$", "€"), or the code itself. */
export function currencySymbol(code: string, locale = "en-IN"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * "1,50,000.50" in a currency → minor units, or null when it is not an amount the currency can hold
 * (letters, a negative number, or more decimals than the currency has).
 */
export function toMinorUnits(amount: string | number | null | undefined, code: string): number | null {
  if (amount === null || amount === undefined) return null;
  const text = String(amount).replace(/[,\s_]/g, "").trim();
  if (!text) return null;
  const digits = currencyDigits(code);
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
  if (!pattern.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const minor = Number(whole) * 10 ** digits + Number((fraction + "000").slice(0, digits) || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units → the amount as a plain decimal string ("150000.50", "250000"). */
export function fromMinorUnits(minor: number, code: string): string {
  const digits = currencyDigits(code);
  if (digits === 0) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  const scale = 10 ** digits;
  return `${sign}${Math.floor(absolute / scale)}.${String(absolute % scale).padStart(digits, "0")}`;
}

/** "₹1,50,000.00", "$4,500.00", "¥250,000". */
export function formatMoney(minor: number, code: string, locale = "en-IN"): string {
  const digits = currencyDigits(code);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 10 ** digits);
  } catch {
    return `${code} ${fromMinorUnits(minor, code)}`;
  }
}
