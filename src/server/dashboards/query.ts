import "server-only";

import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { tenantTx, type Access } from "@/server/platform/access";
import type { BoardFilters } from "./types";

export type Row = Record<string, unknown>;

/** True when the caller holds the permission (owners and administrators hold all of them). */
export function can(access: Access, permission: string): boolean {
  return authorize(access.context, { action: permission, resource: { tenantId: access.tenantId } }).allowed;
}

export function canAny(access: Access, permissions: readonly string[]): boolean {
  return permissions.some((permission) => can(access, permission));
}

/**
 * The scoped workforce every board starts from, as SQL common table expressions.
 *
 *   $1 tenant id · $2 location filter · $3 department filter · $4 IANA timezone
 *
 * `emp` is one row per employee in scope: `active` is false once the record is separated, archived
 * or inactive; `exit_date` is the last working day from the exit case when there is one, otherwise
 * the day the record was marked separated. `today` is the organisation's local date.
 */
const SCOPE = `
  today as (select (now() at time zone $4::text)::date as d),
  emp as (
    select e.id, e.employee_code,
      trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name,
      nullif(trim(e.department), '') as department,
      nullif(trim(e.location), '') as location,
      e.category, nullif(trim(e.designation), '') as designation, e.manager_employee_id,
      e.date_of_birth, nullif(trim(e.work_email), '') as work_email,
      e.basic_salary_minor, e.currency,
      coalesce(e.joining_date, e.created_at::date) as joined_on,
      e.joining_date,
      coalesce(lower(e.status), 'active') not in ('separated', 'exited', 'relieved', 'archived', 'inactive') as active,
      case when coalesce(lower(e.status), 'active') in ('separated', 'exited', 'relieved')
        then coalesce(exit_case.last_day, e.updated_at::date) end as exit_date
    from employees e
    left join lateral (
      select max(case when o.attributes->>'last_working_day' ~ '^\\d{4}-\\d{2}-\\d{2}$'
                      then (o.attributes->>'last_working_day')::date end) as last_day
      from offboarding_cases o
      join employments em on em.tenant_id = o.tenant_id and em.id = o.employment_id
      where em.tenant_id = e.tenant_id and em.employee_id = e.id
    ) exit_case on true
    where e.tenant_id = $1::uuid
      and ($2::text is null or e.location = $2::text)
      and ($3::text is null or e.department = $3::text)
  )`;

export type Scope = { access: Access; filters: BoardFilters; timezone: string };

export type Statement = { text: string; values: unknown[] };

/** A query over the scoped workforce. Extra values are numbered from $5. */
export function scoped(scope: Scope, body: string, extra: unknown[] = []): Statement {
  return {
    text: `with ${SCOPE} ${body.trim().replace(/^with\s+/i, ", ")}`,
    values: [scope.access.tenantId, scope.filters.location, scope.filters.department, scope.timezone, ...extra],
  };
}

/** A query that does not need the workforce scope: $1 tenant id, $2 timezone, extras from $3. */
export function plain(scope: Scope, body: string, extra: unknown[] = []): Statement {
  return {
    text: `with today as (select (now() at time zone $2::text)::date as d) ${body.trim().replace(/^with\s+/i, ", ")}`,
    values: [scope.access.tenantId, scope.timezone, ...extra],
  };
}

/**
 * Runs named statements inside the tenant's row-level-security context. All of them go in one
 * transaction; if that fails (a table missing in an older database, a bad stored value) each runs
 * on its own so one broken source only empties its own panel. A failed source comes back as null.
 */
export async function runAll<K extends string>(access: Access, statements: Record<K, Statement>): Promise<Record<K, Row[] | null>> {
  const keys = Object.keys(statements) as K[];
  const build = (key: K) => sqlClient.query(statements[key].text, statements[key].values);
  try {
    const results = await tenantTx(access, keys.map(build));
    return Object.fromEntries(keys.map((key, index) => [key, (results[index] as Row[]) ?? []])) as Record<K, Row[] | null>;
  } catch {
    const settled = await Promise.allSettled(keys.map((key) => tenantTx(access, [build(key)])));
    return Object.fromEntries(
      keys.map((key, index) => {
        const outcome = settled[index]!;
        if (outcome.status === "rejected") {
          console.warn(`Dashboard source "${key}" could not be read:`, outcome.reason instanceof Error ? outcome.reason.message : outcome.reason);
          return [key, null];
        }
        return [key, (outcome.value[0] as Row[]) ?? []];
      }),
    ) as Record<K, Row[] | null>;
  }
}

/** Organisation name, timezone and currency for the board header. */
export async function organisationContext(access: Access): Promise<{ name: string; timezone: string; currency: string }> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select t.name, coalesce(s.timezone, t.timezone, 'Asia/Kolkata') as timezone,
        coalesce(s.currency, t.default_currency, 'INR') as currency
      from tenants t
      left join tenant_settings s on s.tenant_id = t.id
      where t.id = ${access.tenantId}
      limit 1
    `,
  ]);
  const row = (rows as Array<{ name: string; timezone: string; currency: string }>)[0];
  const timezone = row?.timezone && isValidTimezone(row.timezone) ? row.timezone : "Asia/Kolkata";
  return { name: row?.name ?? "", timezone, currency: row?.currency ?? "INR" };
}

function isValidTimezone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
