import "server-only";

import { sqlClient } from "@/lib/db";
import { grantsForRoles } from "@/server/access-scopes/data-scope-settings";
import {
  authorize,
  type AuthorizationContext,
  type DataScopeDimension,
  type DataScopeGrant,
} from "@/server/identity/authorization";
import { employeeScope } from "@/server/organization/service";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Plant location scoping — the read model behind the location-scoped workforce screen.
 *
 * The whole point of this module is that **compensation is masked on the server**. A
 * plant-scoped principal may read the operational columns of the plant they run
 * (shift, working days, overtime) and must not receive the pay columns at all: the
 * amounts are never put in the response, so there is nothing for a client to reveal.
 *
 * The decision is not a bespoke rule. It is the repository's own RL-24 mechanism:
 * `AuthorizationContext.dataScopes` — a list of `DataScopeGrant`s resolved in
 * `tenant-context.ts` from `tenant_settings -> 'dataScopes'` for exactly the role codes
 * the caller holds — evaluated by `authorize()` against the record's position on the
 * grant's dimension (`attendance_location` = `employees.location`,
 * `payroll_location` = `employees.payroll_owner`). Two independent gates apply, and
 * both are the platform's, not this file's:
 *
 *   1. the `payroll.rate.read` permission, which `authorize` requires for the
 *      `compensation` field domain (`FIELD_PERMISSION`), and
 *   2. the caller's `canViewSalaryStructure` grant covering that row's location
 *      (`SCOPE_GATED_FIELDS` / `dataScopeAllows`), which fails closed.
 *
 * There is no role name anywhere in this file. A scope is a configured grant on a role
 * code the tenant chose, not a string this code knows about.
 */

const DIMENSION_LABELS: Record<DataScopeDimension, string> = {
  attendance_location: "attendance location (where the person works)",
  payroll_location: "payroll location (where the person is paid)",
};

const PERIOD = /^\d{4}-\d{2}$/;
const ROLE_CODE = /^[A-Za-z0-9_.:-]{1,80}$/;

export type PlantScopeRow = {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  category: string;
  attendanceLocation: string;
  payrollLocation: string;
  shift: string | null;
  workingDays: number;
  overtimeMinutes: number;
  currency: string;
  /** True only when the server actually put the pay figures in this row. */
  payVisible: boolean;
  /** Present only when `payVisible`; omitted entirely otherwise. */
  basicMinor?: number | null;
  grossMinor?: number | null;
  netMinor?: number | null;
  /** Why the pay columns are absent, in words. Null when they are present. */
  maskReason: string | null;
};

export type ViewerScopeGrant = {
  roleCode: string;
  dimension: DataScopeDimension;
  dimensionLabel: string;
  values: string[];
  canViewSalaryStructure: boolean;
  canViewRateStructure: boolean;
};

export type ViewerScope = {
  roleCodes: string[];
  grants: ViewerScopeGrant[];
  /** Whether the caller's roles carry `payroll.rate.read` at all. */
  holdsRatePermission: boolean;
  /** False when the tenant has configured no scope for any role the caller holds. */
  scopeConfigured: boolean;
  /** Whether this caller may re-query the endpoint as a lesser role's scope. */
  canPreviewOtherScopes: boolean;
  /** Role codes that may be previewed. Empty unless `canPreviewOtherScopes`. */
  previewableRoleCodes: string[];
  /** The role currently being previewed, if any. */
  previewRoleCode: string | null;
  /** A plain-language statement of what this viewer's scope grants. */
  statement: string;
};

export type PlantScopeView = {
  location: string | null;
  period: string;
  locations: string[];
  periods: string[];
  rows: PlantScopeRow[];
  viewer: ViewerScope;
  totals: { employees: number; payVisible: number; payMasked: number };
};

type EmployeeScopeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  category: string;
  location: string;
  payroll_owner: string | null;
  basic_salary_minor: string | number | null;
  currency: string | null;
  shift: string | null;
  working_days: number | null;
  overtime_minutes: number | null;
  gross_minor: string | number | null;
  net_minor: string | number | null;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function describeGrants(grants: readonly DataScopeGrant[]): ViewerScopeGrant[] {
  return grants.map((grant) => ({
    roleCode: grant.roleCode,
    dimension: grant.dimension,
    dimensionLabel: DIMENSION_LABELS[grant.dimension],
    values: [...grant.values],
    canViewSalaryStructure: grant.canViewSalaryStructure,
    canViewRateStructure: grant.canViewRateStructure,
  }));
}

/**
 * The sentence shown to the viewer so the masking is explainable rather than mysterious.
 * It states the mechanism, never a role label the product invented.
 */
