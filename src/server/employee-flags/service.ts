import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import {
  FLAG_RULES, FLAG_RULE_KEYS, evaluateEmployee, resolveRules, sortFlags,
  type EmployeeFlag, type FlagRule, type FlaggableEmployee,
} from "@/lib/employee-flags";
import { enforce, recordAudit, tenantTx, type Access } from "@/server/platform/access";
import { isEntitled } from "@/server/entitlements/service";
import { organisationContext } from "@/server/dashboards/query";

/**
 * Employee flags (warnings and alerts) from the employee records, under the organisation's rules
 * (employee_flag_rules, migration 0034; evaluation in src/lib/employee-flags.ts).
 *
 * - Rules: read by anyone who may read employees; changed by administrators (tenant.manage).
 * - The organisation-wide list: HR and administrators (employee.write), across every company of the
 *   group, filterable by company, location and department.
 * - "My flags": the signed-in person's own record and their direct reports', for the message shown
 *   after signing in.
 */

export const FLAG_ENTITLEMENT = "people.records.employee_flags";

const INACTIVE = ["separated", "exited", "relieved", "archived", "inactive"];

type RuleRow = { rule_key: string; enabled: boolean; warning_days: number; alert_days: number; settings: Record<string, unknown> | null; updated_at: string | null };

async function storedRules(access: Access): Promise<{ rules: FlagRule[]; updatedAt: string | null }> {
  const [rows] = await tenantTx(access, [
    sqlClient`select rule_key, enabled, warning_days, alert_days, settings, updated_at::text from employee_flag_rules where tenant_id = ${access.tenantId}`,
  ]);
  const list = rows as RuleRow[];
  const rules = resolveRules(list.map((row) => ({
    key: row.rule_key, enabled: row.enabled, warningDays: row.warning_days, alertDays: row.alert_days,
    settings: { ...(row.settings ?? {}) } as FlagRule["settings"],
  })));
  const updatedAt = list.map((row) => row.updated_at).filter(Boolean).sort().pop() ?? null;
  return { rules, updatedAt };
}

export async function getRules(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  return storedRules(access);
}

const ruleInput = z.object({
  key: z.enum(FLAG_RULE_KEYS),
  enabled: z.boolean(),
  warningDays: z.number().int().min(0).max(730),
  alertDays: z.number().int().min(0).max(730),
  settings: z.object({
    intervalMonths: z.number().int().min(1).max(60).optional(),
    retirementAge: z.number().int().min(50).max(75).optional(),
  }).strict().default({}),
}).strict().refine((rule) => rule.alertDays <= rule.warningDays, { path: ["alertDays"], message: "The alert cannot start earlier than the warning." });

export const saveRulesSchema = z.object({ rules: z.array(ruleInput).min(1).max(FLAG_RULES.length) }).strict()
  .refine((input) => new Set(input.rules.map((rule) => rule.key)).size === input.rules.length, { path: ["rules"], message: "Each rule may appear once." });

export async function saveRules(access: Access, input: z.infer<typeof saveRulesSchema>, requestId?: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const statements = input.rules.map((rule) => {
    const definition = FLAG_RULES.find((entry) => entry.key === rule.key)!;
    // Keep only the setting this rule understands.
    const settings = definition.setting ? { [definition.setting.key]: rule.settings[definition.setting.key] ?? definition.defaults.settings[definition.setting.key] } : {};
    return sqlClient`
      insert into employee_flag_rules (tenant_id, rule_key, enabled, warning_days, alert_days, settings, updated_by)
      values (${access.tenantId}, ${rule.key}, ${rule.enabled}, ${rule.warningDays}, ${rule.alertDays}, ${JSON.stringify(settings)}::jsonb, ${access.context.actorUserId})
      on conflict (tenant_id, rule_key) do update set enabled = excluded.enabled, warning_days = excluded.warning_days,
        alert_days = excluded.alert_days, settings = excluded.settings, updated_by = excluded.updated_by, updated_at = now()`;
  });
  await tenantTx(access, statements);
  await recordAudit(access, { action: "employee_flag_rules.updated", entityType: "employee_flag_rules", entityId: access.tenantId, after: input.rules, requestId });
  return storedRules(access);
}

type EmployeeRow = {
  id: string; employee_code: string; first_name: string | null; last_name: string | null; designation: string | null;
  department: string | null; location: string | null; legal_entity_id: string | null; company: string | null;
  manager_employee_id: string | null; date_of_birth: string | null; passport_expiry: string | null; work_permit_expiry: string | null;
  international: string | null; medical_exam_date: string | null; fitness_status: string | null;
};

const EMPLOYEE_COLUMNS = `
  e.id, e.employee_code, e.first_name, e.last_name, e.designation, e.department, e.location, e.legal_entity_id,
  le.legal_name as company, e.manager_employee_id,
  coalesce(e.date_of_birth::text, e.metadata->>'dateOfBirth') as date_of_birth,
  e.metadata->>'passportExpiry' as passport_expiry,
  e.metadata->>'workPermitExpiry' as work_permit_expiry,
  e.metadata->>'isInternationalWorker' as international,
  e.metadata->>'medicalExamDate' as medical_exam_date,
  e.metadata->>'fitnessStatus' as fitness_status`;

