/**
 * Configures the live `mkraft` demo tenant so the 40 client acceptance scenarios can run.
 *
 * Every value written here is one the client's own build sheet states —
 * `docs/Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx`, its configuration register
 * (sheet 09) and the worked examples in its rules sheet (05). Each is cited in place.
 * Where the workbook states no value it is LEFT UNSET and reported at the end with its
 * open-question number: the mechanism then refuses by name, which is the behaviour the
 * scenarios assert. Nothing is invented to make a test go green.
 *
 * This is demo configuration for ONE tenant, not a product default.
 *
 * Idempotent: every write is an existence check or an upsert, so re-running changes
 * nothing. Run after `scripts/seed-mkraft-demo.ts`:
 *
 *   npx tsx scripts/seed-acceptance-demo.ts
 */
import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const TENANT_SLUG = "mkraft";
const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL (or MIGRATION_DATABASE_URL) is required.");
const client = neon(connectionString);

const configured: string[] = [];
const unset: string[] = [];
function note(what: string, citation: string) {
  configured.push(`  ${what.padEnd(58)} ${citation}`);
}
function leftUnset(what: string, question: string) {
  unset.push(`  ${what.padEnd(58)} ${question}`);
}

/* ------------------------------------------------------------------ *
 * Values the workbook states
 * ------------------------------------------------------------------ */

/** RL-16 thresholds, and the detection windows RL-19's worked example needs. */
const SHIFTS = [
  // Detection windows must not overlap (RL-19) AND each must contain its own shift's start
  // time, or auto-detection overrides the rostered shift with a neighbour. That forces
  // staggered starts: four shifts cannot all begin at 08:00 and still be told apart from
  // the first punch.
  { code: "A", name: "General / A shift", start: "08:00", end: "20:00", minutes: 720, half: 690, absent: 390, from: "06:00", to: "09:59" },
  { code: "C", name: "Short / C shift", start: "10:00", end: "18:00", minutes: 480, half: 450, absent: 270, from: "10:00", to: "11:59" },
  { code: "D10", name: "Ten-hour shift", start: "12:00", end: "22:00", minutes: 600, half: 570, absent: 360, from: "12:00", to: "13:59" },
  { code: "E9", name: "Nine-hour shift", start: "14:00", end: "23:00", minutes: 540, half: 510, absent: 300, from: "14:00", to: "15:59" },
  { code: "B", name: "Night / B shift", start: "20:00", end: "08:00", minutes: 720, half: 690, absent: 390, from: "18:00", to: "21:59" },
] as const;

/** RL-05: rest-day applicability and wage basis are per worker category, as configuration. */
const WORKER_CATEGORIES = [
  { code: "ACC-REGULAR", label: "Regular staff", restDayPattern: "fixed_sunday", wageType: "monthly", otEligibility: "all" },
  { code: "ACC-CONTRACT", label: "Contractual", restDayPattern: "none", wageType: "daily", otEligibility: "restday_holiday_only" },
  { code: "ACC-3P-EMPLOYEE", label: "Third party - Employee", restDayPattern: "fixed_sunday", wageType: "monthly", otEligibility: "restday_holiday_only" },
  { code: "ACC-3P-HELPER", label: "Third party - Helper", restDayPattern: "none", wageType: "daily", otEligibility: "restday_holiday_only" },
] as const;

/** RL-10's proration table, band for band. */
const JOINING_PRORATION = [
  { fromMonth: 1, toMonth: 1, cutoffDay: null, days: 6 },
  { fromMonth: 2, toMonth: 3, cutoffDay: null, days: 5 },
  { fromMonth: 4, toMonth: 5, cutoffDay: null, days: 4 },
  { fromMonth: 6, toMonth: 7, cutoffDay: null, days: 3 },
  { fromMonth: 8, toMonth: 9, cutoffDay: null, days: 2 },
  { fromMonth: 10, toMonth: 12, cutoffDay: 4, days: 1 },
];

