/**
 * Seeds a complete Mkraft demo company (tenant slug `mkraft`).
 *
 * Usage:
 *   npx tsx scripts/seed-mkraft-demo.ts [connectionUrl] [--clean]
 *   - No args: uses MIGRATION_DATABASE_URL from .env.local (dev dry-run).
 *   - Pass a production direct URL to seed prod.
 *   - --clean: deletes the entire mkraft tenant cascade and exits.
 *
 * Refuses to run when the tenant already exists (unless --clean is used first).
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

const TENANT_SLUG = "mkraft";
const DEMO_PASSWORD = "Demo@Mkraft2026";

const STANDARD_ROLES = {
  "hr-manager": ["tenant.read", "employee.read", "employee.write", "attendance.read", "attendance.write", "leave.read", "leave.approve", "role.manage", "membership.manage", "membership.read"],
  "payroll-admin": ["tenant.read", "employee.read", "attendance.read", "payroll.read", "payroll.run", "payroll.rate.read"],
  manager: ["tenant.read", "employee.read", "attendance.read", "attendance.write", "leave.read", "leave.approve"],
  employee: ["tenant.read", "employee.read", "attendance.read", "leave.read"],
} as const;

type RosterEntry = {
  code: string; first: string; last: string; email: string; roleCode: string;
  designation: string; department: string; location: string; joining: string;
  salaryMinor: number; managerCode: string | null; memberRole: string;
};

const ROSTER: RosterEntry[] = [
  { code: "MK-001", first: "Arjun", last: "Mehta", email: "superadmin@mkraft.demo", roleCode: "owner", designation: "Managing Director", department: "Management", location: "Head Office", joining: "2018-04-02", salaryMinor: 15000000, managerCode: null, memberRole: "owner" },
  { code: "MK-002", first: "Priya", last: "Sharma", email: "hr@mkraft.demo", roleCode: "hr-manager", designation: "HR Manager", department: "Human Resources", location: "Head Office", joining: "2019-06-10", salaryMinor: 8500000, managerCode: "MK-001", memberRole: "employee" },
  { code: "MK-003", first: "Rahul", last: "Verma", email: "payroll@mkraft.demo", roleCode: "payroll-admin", designation: "Payroll Officer", department: "Finance", location: "Head Office", joining: "2020-01-15", salaryMinor: 6500000, managerCode: "MK-001", memberRole: "employee" },
  { code: "MK-004", first: "Suresh", last: "Kumar", email: "plant.head@mkraft.demo", roleCode: "manager", designation: "Plant Head", department: "Production", location: "Plant North", joining: "2018-08-20", salaryMinor: 9500000, managerCode: "MK-001", memberRole: "employee" },
  { code: "MK-005", first: "Kavita", last: "Rao", email: "weaving.sup@mkraft.demo", roleCode: "manager", designation: "Weaving Supervisor", department: "Weaving", location: "Plant North", joining: "2020-03-01", salaryMinor: 4800000, managerCode: "MK-004", memberRole: "employee" },
  { code: "MK-006", first: "Mohan", last: "Das", email: "dyeing.sup@mkraft.demo", roleCode: "manager", designation: "Dyeing Supervisor", department: "Dyeing", location: "Plant North", joining: "2021-07-12", salaryMinor: 4600000, managerCode: "MK-004", memberRole: "employee" },
  { code: "MK-007", first: "Anil", last: "Yadav", email: "anil.y@mkraft.demo", roleCode: "employee", designation: "Weaving Operator", department: "Weaving", location: "Plant North", joining: "2021-02-01", salaryMinor: 2600000, managerCode: "MK-005", memberRole: "employee" },
  { code: "MK-008", first: "Ramesh", last: "Gupta", email: "ramesh.g@mkraft.demo", roleCode: "employee", designation: "Weaving Operator", department: "Weaving", location: "Plant North", joining: "2022-06-15", salaryMinor: 2400000, managerCode: "MK-005", memberRole: "employee" },
  { code: "MK-009", first: "Sunita", last: "Devi", email: "sunita.d@mkraft.demo", roleCode: "employee", designation: "Weaving Operator", department: "Weaving", location: "Plant North", joining: "2023-01-10", salaryMinor: 2300000, managerCode: "MK-005", memberRole: "employee" },
  { code: "MK-010", first: "Vikash", last: "Kumar", email: "vikash.k@mkraft.demo", roleCode: "employee", designation: "Stitching Operator", department: "Stitching", location: "Plant North", joining: "2022-09-01", salaryMinor: 2500000, managerCode: "MK-004", memberRole: "employee" },
  { code: "MK-011", first: "Farhan", last: "Ali", email: "farhan.a@mkraft.demo", roleCode: "employee", designation: "Dyeing Operator", department: "Dyeing", location: "Plant North", joining: "2021-11-20", salaryMinor: 2700000, managerCode: "MK-006", memberRole: "employee" },
  { code: "MK-012", first: "Geeta", last: "Kumari", email: "geeta.k@mkraft.demo", roleCode: "employee", designation: "Dyeing Operator", department: "Dyeing", location: "Plant North", joining: "2023-04-05", salaryMinor: 2500000, managerCode: "MK-006", memberRole: "employee" },
  { code: "MK-013", first: "Neha", last: "Agarwal", email: "finance@mkraft.demo", roleCode: "employee", designation: "Accounts Executive", department: "Finance", location: "Head Office", joining: "2022-02-01", salaryMinor: 4200000, managerCode: "MK-001", memberRole: "employee" },
  { code: "MK-014", first: "Arvind", last: "Singh", email: "it@mkraft.demo", roleCode: "employee", designation: "IT Support Engineer", department: "IT", location: "Head Office", joining: "2023-05-15", salaryMinor: 3800000, managerCode: "MK-002", memberRole: "employee" },
];

const DEPARTMENTS = ["Management", "Human Resources", "Finance", "Production", "Weaving", "Dyeing", "Stitching", "IT"];
const LEAVE_OPENING = [{ type: "CL", balance: 12 }, { type: "SL", balance: 12 }, { type: "EL", balance: 18 }] as const;

function connectionUrl(): string {
  const arg = process.argv.find((a) => a.startsWith("postgres"));
  if (arg) return arg;
  const configuration = readRuntimeConfiguration();
  if (!configuration.migrationDatabaseUrl) throw new Error("Pass a connection URL or set MIGRATION_DATABASE_URL.");
  return configuration.migrationDatabaseUrl;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function clean(client: any) {
  const tenants = (await client`select id from tenants where slug = ${TENANT_SLUG}`) as Array<{ id: string }>;
  if (tenants.length === 0) {
    console.info("No mkraft tenant found; nothing to clean.");
    return;
  }
  const tenantId = tenants[0].id;
  const emails = ROSTER.map((r) => r.email);
  await client`delete from audit_events where tenant_id = ${tenantId}`;
  await client`delete from access_events where tenant_id = ${tenantId}`;
  await client`delete from idempotency_keys where tenant_id = ${tenantId}`;
  await client`delete from notifications where tenant_id = ${tenantId}`;
  await client`delete from transactional_outbox where tenant_id = ${tenantId}`;
  await client`delete from benefit_enrollments where tenant_id = ${tenantId}`;
  await client`delete from benefit_plans where tenant_id = ${tenantId}`;
  await client`delete from contractor_invoices where tenant_id = ${tenantId}`;
  await client`delete from contractor_contracts where tenant_id = ${tenantId}`;
  await client`delete from contractor_organizations where tenant_id = ${tenantId}`;
  await client`delete from delegation_windows where tenant_id = ${tenantId}`;
  await client`delete from feedback_entries where tenant_id = ${tenantId}`;
  await client`delete from feedback_requests where tenant_id = ${tenantId}`;
  await client`delete from compliance_calendar_items where tenant_id = ${tenantId}`;
  await client`delete from feed_posts where tenant_id = ${tenantId}`;
  await client`delete from enrollments where tenant_id = ${tenantId}`;
  await client`delete from course_versions where tenant_id = ${tenantId}`;
  await client`delete from courses where tenant_id = ${tenantId}`;
  await client`delete from learning_paths where tenant_id = ${tenantId}`;
  await client`delete from employee_skills where tenant_id = ${tenantId}`;
  await client`delete from skills where tenant_id = ${tenantId}`;
  await client`delete from offers where tenant_id = ${tenantId}`;
  await client`delete from interview_sessions where tenant_id = ${tenantId}`;
  await client`delete from interview_plans where tenant_id = ${tenantId}`;
  await client`delete from applications where tenant_id = ${tenantId}`;
  await client`delete from candidates where tenant_id = ${tenantId}`;
  await client`delete from integration_connections where tenant_id = ${tenantId} and attributes->>'code' = 'manual-demo'`;
  await client`delete from requisitions where tenant_id = ${tenantId}`;
  await client`delete from payroll_inputs where tenant_id = ${tenantId}`;
  await client`delete from salary_advances where tenant_id = ${tenantId}`;
  await client`delete from loan_schedules where tenant_id = ${tenantId}`;
  await client`delete from loan_guarantors where tenant_id = ${tenantId}`;
  await client`delete from employee_loans where tenant_id = ${tenantId}`;
  await client`delete from loans where tenant_id = ${tenantId}`;
  await client`delete from loan_products where tenant_id = ${tenantId}`;
  await client`delete from attendance_punches where tenant_id = ${tenantId}`;
  await client`delete from attendance_days where tenant_id = ${tenantId}`;
  await client`delete from notifications where tenant_id = ${tenantId}`;
  await client`delete from notification_preferences where tenant_id = ${tenantId}`;
  await client`delete from leave_approvals where tenant_id = ${tenantId}`;
  await client`delete from leave_ledger_entries where tenant_id = ${tenantId}`;
  await client`delete from leave_requests where tenant_id = ${tenantId}`;
  await client`delete from leave_balances where tenant_id = ${tenantId}`;
  await client`delete from leave_types where tenant_id = ${tenantId}`;
  await client`update memberships set employee_id = null where tenant_id = ${tenantId}`;
  await client`delete from employees where tenant_id = ${tenantId}`;
  await client`update departments set hod_position_id = null where tenant_id = ${tenantId}`;
  await client`delete from positions where tenant_id = ${tenantId}`;
  await client`delete from job_profiles where tenant_id = ${tenantId}`;
  await client`delete from grades where tenant_id = ${tenantId}`;
  await client`delete from departments where tenant_id = ${tenantId}`;
  await client`delete from business_units where tenant_id = ${tenantId}`;
  await client`delete from legal_entities where tenant_id = ${tenantId}`;
  await client`delete from membership_roles where tenant_id = ${tenantId}`;
  await client`delete from memberships where tenant_id = ${tenantId}`;
  await client`delete from invitations where tenant_id = ${tenantId}`;
  await client`delete from role_permissions where tenant_id = ${tenantId}`;
  await client`delete from roles where tenant_id = ${tenantId}`;
  await client`delete from people where tenant_id = ${tenantId}`;
  await client`delete from tenant_settings where tenant_id = ${tenantId}`;
  await client`delete from account where user_id in (select id from "user" where email = any(${emails}))`;
  await client`delete from session where user_id in (select id from "user" where email = any(${emails}))`;
  await client`delete from "user" where email = any(${emails})`;
  await client`delete from tenants where id = ${tenantId}`;
  console.info(`Cleaned mkraft tenant ${tenantId}.`);
}

async function main() {
  const client = neon(connectionUrl());
  if (process.argv.includes("--clean")) {
    await clean(client);
    return;
  }
  const existing = (await client`select id from tenants where slug = ${TENANT_SLUG} limit 1`) as Array<{ id: string }>;
  if (existing.length > 0) throw new Error("Tenant slug 'mkraft' already exists. Run with --clean first to reseed.");

  const jurisdictions = (await client`select id from jurisdictions order by created_at limit 1`) as Array<{ id: string }>;
  if (jurisdictions.length === 0) throw new Error("No jurisdictions reference row found; cannot create legal entity.");
  const jurisdictionId = jurisdictions[0].id;

  // Tenant + settings.
  const tenantId = randomUUID();
  await client`insert into tenants (id, name, slug, legal_name) values (${tenantId}, 'Mkraft', ${TENANT_SLUG}, 'Mkraft Textiles Pvt Ltd')`;
  await client`insert into tenant_settings (tenant_id, locale, timezone, currency) values (${tenantId}, 'en-IN', 'Asia/Kolkata', 'INR')`;

  // Legal entity -> business units -> departments.
  const legalEntityId = randomUUID();
  await client`insert into legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code) values (${legalEntityId}, ${tenantId}, ${jurisdictionId}, 'MKRAFT', 'Mkraft Textiles Pvt Ltd', 'INR')`;
  const attrs = (name: string, code: string) => JSON.stringify({ name, code });
  const buHo = randomUUID();
  const buPlant = randomUUID();
  await client`insert into business_units (id, tenant_id, legal_entity_id, attributes) values (${buHo}, ${tenantId}, ${legalEntityId}, ${attrs("Head Office", "HO")}::jsonb)`;
  await client`insert into business_units (id, tenant_id, legal_entity_id, attributes) values (${buPlant}, ${tenantId}, ${legalEntityId}, ${attrs("Plant North", "PLANT")}::jsonb)`;
  const deptIds: Record<string, string> = {};
  for (const name of DEPARTMENTS) {
    const id = randomUUID();
    const bu = ["Weaving", "Dyeing", "Stitching", "Production"].includes(name) ? buPlant : buHo;
    const code = name.toUpperCase().replace(/[^A-Z]+/g, "-");
    await client`insert into departments (id, tenant_id, business_unit_id, attributes) values (${id}, ${tenantId}, ${bu}, ${attrs(name, code)}::jsonb)`;
    deptIds[name] = id;
  }

  // Grades + job profiles + positions.
  const gradeIds: Record<string, string> = {};
  for (const [code, name] of [["G-EXEC", "Executive"], ["G-MGR", "Manager"], ["G-SUP", "Supervisor"], ["G-STAFF", "Staff"]]) {
    const id = randomUUID();
    await client`insert into grades (id, tenant_id, attributes) values (${id}, ${tenantId}, ${attrs(name, code)}::jsonb)`;
    gradeIds[code] = id;
  }
  const profileIds: Record<string, string> = {};
  for (const [code, name, grade] of [["P-DIR", "Director", "G-EXEC"], ["P-MGR", "Manager", "G-MGR"], ["P-SUP", "Supervisor", "G-SUP"], ["P-OP", "Operator", "G-STAFF"], ["P-EXE", "Executive", "G-STAFF"]] as Array<[string, string, string]>) {
    const id = randomUUID();
    await client`insert into job_profiles (id, tenant_id, default_grade_id, attributes) values (${id}, ${tenantId}, ${gradeIds[grade]}, ${attrs(name, code)}::jsonb)`;
    profileIds[code] = id;
  }
  const positionIds: Record<string, string> = {};
  const positionDefs: Array<[string, string, string, string, string | null]> = [
    ["POS-MD", "Managing Director", "Management", "P-DIR", null],
    ["POS-HRM", "HR Manager", "Human Resources", "P-MGR", "POS-MD"],
    ["POS-PAY", "Payroll Officer", "Finance", "P-EXE", "POS-MD"],
    ["POS-PH", "Plant Head", "Production", "P-MGR", "POS-MD"],
    ["POS-WVS", "Weaving Supervisor", "Weaving", "P-SUP", "POS-PH"],
    ["POS-DYS", "Dyeing Supervisor", "Dyeing", "P-SUP", "POS-PH"],
    ["POS-WVO", "Weaving Operator", "Weaving", "P-OP", "POS-WVS"],
    ["POS-DYO", "Dyeing Operator", "Dyeing", "P-OP", "POS-DYS"],
    ["POS-STO", "Stitching Operator", "Stitching", "P-OP", "POS-PH"],
    ["POS-ACC", "Accounts Executive", "Finance", "P-EXE", "POS-MD"],
    ["POS-ITS", "IT Support Engineer", "IT", "P-EXE", "POS-HRM"],
  ];
  for (const [code, name, dept, profile, reportsTo] of positionDefs) {
    const id = randomUUID();
    const grade = profile === "P-DIR" ? gradeIds["G-EXEC"] : profile === "P-MGR" ? gradeIds["G-MGR"] : profile === "P-SUP" ? gradeIds["G-SUP"] : gradeIds["G-STAFF"];
    await client`insert into positions (id, tenant_id, department_id, grade_id, job_profile_id, reports_to_position_id, attributes) values (${id}, ${tenantId}, ${deptIds[dept]}, ${grade}, ${profileIds[profile]}, ${reportsTo ? positionIds[reportsTo] : null}, ${attrs(name, code)}::jsonb)`;
    positionIds[code] = id;
  }
  await client`update departments set hod_position_id = ${positionIds["POS-HRM"]} where id = ${deptIds["Human Resources"]}`;
  await client`update departments set hod_position_id = ${positionIds["POS-PH"]} where id = ${deptIds["Production"]}`;

  // Roles + permissions.
  const ownerRoleId = randomUUID();
  await client`insert into roles (id, tenant_id, code, name, system_managed, status) values (${ownerRoleId}, ${tenantId}, 'owner', 'Workspace Owner', true, 'active')`;
  await client`insert into role_permissions (tenant_id, role_id, permission_id) select ${tenantId}, ${ownerRoleId}, id from permissions where status = 'active'`;
  const roleIds: Record<string, string> = { owner: ownerRoleId };
  for (const [code, keys] of Object.entries(STANDARD_ROLES)) {
    const id = randomUUID();
    await client`insert into roles (id, tenant_id, code, name, system_managed, status) values (${id}, ${tenantId}, ${code}, ${code}, true, 'active')`;
    await client`insert into role_permissions (tenant_id, role_id, permission_id) select ${tenantId}, ${id}, p.id from permissions p where p.permission_key = any(${keys}) and p.status = 'active'`;
    roleIds[code] = id;
  }

  // Users + credentials + memberships.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const employeeIds: Record<string, string> = {};
  const membershipByCode: Record<string, string> = {};
  for (const entry of ROSTER) {
    const userId = randomUUID();
    const membershipId = randomUUID();
    const personId = randomUUID();
    const employeeId = randomUUID();
    await client`insert into "user" (id, name, email, email_verified, status) values (${userId}, ${entry.first + " " + entry.last}, ${entry.email}, true, 'active')`;
    await client`insert into account (id, account_id, provider_id, user_id, password) values (${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash})`;
    await client`insert into invitations (tenant_id, email, token_hash, status, invited_by_user_id, accepted_user_id, expires_at, accepted_at) values (${tenantId}, ${entry.email}, ${"seed-" + entry.code}, 'accepted', ${userId}, ${userId}, now() + interval '1 day', now())`;
    await client`insert into memberships (id, tenant_id, user_id, role, status) values (${membershipId}, ${tenantId}, ${userId}, ${entry.memberRole}, 'active')`;
    await client`insert into membership_roles (tenant_id, membership_id, role_id) select ${tenantId}, ${membershipId}, id from roles where tenant_id = ${tenantId} and code = ${entry.roleCode}`;
    await client`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await client`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${entry.code}, ${entry.first}, ${entry.last}, ${entry.designation}, ${entry.department}, ${entry.location}, ${entry.joining}, ${entry.salaryMinor})`;
    await client`update memberships set employee_id = ${employeeId} where id = ${membershipId}`;
    employeeIds[entry.code] = employeeId;
    membershipByCode[entry.code] = membershipId;
  }
  for (const entry of ROSTER) {
    if (entry.managerCode) {
      await client`update employees set manager_employee_id = ${employeeIds[entry.managerCode]} where id = ${employeeIds[entry.code]}`;
    }
  }

  // Opening leave balances.
  for (const entry of ROSTER) {
    for (const leg of LEAVE_OPENING) {
      await client`insert into leave_balances (tenant_id, employee_id, leave_type, balance, as_of_date) values (${tenantId}, ${employeeIds[entry.code]}, ${leg.type}, ${leg.balance}, '2026-04-01')`;
    }
  }

  await seedTransactions(client, tenantId, employeeIds, membershipByCode);

  await client`insert into audit_events (tenant_id, action, entity_type, entity_id, reason, after) values (${tenantId}, 'platform.tenant_create', 'tenant', ${tenantId}, 'Mkraft demo company seeded', ${JSON.stringify({ headcount: ROSTER.length })}::jsonb)`;

  console.info(`Seeded Mkraft tenant ${tenantId} with ${ROSTER.length} employees. Login password for all demo users: ${DEMO_PASSWORD}`);
}

/**
 * Phase 2: living demo transactions across every user-visible module.
 * All rows reference only phase-1 entities; every value is deterministic.
 */