function toFlaggable(row: EmployeeRow): FlaggableEmployee {
  return {
    id: row.id, code: row.employee_code, name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.employee_code,
    dateOfBirth: row.date_of_birth, passportExpiry: row.passport_expiry, workPermitExpiry: row.work_permit_expiry,
    isInternationalWorker: row.international === "true", medicalExamDate: row.medical_exam_date, fitnessStatus: row.fitness_status,
  };
}

async function todayFor(access: Access): Promise<string> {
  const { timezone } = await organisationContext(access);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export type FlagListItem = EmployeeFlag & {
  employee: { id: string; code: string; name: string; designation: string | null; department: string | null; location: string | null; companyId: string | null; company: string | null };
};

export const listFiltersSchema = z.object({
  company: z.string().uuid().nullable().catch(null),
  location: z.string().trim().max(200).nullable().catch(null),
  department: z.string().trim().max(200).nullable().catch(null),
  severity: z.enum(["warning", "alert"]).nullable().catch(null),
  rule: z.enum(FLAG_RULE_KEYS).nullable().catch(null),
});

/** Every flag in the organisation (all companies of the group), for HR and administrators. Read-only. */
export async function listFlags(access: Access, filters: z.infer<typeof listFiltersSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [{ rules, updatedAt }, today] = await Promise.all([storedRules(access), todayFor(access)]);
  const [employees, companies] = await tenantTx(access, [
    sqlClient.query(
      `select ${EMPLOYEE_COLUMNS}
       from employees e left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id
       where e.tenant_id = $1 and coalesce(lower(e.status), 'active') <> all($2::text[])
       order by e.first_name, e.last_name`,
      [access.tenantId, INACTIVE],
    ),
    sqlClient`select id, legal_name, parent_legal_entity_id from legal_entities where tenant_id = ${access.tenantId} order by legal_name`,
  ]);
  const rows = employees as EmployeeRow[];
  const all: FlagListItem[] = rows.flatMap((row) => {
    const person = toFlaggable(row);
    return evaluateEmployee(person, rules, today).map((flag) => ({
      ...flag,
      employee: { id: row.id, code: row.employee_code, name: person.name, designation: row.designation, department: row.department, location: row.location, companyId: row.legal_entity_id, company: row.company },
    }));
  });
  // A company filter includes its subsidiaries, divisions and branches (the group structure).
  const companyRows = companies as Array<{ id: string; legal_name: string; parent_legal_entity_id: string | null }>;
  const inCompany = new Set<string>();
  if (filters.company) {
    const queue = [filters.company];
    while (queue.length) {
      const id = queue.shift()!;
      if (inCompany.has(id)) continue;
      inCompany.add(id);
      for (const child of companyRows) if (child.parent_legal_entity_id === id) queue.push(child.id);
    }
  }
  const flags = sortFlags(all.filter((item) =>
    (!filters.company || (item.employee.companyId !== null && inCompany.has(item.employee.companyId)))
    && (!filters.location || item.employee.location === filters.location)
    && (!filters.department || item.employee.department === filters.department)
    && (!filters.severity || item.severity === filters.severity)
    && (!filters.rule || item.rule === filters.rule)));
  const distinct = (values: Array<string | null>) => [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
  return {
    today,
    rules,
    rulesUpdatedAt: updatedAt,
    flags,
    summary: {
      alerts: flags.filter((flag) => flag.severity === "alert").length,
      warnings: flags.filter((flag) => flag.severity === "warning").length,
      employees: new Set(flags.map((flag) => flag.employeeId)).size,
      checked: rows.length,
    },
    options: {
      companies: companyRows.map((company) => ({ id: company.id, name: company.legal_name, parentId: company.parent_legal_entity_id })),
      locations: distinct(rows.map((row) => row.location)),
      departments: distinct(rows.map((row) => row.department)),
    },
  };
}

/** The signed-in person's own flags and their direct reports' flags, for the message after sign-in. */
export async function myFlags(access: Access) {
  const employeeId = access.context.employeeId;
  if (!employeeId || !(await isEntitled(access, FLAG_ENTITLEMENT))) return { own: [], team: [] };
  const [{ rules }, today] = await Promise.all([storedRules(access), todayFor(access)]);
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select ${EMPLOYEE_COLUMNS}
       from employees e left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id
       where e.tenant_id = $1 and (e.id = $2::uuid or e.manager_employee_id = $2::uuid)
         and coalesce(lower(e.status), 'active') <> all($3::text[])`,
      [access.tenantId, employeeId, INACTIVE],
    ),
  ]);
  const own: EmployeeFlag[] = [];
  const team: Array<EmployeeFlag & { employeeName: string; employeeCode: string }> = [];
  for (const row of rows as EmployeeRow[]) {
    const person = toFlaggable(row);
    const flags = evaluateEmployee(person, rules, today);
    if (row.id === employeeId) own.push(...flags);
    else team.push(...flags.map((flag) => ({ ...flag, employeeName: person.name, employeeCode: person.code })));
  }
  return { own: sortFlags(own), team: sortFlags(team) };
}
