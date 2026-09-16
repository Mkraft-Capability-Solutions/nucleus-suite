import { afterAll, describe, expect, it } from "vitest";

import type { Access } from "@/server/platform/access";
import { grantsForRoles } from "@/server/access-scopes/data-scope-settings";
import { ingestPunches, recomputeDay } from "@/server/attendance/service";
import { allocateAsset } from "@/server/assets/service";
import { buildExport, createExport, getExport } from "@/server/exports/service";
import { completeOnboardingTask, confirmEmployment, ensureEmployment, onboardingReadiness, startOnboarding } from "@/server/lifecycle/service";
import { updateEmployee } from "@/server/organization/employee-update";
import { getReportingChart } from "@/server/organization/reporting-line";
import { getEmployee, listEmployees } from "@/server/organization/service";
import { getEmployeeWorkRules } from "@/server/organization/work-rules";
import { listPayslips } from "@/server/payroll/payslips";
import { approveRun, calculateRun, createRun, finalizeRun } from "@/server/payroll/service";
import { computeSettlementWorking } from "@/server/payroll/settlement";
import { listEstablishment } from "@/server/talent/establishment";
import { approveRequisition, createRequisition, ensureDepartment, ensureGrade, ensurePosition } from "@/server/talent/service";
import { executeVpCommand, getTeamHistory } from "@/server/vp/service";

import {
  ACCEPTANCE_DEPARTMENT,
  ACTORS,
  HEAD_OFFICE_LOCATION,
  LIVE,
  PLANT_LOCATION,
  SHIFTS,
  accessFor,
  addDays,
  at,
  createScenarioEmployee,
  db,
  removeScenarioRows,
  tenantId,
  type ActorKey,
  type ScenarioEmployee,
} from "./fixture";

/**
 * People acceptance scenarios: T-06, T-07, T-18, T-37, T-38, T-39, T-40.
 *
 * Every scenario runs the service functions directly against the live `mkraft` tenant the
 * acceptance seed configures. Nothing here fixes up product or seed state: where a
 * precondition the seed is meant to guarantee is missing, the test throws naming it.
 */

const rid = () => crypto.randomUUID();

/** A Monday, so the week that follows contains exactly one Sunday (2024-02-11). */
const T06_WEEK_MONDAY = "2024-02-05";
const T18_ATTENDANCE_DATE = "2024-03-04";
/** Far-future periods so the runs cannot collide with any seeded or demo run. */
const T06_PERIOD = "2036-04";
const T18_PERIOD = "2036-03";
/** Far enough ahead that the "required by is not in the past" gate stays satisfied. */
const FUTURE_DATE = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
const MANPOWER_APPROVE_PERMISSION = "workforce.manpower.approve";

/** Rows created outside the employee-code prefix, removed in `afterAll` in dependency order. */
const created = {
  requisitionIds: [] as string[],
  positionCodes: [] as string[],
  exportIds: [] as string[],
  assetIds: [] as string[],
  templateCodes: [] as string[],
  locationGrants: [] as Array<{ membershipId: string; locationId: string }>,
};

function precondition(message: string): never {
  throw new Error(`Acceptance precondition not met: ${message}`);
}

/**
 * The fixture's `accessFor` carries the membership's permissions and roles but not the
 * RL-24 data scopes `resolveAuthorizationContext` attaches from `tenant_settings`. Without
 * them `dataScopeAllows` narrows nothing, so T-18 would pass or fail for the wrong reason.
 * This adds them the way the product does.
 */
async function scopedAccessFor(actor: ActorKey): Promise<Access> {
  const base = await accessFor(actor);
  const rows = (await db()`select settings from tenant_settings where tenant_id = ${base.tenantId} limit 1`) as Array<{ settings: unknown }>;
  const dataScopes = grantsForRoles(rows[0]?.settings, base.context.roles);
  return { ...base, context: { ...base.context, dataScopes } };
}

async function locationIdByName(name: string): Promise<string> {
  const tenant = await tenantId();
  const rows = (await db()`
    select id from locations where tenant_id = ${tenant}
      and (attributes->>'name' = ${name} or attributes->>'code' = ${name}) limit 1
  `) as Array<{ id: string }>;
  return rows[0]?.id ?? precondition(`no \`locations\` row named "${name}" (the seed must create it for employee assignments and location grants).`);
}

/** One 08:00–20:00 A-shift day of punches, ingested and computed. */
async function workDay(owner: Access, employeeId: string, date: string) {
  const ingested = await ingestPunches(owner, {
    employeeId,
    workDate: date,
    shiftCode: SHIFTS.A,
    punches: [
      { at: at(date, "08:00"), type: "in" as const, source: "biometric_device" as const },
      { at: at(date, "20:00"), type: "out" as const, source: "biometric_device" as const },
    ],
  }, rid());
  const computed = await recomputeDay(owner, ingested.dayId, rid());
  return { dayId: ingested.dayId, status: computed.day.computedStatus ?? null, dayType: computed.trace?.dayType ?? null, reason: (computed as { reason?: string }).reason ?? null };
}

