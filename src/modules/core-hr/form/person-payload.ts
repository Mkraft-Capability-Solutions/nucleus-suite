/**
 * Builds the POST/PATCH /api/v1/people body from the employee form values. It mirrors the classic
 * wizard's payload (PeopleCoreView onSave) field for field, so a record saved from either interface
 * reads the same, with two differences:
 *   - no invented fallbacks: the classic payload filled a missing work email with
 *     "<code>@nucleus.com" and missing job fields with "Associate"/"General"/"Head Office";
 *   - the reporting manager is sent as `managerEmployeeId` (the employee's id) as well as by name.
 */

import { toMinorUnits } from "@/lib/currencies";

export type FormValues = Record<string, unknown>;

const text = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
};

/** Rows of a repeating group that have at least one filled value. */
export function filledRows(rows: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is Record<string, unknown> =>
    Boolean(row) && typeof row === "object" && Object.entries(row as Record<string, unknown>).some(([key, value]) => key !== "insured" && key !== "sharePercent" && key !== "scheme" && text(value) !== undefined));
}

export function buildPersonPayload(values: FormValues, manager: { id: string; name: string } | null): Record<string, unknown> {
  const education = filledRows(values.education).map((row, index) => ({
    ...row,
    isHighest: row.isHighest !== undefined ? row.isHighest : index === 0,
    yearOfPassing: row.yearOfPassing || row.passingYear || undefined,
  }));
  const details: Record<string, unknown> = {
    ...values,
    accountConfirm: undefined,
    manager: manager?.name ?? text(values.manager),
    education,
    experience: filledRows(values.experience),
    dependants: filledRows(values.dependants),
    nominees: filledRows(values.nominees),
    fullLegalName: [text(values.firstName), text(values.middleName), text(values.lastName)].filter(Boolean).join(" "),
  };
  delete details.accountConfirm;
  // Pay is sent in its own fields below and stored in its own columns, never in the profile.
  delete details.basicSalary;
  delete details.salaryCurrency;
  delete details.salaryMasked;
  const currency = text(values.salaryCurrency);
  const salaryMinor = currency && text(values.basicSalary) ? toMinorUnits(text(values.basicSalary), currency) : null;

  const aadhaar = text(values.aadhaarToken);
  const payload: Record<string, unknown> = {
    ...details,
    employeeCode: text(values.employeeCode),
    firstName: text(values.firstName),
    lastName: text(values.lastName),
    workEmail: text(values.officialEmail),
    designation: text(values.designation),
    department: text(values.department),
    location: text(values.location),
    joiningDate: text(values.joiningDate),
    managerEmployeeId: manager?.id,
    workerCategory: text(values.workerCategory),
    hasRestDays: values.hasRestDays ?? true,
    otEligibility: text(values.otEligibility),
    salaryLocationScope: text(values.salaryLocationScope),
    isTrainee: String(values.workerCategory ?? "").startsWith("TRAINEE"),
    assignedShift: text(values.assignedShift),
    panNumber: text(values.panToken),
    panToken: text(values.panToken),
    aadhaarLast4: aadhaar ? aadhaar.slice(-4) : undefined,
    aadhaarToken: aadhaar,
    uan: text(values.uan),
    esicNumber: text(values.esiIp),
    bankAccountNo: text(values.accountToken),
    bankIfsc: text(values.ifsc)?.toUpperCase(),
    bankName: text(values.bankName),
    emergencyContactName: text(values.emergencyName),
    emergencyContactPhone: text(values.emergencyPhone),
    emergencyContactRelation: text(values.emergencyRelation),
    biometricEnrolId: text(values.biometricEnrolId),
    accessCardNo: text(values.accessCardNo),
    lockerNo: text(values.lockerNo),
    basicSalary: undefined,
    salaryCurrency: undefined,
    salaryMasked: undefined,
    basicSalaryMinor: salaryMinor ?? undefined,
    currency,
    details: { ...details, employeeCode: text(values.employeeCode) },
  };
  // The API rejects empty strings for optional fields: drop them, keep false and 0.
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

/** Suggests the next code in the organisation's EMP-00000 series, as the classic wizard did. */
export function suggestEmployeeCode(existingCodes: string[]): string {
  const numbers = existingCodes.map((code) => Number(/(\d+)$/.exec(code ?? "")?.[1] ?? 0)).filter((value) => Number.isFinite(value));
  const next = (numbers.length ? Math.max(10000, ...numbers) : 10000) + 1;
  return `EMP-${String(next).padStart(5, "0")}`;
}

/** Form values for editing an existing record: the stored profile (metadata) over the record's columns. */
export function valuesFromRecord(record: {
  employeeCode: string; firstName: string; lastName: string; workEmail: string | null; designation: string | null; department: string | null;
  location: string | null; status: string | null; joiningDate: string | null; metadata: Record<string, unknown>;
  basicSalary?: { amount: string; currency: string } | null; salaryMasked?: boolean; currency?: string;
}, base: FormValues): FormValues {
  const meta = record.metadata ?? {};
  const fromMeta = Object.fromEntries(Object.entries(meta).filter(([key]) => key in base || ["education", "experience", "dependants", "nominees"].includes(key)));
  return {
    ...base,
    ...fromMeta,
    employeeCode: record.employeeCode,
    firstName: record.firstName ?? meta.firstName ?? "",
    lastName: record.lastName ?? meta.lastName ?? "",
    officialEmail: record.workEmail ?? meta.officialEmail ?? "",
    designation: record.designation ?? "",
    department: record.department ?? "",
    location: record.location ?? "",
    joiningDate: (record.joiningDate ?? "").slice(0, 10),
    status: meta.status ?? (record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : base.status),
    accountConfirm: meta.accountToken ?? meta.bankAccountNo ?? "",
    accountToken: meta.accountToken ?? meta.bankAccountNo ?? "",
    panToken: meta.panToken ?? meta.panNumber ?? "",
    ifsc: meta.ifsc ?? meta.bankIfsc ?? "",
    esiIp: meta.esiIp ?? meta.esicNumber ?? "",
    emergencyName: meta.emergencyName ?? meta.emergencyContactName ?? "",
    emergencyPhone: meta.emergencyPhone ?? meta.emergencyContactPhone ?? "",
    emergencyRelation: meta.emergencyRelation ?? meta.emergencyContactRelation ?? "",
    education: Array.isArray(meta.education) ? meta.education : [],
    experience: Array.isArray(meta.experience) ? meta.experience : [],
    dependants: Array.isArray(meta.dependants) ? meta.dependants : [],
    nominees: Array.isArray(meta.nominees) ? meta.nominees : [],
    // Shown only to those who may read pay; others see it as hidden and can replace it.
    basicSalary: record.basicSalary?.amount ?? "",
    salaryCurrency: record.currency ?? record.basicSalary?.currency ?? base.salaryCurrency,
    salaryMasked: Boolean(record.salaryMasked),
  };
}