async function seedTransactions(
  client: (query: TemplateStringsArray, ...params: unknown[]) => Promise<Record<string, unknown>[]>,
  tenantId: string,
  employeeIds: Record<string, string>,
  membershipByCode: Record<string, string>,
) {
  const emp = (code: string) => employeeIds[code];
  const users = (await client`select id, email from "user" where email like '%@mkraft.demo'`) as Array<{ id: string; email: string }>;
  const userIdByEmail: Record<string, string> = {};
  for (const u of users) userIdByEmail[u.email] = u.id;

  // Leave types.
  const leaveTypeIds: Record<string, string> = {};
  for (const [code, name] of [["CL", "Casual Leave"], ["SL", "Sick Leave"], ["EL", "Earned Leave"], ["COFF", "Compensatory Off"]]) {
    const id = randomUUID();
    await client`insert into leave_types (id, tenant_id, attributes) values (${id}, ${tenantId}, ${JSON.stringify({ code, name, paid: true })}::jsonb)`;
    leaveTypeIds[code] = id;
  }

  // Attendance: Sept 1-10 history + today (Sept 11) for all hands.
  const dayId: Record<string, Record<string, string>> = {};
  const presentCodes = ["MK-001", "MK-002", "MK-003", "MK-004", "MK-005", "MK-006", "MK-007", "MK-008", "MK-009", "MK-010", "MK-011", "MK-012", "MK-013", "MK-014"];
  const recordDay = async (code: string, date: string, status: string, productive: number) => {
    const id = randomUUID();
    await client`insert into attendance_days (id, tenant_id, employee_id, attendance_date, assigned_shift, gross_span_minutes, productive_minutes, break_minutes, credited_gate_pass_minutes, payable_ot_minutes, status) values (${id}, ${tenantId}, ${emp(code)}, ${date}, 'A', 540, ${productive}, 45, 0, 0, ${status})`;
    (dayId[code] ??= {})[date] = id;
    return id;
  };
  for (let day = 1; day <= 10; day += 1) {
    const date = `2026-09-${String(day).padStart(2, "0")}`;
    for (const code of presentCodes) {
      if (code === "MK-008" && (day === 3 || day === 4)) { await recordDay(code, date, "absent", 0); continue; }
      if (code === "MK-009" && day === 7) { await recordDay(code, date, "half_day", 240); continue; }
      if (code === "MK-012" && (day === 8 || day === 9)) continue; // approved EL, no day row
      await recordDay(code, date, "present", 480);
    }
  }
  for (const code of presentCodes) {
    if (code === "MK-012") continue; // on approved leave today
    const id = await recordDay(code, "2026-09-11", "present", 300);
    const hour = 8 + (code.charCodeAt(3) % 2);
    await client`insert into attendance_punches (id, tenant_id, attendance_day_id, punched_at, type, source) values (${randomUUID()}, ${tenantId}, ${id}, ${`2026-09-11T0${hour}:04:00+05:30`}, 'in', 'biometric')`;
  }

  // Leave requests: 1 historical approved, 1 approved covering today, 2 pending.
  const leave = async (code: string, type: string, from: string, to: string, days: number, status: string, reason: string) => {
    const id = randomUUID();
    await client`insert into leave_requests (id, tenant_id, employee_id, leave_type, starts_on, ends_on, requested_days, status, reason, leave_type_id) values (${id}, ${tenantId}, ${emp(code)}, ${type}, ${from}, ${to}, ${days}, ${status}, ${reason}, ${leaveTypeIds[type]})`;
    return id;
  };
  await leave("MK-007", "CL", "2026-08-20", "2026-08-21", 2, "approved", "Family function");
  await leave("MK-012", "EL", "2026-09-08", "2026-09-12", 5, "approved", "Village visit");
  const pending1 = await leave("MK-009", "SL", "2026-09-14", "2026-09-14", 1, "pending_l1", "Fever");
  const pending2 = await leave("MK-011", "EL", "2026-09-17", "2026-09-18", 2, "pending_l1", "School admission");
  for (const id of [pending1, pending2]) {
    await client`insert into leave_approvals (id, tenant_id, leave_request_id, level, status) values (${randomUUID()}, ${tenantId}, ${id}, 1, 'pending')`;
  }

  // Loan book: one disbursed loan with schedule + consented guarantors.
  const productId = randomUUID();
  await client`insert into loan_products (id, tenant_id, attributes) values (${productId}, ${tenantId}, ${JSON.stringify({ code: "PERSONAL", name: "Personal Loan", max_minor: 50000000, tenure_months: 24 })}::jsonb)`;
  const loanId = randomUUID();
  await client`insert into loans (id, tenant_id, employee_id, principal_minor, outstanding_minor, currency, status) values (${loanId}, ${tenantId}, ${emp("MK-007")}, 6000000, 4000000, 'INR', 'disbursed')`;
  const empLoanId = randomUUID();
  await client`insert into employee_loans (id, tenant_id, employee_id, loan_product_id, attributes) values (${empLoanId}, ${tenantId}, ${emp("MK-007")}, ${productId}, ${JSON.stringify({ loan_id: loanId, status: "disbursed", purpose: "Medical emergency", principal_minor: 6000000, outstanding_minor: 4000000, tenure_months: 12, emi_minor: 550000, disbursed_on: "2026-06-15" })}::jsonb)`;
  const schedule = [["2026-06-30", "paid"], ["2026-07-31", "paid"], ["2026-08-31", "paid"], ["2026-09-30", "pending"]] as const;
  let installment = 0;
  for (const [dueOn, status] of schedule) {
    installment += 1;
    await client`insert into loan_schedules (id, tenant_id, employee_loan_id, attributes) values (${randomUUID()}, ${tenantId}, ${empLoanId}, ${JSON.stringify({ installment_no: installment, due_on: dueOn, amount_minor: 550000, status })}::jsonb)`;
  }
  let sequence = 0;
  for (const code of ["MK-008", "MK-011"]) {
    sequence += 1;
    await client`insert into loan_guarantors (id, tenant_id, loan_id, guarantor_employee_id, sequence, status, employee_loan_id) values (${randomUUID()}, ${tenantId}, ${loanId}, ${emp(code)}, ${sequence}, 'approved', ${empLoanId})`;
  }

  // Salary advance: one paid festival advance.
  await client`insert into salary_advances (id, tenant_id, employee_id, attributes) values (${randomUUID()}, ${tenantId}, ${emp("MK-008")}, ${JSON.stringify({ status: "paid", amount_minor: 2000000, period: "2026-09", reason: "Festival advance", paid_on: "2026-09-05" })}::jsonb)`;

  // Hiring pipeline: 2 requisitions, 1 plan, manual source, 3 candidates, 3 applications, 1 session.
  const req1 = randomUUID();
  const req2 = randomUUID();
  const deptWeaving = (await client`select id from departments where tenant_id = ${tenantId} and attributes->>'code' = 'WEAVING' limit 1`) as Array<{ id: string }>;
  const deptFinance = (await client`select id from departments where tenant_id = ${tenantId} and attributes->>'code' = 'FINANCE' limit 1`) as Array<{ id: string }>;
  await client`insert into requisitions (id, tenant_id, department_id, hiring_manager_employee_id, attributes) values (${req1}, ${tenantId}, ${deptWeaving[0].id}, ${emp("MK-005")}, ${JSON.stringify({ code: "REQ-26-001", title: "Weaving Operator", openings: 3, status: "approved" })}::jsonb)`;
  await client`insert into requisitions (id, tenant_id, department_id, hiring_manager_employee_id, attributes) values (${req2}, ${tenantId}, ${deptFinance[0].id}, ${emp("MK-002")}, ${JSON.stringify({ code: "REQ-26-002", title: "Accounts Assistant", openings: 1, status: "approved" })}::jsonb)`;
  const planId = randomUUID();
  await client`insert into interview_plans (id, tenant_id, requisition_id, attributes) values (${planId}, ${tenantId}, ${req1}, ${JSON.stringify({ name: "Weaving Operator panel", rounds: [" Trade test", "HR round"] })}::jsonb)`;
  const catalogs = (await client`select id from integration_catalog limit 1`) as Array<{ id: string }>;
  let catalogId = catalogs[0]?.id;
  if (!catalogId) {
    catalogId = randomUUID();
    await client`insert into integration_catalog (id, attributes) values (${catalogId}, ${JSON.stringify({ code: "manual", name: "Manual / walk-in" })}::jsonb)`;
  }
  const connectionId = randomUUID();
  await client`insert into integration_connections (id, tenant_id, integration_catalog_id, attributes) values (${connectionId}, ${tenantId}, ${catalogId}, ${JSON.stringify({ code: "manual-demo", name: "Manual demo source", status: "active" })}::jsonb)`;
  const candidateIds: string[] = [];
  for (const [name, email, phone] of [["Sanjay Tiwari", "sanjay.t@example.test", "+91-98100-11223"], ["Pooja Nair", "pooja.n@example.test", "+91-98100-44556"], ["Deepak Yadav", "deepak.y@example.test", "+91-98100-77889"]]) {
    const id = randomUUID();
    await client`insert into candidates (id, tenant_id, source_connection_id, attributes) values (${id}, ${tenantId}, ${connectionId}, ${JSON.stringify({ name, email, phone })}::jsonb)`;
    candidateIds.push(id);
  }
  const applicationIds: string[] = [];
  const stages = ["applied", "screening", "interview"];
  for (let index = 0; index < candidateIds.length; index += 1) {
    const id = randomUUID();
    await client`insert into applications (id, tenant_id, candidate_id, requisition_id, attributes) values (${id}, ${tenantId}, ${candidateIds[index]}, ${req1}, ${JSON.stringify({ stage: stages[index], applied_on: "2026-09-05" })}::jsonb)`;
    applicationIds.push(id);
  }
  await client`insert into interview_sessions (id, tenant_id, application_id, interview_plan_id, attributes) values (${randomUUID()}, ${tenantId}, ${applicationIds[2]}, ${planId}, ${JSON.stringify({ status: "scheduled", scheduled_on: "2026-09-13", mode: "on-site" })}::jsonb)`;

  // Learning: 2 courses, 4 enrollments, verified skill signals.
  const courseSafety = randomUUID();
  const coursePosh = randomUUID();
  await client`insert into courses (id, tenant_id, attributes) values (${courseSafety}, ${tenantId}, ${JSON.stringify({ code: "LOOM-SAFETY", title: "Loom Safety Essentials", provider: "Mkraft Academy", duration_hours: 4 })}::jsonb)`;
  await client`insert into courses (id, tenant_id, attributes) values (${coursePosh}, ${tenantId}, ${JSON.stringify({ code: "POSH-26", title: "POSH Awareness 2026", provider: "Mkraft Academy", duration_hours: 2 })}::jsonb)`;
  // An enrollment is keyed to its course by `course_code`: that is what enrollEmployee
  // writes and what the learning projection and the completion path both read. The course
  // UUID was written under `course_id`, a key nothing reads, so every seeded enrollment
  // belonged to no course at all.
  const enroll = async (code: string, courseCode: string, status: string, completedOn: string | null) => {
    await client`insert into enrollments (id, tenant_id, employee_id, attributes) values (${randomUUID()}, ${tenantId}, ${emp(code)}, ${JSON.stringify({ course_code: courseCode, status, completed_on: completedOn })}::jsonb)`;
  };
  await enroll("MK-007", "LOOM-SAFETY", "completed", "2026-08-28");
  await enroll("MK-008", "LOOM-SAFETY", "in_progress", null);
  await enroll("MK-002", "POSH-26", "completed", "2026-09-02");
  await enroll("MK-005", "POSH-26", "in_progress", null);
  const skillIds: Record<string, string> = {};
  for (const [code, name] of [["LOOM-OPS", "Loom Operation"], ["DYE-MIX", "Dye Mixing"], ["QUALITY", "Quality Check"], ["SAFETY", "Safety Compliance"]]) {
    const id = randomUUID();
    await client`insert into skills (id, tenant_id, attributes) values (${id}, ${tenantId}, ${JSON.stringify({ code, name })}::jsonb)`;
    skillIds[code] = id;
  }
  const grant = async (code: string, skill: string, proficiency: string, verified: boolean) => {
    await client`insert into employee_skills (id, tenant_id, employee_id, skill_id, attributes) values (${randomUUID()}, ${tenantId}, ${emp(code)}, ${skillIds[skill]}, ${JSON.stringify({ proficiency, verified })}::jsonb)`;
  };
  await grant("MK-007", "LOOM-OPS", "L3", true);
  await grant("MK-008", "LOOM-OPS", "L2", true);
  await grant("MK-011", "DYE-MIX", "L3", true);
  await grant("MK-009", "QUALITY", "L2", false);
  await grant("MK-004", "SAFETY", "L3", true);

  // Engagement: announcements.
  const post = async (title: string, body: string, kind: string) => {
    await client`insert into feed_posts (id, tenant_id, attributes) values (${randomUUID()}, ${tenantId}, ${JSON.stringify({ title, body, audience: "all", kind, published_by: userIdByEmail["superadmin@mkraft.demo"] })}::jsonb)`;
  };
  await post("September payroll calendar", "Payroll for September closes on the 25th. Managers must approve all regularizations by EOD 24th.", "management");
  await post("Plant safety week from Sep 15", "All Plant North hands complete the Loom Safety refresher before Sep 20. Supervisors to roster coverage.", "project");

  // Compliance: PF due, ESI filed, POSH scheduled.
  const legalEntity = (await client`select id from legal_entities where tenant_id = ${tenantId} limit 1`) as Array<{ id: string }>;
  const obligation = async (title: string, code: string, dueOn: string, status: string) => {
    await client`insert into compliance_calendar_items (id, tenant_id, legal_entity_id, attributes) values (${randomUUID()}, ${tenantId}, ${legalEntity[0].id}, ${JSON.stringify({ title, code, due_on: dueOn, status })}::jsonb)`;
  };
  await obligation("PF challan — September", "PF-CHALLAN", "2026-09-15", "scheduled");
  await obligation("ESI contribution — August", "ESI-AUG", "2026-09-10", "filed");
  await obligation("POSH training coverage", "POSH-Q3", "2026-09-30", "scheduled");

  // Performance: feedback request + entries for the Plant Head.
  const cycleRequest = randomUUID();
  await client`insert into feedback_requests (id, tenant_id, requester_employee_id, subject_employee_id, attributes) values (${cycleRequest}, ${tenantId}, ${emp("MK-002")}, ${emp("MK-004")}, ${JSON.stringify({ cycle: "Q2 FY26", focus: "Shift discipline" })}::jsonb)`;
  const entry = async (author: string, body: string, rating: number) => {
    await client`insert into feedback_entries (id, tenant_id, author_employee_id, subject_employee_id, attributes) values (${randomUUID()}, ${tenantId}, ${emp(author)}, ${emp("MK-004")}, ${JSON.stringify({ body, rating, feedback_request_id: cycleRequest })}::jsonb)`;
  };
  await entry("MK-002", "Holds the night shift to plan; overtime approvals are prompt and documented.", 4);
  await entry("MK-001", "Strong ownership of Plant North output. Next step: deepen the maintenance bench.", 5);

  // Delegation: HR offsite coverage.
  await client`insert into delegation_windows (id, tenant_id, delegator_membership_id, delegate_membership_id, permission_ceiling, reason, valid_from, valid_to) values (${randomUUID()}, ${tenantId}, ${membershipByCode["MK-002"]}, ${membershipByCode["MK-003"]}, ${["leave.read", "employee.read"]}, 'HR offsite coverage', '2026-09-14', '2026-09-16')`;

  // Contractors: agency, contract, invoice.
  const agencyId = randomUUID();
  await client`insert into contractor_organizations (id, tenant_id, attributes) values (${agencyId}, ${tenantId}, ${JSON.stringify({ code: "SHREE-POWER", name: "Shree Powerloom Services", contact: "+91-98200-12345" })}::jsonb)`;
  const contractId = randomUUID();
  await client`insert into contractor_contracts (id, tenant_id, contractor_organization_id, legal_entity_id, attributes) values (${contractId}, ${tenantId}, ${agencyId}, ${legalEntity[0].id}, ${JSON.stringify({ title: "Loom maintenance AMC", start_on: "2026-04-01", end_on: "2027-03-31", monthly_minor: 15000000 })}::jsonb)`;
  await client`insert into contractor_invoices (id, tenant_id, contractor_contract_id, attributes) values (${randomUUID()}, ${tenantId}, ${contractId}, ${JSON.stringify({ invoice_no: "SPS-26-08", amount_minor: 15000000, period: "2026-08", status: "submitted" })}::jsonb)`;

  // Benefits: mediclaim plan.
  await client`insert into benefit_plans (id, tenant_id, legal_entity_id, attributes) values (${randomUUID()}, ${tenantId}, ${legalEntity[0].id}, ${JSON.stringify({ code: "MEDICLAIM-26", name: "Group Mediclaim 2026", cover_minor: 50000000 })}::jsonb)`;

  // Notifications: two unread items for the owner.
  for (const [title, body, event] of [
    ["Leave request needs your decision", "Sunita Devi · SL · Sep 14", "leave.requested"],
    ["Payroll input window closes Sep 24", "September inputs lock in 13 days", "payroll.reminder"],
  ] as Array<[string, string, string]>) {
    await client`insert into notifications (id, tenant_id, membership_id, attributes) values (${randomUUID()}, ${tenantId}, ${membershipByCode["MK-001"]}, ${JSON.stringify({ title, body, event_type: event, read: false })}::jsonb)`;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exitCode = 1;
});
