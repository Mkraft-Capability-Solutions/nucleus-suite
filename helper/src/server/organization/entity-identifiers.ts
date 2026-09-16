import { ESI_IP_PATTERN, PAN_PATTERN } from "@/lib/statutory-ids";
import type { PicklistValue } from "@/lib/picklists";

/**
 * Format rules for the employer-side statutory identifiers FRM-PLT-01 validates. As with
 * `src/lib/statutory-ids.ts`, every rule here is one the workbook states ("21 char CIN or
 * 8 char LLPIN format", "4th char must be C/F/A/T", "state code must match address");
 * nothing is inferred. The two state-code tables are published standards (GST state codes
 * and ISO 3166-2:IN), keyed by the PL_STATE slug so the address state drives both.
 */

/** 21-character CIN: listing status, industry, state, year, ownership, registration number. */
export const CIN_PATTERN = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
/** 8-character LLPIN, three letters and four digits with the MCA hyphen. */
export const LLPIN_PATTERN = /^[A-Z]{3}-\d{4}$/;
/** ABCD12345E. */
export const TAN_PATTERN = /^[A-Z]{4}\d{5}[A-Z]$/;
/** 15 characters: 2-digit state code, 10-character PAN, entity number, Z, check character. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
/** Region / office / establishment / extension, with or without the separators. */
export const PF_ESTABLISHMENT_PATTERN = /^[A-Z]{2}\/?[A-Z]{3}\/?\d{7}\/?\d{3}$/;
/** The 17-digit ESI employer code shares its shape with the insured-person number. */
export const ESI_EMPLOYER_PATTERN = ESI_IP_PATTERN;

/** The PAN holder types an employer can be: company, firm, AOP, trust. */
const ENTITY_PAN_HOLDER_TYPES = new Set(["C", "F", "A", "T"]);

/** True when the PAN is well formed and its fourth character is one of C, F, A or T. */
export function isEntityPan(value: string): boolean {
  return PAN_PATTERN.test(value) && ENTITY_PAN_HOLDER_TYPES.has(value[3] ?? "");
}

/** True for either registration form the workbook accepts. */
export function isCinOrLlpin(value: string): boolean {
  return CIN_PATTERN.test(value) || LLPIN_PATTERN.test(value);
}

export type StateCode = PicklistValue<"PL_STATE">;

type StateCodes = { readonly gst: string; readonly iso: string };

/** GST state code and ISO 3166-2:IN subdivision code for every PL_STATE value. */
export const STATE_CODES: Readonly<Record<StateCode, StateCodes>> = {
  andhra_pradesh: { gst: "37", iso: "AP" },
  arunachal_pradesh: { gst: "12", iso: "AR" },
  assam: { gst: "18", iso: "AS" },
  bihar: { gst: "10", iso: "BR" },
  chhattisgarh: { gst: "22", iso: "CT" },
  goa: { gst: "30", iso: "GA" },
  gujarat: { gst: "24", iso: "GJ" },
  haryana: { gst: "06", iso: "HR" },
  himachal_pradesh: { gst: "02", iso: "HP" },
  jharkhand: { gst: "20", iso: "JH" },
  karnataka: { gst: "29", iso: "KA" },
  kerala: { gst: "32", iso: "KL" },
  madhya_pradesh: { gst: "23", iso: "MP" },
  maharashtra: { gst: "27", iso: "MH" },
  manipur: { gst: "14", iso: "MN" },
  meghalaya: { gst: "17", iso: "ML" },
  mizoram: { gst: "15", iso: "MZ" },
  nagaland: { gst: "13", iso: "NL" },
  odisha: { gst: "21", iso: "OR" },
  punjab: { gst: "03", iso: "PB" },
  rajasthan: { gst: "08", iso: "RJ" },
  sikkim: { gst: "11", iso: "SK" },
  tamil_nadu: { gst: "33", iso: "TN" },
  telangana: { gst: "36", iso: "TG" },
  tripura: { gst: "16", iso: "TR" },
  uttar_pradesh: { gst: "09", iso: "UP" },
  uttarakhand: { gst: "05", iso: "UT" },
  west_bengal: { gst: "19", iso: "WB" },
  andaman_and_nicobar_islands: { gst: "35", iso: "AN" },
  chandigarh: { gst: "04", iso: "CH" },
  dadra_and_nagar_haveli_and_daman_and_diu: { gst: "26", iso: "DH" },
  delhi: { gst: "07", iso: "DL" },
  jammu_and_kashmir: { gst: "01", iso: "JK" },
  ladakh: { gst: "38", iso: "LA" },
  lakshadweep: { gst: "31", iso: "LD" },
  puducherry: { gst: "34", iso: "PY" },
};

/** True when the GSTIN is well formed and its state code is the registered address state. */
export function gstinMatchesState(gstin: string, state: StateCode): boolean {
  return GSTIN_PATTERN.test(gstin) && gstin.slice(0, 2) === STATE_CODES[state].gst;
}

/** The jurisdiction code (`IN-MH`) the foundation tables use for a state. */
export function jurisdictionCodeFor(state: StateCode): string {
  return `IN-${STATE_CODES[state].iso}`;
}

/** True when the value names a time zone the runtime's IANA database knows. */
export function isIanaTimeZone(value: string): boolean {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
