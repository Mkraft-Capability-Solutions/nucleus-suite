import { config } from "dotenv";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

import type { Access } from "@/server/platform/access";

config({ path: [".env.local", ".env"], quiet: true });

/**
 * Shared fixture for the client acceptance scenarios (T-01 … T-40 in
 * docs/Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx).
 *
 * The scenarios run against the live `mkraft` demo tenant, which
 * `scripts/seed-acceptance-demo.ts` configures from values the workbook itself states
 * (its configuration register defaults and its worked examples). Every scenario creates
 * its own employees under a `T-nn` code prefix and removes them afterwards, so the
 * suite is re-runnable and never depends on a previous run's rows.
 *
 * Opt in with MKRAFT_LIVE_VERIFY=1 and DATABASE_URL on the direct (non-pooled) endpoint.
 */

export const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);

export const TENANT_SLUG = "mkraft";

/** Actors the acceptance seed guarantees on the tenant, by the role each plays. */
export const ACTORS = {
  owner: "superadmin@mkraft.demo",
  hrManager: "hr@mkraft.demo",
  hrHead: "hrhead.acceptance@mkraft.demo",
  payrollAdmin: "payroll.acceptance@mkraft.demo",
  finance: "finance.acceptance@mkraft.demo",
  director: "director.acceptance@mkraft.demo",
  /** Reporting manager for scenario employees; also the Supervisor approval level. */
  supervisor: "supervisor.acceptance@mkraft.demo",
  /** Holds the HOD position of the acceptance department. */
  hod: "hod.acceptance@mkraft.demo",
  /** A plant-scoped user for R-09: may see plant attendance, never head-office salary. */
  plantUser: "plant.acceptance@mkraft.demo",
} as const;
export type ActorKey = keyof typeof ACTORS;

/** Shift codes the seed publishes on the shift master, with the workbook's durations. */
export const SHIFTS = {
  /** 12-hour general shift, 08:00–20:00. The T-01 session runs against this. */
  A: "A",
  /** 12-hour night shift, 20:00–08:00. T-27 detects this from a 20:05 punch. */
  B: "B",
  /** 8-hour shift, 08:00–16:00. */
  C: "C",
  /** 10-hour shift for T-24's second round. */
  D10: "D10",
  /** 9-hour shift for T-24's second round. */
  E9: "E9",
} as const;

/** Departments and locations the seed guarantees, used as sanction and scope keys. */
export const ACCEPTANCE_DEPARTMENT = "Acceptance";
export const PLANT_LOCATION = "Plant North";
export const HEAD_OFFICE_LOCATION = "Head Office";

/** Worker categories the seed publishes on the `worker-categories` register. */
export const WORKER_CATEGORIES = {
  regular: "ACC-REGULAR",
  contractual: "ACC-CONTRACT",
  thirdPartyEmployee: "ACC-3P-EMPLOYEE",
  thirdPartyHelper: "ACC-3P-HELPER",
} as const;

/**
 * Designation levels the seed assigns, so grade-rank rules can be exercised by name.
 *
 * The levels are the demo dataset's own grade ranks (sheet 05 `Grade rank`), not a
 * private 1-10 ladder. `employees.designation_level` is a single column shared by the
 * whole tenant, and the thresholds compared against it — the grace exemption and RL-07's
 * senior band — are one value each for the tenant. Two ladders in that column means one
 * cohort is always judged against the other's threshold, so there is only ever one
 * correct scale here and it is the client's.
 *
 * Operator is DES-13 (20), Assistant Manager is DES-07 (50) — the first rank sheet 41
 * exempts from the late penalty — and AGM is DES-04 Assistant General Manager (70), the
 * lowest rank in sheet 05's AGM_AND_ABOVE leave band.
 */
export const DESIGNATIONS = {
  operator: { title: "Operator", level: 20 },
  assistantManager: { title: "Assistant Manager", level: 50 },
  agm: { title: "AGM", level: 70 },
} as const;

let clientRef: NeonQueryFunction<false, false> | null = null;
export function db(): NeonQueryFunction<false, false> {
  if (!clientRef) clientRef = neon(process.env.DATABASE_URL!);
  return clientRef;
}

