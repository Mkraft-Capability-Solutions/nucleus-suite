import { hashPassword } from "better-auth/crypto";
import { SeedContext, uuid, timestampStr, hasData } from "./types";

export async function seedDomain02(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("--> Seeding Domain 02: Org Structure, People, Employment & Documents...");

  // 1. Countries, Currencies, Jurisdictions (Global reference)
  if (await hasData(client, "countries", false)) {
    const rows = await client`SELECT id FROM countries WHERE iso_code = 'IN' LIMIT 1`;
    ctx.countryId = rows[0]?.id;
  } else {
    const [row] = await client`
      INSERT INTO countries (id, iso_code, name, default_currency_code, default_timezone, active)
      VALUES (${uuid()}, 'IN', 'India', 'INR', 'Asia/Kolkata', true)
      RETURNING id
    `;
    ctx.countryId = row.id;
  }

  if (await hasData(client, "currencies", false)) {
    const rows = await client`SELECT id FROM currencies WHERE alpha_code = 'INR' LIMIT 1`;
    ctx.currencyId = rows[0]?.id;
  } else {
    const [row] = await client`
      INSERT INTO currencies (id, alpha_code, numeric_code, name, minor_units, symbol, active)
      VALUES (${uuid()}, 'INR', '356', 'Indian Rupee', 2, '₹', true)
      RETURNING id
    `;
    ctx.currencyId = row.id;
  }
  ctx.currencyCode = "INR";

  if (await hasData(client, "jurisdictions", false)) {
    const rows = await client`SELECT id FROM jurisdictions WHERE code = 'IN-MH' LIMIT 1`;
    ctx.jurisdictionId = rows[0]?.id || (await client`SELECT id FROM jurisdictions LIMIT 1`)[0]?.id;
  } else {
    const [row] = await client`
      INSERT INTO jurisdictions (id, country_id, code, name, kind)
      VALUES (${uuid()}, ${ctx.countryId}, 'IN-MH', 'Maharashtra, India', 'state')
      RETURNING id
    `;
    ctx.jurisdictionId = row.id;
  }

  // 2. Legal Entity
  if (await hasData(client, "legal_entities")) {
    console.log("  [CHECK] legal_entities has data. Fetching existing ID.");
    const rows = await client`SELECT id FROM legal_entities WHERE tenant_id = ${tenantId} LIMIT 1`;
    ctx.legalEntityId = rows[0]?.id;
  } else {
    console.log("  [SEED] legal_entities is empty. Inserting MKRAFT legal entity.");
    const legalEntityId = uuid();
    await client`
      INSERT INTO legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status)
      VALUES (${legalEntityId}, ${tenantId}, ${ctx.jurisdictionId}, 'MKRAFT', 'Mkraft Textiles Pvt Ltd', 'INR', 'active')
    `;
    ctx.legalEntityId = legalEntityId;
  }

  // 3. Establishments & Locations
  if (await hasData(client, "establishments")) {
    const rows = await client`SELECT id FROM establishments WHERE tenant_id = ${tenantId} LIMIT 1`;
    ctx.establishmentId = rows[0]?.id;
  } else {
    console.log("  [SEED] establishments is empty. Inserting record.");
    const establishmentId = uuid();
    await client`
      INSERT INTO establishments (id, tenant_id, legal_entity_id, jurisdiction_id, attributes)
      VALUES (${establishmentId}, ${tenantId}, ${ctx.legalEntityId}, ${ctx.jurisdictionId}, ${JSON.stringify({ code: "EST-MUM", name: "Mumbai Headquarters & Works", registration_no: "MH-MUM-7890" })}::jsonb)
    `;
    ctx.establishmentId = establishmentId;
  }

  if (await hasData(client, "locations")) {
    const rows = await client`SELECT id FROM locations WHERE tenant_id = ${tenantId}`;
    ctx.locationHoId = rows[0]?.id;
    ctx.locationPlantId = rows[1]?.id || rows[0]?.id;
  } else {
    console.log("  [SEED] locations is empty. Inserting records.");
    const locHoId = uuid();
    const locPlantId = uuid();
    await client`
      INSERT INTO locations (id, tenant_id, establishment_id, attributes)
      VALUES 
        (${locHoId}, ${tenantId}, ${ctx.establishmentId}, ${JSON.stringify({ code: "HO-MUM", name: "Head Office - Nariman Point", city: "Mumbai", state: "Maharashtra", address: "101 Maker Chambers VI" })}::jsonb),
        (${locPlantId}, ${tenantId}, ${ctx.establishmentId}, ${JSON.stringify({ code: "PLANT-BHI", name: "Textile Complex - Bhiwandi", city: "Thane", state: "Maharashtra", address: "Plot 42 MIDC Industrial Area" })}::jsonb)
    `;
    ctx.locationHoId = locHoId;
    ctx.locationPlantId = locPlantId;
  }

  // 4. Cost Centers
  if (await hasData(client, "cost_centers")) {
    const rows = await client`SELECT id FROM cost_centers WHERE tenant_id = ${tenantId} LIMIT 1`;
    ctx.costCenterId = rows[0]?.id;
  } else {
    console.log("  [SEED] cost_centers is empty. Inserting record.");
    const ccId = uuid();
    await client`
      INSERT INTO cost_centers (id, tenant_id, legal_entity_id, attributes)
      VALUES (${ccId}, ${tenantId}, ${ctx.legalEntityId}, ${JSON.stringify({ code: "CC-PROD-01", name: "Weaving & Processing Operations", budgeted_minor: 500000000 })}::jsonb)
    `;
    ctx.costCenterId = ccId;
  }

  // 5. Business Units
  if (await hasData(client, "business_units")) {
    const rows = await client`SELECT id FROM business_units WHERE tenant_id = ${tenantId}`;
    ctx.buHoId = rows[0]?.id;
    ctx.buPlantId = rows[1]?.id || rows[0]?.id;
  } else {
    console.log("  [SEED] business_units is empty. Inserting records.");
    const buHo = uuid();
    const buPlant = uuid();
    await client`
      INSERT INTO business_units (id, tenant_id, legal_entity_id, attributes)
      VALUES 
        (${buHo}, ${tenantId}, ${ctx.legalEntityId}, ${JSON.stringify({ code: "CORP", name: "Corporate Operations" })}::jsonb),
        (${buPlant}, ${tenantId}, ${ctx.legalEntityId}, ${JSON.stringify({ code: "MFG", name: "Manufacturing & Processing" })}::jsonb)
    `;
    ctx.buHoId = buHo;
    ctx.buPlantId = buPlant;
  }

  // 6. Departments
  const depts = [
    { name: "Management", code: "MGMT", bu: ctx.buHoId },
    { name: "Human Resources", code: "HR", bu: ctx.buHoId },
    { name: "Finance", code: "FIN", bu: ctx.buHoId },
    { name: "IT", code: "IT", bu: ctx.buHoId },
    { name: "Production", code: "PROD", bu: ctx.buPlantId },
    { name: "Weaving", code: "WEAVE", bu: ctx.buPlantId },
    { name: "Dyeing", code: "DYE", bu: ctx.buPlantId },
    { name: "Stitching", code: "STITCH", bu: ctx.buPlantId }
  ];
  for (const d of depts) {
    const existing = await client`SELECT id FROM departments WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${d.code} LIMIT 1`;
    let deptId = existing[0]?.id;
    if (!deptId) {
      deptId = uuid();
      await client`
        INSERT INTO departments (id, tenant_id, business_unit_id, attributes)
        VALUES (${deptId}, ${tenantId}, ${d.bu}, ${JSON.stringify({ code: d.code, name: d.name })}::jsonb)
      `;
    }
    ctx.departmentIds[d.name] = deptId;
  }

  // 7. Grades
  const grades = [
    { code: "G-EXEC", name: "Executive Leadership" },
    { code: "G-MGR", name: "Management Grade" },
    { code: "G-SUP", name: "Supervisory Grade" },
    { code: "G-STAFF", name: "Operating Staff" }
  ];
  for (const g of grades) {
    const existing = await client`SELECT id FROM grades WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${g.code} LIMIT 1`;
    let gradeId = existing[0]?.id;
    if (!gradeId) {
      gradeId = uuid();
      await client`
        INSERT INTO grades (id, tenant_id, attributes)
        VALUES (${gradeId}, ${tenantId}, ${JSON.stringify({ code: g.code, name: g.name })}::jsonb)
      `;
    }
    ctx.gradeIds[g.code] = gradeId;
  }

  // 8. Job Profiles
  const profiles = [
    { code: "P-DIR", name: "Plant Director", grade: "G-EXEC" },
    { code: "P-HRM", name: "HR Manager", grade: "G-MGR" },
    { code: "P-FIN", name: "Finance Manager", grade: "G-MGR" },
    { code: "P-SUP", name: "Operations Supervisor", grade: "G-SUP" },
    { code: "P-ENG", name: "Systems Engineer", grade: "G-SUP" },
    { code: "P-OP", name: "Plant Operator", grade: "G-STAFF" },
    { code: "P-EXE", name: "Operations Executive", grade: "G-STAFF" }
  ];
  for (const p of profiles) {
    const existing = await client`SELECT id FROM job_profiles WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${p.code} LIMIT 1`;
    let profId = existing[0]?.id;
    if (!profId) {
      profId = uuid();
      await client`
        INSERT INTO job_profiles (id, tenant_id, default_grade_id, attributes)
        VALUES (${profId}, ${tenantId}, ${ctx.gradeIds[p.grade]}, ${JSON.stringify({ code: p.code, name: p.name })}::jsonb)
      `;
    }
    ctx.jobProfileIds[p.code] = profId;
  }

  // 9. Positions
  const posDefs = [
    { code: "POS-MD", name: "Plant Head / VP", dept: "Management", prof: "P-DIR", grade: "G-EXEC" },
    { code: "POS-HRM", name: "HR Manager", dept: "Human Resources", prof: "P-HRM", grade: "G-MGR" },
    { code: "POS-FIN", name: "Finance Controller", dept: "Finance", prof: "P-FIN", grade: "G-MGR" },
    { code: "POS-WVS", name: "Weaving Supervisor", dept: "Weaving", prof: "P-SUP", grade: "G-SUP" },
    { code: "POS-DYS", name: "Dyeing Supervisor", dept: "Dyeing", prof: "P-SUP", grade: "G-SUP" },
    { code: "POS-QAE", name: "Quality Lead", dept: "Production", prof: "P-ENG", grade: "G-SUP" },
    { code: "POS-WVO", name: "Weaving Operator", dept: "Weaving", prof: "P-OP", grade: "G-STAFF" },
    { code: "POS-DYO", name: "Dyeing Operator", dept: "Dyeing", prof: "P-OP", grade: "G-STAFF" },
    { code: "POS-STO", name: "Stitching Operator", dept: "Stitching", prof: "P-OP", grade: "G-STAFF" },
    { code: "POS-HRE", name: "HR Executive", dept: "Human Resources", prof: "P-EXE", grade: "G-STAFF" },
    { code: "POS-ACC", name: "Accounts Executive", dept: "Finance", prof: "P-EXE", grade: "G-STAFF" },
    { code: "POS-ITS", name: "IT Engineer", dept: "IT", prof: "P-ENG", grade: "G-STAFF" }
  ];
  for (const p of posDefs) {
    const existing = await client`SELECT id FROM positions WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${p.code} LIMIT 1`;
    let posId = existing[0]?.id;
    if (!posId) {
      posId = uuid();
      await client`
        INSERT INTO positions (id, tenant_id, department_id, grade_id, job_profile_id, attributes)
        VALUES (${posId}, ${tenantId}, ${ctx.departmentIds[p.dept]}, ${ctx.gradeIds[p.grade]}, ${ctx.jobProfileIds[p.prof]}, ${JSON.stringify({ code: p.code, name: p.name })}::jsonb)
      `;
    }
    ctx.positionIds[p.code] = posId;
  }

  // Position relationships
  if (!(await hasData(client, "position_relationships"))) {
    console.log("  [SEED] position_relationships is empty. Inserting relations.");
    for (const code of ["POS-HRM", "POS-FIN", "POS-WVS", "POS-DYS", "POS-QAE"]) {
      await client`
        INSERT INTO position_relationships (id, tenant_id, from_position_id, to_position_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${ctx.positionIds[code]}, ${ctx.positionIds["POS-MD"]}, ${JSON.stringify({ relation: "reports_to" })}::jsonb)
      `;
    }
  }

  // 10. Worker categories
  let workerCatId = "";
  if (await hasData(client, "worker_categories")) {
    const rows = await client`SELECT id FROM worker_categories WHERE tenant_id = ${tenantId} LIMIT 1`;
    workerCatId = rows[0]?.id;
  } else {
    console.log("  [SEED] worker_categories is empty. Inserting categories.");
    const rowId = uuid();
    await client`
      INSERT INTO worker_categories (id, tenant_id, attributes)
      VALUES (${rowId}, ${tenantId}, ${JSON.stringify({ code: "FTE", name: "Full-Time Regular Employee", standard_hours_weekly: 48 })}::jsonb)
    `;
    workerCatId = rowId;
  }

  // 11. Operational Roster Definition (16 Employees across 2024, 2025, 2026)
  // Check if employees table already has data for this tenant
  const rosterData = [
    { code: "MK-101", first: "Rajesh", last: "Sharma", email: "rajesh.sharma@mkraft.demo", dept: "Management", desig: "Plant Head", joining: "2024-04-01", salary: 14000000, pos: "POS-MD", grade: "G-EXEC", mgr: null, role: "manager" },
    { code: "MK-102", first: "Sunita", last: "Verma", email: "sunita.verma@mkraft.demo", dept: "Human Resources", desig: "Head of HR", joining: "2024-04-15", salary: 9000000, pos: "POS-HRM", grade: "G-MGR", mgr: "MK-101", role: "hr-manager" },
    { code: "MK-103", first: "Amit", last: "Patel", email: "amit.patel@mkraft.demo", dept: "Finance", desig: "Finance Controller", joining: "2024-05-01", salary: 8500000, pos: "POS-FIN", grade: "G-MGR", mgr: "MK-101", role: "payroll-admin" },
    { code: "MK-104", first: "Ramesh", last: "Nair", email: "ramesh.nair@mkraft.demo", dept: "Weaving", desig: "Weaving Supervisor", joining: "2024-06-01", salary: 5500000, pos: "POS-WVS", grade: "G-SUP", mgr: "MK-101", role: "manager" },
    { code: "MK-105", first: "Deepa", last: "Kulkarni", email: "deepa.kulkarni@mkraft.demo", dept: "Dyeing", desig: "Dyeing Supervisor", joining: "2024-06-15", salary: 5400000, pos: "POS-DYS", grade: "G-SUP", mgr: "MK-101", role: "manager" },
    { code: "MK-106", first: "Manoj", last: "Gupta", email: "manoj.gupta@mkraft.demo", dept: "Production", desig: "Quality Assurance Lead", joining: "2024-07-01", salary: 5800000, pos: "POS-QAE", grade: "G-SUP", mgr: "MK-102", role: "employee" },
    { code: "MK-107", first: "Vikas", last: "Yadav", email: "vikas.yadav@mkraft.demo", dept: "Weaving", desig: "Master Loom Technician", joining: "2024-08-01", salary: 3800000, pos: "POS-WVO", grade: "G-STAFF", mgr: "MK-104", role: "employee" },
    { code: "MK-108", first: "Pooja", last: "Joshi", email: "pooja.joshi@mkraft.demo", dept: "Human Resources", desig: "Senior HR Generalist", joining: "2024-09-01", salary: 4200000, pos: "POS-HRE", grade: "G-STAFF", mgr: "MK-102", role: "hr-manager" },
    { code: "MK-109", first: "Dinesh", last: "Kumar", email: "dinesh.kumar@mkraft.demo", dept: "Dyeing", desig: "Dyeing Specialist", joining: "2024-11-15", salary: 3600000, pos: "POS-DYO", grade: "G-STAFF", mgr: "MK-105", role: "employee" },
    { code: "MK-110", first: "Priya", last: "Rao", email: "priya.rao@mkraft.demo", dept: "Finance", desig: "Payroll Specialist", joining: "2025-01-10", salary: 4500000, pos: "POS-ACC", grade: "G-STAFF", mgr: "MK-103", role: "payroll-admin" },
    { code: "MK-111", first: "Suresh", last: "Chauhan", email: "suresh.chauhan@mkraft.demo", dept: "Weaving", desig: "Weaving Operator", joining: "2025-02-15", salary: 2800000, pos: "POS-WVO", grade: "G-STAFF", mgr: "MK-107", role: "employee" },
    { code: "MK-112", first: "Meena", last: "Kumari", email: "meena.kumari@mkraft.demo", dept: "Stitching", desig: "Stitching Operator", joining: "2025-04-01", salary: 2700000, pos: "POS-STO", grade: "G-STAFF", mgr: "MK-104", role: "employee" },
    { code: "MK-113", first: "Sandeep", last: "Tiwari", email: "sandeep.tiwari@mkraft.demo", dept: "IT", desig: "IT Systems Engineer", joining: "2025-06-01", salary: 4800000, pos: "POS-ITS", grade: "G-STAFF", mgr: "MK-101", role: "employee" },
    { code: "MK-114", first: "Kavita", last: "Deshmukh", email: "kavita.deshmukh@mkraft.demo", dept: "Finance", desig: "Accounts Executive", joining: "2025-08-15", salary: 3200000, pos: "POS-ACC", grade: "G-STAFF", mgr: "MK-110", role: "employee" },
    { code: "MK-115", first: "Arun", last: "Pillai", email: "arun.pillai@mkraft.demo", dept: "Weaving", desig: "Maintenance Electrician", joining: "2026-01-10", salary: 3100000, pos: "POS-WVO", grade: "G-STAFF", mgr: "MK-104", role: "employee" },
    { code: "MK-116", first: "Jyoti", last: "Shinde", email: "jyoti.shinde@mkraft.demo", dept: "Production", desig: "Quality Inspector", joining: "2026-03-01", salary: 2900000, pos: "POS-STO", grade: "G-STAFF", mgr: "MK-106", role: "employee" }
  ];

  const defaultPasswordHash = await hashPassword("Brightenz@2026!");
  const employeesExist = await hasData(client, "employees");

  if (!employeesExist) {
    console.log("  [SEED] employees is empty. Provisioning 16 operational employees.");
    for (const r of rosterData) {
      const userId = uuid();
      const personId = uuid();
      const employeeId = uuid();
      const employmentId = uuid();
      const membershipId = uuid();

      // User & Account
      await client`
        INSERT INTO "user" (id, name, email, email_verified, status)
        VALUES (${userId}, ${r.first + " " + r.last}, ${r.email}, true, 'active')
        ON CONFLICT (email) DO NOTHING
      `;
      await client`
        INSERT INTO account (id, account_id, provider_id, user_id, password)
        VALUES (${uuid()}, ${userId}, 'credential', ${userId}, ${defaultPasswordHash})
        ON CONFLICT DO NOTHING
      `;

      // Membership & Role
      await client`
        INSERT INTO memberships (id, tenant_id, user_id, role, status)
        VALUES (${membershipId}, ${tenantId}, ${userId}, ${r.role === 'manager' ? 'owner' : 'employee'}, 'active')
      `;
      await client`
        INSERT INTO membership_roles (tenant_id, membership_id, role_id)
        VALUES (${tenantId}, ${membershipId}, ${ctx.roleIds[r.role] || ctx.roleIds.employee})
      `;

      // Person & Employee
      await client`INSERT INTO people (id, tenant_id) VALUES (${personId}, ${tenantId})`;
      await client`
        INSERT INTO employees (
          id, tenant_id, person_id, employee_code, first_name, last_name, 
          designation, department, location, joining_date, basic_salary_minor, status
        )
        VALUES (
          ${employeeId}, ${tenantId}, ${personId}, ${r.code}, ${r.first}, ${r.last},
          ${r.desig}, ${r.dept}, ${r.dept === 'Management' || r.dept === 'Human Resources' || r.dept === 'Finance' || r.dept === 'IT' ? 'Head Office' : 'Plant North'},
          ${r.joining}, ${r.salary}, 'active'
        )
      `;
      await client`UPDATE memberships SET employee_id = ${employeeId} WHERE id = ${membershipId}`;

      // Link Brightenz Role Accounts to respective operational employee personas
      if (r.code === "MK-102") {
        // Sunita Verma -> hr@brigtenz.tech
        await client`
          UPDATE memberships 
          SET employee_id = ${employeeId} 
          WHERE tenant_id = ${tenantId} 
          AND user_id IN (SELECT id FROM "user" WHERE lower(email) = 'hr@brigtenz.tech')
        `;
      } else if (r.code === "MK-104") {
        // Ramesh Nair -> manager@brigtenz.tech
        await client`
          UPDATE memberships 
          SET employee_id = ${employeeId} 
          WHERE tenant_id = ${tenantId} 
          AND user_id IN (SELECT id FROM "user" WHERE lower(email) = 'manager@brigtenz.tech')
        `;
      } else if (r.code === "MK-107") {
        // Vikas Yadav -> employee@brigtenz.tech
        await client`
          UPDATE memberships 
          SET employee_id = ${employeeId} 
          WHERE tenant_id = ${tenantId} 
          AND user_id IN (SELECT id FROM "user" WHERE lower(email) = 'employee@brigtenz.tech')
        `;
      }

      // Employment & Assignments
      await client`
        INSERT INTO employments (id, tenant_id, employee_id, legal_entity_id, worker_category_id, attributes)
        VALUES (${employmentId}, ${tenantId}, ${employeeId}, ${ctx.legalEntityId}, ${workerCatId}, ${JSON.stringify({ employment_type: "permanent", confirmed_at: r.joining })}::jsonb)
      `;
      await client`
        INSERT INTO employee_assignments (id, tenant_id, employment_id, department_id, grade_id, position_id, location_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${employmentId}, ${ctx.departmentIds[r.dept]}, ${ctx.gradeIds[r.grade]}, ${ctx.positionIds[r.pos]}, ${r.dept === 'Management' ? ctx.locationHoId : ctx.locationPlantId}, ${JSON.stringify({ primary: true, start_date: r.joining })}::jsonb)
      `;

      // Employee Changes & Lifecycle Events
      await client`
        INSERT INTO employee_changes (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${employeeId}, ${JSON.stringify({ change_type: "initial_appointment", effective_date: r.joining, salary_minor: r.salary })}::jsonb)
      `;
      await client`
        INSERT INTO lifecycle_events (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${employeeId}, ${JSON.stringify({ event_type: "joined", occurred_on: r.joining, remarks: "Joined company successfully" })}::jsonb)
      `;

      // Dependants, Contacts
      await client`
        INSERT INTO dependants (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${employeeId}, ${JSON.stringify({ name: `${r.first}'s Family Member`, relationship: "Spouse", dob: "1992-05-14" })}::jsonb)
      `;
      await client`
        INSERT INTO emergency_contacts (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${employeeId}, ${JSON.stringify({ contact_name: `${r.first} Contact`, relationship: "Spouse", phone: "+91-98200-11223" })}::jsonb)
      `;
      await client`
        INSERT INTO employee_contacts (id, tenant_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${employeeId}, ${JSON.stringify({ contact_type: "personal_mobile", value: "+91-98200-99881", is_primary: true })}::jsonb)
      `;

      // Invitation
      await client`
        INSERT INTO invitations (tenant_id, email, token_hash, status, invited_by_user_id, accepted_user_id, expires_at, accepted_at)
        VALUES (${tenantId}, ${r.email}, ${"token-" + r.code}, 'accepted', ${userId}, ${userId}, ${timestampStr(2026, 9, 30)}, ${timestampStr(2024, 4, 1)})
      `;

      const rosterItem = {
        code: r.code,
        firstName: r.first,
        lastName: r.last,
        email: r.email,
        department: r.dept,
        designation: r.desig,
        joiningDate: r.joining,
        salaryMinor: r.salary,
        userId,
        personId,
        employeeId,
        employmentId,
        membershipId,
        positionId: ctx.positionIds[r.pos],
        gradeId: ctx.gradeIds[r.grade],
        managerCode: r.mgr
      };

      ctx.roster.push(rosterItem);
      ctx.employeeByCode[r.code] = rosterItem;
      ctx.membershipByCode[r.code] = membershipId;
    }

    // Link managers
    for (const r of ctx.roster) {
      if (r.managerCode && ctx.employeeByCode[r.managerCode]) {
        await client`
          UPDATE employees 
          SET manager_employee_id = ${ctx.employeeByCode[r.managerCode].employeeId}
          WHERE id = ${r.employeeId}
        `;
      }
    }
  } else {
    console.log("  [CHECK] employees already has data. Fetching existing employees.");
    const rows = await client`
      SELECT e.id as employee_id, e.person_id, e.employee_code, e.first_name, e.last_name, e.joining_date, e.basic_salary_minor,
             m.id as membership_id, m.user_id, u.email, em.id as employment_id
      FROM employees e
      JOIN memberships m ON m.employee_id = e.id AND m.tenant_id = ${tenantId}
      JOIN "user" u ON u.id = m.user_id
      LEFT JOIN employments em ON em.employee_id = e.id AND em.tenant_id = ${tenantId}
      WHERE e.tenant_id = ${tenantId}
    `;
    for (const r of rows as Array<{
      employee_code: string;
      first_name: string;
      last_name: string;
      email: string;
      joining_date: string;
      basic_salary_minor: number;
      user_id: string;
      person_id: string;
      employee_id: string;
      employment_id: string;
      membership_id: string;
    }>) {
      const rosterItem = {
        code: r.employee_code,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        department: "Operations",
        designation: "Staff",
        joiningDate: r.joining_date,
        salaryMinor: r.basic_salary_minor,
        userId: r.user_id,
        personId: r.person_id || "",
        employeeId: r.employee_id,
        employmentId: r.employment_id || "",
        membershipId: r.membership_id,
        positionId: "",
        gradeId: "",
        managerCode: null
      };
      ctx.roster.push(rosterItem);
      ctx.employeeByCode[r.employee_code] = rosterItem;
      ctx.membershipByCode[r.employee_code] = r.membership_id;
    }
  }

  // Guarantee Brightenz Role Accounts are linked to operational personas
  await client`
    UPDATE memberships 
    SET employee_id = e.id 
    FROM employees e, "user" u
    WHERE memberships.tenant_id = ${tenantId}
    AND memberships.user_id = u.id
    AND lower(u.email) = 'hr@brigtenz.tech'
    AND e.employee_code = 'MK-102'
    AND e.tenant_id = ${tenantId}
  `;
  await client`
    UPDATE memberships 
    SET employee_id = e.id 
    FROM employees e, "user" u
    WHERE memberships.tenant_id = ${tenantId}
    AND memberships.user_id = u.id
    AND lower(u.email) = 'manager@brigtenz.tech'
    AND e.employee_code = 'MK-104'
    AND e.tenant_id = ${tenantId}
  `;
  await client`
    UPDATE memberships 
    SET employee_id = e.id 
    FROM employees e, "user" u
    WHERE memberships.tenant_id = ${tenantId}
    AND memberships.user_id = u.id
    AND lower(u.email) = 'employee@brigtenz.tech'
    AND e.employee_code = 'MK-107'
    AND e.tenant_id = ${tenantId}
  `;

  // 12. Delegation Windows & Resource Grants
  if (!(await hasData(client, "delegation_windows"))) {
    console.log("  [SEED] delegation_windows is empty. Inserting records.");
    await client`
      INSERT INTO delegation_windows (id, tenant_id, delegator_membership_id, delegate_membership_id, permission_ceiling, reason, valid_from, valid_to)
      VALUES 
        (${uuid()}, ${tenantId}, ${ctx.membershipByCode["MK-102"]}, ${ctx.membershipByCode["MK-108"]}, ARRAY['leave.approve', 'attendance.write'], 'HR Annual Leave 2025', '2025-07-01T00:00:00Z', '2025-07-15T23:59:59Z'),
        (${uuid()}, ${tenantId}, ${ctx.membershipByCode["MK-104"]}, ${ctx.membershipByCode["MK-107"]}, ARRAY['attendance.write'], 'Plant Audit Offsite 2026', '2026-05-10T00:00:00Z', '2026-05-15T23:59:59Z')
    `;
  }

  if (!(await hasData(client, "resource_grants"))) {
    console.log("  [SEED] resource_grants is empty. Inserting records.");
    await client`
      INSERT INTO resource_grants (id, tenant_id, membership_id, resource_type, resource_id, actions, reason, expires_at)
      VALUES 
        (${uuid()}, ${tenantId}, ${ctx.membershipByCode["MK-102"]}, 'department', ${ctx.departmentIds["Human Resources"]}, ARRAY['read', 'write'], 'HR Department Ownership', '2027-12-31T23:59:59Z'),
        (${uuid()}, ${tenantId}, ${ctx.membershipByCode["MK-103"]}, 'cost_center', ${ctx.costCenterId}, ARRAY['read', 'spend'], 'Production Budget Sign-off', '2027-12-31T23:59:59Z')
    `;
  }

  // 13. Document Types, Documents, Versions & Letter Templates
  const docTypes = [
    { code: "POLICY", name: "Company Policy Document" },
    { code: "OFFER", name: "Employment Offer Letter" },
    { code: "APPOINT", name: "Appointment Letter" },
    { code: "ID_PROOF", name: "Statutory Identification" },
    { code: "CERT", name: "Technical Certification" }
  ];
  for (const dt of docTypes) {
    const existing = await client`SELECT id FROM document_types WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${dt.code} LIMIT 1`;
    let dtId = existing[0]?.id;
    if (!dtId) {
      dtId = uuid();
      await client`
        INSERT INTO document_types (id, tenant_id, attributes)
        VALUES (${dtId}, ${tenantId}, ${JSON.stringify({ code: dt.code, name: dt.name })}::jsonb)
      `;
    }
    ctx.documentTypeIds[dt.code] = dtId;
  }

  if (!(await hasData(client, "documents"))) {
    console.log("  [SEED] documents is empty. Inserting policy docs.");
    for (const [code, title, year] of [["DOC-HANDBOOK-24", "MKraft Code of Conduct 2024", 2024], ["DOC-SAFETY-25", "Plant North Safety Standard Operating Procedure", 2025], ["DOC-POSH-26", "Anti-Harassment & Ethics Policy 2026", 2026]] as Array<[string, string, number]>) {
      const docId = uuid();
      const verId = uuid();
      await client`
        INSERT INTO documents (id, tenant_id, document_type_id, attributes)
        VALUES (${docId}, ${tenantId}, ${ctx.documentTypeIds["POLICY"]}, ${JSON.stringify({ code, title, category: "compliance", active_year: year })}::jsonb)
      `;
      ctx.documentIds[code] = docId;

      await client`
        INSERT INTO document_versions (id, tenant_id, document_id, attributes)
        VALUES (${verId}, ${tenantId}, ${docId}, ${JSON.stringify({ version_number: 1, file_name: `${code.toLowerCase()}.pdf`, hash: "sha256-mock-hash-123456", effective_from: `${year}-01-01` })}::jsonb)
      `;
      await client`
        INSERT INTO document_access_policies (id, tenant_id, document_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${docId}, ${JSON.stringify({ audience: "all_employees", access_level: "read_only" })}::jsonb)
      `;
      await client`
        INSERT INTO document_expiries (id, tenant_id, document_id, document_version_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${docId}, ${verId}, ${JSON.stringify({ expires_on: `${year + 2}-12-31`, reminder_days: 30 })}::jsonb)
      `;
      await client`
        INSERT INTO document_extractions (id, tenant_id, document_version_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${verId}, ${JSON.stringify({ ocr_status: "completed", extracted_text_summary: `Official ${title} released for all company employees.` })}::jsonb)
      `;
    }
  } else {
    console.log("  [CHECK] documents has data. Fetching existing IDs.");
    const rows = await client`SELECT id, attributes->>'code' as code FROM documents WHERE tenant_id = ${tenantId}`;
    for (const r of rows as Array<{ id: string; code: string | null }>) {
      ctx.documentIds[r.code || "DOC-HANDBOOK-24"] = r.id;
    }
  }

  // Letter Templates and Generated Letters
  if (!(await hasData(client, "letter_templates"))) {
    console.log("  [SEED] letter_templates is empty. Inserting templates.");
    const templateId = uuid();
    await client`
      INSERT INTO letter_templates (id, tenant_id, document_type_id, attributes)
      VALUES (${templateId}, ${tenantId}, ${ctx.documentTypeIds["APPOINT"]}, ${JSON.stringify({ template_code: "TMPL-APPOINT-V1", name: "Standard Appointment Letter", subject: "Appointment as {{designation}}" })}::jsonb)
    `;

    if (!(await hasData(client, "generated_letters"))) {
      const docId = Object.values(ctx.documentIds)[0];
      for (const empCode of ["MK-101", "MK-102", "MK-110", "MK-115"]) {
        const emp = ctx.employeeByCode[empCode];
        if (emp && docId) {
          await client`
            INSERT INTO generated_letters (id, tenant_id, letter_template_id, document_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${templateId}, ${docId}, ${JSON.stringify({ employee_id: emp.employeeId, issued_on: emp.joiningDate, recipient_email: emp.email })}::jsonb)
          `;
        }
      }
    }
  }

  console.log(`✓ Domain 02 seeded successfully.`);
}
