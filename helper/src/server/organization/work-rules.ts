import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * RL-05 (rest day entitlement resolution) and RL-26 (daily wage payment basis).
 *
 * The workbook resolves rest-day applicability, rest-day pattern, wage basis and OT
 * eligibility in one order: the value on the employee record, then the employment
 * sub-category default, then the employment category default. The first non-empty value
 * wins, field by field — a sub-category that states only a rest-day pattern still inherits
 * its category's wage basis.
 *
 * All three levels read tenant CONFIGURATION, never code:
 *   employee      `employee_assignments.attributes.override*` (FRM-PPL-02)
 *   sub-category  `employments.attributes.workerSubCategoryId` -> a worker category row
 *   category      `employments.worker_category_id`             -> a worker category row
 *
 * That is what makes T-07 hold: a third-party Employee and a third-party Helper are two
 * worker-category rows under one category, so telling them apart is a configuration change,
 * not a new value in any union or CHECK constraint.
 *
 * A worker category's policy is published through the `worker-categories` operational
 * register (`hrms_operation_records`), which carries `restDayPattern`, `wageType` and
 * `otEligibility`. The `worker_categories` row employment points at is the link; where it
 * carries the same keys itself they are used, so a tenant that has not published through
 * the register still resolves.
 */

/** The employment categories `employees.category` accepts (the column's CHECK constraint). */
export const EMPLOYEE_CATEGORIES = [
  "regular",
  "contract",
  "third-party-employee",
  "third-party-helper",
  "trainee",
] as const;
export type EmployeeCategoryCode = (typeof EMPLOYEE_CATEGORIES)[number];

/** The level a resolved value came from; `unresolved` means no level stated one. */
export type WorkRuleLevel = "employee" | "sub_category" | "category" | "unresolved";

export type WorkRulePolicy = {
  /** False only where the resolved pattern is explicitly "none". */
  hasRestDays: boolean | null;
  /** The tenant's own pattern code, carried through rather than re-spelled. */
  restDayPattern: string | null;
  /** The tenant's own wage type code. RL-26 keys on the value "daily". */
  wageType: string | null;
  otEligibility: string | null;
};

export type ResolvedWorkRules = WorkRulePolicy & {
  /** RL-26: payroll pays on days present rather than a monthly salary. */
  paysOnDaysPresent: boolean | null;
  source: Record<keyof WorkRulePolicy, WorkRuleLevel>;
  categoryCode: string | null;
  subCategoryCode: string | null;
  /** Fields no level supplied. A caller that needs one of these must refuse, not assume. */
  unresolved: Array<keyof WorkRulePolicy>;
};

type PartialPolicy = Partial<Record<keyof WorkRulePolicy, unknown>>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * The work-rule slice of a worker category's configuration, from either store's key names.
 * `hasRestDays` is derived from the pattern because "none" is precisely the statement that
 * there is no rest day; it is not a second setting that could disagree with the first.
 */
export function policyFromCategoryConfig(data: unknown): PartialPolicy {
  if (typeof data !== "object" || data === null) return {};
  const record = data as Record<string, unknown>;
  const pattern = text(record.restDayPattern);
  return {
    restDayPattern: pattern,
    hasRestDays: pattern === null ? null : pattern !== "none",
    wageType: text(record.wageType),
    otEligibility: text(record.otEligibility),
  };
}

/** The work-rule slice of an assignment's per-employee overrides (FRM-PPL-02). */
export function policyFromAssignmentOverrides(attributes: unknown): PartialPolicy {
  if (typeof attributes !== "object" || attributes === null) return {};
  const record = attributes as Record<string, unknown>;
  const pattern = text(record.overrideRestDayPattern);
  return {
    restDayPattern: pattern,
    // An explicit override wins over the pattern it sits beside; otherwise the pattern says it.
    hasRestDays: typeof record.overrideHasRestDays === "boolean"
      ? record.overrideHasRestDays
      : pattern === null ? null : pattern !== "none",
    wageType: text(record.overrideWageType),
    otEligibility: text(record.overrideOtEligibility),
  };
}

/**
 * RL-05's rest-day applicability from the configured pattern. `none` is the only value
 * both pattern vocabularies share, so it is the only one this compares; null means no
 * level stated a pattern and the caller must not assume either way.
 */
export function hasRestDaysFromPattern(pattern: string | null | undefined): boolean | null {
  const value = text(pattern);
  return value === null ? null : value !== "none";
}

const POLICY_FIELDS = ["hasRestDays", "restDayPattern", "wageType", "otEligibility"] as const;

/**
 * RL-05's resolution order, as a pure function so the rule is identical whether it runs on
 * an employee screen, in payroll input, or in a test.
 */