let tenantIdRef: string | null = null;
export async function tenantId(): Promise<string> {
  if (tenantIdRef) return tenantIdRef;
  const rows = (await db()`select id from tenants where slug = ${TENANT_SLUG} limit 1`) as Array<{ id: string }>;
  if (!rows[0]) throw new Error(`Tenant "${TENANT_SLUG}" is not seeded. Run: npx tsx scripts/seed-mkraft-demo.ts && npx tsx scripts/seed-acceptance-demo.ts`);
  tenantIdRef = rows[0].id;
  return tenantIdRef;
}

/** An Access for a seeded actor, with the live permission set of its membership roles. */
export async function accessFor(actor: ActorKey): Promise<Access> {
  const email = ACTORS[actor];
  const tenant = await tenantId();
  const users = (await db()`select id from "user" where email = ${email} limit 1`) as Array<{ id: string }>;
  const userId = users[0]?.id;
  if (!userId) throw new Error(`Acceptance actor ${email} is not seeded. Run scripts/seed-acceptance-demo.ts.`);
  const rows = (await db()`
    select m.id as membership_id, m.employee_id,
      coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys,
      coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') as role_codes
    from memberships m
    left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
    left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
    left join permissions p on p.id = rp.permission_id and p.status = 'active'
    where m.user_id = ${userId} and m.tenant_id = ${tenant} and m.status = 'active'
    group by m.id, m.employee_id
  `) as Array<{ membership_id: string; employee_id: string | null; permission_keys: string[]; role_codes: string[] }>;
  const membership = rows[0];
  if (!membership) throw new Error(`Acceptance actor ${email} has no active membership on ${TENANT_SLUG}.`);
  return {
    context: {
      actorUserId: userId,
      membershipId: membership.membership_id,
      tenantId: tenant,
      permissions: membership.permission_keys ?? [],
      roles: membership.role_codes ?? [],
      employeeId: membership.employee_id ?? undefined,
    },
    tenantId: tenant,
  } as Access;
}

export type ScenarioEmployeeOptions = {
  /** Test id, used as the employee-code prefix so leftovers are attributable. */
  test: string;
  firstName?: string;
  lastName?: string;
  designation?: keyof typeof DESIGNATIONS;
  department?: string;
  location?: string;
  joiningDate?: string;
  basicSalaryMinor?: number;
  /** Employee code of the reporting manager; defaults to the seeded supervisor. */
  managerCode?: string | null;
  /** Where payroll is processed, for R-09. Defaults to the work location. */
  payrollOwner?: string;
  /** A `WORKER_CATEGORIES` code; links the employment to that category. */
  workerCategory?: keyof typeof WORKER_CATEGORIES;
  dateOfBirth?: string;
};

export type ScenarioEmployee = { id: string; code: string; personId: string };

/**
 * Creates one employee for a scenario. Codes are `T-nn-<random>` so a failed run's
 * leftovers are visible and `removeScenarioRows` can find them.
 */
