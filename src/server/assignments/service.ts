import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export type AssignmentStatus = "effective" | "scheduled" | "superseded";

/**
 * Pure status derivation mirrored by the SQL CASE below (unit-tested).
 * Missing dates fall back to effective; only explicit future/ended ranges move the state.
 */
export function deriveAssignmentStatus(
  effectiveFrom: string | null,
  effectiveTo: string | null,
  today = new Date().toISOString().slice(0, 10),
): AssignmentStatus {
  const from = (effectiveFrom ?? "").slice(0, 10);
  const to = (effectiveTo ?? "") ? (effectiveTo as string).slice(0, 10) : null;
  if (from && from > today) return "scheduled";
  if (to && to < today) return "superseded";
  return "effective";
}

function dossierRead(access: Access) {
  enforce(access.context, "employee.dossier.read", { tenantId: access.tenantId });
}

/**
 * Grade-name enrichment, isolated: reference data outside the queue-proven
 * join set must never fail the record. Returns grade id to display name.
 */
async function gradeNames(access: Access, assignmentIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = [...new Set(assignmentIds.filter(Boolean))];
  if (ids.length === 0) return names;
  try {
    const [rows] = await tenantTx(access, [
      sqlClient.query(
        `select a.id, coalesce(grd.attributes->>'name', grd.attributes->>'title', null) as name
         from employee_assignments a
         left join grades grd on grd.tenant_id = a.tenant_id and grd.id = a.grade_id
         where a.tenant_id = $1 and a.id = any($2)`,
        [access.tenantId, ids],
      ),
    ]);
    for (const row of rows as Array<{ id: string; name: string | null }>) {
      if (row.name) names.set(row.id, row.name);
    }
  } catch {
    // Grade reference data is best-effort; records render without it.
  }
  return names;
}

export type AssignmentQueueRow = {
  id: string | null;
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department: string;
  position: string;
  location: string;
  effective_from: string;
  effective_to: string | null;
};

export type AssignmentRecord = AssignmentQueueRow & {
  id: string;
  employment_id: string;
  grade: string | null;
  reason: string | null;
  record_status: string;
  status: AssignmentStatus;
};

const NAME_JOINS = `left join departments dep on dep.tenant_id = emp.tenant_id and dep.id = a.department_id
  left join positions pos on pos.tenant_id = emp.tenant_id and pos.id = a.position_id
  left join locations loc on loc.tenant_id = emp.tenant_id and loc.id = a.location_id`;

const namesFor = (emp: string) => `coalesce(pos.attributes->>'name', pos.attributes->>'title', ${emp}.designation, 'Unassigned') as position,
  coalesce(loc.attributes->>'name', loc.attributes->>'title', ${emp}.location, 'Unassigned') as location,
  coalesce(dep.attributes->>'name', dep.attributes->>'title', ${emp}.department, 'Unassigned') as department`;

const NAMES = namesFor("emp");

