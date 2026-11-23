import type { Translate } from "../onboarding/api";
import { ALL_FIELDS, ROW_GROUPS, rowIsBlank, type FieldDef, type FormValues, type RowGroupId, type Rows, type SectionId } from "./fields";

/**
 * Client validation for FRM-PPL-01. It mirrors the server: `createPersonSchema` /
 * `updatePersonSchema` (name, designation, department and location lengths, the first-name
 * pattern, ISO dates, email) and `applyPersonProfileRules` (marriage date and spouse once
 * married, marriage at least 18 years after birth, disability type and percentage,
 * one highest qualification, experience from <= to), plus the statutory formats the
 * workbook states. The server stays authoritative and its field errors are mapped back.
 */

const NS = "components.Workspace.EmployeeCreationWizard";

const FORMATS = {
  phone: /^[6-9]\d{9}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  aadhaar: /^\d{12}$/,
  uan: /^\d{12}$/,
  esiIp: /^\d{17}$/,
  pin: /^\d{6}$/,
  digits: /^\d+$/,
  personName: /^[\p{L}][\p{L} .'-]*$/u,
} as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MARRIAGE_MIN_AGE_YEARS = 18;

export type Issue = { key: string; section: SectionId | RowGroupId; message: string };
export type Status = { missing: Issue[]; invalid: Issue[]; filled: number; total: number; requiredTotal: number };
export type ManagerValue = { id: string } | null;

function isEmpty(field: FieldDef, value: unknown): boolean {
  if (field.type === "bool") return false;
  return value === undefined || value === null || String(value).trim() === "";
}

export function isRequired(field: FieldDef, values: FormValues): boolean {
  if (field.visibleWhen && !field.visibleWhen(values)) return false;
  return Boolean(field.required || field.requiredWhen?.(values));
}

function validIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addYears(iso: string, years: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

/** The error for one field, or "" when it is valid (or empty and optional). */
export function fieldError(field: FieldDef, values: FormValues, t: Translate, today: string, manager: ManagerValue = null): string {
  if (field.visibleWhen && !field.visibleWhen(values)) return "";
  const raw = values[field.key];
  if (field.type === "employee") {
    return isRequired(field, values) && !manager ? t(`${NS}.err_required`, "This field is required.") : "";
  }
  if (isEmpty(field, raw)) return isRequired(field, values) ? t(`${NS}.err_required`, "This field is required.") : "";
  if (field.type === "bool") return "";
  const value = String(raw).trim();

  if (field.minLength && value.length < field.minLength) return t(`${NS}.err_min_length`, "Enter at least {min} characters.", { min: field.minLength });
  if (field.maxLength && value.length > field.maxLength) return t(`${NS}.err_max_length`, "Keep this to {max} characters or fewer.", { max: field.maxLength });

  switch (field.format) {
    case "phone": if (!FORMATS.phone.test(value)) return t(`${NS}.err_phone`, "Enter a 10-digit Indian mobile number starting with 6 to 9."); break;
    case "pan": if (!FORMATS.pan.test(value)) return t(`${NS}.err_pan`, "Use the PAN format AAAAA9999A."); break;
    case "ifsc": if (!FORMATS.ifsc.test(value)) return t(`${NS}.err_ifsc`, "Use the 11-character IFSC format, like ABCD0123456."); break;
    case "aadhaar": if (!FORMATS.aadhaar.test(value)) return t(`${NS}.err_aadhaar`, "Aadhaar is 12 digits."); break;
    case "uan": if (!FORMATS.uan.test(value)) return t(`${NS}.err_uan`, "UAN is 12 digits."); break;
    case "esiIp": if (!FORMATS.esiIp.test(value)) return t(`${NS}.err_esi`, "The ESI IP number is 17 digits."); break;
    case "pin": if (!FORMATS.pin.test(value)) return t(`${NS}.err_pin`, "The PIN code is 6 digits."); break;
    case "digits": if (!FORMATS.digits.test(value)) return t(`${NS}.err_digits`, "Use digits only."); break;
    case "personName": if (!FORMATS.personName.test(value)) return t(`${NS}.err_person_name`, "Use letters, spaces, dot, apostrophe and hyphen only."); break;
    default: break;
  }

  if (field.type === "email" && !EMAIL.test(value)) return t(`${NS}.err_email`, "Enter an email like name@company.com.");
  if (field.type === "number") {
    const number = Number(value);
    if (Number.isNaN(number)) return t(`${NS}.err_number`, "Enter a number.");
    if ((field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) {
      return t(`${NS}.err_range`, "Enter a value from {min} to {max}.", { min: field.min ?? 0, max: field.max ?? 0 });
    }
  }
  if (field.type === "date") {
    if (!validIsoDate(value)) return t(`${NS}.err_date`, "Enter a valid date.");
    if (field.key === "dateOfBirth") {
      if (value > today) return t(`${NS}.err_dob_future`, "The date of birth cannot be in the future.");
      if (value < "1940-01-01") return t(`${NS}.err_dob_old`, "Check the year of birth.");
    }
    if (field.key === "joiningDate" && typeof values.dateOfBirth === "string" && validIsoDate(values.dateOfBirth) && value < values.dateOfBirth) {
      return t(`${NS}.err_joining_before_dob`, "The joining date is before the date of birth.");
    }
    if (field.key === "marriageDate" && typeof values.dateOfBirth === "string" && validIsoDate(values.dateOfBirth) && value < addYears(values.dateOfBirth, MARRIAGE_MIN_AGE_YEARS)) {
      return t(`${NS}.err_marriage_age`, "A marriage date cannot precede the date of birth plus {years} years.", { years: MARRIAGE_MIN_AGE_YEARS });
    }
  }
  if (field.key === "accountConfirm" && value !== String(values.accountToken ?? "").trim()) {
    return t(`${NS}.err_account_match`, "The account numbers do not match.");
  }
  return "";
}

/** Errors in the repeating rows, keyed `group.index.field` (group-level errors use `group`). */
export function rowErrors(rows: Rows, t: Translate, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const nextYear = Number(today.slice(0, 4)) + 1;
  rows.experience.forEach((row, index) => {
    if (rowIsBlank(row)) return;
    if (!String(row.employer ?? "").trim()) errors[`experience.${index}.employer`] = t(`${NS}.err_required`, "This field is required.");
    const from = String(row.fromDate ?? ""); const to = String(row.toDate ?? "");
    if (from && to && from > to) errors[`experience.${index}.toDate`] = t(`${NS}.err_from_to`, "The from date must precede the to date.");
    if (to && to > today) errors[`experience.${index}.toDate`] = t(`${NS}.err_future`, "This date cannot be in the future.");
  });
  rows.education.forEach((row, index) => {
    if (rowIsBlank(row)) return;
    const year = String(row.passingYear ?? "").trim();
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1950 || Number(year) > nextYear)) {
      errors[`education.${index}.passingYear`] = t(`${NS}.err_year`, "Enter a year from 1950 to {max}.", { max: nextYear });
    }
  });
  if (rows.education.filter((row) => !rowIsBlank(row) && row.isHighest === true).length > 1) {
    errors.education = t(`${NS}.err_highest`, "Flag exactly one qualification as the highest.");
  }
  const shareByScheme = new Map<string, number>();
  rows.nominees.forEach((row, index) => {
    if (rowIsBlank(row)) return;
    if (!String(row.name ?? "").trim()) errors[`nominees.${index}.name`] = t(`${NS}.err_required`, "This field is required.");
    const share = Number(row.sharePercent);
    if (String(row.sharePercent ?? "").trim() === "" || Number.isNaN(share) || share <= 0 || share > 100) {
      errors[`nominees.${index}.sharePercent`] = t(`${NS}.err_share`, "Enter a share above 0 and up to 100.");
    } else {
      const scheme = String(row.scheme ?? "");
      shareByScheme.set(scheme, (shareByScheme.get(scheme) ?? 0) + share);
    }
  });
  for (const total of shareByScheme.values()) {
    if (Math.abs(total - 100) > 0.001) errors.nominees = t(`${NS}.err_share_total`, "Nominee shares for each scheme must add up to 100%.");
  }
  rows.dependants.forEach((row, index) => {
    if (!rowIsBlank(row) && !String(row.name ?? "").trim()) errors[`dependants.${index}.name`] = t(`${NS}.err_required`, "This field is required.");
  });
  return errors;
}

/** Progress for the review queue and the submit summary. */
export function formStatus(values: FormValues, rows: Rows, manager: ManagerValue, t: Translate, today: string): Status {
  const missing: Issue[] = [];
  const invalid: Issue[] = [];
  let filled = 0;
  let total = 0;
  let requiredTotal = 0;
  for (const field of ALL_FIELDS) {
    if (field.visibleWhen && !field.visibleWhen(values)) continue;
    total += 1;
    const required = isRequired(field, values);
    if (required) requiredTotal += 1;
    const empty = field.type === "employee" ? !manager : isEmpty(field, values[field.key]);
    if (!empty && field.type !== "bool") filled += 1;
    if (field.type === "bool" && values[field.key] === true) filled += 1;
    const message = fieldError(field, values, t, today, manager);
    if (!message) continue;
    if (empty && required) missing.push({ key: field.key, section: field.section, message });
    else invalid.push({ key: field.key, section: field.section, message });
  }
  for (const [key, message] of Object.entries(rowErrors(rows, t, today))) {
    invalid.push({ key, section: key.split(".")[0] as RowGroupId, message });
  }
  return { missing, invalid, filled, total, requiredTotal };
}

export const ROW_GROUP_IDS: readonly RowGroupId[] = ROW_GROUPS.map((group) => group.id);