/** A full week of attendance, then the engine's own day rows for that week. */
async function workWeek(owner: Access, employeeId: string, monday: string) {
  const tenant = await tenantId();
  for (let offset = 0; offset < 7; offset += 1) {
    const day = await workDay(owner, employeeId, addDays(monday, offset));
    if (day.reason) throw new Error(`Day ${addDays(monday, offset)} was not computed: ${day.reason}`);
  }
  const days = (await db()`
    select attendance_date::text as date, status from attendance_days
    where tenant_id = ${tenant} and employee_id = ${employeeId}
      and attendance_date between ${monday} and ${addDays(monday, 6)}
    order by attendance_date
  `) as Array<{ date: string; status: string }>;
  const entries = (await db()`
    select attributes->>'date' as date, attributes->>'day_type' as day_type from attendance_entries
    where tenant_id = ${tenant} and employee_id = ${employeeId}
      and attributes->>'date' between ${monday} and ${addDays(monday, 6)}
    order by 1
  `) as Array<{ date: string; day_type: string }>;
  return { days, entries };
}

async function removeRunsForPeriod(period: string): Promise<void> {
  const tenant = await tenantId();
  const client = db();
  const runs = (await client`select id from payroll_runs where tenant_id = ${tenant} and period = ${period}`) as Array<{ id: string }>;
  for (const run of runs) {
    const members = (await client`select id from payroll_run_employees where tenant_id = ${tenant} and payroll_run_id = ${run.id}`) as Array<{ id: string }>;
    const memberIds = members.map((row) => row.id);
    const documents = (await client`
      delete from payslips where tenant_id = ${tenant} and payroll_run_employee_id = any(${memberIds}::uuid[]) returning document_id
    `) as Array<{ document_id: string }>;
    await client`delete from documents where tenant_id = ${tenant} and id = any(${documents.map((row) => row.document_id)}::uuid[])`;
    await client`delete from payroll_calculations where tenant_id = ${tenant} and payroll_run_employee_id = any(${memberIds}::uuid[])`;
    await client`delete from payroll_lines where tenant_id = ${tenant} and payroll_run_employee_id = any(${memberIds}::uuid[])`;
    await client`delete from payroll_anomalies where tenant_id = ${tenant} and payroll_run_id = ${run.id}`;
    await client`delete from payroll_approvals where tenant_id = ${tenant} and payroll_run_id = ${run.id}`;
    await client`delete from payroll_run_employees where tenant_id = ${tenant} and payroll_run_id = ${run.id}`;
    await client`delete from payroll_runs where tenant_id = ${tenant} and id = ${run.id}`;
  }
}

/**
 * Rows that reference a scenario employee under RESTRICT and that `removeScenarioRows`
 * does not (yet) cover: salary assignments, asset custody, onboarding tasks (keyed by
 * instance, not employee) and employee assignments (keyed by employment).
 */
async function removeScenario(prefix: string): Promise<void> {
  const tenant = await tenantId();
  const client = db();
  const rows = (await client`select id from employees where tenant_id = ${tenant} and employee_code like ${`${prefix}-%`}`) as Array<{ id: string }>;
  const ids = rows.map((row) => row.id);
  if (ids.length > 0) {
    await client`delete from employee_salary_assignments where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
    await client`delete from asset_assignments where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
    await client`
      delete from onboarding_tasks where tenant_id = ${tenant}
        and onboarding_instance_id in (select id from onboarding_instances where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[]))
    `;
    await client`
      delete from employee_assignments where tenant_id = ${tenant}
        and employment_id in (select id from employments where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[]))
    `;
  }
  await removeScenarioRows(prefix);
}

async function ensureScratchPosition(owner: Access, test: string): Promise<string> {
  const code = `${test}-POS-${rid().slice(0, 6).toUpperCase()}`;
  await ensurePosition(owner, code);
  created.positionCodes.push(code);
  return code;
}

async function acceptanceSanction(owner: Access) {
  const departmentId = await ensureDepartment(owner, ACCEPTANCE_DEPARTMENT);
  const lines = await listEstablishment(owner);
  const line = lines.find((entry) => entry.departmentId === departmentId);
  if (!line) {
    precondition(`no approved \`vp_manpower_lines\` row for department "${ACCEPTANCE_DEPARTMENT}" in plan year ${new Date().getUTCFullYear()} (the seed must approve sanctioned strength for it).`);
  }
  return { departmentId, line };
}