/** Tenant-wide queue: one row per employee with the latest active assignment (or directory fallback). */
export async function listAssignmentQueue(access: Access, search: string): Promise<AssignmentQueueRow[]> {
  dossierRead(access);
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `with latest as (
         select distinct on (e.id) e.id as employee_id, a.id as assignment_id
         from employees e
         left join employments em on em.tenant_id = e.tenant_id and em.employee_id = e.id
         left join employee_assignments a on a.tenant_id = e.tenant_id and a.employment_id = em.id
           and a.record_status = 'active'
         where e.tenant_id = $1
         order by e.id, coalesce(a.attributes->>'effectiveFrom', '') desc, a.created_at desc nulls last, a.id
       )
       select latest.assignment_id as id, emp.id as employee_id, emp.employee_code,
         emp.first_name, emp.last_name, ${NAMES},
         coalesce(a.attributes->>'effectiveFrom', emp.joining_date::text) as effective_from,
         a.attributes->>'effectiveTo' as effective_to
       from employees emp
       join latest on latest.employee_id = emp.id
       left join employee_assignments a on a.tenant_id = emp.tenant_id and a.id = latest.assignment_id
       ${NAME_JOINS}
       where emp.tenant_id = $1
         and (emp.first_name || ' ' || emp.last_name || ' ' || emp.employee_code || ' ' || coalesce(emp.department, '')) ilike $2
       order by emp.employee_code asc limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return rows as AssignmentQueueRow[];
}

/** Full effective-dated history for one employee. The audit trail degrades to [] on failure. */
export async function getAssignmentHistory(access: Access, employeeId: string) {
  dossierRead(access);
  if (!z.string().uuid().safeParse(employeeId).success) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Choose a valid employee reference." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select a.id, a.employment_id, e.id as employee_id, e.employee_code,
         e.first_name, e.last_name, ${namesFor("e")},
         a.attributes->>'effectiveFrom' as effective_from, a.attributes->>'effectiveTo' as effective_to,
         a.attributes->>'reason' as reason, a.record_status,
         case when coalesce(a.attributes->>'effectiveFrom', '') > to_char(current_date, 'YYYY-MM-DD') then 'scheduled'
           when a.attributes->>'effectiveTo' is not null and a.attributes->>'effectiveTo' < to_char(current_date, 'YYYY-MM-DD') then 'superseded'
           else 'effective' end as status
       from employee_assignments a
       join employments em on em.tenant_id = a.tenant_id and em.id = a.employment_id
       join employees e on e.tenant_id = a.tenant_id and e.id = em.employee_id
       left join departments dep on dep.tenant_id = a.tenant_id and dep.id = a.department_id
       left join positions pos on pos.tenant_id = a.tenant_id and pos.id = a.position_id
       left join locations loc on loc.tenant_id = a.tenant_id and loc.id = a.location_id
       where a.tenant_id = $1 and e.id = $2::uuid
       order by coalesce(a.attributes->>'effectiveFrom', '') desc, a.created_at desc, a.id desc limit 100`,
      [access.tenantId, employeeId],
    ),
  ]);
  const assignments = rows as AssignmentRecord[];
  const grades = await gradeNames(access, assignments.map((row) => row.id));
  const enriched = assignments.map((row) => ({ ...row, grade: grades.get(row.id) ?? null }));
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const ids = enriched.map((row) => row.id);
    const [auditRows] = await tenantTx(access, [
      ids.length === 0
        ? sqlClient`select id, action, reason, created_at::text as created_at from audit_events where tenant_id = ${access.tenantId} and entity_type = 'employee' and entity_id = ${employeeId} order by created_at desc limit 20`
        : sqlClient.query(
            `select id, action, reason, created_at::text as created_at from audit_events
             where tenant_id = $1 and ((entity_type = 'employee_dossier' and entity_id = any($2)) or (entity_type = 'employee' and entity_id = $3))
             order by created_at desc limit 20`,
            [access.tenantId, ids, employeeId],
          ),
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { assignments: enriched, auditTrail };
}

/** Single assignment record. The audit trail degrades to [] on failure. */
export async function getAssignmentRecord(access: Access, id: string) {
  dossierRead(access);
  if (!z.string().uuid().safeParse(id).success) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select a.id, a.employment_id, e.id as employee_id, e.employee_code,
         e.first_name, e.last_name, ${namesFor("e")},
         a.attributes->>'effectiveFrom' as effective_from, a.attributes->>'effectiveTo' as effective_to,
         a.attributes->>'reason' as reason, a.record_status,
         case when coalesce(a.attributes->>'effectiveFrom', '') > to_char(current_date, 'YYYY-MM-DD') then 'scheduled'
           when a.attributes->>'effectiveTo' is not null and a.attributes->>'effectiveTo' < to_char(current_date, 'YYYY-MM-DD') then 'superseded'
           else 'effective' end as status
       from employee_assignments a
       join employments em on em.tenant_id = a.tenant_id and em.id = a.employment_id
       join employees e on e.tenant_id = a.tenant_id and e.id = em.employee_id
       left join departments dep on dep.tenant_id = a.tenant_id and dep.id = a.department_id
       left join positions pos on pos.tenant_id = a.tenant_id and pos.id = a.position_id
       left join locations loc on loc.tenant_id = a.tenant_id and loc.id = a.location_id
       where a.tenant_id = $1 and a.id = $2::uuid limit 1`,
      [access.tenantId, id],
    ),
  ]);
  const record = (rows as AssignmentRecord[])[0];
  if (!record) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const grades = await gradeNames(access, [record.id]);
  const enriched = { ...record, grade: grades.get(record.id) ?? null };
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'employee_dossier' and entity_id = ${record.id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record: enriched, auditTrail };
}
