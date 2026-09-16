import { SeedContext, uuid, hasData } from "./types";

export async function seedDomain04(ctx: SeedContext) {
  const { client, tenantId } = ctx;
  console.log("--> Seeding Domain 04: Attendance, Shifts, Leaves & Overtime...");

  // 1. Shifts & Work Schedules
  if (await hasData(client, "shifts")) {
    console.log("  [CHECK] shifts has data. Fetching existing shifts.");
    const rows = await client`SELECT id FROM shifts WHERE tenant_id = ${tenantId}`;
    ctx.shiftMorningId = rows[0]?.id;
    ctx.shiftEveningId = rows[1]?.id || rows[0]?.id;
  } else {
    console.log("  [SEED] shifts is empty. Inserting shifts.");
    const shiftMorn = uuid();
    const shiftEve = uuid();
    await client`
      INSERT INTO shifts (id, tenant_id, attributes)
      VALUES 
        (${shiftMorn}, ${tenantId}, ${JSON.stringify({ code: "SHIFT-A", name: "Morning Shift", start_time: "08:00", end_time: "16:30", grace_minutes: 15 })}::jsonb),
        (${shiftEve}, ${tenantId}, ${JSON.stringify({ code: "SHIFT-B", name: "General Day Shift", start_time: "09:30", end_time: "18:00", grace_minutes: 15 })}::jsonb)
    `;
    ctx.shiftMorningId = shiftMorn;
    ctx.shiftEveningId = shiftEve;
  }

  if (!(await hasData(client, "work_schedules"))) {
    console.log("  [SEED] work_schedules is empty. Inserting schedule.");
    const schedId = uuid();
    await client`
      INSERT INTO work_schedules (id, tenant_id, attributes)
      VALUES (${schedId}, ${tenantId}, ${JSON.stringify({ name: "6-Day Textile Production Schedule", weekly_off_day: "Sunday", daily_target_hours: 8 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "shift_assignments"))) {
    console.log("  [SEED] shift_assignments is empty. Inserting roster assignments.");
    for (const emp of ctx.roster) {
      const shift = emp.department === "Weaving" || emp.department === "Dyeing" ? ctx.shiftMorningId : ctx.shiftEveningId;
      await client`
        INSERT INTO shift_assignments (id, tenant_id, employee_id, shift_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${shift}, ${JSON.stringify({ effective_from: emp.joiningDate, active: true })}::jsonb)
      `;
    }
  }

  if (!(await hasData(client, "shift_swap_requests"))) {
    console.log("  [SEED] shift_swap_requests is empty. Inserting request.");
    await client`
      INSERT INTO shift_swap_requests (
        id, tenant_id, requester_employee_id, counterparty_employee_id, 
        from_shift_id, to_shift_id, attributes
      )
      VALUES (
        ${uuid()}, ${tenantId}, ${ctx.employeeByCode["MK-107"].employeeId}, ${ctx.employeeByCode["MK-111"].employeeId},
        ${ctx.shiftMorningId}, ${ctx.shiftEveningId}, ${JSON.stringify({ swap_date: "2026-08-20", reason: "Family emergency", status: "approved" })}::jsonb
      )
    `;
  }

  // 2. Attendance Policies & Policy Assignments
  if (await hasData(client, "attendance_policies")) {
    const rows = await client`SELECT id FROM attendance_policies WHERE tenant_id = ${tenantId} LIMIT 1`;
    ctx.attendancePolicyId = rows[0]?.id;
  } else {
    console.log("  [SEED] attendance_policies is empty. Inserting policy.");
    const attPolicyId = uuid();
    await client`
      INSERT INTO attendance_policies (id, tenant_id, attributes)
      VALUES (${attPolicyId}, ${tenantId}, ${JSON.stringify({ code: "POL-ATT-2024", name: "Standard Attendance & Punctuality Policy", half_day_threshold_minutes: 240, full_day_threshold_minutes: 480 })}::jsonb)
    `;
    ctx.attendancePolicyId = attPolicyId;
  }

  if (!(await hasData(client, "attendance_policy_assignments"))) {
    console.log("  [SEED] attendance_policy_assignments is empty. Inserting assignments.");
    for (const emp of ctx.roster) {
      await client`
        INSERT INTO attendance_policy_assignments (id, tenant_id, attendance_policy_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${ctx.attendancePolicyId}, ${emp.employeeId}, ${JSON.stringify({ assigned_from: emp.joiningDate })}::jsonb)
      `;
    }
  }

  // 3. Attendance Sources & Biometric Devices
  let sourceId = "";
  if (await hasData(client, "attendance_sources")) {
    const rows = await client`SELECT id FROM attendance_sources WHERE tenant_id = ${tenantId} LIMIT 1`;
    sourceId = rows[0]?.id;
  } else {
    console.log("  [SEED] attendance_sources is empty. Inserting source.");
    sourceId = uuid();
    await client`
      INSERT INTO attendance_sources (id, tenant_id, attributes)
      VALUES (${sourceId}, ${tenantId}, ${JSON.stringify({ code: "BIO-ZKTECO", name: "Plant North Turnstile Biometrics", protocol: "tcp_ip" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "biometric_devices"))) {
    console.log("  [SEED] biometric_devices is empty. Inserting device.");
    await client`
      INSERT INTO biometric_devices (id, tenant_id, attendance_source_id, location_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${sourceId}, ${ctx.locationPlantId}, ${JSON.stringify({ serial_number: "ZK-PLANT-001", ip_address: "192.168.10.50", model: "ZKTeco ProFace X" })}::jsonb)
    `;
  }

  // 4. Overtime Policies & Gate Pass Policies
  let otPolicyId = "";
  if (await hasData(client, "overtime_policies")) {
    const rows = await client`SELECT id FROM overtime_policies WHERE tenant_id = ${tenantId} LIMIT 1`;
    otPolicyId = rows[0]?.id;
  } else {
    otPolicyId = uuid();
    await client`
      INSERT INTO overtime_policies (id, tenant_id, attributes)
      VALUES (${otPolicyId}, ${tenantId}, ${JSON.stringify({ code: "OT-2X", name: "Double Rate Statutory Overtime", rate_multiplier: 2.0, min_threshold_minutes: 60 })}::jsonb)
    `;
  }

  let gpPolicyId = "";
  if (await hasData(client, "gate_pass_policies")) {
    const rows = await client`SELECT id FROM gate_pass_policies WHERE tenant_id = ${tenantId} LIMIT 1`;
    gpPolicyId = rows[0]?.id;
  } else {
    gpPolicyId = uuid();
    await client`
      INSERT INTO gate_pass_policies (id, tenant_id, attributes)
      VALUES (${gpPolicyId}, ${tenantId}, ${JSON.stringify({ code: "GP-OFFICIAL", name: "Official Gate Pass Rules", max_monthly_passes: 4 })}::jsonb)
    `;
  }

  if (!(await hasData(client, "gate_passes"))) {
    console.log("  [SEED] gate_passes is empty. Inserting gate pass records.");
    for (const empCode of ["MK-107", "MK-111"]) {
      const emp = ctx.employeeByCode[empCode];
      await client`
        INSERT INTO gate_passes (id, tenant_id, employee_id, gate_pass_policy_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${gpPolicyId}, ${JSON.stringify({ pass_date: "2026-07-15", pass_type: "official", hours: 2, reason: "Material testing lab sample delivery" })}::jsonb)
      `;
    }
  }

  // 5. Holiday Calendars & Holidays
  let holCalId = "";
  if (await hasData(client, "holiday_calendars")) {
    const rows = await client`SELECT id FROM holiday_calendars WHERE tenant_id = ${tenantId} LIMIT 1`;
    holCalId = rows[0]?.id;
  } else {
    holCalId = uuid();
    await client`
      INSERT INTO holiday_calendars (id, tenant_id, jurisdiction_id, attributes)
      VALUES (${holCalId}, ${tenantId}, ${ctx.jurisdictionId}, ${JSON.stringify({ name: "Maharashtra Commercial Establishment Calendar" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "holidays"))) {
    console.log("  [SEED] holidays is empty. Inserting holidays.");
    const holidays = [
      { date: "2024-05-01", name: "Maharashtra Day / Labour Day" },
      { date: "2024-08-15", name: "Independence Day 2024" },
      { date: "2024-10-02", name: "Gandhi Jayanti 2024" },
      { date: "2024-11-01", name: "Diwali 2024" },
      { date: "2025-01-26", name: "Republic Day 2025" },
      { date: "2025-08-15", name: "Independence Day 2025" },
      { date: "2025-10-20", name: "Diwali 2025" },
      { date: "2026-01-26", name: "Republic Day 2026" },
      { date: "2026-05-01", name: "Maharashtra Day 2026" },
      { date: "2026-08-15", name: "Independence Day 2026" }
    ];
    for (const h of holidays) {
      await client`
        INSERT INTO holidays (id, tenant_id, holiday_calendar_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${holCalId}, ${JSON.stringify({ holiday_date: h.date, name: h.name, is_mandatory: true })}::jsonb)
      `;
    }
  }

  // 6. Leave Types, Policies & Accrual Rules
  const leaveTypes = [
    { code: "CL", name: "Casual Leave", annual: 12 },
    { code: "SL", name: "Sick Leave", annual: 12 },
    { code: "EL", name: "Earned / Privilege Leave", annual: 18 },
    { code: "COFF", name: "Compensatory Off", annual: 6 }
  ];
  for (const lt of leaveTypes) {
    const existing = await client`SELECT id FROM leave_types WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${lt.code} LIMIT 1`;
    let ltId = existing[0]?.id;
    if (!ltId) {
      ltId = uuid();
      await client`
        INSERT INTO leave_types (id, tenant_id, attributes)
        VALUES (${ltId}, ${tenantId}, ${JSON.stringify({ code: lt.code, name: lt.name, paid: true, annual_allocation: lt.annual })}::jsonb)
      `;
    }
    ctx.leaveTypeIds[lt.code] = ltId;
  }

  let leavePolId = "";
  if (await hasData(client, "leave_policies")) {
    const rows = await client`SELECT id FROM leave_policies WHERE tenant_id = ${tenantId} LIMIT 1`;
    leavePolId = rows[0]?.id;
  } else {
    leavePolId = uuid();
    await client`
      INSERT INTO leave_policies (id, tenant_id, attributes)
      VALUES (${leavePolId}, ${tenantId}, ${JSON.stringify({ code: "POL-LEAVE-GEN", name: "Standard Company Leave Policy 2024-2026", max_carry_forward_days: 30 })}::jsonb)
    `;
  }
  ctx.leavePolicyId = leavePolId;

  if (!(await hasData(client, "accrual_rules"))) {
    console.log("  [SEED] accrual_rules is empty. Inserting accrual rules.");
    for (const [, ltId] of Object.entries(ctx.leaveTypeIds)) {
      await client`
        INSERT INTO accrual_rules (id, tenant_id, leave_policy_id, leave_type_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${leavePolId}, ${ltId}, ${JSON.stringify({ frequency: "monthly", rate_per_month: 1.5, credit_day_of_month: 1 })}::jsonb)
      `;
    }
  }

  if (!(await hasData(client, "leave_policy_assignments"))) {
    console.log("  [SEED] leave_policy_assignments is empty. Inserting assignments.");
    for (const emp of ctx.roster) {
      await client`
        INSERT INTO leave_policy_assignments (id, tenant_id, leave_policy_id, employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${leavePolId}, ${emp.employeeId}, ${JSON.stringify({ assigned_on: emp.joiningDate })}::jsonb)
      `;
    }
  }

  // 7. Attendance Events, Sessions, Breaks, Entries, Exceptions, Regularizations, Overtime
  if (!(await hasData(client, "attendance_entries"))) {
    console.log("  [SEED] attendance_entries is empty. Inserting daily logs across 2024-2026.");
    const dates = [
      "2024-07-10", "2024-08-12", "2024-10-15", "2024-11-20",
      "2025-02-10", "2025-05-14", "2025-08-20", "2025-11-10",
      "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05",
      "2026-09-08", "2026-09-09", "2026-09-10"
    ];

    for (const date of dates) {
      for (const emp of ctx.roster.slice(0, 8)) {
        if (emp.joiningDate > date) continue;

        // Event
        const eventInId = uuid();
        await client`
          INSERT INTO attendance_events (id, tenant_id, attendance_source_id, employee_id, attributes)
          VALUES (${eventInId}, ${tenantId}, ${sourceId}, ${emp.employeeId}, ${JSON.stringify({ event_type: "check_in", recorded_at: `${date}T08:02:00+05:30` })}::jsonb)
        `;

        // Session
        const sessId = uuid();
        await client`
          INSERT INTO attendance_sessions (id, tenant_id, employee_id, in_event_id, attributes)
          VALUES (${sessId}, ${tenantId}, ${emp.employeeId}, ${eventInId}, ${JSON.stringify({ session_date: date, duration_minutes: 510, status: "completed" })}::jsonb)
        `;

        // Break
        await client`
          INSERT INTO attendance_breaks (id, tenant_id, attendance_session_id, attributes)
          VALUES (${uuid()}, ${tenantId}, ${sessId}, ${JSON.stringify({ break_type: "lunch", start_time: "13:00", end_time: "13:45", duration_minutes: 45 })}::jsonb)
        `;

        // Entry
        const entryId = uuid();
        await client`
          INSERT INTO attendance_entries (id, tenant_id, attendance_policy_id, employee_id, attributes)
          VALUES (${entryId}, ${tenantId}, ${ctx.attendancePolicyId}, ${emp.employeeId}, ${JSON.stringify({ work_date: date, status: "present", productive_minutes: 465, overtime_minutes: 30 })}::jsonb)
        `;

        // Overtime Entry
        if (date.endsWith("10")) {
          await client`
            INSERT INTO overtime_entries (id, tenant_id, attendance_entry_id, employee_id, overtime_policy_id, attributes)
            VALUES (${uuid()}, ${tenantId}, ${entryId}, ${emp.employeeId}, ${otPolicyId}, ${JSON.stringify({ ot_hours: 1.5, multiplier: 2.0, status: "approved" })}::jsonb)
          `;
        }

        // Legacy compatibility tables: attendance_days & attendance_punches
        const dayId = uuid();
        await client`
          INSERT INTO attendance_days (
            id, tenant_id, employee_id, attendance_date, assigned_shift,
            gross_span_minutes, productive_minutes, break_minutes, credited_gate_pass_minutes,
            payable_ot_minutes, status
          )
          VALUES (
            ${dayId}, ${tenantId}, ${emp.employeeId}, ${date}, 'A', 540, 465, 45, 0, 0, 'present'
          )
          ON CONFLICT (tenant_id, employee_id, attendance_date) DO NOTHING
        `;
        await client`
          INSERT INTO attendance_punches (id, tenant_id, attendance_day_id, punched_at, type, source)
          VALUES (${uuid()}, ${tenantId}, ${dayId}, ${`${date}T08:02:00+05:30`}, 'in', 'biometric')
        `;
      }
    }
  }

  // Attendance Exceptions & Regularizations
  if (!(await hasData(client, "attendance_exceptions"))) {
    console.log("  [SEED] attendance_exceptions is empty. Inserting exceptions.");
    const excEmp = ctx.employeeByCode["MK-107"];
    const [attEntry] = await client`SELECT id FROM attendance_entries WHERE tenant_id = ${tenantId} AND employee_id = ${excEmp.employeeId} LIMIT 1`;
    await client`
      INSERT INTO attendance_exceptions (id, tenant_id, employee_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${excEmp.employeeId}, ${JSON.stringify({ exception_type: "missed_punch_out", date: "2026-09-04", status: "regularized" })}::jsonb)
    `;

    if (attEntry) {
      await client`
        INSERT INTO attendance_regularizations (id, tenant_id, attendance_entry_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${attEntry.id}, ${JSON.stringify({ requested_correction: "punch_out_17:00", reason: "Turnstile sensor network glitch", status: "approved" })}::jsonb)
      `;
    }
  }

  // 8. Leave Requests, Days, Balances, Approvals, Ledger Entries, Encashments & Comp-Off
  if (!(await hasData(client, "leave_requests"))) {
    console.log("  [SEED] leave_requests is empty. Inserting requests across 2024-2026.");
    for (const emp of ctx.roster) {
      // Opening balances
      for (const [code] of Object.entries(ctx.leaveTypeIds)) {
        await client`
          INSERT INTO leave_balances (tenant_id, employee_id, leave_type, balance, as_of_date)
          VALUES (${tenantId}, ${emp.employeeId}, ${code}, ${code === 'EL' ? 18 : 12}, '2024-04-01')
          ON CONFLICT (tenant_id, employee_id, leave_type) DO UPDATE SET balance = EXCLUDED.balance
        `;
      }

      // 2024 leave
      const req24Id = uuid();
      await client`
        INSERT INTO leave_requests (id, tenant_id, employee_id, leave_type, starts_on, ends_on, requested_days, status, reason, leave_type_id)
        VALUES (${req24Id}, ${tenantId}, ${emp.employeeId}, 'CL', '2024-08-20', '2024-08-21', 2, 'approved', 'Family celebration', ${ctx.leaveTypeIds['CL']})
      `;
      await client`
        INSERT INTO leave_request_days (id, tenant_id, leave_request_id, attributes)
        VALUES 
          (${uuid()}, ${tenantId}, ${req24Id}, ${JSON.stringify({ date: "2024-08-20", is_half_day: false })}::jsonb),
          (${uuid()}, ${tenantId}, ${req24Id}, ${JSON.stringify({ date: "2024-08-21", is_half_day: false })}::jsonb)
      `;
      await client`
        INSERT INTO leave_ledger_entries (id, tenant_id, employee_id, leave_type_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${ctx.leaveTypeIds['CL']}, ${JSON.stringify({ transaction_type: "debit", days: 2, balance_after: 10, effective_date: "2024-08-21" })}::jsonb)
      `;
      await client`
        INSERT INTO leave_approvals (id, tenant_id, leave_request_id, level, status)
        VALUES (${uuid()}, ${tenantId}, ${req24Id}, 1, 'approved')
      `;

      // 2025 leave
      const req25Id = uuid();
      await client`
        INSERT INTO leave_requests (id, tenant_id, employee_id, leave_type, starts_on, ends_on, requested_days, status, reason, leave_type_id)
        VALUES (${req25Id}, ${tenantId}, ${emp.employeeId}, 'EL', '2025-05-15', '2025-05-19', 5, 'approved', 'Annual family trip', ${ctx.leaveTypeIds['EL']})
      `;
      await client`
        INSERT INTO leave_request_days (id, tenant_id, leave_request_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${req25Id}, ${JSON.stringify({ date: "2025-05-15", is_half_day: false })}::jsonb)
      `;
      await client`
        INSERT INTO leave_ledger_entries (id, tenant_id, employee_id, leave_type_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${emp.employeeId}, ${ctx.leaveTypeIds['EL']}, ${JSON.stringify({ transaction_type: "debit", days: 5, balance_after: 13, effective_date: "2025-05-19" })}::jsonb)
      `;
      await client`
        INSERT INTO leave_approvals (id, tenant_id, leave_request_id, level, status)
        VALUES (${uuid()}, ${tenantId}, ${req25Id}, 1, 'approved')
      `;
    }

    // 2026 pending leave request
    const pendingEmp = ctx.employeeByCode["MK-109"];
    const req26Id = uuid();
    await client`
      INSERT INTO leave_requests (id, tenant_id, employee_id, leave_type, starts_on, ends_on, requested_days, status, reason, leave_type_id)
      VALUES (${req26Id}, ${tenantId}, ${pendingEmp.employeeId}, 'SL', '2026-09-14', '2026-09-15', 2, 'pending_l1', 'Medical recovery', ${ctx.leaveTypeIds['SL']})
    `;
    await client`
      INSERT INTO leave_approvals (id, tenant_id, leave_request_id, level, status)
      VALUES (${uuid()}, ${tenantId}, ${req26Id}, 1, 'pending')
    `;
  }

  // Encashments & Comp-Off Grants
  if (!(await hasData(client, "leave_encashments"))) {
    console.log("  [SEED] leave_encashments is empty. Inserting record.");
    await client`
      INSERT INTO leave_encashments (id, tenant_id, employee_id, leave_type_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${ctx.employeeByCode["MK-103"].employeeId}, ${ctx.leaveTypeIds["EL"]}, ${JSON.stringify({ days_encashed: 10, amount_minor: 2800000, payout_month: "2025-12" })}::jsonb)
    `;
  }

  if (!(await hasData(client, "comp_off_grants"))) {
    console.log("  [SEED] comp_off_grants is empty. Inserting grant.");
    await client`
      INSERT INTO comp_off_grants (id, tenant_id, employee_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${ctx.employeeByCode["MK-104"].employeeId}, ${JSON.stringify({ worked_on: "2026-05-01", grant_days: 1, expires_on: "2026-11-01", status: "approved" })}::jsonb)
    `;
  }

  console.log("✓ Domain 04 seeded successfully.");
}
