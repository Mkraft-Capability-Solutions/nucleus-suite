import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

export type DirectoryStatus = "active" | "on_leave" | "separated" | "archived";

/** Pure status mapping shared by the directory contract (unit-tested). */
export function deriveDirectoryStatus(status: string | null | undefined): DirectoryStatus {
  const normalized = (status ?? "").trim().toLowerCase();
  if (["separated", "exited", "relieved"].includes(normalized)) return "separated";
  if (["archived", "inactive"].includes(normalized)) return "archived";
  if (["on_leave", "on leave"].includes(normalized)) return "on_leave";
  return "active";
}

/**
 * The imported roster stores codes (DES-01, OU-100, LOC-BLR) in the denormalised
 * employee columns, while records created in-app store display names. This
 * prefers the resolved name and falls back to whatever the column holds, so both
 * generations of record read correctly.
 */
export function displayOrCode(resolved: string | null | undefined, raw: string | null | undefined): string {
  const name = (resolved ?? "").trim();
  if (name !== "") return name;
  return (raw ?? "").trim() || "—";
}

export type DirectoryRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  location: string;
  band: string | null;
  worker_class: string | null;
  manager_code: string | null;
  manager_name: string | null;
  joining_date: string | null;
  work_email: string | null;
  record_status: string;
  status: DirectoryStatus;
};

type DirectoryQueryRow = Omit<DirectoryRow, "status" | "designation" | "department" | "location"> & {
  designation_code: string | null;
  designation_name: string | null;
  department_code: string | null;
  department_name: string | null;
  location_code: string | null;
  location_name: string | null;
};

/**
 * Each employee's current worker class and grade come from the live employment
 * and assignment rows, taken as the most recent of each rather than assuming one.
 */
const EMPLOYMENT_LATERAL = `left join lateral (
  select wc.attributes->>'code' as worker_class_code, g.attributes->>'code' as band_code
  from employments em
  left join worker_categories wc on wc.tenant_id = em.tenant_id and wc.id = em.worker_category_id
  left join employee_assignments ea on ea.tenant_id = em.tenant_id and ea.employment_id = em.id
  left join grades g on g.tenant_id = ea.tenant_id and g.id = ea.grade_id
  where em.tenant_id = e.tenant_id and em.employee_id = e.id
  order by em.created_at desc limit 1
) emp on true`;

const DIRECTORY_SELECT = `select e.id, e.employee_code, e.first_name, e.last_name,
    e.designation as designation_code,
    coalesce(jp.attributes->>'title', jp.attributes->>'name') as designation_name,
    e.department as department_code, dep.attributes->>'name' as department_name,
    e.location as location_code, loc.attributes->>'name' as location_name,
    emp.band_code as band, emp.worker_class_code as worker_class,
    mgr.employee_code as manager_code,
    case when mgr.id is null then null
         else trim(coalesce(mgr.first_name, '') || ' ' || coalesce(mgr.last_name, '')) end as manager_name,
    e.joining_date::text as joining_date, e.work_email,
    coalesce(e.status, '') as record_status
  from employees e
  left join job_profiles jp on jp.tenant_id = e.tenant_id and jp.attributes->>'code' = e.designation
  left join departments dep on dep.tenant_id = e.tenant_id and dep.attributes->>'code' = e.department
  left join locations loc on loc.tenant_id = e.tenant_id and loc.attributes->>'code' = e.location
  left join employees mgr on mgr.tenant_id = e.tenant_id and mgr.id = e.manager_employee_id
  ${EMPLOYMENT_LATERAL}`;

function projectDirectoryRow(row: DirectoryQueryRow): DirectoryRow {
  return {
    id: row.id,
    employee_code: row.employee_code,
    first_name: row.first_name,
    last_name: row.last_name,
    designation: displayOrCode(row.designation_name, row.designation_code),
    department: displayOrCode(row.department_name, row.department_code),
    location: displayOrCode(row.location_name, row.location_code),
    band: row.band,
    worker_class: row.worker_class,
    manager_code: row.manager_code,
    manager_name: row.manager_name,
    joining_date: row.joining_date,
    work_email: row.work_email,
    record_status: row.record_status,
    status: deriveDirectoryStatus(row.record_status),
  };
}

