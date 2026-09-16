import type { Access } from "@/server/platform/access";

/**
 * Record visibility under a User, Role and Scope Grant (FRM-PLT-03).
 *
 * The location grant "is what lets a plant user see only that plant": an employee is
 * visible when they work at a granted site, when they sit in the caller's reporting line
 * and the grant includes it, or when they are the caller. The reporting line is walked at
 * query time, never cached, as the workbook requires. A caller without a saved grant sees
 * what their permissions alone allow, exactly as before.
 */
export type EmployeeVisibility = {
  /** Granted location codes, or null when no grant narrows the caller. */
  locations: string[] | null;
  includeReportingLine: boolean;
  /** The caller's own employee id, the root of their reporting line. */
  employeeId: string | null;
};

export function employeeVisibility(access: Access): EmployeeVisibility {
  const grant = access.context.membershipScope;
  if (!grant || grant.locationGrant.length === 0) {
    return { locations: null, includeReportingLine: false, employeeId: access.context.employeeId ?? null };
  }
  return {
    locations: [...grant.locationGrant],
    includeReportingLine: grant.includeReportingLine,
    employeeId: access.context.employeeId ?? null,
  };
}

/**
 * The WHERE fragment for an `employees` alias, with the placeholders the caller has bound:
 * `tenant` (uuid), `locations` (text[] or null), `reportingLine` (boolean) and
 * `employee` (uuid or null). Location codes match either generation of employee row -
 * the imported roster stores the site code, in-app records store the site name.
 */
export function employeeVisibilitySql(
  alias: string,
  placeholders: { tenant: string; locations: string; reportingLine: string; employee: string },
): string {
  const { tenant, locations, reportingLine, employee } = placeholders;
  return `(${locations}::text[] is null
    or ${alias}.id = ${employee}::uuid
    or exists (
      select 1 from locations gl
      where gl.tenant_id = ${tenant} and gl.attributes->>'code' = any(${locations}::text[])
        and (gl.attributes->>'code' = ${alias}.location or gl.attributes->>'name' = ${alias}.location))
    or (${reportingLine}::boolean and ${employee}::uuid is not null and ${alias}.id in (
      with recursive chain as (
        select c0.id, 1 as depth from employees c0
        where c0.tenant_id = ${tenant} and c0.manager_employee_id = ${employee}::uuid
        union all
        select c.id, chain.depth + 1 from employees c
        join chain on c.tenant_id = ${tenant} and c.manager_employee_id = chain.id
        where chain.depth < 50)
      select id from chain)))`;
}