async function headroomFor(owner: Access, departmentId: string, designation: string): Promise<number> {
  const lines = await listEstablishment(owner);
  const line = lines.find((entry) => entry.departmentId === departmentId && entry.designation.toLowerCase() === designation.toLowerCase());
  if (!line) precondition(`sanction line for ${designation} in ${ACCEPTANCE_DEPARTMENT} disappeared mid-test.`);
  return line.headroom;
}

function requisitionInput(args: {
  title: string;
  positionCode: string;
  hiringManagerEmployeeId: string;
  designation: string;
  requisitionType: "addition" | "replacement";
  positions: number;
  againstPositionCode?: string;
}) {
  return {
    title: args.title,
    departmentName: ACCEPTANCE_DEPARTMENT,
    positionCode: args.positionCode,
    locationCode: PLANT_LOCATION,
    workerClass: "workman_permanent" as const,
    hiringManagerEmployeeId: args.hiringManagerEmployeeId,
    requisitionType: args.requisitionType,
    designation: args.designation,
    positions: args.positions,
    againstPositionCode: args.againstPositionCode,
    requiredBy: FUTURE_DATE,
    employmentType: "permanent" as const,
    ctcMinMinor: 3_000_000,
    ctcMaxMinor: 4_500_000,
    justification: args.requisitionType === "addition" ? "Acceptance scenario: additional headcount requested against the sanctioned line." : undefined,
    qualificationRequired: "ITI or 10th with mill-floor experience",
    experienceMinYears: 1,
    experienceMaxYears: 5,
    skills: [],
  };
}

