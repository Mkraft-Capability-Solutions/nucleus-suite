/**
 * Intra-group employment movements (employment_movement_logs, db/migrations/0039). Shared by the
 * server (validation, API payload) and the People UI. Pure functions only: no database, no React.
 */
import { z } from "zod";
import type { MovementType as CareerMovementType } from "@/lib/career";

export const EMPLOYMENT_MOVEMENT_TYPES = ["HIRE", "INTER_COMPANY_TRANSFER", "PROMOTION", "ROLE_CHANGE", "CORPORATE_DEPUTATION"] as const;
export type EmploymentMovementType = (typeof EMPLOYMENT_MOVEMENT_TYPES)[number];

/** English fallbacks; the UI passes them to t(key, fallback). */
export const EMPLOYMENT_MOVEMENT_LABELS: Record<EmploymentMovementType, string> = {
  HIRE: "Hire",
  INTER_COMPANY_TRANSFER: "Inter-company transfer",
  PROMOTION: "Promotion",
  ROLE_CHANGE: "Role change",
  CORPORATE_DEPUTATION: "Corporate deputation",
};

/** How each movement appears in the career history (employee_job_history, 0031). */
export const CAREER_TYPE_FOR_MOVEMENT: Record<EmploymentMovementType, CareerMovementType> = {
  HIRE: "updated",
  INTER_COMPANY_TRANSFER: "group_transfer",
  PROMOTION: "promotion",
  ROLE_CHANGE: "redesignation",
  CORPORATE_DEPUTATION: "secondment",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

/** Request body of POST /api/v1/employees/:id/movements. Omitted to* fields carry over from the current record. */
export const createMovementSchema = z.object({
  movementType: z.enum(EMPLOYMENT_MOVEMENT_TYPES),
  toCompanyId: z.string().uuid("Choose a company."),
  toDesignation: optionalText(120),
  toDepartment: optionalText(80),
  toCurrency: z.string().trim().regex(/^[A-Z]{3}$/, "Use a three-letter currency code such as INR.").nullable().optional(),
  effectiveDate: z.string().regex(DATE, "Use a date like 2025-04-01."),
  remarks: z.string().trim().max(1000).nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
}).strict();
export type CreateMovementInput = z.infer<typeof createMovementSchema>;

export type CurrentPosition = { companyId: string | null; designation: string | null; department: string | null; currency: string | null };

export type MovementRule = { field: string; issue: string };

/** Business rules a movement must satisfy before it is written. Returns field issues (empty = valid). */
export function movementIssues(input: CreateMovementInput, current: CurrentPosition, ctx: { hasHire: boolean; today: string; joiningDate: string | null }): MovementRule[] {
  const issues: MovementRule[] = [];
  const toDesignation = input.toDesignation === undefined ? current.designation : input.toDesignation;
  const toDepartment = input.toDepartment === undefined ? current.department : input.toDepartment;
  if (ctx.joiningDate && input.effectiveDate < ctx.joiningDate) issues.push({ field: "effectiveDate", issue: `The date is before the employee joined (${ctx.joiningDate}).` });
  switch (input.movementType) {
    case "HIRE":
      if (ctx.hasHire) issues.push({ field: "movementType", issue: "A hire is already recorded for this employee." });
      break;
    case "INTER_COMPANY_TRANSFER":
      if (!current.companyId) issues.push({ field: "movementType", issue: "The employee has no current company; record a hire first." });
      else if (input.toCompanyId === current.companyId) issues.push({ field: "toCompanyId", issue: "Choose a different company for an inter-company transfer." });
      break;
    case "PROMOTION":
      if (!toDesignation || toDesignation === current.designation) issues.push({ field: "toDesignation", issue: "A promotion needs a new designation." });
      break;
    case "ROLE_CHANGE":
      if (toDesignation === current.designation && toDepartment === current.department) issues.push({ field: "toDesignation", issue: "Change the designation or the department." });
      break;
    case "CORPORATE_DEPUTATION":
      if (input.toCompanyId === current.companyId) issues.push({ field: "toCompanyId", issue: "A deputation is to another company in the group." });
      break;
  }
  return issues;
}

export type MovementCompany = { id: string; name: string; code: string | null; industry: string | null };

export type MovementRecord = {
  id: string;
  movementType: EmploymentMovementType;
  effectiveDate: string;
  fromCompany: MovementCompany | null;
  toCompany: MovementCompany;
  fromDesignation: string | null;
  toDesignation: string | null;
  fromDepartment: string | null;
  toDepartment: string | null;
  fromCurrency: string | null;
  toCurrency: string | null;
  remarks: string | null;
  approvedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  rootGroupId: string | null;
  /** scheduled = effective date still ahead; the record is applied on that date. */
  status: "applied" | "scheduled";
  /** Days from this movement until the next applied one (or today). Null while scheduled. */
  tenureDays: number | null;
  industryChanged: boolean;
  designationChanged: boolean;
};

export type MovementEmployee = { id: string; name: string; companyId: string | null; designation: string | null; department: string | null; currency: string | null; joiningDate: string | null };
export type MovementList = { employee: MovementEmployee; items: MovementRecord[]; total: number; page: number; pageSize: number; today: string; canRecord: boolean; hasHire: boolean };

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

/** Adds status, tenure and transition flags to rows sorted chronologically (oldest first). */
export function withTenure(rows: Array<Omit<MovementRecord, "status" | "tenureDays" | "industryChanged" | "designationChanged">>, today: string): MovementRecord[] {
  const applied = rows.filter((row) => row.effectiveDate <= today);
  return rows.map((row) => {
    const status = row.effectiveDate <= today ? "applied" : "scheduled";
    let tenureDays: number | null = null;
    if (status === "applied") {
      const next = applied.find((other) => other.effectiveDate > row.effectiveDate || (other.effectiveDate === row.effectiveDate && other.createdAt > row.createdAt));
      tenureDays = Math.max(0, dayNumber(next ? next.effectiveDate : today) - dayNumber(row.effectiveDate));
    }
    const fromIndustry = row.fromCompany?.industry ?? null;
    return {
      ...row,
      status,
      tenureDays,
      industryChanged: Boolean(row.fromCompany) && fromIndustry !== (row.toCompany.industry ?? null),
      designationChanged: (row.fromDesignation ?? null) !== (row.toDesignation ?? null),
    };
  });
}

/** "2 y 3 m", "5 m", "12 d" from a number of days. */
export function tenureLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 31) return `${days} d`;
  const months = Math.floor(days / 30.4375);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years ? (rest ? `${years} y ${rest} m` : `${years} y`) : `${rest} m`;
}

/** Root of a company tree (the group's top company) by following parent links. */
export function rootCompanyOf(companyId: string, parents: Map<string, string | null>): string {
  let cursor = companyId;
  for (let step = 0; step < 50; step += 1) {
    const parent = parents.get(cursor) ?? null;
    if (!parent) return cursor;
    cursor = parent;
  }
  return cursor;
}

export const PEOPLE_CHANGED_EVENT = "nucleus:people-changed";
export type PeopleChangedDetail = { employeeId: string; kind: string };