/**
 * Acceptance actors. `level` is `employees.designation_level`, on the demo dataset's own
 * grade ladder (sheet 05 `Grade rank`, 5-100) — see DESIGNATIONS in
 * src/server/acceptance/fixture.ts for why the tenant may only have one ladder.
 *
 * These seven titles are approver personas and none of them appears in sheet 05, so
 * their ranks are not read off the sheet. They were re-expressed from the earlier 1-10
 * values by the only rule that adds no policy: keep each actor on the same side of both
 * thresholds it was already on. The two thresholds are the grace exemption (50) and
 * RL-07's senior leave band (70), so the mapping is
 *   10 -> 100, 8 -> 80, 7 -> 70, 6 -> 55, 5 -> 50, 4 -> 40
 * and every actor's exempt/non-exempt and senior/standard classification is unchanged
 * from before the rescale. Nobody gains or loses an entitlement here.
 */
const ACTORS = [
  { email: "hrhead.acceptance@mkraft.demo", first: "Asha", last: "Rao", role: "hr_head", designation: "HR Head", level: 80, employee: true },
  { email: "payroll.acceptance@mkraft.demo", first: "Nikhil", last: "Rane", role: "payroll-admin", designation: "Payroll Officer", level: 50, employee: true },
  { email: "finance.acceptance@mkraft.demo", first: "Meera", last: "Iyer", role: "finance", designation: "Finance Manager", level: 55, employee: true },
  { email: "director.acceptance@mkraft.demo", first: "Rohit", last: "Bhatia", role: "director", designation: "Director", level: 100, employee: true },
  { email: "supervisor.acceptance@mkraft.demo", first: "Kavita", last: "Joshi", role: "manager", designation: "Supervisor", level: 40, employee: true },
  { email: "hod.acceptance@mkraft.demo", first: "Sanjay", last: "Patil", role: "manager", designation: "HOD", level: 70, employee: true },
  { email: "plant.acceptance@mkraft.demo", first: "Devi", last: "Naik", role: "plant-hr", designation: "Plant HR Officer", level: 40, employee: true },
] as const;

/** Roles the scenarios need that the base demo seed does not create. */
const ROLES: Array<{ code: string; name: string; permissions: string[] }> = [
  // The leave chain resolves HR Head by role code; W-01.
  { code: "hr_head", name: "HR Head", permissions: ["tenant.read", "employee.read", "employee.write", "attendance.read", "attendance.write", "leave.read", "leave.approve", "hr.records.write", "payroll.settlement.read", "payroll.settlement.write"] },
  // W-06: special loan terms are a Director's decision, not a payroll user's.
  { code: "director", name: "Director", permissions: ["tenant.read", "employee.read", "payroll.read", "loan.director.approve", "employee.write", "workforce.manpower.approve"] },
  { code: "finance", name: "Finance", permissions: ["tenant.read", "employee.read", "payroll.read", "payroll.accounting.read", "payroll.accounting.write", "payroll.accounting.approve", "payroll.settlement.read", "payroll.settlement.approve"] },
  // R-09: the plant sees its own salary and never head office's. That needs both halves —
  // payroll.rate.read to see salary at all, and the payroll_location data scope for whose.
  { code: "plant-hr", name: "Plant HR", permissions: ["tenant.read", "employee.read", "attendance.read", "attendance.write", "leave.read", "payroll.read", "payroll.rate.read"] },
];