describe.skipIf(!LIVE)("people acceptance scenarios (live, opt-in)", () => {
  afterAll(async () => {
    const tenant = await tenantId();
    const client = db();
    const failures: string[] = [];
    const attempt = async (label: string, work: () => Promise<unknown>) => {
      try {
        await work();
      } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    await attempt("payroll runs", async () => {
      await removeRunsForPeriod(T06_PERIOD);
      await removeRunsForPeriod(T18_PERIOD);
    });
    await attempt("export jobs", () => client`delete from export_jobs where tenant_id = ${tenant} and id = any(${created.exportIds}::uuid[])`);
    await attempt("requisitions", () => client`delete from requisitions where tenant_id = ${tenant} and id = any(${created.requisitionIds}::uuid[])`);
    await attempt("location grants", async () => {
      for (const grant of created.locationGrants) {
        await client`delete from vp_location_grants where tenant_id = ${tenant} and membership_id = ${grant.membershipId} and location_id = ${grant.locationId}`;
      }
    });
    for (const prefix of ["T-06", "T-07", "T-18", "T-37", "T-38", "T-39", "T-40"]) {
      await attempt(`scenario rows ${prefix}`, () => removeScenario(prefix));
    }
    await attempt("positions", () => client`delete from positions where tenant_id = ${tenant} and attributes->>'code' = any(${created.positionCodes}::text[])`);
    await attempt("asset catalogue", () => client`delete from asset_catalog where tenant_id = ${tenant} and id = any(${created.assetIds}::uuid[])`);
    await attempt("onboarding templates", () => client`delete from onboarding_templates where tenant_id = ${tenant} and attributes->>'code' = any(${created.templateCodes}::text[])`);
    if (failures.length > 0) throw new Error(`Cleanup left rows behind:\n${failures.join("\n")}`);
  }, 120_000);

  it("T-06 Contractual employee gets no rest day", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const contractual = await createScenarioEmployee({ test: "T-06", firstName: "Contract", workerCategory: "contractual" });

    // RL-05 / RL-26 resolve from configuration, at the category level, with nothing assumed.
    const rules = await getEmployeeWorkRules(owner, contractual.id);
    expect(rules.hasRestDays).toBe(false);
    expect(rules.paysOnDaysPresent).toBe(true);
    expect(rules.unresolved).not.toContain("wageType");
    expect(rules.unresolved).not.toContain("restDayPattern");

    // A week containing the usual Sunday off produces no weekly off at all.
    const week = await workWeek(owner, contractual.id, T06_WEEK_MONDAY);
    expect(week.days).toHaveLength(7);
    expect(week.days.map((row) => row.status)).not.toContain("rest_day");
    expect(week.days.find((row) => row.date === addDays(T06_WEEK_MONDAY, 6))?.status).toBe("present");
    expect(week.entries.map((row) => row.day_type)).not.toContain("Weekly Off");

    // Payroll pays on days present - and the day-rate divisor is not an approved rule, so the
    // run refuses by name rather than paying a monthly salary (RL-26, rule pack dailyWage).
    await removeRunsForPeriod(T06_PERIOD);
    const run = await createRun(owner, {
      period: T06_PERIOD,
      runType: "regular",
      payDate: `${T06_PERIOD}-30`,
      populationFilter: [contractual.code],
      includeArrears: true,
    }, rid());
    await expect(calculateRun(owner, run.id, [contractual.id], rid())).rejects.toMatchObject({
      code: "RULE_PACK_INCOMPLETE",
      details: [{ field: "dailyWage.rateDivisor" }],
    });
  });

  // Two full work weeks, computed a day at a time: fourteen ingest-and-recompute cycles,
  // each several round trips to a serverless database. The budget matches what the
  // scenario actually costs rather than the suite default, which it exceeded under load.
  it("T-07 Helper and Employee differ within the same third-party category", { timeout: 300_000 }, async () => {
    const owner = await accessFor("owner");
    const employee = await createScenarioEmployee({ test: "T-07", firstName: "ThirdParty", lastName: "Employee", workerCategory: "thirdPartyEmployee" });
    const helper = await createScenarioEmployee({ test: "T-07", firstName: "ThirdParty", lastName: "Helper", workerCategory: "thirdPartyHelper" });

    const employeeRules = await getEmployeeWorkRules(owner, employee.id);
    const helperRules = await getEmployeeWorkRules(owner, helper.id);
    expect(employeeRules.hasRestDays).toBe(true);
    expect(helperRules.hasRestDays).toBe(false);
    // Both resolve from configuration rows, not from a code-level category table.
    expect(employeeRules.source.restDayPattern).not.toBe("unresolved");
    expect(helperRules.source.restDayPattern).not.toBe("unresolved");

    const sunday = addDays(T06_WEEK_MONDAY, 6);
    const employeeWeek = await workWeek(owner, employee.id, T06_WEEK_MONDAY);
    const helperWeek = await workWeek(owner, helper.id, T06_WEEK_MONDAY);

    expect(employeeWeek.days.find((row) => row.date === sunday)?.status).toBe("rest_day");
    expect(employeeWeek.entries.find((row) => row.date === sunday)?.day_type).toBe("Weekly Off");
    expect(employeeWeek.days.filter((row) => row.status === "rest_day")).toHaveLength(1);

    expect(helperWeek.days.map((row) => row.status)).not.toContain("rest_day");
    expect(helperWeek.days.find((row) => row.date === sunday)?.status).toBe("present");
    expect(helperWeek.entries.map((row) => row.day_type)).not.toContain("Weekly Off");
  });

  it("T-18 Plant user cannot see head office salary", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const payrollAdmin = await accessFor("payrollAdmin");
    const tenant = await tenantId();
    const client = db();

    const headOfficePaid = await createScenarioEmployee({ test: "T-18", firstName: "HeadOffice", lastName: "Paid", location: PLANT_LOCATION, payrollOwner: HEAD_OFFICE_LOCATION, workerCategory: "regular" });
    const plantPaid = await createScenarioEmployee({ test: "T-18", firstName: "Plant", lastName: "Paid", location: PLANT_LOCATION, payrollOwner: PLANT_LOCATION, workerCategory: "regular" });

    // Attendance for both, at the plant.
    for (const person of [headOfficePaid, plantPaid]) {
      const day = await workDay(owner, person.id, T18_ATTENDANCE_DATE);
      if (day.reason) throw new Error(`Attendance for ${person.code} was not computed: ${day.reason}`);
    }

    // Team history reads location through employee assignments and the caller's location grants.
    const plantLocationId = await locationIdByName(PLANT_LOCATION);
    const departmentId = await ensureDepartment(owner, ACCEPTANCE_DEPARTMENT);
    const gradeId = await ensureGrade(owner);
    const positionId = await ensurePosition(owner);
    for (const person of [headOfficePaid, plantPaid]) {
      const employmentId = await ensureEmployment(owner, person.id);
      await client`
        insert into employee_assignments (id, tenant_id, department_id, employment_id, grade_id, location_id, position_id, attributes)
        values (${rid()}, ${tenant}, ${departmentId}, ${employmentId}, ${gradeId}, ${plantLocationId}, ${positionId},
          ${JSON.stringify({ effectiveFrom: "2024-01-15", source: "T-18" })}::jsonb)
      `;
    }

    // A payslip and payroll lines for both, through the product's own run lifecycle.
    await removeRunsForPeriod(T18_PERIOD);
    const run = await createRun(owner, {
      period: T18_PERIOD,
      runType: "regular",
      payDate: `${T18_PERIOD}-31`,
      populationFilter: [headOfficePaid.code, plantPaid.code],
      includeArrears: true,
    }, rid());
    await calculateRun(owner, run.id, undefined, rid());
    await approveRun(payrollAdmin, run.id, rid());
    const finalized = await finalizeRun(owner, run.id, rid());
    expect(finalized.payslips).toBe(2);

    const plantUser = await scopedAccessFor("plantUser");
    if ((plantUser.context.dataScopes ?? []).length === 0) {
      precondition(`the plant user's roles (${plantUser.context.roles.join(", ") || "none"}) carry no data scope in tenant_settings.settings.dataScopes (F-SEC-01 Role & Data Scope Setup).`);
    }
    const grants = (await client`
      select id from vp_location_grants where tenant_id = ${tenant} and membership_id = ${plantUser.context.membershipId} and location_id = ${plantLocationId}
    `) as Array<{ id: string }>;
    if (grants.length === 0) {
      // The seed scopes the plant user by data scope; team history additionally reads a
      // location grant, added here for the run and removed afterwards.
      await executeVpCommand(owner, { action: "grant_location", membershipId: plantUser.context.membershipId, locationId: plantLocationId, canViewCompensation: false, validFrom: "2024-01-01" }, rid());
      created.locationGrants.push({ membershipId: plantUser.context.membershipId, locationId: plantLocationId });
    }

    // Surface 1: the employee record. Attendance location shows, salary does not.
    const record = await getEmployee(plantUser, headOfficePaid.id);
    expect(record.location).toBe(PLANT_LOCATION);
    expect(record.salaryMasked).toBe(true);
    expect(record.basic_salary_minor).toBeNull();
    const listed = await listEmployees(plantUser, { search: headOfficePaid.code, page: 1, pageSize: 10 });
    const listedRow = listed.items.find((item) => item.id === headOfficePaid.id);
    expect(listedRow?.salaryMasked).toBe(true);
    expect(listedRow?.basic_salary_minor).toBeNull();

    // Surface 2: the salary register drops the head-office row; the unfiltered total still counts it.
    const register = await listPayslips(plantUser, { runId: run.id, page: 1, pageSize: 50 });
    expect(register.scope).toBe("all");
    expect(register.total).toBe(2);
    expect(register.items.map((item) => item.employeeId)).not.toContain(headOfficePaid.id);
    expect(register.items.map((item) => item.employeeId)).toContain(plantPaid.id);

    // Surface 3: an export carries no head-office line.
    const job = await createExport(plantUser, { resource: "payroll-lines", format: "json", period: T18_PERIOD }, rid());
    created.exportIds.push(job.id);
    const built = await buildExport(plantUser, job.id);
    expect(built.status).toBe("succeeded");
    const exported = await getExport(plantUser, job.id);
    const content = JSON.parse(String(exported.attributes.content ?? "[]")) as Array<{ employee_code: string }>;
    expect(content.length).toBe(built.rows);
    expect(content.map((row) => row.employee_code)).not.toContain(headOfficePaid.code);
    expect(content.map((row) => row.employee_code)).toContain(plantPaid.code);

    // Surface 4: team history shows the attendance and masks the salary.
    const history = await getTeamHistory(plantUser, { from: "2024-03-01", to: "2024-03-31", employeeId: headOfficePaid.id });
    expect(history.compensationMasked).toBe(true);
    const historyRows = history.rows as Array<{ employee_id: string; attendance_date: string | null; basic_salary_minor: number | null }>;
    expect(historyRows.length).toBeGreaterThan(0);
    expect(historyRows.every((row) => row.employee_id === headOfficePaid.id)).toBe(true);
    expect(historyRows.map((row) => row.attendance_date)).toContain(T18_ATTENDANCE_DATE);
    expect(historyRows.every((row) => row.basic_salary_minor === null)).toBe(true);

    // The plant-paid colleague is fully visible to the same user.
    const plantRecord = await getEmployee(plantUser, plantPaid.id);
    expect(plantRecord.salaryMasked).toBe(false);
    expect(plantRecord.basic_salary_minor).toBe(4_000_000);
    const plantHistory = await getTeamHistory(plantUser, { from: "2024-03-01", to: "2024-03-31", employeeId: plantPaid.id });
    expect((plantHistory.rows as Array<{ attendance_date: string | null }>).map((row) => row.attendance_date)).toContain(T18_ATTENDANCE_DATE);
  });

  it("T-37 Organisation chart follows the employee record", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const manager = await createScenarioEmployee({ test: "T-37", firstName: "Chart", lastName: "Manager", designation: "assistantManager", managerCode: null });
    const report = await createScenarioEmployee({ test: "T-37", firstName: "Chart", lastName: "Report" });

    const before = await getEmployee(owner, report.id);
    expect(before.manager_employee_id).not.toBe(manager.id);
    const updated = await updateEmployee(owner, report.id, before.version, {
      managerEmployeeId: manager.id,
      reason: "T-37: reporting manager changed for the organisation chart scenario.",
    }, rid());
    expect(updated.version).toBe(before.version + 1);

    // The chart is derived from the employee record: no separate hierarchy was maintained.
    const chart = await getReportingChart(owner, { department: ACCEPTANCE_DEPARTMENT });
    const managerNode = chart.roots.find((node) => node.id === manager.id);
    expect(managerNode).toBeDefined();
    expect(managerNode?.reports.map((node) => node.id)).toContain(report.id);
    expect(managerNode?.reportCount).toBeGreaterThanOrEqual(1);
    const acceptance = chart.departments.find((entry) => entry.department === ACCEPTANCE_DEPARTMENT);
    expect(acceptance).toBeDefined();
    expect(acceptance?.headcount).toBeGreaterThanOrEqual(2);
    expect(acceptance?.managers).toBeGreaterThanOrEqual(1);
    // The department filter and the department-wise grouping are the same population.
    expect(chart.total).toBe(acceptance?.headcount);
    const whole = await getReportingChart(owner);
    const departments = whole.departments.map((entry) => entry.department);
    expect(departments).toContain(ACCEPTANCE_DEPARTMENT);
    expect(new Set(departments).size).toBe(departments.length);

    // A line that would loop is refused before the write.
    const managerRecord = await getEmployee(owner, manager.id);
    await expect(updateEmployee(owner, manager.id, managerRecord.version, {
      managerEmployeeId: report.id,
      reason: "T-37: attempting a cyclic reporting line, which must be refused.",
    }, rid())).rejects.toMatchObject({ code: "POLICY_VIOLATION", details: [{ field: "managerEmployeeId", issue: "Cyclic reporting line." }] });
    const afterRefusal = await getEmployee(owner, report.id);
    await expect(updateEmployee(owner, report.id, afterRefusal.version, {
      managerEmployeeId: report.id,
      reason: "T-37: attempting self-reporting, which must be refused.",
    }, rid())).rejects.toMatchObject({ code: "POLICY_VIOLATION", details: [{ field: "managerEmployeeId", issue: "Self-reporting." }] });
    expect((await getEmployee(owner, manager.id)).manager_employee_id).toBeNull();
  });

  it("T-38 Induction and asset issue gate confirmation", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const tenant = await tenantId();
    const client = db();
    const joiner = await createScenarioEmployee({ test: "T-38", firstName: "Induction", lastName: "Joiner", joiningDate: "2024-01-15" });

    // A joining-chain template on which induction alone blocks confirmation.
    const templateCode = `T-38-TPL-${rid().slice(0, 6).toUpperCase()}`;
    await client`
      insert into onboarding_templates (id, tenant_id, attributes)
      values (${rid()}, ${tenant}, ${JSON.stringify({
        code: templateCode,
        name: "T-38 induction-gated joining chain",
        tasks: [
          { key: "documents", title: "Joining documents and Form F", required: true, owner: "hr" },
          { key: "induction", title: "Induction program attendance", required: true, owner: "hr", blocksConfirmation: true },
          { key: "assets", title: "Laptop and PPE issuance", required: true, owner: "it" },
        ],
      })}::jsonb)
    `;
    created.templateCodes.push(templateCode);

    const onboarding = await startOnboarding(owner, { employeeId: joiner.id, templateCode }, rid());
    expect(onboarding.tasks).toBe(3);
    const tasks = (await client`
      select id, attributes->>'key' as key from onboarding_tasks where tenant_id = ${tenant} and onboarding_instance_id = ${onboarding.id}
    `) as Array<{ id: string; key: string }>;
    for (const task of tasks.filter((entry) => entry.key !== "induction")) {
      await completeOnboardingTask(owner, task.id, { status: "done" }, rid());
    }
    const readiness = await onboardingReadiness(owner, onboarding.id);
    expect(readiness.confirmationReady).toBe(false);
    expect(readiness.pendingConfirmation.map((task) => task.key)).toEqual(["induction"]);

    // Confirmation is blocked while the induction item is pending.
    await expect(confirmEmployment(owner, {
      employeeId: joiner.id,
      confirmationDate: "2024-07-15",
      reason: "Probation period completed satisfactorily.",
    }, rid())).rejects.toMatchObject({ code: "INDUCTION_INCOMPLETE", details: [{ field: "induction" }] });

    // Issued assets appear at F&F for return with their recovery value.
    const entity = (await client`select id from legal_entities where tenant_id = ${tenant} limit 1`) as Array<{ id: string }>;
    if (!entity[0]) precondition("the tenant has no legal entity; the asset catalogue needs one.");
    const assetId = rid();
    const assetCode = `T-38-LAPTOP-${rid().slice(0, 6).toUpperCase()}`;
    await client`
      insert into asset_catalog (id, tenant_id, legal_entity_id, attributes)
      values (${assetId}, ${tenant}, ${entity[0].id}, ${JSON.stringify({ asset_code: assetCode, type: "Laptop", serial: assetCode, description: "T-38 issued laptop", status: "Available" })}::jsonb)
    `;
    created.assetIds.push(assetId);
    const recoveryAmountMinor = 4_500_000;
    const allocation = await allocateAsset(owner, assetId, {
      employeeId: joiner.id,
      issuedOn: "2024-01-15",
      conditionAtIssue: "new",
      acknowledgedByEmployee: false,
      recoveryAmountMinor,
      reason: "Issued at joining for the T-38 scenario.",
    }, rid());
    expect(allocation.to).toBe("allocated");
    expect(allocation.recoveryAmountMinor).toBe(recoveryAmountMinor);

    const working = await computeSettlementWorking(owner, { employeeId: joiner.id, lastWorkingDate: "2026-09-30" });
    const assetFigure = working.figures.find((figure) => figure.head === "assetRecoveryMinor");
    expect(assetFigure).toBeDefined();
    expect(assetFigure?.amountMinor).toBe(recoveryAmountMinor);
    expect(assetFigure?.blockedBy).toEqual([]);
    expect(assetFigure?.inputs).toMatchObject({ allocatedAssets: 1, assetsWithRecoveryAmount: 1 });
    expect(working.proposal.assetRecoveryMinor).toBe(recoveryAmountMinor);

    // Once the induction item is done the same confirmation goes through.
    const induction = tasks.find((entry) => entry.key === "induction");
    if (!induction) throw new Error("The template produced no induction task.");
    await completeOnboardingTask(owner, induction.id, { status: "done" }, rid());
    const confirmed = await confirmEmployment(owner, {
      employeeId: joiner.id,
      confirmationDate: "2024-07-15",
      reason: "Probation period completed satisfactorily.",
    }, rid());
    expect(confirmed.status).toBe("confirmed");
  });

  it("T-39 Replacement does not add headcount", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const { departmentId, line } = await acceptanceSanction(owner);
    const designation = line.designation;
    // The hiring manager sits outside the sanctioned key so it never counts as filled.
    const hiringManager = await createScenarioEmployee({ test: "T-39", firstName: "Hiring", lastName: "Manager", designation: "agm", department: `${ACCEPTANCE_DEPARTMENT} Scratch`, managerCode: null });

    const headroomBefore = await headroomFor(owner, departmentId, designation);
    if (headroomBefore < 1) precondition(`the ${ACCEPTANCE_DEPARTMENT}/${designation} sanction has no headroom (${headroomBefore}); an addition within the ceiling cannot be exercised.`);

    // A replacement against a vacated position code leaves the ceiling untouched.
    const vacatedPositionCode = await ensureScratchPosition(owner, "T-39");
    const replacement = await createRequisition(owner, requisitionInput({
      title: "Replacement against vacated seat",
      positionCode: vacatedPositionCode,
      hiringManagerEmployeeId: hiringManager.id,
      designation,
      requisitionType: "replacement",
      positions: 1,
      againstPositionCode: vacatedPositionCode,
    }), rid());
    created.requisitionIds.push(replacement.id);
    expect(replacement.requisitionType).toBe("replacement");
    const replacementApproval = await approveRequisition(owner, replacement.id, { override: false, recruiterEmployeeId: hiringManager.id }, rid());
    expect(replacementApproval.status).toBe("approved");
    expect(replacementApproval).toMatchObject({ allowed: true, consumesSanction: false, overridden: false });
    expect(await headroomFor(owner, departmentId, designation)).toBe(headroomBefore);

    // A new position consumes one unit of sanctioned strength.
    const additionPositionCode = await ensureScratchPosition(owner, "T-39");
    const addition = await createRequisition(owner, requisitionInput({
      title: "Addition within headroom",
      positionCode: additionPositionCode,
      hiringManagerEmployeeId: hiringManager.id,
      designation,
      requisitionType: "addition",
      positions: 1,
    }), rid());
    created.requisitionIds.push(addition.id);
    const additionApproval = await approveRequisition(owner, addition.id, { override: false, recruiterEmployeeId: hiringManager.id }, rid());
    expect(additionApproval.status).toBe("approved");
    expect(additionApproval).toMatchObject({ allowed: true, consumesSanction: true, overridden: false, establishmentChecked: true, headroomAfter: headroomBefore - 1 });
    expect(await headroomFor(owner, departmentId, designation)).toBe(headroomBefore - 1);
  });

  it("T-40 Requisition beyond sanctioned strength is stopped", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const { departmentId, line } = await acceptanceSanction(owner);
    const designation = line.designation;
    const hiringManager = await createScenarioEmployee({ test: "T-40", firstName: "Hiring", lastName: "Manager", designation: "agm", department: `${ACCEPTANCE_DEPARTMENT} Scratch`, managerCode: null });
    const positionCode = await ensureScratchPosition(owner, "T-40");

    /** A draft addition that takes the key past its ceiling by exactly one position. */
    const overCeilingDraft = async (title: string) => {
      const headroom = await headroomFor(owner, departmentId, designation);
      const positions = Math.min(99, Math.max(headroom, 0) + 1);
      const draft = await createRequisition(owner, requisitionInput({ title, positionCode, hiringManagerEmployeeId: hiringManager.id, designation, requisitionType: "addition", positions }), rid());
      created.requisitionIds.push(draft.id);
      return draft;
    };
    const refusal = (issue: string) => ({ code: "POLICY_VIOLATION", details: [{ field: "requisition", issue }] });
    const overrideReason = "Board-approved expansion of the acceptance line for the demo.";
    expect(overrideReason.length).toBeGreaterThanOrEqual(20);

    // Blocked outright: no warning-only path exists.
    const blocked = await overCeilingDraft("Over ceiling, no override");
    await expect(approveRequisition(owner, blocked.id, { override: false, recruiterEmployeeId: hiringManager.id }, rid()))
      .rejects.toMatchObject(refusal("SANCTION_EXCEEDED"));

    // Override by a role without the manpower-approval permission.
    let unauthorised: Access | null = null;
    for (const actor of ["hrManager", "supervisor", "hod", "hrHead", "payrollAdmin", "finance", "director"] as ActorKey[]) {
      const candidate = await accessFor(actor);
      if (candidate.context.permissions.includes("employee.write") && !candidate.context.permissions.includes(MANPOWER_APPROVE_PERMISSION)) {
        unauthorised = candidate;
        break;
      }
    }
    if (!unauthorised) precondition(`no seeded actor holds employee.write without ${MANPOWER_APPROVE_PERMISSION}; OVERRIDE_NOT_PERMITTED cannot be exercised.`);
    const notPermitted = await overCeilingDraft("Over ceiling, unauthorised override");
    await expect(approveRequisition(unauthorised, notPermitted.id, { override: true, overrideReason, recruiterEmployeeId: hiringManager.id }, rid()))
      .rejects.toMatchObject(refusal("OVERRIDE_NOT_PERMITTED"));

    // Override by the very person who approved the ceiling.
    let approver: Access | null = null;
    for (const actor of Object.keys(ACTORS) as ActorKey[]) {
      const candidate = await accessFor(actor);
      if (candidate.context.membershipId === line.approvedByMembershipId) {
        approver = candidate;
        break;
      }
    }
    if (!approver) precondition(`the membership that approved the ${ACCEPTANCE_DEPARTMENT}/${designation} sanction (${line.approvedByMembershipId}) is not one of the seeded actors; OVERRIDE_SELF_APPROVAL cannot be exercised.`);
    if (approver.context.membershipId === owner.context.membershipId) {
      precondition("the owner approved the acceptance sanction, so the owner cannot also be the distinct overrider the success path needs; the seed must approve it as another actor (e.g. the director).");
    }
    const selfApproval = await overCeilingDraft("Over ceiling, self-approval override");
    await expect(approveRequisition(approver, selfApproval.id, { override: true, overrideReason, recruiterEmployeeId: hiringManager.id }, rid()))
      .rejects.toMatchObject(refusal("OVERRIDE_SELF_APPROVAL"));

    // Override without an adequate reason.
    const reasonless = await overCeilingDraft("Over ceiling, reason too short");
    await expect(approveRequisition(owner, reasonless.id, { override: true, overrideReason: "Needed now", recruiterEmployeeId: hiringManager.id }, rid()))
      .rejects.toMatchObject(refusal("OVERRIDE_REASON_REQUIRED"));

    // An authorised, distinct approver with a recorded reason may exceed the ceiling.
    const overridden = await overCeilingDraft("Over ceiling, recorded override");
    const approval = await approveRequisition(owner, overridden.id, { override: true, overrideReason, recruiterEmployeeId: hiringManager.id }, rid());
    expect(approval.status).toBe("approved");
    expect(approval).toMatchObject({ allowed: true, overridden: true, consumesSanction: true, establishmentChecked: true });
    expect((approval as { headroomAfter: number }).headroomAfter).toBeLessThan(0);
    const stored = (await db()`select attributes from requisitions where id = ${overridden.id}`) as Array<{ attributes: Record<string, unknown> }>;
    expect(stored[0]?.attributes).toMatchObject({ status: "approved", override: true, override_reason: overrideReason });
  });
});