function scopeStatement(context: AuthorizationContext, grants: readonly DataScopeGrant[]): string {
  const holdsRate = context.permissions.includes("payroll.rate.read");
  if (!holdsRate) {
    return "Your roles do not carry payroll.rate.read, so compensation is withheld for every employee on this screen regardless of location.";
  }
  if (grants.length === 0) {
    return "No data scope is configured for the roles you hold, so RL-24 narrows nothing: you hold payroll.rate.read and therefore see compensation across every location.";
  }
  const salaryGrants = grants.filter((grant) => grant.canViewSalaryStructure);
  if (salaryGrants.length === 0) {
    return `Your roles carry a data scope (${grants.map((grant) => grant.roleCode).join(", ")}) with salary-structure visibility switched off, so compensation is withheld everywhere.`;
  }
  return salaryGrants
    .map(
      (grant) =>
        `Role ${grant.roleCode} is scoped on ${DIMENSION_LABELS[grant.dimension]} and may read compensation for ${
          grant.values.length === 0 ? "no location at all (an empty scope covers nothing, never everything)" : grant.values.join(", ")
        }.`,
    )
    .join(" ");
}

/** Why `authorize` withheld the pay columns for this row, stated in words. */
function maskSentence(
  reasonCode: string,
  grants: readonly DataScopeGrant[],
  payrollLocation: string,
  attendanceLocation: string,
): string {
  if (reasonCode === "FIELD_FORBIDDEN") {
    return "Your roles do not carry payroll.rate.read, the permission that unlocks compensation fields. The server did not send these amounts.";
  }
  if (reasonCode === "SCOPE_FORBIDDEN") {
    const covered = grants
      .filter((grant) => grant.canViewSalaryStructure)
      .map((grant) => `${DIMENSION_LABELS[grant.dimension]}: ${grant.values.length === 0 ? "nothing" : grant.values.join(", ")}`)
      .join("; ");
    return `This employee works at ${attendanceLocation} and is paid from ${payrollLocation}, which your data scope does not cover${
      covered ? ` (it covers ${covered})` : ""
    }. The server did not send these amounts.`;
  }
  return "Your roles are not permitted to read compensation here. The server did not send these amounts.";
}

/**
 * A narrower context for previewing another role's scope.
 *
 * Two properties make this safe rather than theatre. First, building it needs
 * `membership.manage` — the same permission that governs Role & Data Scope Setup, so an
 * ordinary plant user cannot ask to be someone else. Second, the preview's permission set
 * is intersected with the caller's own, and the final per-row decision is the AND of the
 * real decision and the preview decision, so a preview can only ever take access away.
 */