export function resolveWorkRules(levels: {
  employee?: PartialPolicy;
  subCategory?: PartialPolicy;
  category?: PartialPolicy;
  categoryCode?: string | null;
  subCategoryCode?: string | null;
}): ResolvedWorkRules {
  const ordered: Array<[WorkRuleLevel, PartialPolicy]> = [
    ["employee", levels.employee ?? {}],
    ["sub_category", levels.subCategory ?? {}],
    ["category", levels.category ?? {}],
  ];
  const resolved = {} as WorkRulePolicy;
  const source = {} as Record<keyof WorkRulePolicy, WorkRuleLevel>;
  const unresolved: Array<keyof WorkRulePolicy> = [];
  for (const field of POLICY_FIELDS) {
    const hit = ordered.find(([, policy]) => policy[field] !== undefined && policy[field] !== null);
    if (hit) {
      (resolved[field] as unknown) = hit[1][field];
      source[field] = hit[0];
    } else {
      (resolved[field] as unknown) = null;
      source[field] = "unresolved";
      unresolved.push(field);
    }
  }
  return {
    ...resolved,
    paysOnDaysPresent: resolved.wageType === null ? null : resolved.wageType === "daily",
    source,
    categoryCode: levels.categoryCode ?? null,
    subCategoryCode: levels.subCategoryCode ?? null,
    unresolved,
  };
}

/**
 * Q-14 is unanswered: the source says contractual employees have no rest days and are paid
 * daily wages, but never says whether a rest day they do work attracts overtime or a normal
 * day's wage. Rather than pick one, this refuses in the house style of
 * `src/server/payroll/rule-pack.ts` — an unapproved rule throws instead of defaulting.
 */
export function restDayWorkedTreatment(rules: ResolvedWorkRules): never {
  throw new HttpError({
    status: 422,
    code: "RULE_PACK_INCOMPLETE",
    message:
      `Open question Q-14: how a rest day worked by a ${rules.wageType ?? "daily"}-wage employee is paid ` +
      "(overtime or a normal day's wage) has not been decided. Record the decision on the leave and OT scheme before running this.",
    details: [{ field: "wageType", issue: "Q-14 (R-03) is unanswered." }],
  });
}

type LevelRow = {
  category_policy: unknown;
  category_code: string | null;
  sub_policy: unknown;
  sub_code: string | null;
  assignment_attributes: unknown;
  employee_category: string | null;
  fallback_policy: unknown;
};

/**
 * The three levels for one employee, read together so the resolution order is applied once.
 *
 * Where the employee has no employment record at all, `employees.category` still names an
 * employment category, so the register row whose `code` matches it stands in as the category
 * level. That keeps a directly-created employee resolvable without inventing a policy.
 */
export async function getEmployeeWorkRules(access: Access, employeeId: string): Promise<ResolvedWorkRules> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select
         category.policy as category_policy, category.code as category_code,
         sub.policy as sub_policy, sub.code as sub_code,
         assignment.attributes as assignment_attributes,
         e.category as employee_category,
         fallback.data as fallback_policy
       from employees e
       left join lateral (
         select em.id, em.worker_category_id, em.attributes from employments em
         where em.tenant_id = e.tenant_id and em.employee_id = e.id
         order by em.created_at desc limit 1
       ) employment on true
       left join lateral (
         select a.attributes from employee_assignments a
         where a.tenant_id = e.tenant_id and a.employment_id = employment.id and a.record_status = 'active'
         order by coalesce(a.attributes->>'effectiveFrom', '') desc, a.created_at desc limit 1
       ) assignment on true
       left join lateral (
         select coalesce(published.data, wc.attributes) as policy, wc.attributes->>'code' as code
         from worker_categories wc
         left join lateral (
           select op.data from hrms_operation_records op
           where op.tenant_id = wc.tenant_id and op.resource = 'worker-categories'
             and op.data->>'code' = wc.attributes->>'code' and op.status in ('published', 'approved')
           order by case op.status when 'published' then 0 else 1 end, op.updated_at desc limit 1
         ) published on true
         where wc.tenant_id = e.tenant_id and wc.id = employment.worker_category_id limit 1
       ) category on true
       left join lateral (
         select coalesce(published.data, wc.attributes) as policy, wc.attributes->>'code' as code
         from worker_categories wc
         left join lateral (
           select op.data from hrms_operation_records op
           where op.tenant_id = wc.tenant_id and op.resource = 'worker-categories'
             and op.data->>'code' = wc.attributes->>'code' and op.status in ('published', 'approved')
           order by case op.status when 'published' then 0 else 1 end, op.updated_at desc limit 1
         ) published on true
         where wc.tenant_id = e.tenant_id and wc.id = (employment.attributes->>'workerSubCategoryId')::uuid limit 1
       ) sub on true
       left join lateral (
         select op.data from hrms_operation_records op
         where op.tenant_id = e.tenant_id and op.resource = 'worker-categories'
           and op.data->>'code' = e.category and op.status in ('published', 'approved')
         order by case op.status when 'published' then 0 else 1 end, op.updated_at desc limit 1
       ) fallback on true
       where e.tenant_id = $1::uuid and e.id = $2::uuid limit 1`,
      [access.tenantId, employeeId],
    ),
  ]);
  const row = (rows as LevelRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const categoryPolicy = row.category_policy ?? row.fallback_policy;
  return resolveWorkRules({
    employee: policyFromAssignmentOverrides(row.assignment_attributes),
    subCategory: policyFromCategoryConfig(row.sub_policy),
    category: policyFromCategoryConfig(categoryPolicy),
    categoryCode: row.category_code ?? row.employee_category,
    subCategoryCode: row.sub_code,
  });
}