async function main() {
  const tenants = (await client`select id from tenants where slug = ${TENANT_SLUG} limit 1`) as Array<{ id: string }>;
  const tenantId = tenants[0]?.id;
  if (!tenantId) throw new Error(`Tenant "${TENANT_SLUG}" not found. Run scripts/seed-mkraft-demo.ts first.`);
  // This script writes demo configuration onto one known tenant and nothing else.
  console.info(`Configuring acceptance demo on tenant ${TENANT_SLUG} (${tenantId}).\n`);

  await seedRoles(tenantId);
  await seedLocations(tenantId);
  await seedDepartment(tenantId);
  const supervisorEmployeeId = await seedActors(tenantId);
  await linkHrManagerEmployee(tenantId);
  await seedPlantCalendars(tenantId);
  await seedShiftMaster(tenantId);
  await seedWorkerCategories(tenantId);
  await seedAttendancePolicies(tenantId);
  await seedLeaveScheme(tenantId);
  await seedDataScopes(tenantId);
  await seedSanctionedStrength(tenantId, supervisorEmployeeId);
  await seedErpConnection(tenantId);
  await clearTodayJoiners(tenantId);
  await removeCorruptLeaveType(tenantId);

  console.info("Configured:");
  for (const line of configured) console.info(line);
  console.info("\nLeft unset — the workbook states no value; the mechanism refuses by name:");
  for (const line of unset) console.info(line);
  console.info("\nAcceptance demo configuration complete.");
}

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */

async function seedRoles(tenantId: string) {
  for (const role of ROLES) {
    const existing = (await client`select id from roles where tenant_id = ${tenantId} and code = ${role.code} limit 1`) as Array<{ id: string }>;
    const id = existing[0]?.id ?? randomUUID();
    if (!existing[0]) {
      await client`insert into roles (id, tenant_id, code, name, system_managed, status) values (${id}, ${tenantId}, ${role.code}, ${role.name}, false, 'active')`;
    }
    await client`
      insert into role_permissions (tenant_id, role_id, permission_id)
      select ${tenantId}, ${id}, p.id from permissions p
      where p.permission_key = any(${role.permissions}) and p.status = 'active'
      on conflict (tenant_id, role_id, permission_id) do nothing
    `;
  }
  // `tenant.manage` guards fourteen administrative entry points — integration connections,
  // ERP settings, tenant configuration — and no role in this tenant held it, not even the
  // owner, so every one of them was unreachable by anybody. The owner role is where it
  // belongs; nothing else is granted it here.
  const granted = (await client`
    insert into role_permissions (tenant_id, role_id, permission_id)
    select ${tenantId}, r.id, p.id
    from roles r, permissions p
    where r.tenant_id = ${tenantId} and r.code = 'owner' and r.status = 'active'
      and p.permission_key = 'tenant.manage' and p.status = 'active'
    on conflict (tenant_id, role_id, permission_id) do nothing
    returning permission_id
  `) as Array<{ permission_id: string }>;
  if (granted.length > 0) note("granted tenant.manage to the owner role", "FRM-FIN-02, T-28");
  note(`${ROLES.length} roles (hr_head, director, finance, plant-hr)`, "W-01, W-06, R-09");
}

// The acceptance fixture names these two; the statutory derivation reads `state`. Shared
// with the work calendars below so a location and its calendar can never disagree.
const LOCATIONS = [
  { code: "PLANT-NORTH", name: "Plant North", city: "Bengaluru", state: "Karnataka", establishment: "factory" },
  { code: "HEAD-OFFICE", name: "Head Office", city: "Mumbai", state: "Maharashtra", establishment: "office" },
] as const;

async function seedLocations(tenantId: string) {
  for (const location of LOCATIONS) {
    const existing = (await client`select id from locations where tenant_id = ${tenantId} and attributes->>'name' = ${location.name} limit 1`) as Array<{ id: string }>;
    const attributes = JSON.stringify({
      code: location.code, name: location.name, city: location.city, state: location.state,
      state_code: location.state, establishment_type: location.establishment, country_code: "IN", timezone: "Asia/Kolkata",
    });
    if (existing[0]) {
      await client`update locations set attributes = attributes || ${attributes}::jsonb, updated_at = now() where tenant_id = ${tenantId} and id = ${existing[0].id}`;
    } else {
      await client`insert into locations (id, tenant_id, record_status, attributes) values (${randomUUID()}, ${tenantId}, 'active', ${attributes}::jsonb)`;
    }
  }
  note("locations Plant North (Karnataka) and Head Office (Maharashtra)", "fixture contract; Q-13 state variant");
}

