/**
 * Time-saved model (ours, not an industry statistic): about 1.6 hours per employee per month across HR, managers and
 * employees; a full-time year is 1,920 hours. Rupee formatting follows Indian readers (lakh / crore) in English and
 * compact Intl notation elsewhere.
 */
import { formatCurrency } from '../i18n/format.js';

export const HOURS_PER_EMPLOYEE_MONTH = 1.6;
export const HOURS_PER_FTE_YEAR = 1920;

export const ROI_INPUTS = {
  headcount: { id: 'roi-headcount', min: 10, max: 3000, step: 10, initial: 250 },
  rate: { id: 'roi-rate', min: 200, max: 3000, step: 50, initial: 600 },
} as const;

export interface RoiFigures {
  readonly hours: number;
  readonly value: number;
  readonly fte: number;
}

export function roiFigures(headcount: number, rate: number): RoiFigures {
  const hours = headcount * HOURS_PER_EMPLOYEE_MONTH * 12;
  return { hours, value: hours * rate, fte: hours / HOURS_PER_FTE_YEAR };
}

export interface RupeeUnits {
  readonly crore: string;
  readonly lakh: string;
}

export function formatRupees(amount: number, locale: string, units: RupeeUnits): string {
  if (locale === 'en') {
    if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} ${units.crore}`;
    if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(1)} ${units.lakh}`;
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }
  return formatCurrency(amount, 'INR', amount >= 1e5 ? { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 }, locale);
}
