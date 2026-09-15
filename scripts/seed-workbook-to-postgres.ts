/**
 * Comprehensive Workbook to PostgreSQL Database Ingestion Script
 *
 * Ingests all sheets from src/data/workbook.json and demo accounts into PostgreSQL tables.
 * Usage: npx tsx scripts/seed-workbook-to-postgres.ts
 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { readRuntimeConfiguration } from "../src/lib/runtime-config";
import workbook from "./seeds/workbook.json";
import demoAccounts from "./seeds/demo-accounts.json";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

function connectionUrl(): string {
  const arg = process.argv.find((a) => a.startsWith("postgres"));
  if (arg) return arg;
  const configuration = readRuntimeConfiguration();
  return configuration.databaseUrl || "postgresql://postgres:H%40rH%40rMahad3v@localhost:5432/nucleus_hrms";
}

const DEMO_PASSWORD = "Nucl3u$123$ecure";
const TENANT_SLUG = "mkraft";

function parseMinor(val: any, defaultVal = 0): number {
  if (typeof val === "number") return Math.round(val * 100);
  if (!val) return defaultVal;
  const cleaned = String(val).replace(/,/g, "").replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || isNaN(Number(cleaned))) return defaultVal;
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultVal : Math.round(num * 100);
}

function parseIntSafe(val: any, defaultVal = 0): number {
  if (typeof val === "number") return Math.floor(val);
  if (!val) return defaultVal;
  const cleaned = String(val).replace(/,/g, "").replace(/[^0-9-]/g, "");
  if (!cleaned || cleaned === "-" || isNaN(Number(cleaned))) return defaultVal;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? defaultVal : num;
}

async function main() {
  const pool = new Pool({ connectionString: connectionUrl() });
  const client = await pool.connect();

  console.info("Starting complete workbook ingestion into PostgreSQL database...");

  try {
    await client.query("BEGIN");

    // 1. Ensure Country & Jurisdiction exists
    let countryRes = await client.query("SELECT id FROM countries WHERE iso_code = 'IND' LIMIT 1");
    let countryId: string;
    if (countryRes.rows.length === 0) {
      countryId = randomUUID();
      await client.query(
        "INSERT INTO countries (id, iso_code, name, default_currency_code, default_timezone, active) VALUES ($1, 'IND', 'India', 'INR', 'Asia/Kolkata', true)",
        [countryId]
      );
    } else {
      countryId = countryRes.rows[0].id;
    }

    let jurisdictionRes = await client.query("SELECT id FROM jurisdictions WHERE code = 'IN' LIMIT 1");
    let jurisdictionId: string;
    if (jurisdictionRes.rows.length === 0) {
      jurisdictionId = randomUUID();
      await client.query(
        "INSERT INTO jurisdictions (id, country_id, code, name, kind, valid_from) VALUES ($1, $2, 'IN', 'India National Jurisdiction', 'national', '2020-01-01')",
        [jurisdictionId, countryId]
      );
    } else {
      jurisdictionId = jurisdictionRes.rows[0].id;
    }

    // 2. Ensure / Get Tenant 'mkraft'
    const FIXED_NUCLEUS_TENANT_ID = "5fd242d5-5627-47d0-a667-b099ef0acba9";
    let tenantRes = await client.query("SELECT id FROM tenants WHERE slug = $1 LIMIT 1", [TENANT_SLUG]);
    let tenantId: string;
    if (tenantRes.rows.length === 0) {
      tenantId = FIXED_NUCLEUS_TENANT_ID;
      await client.query(
        "INSERT INTO tenants (id, name, slug, legal_name, default_currency, timezone, status) VALUES ($1, 'Mkraft Textiles', $2, 'Mkraft Textiles Pvt Ltd', 'INR', 'Asia/Kolkata', 'active') ON CONFLICT (slug) DO NOTHING",
        [tenantId, TENANT_SLUG]
      );
    } else {
      tenantId = tenantRes.rows[0].id;
    }

    // Tenant settings
    await client.query(
      `INSERT INTO tenant_settings (tenant_id, locale, timezone, currency)
       VALUES ($1, 'en-IN', 'Asia/Kolkata', 'INR')
       ON CONFLICT (tenant_id) DO UPDATE SET locale = 'en-IN', timezone = 'Asia/Kolkata', currency = 'INR'`,
      [tenantId]
    );

    // 3. Legal Entities (Sheet 02_Legal_Entities)
    const legalEntitiesSheet = (workbook.sheets as any)["02_Legal_Entities"] || [];
    const legalEntityIds: Record<string, string> = {};
    for (const le of legalEntitiesSheet) {
      const code = le["Entity code"] || le["Code"] || "MKRAFT";
      const name = le["Legal entity name"] || le["Name"] || "Mkraft Textiles Pvt Ltd";
      const curr = le["Functional currency"] || "INR";
      let leRes = await client.query("SELECT id FROM legal_entities WHERE tenant_id = $1 AND code = $2", [tenantId, code]);
      let leId: string;
      if (leRes.rows.length === 0) {
        leId = randomUUID();
        await client.query(
          "INSERT INTO legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status) VALUES ($1, $2, $3, $4, $5, $6, 'active')",
          [leId, tenantId, jurisdictionId, code, name, curr]
        );
      } else {
        leId = leRes.rows[0].id;
      }
      legalEntityIds[code] = leId;
      legalEntityIds[name] = leId;
    }
    const defaultLegalEntityId = Object.values(legalEntityIds)[0] || randomUUID();

    // 4. Establishments (Prerequisite for Locations)
    let estabRes = await client.query("SELECT id FROM establishments WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    let defaultEstablishmentId: string;
    if (estabRes.rows.length === 0) {
      defaultEstablishmentId = randomUUID();
      await client.query(
        "INSERT INTO establishments (id, tenant_id, jurisdiction_id, legal_entity_id, record_status, attributes) VALUES ($1, $2, $3, $4, 'active', $5::jsonb)",
        [defaultEstablishmentId, tenantId, jurisdictionId, defaultLegalEntityId, JSON.stringify({ code: "EST-01", name: "Primary Establishment" })]
      );
    } else {
      defaultEstablishmentId = estabRes.rows[0].id;
    }

    // 5. Locations (Sheet 03_Locations)
    const locationsSheet = (workbook.sheets as any)["03_Locations"] || [];
    const locationIds: Record<string, string> = {};
    for (const loc of locationsSheet) {
      const code = loc["Location code"] || "HO";
      const name = loc["Location name"] || code;
      const city = loc["City"] || "";
      const state = loc["State"] || "";
      let locRes = await client.query("SELECT id FROM locations WHERE tenant_id = $1 AND attributes->>'code' = $2", [tenantId, code]);
      let id: string;
      if (locRes.rows.length === 0) {
        id = randomUUID();
        await client.query(
          "INSERT INTO locations (id, tenant_id, establishment_id, record_status, attributes) VALUES ($1, $2, $3, 'active', $4::jsonb)",
          [id, tenantId, defaultEstablishmentId, JSON.stringify({ code, name, city, state, ...loc })]
        );
      } else {
        id = locRes.rows[0].id;
      }
      locationIds[code] = id;
      locationIds[name] = id;
    }
    const defaultLocationId = Object.values(locationIds)[0] || randomUUID();

    // 6. Org Units / Business Units & Departments (Sheet 04_Org_Units)
    const orgUnitsSheet = (workbook.sheets as any)["04_Org_Units"] || [];
    const deptIds: Record<string, string> = {};
    const buIds: Record<string, string> = {};

    let defaultBuRes = await client.query("SELECT id FROM business_units WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    let defaultBusinessUnitId: string;
    if (defaultBuRes.rows.length === 0) {
      defaultBusinessUnitId = randomUUID();
      await client.query(
        "INSERT INTO business_units (id, tenant_id, legal_entity_id, attributes) VALUES ($1, $2, $3, $4::jsonb)",
        [defaultBusinessUnitId, tenantId, defaultLegalEntityId, JSON.stringify({ code: "BU-HQ", name: "Headquarters Business Unit" })]
      );
    } else {
      defaultBusinessUnitId = defaultBuRes.rows[0].id;
    }
    buIds["HQ"] = defaultBusinessUnitId;

    for (const unit of orgUnitsSheet) {
      const code = unit["Org unit code"] || unit["Code"] || "DEPT";
      const name = unit["Org unit name"] || code;
      const type = (unit["Type"] || "").toLowerCase();

      if (type.includes("business unit") || type.includes("division") || type.includes("entity")) {
        let buRes = await client.query("SELECT id FROM business_units WHERE tenant_id = $1 AND attributes->>'code' = $2", [tenantId, code]);
        let id: string;
        if (buRes.rows.length === 0) {
          id = randomUUID();
          await client.query(
            "INSERT INTO business_units (id, tenant_id, legal_entity_id, attributes) VALUES ($1, $2, $3, $4::jsonb)",
            [id, tenantId, defaultLegalEntityId, JSON.stringify({ code, name, ...unit })]
          );
        } else {
          id = buRes.rows[0].id;
        }
        buIds[code] = id;
        buIds[name] = id;
      }
    }

    for (const unit of orgUnitsSheet) {
      const code = unit["Org unit code"] || unit["Code"] || "DEPT";
      const name = unit["Org unit name"] || code;
      const type = (unit["Type"] || "").toLowerCase();
      if (type.includes("business unit") || type.includes("division") || type.includes("entity")) continue;
      
      const buId = buIds[unit["Parent"]] || defaultBusinessUnitId;
      let deptRes = await client.query("SELECT id FROM departments WHERE tenant_id = $1 AND attributes->>'code' = $2", [tenantId, code]);
      let id: string;
      if (deptRes.rows.length === 0) {
        id = randomUUID();
        await client.query(
          "INSERT INTO departments (id, tenant_id, business_unit_id, attributes) VALUES ($1, $2, $3, $4::jsonb)",
          [id, tenantId, buId, JSON.stringify({ code, name, ...unit })]
        );
      } else {
        id = deptRes.rows[0].id;
      }
      deptIds[code] = id;
      deptIds[name] = id;
    }
    const defaultDeptId = Object.values(deptIds)[0] || randomUUID();

    // 7. Designations, Grades & Job Profiles (Sheet 05_Designations)
    const designationsSheet = (workbook.sheets as any)["05_Designations"] || [];
    const gradeIds: Record<string, string> = {};
    const jobProfileIds: Record<string, string> = {};
    for (const des of designationsSheet) {
      const code = des["Designation code"] || des["Code"] || "DES";
      const title = des["Title"] || code;
      const band = des["Band"] || "G-STAFF";
      
      if (!gradeIds[band]) {
        let gRes = await client.query("SELECT id FROM grades WHERE tenant_id = $1 AND attributes->>'code' = $2", [tenantId, band]);
        if (gRes.rows.length === 0) {
          const gid = randomUUID();
          await client.query(
            "INSERT INTO grades (id, tenant_id, attributes) VALUES ($1, $2, $3::jsonb)",
            [gid, tenantId, JSON.stringify({ code: band, name: `Grade ${band}` })]
          );
          gradeIds[band] = gid;
        } else {
          gradeIds[band] = gRes.rows[0].id;
        }
      }

      let jpRes = await client.query("SELECT id FROM job_profiles WHERE tenant_id = $1 AND attributes->>'code' = $2", [tenantId, code]);
      if (jpRes.rows.length === 0) {
        const jpid = randomUUID();
        await client.query(
          "INSERT INTO job_profiles (id, tenant_id, default_grade_id, attributes) VALUES ($1, $2, $3, $4::jsonb)",
          [jpid, tenantId, gradeIds[band], JSON.stringify({ code, name: title, band, ...des })]
        );
        jobProfileIds[code] = jpid;
        jobProfileIds[title] = jpid;
      } else {
        jobProfileIds[code] = jpRes.rows[0].id;
        jobProfileIds[title] = jpRes.rows[0].id;
      }
    }
    const defaultGradeId = Object.values(gradeIds)[0] || randomUUID();
    const defaultJobProfileId = Object.values(jobProfileIds)[0] || randomUUID();

    // 8. Positions (Sheet 11_Positions)
    const positionsSheet = (workbook.sheets as any)["11_Positions"] || [];
    const positionIds: Record<string, string> = {};
    for (const pos of positionsSheet) {
      const code = pos["Position code"] || pos["Code"] || "POS";
      const title = pos["Title"] || code;
      const dept = deptIds[pos["Org unit"]] || defaultDeptId;
      const grade = gradeIds[pos["Grade"]] || defaultGradeId;
      const profile = jobProfileIds[title] || defaultJobProfileId;
      let posRes = await client.query("SELECT id FROM positions WHERE tenant_id = $1 AND attributes->>'code' = $2", [tenantId, code]);
      let id: string;
      if (posRes.rows.length === 0) {
        id = randomUUID();
        await client.query(
          "INSERT INTO positions (id, tenant_id, department_id, grade_id, job_profile_id, attributes) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
          [id, tenantId, dept, grade, profile, JSON.stringify({ code, name: title, ...pos })]
        );
      } else {
        id = posRes.rows[0].id;
      }
      positionIds[code] = id;
      positionIds[title] = id;
    }

    // 9. Leave Types (Sheet 14_Leave_Types)
    const leaveTypesSheet = (workbook.sheets as any)["14_Leave_Types"] || [];
    const leaveTypeIds: Record<string, string> = {};
    for (const lt of leaveTypesSheet) {
      const code = lt["Leave type"] || lt["Code"] || "CL";
      const name = lt["Name"] || code;
      let ltRes = await client.query("SELECT id FROM leave_types WHERE tenant_id = $1 AND attributes->>'code' = $2", [tenantId, code]);
      let id: string;
      if (ltRes.rows.length === 0) {
        id = randomUUID();
        await client.query(
          "INSERT INTO leave_types (id, tenant_id, attributes) VALUES ($1, $2, $3::jsonb)",
          [id, tenantId, JSON.stringify({ code, name, ...lt })]
        );
      } else {
        id = ltRes.rows[0].id;
      }
      leaveTypeIds[code] = id;
    }

    // 10. Standard System Roles
    const systemRoles: Record<string, string[]> = {
      owner: ["*"],
      "hr-manager": ["tenant.read", "employee.read", "employee.write", "attendance.read", "attendance.write", "leave.read", "leave.approve", "role.manage", "membership.manage", "membership.read"],
      "payroll-admin": ["tenant.read", "employee.read", "attendance.read", "payroll.read", "payroll.run", "payroll.rate.read"],
      manager: ["tenant.read", "employee.read", "attendance.read", "attendance.write", "leave.read", "leave.approve"],
      employee: ["tenant.read", "employee.read", "attendance.read", "leave.read"],
    };
    const roleIds: Record<string, string> = {};
    for (const [code] of Object.entries(systemRoles)) {
      let roleRes = await client.query("SELECT id FROM roles WHERE tenant_id = $1 AND code = $2", [tenantId, code]);
      let rid: string;
      if (roleRes.rows.length === 0) {
        rid = randomUUID();
        await client.query(
          "INSERT INTO roles (id, tenant_id, code, name, system_managed, status) VALUES ($1, $2, $3, $4, true, 'active')",
          [rid, tenantId, code, code]
        );
      } else {
        rid = roleRes.rows[0].id;
      }
      roleIds[code] = rid;
    }

    // 11. Employees & Users (Sheet 12_Employees + demo-accounts.json)
    const employeesSheet = (workbook.sheets as any)["12_Employees"] || [];
    const employeeIds: Record<string, string> = {};
    const membershipIds: Record<string, string> = {};
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    // Seed Demo Accounts first
    for (const demo of demoAccounts) {
      const email = demo.email.toLowerCase().trim();
      let userRes = await client.query("SELECT id FROM \"user\" WHERE email = $1", [email]);
      let uid: string;
      if (userRes.rows.length === 0) {
        uid = randomUUID();
        await client.query(
          "INSERT INTO \"user\" (id, name, email, email_verified, status) VALUES ($1, $2, $3, true, 'active')",
          [uid, demo.name, email]
        );
        await client.query(
          "INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES ($1, $2, 'credential', $3, $4)",
          [randomUUID(), uid, uid, passwordHash]
        );
      } else {
        uid = userRes.rows[0].id;
        await client.query(
          "UPDATE account SET password = $1 WHERE user_id = $2",
          [passwordHash, uid]
        );
      }

      // Membership
      let memRes = await client.query("SELECT id FROM memberships WHERE tenant_id = $1 AND user_id = $2", [tenantId, uid]);
      let mid: string;
      const memberRole = demo.role === "SUPER_ADMIN" || demo.role === "ADMIN" ? "owner" : (demo.role === "HR_MANAGER" ? "hr-manager" : (demo.role === "MANAGER" ? "manager" : "employee"));
      if (memRes.rows.length === 0) {
        mid = randomUUID();
        await client.query(
          "INSERT INTO memberships (id, tenant_id, user_id, role, status) VALUES ($1, $2, $3, $4, 'active')",
          [mid, tenantId, uid, memberRole]
        );
      } else {
        mid = memRes.rows[0].id;
      }
      if (roleIds[memberRole]) {
        await client.query(
          "INSERT INTO membership_roles (tenant_id, membership_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [tenantId, mid, roleIds[memberRole]]
        );
      }
    }

    // Seed all 69 employees from Sheet 12_Employees
    for (const emp of employeesSheet) {
      const code = emp["Employee code"] || emp["Code"];
      if (!code) continue;
      const fullName = emp["Full name"] || emp["Name"] || code;
      const parts = fullName.split(" ");
      const firstName = parts[0] || code;
      const lastName = parts.slice(1).join(" ") || "Employee";
      const email = `${code.toLowerCase().replace(/[^a-z0-9]/g, "")}@mkraft.demo`;
      const designation = emp["Designation"] || "Staff";
      const department = emp["Org unit"] || emp["Department"] || "Production";
      const location = emp["Location"] || "Head Office";
      const joiningDate = emp["Date of joining"] || "2023-01-01";
      const basicSalary = 3500000; // 35,000 INR minor

      // User & Account
      let userRes = await client.query("SELECT id FROM \"user\" WHERE email = $1", [email]);
      let uid: string;
      if (userRes.rows.length === 0) {
        uid = randomUUID();
        await client.query(
          "INSERT INTO \"user\" (id, name, email, email_verified, status) VALUES ($1, $2, $3, true, 'active')",
          [uid, fullName, email]
        );
        await client.query(
          "INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES ($1, $2, 'credential', $3, $4)",
          [randomUUID(), uid, uid, passwordHash]
        );
      } else {
        uid = userRes.rows[0].id;
      }

      // Person & Employee
      const personId = randomUUID();
      await client.query(
        "INSERT INTO people (id, tenant_id, record_status, attributes) VALUES ($1, $2, 'active', $3::jsonb)",
        [personId, tenantId, JSON.stringify({ firstName, lastName, email, code, ...emp })]
      );

      let empRes = await client.query("SELECT id FROM employees WHERE tenant_id = $1 AND employee_code = $2", [tenantId, code]);
      let eid: string;
      if (empRes.rows.length === 0) {
        eid = randomUUID();
        await client.query(
          `INSERT INTO employees (id, tenant_id, person_id, employee_code, first_name, last_name, work_email, designation, department, location, joining_date, basic_salary_minor, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13::jsonb)`,
          [eid, tenantId, personId, code, firstName, lastName, email, designation, department, location, joiningDate, basicSalary, JSON.stringify(emp)]
        );
      } else {
        eid = empRes.rows[0].id;
      }
      employeeIds[code] = eid;

      // Membership
      let memRes = await client.query("SELECT id FROM memberships WHERE tenant_id = $1 AND user_id = $2", [tenantId, uid]);
      let mid: string;
      if (memRes.rows.length === 0) {
        mid = randomUUID();
        await client.query(
          "INSERT INTO memberships (id, tenant_id, user_id, role, status, employee_id) VALUES ($1, $2, $3, 'employee', 'active', $4)",
          [mid, tenantId, uid, eid]
        );
      } else {
        mid = memRes.rows[0].id;
        await client.query("UPDATE memberships SET employee_id = $1 WHERE id = $2", [eid, mid]);
      }
      membershipIds[code] = mid;
    }

    // Set Manager references for employees
    for (const emp of employeesSheet) {
      const code = emp["Employee code"];
      const mgrCode = emp["Manager code"];
      if (code && mgrCode && employeeIds[code] && employeeIds[mgrCode]) {
        await client.query(
          "UPDATE employees SET manager_employee_id = $1 WHERE id = $2",
          [employeeIds[mgrCode], employeeIds[code]]
        );
      }
    }

    // 12. Leave Balances & Ledgers (Sheet 17_Leave_Ledger)
    const leaveLedgerSheet = (workbook.sheets as any)["17_Leave_Ledger"] || [];
    for (const entry of leaveLedgerSheet) {
      const code = entry["Employee code"];
      const eid = employeeIds[code];
      if (!eid) continue;
      const leaveType = entry["Leave type"] || "CL";
      const days = parseFloat(entry["Days"] || "12");
      const leaveTypeId = leaveTypeIds[leaveType] || Object.values(leaveTypeIds)[0];
      await client.query(
        `INSERT INTO leave_balances (tenant_id, employee_id, leave_type, balance, as_of_date)
         VALUES ($1, $2, $3, $4, '2026-04-01')
         ON CONFLICT (tenant_id, employee_id, leave_type) DO UPDATE SET balance = $4`,
        [tenantId, eid, leaveType, days]
      );
      if (leaveTypeId) {
        await client.query(
          `INSERT INTO leave_ledger_entries (id, tenant_id, employee_id, leave_type_id, record_status, attributes)
           VALUES ($1, $2, $3, $4, 'active', $5::jsonb)`,
          [randomUUID(), tenantId, eid, leaveTypeId, JSON.stringify({ leaveType, transaction: entry["Transaction"] || "credit", days, effectiveDate: entry["Effective date"] || "2026-04-01", narration: entry["Narration"] || "Workbook opening balance", ...entry })]
        );
      }
    }

    // 13. Leave Requests (Sheet 18_Leave_Requests)
    const leaveRequestsSheet = (workbook.sheets as any)["18_Leave_Requests"] || [];
    for (const lr of leaveRequestsSheet) {
      const code = lr["Employee code"];
      const eid = employeeIds[code];
      if (!eid) continue;
      const ltype = lr["Leave type"] || "CL";
      const from = lr["From"] || "2026-09-01";
      const to = lr["To"] || "2026-09-02";
      const days = parseFloat(lr["Days applied"] || "1");
      const status = (lr["Status"] || "approved").toLowerCase().replace(/[^a-z_]/g, "_");
      const id = randomUUID();
      const ltypeId = leaveTypeIds[ltype] || Object.values(leaveTypeIds)[0];
      await client.query(
        `INSERT INTO leave_requests (id, tenant_id, employee_id, leave_type, starts_on, ends_on, requested_days, status, reason, leave_type_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, tenantId, eid, ltype, from, to, days, status, lr["Demo point"] || "Annual leave", ltypeId]
      );
    }

    // 14. Attendance Days (Sheet 21_Expected_Attendance)
    const expectedAttSheet = (workbook.sheets as any)["21_Expected_Attendance"] || [];
    const attDayIds: Record<string, string> = {};
    for (const row of expectedAttSheet) {
      const code = row["Employee code"];
      const eid = employeeIds[code];
      const date = row["Date"];
      if (!eid || !date) continue;
      const shift = row["Shift applied"] || row["Shift assigned"] || "A";
      const gross = parseInt(row["Gross minutes"] || "540", 10);
      const productive = parseInt(row["Net minutes"] || "480", 10);
      const status = (row["Expected status"] || "present").toLowerCase().includes("present") ? "present" : ((row["Expected status"] || "").toLowerCase().includes("half") ? "half_day" : "absent");
      const id = randomUUID();
      const insRes = await client.query(
        `INSERT INTO attendance_days (id, tenant_id, employee_id, attendance_date, assigned_shift, gross_span_minutes, productive_minutes, break_minutes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 45, $8)
         ON CONFLICT (tenant_id, employee_id, attendance_date) DO UPDATE SET productive_minutes = $7, status = $8
         RETURNING id`,
        [id, tenantId, eid, date, shift, gross, productive, status]
      );
      attDayIds[`${code}_${date}`] = insRes.rows[0]?.id || id;
    }

    // 15. Punch Events (Sheet 20_Punch_Events)
    const punchesSheet = (workbook.sheets as any)["20_Punch_Events"] || [];
    for (const punch of punchesSheet) {
      const code = punch["Employee code"];
      const attDate = punch["Attendance date"];
      const dayId = attDayIds[`${code}_${attDate}`];
      if (!dayId) continue;
      const direction = (punch["Direction"] || "in").toLowerCase() === "out" ? "out" : "in";
      const timeStr = punch["Time"] || "09:00";
      const punchedAt = `${attDate}T${timeStr.length === 5 ? timeStr + ':00' : timeStr}+05:30`;
      await client.query(
        `INSERT INTO attendance_punches (id, tenant_id, attendance_day_id, punched_at, type, source, device_reference)
         VALUES ($1, $2, $3, $4, $5, 'biometric', $6)`,
        [randomUUID(), tenantId, dayId, punchedAt, direction, punch["Device"] || "BIO-01"]
      );
    }

    // 16. Loans (Sheet 24_Loans & Sheet 25_Loan_Guarantors)
    const loansSheet = (workbook.sheets as any)["24_Loans"] || [];
    const loanIds: Record<string, string> = {};
    const empLoanIds: Record<string, string> = {};

    let lpRes = await client.query("SELECT id FROM loan_products WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    let defaultLoanProductId: string;
    if (lpRes.rows.length === 0) {
      defaultLoanProductId = randomUUID();
      await client.query(
        "INSERT INTO loan_products (id, tenant_id, attributes) VALUES ($1, $2, $3::jsonb)",
        [defaultLoanProductId, tenantId, JSON.stringify({ code: "PERSONAL", name: "Personal Loan", max_minor: 50000000, tenure_months: 24 })]
      );
    } else {
      defaultLoanProductId = lpRes.rows[0].id;
    }

    for (const ln of loansSheet) {
      const code = ln["Employee code"];
      if (!code) continue;
      const eid = employeeIds[code];
      if (!eid) continue;
      const principal = parseMinor(ln["Principal (INR)"], 5000000);
      const outstanding = parseMinor(ln["Outstanding (INR)"], 0);
      const id = randomUUID();
      const elId = randomUUID();
      await client.query(
        `INSERT INTO loans (id, tenant_id, employee_id, principal_minor, outstanding_minor, currency, status)
         VALUES ($1, $2, $3, $4, $5, 'INR', 'disbursed')`,
        [id, tenantId, eid, principal, outstanding]
      );
      await client.query(
        `INSERT INTO employee_loans (id, tenant_id, employee_id, loan_product_id, record_status, attributes)
         VALUES ($1, $2, $3, $4, 'active', $5::jsonb)`,
        [elId, tenantId, eid, defaultLoanProductId, JSON.stringify({ loan_id: id, status: "disbursed", principal_minor: principal, outstanding_minor: outstanding, ...ln })]
      );
      loanIds[ln["Loan / application ID"] || id] = id;
      empLoanIds[ln["Loan / application ID"] || id] = elId;
    }

    const loanGuarantorsSheet = (workbook.sheets as any)["25_Loan_Guarantors"] || [];
    for (const lg of loanGuarantorsSheet) {
      const lid = loanIds[lg["Loan ID"]];
      const elId = empLoanIds[lg["Loan ID"]] || Object.values(empLoanIds)[0];
      const gCode = lg["Guarantor code"];
      const geid = employeeIds[gCode];
      if (!lid || !geid || !elId) continue;
      await client.query(
        `INSERT INTO loan_guarantors (id, tenant_id, loan_id, guarantor_employee_id, employee_loan_id, sequence, status)
         VALUES ($1, $2, $3, $4, $5, 1, 'approved')
         ON CONFLICT (loan_id, guarantor_employee_id) DO NOTHING`,
        [randomUUID(), tenantId, lid, geid, elId]
      );
    }

    // 17. Payroll Infrastructure & Runs (Sheet 26_Payroll_Runs)
    let srpRes = await client.query("SELECT id FROM statutory_rule_packs WHERE country_id = $1 LIMIT 1", [countryId]);
    let rulePackId: string;
    if (srpRes.rows.length === 0) {
      rulePackId = randomUUID();
      await client.query(
        "INSERT INTO statutory_rule_packs (id, country_id, jurisdiction_id, record_status, attributes) VALUES ($1, $2, $3, 'active', $4::jsonb)",
        [rulePackId, countryId, jurisdictionId, JSON.stringify({ code: "IN-STAT-2026", name: "India Statutory Pack 2026" })]
      );
    } else {
      rulePackId = srpRes.rows[0].id;
    }

    let rpvRes = await client.query("SELECT id FROM rule_pack_versions WHERE statutory_rule_pack_id = $1 LIMIT 1", [rulePackId]);
    let rulePackVersionId: string;
    if (rpvRes.rows.length === 0) {
      rulePackVersionId = randomUUID();
      await client.query(
        "INSERT INTO rule_pack_versions (id, statutory_rule_pack_id, record_status, attributes) VALUES ($1, $2, 'active', $3::jsonb)",
        [rulePackVersionId, rulePackId, JSON.stringify({ version: "2026.1", valid_from: "2026-04-01" })]
      );
    } else {
      rulePackVersionId = rpvRes.rows[0].id;
    }

    let pgRes = await client.query("SELECT id FROM pay_groups WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    let payGroupId: string;
    if (pgRes.rows.length === 0) {
      payGroupId = randomUUID();
      await client.query(
        "INSERT INTO pay_groups (id, tenant_id, legal_entity_id, record_status, attributes) VALUES ($1, $2, $3, 'active', $4::jsonb)",
        [payGroupId, tenantId, defaultLegalEntityId, JSON.stringify({ code: "PG-ALL", name: "Default Monthly Pay Group" })]
      );
    } else {
      payGroupId = pgRes.rows[0].id;
    }

    let ppRes = await client.query("SELECT id FROM pay_periods WHERE tenant_id = $1 AND pay_group_id = $2 LIMIT 1", [tenantId, payGroupId]);
    let payPeriodId: string;
    if (ppRes.rows.length === 0) {
      payPeriodId = randomUUID();
      await client.query(
        "INSERT INTO pay_periods (id, tenant_id, pay_group_id, record_status, attributes) VALUES ($1, $2, $3, 'active', $4::jsonb)",
        [payPeriodId, tenantId, payGroupId, JSON.stringify({ code: "2026-08", start_date: "2026-08-01", end_date: "2026-08-31" })]
      );
    } else {
      payPeriodId = ppRes.rows[0].id;
    }

    const payrollRunsSheet = (workbook.sheets as any)["26_Payroll_Runs"] || [];
    for (const pr of payrollRunsSheet) {
      const period = pr["Period"] || "2026-08";
      const scope = pr["Run type"] || "Regular Monthly";
      const empCount = parseIntSafe(pr["Employees"], 69);
      const gross = parseMinor(pr["Gross (INR)"], 250000000);
      const net = parseMinor(pr["Net (INR)"], 210000000);
      const deductions = gross - net;
      await client.query(
        `INSERT INTO payroll_runs (id, tenant_id, period, scope, status, employee_count, gross_minor, deductions_minor, net_minor, currency, pay_group_id, pay_period_id, rule_pack_version_id)
         VALUES ($1, $2, $3, $4, 'finalized', $5, $6, $7, $8, 'INR', $9, $10, $11)
         ON CONFLICT (tenant_id, period, scope) DO UPDATE SET gross_minor = $6, net_minor = $8`,
        [randomUUID(), tenantId, period, scope, empCount, gross, deductions, net, payGroupId, payPeriodId, rulePackVersionId]
      );
    }

    // 18. Requisitions, Candidates & Applications (Sheet 37_Requisitions)
    const reqSheet = (workbook.sheets as any)["37_Requisitions"] || [];
    for (const r of reqSheet) {
      const dept = deptIds[r["Org unit"]] || defaultDeptId;
      const hmCode = r["Hiring manager"];
      const hmId = employeeIds[hmCode] || Object.values(employeeIds)[0];
      const id = randomUUID();
      await client.query(
        `INSERT INTO requisitions (id, tenant_id, department_id, hiring_manager_employee_id, record_status, attributes)
         VALUES ($1, $2, $3, $4, 'active', $5::jsonb)`,
        [id, tenantId, dept, hmId, JSON.stringify(r)]
      );
    }

    // 19. Announcements (Sheet 31_Announcements)
    const announcementsSheet = (workbook.sheets as any)["31_Announcements"] || [];
    for (const ann of announcementsSheet) {
      await client.query(
        `INSERT INTO feed_posts (id, tenant_id, record_status, attributes)
         VALUES ($1, $2, 'active', $3::jsonb)`,
        [randomUUID(), tenantId, JSON.stringify(ann)]
      );
    }

    // 20. Learning & Induction (Sheet 34_Induction_Learning)
    const learningSheet = (workbook.sheets as any)["34_Induction_Learning"] || [];
    for (const lrn of learningSheet) {
      const code = lrn["Employee code"];
      const eid = employeeIds[code];
      const title = lrn["Item"] || "Module";
      const cid = randomUUID();
      await client.query(
        `INSERT INTO courses (id, tenant_id, record_status, attributes)
         VALUES ($1, $2, 'active', $3::jsonb)`,
        [cid, tenantId, JSON.stringify({ code: title.toUpperCase().replace(/[^A-Z0-9]/g, "-"), title })]
      );
      if (eid) {
        await client.query(
          `INSERT INTO enrollments (id, tenant_id, employee_id, record_status, attributes)
           VALUES ($1, $2, $3, 'active', $4::jsonb)`,
          [randomUUID(), tenantId, eid, JSON.stringify(lrn)]
        );
      }
    }

    // 21. Statutory Calendar (Sheet 28_Statutory_Calendar)
    const statutorySheet = (workbook.sheets as any)["28_Statutory_Calendar"] || [];
    for (const st of statutorySheet) {
      await client.query(
        `INSERT INTO compliance_calendar_items (id, tenant_id, legal_entity_id, record_status, attributes)
         VALUES ($1, $2, $3, 'active', $4::jsonb)`,
        [randomUUID(), tenantId, defaultLegalEntityId, JSON.stringify(st)]
      );
    }

    // 22. Assets (Sheet 33_Assets)
    const assetsSheet = (workbook.sheets as any)["33_Assets"] || [];
    for (const ast of assetsSheet) {
      const aid = randomUUID();
      const code = ast["Employee code"] || ast["Allocated to"];
      const eid = employeeIds[code];
      await client.query(
        `INSERT INTO asset_catalog (id, tenant_id, legal_entity_id, location_id, record_status, attributes)
         VALUES ($1, $2, $3, $4, 'active', $5::jsonb)`,
        [aid, tenantId, defaultLegalEntityId, defaultLocationId, JSON.stringify(ast)]
      );
      if (eid) {
        await client.query(
          `INSERT INTO asset_assignments (id, tenant_id, asset_id, employee_id, record_status, attributes)
           VALUES ($1, $2, $3, $4, 'active', $5::jsonb)`,
          [randomUUID(), tenantId, aid, eid, JSON.stringify(ast)]
        );
      }
    }

    await client.query("COMMIT");
    console.info("Successfully ingested all workbook data into PostgreSQL database!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ingestion failed, rolled back:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