export async function createScenarioEmployee(options: ScenarioEmployeeOptions): Promise<ScenarioEmployee> {
  const tenant = await tenantId();
  const client = db();
  const personId = crypto.randomUUID();
  const id = crypto.randomUUID();
  const code = `${options.test}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const designation = DESIGNATIONS[options.designation ?? "operator"];
  const location = options.location ?? PLANT_LOCATION;
  const managerCode = options.managerCode === undefined ? await supervisorCode() : options.managerCode;
  const managerRows = managerCode
    ? ((await client`select id from employees where tenant_id = ${tenant} and employee_code = ${managerCode} limit 1`) as Array<{ id: string }>)
    : [];
  await client`insert into people (id, tenant_id) values (${personId}, ${tenant})`;
  await client`
    insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, designation_level,
      department, location, joining_date, basic_salary_minor, manager_employee_id, payroll_owner, metadata)
    values (${id}, ${tenant}, ${personId}, ${code}, ${options.firstName ?? "Scenario"}, ${options.lastName ?? options.test},
      ${designation.title}, ${designation.level}, ${options.department ?? ACCEPTANCE_DEPARTMENT}, ${location},
      ${options.joiningDate ?? "2024-01-15"}, ${options.basicSalaryMinor ?? 4_000_000},
      ${managerRows[0]?.id ?? null}, ${options.payrollOwner ?? location},
      ${JSON.stringify(options.dateOfBirth ? { dateOfBirth: options.dateOfBirth } : {})}::jsonb)
  `;
  // Every scenario employee gets a worker category, defaulting to the regular monthly one.
  // The category is where the wage basis lives (RL-26), and payroll refuses by name for an
  // employee whose basis is unstated — correctly, but a scenario about loans or statutory
  // forms is not a scenario about missing configuration. A test that needs a different
  // basis, or the refusal itself, names the category it wants.
  await linkWorkerCategory(id, WORKER_CATEGORIES[options.workerCategory ?? "regular"]);
  return { id, code, personId };
}

async function supervisorCode(): Promise<string | null> {
  const tenant = await tenantId();
  const rows = (await db()`
    select e.employee_code from employees e join memberships m on m.employee_id = e.id and m.tenant_id = e.tenant_id
    join "user" u on u.id = m.user_id where e.tenant_id = ${tenant} and u.email = ${ACTORS.supervisor} limit 1
  `) as Array<{ employee_code: string }>;
  return rows[0]?.employee_code ?? null;
}

/**
 * Links an employee to a worker category through an `employments` row.
 *
 * Two stores hold a worker category and they are joined BY CODE, not by id:
 * `employments.worker_category_id` points at a `worker_categories` row, and
 * `getEmployeeWorkRules` then finds the published `worker-categories` operational record
 * whose `data->>'code'` equals that row's `attributes->>'code'` (see work-rules.ts).
 * Pointing the employment straight at the operational record's id — the obvious mistake —
 * resolves to no policy at all.
 */
export async function linkWorkerCategory(employeeId: string, categoryCode: string): Promise<void> {
  const tenant = await tenantId();
  const client = db();
  const published = (await client`
    select id from hrms_operation_records where tenant_id = ${tenant} and resource = 'worker-categories'
      and data->>'code' = ${categoryCode} and status in ('published', 'approved') limit 1
  `) as Array<{ id: string }>;
  if (!published[0]) throw new Error(`Worker category ${categoryCode} is not published. Run scripts/seed-acceptance-demo.ts.`);
  const existing = (await client`
    select id from worker_categories where tenant_id = ${tenant} and attributes->>'code' = ${categoryCode} limit 1
  `) as Array<{ id: string }>;
  let categoryId = existing[0]?.id;
  if (!categoryId) {
    categoryId = crypto.randomUUID();
    await client`
      insert into worker_categories (id, tenant_id, record_status, attributes)
      values (${categoryId}, ${tenant}, 'active', ${JSON.stringify({ code: categoryCode, name: categoryCode })}::jsonb)
    `;
  }
  const entity = (await client`select id from legal_entities where tenant_id = ${tenant} limit 1`) as Array<{ id: string }>;
  if (!entity[0]) throw new Error("The tenant has no legal entity; employments.legal_entity_id is not nullable.");
  await client`
    insert into employments (id, tenant_id, employee_id, legal_entity_id, worker_category_id, record_status, attributes)
    values (${crypto.randomUUID()}, ${tenant}, ${employeeId}, ${entity[0].id}, ${categoryId}, 'active',
      ${JSON.stringify({ employeeId, workerCategoryId: categoryId, effectiveFrom: "2024-01-01", contractType: "permanent" })}::jsonb)
  `;
}

/**
 * Removes everything a scenario created, by employee-code prefix. Called from `afterAll`,
 * and safe to call for a prefix that created nothing.
 */
export async function removeScenarioRows(test: string): Promise<void> {
  const tenant = await tenantId();
  const client = db();
  const prefix = `${test}-%`;
  const employees = (await client`select id, person_id from employees where tenant_id = ${tenant} and employee_code like ${prefix}`) as Array<{ id: string; person_id: string }>;
  if (employees.length === 0) return;
  const ids = employees.map((row) => row.id);
  // Two tables are not keyed by employee_id and both RESTRICT the deletes below, so they
  // have to go first or the final `delete from employees` throws: attendance breaks hang
  // off a session, and assignments off an employment.
  await client`
    delete from attendance_breaks where tenant_id = ${tenant} and attendance_session_id in (
      select id from attendance_sessions where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[]))
  `;
  // Everything that hangs off an employment rather than off the employee. These are the
  // five tables that RESTRICT `employments`, and none of them carries `employee_id`, so
  // the keyed-by-employee sweep below cannot reach them: the employment survived, and the
  // final `delete from employees` failed on a constraint whose real cause was three
  // tables away. Onboarding tasks go before their instance for the same reason.
  await client`
    delete from onboarding_tasks where tenant_id = ${tenant} and onboarding_instance_id in (
      select oi.id from onboarding_instances oi
      join employments em on em.id = oi.employment_id and em.tenant_id = oi.tenant_id
      where oi.tenant_id = ${tenant} and em.employee_id = any(${ids}::uuid[]))
  `;
  // Two more tables hang off attendance_entries (by attendance_entry_id, not employee_id)
  // and RESTRICT it, same reasoning as above — clear them before the keyed sweep below
  // reaches attendance_entries itself.
  for (const table of ["attendance_regularizations", "attendance_exceptions", "overtime_entries"]) {
    await client.query(
      `delete from ${table} where tenant_id = $1 and attendance_entry_id in (
         select id from attendance_entries where tenant_id = $1 and employee_id = any($2::uuid[]))`,
      [tenant, ids],
    );
  }
  for (const table of ["employee_assignments", "contract_worker_assignments", "full_final_settlements", "offboarding_cases", "onboarding_instances"]) {
    await client.query(
      `delete from ${table} where tenant_id = $1 and employment_id in (
         select id from employments where tenant_id = $1 and employee_id = any($2::uuid[]))`,
      [tenant, ids],
    );
  }
  for (const table of [
    "attendance_breaks", "attendance_sessions", "attendance_entries", "attendance_events", "attendance_punches", "attendance_days",
    "leave_ledger_entries", "leave_approvals", "leave_requests", "comp_off_grants", "gate_passes",
    "employee_loans", "loan_guarantors", "loans", "salary_advances", "payroll_inputs", "payslips",
    "employments", "employee_assignments", "referrals", "referral_awards", "generated_letters",
    "recognition_events", "onboarding_tasks", "onboarding_instances", "clearance_items", "offboarding_cases", "lifecycle_events",
  ]) {
    // Not every envelope table carries employee_id under the same name; each is tried and
    // a table without the column is simply skipped.
    try {
      await client.query(`delete from ${table} where tenant_id = $1 and employee_id = any($2::uuid[])`, [tenant, ids]);
    } catch (error) {
      // Only "column does not exist" is expected here. A constraint failure means a child
      // row is still standing, and swallowing it turned a precise error into a confusing
      // one at the end of the sweep; it is reported against the table that actually failed.
      if ((error as { code?: string }).code !== "42703") {
        throw new Error(`cleanup of ${table} failed: ${(error as Error).message}`);
      }
    }
  }
  // hrms_operation_events references hrms_operation_records by id and must go first —
  // a scenario that both creates a record and transitions it (e.g. a ticket raised and
  // then resolved) leaves an event row the record delete below would otherwise violate.
  await client`
    delete from hrms_operation_events where tenant_id = ${tenant} and record_id in (
      select id from hrms_operation_records where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])
    )
  `;
  await client`delete from hrms_operation_records where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
  await client`delete from employees where tenant_id = ${tenant} and id = any(${ids}::uuid[])`;
  await client`delete from people where tenant_id = ${tenant} and id = any(${employees.map((row) => row.person_id)}::uuid[])`;
}

/** ISO date `days` after `date`, for scenarios stated in relative terms. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** A punch instant on `date` at `HH:MM` in the tenant's timezone (Asia/Kolkata). */
export function at(date: string, time: string): string {
  return `${date}T${time}:00+05:30`;
}
