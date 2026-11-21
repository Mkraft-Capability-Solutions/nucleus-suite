import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { activeEntries, buildCareer, MOVEMENT_TYPES, RECORDABLE_MOVES, type CareerEntry, type CareerView, type Company } from "@/lib/career";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { listCompanies } from "./group";

/**
 * Employee job history (employee_job_history, db/migrations/0031).
 *
 * Reading needs employee.read. Recording a move or a correction needs employee.write. A move dated
 * on or after the latest position becomes the employee's current position (the employee record is
 * updated in the same transaction); an earlier date records a past position only. History rows are
 * never edited: a correction adds a row that supersedes the wrong one.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type EmployeeHead = {
  id: string; employee_code: string; name: string; designation: string | null; department: string | null; location: string | null;
  category: string | null; legal_entity_id: string | null; manager_employee_id: string | null; status: string | null;
  joining_date: string | null; exit_date: string | null; today: string; group_name: string;
};

type RawEntry = {
  id: string; movement_type: CareerEntry["movementType"]; effective_from: string; legal_entity_id: string | null; legal_entity_name: string | null;
  location: string | null; department: string | null; designation: string | null; grade: string | null; category: string | null;
  manager_employee_id: string | null; manager_name: string | null; reason: string | null; source: string; supersedes_id: string | null;
  recorded_at: string; recorded_by: string | null;
};

function toEntry(row: RawEntry): CareerEntry {
  return {
    id: row.id, movementType: row.movement_type, effectiveFrom: row.effective_from, companyId: row.legal_entity_id, companyName: row.legal_entity_name,
    location: row.location, department: row.department, designation: row.designation, grade: row.grade, category: row.category,
    managerId: row.manager_employee_id, managerName: row.manager_name, reason: row.reason, source: row.source, supersedesId: row.supersedes_id,
    recordedAt: row.recorded_at, recordedBy: row.recorded_by,
  };
}

async function loadEmployee(access: Access, idOrCode: string): Promise<EmployeeHead> {
  const byId = UUID.test(idOrCode);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name,
        e.designation, e.department, e.location, e.category, e.legal_entity_id, e.manager_employee_id, e.status,
        to_char(e.joining_date, 'YYYY-MM-DD') as joining_date,
        case when coalesce(lower(e.status), 'active') in ('separated', 'exited', 'relieved') then to_char(coalesce(
          (select max(case when o.attributes->>'last_working_day' ~ '^\\d{4}-\\d{2}-\\d{2}$' then (o.attributes->>'last_working_day')::date end)
             from offboarding_cases o join employments em on em.tenant_id = o.tenant_id and em.id = o.employment_id
             where em.tenant_id = e.tenant_id and em.employee_id = e.id),
          e.updated_at::date), 'YYYY-MM-DD') end as exit_date,
        to_char((now() at time zone coalesce((select s.timezone from tenant_settings s where s.tenant_id = e.tenant_id limit 1), 'Asia/Kolkata'))::date, 'YYYY-MM-DD') as today,
        (select t.name from tenants t where t.id = e.tenant_id) as group_name
      from employees e
      where e.tenant_id = ${access.tenantId} and (${byId ? idOrCode : null}::uuid = e.id or e.employee_code = ${idOrCode})
      limit 1`,
  ]);
  const employee = (rows as EmployeeHead[])[0];
  if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "This employee is not in the organisation's records." });
  return employee;
}

async function loadEntries(access: Access, employeeId: string): Promise<CareerEntry[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select h.id, h.movement_type, to_char(h.effective_from, 'YYYY-MM-DD') as effective_from, h.legal_entity_id, h.legal_entity_name,
        h.location, h.department, h.designation, h.grade, h.category, h.manager_employee_id, h.manager_name, h.reason, h.source,
        h.supersedes_id, h.recorded_at::text as recorded_at,
        (select u.name from "user" u where u.id = h.recorded_by_user_id) as recorded_by
      from employee_job_history h
      where h.tenant_id = ${access.tenantId} and h.employee_id = ${employeeId}
      order by h.effective_from, h.recorded_at`,
  ]);
  return (rows as RawEntry[]).map(toEntry);
}

export type CareerPayload = {
  employee: { id: string; employeeCode: string; name: string; designation: string | null; status: string | null; exitedOn: string | null };
  entries: CareerEntry[];
  companies: Company[];
  view: CareerView;
  today: string;
  canRecord: boolean;
};

export async function getCareer(access: Access, idOrCode: string): Promise<CareerPayload> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employee = await loadEmployee(access, idOrCode);
  const [entries, companies] = await Promise.all([loadEntries(access, employee.id), listCompanies(access)]);
  return {
    employee: { id: employee.id, employeeCode: employee.employee_code, name: employee.name, designation: employee.designation, status: employee.status, exitedOn: employee.exit_date },
    entries,
    companies,
    view: buildCareer(entries, companies, { today: employee.today, exitedOn: employee.exit_date, groupName: employee.group_name }),
    today: employee.today,
    canRecord: authorize(access.context, { action: "employee.write", resource: { tenantId: access.tenantId } }).allowed,
  };
}

const positionFields = {
  effectiveFrom: z.string().regex(DATE, "Use a date like 2024-04-01."),
  companyId: z.string().uuid().nullable().optional(),
  designation: z.string().trim().min(1).max(120).nullable().optional(),
  department: z.string().trim().min(1).max(80).nullable().optional(),
  location: z.string().trim().min(1).max(80).nullable().optional(),
  grade: z.string().trim().min(1).max(40).nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(1000),
};

export const recordMoveSchema = z.object({ movementType: z.enum(RECORDABLE_MOVES), ...positionFields }).strict();
export const correctEntrySchema = z.object({ movementType: z.enum(MOVEMENT_TYPES), ...positionFields }).strict();

type Position = {
  companyId: string | null; companyName: string | null; designation: string | null; department: string | null; location: string | null;
  grade: string | null; category: string | null; managerId: string | null; managerName: string | null;
};

/** Fields not given carry over from `base`; null clears a field. */
async function resolvePosition(
  access: Access, employee: EmployeeHead, base: Position, input: z.infer<typeof recordMoveSchema> | z.infer<typeof correctEntrySchema>,
): Promise<Position> {
  const pick = <K extends keyof typeof input>(key: K, fallback: string | null) => (input[key] === undefined ? fallback : (input[key] as string | null));
  const companyId = pick("companyId", base.companyId);
  const managerId = pick("managerId", base.managerId);
  if (managerId && managerId === employee.id) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "An employee cannot report to themselves." });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select (select legal_name from legal_entities where tenant_id = ${access.tenantId} and id = ${companyId}::uuid) as company_name,
        (select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') from employees
          where tenant_id = ${access.tenantId} and id = ${managerId}::uuid) as manager_name`,
  ]);
  const names = (rows as Array<{ company_name: string | null; manager_name: string | null }>)[0];
  if (companyId && !names?.company_name) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The company is not part of this organisation's group structure." });
  if (managerId && !names?.manager_name) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The manager is not an employee of this organisation." });
  return {
    companyId,
    companyName: companyId ? names!.company_name : null,
    designation: pick("designation", base.designation),
    department: pick("department", base.department),
    location: pick("location", base.location),
    grade: pick("grade", base.grade),
    category: base.category,
    managerId,
    managerName: managerId ? names!.manager_name : null,
  };
}

function positionOf(entry: CareerEntry | undefined, employee: EmployeeHead): Position {
  if (entry) {
    return {
      companyId: entry.companyId, companyName: entry.companyName, designation: entry.designation, department: entry.department,
      location: entry.location, grade: entry.grade, category: entry.category, managerId: entry.managerId, managerName: entry.managerName,
    };
  }
  return {
    companyId: employee.legal_entity_id, companyName: null, designation: employee.designation, department: employee.department,
    location: employee.location, grade: null, category: employee.category, managerId: employee.manager_employee_id, managerName: null,
  };
}

const SAME_FIELDS: Array<keyof Position> = ["companyId", "designation", "department", "location", "grade", "managerId"];

function insertHistory(access: Access, employeeId: string, movementType: string, effectiveFrom: string, position: Position, reason: string, source: string, supersedesId: string | null) {
  return sqlClient`
    insert into employee_job_history (tenant_id, employee_id, movement_type, effective_from, legal_entity_id, legal_entity_name, location, department,
      designation, grade, category, manager_employee_id, manager_name, reason, source, supersedes_id, recorded_by_membership_id, recorded_by_user_id)
    values (${access.tenantId}, ${employeeId}, ${movementType}, ${effectiveFrom}, ${position.companyId}, ${position.companyName}, ${position.location},
      ${position.department}, ${position.designation}, ${position.grade}, ${position.category}, ${position.managerId}, ${position.managerName},
      ${reason}, ${source}, ${supersedesId}, ${access.context.membershipId}, ${access.context.actorUserId})
    returning id`;
}

/** Makes the position the employee's current one. The trigger is told not to write its own row. */
function applyToEmployee(access: Access, employeeId: string, position: Position, joiningDate?: string) {
  return [
    sqlClient`select set_config('app.job_history_recorded', 'on', true)`,
    sqlClient`
      update employees set legal_entity_id = ${position.companyId}, designation = ${position.designation}, department = ${position.department},
        location = ${position.location}, manager_employee_id = ${position.managerId},
        joining_date = coalesce(${joiningDate ?? null}::date, joining_date), updated_at = clock_timestamp()
      where tenant_id = ${access.tenantId} and id = ${employeeId}`,
  ];
}

function audit(access: Access, employeeId: string, action: string, reason: string, after: unknown, requestId: string) {
  return sqlClient`
    insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
    values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${action}, 'employee', ${employeeId},
      ${reason}, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)`;
}

function databaseError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (/employee_job_history_supersedes_uq|duplicate key/i.test(message)) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This entry has already been corrected. Reload the history." });
  }
  throw error;
}

export async function recordMove(access: Access, idOrCode: string, input: z.infer<typeof recordMoveSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const employee = await loadEmployee(access, idOrCode);
  if (employee.exit_date) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This employee has left the group; moves can no longer be recorded." });
  if (input.effectiveFrom > employee.today) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A move cannot be dated in the future. Record it on or after the day it takes effect." });
  const entries = activeEntries(await loadEntries(access, employee.id));
  const first = entries[0];
  if (first && input.effectiveFrom < first.effectiveFrom) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `The date is before the employee joined (${first.effectiveFrom}). Correct the "Joined" entry first.` });
  }
  const previous = [...entries].reverse().find((entry) => entry.effectiveFrom <= input.effectiveFrom);
  const base = positionOf(previous, employee);
  const position = await resolvePosition(access, employee, base, input);
  if (SAME_FIELDS.every((key) => (position[key] ?? null) === (base[key] ?? null))) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Nothing changes in this move. Change the company, designation, grade, department, location or manager." });
  }
  if (input.movementType === "group_transfer" && position.companyId === base.companyId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A move to a group company needs a different company." });
  }
  const latest = entries[entries.length - 1];
  const becomesCurrent = !latest || input.effectiveFrom >= latest.effectiveFrom;
  try {
    const results = await tenantTx(access, [
      ...(becomesCurrent ? applyToEmployee(access, employee.id, position) : []),
      insertHistory(access, employee.id, input.movementType, input.effectiveFrom, position, input.reason, becomesCurrent ? "move" : "history", null),
      audit(access, employee.id, "people.job_move", input.reason, { movementType: input.movementType, effectiveFrom: input.effectiveFrom, ...position, current: becomesCurrent }, requestId),
    ]);
    const inserted = results[becomesCurrent ? 2 : 0] as Array<{ id: string }>;
    return { id: inserted[0]?.id ?? null, current: becomesCurrent };
  } catch (error) {
    databaseError(error);
  }
}

export async function correctEntry(access: Access, idOrCode: string, entryId: string, input: z.infer<typeof correctEntrySchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const employee = await loadEmployee(access, idOrCode);
  const all = await loadEntries(access, employee.id);
  const target = all.find((entry) => entry.id === entryId);
  if (!target) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "This history entry was not found." });
  const entries = activeEntries(all);
  if (!entries.some((entry) => entry.id === entryId)) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This entry has already been corrected. Reload the history." });
  if (input.effectiveFrom > employee.today) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A position cannot start in the future." });
  const isFirst = entries[0]?.id === entryId;
  if (isFirst !== (input.movementType === "joined")) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: isFirst ? "The first entry is when the employee joined; keep it as \"Joined\"." : "Only the first entry can be \"Joined\"." });
  }
  const others = entries.filter((entry) => entry.id !== entryId);
  if (isFirst && others[0] && input.effectiveFrom > others[0].effectiveFrom) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `The joining date cannot be after the next move (${others[0].effectiveFrom}).` });
  }
  if (!isFirst && entries[0] && input.effectiveFrom < entries[0].effectiveFrom) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `The date is before the employee joined (${entries[0].effectiveFrom}).` });
  }
  const position = await resolvePosition(access, employee, positionOf(target, employee), input);
  const latestAfter = [...others, { ...target, effectiveFrom: input.effectiveFrom }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).pop();
  const becomesCurrent = latestAfter?.id === entryId && !employee.exit_date;
  try {
    await tenantTx(access, [
      ...(becomesCurrent || isFirst
        ? becomesCurrent
          ? applyToEmployee(access, employee.id, position, isFirst ? input.effectiveFrom : undefined)
          : [
            sqlClient`select set_config('app.job_history_recorded', 'on', true)`,
            sqlClient`update employees set joining_date = ${input.effectiveFrom}::date, updated_at = clock_timestamp() where tenant_id = ${access.tenantId} and id = ${employee.id}`,
          ]
        : []),
      insertHistory(access, employee.id, input.movementType, input.effectiveFrom, position, input.reason, "correction", entryId),
      audit(access, employee.id, "people.job_history_correction", input.reason, { corrects: entryId, movementType: input.movementType, effectiveFrom: input.effectiveFrom, ...position }, requestId),
    ]);
  } catch (error) {
    databaseError(error);
  }
  return { corrected: entryId, current: becomesCurrent };
}
