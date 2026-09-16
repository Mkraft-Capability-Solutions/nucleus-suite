import * as fs from "node:fs";
import * as path from "node:path";
import { hashPassword } from "better-auth/crypto";
import { SeedContext, uuid, timestampStr, dateStr, hasData, TENANT_ID } from "./types";
import { courseCodeFromTitle, enrollmentStatusFromText, looksLikeCode, requisitionStatusFromText } from "./talent-vocabulary";

export function readSheetData(sheetFileName: string): any[] {
  const filePath = path.resolve(__dirname, "../excel_data", sheetFileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Sheet file not found: ${filePath}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export async function loadExcelDataset(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("\n========================================================");
  console.log("== LOADING NUCLEUS HRMS DEMO DATASET v1.0 FROM EXCEL ==");
  console.log("========================================================\n");

  // Bypass RLS for admin loading
  await client`SELECT set_config('app.platform_admin', 'true', false)`;

  // ID Caches for foreign key resolution across sheets
  const entityIdByCode: Record<string, string> = {};
  const locationIdByCode: Record<string, string> = {};
  const orgUnitIdByCode: Record<string, string> = {};
  const costCenterIdByCode: Record<string, string> = {};
  const designationIdByCode: Record<string, string> = {};
  /**
   * Sheet 05's title and grade rank per designation code.
   *
   * `employees.designation` is what every screen shows and `employees.designation_level`
   * is the grade rank two policies compare against — the grace exemption
   * (`attendance/service.ts`, `designationLevel >= exemptFromGradeRank`) and RL-07's
   * senior leave band (`leave/accrual.ts`). Sheet 12 gives only the DES code, so both
   * have to be resolved through sheet 05 rather than written from the employee row.
   */
  const designationMetaByCode: Record<string, { title: string; rank: number | null }> = {};
  const gradeIdByBand: Record<string, string> = {};
  const workerClassIdByCode: Record<string, string> = {};
  const shiftIdByCode: Record<string, string> = {};
  const attendancePolicyIdByHours: Record<string, string> = {};
  const holidayCalIdByLoc: Record<string, string> = {};
  const positionIdByCode: Record<string, string> = {};
  const employeeIdByCode: Record<string, string> = {};
  const personIdByCode: Record<string, string> = {};
  const employmentIdByCode: Record<string, string> = {};
  const membershipIdByCode: Record<string, string> = {};
  const payGroupIdByCode: Record<string, string> = {};
  const salaryStructureIdByCode: Record<string, string> = {};
  const payComponentIdByCode: Record<string, string> = {};
  const leaveTypeIdByCode: Record<string, string> = {};
  const leavePolicyIdByBand: Record<string, string> = {};
  const glAccountIdByCode: Record<string, string> = {};
  const loanProductIdByCode: Record<string, string> = {};
  const loanIdByAppId: Record<string, string> = {};
  const payrollRunIdByPeriod: Record<string, string> = {};
  const offboardingCaseIdByCode: Record<string, string> = {};
  const courseIdByTitle: Record<string, string> = {};
  const courseVersionIdByTitle: Record<string, string> = {};
  const assetIdByCode: Record<string, string> = {};
  const requisitionIdByCode: Record<string, string> = {};

  // -------------------------------------------------------------
  // 1. Sheet 02: Legal Entities
  // -------------------------------------------------------------
  console.log("--> Loading 02_Legal_Entities...");
  const rawEntities = readSheetData("02_legal_entities.json");
  const defaultJurId = ctx.jurisdictionId || (await client`SELECT id FROM jurisdictions LIMIT 1`)[0]?.id;

  if (await hasData(client, "legal_entities")) {
    const existing = await client`SELECT id, code FROM legal_entities WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) entityIdByCode[r.code] = r.id;
    if (existing[0]) ctx.legalEntityId = existing[0].id;
  }

  for (const row of rawEntities) {
    const code = row["Entity code"];
    if (!code) continue;
    if (!entityIdByCode[code]) {
      const id = uuid();
      await client`
        INSERT INTO legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status)
        VALUES (${id}, ${tenantId}, ${defaultJurId}, ${code}, ${row["Registered name"]}, 'INR', 'active')
      `;
      entityIdByCode[code] = id;
      if (!ctx.legalEntityId) ctx.legalEntityId = id;
    }
  }

  // -------------------------------------------------------------
  // 2. Sheet 03: Locations & Establishments
  // -------------------------------------------------------------
  console.log("--> Loading 03_Locations & Establishments...");
  const rawLocations = readSheetData("03_locations.json");
  const establishmentIdByCode: Record<string, string> = {};

  if (await hasData(client, "establishments")) {
    const existing = await client`SELECT id, attributes->>'code' as code FROM establishments WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.code) establishmentIdByCode[r.code] = r.id;
    }
    if (existing[0] && !ctx.establishmentId) ctx.establishmentId = existing[0].id;
  }

  for (const row of rawLocations) {
    const code = row["Location code"];
    if (!code) continue;

    if (!establishmentIdByCode[code]) {
      const estId = uuid();
      const leId = entityIdByCode[row["Entity"]] || ctx.legalEntityId;
      await client`
        INSERT INTO establishments (id, tenant_id, legal_entity_id, jurisdiction_id, attributes)
        VALUES (${estId}, ${tenantId}, ${leId}, ${defaultJurId}, ${JSON.stringify({
          code,
          name: row["Location name"],
          state: row["State"],
          type: row["Establishment type"]
        })}::jsonb)
      `;
      establishmentIdByCode[code] = estId;
      if (!ctx.establishmentId) ctx.establishmentId = estId;
    }
  }

  if (await hasData(client, "locations")) {
    const existing = await client`SELECT id, attributes->>'code' as code FROM locations WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.code) locationIdByCode[r.code] = r.id;
    }
  }

  for (const row of rawLocations) {
    const code = row["Location code"];
    if (!code) continue;
    if (!locationIdByCode[code]) {
      const id = uuid();
      const estId = establishmentIdByCode[code] || ctx.establishmentId;
      await client`
        INSERT INTO locations (id, tenant_id, establishment_id, attributes)
        VALUES (${id}, ${tenantId}, ${estId}, ${JSON.stringify({
          code,
          name: row["Location name"],
          country_code: 'IN',
          timezone: 'Asia/Kolkata',
          city: row["City"],
          state: row["State"],
          state_code: row["State code"],
          pin: row["PIN"],
          establishment_type: row["Establishment type"],
          factory_licence: row["Factory licence"],
          pt_slab: row["PT slab set"],
          lwf_set: row["LWF set"],
          payroll_group: row["Payroll group"],
          factory_act_applies: row["Factory Act applies"]
        })}::jsonb)
      `;
      locationIdByCode[code] = id;
    }
  }

  // -------------------------------------------------------------
  // 3. Sheet 04: Org Units (Departments, BUs, Cost Centers)
  // -------------------------------------------------------------
  console.log("--> Loading 04_Org_Units...");
  const rawOrgUnits = readSheetData("04_org_units.json");

  if (await hasData(client, "departments")) {
    const existing = await client`SELECT id, attributes->>'code' as code FROM departments WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.code) orgUnitIdByCode[r.code] = r.id;
    }
  }

  // Ensure top-level business unit exists
  let mainBuId = ctx.buHoId;
  if (!mainBuId) {
    const buRows = await client`SELECT id FROM business_units WHERE tenant_id = ${tenantId} LIMIT 1`;
    if (buRows.length > 0) {
      mainBuId = buRows[0].id;
    } else {
      mainBuId = uuid();
      await client`
        INSERT INTO business_units (id, tenant_id, legal_entity_id, attributes)
        VALUES (${mainBuId}, ${tenantId}, ${ctx.legalEntityId}, ${JSON.stringify({ code: 'BU-VINDHYA', name: 'Vindhya Manufacturing Business Group' })}::jsonb)
      `;
    }
    ctx.buHoId = mainBuId;
  }

  for (const row of rawOrgUnits) {
    const code = row["Org unit code"];
    if (!code) continue;

    // Cost center
    const ccCode = row["Cost centre"];
    if (ccCode && !costCenterIdByCode[ccCode]) {
      if (!(await hasData(client, "cost_centers"))) {
        const ccId = uuid();
        await client`
          INSERT INTO cost_centers (id, tenant_id, legal_entity_id, attributes)
          VALUES (${ccId}, ${tenantId}, ${ctx.legalEntityId}, ${JSON.stringify({ code: ccCode, name: row["Org unit name"] + " Cost Centre" })}::jsonb)
        `;
        costCenterIdByCode[ccCode] = ccId;
      }
    }

    if (!orgUnitIdByCode[code]) {
      const deptId = uuid();
      await client`
        INSERT INTO departments (id, tenant_id, business_unit_id, attributes)
        VALUES (${deptId}, ${tenantId}, ${mainBuId}, ${JSON.stringify({
          code,
          name: row["Org unit name"],
          level: row["Level"],
          type: row["Type"],
          parent_code: row["Parent"],
          primary_location: row["Primary location"],
          cost_centre: row["Cost centre"]
        })}::jsonb)
      `;
      orgUnitIdByCode[code] = deptId;
    }
  }

  // -------------------------------------------------------------
  // 4. Sheet 05: Designations & Grades
  // -------------------------------------------------------------
  console.log("--> Loading 05_Designations...");
  const rawDesignations = readSheetData("05_designations.json");

  for (const band of ["E", "D", "C", "B", "A", "S"]) {
    if (!gradeIdByBand[band]) {
      const existing = await client`SELECT id FROM grades WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${'BAND-' + band} LIMIT 1`;
      if (existing.length > 0) {
        gradeIdByBand[band] = existing[0].id;
      } else {
        const gId = uuid();
        await client`
          INSERT INTO grades (id, tenant_id, attributes)
          VALUES (${gId}, ${tenantId}, ${JSON.stringify({
            code: 'BAND-' + band,
            name: 'Band ' + band,
            rank: band === "E" ? 1 : band === "D" ? 2 : band === "C" ? 3 : band === "B" ? 4 : 5
          })}::jsonb)
        `;
        gradeIdByBand[band] = gId;
      }
    }
  }

  if (await hasData(client, "job_profiles")) {
    const existing = await client`SELECT id, attributes->>'code' as code FROM job_profiles WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.code) designationIdByCode[r.code] = r.id;
    }
  }

  for (const row of rawDesignations) {
    const code = row["Designation code"];
    // v1.1 footnote rows repeat the sheet's own explanatory text in this column instead
    // of a real code; every genuine designation code matches DES-<n>.
    if (!code || !/^DES-\d+$/.test(code)) continue;
    const gradeRank = row["Grade rank"] === null || row["Grade rank"] === undefined ? null : Number(row["Grade rank"]);
    const defaultLeaveScheme = row["Default leave scheme"] ?? null;
    designationMetaByCode[code] = { title: row["Title"], rank: gradeRank };
    if (!designationIdByCode[code]) {
      const jpId = uuid();
      const defaultGradeId = gradeIdByBand[row["Band"]] || Object.values(gradeIdByBand)[0] || null;
      await client`
        INSERT INTO job_profiles (id, tenant_id, default_grade_id, attributes)
        VALUES (${jpId}, ${tenantId}, ${defaultGradeId}, ${JSON.stringify({
          code,
          title: row["Title"],
          band: row["Band"],
          leave_band: row["Leave band"],
          exempt_from_grace: row["Exempt from grace deduction"],
          ot_default: row["Overtime default"],
          notice_days: row["Notice period (days)"],
          grade_rank: gradeRank,
          default_leave_scheme: defaultLeaveScheme
        })}::jsonb)
      `;
      designationIdByCode[code] = jpId;
    } else {
      // v1.1 GAP FIX: grade_rank and default_leave_scheme were added to this dataset
      // revision. A job_profiles row created by an earlier run of this loader (v1.0
      // shape) never got them, so every "and above" rule had nothing to compare
      // against. Backfill onto the existing row rather than re-inserting.
      await client`
        UPDATE job_profiles SET attributes = attributes || ${JSON.stringify({
          grade_rank: gradeRank,
          default_leave_scheme: defaultLeaveScheme
        })}::jsonb
        WHERE tenant_id = ${tenantId} AND id = ${designationIdByCode[code]}
      `;
    }
  }

  // -------------------------------------------------------------
  // 5. Sheet 06: Worker Classes
  // -------------------------------------------------------------
  console.log("--> Loading 06_Worker_Classes...");
  const rawWorkerClasses = readSheetData("06_worker_classes.json");

  if (await hasData(client, "worker_categories")) {
    const existing = await client`SELECT id, attributes->>'code' as code FROM worker_categories WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.code) workerClassIdByCode[r.code] = r.id;
    }
  }

  for (const row of rawWorkerClasses) {
    const code = row["Class code"];
    if (!code) continue;
    if (!workerClassIdByCode[code]) {
      const id = uuid();
      await client`
        INSERT INTO worker_categories (id, tenant_id, attributes)
        VALUES (${id}, ${tenantId}, ${JSON.stringify({
          code,
          name: row["Label"],
          has_rest_days: row["Has rest days"],
          rest_day_pattern: row["Rest day pattern"],
          wage_type: row["Wage type"],
          ot_eligibility: row["Overtime eligibility"],
          leave_eligible: row["Leave eligible"],
          statutory_set: row["Statutory set"],
          obligation: row["Obligation"]
        })}::jsonb)
      `;
      workerClassIdByCode[code] = id;
    }
  }

  // -------------------------------------------------------------
  // 6. Sheet 07: Shifts
  // -------------------------------------------------------------
  console.log("--> Loading 07_Shifts...");
  const rawShifts = readSheetData("07_shifts.json");

  if (await hasData(client, "shifts")) {
    const existing = await client`SELECT id, attributes->>'code' as code FROM shifts WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.code) shiftIdByCode[r.code] = r.id;
    }
  }

  for (const row of rawShifts) {
    const code = row["Shift code"];
    if (!code) continue;
    if (!shiftIdByCode[code]) {
      const id = uuid();
      await client`
        INSERT INTO shifts (id, tenant_id, attributes)
        VALUES (${id}, ${tenantId}, ${JSON.stringify({
          code,
          name: row["Shift name"],
          shift_group: row["Shift group"],
          start_time: row["Start"],
          end_time: row["End"],
          duration_minutes: row["Duration (min)"],
          break_paid_minutes: row["Break \u2014 recorded, paid (min)"],
          break_deducted_minutes: row["Break \u2014 deducted (min)"],
          earliest_in: row["Inference window \u2014 earliest in"],
          latest_in: row["Inference window \u2014 latest in"],
          crosses_midnight: row["Crosses midnight"] === "Y"
        })}::jsonb)
      `;
      shiftIdByCode[code] = id;
    }
  }

  // -------------------------------------------------------------
  // 7. Sheet 08: Attendance Rules & Policies
  // -------------------------------------------------------------
  console.log("--> Loading 08_Attendance_Rules...");
  const rawAttendanceRules = readSheetData("08_attendance_rules.json");

  if (await hasData(client, "attendance_policies")) {
    const existing = await client`SELECT id, attributes->>'shift_hours' as hours FROM attendance_policies WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.hours) attendancePolicyIdByHours[r.hours] = r.id;
    }
    if (existing[0] && !ctx.attendancePolicyId) {
      ctx.attendancePolicyId = existing[0].id;
    }
  }

  for (const row of rawAttendanceRules) {
    const hours = String(row["Shift hours"]);
    if (!attendancePolicyIdByHours[hours]) {
      const id = uuid();
      await client`
        INSERT INTO attendance_policies (id, tenant_id, attributes)
        VALUES (${id}, ${tenantId}, ${JSON.stringify({
          shift_hours: hours,
          half_day_below_min: row["Half day if net below (min)"],
          absent_below_min: row["Absent if net below (min)"],
          grace_in_min: row["Grace in (min)"],
          grace_out_min: row["Grace out (min)"],
          late_instances_allowed: row["Late instances allowed per month"],
          long_night_finish_after: row["Long night finishes after"],
          next_day_relief_until: row["Next-day relief until"],
          rule_statement: row["Stated as"]
        })}::jsonb)
      `;
      attendancePolicyIdByHours[hours] = id;
      if (!ctx.attendancePolicyId) ctx.attendancePolicyId = id;
    }
  }

  // -------------------------------------------------------------
  // 8. Sheet 09: Holiday Calendar
  // -------------------------------------------------------------
  console.log("--> Loading 09_Holiday_Calendar...");
  const rawHolidays = readSheetData("09_holiday_calendar.json");

  if (!(await hasData(client, "holiday_calendars"))) {
    const calId = uuid();
    await client`
      INSERT INTO holiday_calendars (id, tenant_id, jurisdiction_id, attributes)
      VALUES (${calId}, ${tenantId}, ${defaultJurId}, ${JSON.stringify({ year: 2026, name: "Vindhya Manufacturing Holiday Calendar 2026" })}::jsonb)
    `;

    if (!(await hasData(client, "holidays"))) {
      for (const row of rawHolidays) {
        if (!row["Date"]) continue;
        await client`
          INSERT INTO holidays (id, tenant_id, holiday_calendar_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${calId}, ${JSON.stringify({
            holiday_date: row["Date"],
            name: row["Holiday"],
            applicable_locations: row["Applicable locations"],
            type: row["Type"]
          })}::jsonb)
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 9. Sheet 10: Sanctioned Manpower
  // -------------------------------------------------------------
  console.log("--> Loading 10_Sanctioned_Manpower...");
  const rawManpower = readSheetData("10_sanctioned_manpower.json");

  if (!(await hasData(client, "manpower_plans"))) {
    const planId = uuid();
    await client`
      INSERT INTO manpower_plans (id, tenant_id, legal_entity_id, attributes)
      VALUES (${planId}, ${tenantId}, ${ctx.legalEntityId}, ${JSON.stringify({
        plan_year: 2026,
        title: "Annual Sanctioned Headcount Budget FY27",
        status: "approved"
      })}::jsonb)
    `;

    if (!(await hasData(client, "manpower_plan_lines"))) {
      for (const row of rawManpower) {
        const deptId = orgUnitIdByCode[row["Org unit"]] || (await client`SELECT id FROM departments WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
        const desId = designationIdByCode[row["Designation"]] || (await client`SELECT id FROM job_profiles WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
        const locId = locationIdByCode[row["Location"]] || (await client`SELECT id FROM locations WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
        const gId = gradeIdByBand["B"] || (await client`SELECT id FROM grades WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

        await client`
          INSERT INTO manpower_plan_lines (
            id, tenant_id, manpower_plan_id, department_id, job_profile_id, 
            location_id, grade_id, attributes
          )
          VALUES (
            ${uuid()}, ${tenantId}, ${planId}, ${deptId}, ${desId},
            ${locId}, ${gId}, ${JSON.stringify({
              record_code: row["Record"],
              sanctioned: row["Sanctioned"],
              filled: row["Filled"],
              open_requisitions: row["Open requisitions"],
              effective_from: row["Effective from"],
              approved_by: row["Approved by"],
              demo_point: row["Demo point"]
            })}::jsonb
          )
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 10. Sheet 11: Positions
  // -------------------------------------------------------------
  console.log("--> Loading 11_Positions...");
  const rawPositions = readSheetData("11_positions.json");

  if (await hasData(client, "positions")) {
    const existing = await client`SELECT id, attributes->>'code' as code FROM positions WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.code) positionIdByCode[r.code] = r.id;
    }
  }

  for (const row of rawPositions) {
    const code = row["Position code"];
    if (!code) continue;
    if (!positionIdByCode[code]) {
      const posId = uuid();
      const deptId = orgUnitIdByCode[row["Org unit"]] || (await client`SELECT id FROM departments WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      const gId = gradeIdByBand[row["Grade"]] || (await client`SELECT id FROM grades WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      const desId = designationIdByCode["DES-08"] || (await client`SELECT id FROM job_profiles WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

      await client`
        INSERT INTO positions (id, tenant_id, department_id, grade_id, job_profile_id, attributes)
        VALUES (${posId}, ${tenantId}, ${deptId}, ${gId}, ${desId}, ${JSON.stringify({
          code,
          title: row["Title"],
          location: row["Location"],
          cost_centre: row["Cost centre"],
          status: row["Status"],
          current_incumbent: row["Current incumbent"],
          last_incumbent: row["Last incumbent"],
          vacated_on: row["Vacated on"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
      positionIdByCode[code] = posId;
    }
  }

  // -------------------------------------------------------------
  // 11. Sheet 12: Employees (The 68-person core roster!)
  // -------------------------------------------------------------
  console.log("--> Loading 12_Employees...");
  const rawEmployees = readSheetData("12_employees.json");
  const hashedPw = await hashPassword("Mkraft@123456");

  // Filter only valid employee rows starting with 'E'
  const validEmployees = rawEmployees.filter(r => r["Employee code"] && String(r["Employee code"]).startsWith("E"));
  console.log(`  Found ${validEmployees.length} valid employee rows from dataset.`);

  if (await hasData(client, "employees")) {
    const existing = await client`SELECT id, employee_code FROM employees WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) employeeIdByCode[r.employee_code] = r.id;
  }

  for (const row of validEmployees) {
    const empCode = String(row["Employee code"]);
    const fullName = String(row["Full name"]);
    const email = `${fullName.toLowerCase().replace(/[^a-z0-9]/g, ".")}.${empCode.toLowerCase()}@vindhya.demo`;

    // `employees.designation` holds the DES CODE, not the title: the people directory
    // aliases it `designation_code` and joins job_profiles on
    // `jp.attributes->>'code' = e.designation` to read the title from
    // (src/server/organization/directory.ts). Writing the title here breaks that join and
    // the directory loses every designation name. So the code stays, and only the grade
    // rank - which sheet 12 does not carry and this loader never wrote - is resolved
    // through sheet 05.
    const designationCode = row["Designation"];
    const designationMeta = designationMetaByCode[designationCode] ?? null;
    const designationRank = designationMeta?.rank ?? null;

    let empId = employeeIdByCode[empCode];
    let pId = "";
    let userId = "";

    if (!empId) {
      empId = uuid();
      pId = uuid();
      userId = uuid();

      // Better-auth user
      await client`
        INSERT INTO "user" (id, name, email, email_verified, status)
        VALUES (${userId}, ${fullName}, ${email}, true, ${row["Status"] === "Active" ? "active" : "disabled"})
        ON CONFLICT (email) DO NOTHING
      `;

      // People table
      await client`
        INSERT INTO people (id, tenant_id, attributes)
        VALUES (${pId}, ${tenantId}, ${JSON.stringify({
          legal_first_name: fullName.split(" ")[0],
          legal_last_name: fullName.split(" ").slice(1).join(" ") || "Employee",
          date_of_birth: row["Date of birth"],
          gender: row["Gender"]
        })}::jsonb)
      `;

      // Employees table
      await client`
        INSERT INTO employees (
          id, tenant_id, person_id, employee_code, first_name, last_name,
          designation, designation_level, department, location, joining_date, basic_salary_minor, status
        )
        VALUES (
          ${empId}, ${tenantId}, ${pId}, ${empCode}, ${fullName.split(" ")[0]}, ${fullName.split(" ").slice(1).join(" ") || "Employee"},
          ${designationCode}, ${designationRank ?? 0}, ${row["Org unit"]}, ${row["Location"]}, ${row["Date of joining"]}, 5000000, ${row["Status"] === "Active" ? "active" : "inactive"}
        )
      `;
      employeeIdByCode[empCode] = empId;
      personIdByCode[empCode] = pId;

      // Membership in workspace
      const memId = uuid();
      await client`
        INSERT INTO memberships (id, tenant_id, user_id, role, status)
        VALUES (${memId}, ${tenantId}, ${userId}, 'employee', 'active')
        ON CONFLICT DO NOTHING
      `;
      membershipIdByCode[empCode] = memId;

      // Employments table
      const empLeId = entityIdByCode[row["Entity"]] || ctx.legalEntityId;
      const wcId = workerClassIdByCode[row["Worker class"]] || (await client`SELECT id FROM worker_categories WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      const empmtId = uuid();
      await client`
        INSERT INTO employments (id, tenant_id, employee_id, legal_entity_id, worker_category_id, attributes)
        VALUES (${empmtId}, ${tenantId}, ${empId}, ${empLeId}, ${wcId}, ${JSON.stringify({
          start_date: row["Date of joining"],
          status: row["Status"] === "Active" ? "active" : "terminated",
          worker_class: row["Worker class"],
          vendor: row["Vendor"],
          payroll_group: row["Payroll group"]
        })}::jsonb)
      `;
      employmentIdByCode[empCode] = empmtId;

      // Employee assignments
      const dId = orgUnitIdByCode[row["Org unit"]] || (await client`SELECT id FROM departments WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      const lId = locationIdByCode[row["Location"]] || (await client`SELECT id FROM locations WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      const gId = gradeIdByBand[row["Band"]] || (await client`SELECT id FROM grades WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      const posId = (await client`SELECT id FROM positions WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

      await client`
        INSERT INTO employee_assignments (
          id, tenant_id, employment_id, department_id, location_id, grade_id, position_id, attributes
        )
        VALUES (
          ${uuid()}, ${tenantId}, ${empmtId}, ${dId}, ${lId}, ${gId}, ${posId},
          ${JSON.stringify({
            effective_from: row["Date of joining"],
            manager_code: row["Manager code"],
            manager_name: row["Manager name"],
            default_shift: row["Default shift"],
            shift_group: row["Shift group"]
          })}::jsonb
        )
      `;

      // Bank account
      if (row["Bank a/c last 4"]) {
        await client`
          INSERT INTO bank_accounts (id, tenant_id, employee_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${empId}, ${JSON.stringify({
            bank_name: "State Bank of India",
            account_number: `30182761${row["Bank a/c last 4"].replace(/[^0-9]/g, "") || "4455"}`,
            ifsc_code: "SBIN0001234",
            is_primary: true
          })}::jsonb)
        `;
      }
    } else {
      // v1.1 GAP FIX. This loader left `designation_level` at its column default of 0,
      // and did so silently: 0 is below every configured threshold, so
      // the entire Excel roster was treated as junior — no grace exemption and no RL-07
      // senior leave band, whatever the person's actual grade. Sheet 41's own demo
      // record depends on the opposite (E1021, a Manager at rank 55, takes five lates in
      // September and stays Present), so the rank has to be on the row for the dataset
      // to demonstrate what it says it demonstrates.
      //
      // `designation` is re-asserted as the CODE too, because a previous revision of this
      // fix wrote the title there and broke the directory's job_profiles join. Only these
      // two columns are touched, and only when sheet 05 supplies a value — nothing else
      // about an existing employee is rewritten here.
      if (designationMeta) {
        await client`
          UPDATE employees
          SET designation = ${designationCode},
              designation_level = ${designationRank ?? 0}
          WHERE tenant_id = ${tenantId} AND id = ${empId}
            AND (designation IS DISTINCT FROM ${designationCode}
                 OR designation_level IS DISTINCT FROM ${designationRank ?? 0})
        `;
      }
    }
  }

  // Sheet 05 owns the designation ladder, and `employees.designation_level` is a single
  // tenant-wide column that two thresholds are compared against — the grace exemption and
  // RL-07's senior leave band. Several scripts write employees into this tenant (the base
  // demo seed and the acceptance fixture as well as this loader), and any of them writing
  // a rank on a different scale leaves one cohort judged against the other's threshold.
  // Re-assert the sheet's rank wherever a row's designation is one sheet 05 names, so the
  // ladder converges no matter who wrote the row. Titles sheet 05 does not name (the
  // acceptance approver personas, the base demo's own titles) are left exactly as they are.
  {
    // Matched on the code AND the title, because this column carries both vocabularies:
    // this loader writes the DES code, while the acceptance fixture and the base demo
    // seed write a job title. Either one identifies the same rung of the same ladder.
    let realigned = 0;
    for (const [code, meta] of Object.entries(designationMetaByCode)) {
      if (meta.rank === null) continue;
      const changed = await client`
        UPDATE employees SET designation_level = ${meta.rank}
        WHERE tenant_id = ${tenantId}
          AND designation IN (${code}, ${meta.title})
          AND designation_level IS DISTINCT FROM ${meta.rank}
        RETURNING id
      `;
      realigned += (changed as any[]).length;
    }
    if (realigned > 0) console.log(`  Realigned ${realigned} employee row(s) onto sheet 05's grade ladder.`);
  }

  // -------------------------------------------------------------
  // 12. Sheet 13: Salary Structure
  // -------------------------------------------------------------
  console.log("--> Loading 13_Salary_Structure...");
  const rawSalaries = readSheetData("13_salary_structure.json");

  // Pay Group
  let pgId = "";
  if (await hasData(client, "pay_groups")) {
    pgId = (await client`SELECT id FROM pay_groups WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  } else {
    pgId = uuid();
    await client`
      INSERT INTO pay_groups (id, tenant_id, legal_entity_id, attributes)
      VALUES (${pgId}, ${tenantId}, ${ctx.legalEntityId}, ${JSON.stringify({ code: "PG-MONTHLY-MFG", name: "Manufacturing Monthly Standard", currency: "INR" })}::jsonb)
    `;
  }

  // Salary Structure
  let salStructId = "";
  if (await hasData(client, "salary_structures")) {
    salStructId = (await client`SELECT id FROM salary_structures WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  } else {
    salStructId = uuid();
    await client`
      INSERT INTO salary_structures (id, tenant_id, pay_group_id, attributes)
      VALUES (${salStructId}, ${tenantId}, ${pgId}, ${JSON.stringify({ code: "SAL-MFG-2026", name: "Vindhya Manufacturing Master Salary Scale 2026" })}::jsonb)
    `;
  }

  // Pay components
  const salComponents = ["BASIC", "DA", "HRA", "CONVEYANCE", "SPECIAL_ALLOWANCE", "PF", "ESI", "PT"];
  for (const cCode of salComponents) {
    if (!payComponentIdByCode[cCode]) {
      const existing = await client`SELECT id FROM pay_components WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${cCode} LIMIT 1`;
      if (existing.length > 0) {
        payComponentIdByCode[cCode] = existing[0].id;
      } else {
        const id = uuid();
        await client`
          INSERT INTO pay_components (id, tenant_id, attributes)
          VALUES (${id}, ${tenantId}, ${JSON.stringify({
            code: cCode,
            name: cCode.replace("_", " "),
            type: cCode.startsWith("P") ? "deduction" : "earning"
          })}::jsonb)
        `;
        payComponentIdByCode[cCode] = id;
      }
    }
  }

  if (!(await hasData(client, "employee_salary_assignments"))) {
    for (const row of rawSalaries) {
      const empCode = row["Employee code"];
      const empId = employeeIdByCode[empCode];
      if (!empId) continue;

      const basic = Number(row["Basic (INR)"]) || 0;
      const gross = Number(row["Monthly gross (INR)"]) || 0;

      await client`
        INSERT INTO employee_salary_assignments (id, tenant_id, employee_id, pay_group_id, salary_structure_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${empId}, ${pgId}, ${salStructId}, ${JSON.stringify({
          wage_type: row["Wage type"],
          basic_salary_minor: Math.round(basic * 100),
          da_minor: Math.round((Number(row["DA (INR)"]) || 0) * 100),
          hra_minor: Math.round((Number(row["HRA (INR)"]) || 0) * 100),
          conveyance_minor: Math.round((Number(row["Conveyance (INR)"]) || 0) * 100),
          special_allowance_minor: Math.round((Number(row["Special allowance (INR)"]) || 0) * 100),
          daily_rate_minor: Math.round((Number(row["Daily rate (INR)"]) || 0) * 100),
          monthly_gross_minor: Math.round(gross * 100),
          wage_base_minor: Math.round((Number(row["Statutory wage base (INR)"]) || gross) * 100),
          effective_from: "2026-04-01",
          active: true
        })}::jsonb)
      `;
    }
  }

  // -------------------------------------------------------------
  // 13. Sheet 14, 15, 16: Leave Types, Accrual Policies & Proration
  // -------------------------------------------------------------
  console.log("--> Loading 14_Leave_Types & Policies...");
  const rawLeaveTypes = readSheetData("14_leave_types.json");
  const rawAccruals = readSheetData("15_leave_accrual_policy.json");
  const rawProrations = readSheetData("16_leave_proration.json");

  if (await hasData(client, "leave_types")) {
    const existing = await client`SELECT id, attributes->>'code' as code FROM leave_types WHERE tenant_id = ${tenantId}`;
    for (const r of existing as any[]) {
      if (r.code) leaveTypeIdByCode[r.code] = r.id;
    }
  }

  for (const row of rawLeaveTypes) {
    const code = row["Leave type"];
    if (!code) continue;
    if (!leaveTypeIdByCode[code]) {
      const id = uuid();
      await client`
        INSERT INTO leave_types (id, tenant_id, attributes)
        VALUES (${id}, ${tenantId}, ${JSON.stringify({
          code,
          name: row["Name"],
          unit: row["Unit"],
          accrual: row["Accrual"],
          carry_forward: row["Carry forward"],
          year_end_action: row["Year-end action"],
          max_per_month: row["Max per month"],
          cannot_combine_with: row["Cannot be combined with"],
          expiry_rule: row["Expiry rule"],
          applies_to_bands: row["Applies to bands"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
      leaveTypeIdByCode[code] = id;
    }
  }

  // Accrual Rules & Leave Policies
  let leavePolId = "";
  if (await hasData(client, "leave_policies")) {
    leavePolId = (await client`SELECT id FROM leave_policies WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  } else {
    leavePolId = uuid();
    await client`
      INSERT INTO leave_policies (id, tenant_id, attributes)
      VALUES (${leavePolId}, ${tenantId}, ${JSON.stringify({ code: "POL-LEAVE-2026", name: "Standard Factory & Office Leave Policy 2026" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "accrual_rules"))) {
    for (const row of rawAccruals) {
      const ltId = leaveTypeIdByCode[row["Leave type"]];
      if (ltId && leavePolId) {
        await client`
          INSERT INTO accrual_rules (id, tenant_id, leave_policy_id, leave_type_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${leavePolId}, ${ltId}, ${JSON.stringify({
            policy_code: row["Policy code"],
            leave_band: row["Leave band"],
            annual_days: row["Annual days"],
            accrual_frequency: row["Accrual frequency"],
            days_per_period: row["Days per period"],
            eligibility_wait_months: row["Eligibility wait (months)"],
            credit_on_completion: row["Credit on completion"],
            credit_date: row["Credit date"]
          })}::jsonb)
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 13b. Sheet 16: Leave Proration Ladder
  // -------------------------------------------------------------
  // GAP FIX: rawProrations was read from the sheet but never written anywhere — the
  // proration-by-joining-month ladder existed only in the workbook. v1.1 also corrected
  // its worked examples (E1038/E1046, neither leave-eligible, replaced with E1069/E1067),
  // so this is loaded fresh onto the same single leave policy every accrual rule uses.
  console.log("--> Loading 16_Leave_Proration...");
  if (leavePolId) {
    const prorationLadder = rawProrations
      .filter((row: any) => /^PR-\d+$/.test(row["Rule code"] || ""))
      .map((row: any) => ({
        rule_code: row["Rule code"],
        joining_month_from: row["Joining month from"],
        joining_month_to: row["Joining month to"],
        cl_days: row["CL days"],
        sl_days: row["SL days"],
        example_employee: row["Example employee"],
        leave_eligible_check: row["Leave-eligible check"],
        demo_point: row["Demo point"]
      }));
    await client`
      UPDATE leave_policies SET attributes = attributes || ${JSON.stringify({ proration_ladder: prorationLadder })}::jsonb
      WHERE tenant_id = ${tenantId} AND id = ${leavePolId}
    `;
  }

  // -------------------------------------------------------------
  // 14. Sheet 17: Leave Ledger (Transactions & Balances)
  // -------------------------------------------------------------
  console.log("--> Loading 17_Leave_Ledger...");
  const rawLedger = readSheetData("17_leave_ledger.json");

  // Per-row upsert keyed on the sheet's own Ledger ID, not a blanket "table already has
  // rows" skip: v1.1 both corrected an existing row (LL-0029, was a phantom 2-day CL
  // debit, is now a zero-day no-movement row) and added five comp-off movements the
  // ledger was missing (LL-0041 to LL-0045) so it reconciles to the comp-off register.
  // A blanket skip would leave both defects live in the DB forever on a rerun.
  for (const row of rawLedger) {
    const ledgerId = row["Ledger ID"];
    if (!ledgerId || !/^LL-\d+$/.test(ledgerId)) continue; // v1.1 footnote row
    const empId = employeeIdByCode[row["Employee code"]];
    const ltId = leaveTypeIdByCode[row["Leave type"]];
    if (!empId || !ltId) continue;

    const attributes = {
      ledger_id: ledgerId,
      transaction_type: row["Transaction"],
      days: row["Days"],
      effective_date: row["Effective date"],
      expires_on: row["Expires on"],
      narration: row["Narration"],
      source_reference: row["Source reference"],
      demo_point: row["Demo point"]
    };

    const existingEntry = (await client`
      SELECT id FROM leave_ledger_entries
      WHERE tenant_id = ${tenantId} AND employee_id = ${empId} AND attributes->>'ledger_id' = ${ledgerId}
      LIMIT 1
    `)[0];

    if (existingEntry) {
      await client`
        UPDATE leave_ledger_entries SET employee_id = ${empId}, leave_type_id = ${ltId}, attributes = ${JSON.stringify(attributes)}::jsonb
        WHERE id = ${existingEntry.id}
      `;
    } else {
      await client`
        INSERT INTO leave_ledger_entries (id, tenant_id, employee_id, leave_type_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${empId}, ${ltId}, ${JSON.stringify(attributes)}::jsonb)
      `;
    }
  }

  // Legacy leave_balances compatibility table
  if (!(await hasData(client, "leave_balances"))) {
    for (const empCode of ["E1001", "E1004", "E1018", "E1019", "E1043", "E1067"]) {
      const empId = employeeIdByCode[empCode];
      if (empId) {
        for (const [ltCode, days] of [["EL", 18], ["CL", 8], ["SL", 10]]) {
          await client`
            INSERT INTO leave_balances (id, tenant_id, employee_id, leave_type, balance, as_of_date, updated_at)
            VALUES (${uuid()}, ${tenantId}, ${empId}, ${ltCode}, ${days}, '2026-09-01', '2026-09-01'::timestamptz)
          `;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 15. Sheet 18: Leave Requests
  // -------------------------------------------------------------
  console.log("--> Loading 18_Leave_Requests...");
  const rawLeaveRequests = readSheetData("18_leave_requests.json");

  if (!(await hasData(client, "leave_requests"))) {
    const needLeaveRequestDays = !(await hasData(client, "leave_request_days"));
    for (const row of rawLeaveRequests) {
      const empId = employeeIdByCode[row["Employee code"]];
      const ltId = leaveTypeIdByCode[row["Leave type"]];
      if (!empId || !ltId) continue;

      const reqId = uuid();
      const daysVal = Number(row["Days applied"]) || 1;
      const ltCode = row["Leave type"] || "EL";
      await client`
        INSERT INTO leave_requests (
          id, tenant_id, employee_id, leave_type_id, leave_type,
          starts_on, ends_on, requested_days, status, reason
        )
        VALUES (
          ${reqId}, ${tenantId}, ${empId}, ${ltId}, ${ltCode},
          ${row["From"]}, ${row["To"] || row["From"]}, ${daysVal},
          ${row["Status"] === "Approved" ? "approved" : row["Status"] === "Pending" ? "pending_supervisor" : "rejected"},
          ${row["Reason"] || "Leave application"}
        )
      `;

      if (needLeaveRequestDays) {
        await client`
          INSERT INTO leave_request_days (id, tenant_id, leave_request_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${reqId}, ${JSON.stringify({
            date: row["From"],
            portion: "full_day",
            status: row["Status"]
          })}::jsonb)
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 16. Sheet 19: Comp-Off Ledger
  // -------------------------------------------------------------
  console.log("--> Loading 19_CompOff_Ledger...");
  const rawCompOff = readSheetData("19_compoff_ledger.json");

  if (!(await hasData(client, "comp_off_grants"))) {
    for (const row of rawCompOff) {
      const empId = employeeIdByCode[row["Employee code"]];
      if (!empId) continue;

      await client`
        INSERT INTO comp_off_grants (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${empId}, ${JSON.stringify({
          credit_id: row["Credit ID"],
          earned_on: row["Earned on"],
          reason: row["Reason"],
          days: row["Days"],
          expires_on: row["Expires on"],
          status: row["Status"],
          consumed_on: row["Consumed on"],
          days_remaining: row["Days remaining"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
    }
  }

  // -------------------------------------------------------------
  // 17. Sheet 21: Expected Attendance (211 calibrated records!)
  // -------------------------------------------------------------
  console.log("--> Loading 21_Expected_Attendance (211 calibrated records)...");
  const rawExpectedAtt = readSheetData("21_expected_attendance.json");
  const attendanceDayIdByEmpDate: Record<string, string> = {};
  const attendanceEntryIdByEmpDate: Record<string, string> = {};

  const defaultAttPolicyId = ctx.attendancePolicyId || Object.values(attendancePolicyIdByHours)[0] || (await client`SELECT id FROM attendance_policies WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  if (defaultAttPolicyId && !ctx.attendancePolicyId) ctx.attendancePolicyId = defaultAttPolicyId;

  if (await hasData(client, "attendance_days")) {
    const existingDays = await client`SELECT id, employee_id, attendance_date::text as dt FROM attendance_days WHERE tenant_id = ${tenantId}`;
    const codeByEmpId: Record<string, string> = {};
    for (const [c, id] of Object.entries(employeeIdByCode)) codeByEmpId[id] = c;
    for (const d of existingDays as any[]) {
      const c = codeByEmpId[d.employee_id];
      if (c) attendanceDayIdByEmpDate[`${c}_${d.dt}`] = d.id;
    }
  }
  if (await hasData(client, "attendance_entries")) {
    const existingEntries = await client`SELECT id, employee_id, attributes->>'date' as dt FROM attendance_entries WHERE tenant_id = ${tenantId}`;
    const codeByEmpId: Record<string, string> = {};
    for (const [c, id] of Object.entries(employeeIdByCode)) codeByEmpId[id] = c;
    for (const e of existingEntries as any[]) {
      const c = codeByEmpId[e.employee_id];
      if (c && e.dt) attendanceEntryIdByEmpDate[`${c}_${e.dt}`] = e.id;
    }
  }

  for (const row of rawExpectedAtt) {
    const empCode = row["Employee code"];
    const empId = employeeIdByCode[empCode];
    if (!empId) continue;

    const date = row["Date"];
    const key = `${empCode}_${date}`;

    const grossMin = Number(row["Gross minutes"]) || (Number(row["Shift hours"]) || 8) * 60;
    const breakMin = Number(row["Break minutes (recorded, paid)"]) || 30;
    const prodMin = Math.max(0, grossMin - breakMin);
    const assignedShift = row["Shift assigned"] || "FS";
    const detectedShift = row["Shift applied"] || assignedShift;
    const dayStatus = row["Status"] === "Absent" ? "absent" : row["Day type"] === "Holiday" ? "holiday" : row["Day type"] === "Weekly Off" ? "rest_day" : "present";

    // Per-row existence check, not a blanket "table already has rows" flag — otherwise
    // a v1.1 addition for one employee (E1021's 15 days, missing entirely in v1.0) would
    // be silently skipped on a rerun just because other employees' days already exist.
    let attDayId = attendanceDayIdByEmpDate[key];
    if (!attDayId) {
      attDayId = uuid();
      await client`
        INSERT INTO attendance_days (
          id, tenant_id, employee_id, attendance_date, assigned_shift, detected_shift,
          gross_span_minutes, productive_minutes, break_minutes, credited_gate_pass_minutes,
          payable_ot_minutes, status
        )
        VALUES (
          ${attDayId}, ${tenantId}, ${empId}, ${date}, ${assignedShift}, ${detectedShift},
          ${grossMin}, ${prodMin}, ${breakMin}, ${Number(row["Gate pass minutes (deducted)"]) || 0},
          0, ${dayStatus}
        )
      `;
      attendanceDayIdByEmpDate[key] = attDayId;
    }

    if (!attendanceEntryIdByEmpDate[key]) {
      const attEntryId = uuid();
      await client`
        INSERT INTO attendance_entries (id, tenant_id, attendance_policy_id, employee_id, attributes)
        VALUES (${attEntryId}, ${tenantId}, ${defaultAttPolicyId || ctx.attendancePolicyId}, ${empId}, ${JSON.stringify({
          date: row["Date"],
          day: row["Day"],
          shift_assigned: row["Shift assigned"],
          shift_applied: row["Shift applied"],
          day_type: row["Day type"],
          first_in: row["First in"],
          last_out: row["Last out"],
          gross_minutes: row["Gross minutes"],
          break_minutes: row["Break minutes (recorded, paid)"],
          gate_pass_minutes: row["Gate pass minutes (deducted)"],
          status: row["Status"] || "Present",
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
      attendanceEntryIdByEmpDate[key] = attEntryId;
    }
  }

  // -------------------------------------------------------------
  // 18. Sheet 20: Punch Events (371 raw punch events!)
  // -------------------------------------------------------------
  console.log("--> Loading 20_Punch_Events (371 punches)...");
  const rawPunches = readSheetData("20_punch_events.json");

  let attSourceId = "";
  if (await hasData(client, "attendance_sources")) {
    attSourceId = (await client`SELECT id FROM attendance_sources WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  } else {
    attSourceId = uuid();
    await client`
      INSERT INTO attendance_sources (id, tenant_id, attributes)
      VALUES (${attSourceId}, ${tenantId}, ${JSON.stringify({ code: "BIO-BIOMETRIC-GATE", name: "Turnstile Optical Biometric Reader" })}::jsonb)
    `;
  }

  for (const row of rawPunches) {
    const empCode = row["Employee code"];
    const empId = employeeIdByCode[empCode];
    if (!empId) continue;

    const attDate = row["Attendance date"];
    const key = `${empCode}_${attDate}`;
    let dayId = attendanceDayIdByEmpDate[key];

    if (!dayId) {
      const existing = await client`SELECT id FROM attendance_days WHERE tenant_id = ${tenantId} AND employee_id = ${empId} AND attendance_date = ${attDate} LIMIT 1`;
      if (existing[0]) {
        dayId = existing[0].id;
      } else {
        dayId = uuid();
        await client`
          INSERT INTO attendance_days (
            id, tenant_id, employee_id, attendance_date, assigned_shift, detected_shift,
            gross_span_minutes, productive_minutes, break_minutes, credited_gate_pass_minutes,
            payable_ot_minutes, status
          )
          VALUES (
            ${dayId}, ${tenantId}, ${empId}, ${attDate}, 'FS', 'FS',
            540, 480, 60, 0, 0, 'present'
          )
        `;
      }
      attendanceDayIdByEmpDate[key] = dayId;
    }

    // v1.1 GAP FIX: these two inserts used to be gated behind a single "does this table
    // have any rows at all" flag, which made the whole punch load a no-op on a rerun —
    // exactly the case when v1.1 adds new punches (E1021's 26 rows) for an employee who
    // already has other punches on file. Check existence per row instead.
    const eventId = row["Event ID"];
    const existingEvent = eventId
      ? (await client`SELECT 1 FROM attendance_events WHERE tenant_id = ${tenantId} AND employee_id = ${empId} AND attributes->>'event_id' = ${eventId} LIMIT 1`)[0]
      : undefined;
    if (!existingEvent) {
      await client`
        INSERT INTO attendance_events (id, tenant_id, attendance_source_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${attSourceId}, ${empId}, ${JSON.stringify({
          event_id: eventId,
          attendance_date: attDate,
          segment: row["Segment"],
          direction: row["Direction"],
          time: row["Time"],
          punch_date: row["Calendar date of punch"],
          device: row["Device"],
          note: row["Note"]
        })}::jsonb)
      `;
    }

    const punchedAt = `${row["Calendar date of punch"]}T${row["Time"]}+05:30`;
    const punchType = row["Direction"] === "IN" ? "in" : "out";
    const existingPunch = (await client`
      SELECT 1 FROM attendance_punches
      WHERE tenant_id = ${tenantId} AND attendance_day_id = ${dayId} AND punched_at = ${punchedAt}::timestamptz AND type = ${punchType}
      LIMIT 1
    `)[0];
    if (!existingPunch) {
      await client`
        INSERT INTO attendance_punches (
          id, tenant_id, attendance_day_id, punched_at, type, source, device_reference
        )
        VALUES (
          ${uuid()}, ${tenantId}, ${dayId},
          ${punchedAt}::timestamptz,
          ${punchType},
          'biometric',
          ${row["Device"] || "GATE-01"}
        )
      `;
    }
  }

  // -------------------------------------------------------------
  // 19. Sheet 22: Gate Pass
  // -------------------------------------------------------------
  console.log("--> Loading 22_Gate_Pass...");
  const rawGatePasses = readSheetData("22_gate_pass.json");

  let gpPolicyId = "";
  if (await hasData(client, "gate_pass_policies")) {
    gpPolicyId = (await client`SELECT id FROM gate_pass_policies WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  } else {
    gpPolicyId = uuid();
    await client`
      INSERT INTO gate_pass_policies (id, tenant_id, attributes)
      VALUES (${gpPolicyId}, ${tenantId}, ${JSON.stringify({ max_hours_per_month: 4, max_instances_per_month: 2 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "gate_passes"))) {
    for (const row of rawGatePasses) {
      const empId = employeeIdByCode[row["Employee code"]];
      if (!empId) continue;

      await client`
        INSERT INTO gate_passes (id, tenant_id, gate_pass_policy_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${gpPolicyId}, ${empId}, ${JSON.stringify({
          pass_code: row["Gate pass ID"],
          pass_date: row["Date"],
          from_time: row["From"],
          to_time: row["To"],
          minutes: row["Minutes"],
          type: row["Type"],
          reason: row["Reason"],
          status: row["Status"],
          approver: row["Approver"],
          minutes_used: row["Minutes used this month"],
          instances_used: row["Instances this month"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
    }
  }

  // -------------------------------------------------------------
  // 20. Sheet 23: Overtime Register
  // -------------------------------------------------------------
  console.log("--> Loading 23_Overtime_Register...");
  const rawOT = readSheetData("23_overtime_register.json");

  let otPolicyId = (await client`SELECT id FROM overtime_policies WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  if (!otPolicyId) {
    otPolicyId = uuid();
    await client`
      INSERT INTO overtime_policies (id, tenant_id, attributes)
      VALUES (${otPolicyId}, ${tenantId}, ${JSON.stringify({ code: "OT-STANDARD", name: "Standard Factory Overtime Policy", rate_multiplier: 2.0 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "overtime_entries"))) {
    for (const row of rawOT) {
      const empCode = row["Employee code"];
      const empId = employeeIdByCode[empCode];
      if (!empId) continue;

      const otDate = row["Date"];
      const key = `${empCode}_${otDate}`;
      let entryId = attendanceEntryIdByEmpDate[key];

      if (!entryId) {
        entryId = (await client`SELECT id FROM attendance_entries WHERE tenant_id = ${tenantId} AND employee_id = ${empId} LIMIT 1`)[0]?.id;
        if (!entryId) {
          entryId = uuid();
          const fallbackPolicyId = ctx.attendancePolicyId || (await client`SELECT id FROM attendance_policies WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
          await client`
            INSERT INTO attendance_entries (id, tenant_id, attendance_policy_id, employee_id, attributes)
            VALUES (${entryId}, ${tenantId}, ${fallbackPolicyId}, ${empId}, ${JSON.stringify({ date: otDate, status: "Present" })}::jsonb)
          `;
          attendanceEntryIdByEmpDate[key] = entryId;
        }
      }

      await client`
        INSERT INTO overtime_entries (
          id, tenant_id, attendance_entry_id, employee_id, overtime_policy_id, attributes
        )
        VALUES (${uuid()}, ${tenantId}, ${entryId}, ${empId}, ${otPolicyId}, ${JSON.stringify({
          ot_record: row["OT record"],
          ot_date: row["Date"],
          day_type: row["Day type"],
          ot_minutes: row["OT minutes"],
          ot_hours: row["OT hours"],
          rate_multiplier: row["Rate multiplier"],
          eligibility_basis: row["Eligibility basis"],
          approved_by: row["Approved by"],
          approved_on: row["Approved on"],
          pay_in_run: row["Pay in run"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
    }
  }

  // -------------------------------------------------------------
  // 21. Sheet 24 & 25: Loans & Loan Guarantors
  // -------------------------------------------------------------
  console.log("--> Loading 24_Loans & 25_Loan_Guarantors...");
  const rawLoans = readSheetData("24_loans.json");
  const rawGuarantors = readSheetData("25_loan_guarantors.json");
  const legacyLoanIdByAppId: Record<string, string> = {};

  let loanProdId = "";
  if (await hasData(client, "loan_products")) {
    loanProdId = (await client`SELECT id FROM loan_products WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  } else {
    loanProdId = uuid();
    await client`
      INSERT INTO loan_products (id, tenant_id, attributes)
      VALUES (${loanProdId}, ${tenantId}, ${JSON.stringify({ code: "CORP-LOAN-2026", name: "Company Staff Loan", max_multiple_basic: 6 })}::jsonb)
    `;
  }

  if (loanProdId) {
    for (const row of rawLoans) {
      const appId = row["Loan / application ID"];
      const empId = employeeIdByCode[row["Employee code"]];
      if (!appId || !empId) continue;

      if (!loanIdByAppId[appId]) {
        const empLoanId = uuid();
        const legacyLoanId = uuid();
        const principal = Number(row["Principal (INR)"]) || 0;
        const outstanding = Number(row["Outstanding (INR)"]) || 0;

        await client`
          INSERT INTO employee_loans (id, tenant_id, employee_id, loan_product_id, attributes)
          VALUES (${empLoanId}, ${tenantId}, ${empId}, ${loanProdId}, ${JSON.stringify({
            application_code: appId,
            purpose: row["Purpose"],
            principal_minor: Math.round(principal * 100),
            outstanding_minor: Math.round(outstanding * 100),
            sanctioned_on: row["Sanctioned on"],
            tenure_months: row["Tenure (months)"],
            installment_minor: Math.round((Number(row["Instalment (INR)"]) || 0) * 100),
            status: row["Status"],
            sanctioned_by: row["Sanctioned by"],
            special_terms: row["Special terms"],
            eligibility_basis: row["Eligibility basis"],
            demo_point: row["Demo point / reason"]
          })}::jsonb)
        `;
        loanIdByAppId[appId] = empLoanId;
        legacyLoanIdByAppId[appId] = legacyLoanId;

        // Legacy loans table compatibility
        await client`
          INSERT INTO loans (id, tenant_id, employee_id, principal_minor, outstanding_minor, currency, status)
          VALUES (${legacyLoanId}, ${tenantId}, ${empId}, ${Math.round(principal * 100)}, ${Math.round(outstanding * 100)}, 'INR', ${row["Status"] === "Active" ? "disbursed" : "closed"})
        `;
      }
    }

    if (!(await hasData(client, "loan_guarantors"))) {
      for (const row of rawGuarantors) {
        const empLoanId = loanIdByAppId[row["Loan ID"]];
        const legacyLoanId = legacyLoanIdByAppId[row["Loan ID"]];
        const guarEmpId = employeeIdByCode[row["Guarantor code"]];
        if (empLoanId && guarEmpId && legacyLoanId) {
          await client`
            INSERT INTO loan_guarantors (id, tenant_id, loan_id, employee_loan_id, guarantor_employee_id, sequence, status)
            VALUES (${uuid()}, ${tenantId}, ${legacyLoanId}, ${empLoanId}, ${guarEmpId}, 1, 'active')
          `;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 22. Sheet 26: Payroll Runs
  // -------------------------------------------------------------
  console.log("--> Loading 26_Payroll_Runs...");
  const rawPayrollRuns = readSheetData("26_payroll_runs.json");

  for (const row of rawPayrollRuns) {
    const runCode = row["Run ID"];
    if (!runCode || !row["Period"]) continue;

    const pRunId = uuid();
    let periodId = (await client`SELECT id FROM pay_periods WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${row["Period"]} LIMIT 1`)[0]?.id;
    if (!periodId) {
      periodId = (await client`SELECT id FROM pay_periods WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    }
    if (!periodId) {
      periodId = uuid();
      const isAug = (row["Period"] || "").includes("Aug");
      const startDate = isAug ? "2026-08-01" : "2026-09-01";
      const endDate = isAug ? "2026-08-31" : "2026-09-30";
      const payDate = row["Pay date"] || (isAug ? "2026-08-31" : "2026-09-30");
      await client`
        INSERT INTO pay_periods (id, tenant_id, pay_group_id, attributes)
        VALUES (${periodId}, ${tenantId}, ${pgId}, ${JSON.stringify({ code: row["Period"], start_date: startDate, end_date: endDate, pay_date: payDate, status: row["State"] === "CLOSED" ? "closed" : "active" })}::jsonb)
      `;
    }
    let ruleVerId = ctx.rulePackVersionId || (await client`SELECT id FROM rule_pack_versions LIMIT 1`)[0]?.id;
    if (!ruleVerId) {
      let rulePackId = (await client`SELECT id FROM statutory_rule_packs LIMIT 1`)[0]?.id;
      if (!rulePackId) {
        rulePackId = uuid();
        await client`
          INSERT INTO statutory_rule_packs (id, country_id, attributes)
          VALUES (${rulePackId}, ${ctx.countryId}, ${JSON.stringify({ code: "IN-STAT-2024", name: "India Central Labour & Tax Code" })}::jsonb)
        `;
      }
      ruleVerId = uuid();
      await client`
        INSERT INTO rule_pack_versions (id, statutory_rule_pack_id, attributes)
        VALUES (${ruleVerId}, ${rulePackId}, ${JSON.stringify({ version_tag: "v2024.1", pf_rate: 0.12, esi_rate: 0.0075 })}::jsonb)
      `;
      ctx.rulePackVersionId = ruleVerId;
    }
    const scope = `${row["Entity"] || "LE-01"}_${(row["Run type"] || "Regular").toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

    await client`
      INSERT INTO payroll_runs (
        id, tenant_id, pay_group_id, pay_period_id, rule_pack_version_id,
        period, scope, status, currency, gross_minor, deductions_minor, net_minor, employee_count, attributes
      )
      VALUES (
        ${pRunId}, ${tenantId}, ${pgId}, ${periodId}, ${ruleVerId},
        ${row["Period"]}, ${scope}, 'paid', 'INR',
        ${Math.round((Number(row["Gross (INR)"]) || 0) * 100)},
        ${Math.round((Number(row["Statutory (INR)"]) || 0) * 100)},
        ${Math.round((Number(row["Net (INR)"]) || 0) * 100)},
        ${Number(row["Employees"]) || 68},
        ${JSON.stringify({ run_code: runCode })}::jsonb
      )
      ON CONFLICT (tenant_id, period, scope) DO UPDATE SET
        gross_minor = EXCLUDED.gross_minor,
        deductions_minor = EXCLUDED.deductions_minor,
        net_minor = EXCLUDED.net_minor,
        employee_count = EXCLUDED.employee_count,
        attributes = payroll_runs.attributes || EXCLUDED.attributes,
        updated_at = now()
    `;
    payrollRunIdByPeriod[row["Period"]] = pRunId;
    payrollRunIdByPeriod[runCode] = pRunId;
  }

  // -------------------------------------------------------------
  // 23. Sheet 27: Exit Clearance
  // -------------------------------------------------------------
  console.log("--> Loading 27_Exit_Clearance...");
  const rawExit = readSheetData("27_exit_clearance.json");

  const needClearanceItems = !(await hasData(client, "clearance_items"));

  for (const row of rawExit) {
    const empCode = row["Employee code"];
    const empId = employeeIdByCode[empCode];
    if (!empId) continue;

    let offbId = offboardingCaseIdByCode[empCode];
    if (!offbId) {
      offbId = uuid();
      const empmtId = employmentIdByCode[empCode] || (await client`SELECT id FROM employments WHERE tenant_id = ${tenantId} AND employee_id = ${empId} LIMIT 1`)[0]?.id;
      if (empmtId) {
        await client`
          INSERT INTO offboarding_cases (id, tenant_id, employment_id, attributes)
          VALUES (${offbId}, ${tenantId}, ${empmtId}, ${JSON.stringify({
            resigned_on: row["Resigned on"],
            last_working_day: row["Last working day"],
            notice_served_days: row["Notice served"],
            ff_state: row["F&F state"],
            demo_point: row["Demo point"]
          })}::jsonb)
        `;
        offboardingCaseIdByCode[empCode] = offbId;
      }
    }

    if (offbId && needClearanceItems) {
      await client`
        INSERT INTO clearance_items (id, tenant_id, offboarding_case_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${offbId}, ${JSON.stringify({
          item_name: row["Checklist item"],
          owner: row["Owner"],
          blocking: row["Blocking"] === "Y",
          status: row["Status"],
          cleared_on: row["Cleared on"]
        })}::jsonb)
      `;
    }
  }

  // -------------------------------------------------------------
  // 24. Sheet 28 & 29: Statutory Calendar & Forms
  // -------------------------------------------------------------
  console.log("--> Loading 28_Statutory_Calendar & 29_Statutory_Forms...");
  const rawStatCal = readSheetData("28_statutory_calendar.json");
  const rawStatForms = readSheetData("29_statutory_forms.json");

  if (!(await hasData(client, "compliance_calendar_items"))) {
    for (const row of rawStatCal) {
      const leId = entityIdByCode[row["Entity"]] || ctx.legalEntityId;
      await client`
        INSERT INTO compliance_calendar_items (id, tenant_id, legal_entity_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${leId}, ${JSON.stringify({
          obligation_code: row["Obligation ID"],
          obligation: row["Obligation"],
          authority: row["Authority"],
          state: row["State"],
          period: row["Period"],
          due_date: row["Due date"],
          owner: row["Owner"],
          status: row["Status"],
          evidence: row["Evidence"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
    }
  }

  if (!(await hasData(client, "statutory_forms"))) {
    let rulePackId = ctx.statutoryRulePackId || (await client`SELECT id FROM statutory_rule_packs LIMIT 1`)[0]?.id;
    if (!rulePackId) {
      rulePackId = uuid();
      await client`
        INSERT INTO statutory_rule_packs (id, country_id, attributes)
        VALUES (${rulePackId}, ${ctx.countryId}, ${JSON.stringify({
          code: "INDIA-COMPLIANCE-2024",
          name: "India Statutory & Labor Compliance Pack 2024-25",
          version: "2024.1",
          effective_from: "2024-04-01"
        })}::jsonb)
      `;
      ctx.statutoryRulePackId = rulePackId;
    }

    for (const row of rawStatForms) {
      await client`
        INSERT INTO statutory_forms (id, jurisdiction_id, statutory_rule_pack_id, attributes)
        VALUES (${uuid()}, ${defaultJurId}, ${rulePackId}, ${JSON.stringify({
          form_instance: row["Form instance"],
          form_name: row["Form"],
          act: row["Act / Rules"],
          state: row["State"],
          location: row["Location"],
          period: row["Period"],
          generated_on: row["Generated on"],
          filed_on: row["Filed on"],
          status: row["Status"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
    }
  }

  // -------------------------------------------------------------
  // 25. Sheet 30: Recognition & Referrals
  // -------------------------------------------------------------
  console.log("--> Loading 30_Recognition_Referral...");
  const rawRecog = readSheetData("30_recognition_referral.json");

  let progId = (await client`SELECT id FROM recognition_programs WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  if (!progId) {
    progId = uuid();
    await client`
      INSERT INTO recognition_programs (id, tenant_id, attributes)
      VALUES (${progId}, ${tenantId}, ${JSON.stringify({ name: "Star Employee of the Quarter", reward_minor: 1500000 })}::jsonb)
    `;
  }

  const needRecogEvents = !(await hasData(client, "recognition_events"));
  const needReferrals = !(await hasData(client, "referrals"));
  const needReferralAwards = !(await hasData(client, "referral_awards"));

  for (const row of rawRecog) {
    const empId = employeeIdByCode[row["Employee / referrer"]];
    if (!empId) continue;

    if (row["Type"] === "Recognition") {
      if (needRecogEvents) {
        await client`
          INSERT INTO recognition_events (id, tenant_id, recognition_program_id, recipient_employee_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${progId}, ${empId}, ${JSON.stringify({
            record_id: row["Record ID"],
            period: row["Period"],
            citation: row["Citation / candidate"],
            award_minor: Math.round((Number(row["Award (INR)"]) || 0) * 100),
            status: row["Award status"],
            pay_in_run: row["Pay in run"],
            announced: row["Announced"],
            demo_point: row["Demo point"]
          })}::jsonb)
        `;
      }
    } else if (row["Type"] === "Referral") {
      if (needReferrals) {
        let candId = (await client`SELECT id FROM candidates WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
        if (!candId) {
          candId = uuid();
          await client`
            INSERT INTO candidates (id, tenant_id, attributes)
            VALUES (${candId}, ${tenantId}, ${JSON.stringify({
              name: row["Citation / candidate"] || "Referred Candidate",
              source: "employee_referral"
            })}::jsonb)
          `;
        }
        const refId = uuid();
        await client`
          INSERT INTO referrals (id, tenant_id, referrer_employee_id, candidate_id, attributes)
          VALUES (${refId}, ${tenantId}, ${empId}, ${candId}, ${JSON.stringify({
            record_id: row["Record ID"],
            candidate_name: row["Citation / candidate"],
            // The referral register reads `status` to work out where an award has reached.
            // A referral that exists has been referred. The relationship is NOT set: this
            // sheet has no such column, and a picklist value nobody chose would read as a
            // fact the record does not hold.
            status: "referred",
            demo_point: row["Demo point"]
          })}::jsonb)
        `;

        if (needReferralAwards) {
          await client`
            INSERT INTO referral_awards (id, tenant_id, referral_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${refId}, ${JSON.stringify({
              award_minor: Math.round((Number(row["Award (INR)"]) || 0) * 100),
              status: row["Award status"],
              pay_in_run: row["Pay in run"]
            })}::jsonb)
          `;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 26. Sheet 31: Announcements
  // -------------------------------------------------------------
  console.log("--> Loading 31_Announcements...");
  const rawAnnounce = readSheetData("31_announcements.json");

  if (!(await hasData(client, "feed_posts"))) {
    const needFeedAudiences = !(await hasData(client, "feed_audiences"));
    for (const row of rawAnnounce) {
      const postId = uuid();
      await client`
        INSERT INTO feed_posts (id, tenant_id, attributes)
        VALUES (${postId}, ${tenantId}, ${JSON.stringify({
          announcement_id: row["Announcement ID"],
          type: row["Type"],
          title: row["Title"],
          audience_rule: row["Audience rule"],
          channels: row["Channels"],
          publish_from: row["Publish from"],
          publish_to: row["Publish to"],
          source_event: row["Source event"],
          created_by: row["Created by"],
          status: row["Status"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;

      if (needFeedAudiences) {
        await client`
          INSERT INTO feed_audiences (id, tenant_id, feed_post_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${postId}, ${JSON.stringify({ rule: row["Audience rule"] })}::jsonb)
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 27. Sheet 32: Letter Templates
  // -------------------------------------------------------------
  console.log("--> Loading 32_Letter_Templates...");
  const rawLetters = readSheetData("32_letter_templates.json");

  let docTypeId = (await client`SELECT id FROM document_types WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  if (!docTypeId) {
    docTypeId = uuid();
    await client`
      INSERT INTO document_types (id, tenant_id, attributes)
      VALUES (${docTypeId}, ${tenantId}, ${JSON.stringify({ code: 'HR-LETTER', name: 'HR Letters and Certificates' })}::jsonb)
    `;
  }

  if (!(await hasData(client, "letter_templates"))) {
    for (const row of rawLetters) {
      if (row["Template / issue ID"]?.startsWith("TPL-")) {
        await client`
          INSERT INTO letter_templates (id, tenant_id, document_type_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${docTypeId}, ${JSON.stringify({
            template_code: row["Template / issue ID"],
            template_name: row["Template"],
            version: row["Version"],
            approval_required: row["Approval required"] === "Y",
            merge_fields: row["Merge fields used"],
            demo_point: row["Demo point"]
          })}::jsonb)
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 28. Sheet 33: Assets
  // -------------------------------------------------------------
  console.log("--> Loading 33_Assets...");
  const rawAssets = readSheetData("33_assets.json");

  if (!(await hasData(client, "asset_catalog"))) {
    const needAssetAssignments = !(await hasData(client, "asset_assignments"));
    for (const row of rawAssets) {
      const astCode = row["Asset code"];
      if (!astCode) continue;

      const astId = uuid();
      await client`
        INSERT INTO asset_catalog (id, tenant_id, legal_entity_id, attributes)
        VALUES (${astId}, ${tenantId}, ${ctx.legalEntityId}, ${JSON.stringify({
          asset_code: astCode,
          type: row["Type"],
          description: row["Description"],
          serial: row["Serial"],
          status: row["Status"],
          condition: row["Condition"],
          clearance_item: row["Clearance item at exit"] === "Y",
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
      assetIdByCode[astCode] = astId;

      const allocEmpId = employeeIdByCode[row["Allocated to"]];
      if (allocEmpId && needAssetAssignments) {
        await client`
          INSERT INTO asset_assignments (id, tenant_id, asset_id, employee_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${astId}, ${allocEmpId}, ${JSON.stringify({
            issued_on: row["Issued on"],
            returned_on: row["Returned on"],
            status: row["Status"]
          })}::jsonb)
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 29. Sheet 34: Induction & Learning
  // -------------------------------------------------------------
  console.log("--> Loading 34_Induction_Learning...");
  const rawLearning = readSheetData("34_induction_learning.json");

  const needCourses = !(await hasData(client, "courses"));
  const needCourseVersions = !(await hasData(client, "course_versions"));
  const needEnrollments = !(await hasData(client, "enrollments"));
  const needLearningCompletions = !(await hasData(client, "learning_completions"));

  for (const row of rawLearning) {
    const itemTitle = row["Item"];
    if (!itemTitle) continue;

    if (!courseIdByTitle[itemTitle]) {
      const crsId = uuid();
      const crsVerId = uuid();

      if (needCourses) {
        await client`
          INSERT INTO courses (id, tenant_id, attributes)
          VALUES (${crsId}, ${tenantId}, ${JSON.stringify({
            // Every part of the product references a course by code, and the sheet names
            // induction items by title alone. Derived from the title so an enrollment can
            // be keyed to it at all; without one, Enroll is disabled on the course and
            // POST /api/v1/enrollments can never resolve it.
            code: courseCodeFromTitle(itemTitle),
            title: itemTitle,
            type: row["Type"]
          })}::jsonb)
        `;
      }

      if (needCourseVersions) {
        await client`
          INSERT INTO course_versions (id, tenant_id, course_id, attributes)
          VALUES (${crsVerId}, ${tenantId}, ${crsId}, ${JSON.stringify({ version: 1 })}::jsonb)
        `;
      }

      courseIdByTitle[itemTitle] = crsId;
      courseVersionIdByTitle[itemTitle] = crsVerId;
    }

    const empId = employeeIdByCode[row["Employee code"]];
    if (empId && needEnrollments) {
      const enrollId = uuid();
      await client`
        INSERT INTO enrollments (id, tenant_id, employee_id, attributes)
        VALUES (${enrollId}, ${tenantId}, ${empId}, ${JSON.stringify({
          record_code: row["Record"],
          // enrollEmployee writes `course_code` and the learning projection reads it. The
          // sheet identifies the course by its title, which is what `item` holds, so the
          // code derived from that same title is what links the two.
          course_code: courseCodeFromTitle(itemTitle),
          item: row["Item"],
          assigned_on: row["Assigned on"],
          due_on: row["Due on"],
          // "Overdue" is a comparison against `due_on`, not a stored state, so it maps to
          // the assigned enrollment it actually is. The sheet's word is kept beside it.
          ...(enrollmentStatusFromText(row["Status"]) ? { status: enrollmentStatusFromText(row["Status"]) } : {}),
          status_label: row["Status"] ?? null,
          trigger: row["Trigger"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;

      if (row["Completed on"] && needLearningCompletions) {
        await client`
          INSERT INTO learning_completions (id, tenant_id, enrollment_id, employee_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${enrollId}, ${empId}, ${JSON.stringify({
            completed_on: row["Completed on"],
            score: 100
          })}::jsonb)
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 30. Sheet 35: GL Mapping
  // -------------------------------------------------------------
  console.log("--> Loading 35_GL_Mapping...");
  const rawGL = readSheetData("35_gl_mapping.json").filter((row: any) => /^GL-\d+$/.test(row["Mapping ID"] || ""));

  if (await hasData(client, "gl_accounts")) {
    const existingAccounts = await client`SELECT id, attributes->>'account_code' as code FROM gl_accounts WHERE tenant_id = ${tenantId}`;
    for (const r of existingAccounts as any[]) {
      if (r.code) glAccountIdByCode[r.code] = r.id;
    }
  }

  for (const row of rawGL) {
    const accCode = row["GL account code"];
    if (!accCode || glAccountIdByCode[accCode]) continue;
    const glId = uuid();
    const leId = entityIdByCode[row["Entity"]] || ctx.legalEntityId;
    await client`
      INSERT INTO gl_accounts (id, tenant_id, legal_entity_id, attributes)
      VALUES (${glId}, ${tenantId}, ${leId}, ${JSON.stringify({
        account_code: accCode,
        account_name: row["GL account name"]
      })}::jsonb)
    `;
    glAccountIdByCode[accCode] = glId;
  }

  // -------------------------------------------------------------
  // 31. Sheet 36: ERP Inbound Master
  // -------------------------------------------------------------
  console.log("--> Loading 36_ERP_Inbound_Master...");
  const rawERP = readSheetData("36_erp_inbound_master.json");

  let connId = (await client`SELECT id FROM integration_connections WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
  if (!connId) {
    const catId = (await client`SELECT id FROM integration_catalog LIMIT 1`)[0]?.id || uuid();
    connId = uuid();
    await client`
      INSERT INTO integration_connections (id, tenant_id, integration_catalog_id, attributes)
      VALUES (${connId}, ${tenantId}, ${catId}, ${JSON.stringify({ name: "SAP ERP Production Connector", status: "active" })}::jsonb)
    `;
  }

  if (connId && !(await hasData(client, "inbound_events"))) {
    const needExternalIdMappings = !(await hasData(client, "external_id_mappings"));
    for (const row of rawERP) {
      await client`
        INSERT INTO inbound_events (id, tenant_id, integration_connection_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${connId}, ${JSON.stringify({
          sync_row: row["Sync row"],
          batch: row["Batch"],
          external_code: row["External employee code"],
          nucleus_code: row["Nucleus code"],
          field: row["Field"],
          erp_value: row["ERP value"],
          nucleus_value: row["Nucleus value"],
          field_owner: row["Field owner"],
          outcome: row["Outcome"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;

      const empId = employeeIdByCode[row["Nucleus code"]];
      if (empId && needExternalIdMappings) {
        await client`
          INSERT INTO external_id_mappings (id, tenant_id, integration_connection_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${connId}, ${JSON.stringify({
            internal_id: empId,
            external_id: row["External employee code"],
            entity_type: "employee"
          })}::jsonb)
        `;
      }
    }
  }

  // -------------------------------------------------------------
  // 32. Sheet 37: Requisitions
  // -------------------------------------------------------------
  console.log("--> Loading 37_Requisitions...");
  const rawReqs = readSheetData("37_requisitions.json");

  if (!(await hasData(client, "requisitions"))) {
    for (const row of rawReqs) {
      const reqCode = row["Requisition"];
      if (!reqCode) continue;

      const deptId = orgUnitIdByCode[row["Org unit"]] || (await client`SELECT id FROM departments WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      const hiringMgrId = employeeIdByCode[row["Hiring manager"]] || (await client`SELECT id FROM employees WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
      if (!deptId || !hiringMgrId) continue;

      await client`
        INSERT INTO requisitions (id, tenant_id, department_id, hiring_manager_employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${deptId}, ${hiringMgrId}, ${JSON.stringify({
          requisition_code: reqCode,
          // The register and referCandidate both read `code` and `status`. The sheet states
          // a status in its own words ("Open - screening"), which is translated here; its
          // wording is kept as `status_label`. A code is only copied across when the sheet
          // value is shaped like one - one row holds a paragraph of narrative instead.
          ...(looksLikeCode(reqCode) ? { code: reqCode } : {}),
          ...(requisitionStatusFromText(row["Status"]) ? { status: requisitionStatusFromText(row["Status"]) } : {}),
          status_label: row["Status"] ?? null,
          type: row["Type"],
          against_position: row["Against position"],
          designation: row["Designation"],
          location: row["Location"],
          raised_on: row["Raised on"],
          sanctioned: row["Sanctioned"],
          filled: row["Filled"],
          blocker: row["Blocker"],
          demo_point: row["Demo point"]
        })}::jsonb)
      `;
    }
  }

  console.log("\n✓ ALL 37 DATASET SHEETS LOADED INTO TENANT SUCCESSFULLY!\n");
}

/**
 * GAP FIX, split out of the sheet-35 section above: that section only ever built the
 * chart of accounts (gl_accounts); it read every "Mapping ID" row but never turned a
 * single one into a gl_mappings row, so no pay component was ever mapped and no
 * payroll run could reach APPROVED.
 *
 * This must run AFTER `scripts/seeder/excel-v11-config.ts`'s `loadExcelV11Config`
 * (which loads 47_Pay_Components) — the gl_mappings row needs a real pay_component_id,
 * and running it inside `loadExcelDataset` itself (before pay_components exists) meant
 * every row was skipped. Standalone and self-contained (fresh lookups) so it does not
 * depend on `loadExcelDataset`'s own closure or call order.
 *
 * v1.1's own defect note: GL-009/GL-010 (gratuity/leave-encashment provisions) had a
 * debit account and no credit account anywhere in the sheet, so a journal containing
 * them could never balance; GL-024/025 supply the missing credit legs, and GL-026/027
 * do the same for LE-02's professional tax. GL-023 (Entity LE-02, "Contractor labour
 * charges") is deliberately left unmapped per the sheet's own note, so a real
 * validation block can be demonstrated before it is added — it is skipped here too.
 */
export async function buildGlMappingsFromSheet35(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("--> Building gl_mappings from 35_GL_Mapping (post pay-components)...");

  const rawGL = readSheetData("35_gl_mapping.json").filter((row: any) => /^GL-\d+$/.test(row["Mapping ID"] || ""));

  const entityIdByCode: Record<string, string> = {};
  for (const r of (await client`SELECT id, code FROM legal_entities WHERE tenant_id = ${tenantId}`) as any[]) {
    entityIdByCode[r.code] = r.id;
  }
  const glAccountIdByCode: Record<string, string> = {};
  // `${legalEntityId}::${accountCode}`. src/server/payroll/gl.ts resolves an account the
  // same way, because a chart of accounts belongs to a legal entity: 2010100 Salary Payable
  // exists under LE-01 and NOT under LE-02, and 2010402/2010403 exist only under LE-02. A
  // flat code->id map silently hands back another entity's account, which would post one
  // company's payroll into another company's ledger.
  const glAccountIdByEntityCode: Record<string, string> = {};
  for (const r of (await client`SELECT id, legal_entity_id, attributes->>'account_code' as code FROM gl_accounts WHERE tenant_id = ${tenantId}`) as any[]) {
    if (!r.code) continue;
    glAccountIdByCode[r.code] = r.id;
    if (r.legal_entity_id) glAccountIdByEntityCode[`${r.legal_entity_id}::${r.code}`] = r.id;
  }
  const accountFor = (legalEntityId: string, code: string | null | undefined): string | undefined =>
    code ? glAccountIdByEntityCode[`${legalEntityId}::${code}`] : undefined;
  const payComponentIdByName: Record<string, string> = {};
  // ORDER BY, and first-write-wins, because this tenant carries several overlapping
  // pay-components catalogs and some names occur two or three times ("Basic" as BASIC,
  // PC-BASIC and basic). Without a deterministic order Postgres may hand back a different
  // row for the same name on the next run, the existence check below then looks up a
  // component that was never mapped, and the run inserts a second mapping for a component
  // that already had one — which is exactly how GL-002, GL-003, GL-005 and GL-006 ended up
  // duplicated in this tenant.
  const payComponentCodeById: Record<string, string> = {};
  for (const r of (await client`SELECT id, attributes->>'code' as code, attributes->>'name' as name FROM pay_components WHERE tenant_id = ${tenantId} ORDER BY attributes->>'code', id`) as any[]) {
    if (r.code) payComponentCodeById[r.id] = r.code;
    if (r.name && !payComponentIdByName[r.name.toLowerCase()]) payComponentIdByName[r.name.toLowerCase()] = r.id;
  }
  // This tenant carries several overlapping pay_components catalogs from different
  // seed sources (PC-* codes, plain-word codes, lowercase codes), none sharing sheet
  // 35's exact wording ("Gratuity provision" vs. the catalog's "Gratuity"). Resolve
  // by synonym rather than exact string match so the Dr-side (expense) rows this
  // table can actually represent are found.
  const COMPONENT_SYNONYMS: Record<string, string[]> = {
    Basic: ["basic"],
    "Dearness allowance": ["dearness allowance", "da"],
    "House rent allowance": ["house rent allowance", "hra"],
    Conveyance: ["conveyance", "conveyance allowance"],
    "Special allowance": ["special allowance"],
    Overtime: ["overtime"],
    "Employer PF contribution": ["provident fund — employer", "provident fund - employer", "pf"],
    "Employer ESI contribution": ["esi — employer", "esi - employer", "employee state insurance"],
    "Gratuity provision": ["gratuity"],
    "Leave encashment provision": ["leave encashment"],
    "Recognition award": ["recognition award"],
    "Referral award": ["referral award"],
    "Contractor labour charges": ["contract labour"],
    "Advance recovery": ["salary advance recovery"],
  };
  function resolveComponentId(componentName: string): string | undefined {
    const direct = payComponentIdByName[componentName.toLowerCase()];
    if (direct) return direct;
    for (const synonym of COMPONENT_SYNONYMS[componentName] ?? []) {
      const id = payComponentIdByName[synonym];
      if (id) return id;
    }
    return undefined;
  }

  const SALARY_PAYABLE_CODE = "2010100"; // GL-013, the shared credit leg for every earning
  // The two provisions this dataset's defect was about: each debits its provision expense
  // account and credits its OWN new payable account (not the shared Salary Payable).
  const PROVISION_CREDIT_BY_COMPONENT: Record<string, string> = {
    "Gratuity provision": "2010800", // GL-024
    "Leave encashment provision": "2010900", // GL-025
  };
  // Employer statutory contributions are expensed, and the credit leg is the SAME
  // statutory-payable account the employee's own share already uses (GL-014/GL-015).
  const EMPLOYER_CONTRIBUTION_CREDIT: Record<string, string> = {
    "Employer PF contribution": "2010200",
    "Employer ESI contribution": "2010300",
  };
  // Cr rows that name a pure statutory-remittance liability account, which no
  // employee is ever paid and which is not itself a payroll deduction line — as
  // opposed to "Loan recovery"/"Advance recovery"/"Canteen recovery", which ARE
  // real deduction components employees see on their payslip and get their own
  // gl_mappings row below. gl_mappings.pay_component_id is NOT NULL, so a bare
  // remittance account (PF/ESI/PT/TDS/LWF payable, and the two new provision
  // payables) has nowhere to hang its own row — each is already wired in as the
  // CREDIT leg of the Dr-side row above instead (Salary Payable for every earning,
  // PF/ESI payable for the matching employer contribution, the two new payable
  // accounts for the two provisions). Recognized and skipped silently — a
  // structural fact about the table, not an unresolved gap.
  const LIABILITY_ONLY_COMPONENT_NAMES = new Set([
    "Salary payable", "PF payable", "ESI payable",
    "TDS payable", "Labour welfare fund payable",
    "Gratuity payable", "Leave encashment payable",
  ]);
  // The four "Professional tax payable — XX" rows are NOT in that set. PT is a real
  // payroll deduction with its own pay component in this tenant (codes `pt` / `PC-PT`),
  // and its journal is the same shape as loan, advance and canteen recovery: debit the
  // salary payable, credit the statutory liability. What makes the four rows different is
  // that they are one component split across four STATE accounts, and the engine resolves
  // a mapping by (legal entity, component) with no state dimension — so they are handled
  // by buildProfessionalTaxMappings below rather than by the per-row loop.
  const PT_ROW = /^Professional tax payable/i;

  const skippedGlRows: string[] = [];
  let created = 0;
  for (const row of rawGL) {
    const mappingId = row["Mapping ID"];
    const componentName = row["Pay component / head"];
    const accCode = row["GL account code"];
    if (!componentName || !accCode) continue;
    if (mappingId === "GL-023") continue; // deliberately unmapped per the sheet's own note
    if (row["Dr / Cr"] === "Cr" && LIABILITY_ONLY_COMPONENT_NAMES.has(componentName)) continue;
    if (PT_ROW.test(componentName)) continue; // see buildProfessionalTaxMappings

    const componentId = resolveComponentId(componentName);
    const leId = entityIdByCode[row["Entity"]] || ctx.legalEntityId;
    const rowAccountId = accountFor(leId, accCode);
    if (!componentId || !rowAccountId) {
      skippedGlRows.push(
        `${mappingId} (${componentName}) — ${!componentId ? "pay component not resolved" : `GL account ${accCode} does not exist under ${row["Entity"]}`}`,
      );
      continue;
    }

    let debitAccountId: string | undefined;
    let creditAccountId: string | undefined;
    let counterCode: string;

    if (row["Dr / Cr"] === "Dr") {
      debitAccountId = rowAccountId;
      const provisionCredit = PROVISION_CREDIT_BY_COMPONENT[componentName];
      const employerCredit = EMPLOYER_CONTRIBUTION_CREDIT[componentName];
      counterCode = provisionCredit || employerCredit || SALARY_PAYABLE_CODE;
      creditAccountId = accountFor(leId, counterCode);
    } else {
      creditAccountId = rowAccountId;
      counterCode = SALARY_PAYABLE_CODE;
      debitAccountId = accountFor(leId, counterCode);
    }

    if (!debitAccountId || !creditAccountId) {
      skippedGlRows.push(
        `${mappingId} (${componentName}) — the counter leg needs account ${counterCode} under ${row["Entity"]}, which sheet 35 does not give that entity`,
      );
      continue;
    }

    // Keyed the way src/server/payroll/gl.ts resolves a mapping — `legalEntityId::componentCode`
    // — not on the component alone. On the component alone the first entity to claim a
    // component would block every other entity from ever mapping it.
    const existingMapping = (await client`
      SELECT id FROM gl_mappings
      WHERE tenant_id = ${tenantId} AND pay_component_id = ${componentId} AND legal_entity_id = ${leId}
      LIMIT 1
    `)[0];
    if (!existingMapping) {
      await client`
        INSERT INTO gl_mappings (id, tenant_id, legal_entity_id, pay_component_id, debit_account_id, credit_account_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${leId}, ${componentId}, ${debitAccountId}, ${creditAccountId}, ${JSON.stringify({
          mapping_id: mappingId,
          component_name: componentName
        })}::jsonb)
      `;
      created++;
    }
  }
  await buildProfessionalTaxMappings();

  console.log(`    created ${created} gl_mappings row(s).`);
  if (skippedGlRows.length > 0) {
    console.warn(`  [SKIPPED] ${skippedGlRows.length} GL mapping row(s) could not be resolved:`, skippedGlRows);
  }

  /**
   * Professional tax - sheet 35 rows GL-016, GL-017, GL-026 and GL-027.
   *
   * One pay component, four credit accounts, split by STATE: KA and MH under LE-01, TS and
   * TN under LE-02. `gl_mappings`, and the engine that reads it, resolve a mapping by
   * (legal entity, component) and have no state dimension, so a single row per entity can
   * only ever name one of that entity's two accounts - which is why these four rows had
   * nowhere to land and were being skipped.
   *
   * The register's own answer to this is FRM-FIN-01 "Override by location": a `ledger`
   * operational record carries default accounts plus a `locationOverride` list naming a
   * location and the accounts that replace the defaults there, and gl.ts gives that record
   * precedence over the materialised row. So each entity gets
   *   - a gl_mappings row crediting the PT account of the state it is REGISTERED in
   *     (sheet 02 "Registered office"), and
   *   - a ledger record repeating that default and adding one override per location whose
   *     state differs (sheet 03 gives every location its state code).
   * Both halves are read off the sheets; no account is chosen by preference. If the
   * registered state cannot be matched to one of the entity's own PT accounts the rows are
   * reported as skipped rather than defaulted to whichever came first.
   *
   * The debit leg is Salary Payable, as for every other employee deduction in this sheet:
   * the deduction reduces what is owed to the employee and raises a statutory liability.
   */
  async function buildProfessionalTaxMappings(): Promise<void> {
    const ptRows = rawGL.filter((r: any) => PT_ROW.test(String(r["Pay component / head"] ?? "")));
    if (ptRows.length === 0) return;

    const ptComponentId = resolveComponentId("Professional tax");
    if (!ptComponentId) {
      skippedGlRows.push(
        `${ptRows.map((r: any) => r["Mapping ID"]).join(", ")} (Professional tax) - no 'Professional tax' pay component exists`,
      );
      return;
    }

    // The sheet names each account by its state: "Professional tax payable - KA". Read the
    // state off the end rather than splitting on the dash, which is mojibaked in the export.
    const ptByState: Record<string, { account: string; mappingId: string }> = {};
    for (const r of ptRows as any[]) {
      const match = /([A-Za-z]{2})\s*$/.exec(String(r["Pay component / head"]));
      if (!match || !r["GL account code"]) continue;
      ptByState[match[1].toUpperCase()] = { account: String(r["GL account code"]), mappingId: String(r["Mapping ID"]) };
    }

    const locations = readSheetData("03_locations.json").filter((l: any) => /^LOC-/.test(String(l["Location code"] ?? "")));
    const entities = readSheetData("02_legal_entities.json").filter((e: any) => /^LE-/.test(String(e["Entity code"] ?? "")));
    // State name -> state code, taken from sheet 03 itself rather than a hardcoded list.
    const stateCodeByName: Record<string, string> = {};
    for (const l of locations as any[]) {
      if (l["State"] && l["State code"]) stateCodeByName[String(l["State"]).toLowerCase()] = String(l["State code"]).toUpperCase();
    }

    const membershipId = (await client`SELECT id FROM memberships WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;
    const componentCode = payComponentCodeById[ptComponentId];

    for (const entity of entities as any[]) {
      const entityCode = String(entity["Entity code"]);
      const entityLocations = (locations as any[]).filter((l) => l["Entity"] === entityCode);
      const entityStates = new Set(entityLocations.map((l) => String(l["State code"]).toUpperCase()));
      const ownRows = Object.entries(ptByState).filter(([state]) => entityStates.has(state));
      if (ownRows.length === 0) continue;

      // "Bengaluru, Karnataka" -> KA. The registered state decides which account is the
      // entity's default; every other state it operates in becomes a location override.
      const registeredStateName = String(entity["Registered office"] ?? "").split(",").pop()?.trim().toLowerCase() ?? "";
      const registeredState = stateCodeByName[registeredStateName] ?? "";
      const defaultEntry = registeredState && entityStates.has(registeredState) ? ptByState[registeredState] : undefined;
      if (!defaultEntry) {
        skippedGlRows.push(
          `${ownRows.map(([, v]) => v.mappingId).join(", ")} (Professional tax, ${entityCode}) - the registered ` +
          `office state could not be matched to one of this entity's PT accounts, so none can be called the default`,
        );
        continue;
      }
      const defaultAccountId = accountFor(entityIdByCode[entityCode] || ctx.legalEntityId, defaultEntry.account);
      if (!defaultAccountId) {
        skippedGlRows.push(`${defaultEntry.mappingId} (Professional tax, ${entityCode}) - GL account ${defaultEntry.account} does not exist under ${entityCode}`);
        continue;
      }

      const leId = entityIdByCode[entityCode] || ctx.legalEntityId;
      // The debit leg is this entity's own salary payable. Sheet 35 gives LE-01 one
      // (2010100) and gives LE-02 no payable and no earnings account at all - its only
      // debit row is GL-023 contractor labour charges - so LE-02's two PT credit accounts
      // have nothing to post against even though 18 employees are paid under that entity.
      // Report that rather than borrow LE-01's account, which would put one company's
      // payroll deduction in another company's ledger.
      const salaryPayableId = accountFor(leId, SALARY_PAYABLE_CODE);
      if (!salaryPayableId) {
        // An earlier revision of this function resolved accounts by code alone and so wrote
        // LE-01's salary payable as the debit leg of LE-02's PT mapping. The insert below is
        // guarded by an existence check, so simply not writing it again would leave that
        // cross-company row in place for good - and loadMappingRows applies no record_status
        // filter, so it would still be posted against. Remove what this function wrote for
        // this entity before reporting the gap.
        const removed = await client`
          DELETE FROM gl_mappings
          WHERE tenant_id = ${tenantId} AND legal_entity_id = ${leId} AND pay_component_id = ${ptComponentId}
          RETURNING id
        `;
        const withdrawn = await client`
          UPDATE hrms_operation_records SET status = 'retired', updated_at = now()
          WHERE tenant_id = ${tenantId} AND resource = 'ledger' AND status <> 'retired'
            AND data->>'entityCode' = ${entityCode} AND data->>'componentCode' = ${componentCode}
          RETURNING id
        `;
        skippedGlRows.push(
          `${ownRows.map(([, v]) => v.mappingId).join(", ")} (Professional tax, ${entityCode}) - the debit leg ` +
          `needs a salary payable account (${SALARY_PAYABLE_CODE}) under ${entityCode}, and sheet 35 gives that ` +
          `entity no payable or earnings account to use` +
          `${(removed as any[]).length > 0 || (withdrawn as any[]).length > 0
            ? ` [withdrew ${(removed as any[]).length} cross-entity mapping row(s) and retired ${(withdrawn as any[]).length} ledger record(s) written before accounts were resolved per entity]`
            : ""}`,
        );
        continue;
      }
      const existing = (await client`
        SELECT id FROM gl_mappings
        WHERE tenant_id = ${tenantId} AND pay_component_id = ${ptComponentId} AND legal_entity_id = ${leId}
        LIMIT 1
      `)[0];
      if (!existing) {
        await client`
          INSERT INTO gl_mappings (id, tenant_id, legal_entity_id, pay_component_id, debit_account_id, credit_account_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${leId}, ${ptComponentId}, ${salaryPayableId}, ${defaultAccountId}, ${JSON.stringify({
            mapping_id: defaultEntry.mappingId,
            component_name: "Professional tax",
            state_code: registeredState,
          })}::jsonb)
        `;
        created++;
      }

      // One override per location whose state is not the entity's default state.
      const overrides = entityLocations
        .filter((l) => String(l["State code"]).toUpperCase() !== registeredState)
        .map((l) => {
          const entry = ptByState[String(l["State code"]).toUpperCase()];
          return entry ? { location: String(l["Location code"]), debitAccountCode: SALARY_PAYABLE_CODE, creditAccountCode: entry.account } : null;
        })
        .filter((o): o is { location: string; debitAccountCode: string; creditAccountCode: string } => o !== null);

      if (!membershipId || !componentCode) {
        skippedGlRows.push(
          `Professional tax (${entityCode}) location overrides - ` +
          `${!membershipId ? "no membership exists to attribute a ledger record to" : "the pay component has no code"}`,
        );
        continue;
      }
      const ledgerData = {
        entityCode,
        componentCode,
        debitAccountCode: SALARY_PAYABLE_CODE,
        creditAccountCode: defaultEntry.account,
        postingSide: "credit",
        dimensionSource: ["cost_center"],
        costCenterSource: "Assignment cost centre",
        locationOverride: overrides,
        startDate: "2026-04-01",
      };
      const existingLedger = (await client`
        SELECT id FROM hrms_operation_records
        WHERE tenant_id = ${tenantId} AND resource = 'ledger'
          AND data->>'entityCode' = ${entityCode} AND data->>'componentCode' = ${componentCode}
        LIMIT 1
      `)[0];
      if (!existingLedger) {
        await client`
          INSERT INTO hrms_operation_records (id, tenant_id, resource, status, data, created_by_membership_id, version)
          VALUES (${uuid()}, ${tenantId}, 'ledger', 'approved', ${JSON.stringify(ledgerData)}::jsonb, ${membershipId}, 1)
        `;
      } else {
        await client`
          UPDATE hrms_operation_records SET data = data || ${JSON.stringify(ledgerData)}::jsonb, updated_at = now()
          WHERE tenant_id = ${tenantId} AND id = ${existingLedger.id}
        `;
      }
      console.log(
        `    professional tax ${entityCode}: default ${defaultEntry.account} (${registeredState})` +
        `${overrides.length > 0 ? `, ${overrides.length} location override(s)` : ""}.`,
      );
    }
  }
}
