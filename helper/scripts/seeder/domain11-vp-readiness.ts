import { SeedContext, uuid, hasData } from "./types";
import { createHash } from "node:crypto";

export async function seedDomain11(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("--> Seeding Domain 11: VP Readiness & 26-Feature Extended Controls...");

  // 1. VP Rule Sets (attendance, worker, leave, statutory, announcement, letter)
  let ruleSetAttendanceId = uuid();
  let ruleSetWorkerId = uuid();
  let ruleSetLeaveId = uuid();
  let ruleSetStatutoryKaId = uuid();
  let ruleSetStatutoryMhId = uuid();
  let ruleSetAnnouncementId = uuid();
  let ruleSetLetterId = uuid();

  // Find a manager or admin membership for created_by
  const hrMemId = (await client`
    SELECT m.id FROM memberships m
    JOIN "user" u ON u.id = m.user_id
    WHERE m.tenant_id = ${tenantId} AND u.email = 'hr@brigtenz.tech'
    LIMIT 1
  `)[0]?.id || ctx.roster[1]?.membershipId || ctx.roster[0]?.membershipId;

  if (!(await hasData(client, "vp_rule_sets"))) {
    console.log("  [SEED] vp_rule_sets is empty. Inserting operational rule sets.");
    await client`
      INSERT INTO vp_rule_sets (id, tenant_id, domain, code, version, effective_from, status, config, created_by_membership_id)
      VALUES
        (${ruleSetAttendanceId}, ${tenantId}, 'attendance', 'plant-default', 1, '2024-01-01', 'approved', ${JSON.stringify({
          halfDayMinutes: 450,
          absentMinutes: 270,
          graceMinutes: 15,
          forgivenLateInstances: 3,
          windows: [
            { code: "M", earliestMinute: 360, latestMinute: 510, durationMinutes: 480 },
            { code: "E", earliestMinute: 840, latestMinute: 990, durationMinutes: 480 },
            { code: "N", earliestMinute: 1320, latestMinute: 1440, durationMinutes: 480 }
          ]
        })}::jsonb, ${hrMemId}),
        (${ruleSetWorkerId}, ${tenantId}, 'worker', 'contractor-rules', 1, '2024-01-01', 'approved', ${JSON.stringify({
          restDayMandatory: false,
          dailyWageOvertime: true,
          maxContinuousDays: 14,
          rateMultiplierOt: 2.0
        })}::jsonb, ${hrMemId}),
        (${ruleSetLeaveId}, ${tenantId}, 'leave', 'standard-leave', 1, '2024-01-01', 'approved', ${JSON.stringify({
          coffValidityDays: 60,
          annualElCarryOverCap: 30,
          annualLeaveCreditRules: "standard-manufacturing"
        })}::jsonb, ${hrMemId}),
        (${ruleSetStatutoryKaId}, ${tenantId}, 'statutory', 'KA:FORM_F', 1, '2024-01-01', 'approved', ${JSON.stringify({
          template: "<div class='statutory-form'><h3>FORM F - REGISTER OF LEAVE WITH WAGES</h3><p>State: Karnataka</p><p>Employee: {{employeeName}} ({{employeeCode}})</p><p>Joining Date: {{joiningDate}}</p><p>Days Worked: {{daysWorked}}</p><p>Leave Earned: {{leaveEarned}}</p></div>"
        })}::jsonb, ${hrMemId}),
        (${ruleSetStatutoryMhId}, ${tenantId}, 'statutory', 'MH:FORM_16', 1, '2024-01-01', 'approved', ${JSON.stringify({
          template: "<div class='statutory-form'><h3>FORM 16 - TDS CERTIFICATE</h3><p>State: Maharashtra</p><p>Employee: {{employeeName}} ({{employeeCode}})</p><p>PAN: {{panNumber}}</p><p>Gross Salary: {{grossSalary}}</p><p>Tax Deducted: {{taxDeducted}}</p></div>"
        })}::jsonb, ${hrMemId}),
        (${ruleSetAnnouncementId}, ${tenantId}, 'announcement', 'general-policy', 1, '2024-01-01', 'approved', ${JSON.stringify({
          autoBroadcast: true,
          requireAck: false,
          priority: "normal"
        })}::jsonb, ${hrMemId}),
        (${ruleSetLetterId}, ${tenantId}, 'letter', 'appointment-letter', 1, '2024-01-01', 'approved', ${JSON.stringify({
          template: "Dear {{employeeName}}, We are pleased to offer you appointment as {{designation}} at MKraft {{location}} with effective date {{joiningDate}}."
        })}::jsonb, ${hrMemId})
    `;
  } else {
    console.log("  [CHECK] vp_rule_sets already has data. Fetching existing ID.");
    const existingRule = (await client`SELECT id FROM vp_rule_sets WHERE tenant_id = ${tenantId} AND domain = 'attendance' LIMIT 1`)[0];
    if (existingRule) ruleSetAttendanceId = existingRule.id;
  }

  // 2. VP Location Grants (location scoping with salary masking)
  if (!(await hasData(client, "vp_location_grants"))) {
    console.log("  [SEED] vp_location_grants is empty. Inserting location scopes.");
    const plantLoc = ctx.locationPlantId || (await client`SELECT id FROM locations WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id;

    // HR manager can view compensation across plant
    if (hrMemId && plantLoc) {
      await client`
        INSERT INTO vp_location_grants (id, tenant_id, membership_id, location_id, can_view_compensation, valid_from)
        VALUES
          (${uuid()}, ${tenantId}, ${hrMemId}, ${plantLoc}, true, '2024-01-01')
        ON CONFLICT (tenant_id, membership_id, location_id) DO NOTHING
      `;
    }

    // People Manager (Ramesh Nair) has location scope for Plant North but with compensation masked (false)
    const mgrMemId = (await client`
      SELECT m.id FROM memberships m
      JOIN "user" u ON u.id = m.user_id
      WHERE m.tenant_id = ${tenantId} AND u.email = 'manager@brigtenz.tech'
      LIMIT 1
    `)[0]?.id || ctx.roster[3]?.membershipId;

    if (mgrMemId && plantLoc) {
      await client`
        INSERT INTO vp_location_grants (id, tenant_id, membership_id, location_id, can_view_compensation, valid_from)
        VALUES
          (${uuid()}, ${tenantId}, ${mgrMemId}, ${plantLoc}, false, '2024-01-01')
        ON CONFLICT (tenant_id, membership_id, location_id) DO NOTHING
      `;
    }
  }

  // 3. VP Attendance Results (linked to calibrated attendance_days)
  if (!(await hasData(client, "vp_attendance_results"))) {
    console.log("  [SEED] vp_attendance_results is empty. Inserting evaluated attendance results.");
    const sampleDays = await client`
      SELECT id, employee_id, attendance_date, status, assigned_shift
      FROM attendance_days 
      WHERE tenant_id = ${tenantId}
      ORDER BY attendance_date DESC
      LIMIT 25
    `;

    for (const day of sampleDays as any[]) {
      const isPresent = day.status === 'present' || day.status === 'p';
      const status = isPresent ? 'present' : day.status === 'half_day' ? 'half_day' : 'absent';
      const grossMinutes = isPresent ? 510 : 0;
      const breakMinutes = isPresent ? 60 : 0;
      const netMinutes = isPresent ? 450 : 0;
      const otMinutes = isPresent ? 30 : 0;

      await client`
        INSERT INTO vp_attendance_results (
          id, tenant_id, attendance_day_id, employee_id, attendance_date,
          assigned_shift_code, inferred_shift_code, inference_reason, rule_set_id,
          day_type, status, status_reason, gross_minutes, break_minutes,
          net_minutes, gate_pass_minutes, payable_ot_minutes, trace
        ) VALUES (
          ${uuid()}, ${tenantId}, ${day.id}, ${day.employee_id}, ${day.attendance_date},
          ${day.assigned_shift || 'M'}, ${day.assigned_shift || 'M'}, 'Automatic punch window match', ${ruleSetAttendanceId},
          'working', ${status}, 'Calibrated productive minutes met shift requirement', ${grossMinutes}, ${breakMinutes},
          ${netMinutes}, 0, ${otMinutes}, ${JSON.stringify({ shiftHours: 8, netMinutes, otMinutes })}::jsonb
        )
        ON CONFLICT (tenant_id, attendance_day_id) DO NOTHING
      `;
    }
  }

  // 4. VP ERP Records (inbound employee master sync & outbound GL post sync)
  if (!(await hasData(client, "vp_erp_records"))) {
    console.log("  [SEED] vp_erp_records is empty. Inserting ERP sync records.");
    const connectionId = (await client`SELECT id FROM integration_connections WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id || null;

    // Inbound employee masters
    for (const emp of ctx.roster.slice(0, 5)) {
      const payload = {
        employeeCode: emp.code,
        firstName: emp.firstName,
        lastName: emp.lastName,
        department: emp.department,
        designation: emp.designation,
        joiningDate: emp.joiningDate,
        basicSalaryMinor: emp.salaryMinor
      };
      const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      await client`
        INSERT INTO vp_erp_records (
          id, tenant_id, connection_id, direction, external_key,
          payload_hash, payload, status, attempt_count,
          acknowledgement_ref, applied_at, acknowledged_at
        ) VALUES (
          ${uuid()}, ${tenantId}, ${connectionId}, 'inbound_employee', ${emp.code},
          ${hash}, ${JSON.stringify(payload)}::jsonb, 'applied', 1,
          ${`SAP-SYNC-${emp.code}`}, now() - interval '10 days', now() - interval '10 days'
        )
        ON CONFLICT (tenant_id, direction, external_key, payload_hash) DO NOTHING
      `;
    }

    // Outbound GL post record
    const glPayload = {
      period: "2026-08",
      scope: "regular",
      totalDebitMinor: 48500000,
      totalCreditMinor: 48500000,
      accounts: ["SALARY_EXPENSE", "PF_PAYABLE", "ESI_PAYABLE", "PT_PAYABLE", "BANK_PAYABLE"]
    };
    const glHash = createHash("sha256").update(JSON.stringify(glPayload)).digest("hex");
    await client`
      INSERT INTO vp_erp_records (
        id, tenant_id, connection_id, direction, external_key,
        payload_hash, payload, status, attempt_count,
        acknowledgement_ref, applied_at, acknowledged_at
      ) VALUES (
        ${uuid()}, ${tenantId}, ${connectionId}, 'outbound_gl', 'GL-POST-2026-08',
        ${glHash}, ${JSON.stringify(glPayload)}::jsonb, 'posted', 1,
        'ORACLE-ERP-GL-REC-88491', now() - interval '5 days', now() - interval '5 days'
      )
      ON CONFLICT (tenant_id, direction, external_key, payload_hash) DO NOTHING
    `;
  }

  // 5. VP GL Batches & 6. VP GL Lines (balanced double-entry journal postings)
  if (!(await hasData(client, "vp_gl_batches"))) {
    console.log("  [SEED] vp_gl_batches is empty. Inserting balanced GL batches & lines.");
    const connectionId = (await client`SELECT id FROM integration_connections WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id || null;
    const runs = await client`
      SELECT id, period, scope, status 
      FROM payroll_runs 
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT 3
    `;

    for (const run of runs as any[]) {
      const batchId = uuid();
      const debitMinor = 48500000;
      const creditMinor = 48500000; // Balanced: debit = credit

      await client`
        INSERT INTO vp_gl_batches (
          id, tenant_id, payroll_run_id, connection_id, status,
          debit_minor, credit_minor, acknowledgement_ref, posted_at
        ) VALUES (
          ${batchId}, ${tenantId}, ${run.id}, ${connectionId}, 'reconciled',
          ${debitMinor}, ${creditMinor}, ${`ERP-ACK-${run.period}-${run.scope}`}, now() - interval '2 days'
        )
        ON CONFLICT (tenant_id, payroll_run_id) DO NOTHING
      `;

      // Insert double-entry GL lines (balanced)
      // Debit line
      await client`
        INSERT INTO vp_gl_lines (id, tenant_id, batch_id, account_code, component_code, debit_minor, credit_minor, narration)
        VALUES (${uuid()}, ${tenantId}, ${batchId}, 'SALARY_EXPENSE', 'gross', ${debitMinor}, 0, ${`Payroll Expense ${run.period} ${run.scope}`})
      `;

      // Credit deduction lines
      await client`
        INSERT INTO vp_gl_lines (id, tenant_id, batch_id, account_code, component_code, debit_minor, credit_minor, narration)
        VALUES 
          (${uuid()}, ${tenantId}, ${batchId}, 'PF_PAYABLE', 'pf', 0, 4200000, ${`Provident Fund ${run.period}`}),
          (${uuid()}, ${tenantId}, ${batchId}, 'ESI_PAYABLE', 'esi', 0, 1800000, ${`ESIC Contribution ${run.period}`}),
          (${uuid()}, ${tenantId}, ${batchId}, 'PT_PAYABLE', 'pt', 0, 500000, ${`Professional Tax ${run.period}`}),
          (${uuid()}, ${tenantId}, ${batchId}, 'TDS_PAYABLE', 'tds', 0, 2000000, ${`Tax Deducted at Source ${run.period}`}),
          (${uuid()}, ${tenantId}, ${batchId}, 'BANK_PAYABLE', 'net', 0, 40000000, ${`Net Salary NEFT Disbursement ${run.period}`})
      `;
    }
  }

  // 7. VP Statutory Instances (Factory Act Form F, Form 16, etc.)
  if (!(await hasData(client, "vp_statutory_instances"))) {
    console.log("  [SEED] vp_statutory_instances is empty. Inserting statutory registers.");
    const plantLoc = ctx.locationPlantId || (await client`SELECT id FROM locations WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id || null;

    for (const emp of ctx.roster.slice(0, 5)) {
      const docId = (await client`SELECT id FROM documents WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id || null;
      const html = `
        <div class="statutory-form">
          <h2>THE FACTORIES ACT, 1948 - FORM F</h2>
          <h3>Register of Leave with Wages</h3>
          <p><strong>Factory:</strong> MKraft Textiles Ltd (Plant North)</p>
          <p><strong>State:</strong> Karnataka</p>
          <p><strong>Employee:</strong> ${emp.firstName} ${emp.lastName} (${emp.code})</p>
          <p><strong>Department:</strong> ${emp.department}</p>
          <p><strong>Designation:</strong> ${emp.designation}</p>
          <p><strong>Date of Entry:</strong> ${emp.joiningDate}</p>
          <p><strong>Leave Earned during 2026:</strong> 18 days</p>
          <p><strong>Leave Availed:</strong> 4 days</p>
          <p><strong>Balance Carried Forward:</strong> 14 days</p>
        </div>
      `;

      await client`
        INSERT INTO vp_statutory_instances (
          id, tenant_id, form_code, state_code, employee_id, location_id,
          period, template_version, status, data, rendered_html,
          document_id, filed_at, acknowledgement_ref
        ) VALUES (
          ${uuid()}, ${tenantId}, 'FORM_F', 'KA', ${emp.employeeId}, ${plantLoc},
          '2026', 1, 'filed', ${JSON.stringify({
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeCode: emp.code,
            joiningDate: emp.joiningDate,
            daysWorked: 240,
            leaveEarned: 18,
            leaveAvailed: 4
          })}::jsonb, ${html},
          ${docId}, now() - interval '15 days', ${`DL-KA-REG-2026-${emp.code}`}
        )
        ON CONFLICT (tenant_id, form_code, state_code, employee_id, period) DO NOTHING
      `;
    }
  }

  // 8. VP Manpower Lines (departmental sanctioned headcount control)
  if (!(await hasData(client, "vp_manpower_lines"))) {
    console.log("  [SEED] vp_manpower_lines is empty. Inserting sanctioned manpower lines.");
    const plantLoc = ctx.locationPlantId || (await client`SELECT id FROM locations WHERE tenant_id = ${tenantId} LIMIT 1`)[0]?.id || null;
    const depts = await client`SELECT id, coalesce(attributes->>'name', 'Department') as name FROM departments WHERE tenant_id = ${tenantId} LIMIT 6`;

    const designationsByDept: Record<string, string[]> = {
      Weaving: ["Master Loom Technician", "Weaving Operator", "Weaving Supervisor"],
      Dyeing: ["Dyeing Specialist", "Dyeing Supervisor", "Batch Controller"],
      Production: ["Production Engineer", "Quality Inspector", "Floor Supervisor"],
      Finance: ["Accounts Executive", "Payroll Specialist", "Finance Controller"],
      "Human Resources": ["HR Generalist", "Recruiter", "Head of HR"]
    };

    for (const d of depts as any[]) {
      const desigs = designationsByDept[d.name] || ["Specialist", "Senior Executive", "Lead"];
      for (const desig of desigs) {
        await client`
          INSERT INTO vp_manpower_lines (
            id, tenant_id, plan_year, department_id, designation,
            location_id, sanctioned_count, status, approved_by_membership_id, approved_at
          ) VALUES (
            ${uuid()}, ${tenantId}, 2026, ${d.id}, ${desig},
            ${plantLoc}, 15, 'approved', ${hrMemId}, '2026-01-10T10:00:00Z'
          )
          ON CONFLICT (tenant_id, plan_year, department_id, designation, location_id) DO NOTHING
        `;
      }
    }
  }

  // 9. VP Feature Records (26-feature extended controls: recognition, referral, announcement, letter, asset, induction)
  if (!(await hasData(client, "vp_feature_records"))) {
    console.log("  [SEED] vp_feature_records is empty. Inserting feature records.");

    // Recognition
    for (const emp of ctx.roster.slice(0, 3)) {
      await client`
        INSERT INTO vp_feature_records (
          id, tenant_id, kind, employee_id, external_key, status, effective_on, data, created_by_membership_id
        ) VALUES (
          ${uuid()}, ${tenantId}, 'recognition', ${emp.employeeId}, ${`REC:${emp.code}:202608`},
          'published', '2026-08-01', ${JSON.stringify({
            programme: "Star Employee of the Month",
            citation: "Outstanding zero-defect weaving production output and adherence to PPE safety protocols.",
            rewardPoints: 5000
          })}::jsonb, ${hrMemId}
        )
        ON CONFLICT (tenant_id, kind, external_key) WHERE external_key IS NOT NULL DO NOTHING
      `;
    }

    // Referral
    const refEmp = ctx.roster[4];
    if (refEmp) {
      await client`
        INSERT INTO vp_feature_records (
          id, tenant_id, kind, employee_id, external_key, status, effective_on, data, created_by_membership_id
        ) VALUES (
          ${uuid()}, ${tenantId}, 'referral', ${refEmp.employeeId}, ${`REF:${refEmp.code}:202607`},
          'payable', '2026-07-15', ${JSON.stringify({
            candidateName: "Kailash Verma",
            referredForPosition: "Senior Weaver",
            awardAmountMinor: 1000000,
            payrollProcessed: true
          })}::jsonb, ${hrMemId}
        )
        ON CONFLICT (tenant_id, kind, external_key) WHERE external_key IS NOT NULL DO NOTHING
      `;
    }

    // Announcements
    await client`
      INSERT INTO vp_feature_records (
        id, tenant_id, kind, external_key, status, effective_on, data, created_by_membership_id
      ) VALUES
        (${uuid()}, ${tenantId}, 'announcement', 'ANN:SAFETY:500DAYS', 'published', '2026-06-01', ${JSON.stringify({
          title: "Plant North Celebrates 500 Days Without Lost Time Injury",
          scope: "all_hands",
          category: "safety"
        })}::jsonb, ${hrMemId}),
        (${uuid()}, ${tenantId}, 'announcement', 'ANN:BONUS:DIWALI2026', 'published', '2026-10-01', ${JSON.stringify({
          title: "Diwali Festive Bonus & Production Incentive Scheme Announced",
          scope: "all_hands",
          category: "rewards"
        })}::jsonb, ${hrMemId})
      ON CONFLICT (tenant_id, kind, external_key) WHERE external_key IS NOT NULL DO NOTHING
    `;

    // Letters
    for (const emp of ctx.roster.slice(0, 3)) {
      await client`
        INSERT INTO vp_feature_records (
          id, tenant_id, kind, employee_id, external_key, status, effective_on, data, created_by_membership_id
        ) VALUES (
          ${uuid()}, ${tenantId}, 'letter', ${emp.employeeId}, ${`LTR:APPOINTMENT:${emp.code}`},
          'issued', ${emp.joiningDate}, ${JSON.stringify({
            letterType: "Appointment Letter",
            referenceNumber: `MK/HR/APP/${emp.code}`,
            designation: emp.designation,
            joiningDate: emp.joiningDate
          })}::jsonb, ${hrMemId}
        )
        ON CONFLICT (tenant_id, kind, external_key) WHERE external_key IS NOT NULL DO NOTHING
      `;
    }

    // Assets
    for (const emp of ctx.roster.slice(0, 4)) {
      await client`
        INSERT INTO vp_feature_records (
          id, tenant_id, kind, employee_id, external_key, status, effective_on, data, created_by_membership_id
        ) VALUES (
          ${uuid()}, ${tenantId}, 'asset', ${emp.employeeId}, ${`AST:SAFETYKIT:${emp.code}`},
          'allocated', ${emp.joiningDate}, ${JSON.stringify({
            assetType: "PPE Industrial Safety Kit",
            serialNumber: `PPE-MK-${emp.code}`,
            allocatedDate: emp.joiningDate,
            condition: "brand_new"
          })}::jsonb, ${hrMemId}
        )
        ON CONFLICT (tenant_id, kind, external_key) WHERE external_key IS NOT NULL DO NOTHING
      `;
    }

    // Induction
    for (const emp of ctx.roster.slice(0, 3)) {
      await client`
        INSERT INTO vp_feature_records (
          id, tenant_id, kind, employee_id, external_key, status, effective_on, data, created_by_membership_id
        ) VALUES (
          ${uuid()}, ${tenantId}, 'induction', ${emp.employeeId}, ${`IND:FACTORYFLOOR:${emp.code}`},
          'completed', ${emp.joiningDate}, ${JSON.stringify({
            programme: "Shopfloor Safety & Machine Operation Induction",
            score: 98,
            certified: true
          })}::jsonb, ${hrMemId}
        )
        ON CONFLICT (tenant_id, kind, external_key) WHERE external_key IS NOT NULL DO NOTHING
      `;
    }

    // Leave maintenance jobs
    await client`
      INSERT INTO vp_feature_records (
        id, tenant_id, kind, external_key, status, effective_on, data, created_by_membership_id
      ) VALUES
        (${uuid()}, ${tenantId}, 'leave_job', 'expiry:2026-08-31', 'completed', '2026-08-31', ${JSON.stringify({
          mode: "expiry",
          asOf: "2026-08-31",
          affected: 12
        })}::jsonb, ${hrMemId}),
        (${uuid()}, ${tenantId}, 'leave_job', 'accrual:2026-08-01', 'completed', '2026-08-01', ${JSON.stringify({
          mode: "accrual",
          asOf: "2026-08-01",
          affected: 68
        })}::jsonb, ${hrMemId})
      ON CONFLICT (tenant_id, kind, external_key) WHERE external_key IS NOT NULL DO NOTHING
    `;
  }

  console.log("✓ Domain 11 (VP Readiness) seeded successfully.");
}