async function seedDepartment(tenantId: string) {
  const existing = (await client`select id from departments where tenant_id = ${tenantId} and attributes->>'name' = 'Acceptance' limit 1`) as Array<{ id: string }>;
  if (existing[0]) return;
  await client`
    insert into departments (id, tenant_id, record_status, attributes)
    values (${randomUUID()}, ${tenantId}, 'active', ${JSON.stringify({ code: "ACCEPTANCE", name: "Acceptance" })}::jsonb)
  `;
  note("department Acceptance", "scenario scope key");
}

async function seedActors(tenantId: string): Promise<string> {
  const passwordRows = (await client`select password from account where provider_id = 'credential' limit 1`) as Array<{ password: string }>;
  const passwordHash = passwordRows[0]?.password ?? null;
  let supervisorEmployeeId = "";

  for (const actor of ACTORS) {
    const users = (await client`select id from "user" where email = ${actor.email} limit 1`) as Array<{ id: string }>;
    const userId = users[0]?.id ?? randomUUID();
    if (!users[0]) {
      await client`insert into "user" (id, name, email, email_verified, status) values (${userId}, ${`${actor.first} ${actor.last}`}, ${actor.email}, true, 'active')`;
      if (passwordHash) {
        await client`insert into account (id, account_id, provider_id, user_id, password) values (${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash})`;
      }
    }
    const memberships = (await client`select id, employee_id from memberships where tenant_id = ${tenantId} and user_id = ${userId} limit 1`) as Array<{ id: string; employee_id: string | null }>;
    const membershipId = memberships[0]?.id ?? randomUUID();
    if (!memberships[0]) {
      await client`insert into memberships (id, tenant_id, user_id, role, status) values (${membershipId}, ${tenantId}, ${userId}, 'employee', 'active')`;
    }
    await client`
      insert into membership_roles (tenant_id, membership_id, role_id)
      select ${tenantId}, ${membershipId}, id from roles where tenant_id = ${tenantId} and code = ${actor.role}
      on conflict do nothing
    `;
    let employeeId = memberships[0]?.employee_id ?? null;
    if (actor.employee && !employeeId) {
      const code = `ACC-${actor.role.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6)}`;
      const existingEmployee = (await client`select id from employees where tenant_id = ${tenantId} and employee_code = ${code} limit 1`) as Array<{ id: string }>;
      if (existingEmployee[0]) {
        employeeId = existingEmployee[0].id;
      } else {
        const personId = randomUUID();
        employeeId = randomUUID();
        await client`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
        await client`
          insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, designation_level,
            department, location, joining_date, basic_salary_minor, payroll_owner)
          values (${employeeId}, ${tenantId}, ${personId}, ${code}, ${actor.first}, ${actor.last}, ${actor.designation}, ${actor.level},
            'Acceptance', ${actor.role === "plant-hr" ? "Plant North" : "Head Office"}, '2020-04-01', 6000000,
            ${actor.role === "plant-hr" ? "Plant North" : "Head Office"})
        `;
      }
      await client`update memberships set employee_id = ${employeeId} where id = ${membershipId}`;
    }
    if (actor.employee && employeeId) {
      // Re-assert the declared designation and level on every run, not only on the run
      // that creates the row. The block above is entered only when the membership has no
      // employee yet, so an actor seeded by an earlier run is never revisited — and an
      // actor seeded before the grade ladder was expressed in the dataset's own units
      // would keep its old 1-10 level for good, leaving two ladders in one column that
      // one threshold has to serve. The ACTORS mapping is classification-preserving, so
      // this corrects the scale and changes no outcome.
      await client`
        update employees set designation = ${actor.designation}, designation_level = ${actor.level}
        where tenant_id = ${tenantId} and id = ${employeeId}
          and (designation is distinct from ${actor.designation} or designation_level is distinct from ${actor.level})
      `;
    }
    if (actor.role === "manager" && actor.designation === "Supervisor" && employeeId) supervisorEmployeeId = employeeId;
  }
  note(`${ACTORS.length} acceptance actors with employees and roles`, "fixture ACTORS contract");
  return supervisorEmployeeId;
}

/** Recognition approval refuses an account with no employee link (recognition-register.ts). */
async function linkHrManagerEmployee(tenantId: string) {
  const rows = (await client`
    select m.id, m.employee_id from memberships m join "user" u on u.id = m.user_id
    where m.tenant_id = ${tenantId} and u.email = 'hr@mkraft.demo' limit 1
  `) as Array<{ id: string; employee_id: string | null }>;
  if (!rows[0]) return;
  if (rows[0].employee_id) return;
  const employee = (await client`select id from employees where tenant_id = ${tenantId} and employee_code = 'MK-002' limit 1`) as Array<{ id: string }>;
  if (!employee[0]) return;
  await client`update memberships set employee_id = ${employee[0].id} where id = ${rows[0].id}`;
  note("hr@mkraft.demo linked to its employee record", "recognition approval requires it");
}

async function publishOperationalRecord(tenantId: string, resource: string, key: string, data: Record<string, unknown>) {
  const existing = (await client.query(
    `select id from hrms_operation_records where tenant_id = $1::uuid and resource = $2 and data->>$3 = $4 limit 1`,
    [tenantId, resource, key, String(data[key])],
  )) as Array<{ id: string }>;
  const membership = (await client`select id from memberships where tenant_id = ${tenantId} limit 1`) as Array<{ id: string }>;
  if (existing[0]) {
    await client`update hrms_operation_records set data = ${JSON.stringify(data)}::jsonb, status = 'published', updated_at = now() where tenant_id = ${tenantId} and id = ${existing[0].id}`;
    return;
  }
  await client`
    insert into hrms_operation_records (id, tenant_id, resource, status, version, data, created_by_membership_id)
    values (${randomUUID()}, ${tenantId}, ${resource}, 'published', 1, ${JSON.stringify(data)}::jsonb, ${membership[0].id})
  `;
}

/**
 * A published plant work calendar per location. FRM-PLT-02 Location Master requires one —
 * `calendarId` is not optional on the form — so without it the Location Master cannot be
 * used at all. The weekly-off pattern matches the regular worker category's.
 */
async function seedPlantCalendars(tenantId: string) {
  const entity = (await client`select id from legal_entities where tenant_id = ${tenantId} order by created_at asc limit 1`) as Array<{ id: string }>;
  if (!entity[0]) return;
  for (const location of LOCATIONS) {
    await publishOperationalRecord(tenantId, "plant-calendars", "locationCode", {
      legalEntityId: entity[0].id,
      locationCode: location.code,
      name: `${location.name} work calendar`,
      stateCode: location.state.toLowerCase(),
      calendarYear: 2026,
      weeklyOffPattern: "fixed_sunday",
    });
  }
  note(`${LOCATIONS.length} plant work calendars (one per location, 2026)`, "FRM-PLT-02 calendarId");
}

async function seedShiftMaster(tenantId: string) {
  for (const shift of SHIFTS) {
    await publishOperationalRecord(tenantId, "shifts", "shiftCode", {
      shiftCode: shift.code, name: shift.name, shiftGroup: "PLANT", startTime: shift.start, endTime: shift.end,
      durationMinutes: shift.minutes, fullDayMinutes: shift.minutes, halfDayMinutes: shift.half, absentBelowMinutes: shift.absent,
      // Configuration register: grace 15 on arrival and 15 on departure.
      graceInMinutes: 15, graceOutMinutes: 15, breakMinutes: 45,
      earliestIn: shift.from, latestIn: shift.to,
      // RL-04: OT is gross work hours less the shift's OT threshold.
      otEligible: "yes", otBasis: "gross_minutes", otAfterMinutes: shift.minutes,
      nightAllowanceEligible: shift.code === "B", autoDetectEnabled: true, status: "active",
    });
  }
  note(`${SHIFTS.length} published shifts with RL-16 thresholds and RL-19 windows`, "RL-04, RL-16, RL-19");
}

async function seedWorkerCategories(tenantId: string) {
  for (const category of WORKER_CATEGORIES) {
    await publishOperationalRecord(tenantId, "worker-categories", "code", {
      code: category.code, label: category.label, wageType: category.wageType,
      restDayPattern: category.restDayPattern, otEligibility: category.otEligibility,
      statutoryComponents: "pf,esi", graceExempt: "no",
    });
    // getEmployeeWorkRules joins the published record to a `worker_categories` row BY CODE.
    const existing = (await client`select id from worker_categories where tenant_id = ${tenantId} and attributes->>'code' = ${category.code} limit 1`) as Array<{ id: string }>;
    if (!existing[0]) {
      await client`
        insert into worker_categories (id, tenant_id, record_status, attributes)
        values (${randomUUID()}, ${tenantId}, 'active', ${JSON.stringify({ code: category.code, name: category.label })}::jsonb)
      `;
    }
  }
  note(`${WORKER_CATEGORIES.length} worker categories, published and code-linked`, "RL-05, R-03, R-04");
  leftUnset("rest day worked by a daily-wage employee: OT or normal wage", "Q-14");
}

async function seedAttendancePolicies(tenantId: string) {
  await publishOperationalRecord(tenantId, "grace-late-policies", "policyCode", {
    policyCode: "ACC-GRACE-V1",
    // Configuration register: 15 / 15 / 3 lates / half day / calendar month.
    graceInMinutes: 15, graceOutMinutes: 15, latesAllowedPerMonth: 3,
    consequenceBeyondAllowance: "half_day", counterResetBasis: "calendar_month",
    // RL-17's worked example names the Assistant Manager as exempt. On the dataset's
    // grade ladder that is DES-07, rank 50 — and sheet 41 states the same threshold
    // outright ("Exempt from grade rank": 50), covering DES-01..07 and DES-20.
    exemptFromGradeRank: 50,
    effectiveFrom: "2020-01-01",
  });
  note("grace & late policy 15/15, 3 lates, half day, calendar month", "RL-17, config register");
  note("exempt grade rank = 50 (Assistant Manager and above)", "RL-17 worked example");

  await publishOperationalRecord(tenantId, "night-extension-rules", "appliesToShiftCode", {
    appliesToShiftCode: "A",
    // Configuration register: 03:00 / 09:30 / 20:00 / Present.
    triggerAfterTime: "03:00", permittedArrivalUntil: "09:30", minimumDepartureTime: "20:00",
    resultingDayStatus: "present",
    effectiveFrom: "2020-01-01",
  });
  note("night extension 03:00 / 09:30 / 20:00 -> Present, shift A", "RL-18, config register");
  leftUnset("night extension maximum uses per month", "Q-11");
}

async function seedLeaveScheme(tenantId: string) {
  const scheme = {
    // RL-07 turns on at "AGM and above". On the dataset's grade ladder that is DES-04
    // Assistant General Manager, rank 70 — the lowest rank sheet 05 puts in the
    // AGM_AND_ABOVE leave band (70, 80, 90, 100).
    seniorGradeRank: 70,
    // RL-06's worked example: earned 10 March, lapses 9 May — 60 calendar days.
    coffLapseDays: 60,
    coffLapseDayBasis: "calendar" as const,
    types: {
      EL: {
        annualDays: 18, accrualFrequency: "monthly" as const, daysPerPeriod: 1.5,
        minimumServiceMonths: 6, catchUpDays: 9, maxAvailedPerMonth: 10,
        yearEndTreatment: "encash" as const,
      },
      CL: {
        annualDays: 6, accrualFrequency: "annual" as const, maxAvailedPerMonth: 2,
        cannotCombineWith: ["EL", "SL"], yearEndTreatment: "lapse" as const,
        joiningProration: JOINING_PRORATION,
      },
      SL: {
        annualDays: 6, accrualFrequency: "annual" as const,
        yearEndTreatment: "lapse" as const, joiningProration: JOINING_PRORATION,
      },
    },
  };
  await client`
    insert into tenant_settings (tenant_id, locale, timezone, currency, settings)
    values (${tenantId}, 'en-IN', 'Asia/Kolkata', 'INR', ${JSON.stringify({ leave_scheme: scheme })}::jsonb)
    on conflict (tenant_id) do update set settings = coalesce(tenant_settings.settings, '{}'::jsonb) || ${JSON.stringify({ leave_scheme: scheme })}::jsonb
  `;
  note("leave scheme: 18/6/6 senior, 1.5 EL monthly, 6-month hold, 9 catch-up", "RL-07 … RL-14");
  note("CL cannot combine with EL/SL; caps CL 2, EL 10 per month", "RL-11, RL-12");
  note("year end: EL encash, CL and SL lapse", "RL-14, config register");
  note("COFF 60 calendar days", "RL-06 worked example");
  leftUnset("days for an employee joining after 4 December", "Q-02");
  leftUnset("whether the 10 EL a month caps availing or accrual", "Q-04");
}

async function seedDataScopes(tenantId: string) {
  // R-09: the plant role sees plant attendance and never head-office salary.
  //
  // The gate is on payroll location, not attendance location, because the scenario's two
  // employees both physically work at Plant North and differ only in who pays them — an
  // attendance_location scope cannot tell them apart, and the flag it would need to be
  // useful at all (canViewSalaryStructure) is what lets the plant see its OWN payroll.
  // Scoping on payroll_location gives exactly R-09: the plant's own salary yes, the
  // head-office-paid employee's no, on the register and on the employee record alike.
  const dataScopes = {
    "plant-hr": {
      scopeDimension: "payroll_location",
      scopeValues: ["Plant North"],
      canViewSalaryStructure: true,
      canViewRateStructure: false,
    },
  };
  await client`
    update tenant_settings
    set settings = coalesce(settings, '{}'::jsonb) || ${JSON.stringify({ dataScopes })}::jsonb
    where tenant_id = ${tenantId}
  `;
  note("plant-hr scoped to payroll_location = Plant North (own salary yes, head office no)", "RL-24, R-09");
}

async function seedSanctionedStrength(tenantId: string, supervisorEmployeeId: string) {
  void supervisorEmployeeId;
  const department = (await client`select id from departments where tenant_id = ${tenantId} and attributes->>'name' = 'Acceptance' limit 1`) as Array<{ id: string }>;
  const location = (await client`select id from locations where tenant_id = ${tenantId} and attributes->>'name' = 'Plant North' limit 1`) as Array<{ id: string }>;
  if (!department[0] || !location[0]) return;
  // T-40 overrides a ceiling that somebody else approved: the overrider must be a
  // different person from the approver, so the line is approved as the Director and
  // never as whichever membership happened to come back first — which was the owner,
  // the same actor the scenario then uses to override.
  const approver = (await client`
    select m.id from memberships m join "user" u on u.id = m.user_id
    where m.tenant_id = ${tenantId} and u.email = 'director.acceptance@mkraft.demo' and m.status = 'active' limit 1
  `) as Array<{ id: string }>;
  if (!approver[0]) return;
  // The ceiling is scaffolding for T-39 and T-40, not an establishment figure, and it has
  // to sit in a window at both ends. Too low and the run consumes it — every scenario
  // employee this suite creates is an Acceptance Operator, so a fixed 5 is long gone by
  // the time T-39 asks for an addition within the ceiling. Too high and T-40 breaks the
  // other way: it drafts `min(99, headroom + 1)` positions, so any headroom of 99 or more
  // caps the draft below the ceiling and nothing exceeds it. Sizing it from what is
  // actually filled keeps the headroom a stable ~40 whatever the tenant already holds.
  const filled = (await client`
    select count(*)::int as n from employees
    where tenant_id = ${tenantId} and department = 'Acceptance'
      and designation = 'Operator' and status = 'active'
  `) as Array<{ n: number }>;
  const SANCTIONED = (filled[0]?.n ?? 0) + 40;
  const existing = (await client`
    select id from vp_manpower_lines
    where tenant_id = ${tenantId} and plan_year = 2026 and department_id = ${department[0].id} and designation = 'Operator' limit 1
  `) as Array<{ id: string }>;
  if (existing[0]) {
    await client`
      update vp_manpower_lines
      set sanctioned_count = ${SANCTIONED}, status = 'approved', approved_by_membership_id = ${approver[0].id},
          approved_at = coalesce(approved_at, now()), location_id = ${location[0].id}, updated_at = now()
      where tenant_id = ${tenantId} and id = ${existing[0].id}
    `;
  } else {
    await client`
      insert into vp_manpower_lines (id, tenant_id, plan_year, department_id, designation, location_id, sanctioned_count, status, approved_by_membership_id, approved_at)
      values (${randomUUID()}, ${tenantId}, 2026, ${department[0].id}, 'Operator', ${location[0].id}, ${SANCTIONED}, 'approved', ${approver[0].id}, now())
    `;
  }
  note(`sanctioned strength: Acceptance / Operator = ${SANCTIONED} for 2026, approved by the Director`, "R-26, T-39, T-40");
}

async function seedErpConnection(tenantId: string) {
  const existing = (await client`select id from integration_connections where tenant_id = ${tenantId} limit 1`) as Array<{ id: string }>;
  if (!existing[0]) {
    note("ERP connection NOT seeded — no integration_connections row could be created", "T-28 will refuse");
    return;
  }
  // The sync refuses without an ownership map rather than overwriting every field (Q-15).
  const erpSettings = {
    erpSystem: "sap",
    masterMode: "co_owned",
    syncFrequency: "daily",
    matchKey: "employee_code",
    unmatchedAction: "create",
    conflictPolicy: "hold_for_review",
    fieldOwners: {
      firstName: "erp", lastName: "erp", workEmail: "erp", designation: "erp",
      department: "erp", location: "erp", joiningDate: "erp", basicSalaryMinor: "nucleus",
    },
  };
  await client`
    update integration_connections
    set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({ erp_settings: erpSettings })}::jsonb
    where tenant_id = ${tenantId} and id = ${existing[0].id}
  `;
  note("ERP field ownership map, match on employee_code, hold_for_review", "R-15, Q-15 posture");
  leftUnset("ERP change timestamp for a latest-wins policy", "Q-15");
}

/** A demo employee joining today would be swept into T-35's new-joiner announcement run. */
async function clearTodayJoiners(tenantId: string) {
  const rows = (await client`
    update employees set joining_date = current_date - interval '30 days'
    where tenant_id = ${tenantId} and joining_date = current_date and employee_code not like 'T-%'
    returning employee_code
  `) as Array<{ employee_code: string }>;
  if (rows.length > 0) note(`${rows.length} demo joiner(s) moved off today's date`, "keeps T-35 deterministic");
}

/** Seed garbage: a leave type whose code is an entire sentence. */
async function removeCorruptLeaveType(tenantId: string) {
  const rows = (await client`
    delete from leave_types where tenant_id = ${tenantId} and length(attributes->>'code') > 10 returning id
  `) as Array<{ id: string }>;
  if (rows.length > 0) note(`${rows.length} corrupt leave_types row(s) removed`, "seed data defect");
}

void main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