async function previewContext(access: Access, roleCode: string): Promise<AuthorizationContext> {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  if (!ROLE_CODE.test(roleCode)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid role reference.", details: [{ field: "previewRole", issue: "Unrecognised role code." }] });
  }
  const [roleRows, settingRows] = await tenantTx(access, [
    sqlClient`
      select r.code,
        coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys
      from roles r
      left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = r.tenant_id
      left join permissions p on p.id = rp.permission_id and p.status = 'active'
      where r.tenant_id = ${access.tenantId} and r.code = ${roleCode} and r.status = 'active'
      group by r.code
      limit 1
    `,
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const role = (roleRows as Array<{ code: string; permission_keys: string[] | null }>)[0];
  if (!role) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested role was not found." });
  }
  const own = new Set(access.context.permissions);
  const settings = (settingRows as Array<{ settings: unknown }>)[0]?.settings;
  return {
    ...access.context,
    roles: [role.code],
    // Intersected with the caller's own permissions: a preview narrows, never widens.
    permissions: (role.permission_keys ?? []).filter((permission) => own.has(permission)),
    dataScopes: grantsForRoles(settings, [role.code]),
  };
}

/** Role codes an admin may preview: every active role the tenant has configured a scope for. */
async function previewableRoles(access: Access): Promise<string[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select code from roles where tenant_id = ${access.tenantId} and status = 'active' order by code asc limit 200`,
  ]);
  return (rows as Array<{ code: string }>).map((row) => row.code);
}

/**
 * One plant's workforce for one period, with the pay columns present only where the
 * caller's permission AND data scope both allow them.
 */
export async function listPlantScopedWorkforce(
  access: Access,
  args: { location?: string | null; period?: string | null; previewRole?: string | null },
): Promise<PlantScopeView> {
  // Entry gate: this is a workforce register, so it needs the employee read permission.
  // Compensation is a separate, per-row decision below.
  enforce(access.context, "employee.read", { tenantId: access.tenantId });

  const period = args.period && PERIOD.test(args.period) ? args.period : new Date().toISOString().slice(0, 7);
  if (args.period && !PERIOD.test(args.period)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A period must be YYYY-MM.", details: [{ field: "period", issue: "Expected YYYY-MM." }] });
  }
  const location = args.location && args.location.trim().length > 0 ? args.location.trim().slice(0, 80) : null;

  const canPreview = authorize(access.context, { action: "membership.manage", resource: { tenantId: access.tenantId } }).allowed;
  const previewRole = args.previewRole && args.previewRole.trim().length > 0 ? args.previewRole.trim() : null;
  if (previewRole && !canPreview) {
    throw new HttpError({
      status: 403,
      code: "FORBIDDEN",
      message: "Previewing another role's data scope requires the membership.manage permission.",
    });
  }
  const preview = previewRole ? await previewContext(access, previewRole) : null;

  const [locationRows, periodRows, employeeRows] = await tenantTx(access, [
    sqlClient`select distinct location from employees where tenant_id = ${access.tenantId} order by location asc limit 200`,
    sqlClient`select distinct period from payroll_runs where tenant_id = ${access.tenantId} order by period desc limit 24`,
    sqlClient`
      select e.id, e.employee_code, e.first_name, e.last_name, e.designation, e.department, e.category,
             e.location, e.payroll_owner, e.basic_salary_minor, e.currency,
             attendance.shift, attendance.working_days, attendance.overtime_minutes,
             pay.gross_minor, pay.net_minor
      from employees e
      left join lateral (
        select mode() within group (order by d.assigned_shift) as shift,
               count(*) filter (where d.status in ('present', 'half_day'))::int as working_days,
               coalesce(sum(d.payable_ot_minutes), 0)::int as overtime_minutes
        from attendance_days d
        where d.tenant_id = e.tenant_id and d.employee_id = e.id
          and to_char(d.attendance_date, 'YYYY-MM') = ${period}
      ) attendance on true
      left join lateral (
        select (member.attributes->>'gross_minor')::bigint as gross_minor,
               (member.attributes->>'net_minor')::bigint as net_minor
        from payroll_run_employees member
        join payroll_runs run on run.tenant_id = member.tenant_id and run.id = member.payroll_run_id
        where member.tenant_id = e.tenant_id and member.employee_id = e.id and run.period = ${period}
        order by run.created_at desc
        limit 1
      ) pay on true
      where e.tenant_id = ${access.tenantId}
        and (${location}::text is null or e.location = ${location}::text)
      order by e.employee_code asc
      limit 200
    `,
  ]);

  const grants = access.context.dataScopes ?? [];
  const previewGrants = preview?.dataScopes ?? [];

  const rows = (employeeRows as EmployeeScopeRow[]).map((row): PlantScopeRow => {
    const scope = employeeScope(row);
    const payrollLocation = scope.payroll_location;
    const base = {
      employeeId: row.id,
      employeeCode: row.employee_code,
      name: [row.first_name, row.last_name].filter((part) => typeof part === "string" && part.trim() !== "").join(" ").trim() || row.employee_code,
      designation: row.designation,
      department: row.department,
      category: row.category,
      attendanceLocation: row.location,
      payrollLocation,
      shift: row.shift,
      workingDays: toNumber(row.working_days),
      overtimeMinutes: toNumber(row.overtime_minutes),
      currency: row.currency ?? "INR",
    };

    const request = {
      action: "employee.read",
      resource: { tenantId: access.tenantId, scope },
      requestedFields: ["compensation"],
    } as const;
    const real = authorize(access.context, request);
    const previewed = preview ? authorize(preview, request) : null;

    if (!real.allowed) {
      return { ...base, payVisible: false, maskReason: maskSentence(real.reasonCode, grants, payrollLocation, row.location) };
    }
    if (previewed && !previewed.allowed) {
      return {
        ...base,
        payVisible: false,
        maskReason: `Previewing role ${previewRole}: ${maskSentence(previewed.reasonCode, previewGrants, payrollLocation, row.location)}`,
      };
    }
    // Only here are the amounts read out of the row at all.
    return {
      ...base,
      payVisible: true,
      basicMinor: toNullableNumber(row.basic_salary_minor),
      grossMinor: toNullableNumber(row.gross_minor),
      netMinor: toNullableNumber(row.net_minor),
      maskReason: null,
    };
  });

  const effectiveContext = preview ?? access.context;
  const effectiveGrants = preview ? previewGrants : grants;
  const visible = rows.filter((row) => row.payVisible).length;

  return {
    location,
    period,
    locations: (locationRows as Array<{ location: string }>).map((row) => row.location),
    periods: (periodRows as Array<{ period: string }>).map((row) => row.period),
    rows,
    viewer: {
      roleCodes: [...effectiveContext.roles],
      grants: describeGrants(effectiveGrants),
      holdsRatePermission: effectiveContext.permissions.includes("payroll.rate.read"),
      scopeConfigured: effectiveGrants.length > 0,
      canPreviewOtherScopes: canPreview,
      previewableRoleCodes: canPreview ? await previewableRoles(access) : [],
      previewRoleCode: previewRole,
      statement: preview
        ? `Previewing the scope of role ${previewRole}. ${scopeStatement(preview, previewGrants)} A preview can only narrow what you already see.`
        : scopeStatement(access.context, grants),
    },
    totals: { employees: rows.length, payVisible: visible, payMasked: rows.length - visible },
  };
}
