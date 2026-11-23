import { z } from "zod";

/**
 * Employee master contract (currency, visa / expatriate, custom attributes). Shared by the server route
 * (authoritative validation) and the Core HR forms (client validation mirrors it exactly).
 */

export const CUSTOM_FIELD_MODULE = "EMPLOYEE_MASTER" as const;
export const CUSTOM_FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];
export const VISA_ENTRY_TYPES = ["SINGLE", "MULTIPLE"] as const;

const nullableIso = (length: 2 | 3, message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? (value.trim() === "" ? null : value.trim().toUpperCase()) : value),
    z.string().regex(length === 3 ? /^[A-Z]{3}$/ : /^[A-Z]{2}$/, message).nullable(),
  );
const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);
const nullableText = (max: number) => z.preprocess((value) => (typeof value === "string" ? (value.trim() === "" ? null : value.trim()) : value), z.string().max(max).nullable());
const nullableDate = z.preprocess(blankToNull, z.iso.date("Use the format YYYY-MM-DD.").nullable());

export const coreSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  workEmail: z.preprocess(blankToNull, z.email("Enter a valid email address.").max(254).nullable()),
  designation: z.string().trim().min(1).max(160),
  department: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160),
}).partial();

export const currencySchema = z.object({
  baseCurrency: nullableIso(3, "Use a 3-letter ISO 4217 currency code."),
  payrollCurrency: nullableIso(3, "Use a 3-letter ISO 4217 currency code."),
  fxRateOverride: z.preprocess(
    (value) => (value === "" || value === undefined ? null : typeof value === "string" ? Number(value) : value),
    z.number().positive("The exchange rate must be greater than zero.").max(999_999_999_999).nullable(),
  ),
}).partial();

export const visaSchema = z.object({
  isExpatriate: z.boolean(),
  homeCountry: nullableIso(2, "Use a 2-letter ISO 3166 country code."),
  hostCountry: nullableIso(2, "Use a 2-letter ISO 3166 country code."),
  taxResidencyCountry: nullableIso(2, "Use a 2-letter ISO 3166 country code."),
  sponsorEntityId: z.preprocess(blankToNull, z.uuid("Choose a sponsoring legal entity.").nullable()),
  visaType: nullableText(60),
  /** Write-only. Omit to keep the stored number; null clears it. */
  visaNumber: z.preprocess(blankToNull, z.string().trim().min(4, "Enter at least 4 characters.").max(40).regex(/^[A-Za-z0-9-]+$/, "Use letters, digits and hyphens.").nullable()),
  visaIssuingCountry: nullableIso(2, "Use a 2-letter ISO 3166 country code."),
  visaIssueDate: nullableDate,
  visaExpiryDate: nullableDate,
  visaEntryType: z.preprocess(blankToNull, z.enum(VISA_ENTRY_TYPES).nullable()),
  workPermitNumber: nullableText(60),
  workPermitExpiryDate: nullableDate,
}).partial();

export const customValueSchema = z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]);

export const patchEmployeeMasterSchema = z.object({
  version: z.number().int().positive().optional(),
  core: coreSchema.optional(),
  currency: currencySchema.optional(),
  visa: visaSchema.optional(),
  customFields: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,62}$/), customValueSchema).optional(),
}).strict();

export type PatchEmployeeMaster = z.infer<typeof patchEmployeeMasterSchema>;
export type VisaInput = z.infer<typeof visaSchema>;
export type FieldIssue = { field: string; issue: string };

/** Visa state after a patch is merged with what is stored (number presence is tracked separately). */
export type VisaState = {
  isExpatriate: boolean;
  hostCountry: string | null;
  visaType: string | null;
  hasVisaNumber: boolean;
  visaIssuingCountry: string | null;
  visaIssueDate: string | null;
  visaExpiryDate: string | null;
};

/** Cross-field rules. Runs on the merged state so a partial patch cannot leave an expatriate incomplete. */
export function visaRuleIssues(state: VisaState): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (state.visaIssueDate && state.visaExpiryDate && state.visaExpiryDate <= state.visaIssueDate) {
    issues.push({ field: "visa.visaExpiryDate", issue: "The expiry date must be after the issue date." });
  }
  if (state.isExpatriate) {
    if (!state.hostCountry) issues.push({ field: "visa.hostCountry", issue: "Host country is required for an expatriate." });
    if (!state.visaType) issues.push({ field: "visa.visaType", issue: "Visa type is required for an expatriate." });
    if (!state.hasVisaNumber) issues.push({ field: "visa.visaNumber", issue: "Visa number is required for an expatriate." });
    if (!state.visaIssuingCountry) issues.push({ field: "visa.visaIssuingCountry", issue: "Issuing country is required for an expatriate." });
    if (!state.visaExpiryDate) issues.push({ field: "visa.visaExpiryDate", issue: "Visa expiry date is required for an expatriate." });
  }
  return issues;
}

export type CustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: string[];
  sortOrder: number;
};

export type CustomFieldValue = string | number | boolean | null;

/** Validate one custom value against its definition and return the typed value (or an issue). */
export function coerceCustomValue(definition: CustomFieldDefinition, raw: CustomFieldValue): { value: CustomFieldValue } | { issue: string } {
  const empty = raw === null || (typeof raw === "string" && raw.trim() === "");
  if (empty) return definition.required ? { issue: "This field is required." } : { value: null };
  switch (definition.type) {
    case "TEXT":
      return typeof raw === "string" ? { value: raw.trim() } : { issue: "Enter text." };
    case "NUMBER": {
      const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
      return Number.isFinite(value) ? { value } : { issue: "Enter a number." };
    }
    case "DATE":
      return typeof raw === "string" && z.iso.date().safeParse(raw).success ? { value: raw } : { issue: "Use the format YYYY-MM-DD." };
    case "SELECT":
      return typeof raw === "string" && definition.options.includes(raw) ? { value: raw } : { issue: "Choose one of the listed options." };
    case "BOOLEAN":
      return typeof raw === "boolean" ? { value: raw } : { issue: "Choose yes or no." };
  }
}

/** Response shape of GET /api/v1/employees/:id. */
export type EmployeeMasterView = {
  id: string;
  version: number;
  core: { employeeCode: string; firstName: string; lastName: string; workEmail: string | null; designation: string; department: string; location: string; status: string; joiningDate: string; legalEntityId: string | null };
  currency: { baseCurrency: string | null; payrollCurrency: string | null; fxRateOverride: number | null; legacyCurrency: string };
  visa: {
    isExpatriate: boolean; homeCountry: string | null; hostCountry: string | null; taxResidencyCountry: string | null; sponsorEntityId: string | null;
    visaType: string | null; visaNumber: string | null; visaNumberLast4: string | null; visaNumberMasked: boolean;
    visaIssuingCountry: string | null; visaIssueDate: string | null; visaExpiryDate: string | null; visaEntryType: (typeof VISA_ENTRY_TYPES)[number] | null;
    workPermitNumber: string | null; workPermitExpiryDate: string | null;
  };
  customFields: Array<CustomFieldDefinition & { value: CustomFieldValue }>;
};