/** People Core directory with band, worker class and reporting line resolved. */
export async function listPeopleDirectory(access: Access, search: string): Promise<DirectoryRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${DIRECTORY_SELECT}
       where e.tenant_id = $1
         and ($2 = '%%' or (e.first_name || ' ' || e.last_name || ' ' || e.employee_code || ' '
              || coalesce(e.designation, '') || ' ' || coalesce(e.department, '') || ' '
              || coalesce(dep.attributes->>'name', '') || ' ' || coalesce(jp.attributes->>'title', '')) ilike $2)
       order by e.employee_code asc limit 200`,
      [access.tenantId, like],
    ),
  ]);
  return (rows as DirectoryQueryRow[]).map(projectDirectoryRow);
}

export type PeopleCoreSummary = {
  activeEmployees: number;
  sanctionedOpen: number | null;
  documentsTotal: number | null;
  documentsVerified: number | null;
  verifiedPercent: number | null;
  auditEvents: number | null;
};

/** Pure percentage helper so the stat never renders NaN on an empty vault. */
export function verifiedPercent(total: number | null, verified: number | null): number | null {
  if (total === null || verified === null || total <= 0) return null;
  return Math.round((verified / total) * 100);
}

/**
 * Headline figures for People Core. Each source is isolated: a permission or
 * data failure on one returns null for that stat rather than failing the page.
 */
export async function getPeopleCoreSummary(access: Access): Promise<PeopleCoreSummary> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [activeRows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from employees
      where tenant_id = ${access.tenantId} and coalesce(status, '') not in ('separated', 'archived', 'inactive')`,
  ]);
  const activeEmployees = (activeRows as Array<{ total: number }>)[0]?.total ?? 0;

  let sanctionedOpen: number | null = null;
  try {
    const [openRows] = await tenantTx(access, [
      sqlClient`select coalesce(sum(case when attributes->>'open_requisitions' ~ '^[0-9]+$'
          then (attributes->>'open_requisitions')::int else 0 end), 0)::int as total
        from manpower_plan_lines where tenant_id = ${access.tenantId}`,
    ]);
    sanctionedOpen = (openRows as Array<{ total: number }>)[0]?.total ?? 0;
  } catch {
    sanctionedOpen = null;
  }

  let documentsTotal: number | null = null;
  let documentsVerified: number | null = null;
  try {
    const [docRows] = await tenantTx(access, [
      sqlClient`select count(*)::int as total,
          count(*) filter (where coalesce(attributes->>'verification', attributes->>'scan', '')
            in ('verified', 'available'))::int as verified
        from documents where tenant_id = ${access.tenantId}`,
    ]);
    const row = (docRows as Array<{ total: number; verified: number }>)[0];
    documentsTotal = row?.total ?? 0;
    documentsVerified = row?.verified ?? 0;
  } catch {
    documentsTotal = null;
    documentsVerified = null;
  }

  let auditEvents: number | null = null;
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select count(*)::int as total from audit_events where tenant_id = ${access.tenantId}`,
    ]);
    auditEvents = (auditRows as Array<{ total: number }>)[0]?.total ?? 0;
  } catch {
    auditEvents = null;
  }

  return {
    activeEmployees,
    sanctionedOpen,
    documentsTotal,
    documentsVerified,
    verifiedPercent: verifiedPercent(documentsTotal, documentsVerified),
    auditEvents,
  };
}

export type LegalEntityRow = {
  id: string;
  code: string;
  legal_name: string;
  currency_code: string | null;
  status: string;
  headcount: number;
};

/**
 * Legal entities tab (SCR-001). This table carries typed columns rather than a
 * jsonb bag, and the registration number is stored only as ciphertext, so it is
 * deliberately not projected here.
 */
export async function listLegalEntities(access: Access): Promise<LegalEntityRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select le.id, coalesce(le.code, left(le.id::text, 8)) as code,
        coalesce(le.legal_name, 'Unnamed entity') as legal_name,
        le.currency_code, coalesce(le.status, 'active') as status,
        (select count(distinct em.employee_id)::int from employments em
          where em.tenant_id = le.tenant_id and em.legal_entity_id = le.id) as headcount
      from legal_entities le where le.tenant_id = ${access.tenantId}
      order by le.code asc limit 100`,
  ]);
  return rows as LegalEntityRow[];
}

export type LocationRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  establishment_type: string | null;
  headcount: number;
};

/** Locations tab (SCR-002) with the live headcount deployed at each site. */
export async function listLocations(access: Access): Promise<LocationRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select l.id,
        coalesce(l.attributes->>'code', left(l.id::text, 8)) as code,
        coalesce(l.attributes->>'name', 'Unnamed location') as name,
        l.attributes->>'city' as city,
        l.attributes->>'state' as state,
        l.attributes->>'establishment_type' as establishment_type,
        (select count(*)::int from employees e
          where e.tenant_id = l.tenant_id and e.location = l.attributes->>'code') as headcount
      from locations l where l.tenant_id = ${access.tenantId}
      order by coalesce(l.attributes->>'code', '') asc limit 100`,
  ]);
  return rows as LocationRow[];
}

export type AuditTrailRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  reason: string | null;
  created_at: string;
};

/** Audit trail tab: the tenant's recent audited events, newest first. */
export async function listDirectoryAudit(access: Access, limit = 50): Promise<AuditTrailRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const capped = Math.min(Math.max(limit, 1), 200);
  const [rows] = await tenantTx(access, [
    sqlClient`select id, action, entity_type, entity_id::text as entity_id, reason, created_at::text as created_at
      from audit_events where tenant_id = ${access.tenantId}
      order by created_at desc, id desc limit ${capped}`,
  ]);
  return rows as AuditTrailRow[];
}
