import { SeedContext, uuid } from "./types";
import { readSheetData } from "./load-excel-dataset";

/** Rupees (as given in the workbook) to minor units (paise), matching the `_minor`
 * convention used throughout src/server/payroll. */
function toMinor(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function normKey(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Chronological sort key for an "HH:MM" punch time. A time before 04:00 is
 * treated as the tail end of a session that crossed midnight (RL-01: the
 * session belongs to the date of the first IN, so a same-date OUT stamped
 * "03:20" is actually the LAST event of the day, not the first).
 */
function chronoKey(time: string | null | undefined): number {
  if (!time) return Number.POSITIVE_INFINITY;
  const [h, m] = time.split(":").map((part) => Number(part));
  const hour = Number.isFinite(h) ? (h < 4 ? h + 24 : h) : 0;
  return hour * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Loads the nine v1.1 transactional sheets (46, 49, 50, 51, 52, 55, 56, 57, 58)
 * into tables that already exist in the schema. Every write is an existing
 * typed column or an existing `attributes jsonb` column — no table or column is
 * created here. Runs after the original 37-sheet load and after the config
 * loader (excel-v11-config.ts, sheet 45 etc.) — but does not require either to
 * have completed; anything it cannot resolve yet (a vendor not seeded, a run
 * whose run_code hasn't landed) is skipped with a console.warn rather than
 * guessed at, so a later full rerun picks it up.
 */
export async function loadExcelV11PayrollAttendance(ctx: SeedContext): Promise<void> {
  const { client, tenantId } = ctx;
  console.log("\n========================================================");
  console.log("== LOADING EXCEL v1.1 PAYROLL & ATTENDANCE TRANSACTIONAL SHEETS ==");
  console.log("========================================================\n");

  await client`SELECT set_config('app.platform_admin', 'true', false)`;

  // ---------------------------------------------------------------
  // Shared caches / resolvers
  // ---------------------------------------------------------------

  const employeeIdByCode: Record<string, string> = {};
  for (const r of (await client`SELECT id, employee_code FROM employees WHERE tenant_id = ${tenantId}`) as Array<{ id: string; employee_code: string }>) {
    employeeIdByCode[r.employee_code] = r.id;
  }

  const legalEntityIdByCode: Record<string, string> = {};
  for (const r of (await client`SELECT id, code FROM legal_entities WHERE tenant_id = ${tenantId}`) as Array<{ id: string; code: string }>) {
    legalEntityIdByCode[r.code] = r.id;
  }

  const shiftIdByCode: Record<string, string> = {};
  for (const r of (await client`SELECT id, attributes->>'code' as code FROM shifts WHERE tenant_id = ${tenantId}`) as Array<{ id: string; code: string | null }>) {
    if (r.code) shiftIdByCode[r.code] = r.id;
  }

  // Pay components: this tenant carries two overlapping catalogs (an
  // upper-case one from the original 13_Salary_Structure loader and a richer
  // lower-case one from the base payroll-engine seed). Match against both by
  // normalized code/name rather than assume either is "the" catalog.
  const payComponentRows = (await client`SELECT id, attributes FROM pay_components WHERE tenant_id = ${tenantId}`) as Array<{ id: string; attributes: Record<string, unknown> }>;
  function resolvePayComponent(synonyms: string[]): string | null {
    const candidates = synonyms.map(normKey);
    for (const row of payComponentRows) {
      const code = normKey(row.attributes?.code);
      const name = normKey(row.attributes?.name);
      if ((code && candidates.includes(code)) || (name && candidates.includes(name))) return row.id;
    }
    return null;
  }
  const PAYROLL_COLUMN_SYNONYMS: Array<{ key: string; synonyms: string[] }> = [
    { key: "Basic", synonyms: ["basic"] },
    { key: "DA", synonyms: ["da", "dearnessallowance"] },
    { key: "HRA", synonyms: ["hra", "houserentallowance"] },
    { key: "Conveyance", synonyms: ["conveyance"] },
    { key: "Special allowance", synonyms: ["special", "specialallowance"] },
    { key: "Overtime", synonyms: ["ot", "overtime"] },
    { key: "PF employee", synonyms: ["pf", "providentfund"] },
    { key: "ESI employee", synonyms: ["esi", "employeestateinsurance"] },
    { key: "Professional tax", synonyms: ["pt", "professionaltax"] },
    { key: "TDS", synonyms: ["tds", "taxdeductedatsource"] },
    { key: "Loan recovery", synonyms: ["loanrecovery", "loan"] },
    { key: "Other recovery", synonyms: ["otherrecovery"] },
  ];
  const FNF_COMPONENT_RULES: Array<{ test: RegExp; synonyms: string[] }> = [
    { test: /gratuity/i, synonyms: ["gratuity"] },
    { test: /leave encashment/i, synonyms: ["leaveencashment"] },
    { test: /notice pay/i, synonyms: ["noticepay"] },
    { test: /provident fund/i, synonyms: ["pf", "providentfund"] },
    { test: /professional tax/i, synonyms: ["pt", "professionaltax"] },
    { test: /^tds$/i, synonyms: ["tds", "taxdeductedatsource"] },
    { test: /asset recovery/i, synonyms: ["assetrecovery"] },
  ];
  function resolveFnfComponent(label: string): string | null {
    const rule = FNF_COMPONENT_RULES.find((r) => r.test.test(label));
    if (!rule) return null;
    return resolvePayComponent(rule.synonyms);
  }

  // GL accounts. The already-run sheet-35 loader (and gl.ts's own upsert path)
  // key these by `account_code` in attributes — reuse that exact key so we
  // find, rather than duplicate, accounts sheet 35 already created.
  const glAccountCache: Record<string, string> = {};
  async function resolveOrCreateGlAccount(accountCode: string, accountName: string | null, entityCode: string | null): Promise<string | null> {
    if (glAccountCache[accountCode]) return glAccountCache[accountCode];
    const existing = await client`SELECT id FROM gl_accounts WHERE tenant_id = ${tenantId} AND attributes->>'account_code' = ${accountCode} LIMIT 1`;
    if ((existing as Array<{ id: string }>)[0]) {
      const id = (existing as Array<{ id: string }>)[0].id;
      glAccountCache[accountCode] = id;
      return id;
    }
    const leId = legalEntityIdByCode[entityCode ?? ""] ?? legalEntityIdByCode["LE-01"] ?? ctx.legalEntityId ?? Object.values(legalEntityIdByCode)[0];
    if (!leId) return null;
    const id = uuid();
    await client`
      INSERT INTO gl_accounts (id, tenant_id, legal_entity_id, attributes)
      VALUES (${id}, ${tenantId}, ${leId}, ${JSON.stringify({ account_code: accountCode, account_name: accountName })}::jsonb)
    `;
    glAccountCache[accountCode] = id;
    return id;
  }

  // Payroll runs. The task's premise is that sheet-26's loader now stamps
  // `attributes->>'run_code'` on payroll_runs; as of this run that patch has
  // not yet been applied to the live rows (checked: every payroll_runs row for
  // this tenant currently has run_code = null), so resolution falls back to
  // the loader's own real unique key — (tenant_id, period, scope), exactly the
  // ON CONFLICT target sheet-26's insert uses — computed from 26_payroll_runs.json
  // the same way that loader computes it. Once run_code is actually populated
  // (a later full rerun), the primary lookup below picks it up directly.
  const runMeta: Record<string, { period: string; scope: string }> = {};
  for (const row of readSheetData("26_payroll_runs.json") as Array<Record<string, unknown>>) {
    const code = row["Run ID"] as string | undefined;
    if (!code || !row["Period"]) continue;
    const entity = (row["Entity"] as string) || "LE-01";
    const runType = ((row["Run type"] as string) || "Regular").toLowerCase().replace(/[^a-z0-9]/g, "_");
    runMeta[code] = { period: row["Period"] as string, scope: `${entity}_${runType}` };
  }
  const payrollRunIdByCode: Record<string, string> = {};
  async function resolvePayrollRunId(runCode: string): Promise<string | null> {
    if (payrollRunIdByCode[runCode]) return payrollRunIdByCode[runCode];
    let rows = (await client`SELECT id FROM payroll_runs WHERE tenant_id = ${tenantId} AND attributes->>'run_code' = ${runCode} LIMIT 1`) as Array<{ id: string }>;
    if (!rows[0] && runMeta[runCode]) {
      const { period, scope } = runMeta[runCode];
      rows = (await client`SELECT id FROM payroll_runs WHERE tenant_id = ${tenantId} AND period = ${period} AND scope = ${scope} LIMIT 1`) as Array<{ id: string }>;
    }
    const id = rows[0]?.id ?? null;
    if (id) payrollRunIdByCode[runCode] = id;
    return id;
  }

  // Attendance. `attendance_entry_id` on both attendance_regularizations and
  // attendance_exceptions really points at attendance_entries.id (confirmed by
  // reading day-register.ts's DAY_SELECT and exception-register.ts's day join —
  // both alias attendance_entries as the "day", not attendance_days). Every
  // employee/date in this dataset already has an attendance_entries row from
  // the original sheet-21 load; the create-if-missing path only fires for the
  // rare code/date this dataset touches that sheet 21 did not (E1063).
  let defaultAttendancePolicyId: string | null = ctx.attendancePolicyId || null;
  async function getDefaultAttendancePolicyId(): Promise<string | null> {
    if (defaultAttendancePolicyId) return defaultAttendancePolicyId;
    const rows = (await client`SELECT id FROM attendance_policies WHERE tenant_id = ${tenantId} LIMIT 1`) as Array<{ id: string }>;
    defaultAttendancePolicyId = rows[0]?.id ?? null;
    return defaultAttendancePolicyId;
  }
  async function resolveOrCreateAttendanceEntryId(employeeId: string, date: string): Promise<string | null> {
    const existing = (await client`SELECT id FROM attendance_entries WHERE tenant_id = ${tenantId} AND employee_id = ${employeeId} AND attributes->>'date' = ${date} LIMIT 1`) as Array<{ id: string }>;
    if (existing[0]) return existing[0].id;
    const policyId = await getDefaultAttendancePolicyId();
    if (!policyId) return null;
    const id = uuid();
    await client`
      INSERT INTO attendance_entries (id, tenant_id, attendance_policy_id, employee_id, attributes)
      VALUES (${id}, ${tenantId}, ${policyId}, ${employeeId}, ${JSON.stringify({ date })}::jsonb)
    `;
    return id;
  }
  async function findAttendanceDay(employeeId: string, date: string) {
    const rows = (await client`
      SELECT id, assigned_shift, detected_shift, gross_span_minutes, productive_minutes, break_minutes
      FROM attendance_days
      WHERE tenant_id = ${tenantId} AND employee_id = ${employeeId} AND attendance_date = ${date}::date
      LIMIT 1
    `) as Array<{ id: string; assigned_shift: string | null; detected_shift: string | null; gross_span_minutes: number; productive_minutes: number; break_minutes: number }>;
    return rows[0] ?? null;
  }
  async function fetchDayEvents(employeeId: string, date: string) {
    const rows = (await client`
      SELECT id, attributes->>'direction' as direction, attributes->>'time' as time
      FROM attendance_events
      WHERE tenant_id = ${tenantId} AND employee_id = ${employeeId}
        AND coalesce(attributes->>'attendance_date', attributes->>'punch_date') = ${date}
    `) as Array<{ id: string; direction: string | null; time: string | null }>;
    return rows.sort((a, b) => chronoKey(a.time) - chronoKey(b.time));
  }
  function findEvent(events: Array<{ id: string; direction: string | null; time: string | null }>, direction: string, time: string | null) {
    if (!time) return null;
    return events.find((e) => e.direction === direction && e.time === time) ?? null;
  }

  // Bank accounts + payroll_run_employees are reused by both sheet 55 and sheet 57.
  async function resolveOrCreateBankAccount(employeeId: string, bankName: string | null): Promise<string> {
    const existing = (await client`SELECT id FROM bank_accounts WHERE tenant_id = ${tenantId} AND employee_id = ${employeeId} LIMIT 1`) as Array<{ id: string }>;
    if (existing[0]) return existing[0].id;
    const id = uuid();
    await client`
      INSERT INTO bank_accounts (id, tenant_id, employee_id, attributes)
      VALUES (${id}, ${tenantId}, ${employeeId}, ${JSON.stringify({
        bank_name: bankName,
        account_number: null,
        is_primary: true,
        source: "excel_v11_bank_file_placeholder",
        note: "57_Bank_File is an aggregate summary with no per-employee account numbers. This row exists only to satisfy the disbursement_items foreign key; no account number is invented.",
      })}::jsonb)
    `;
    return id;
  }
  async function resolveOrCreatePayrollRunEmployee(employeeId: string, payrollRunId: string, sourceRow: unknown): Promise<string | null> {
    const existing = (await client`SELECT id FROM payroll_run_employees WHERE tenant_id = ${tenantId} AND payroll_run_id = ${payrollRunId} AND employee_id = ${employeeId} LIMIT 1`) as Array<{ id: string }>;
    if (existing[0]) return existing[0].id;
    let salaryAssignmentId = (
      (await client`SELECT id FROM employee_salary_assignments WHERE tenant_id = ${tenantId} AND employee_id = ${employeeId} AND attributes->>'effective_from' = '2026-04-01' LIMIT 1`) as Array<{ id: string }>
    )[0]?.id;
    if (!salaryAssignmentId) {
      salaryAssignmentId = (
        (await client`SELECT id FROM employee_salary_assignments WHERE tenant_id = ${tenantId} AND employee_id = ${employeeId} ORDER BY created_at ASC LIMIT 1`) as Array<{ id: string }>
      )[0]?.id;
    }
    if (!salaryAssignmentId) return null;
    const id = uuid();
    await client`
      INSERT INTO payroll_run_employees (id, tenant_id, employee_id, payroll_run_id, salary_assignment_id, attributes)
      VALUES (${id}, ${tenantId}, ${employeeId}, ${payrollRunId}, ${salaryAssignmentId}, ${JSON.stringify({ source: "excel_v11_seed", source_row: sourceRow })}::jsonb)
    `;
    return id;
  }

  let payslipDocTypeId = (
    (await client`SELECT id FROM document_types WHERE tenant_id = ${tenantId} AND attributes->>'code' = 'PAYSLIP' LIMIT 1`) as Array<{ id: string }>
  )[0]?.id;
  if (!payslipDocTypeId) {
    payslipDocTypeId = uuid();
    await client`INSERT INTO document_types (id, tenant_id, attributes) VALUES (${payslipDocTypeId}, ${tenantId}, ${JSON.stringify({ code: "PAYSLIP", name: "Payslip" })}::jsonb)`;
  }

  // =================================================================
  // 46. Contractor Invoices -> contractor_invoices (+ contractor_contracts)
  // =================================================================
  console.log("--> Loading 46_Contractor_Invoices...");
  const contractIdByOrg: Record<string, string> = {};
  for (const row of (readSheetData("46_contractor_invoices.json") as Array<Record<string, unknown>>).filter((r) => r["Invoice"] && r["Vendor"])) {
    const vendorCode = row["Vendor"] as string;
    const orgRows = (await client`SELECT id FROM contractor_organizations WHERE tenant_id = ${tenantId} AND attributes->>'code' = ${vendorCode} LIMIT 1`) as Array<{ id: string }>;
    const orgId = orgRows[0]?.id;
    if (!orgId) {
      console.warn(`[SKIP] 46_Contractor_Invoices ${row["Invoice"]}: vendor ${vendorCode} not found in contractor_organizations (sheet 45 / excel-v11-config not loaded yet).`);
      continue;
    }
    let contractId = contractIdByOrg[orgId];
    if (!contractId) {
      const existingContract = (await client`SELECT id FROM contractor_contracts WHERE tenant_id = ${tenantId} AND contractor_organization_id = ${orgId} LIMIT 1`) as Array<{ id: string }>;
      if (existingContract[0]) {
        contractId = existingContract[0].id;
      } else {
        const leId = legalEntityIdByCode["LE-01"] || ctx.legalEntityId || Object.values(legalEntityIdByCode)[0];
        if (!leId) {
          console.warn(`[SKIP] 46_Contractor_Invoices ${row["Invoice"]}: no legal entity resolvable to anchor a contract for vendor ${vendorCode}.`);
          continue;
        }
        contractId = uuid();
        await client`
          INSERT INTO contractor_contracts (id, tenant_id, contractor_organization_id, legal_entity_id, attributes)
          VALUES (${contractId}, ${tenantId}, ${orgId}, ${leId}, ${JSON.stringify({
            code: `AUTO-${vendorCode}`,
            title: `${vendorCode} contract (minimal, auto-created to anchor demo invoices)`,
            source: "excel_v11_seed",
          })}::jsonb)
        `;
      }
      contractIdByOrg[orgId] = contractId;
    }
    const existingInv = (await client`SELECT id FROM contractor_invoices WHERE tenant_id = ${tenantId} AND attributes->>'invoice_number' = ${row["Invoice"]} LIMIT 1`) as Array<{ id: string }>;
    if (existingInv[0]) continue;
    await client`
      INSERT INTO contractor_invoices (id, tenant_id, contractor_contract_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${contractId}, ${JSON.stringify({
        invoice_number: row["Invoice"],
        vendor_code: vendorCode,
        period: row["Period"] ?? null,
        site: row["Site"] ?? null,
        worker_days_claimed: row["Worker days claimed"] ?? null,
        worker_days_from_attendance: row["Worker days from attendance"] ?? null,
        variance_days: row["Variance (days)"] ?? null,
        rate_per_day_minor: toMinor(row["Rate per day"]),
        claimed_amount_minor: toMinor(row["Claimed amount (INR)"]),
        passed_amount_minor: toMinor(row["Passed amount (INR)"]),
        status: row["Status"] ?? null,
        reconciliation_note: row["Reconciliation note"] ?? null,
        demo_point: row["Demo point"] ?? null,
      })}::jsonb)
    `;
  }

  // =================================================================
  // 49. Break Register -> attendance_breaks (+ attendance_sessions if missing)
  // =================================================================
  console.log("--> Loading 49_Break_Register...");
  for (const row of (readSheetData("49_break_register.json") as Array<Record<string, unknown>>).filter((r) => r["Employee code"] && r["Break ID"])) {
    const empCode = row["Employee code"] as string;
    const employeeId = employeeIdByCode[empCode];
    if (!employeeId) {
      console.warn(`[SKIP] 49_Break_Register ${row["Break ID"]}: employee ${empCode} not found.`);
      continue;
    }
    const date = row["Attendance date"] as string;
    const events = await fetchDayEvents(employeeId, date);
    const firstIn = events.find((e) => e.direction === "IN") ?? events[0] ?? null;
    if (!firstIn) {
      console.warn(`[SKIP] 49_Break_Register ${row["Break ID"]}: no punch events found for ${empCode} on ${date} to anchor a session.`);
      continue;
    }
    const lastOut = [...events].reverse().find((e) => e.direction === "OUT") ?? null;

    let sessionId = (
      (await client`SELECT id FROM attendance_sessions WHERE tenant_id = ${tenantId} AND employee_id = ${employeeId} AND attributes->>'session_date' = ${date} LIMIT 1`) as Array<{ id: string }>
    )[0]?.id;
    if (!sessionId) {
      const day = await findAttendanceDay(employeeId, date);
      const shiftCode = day?.detected_shift ?? day?.assigned_shift ?? null;
      sessionId = uuid();
      await client`
        INSERT INTO attendance_sessions (id, tenant_id, employee_id, in_event_id, out_event_id, shift_id, attributes)
        VALUES (${sessionId}, ${tenantId}, ${employeeId}, ${firstIn.id}, ${lastOut?.id ?? null}, ${shiftCode ? shiftIdByCode[shiftCode] ?? null : null}, ${JSON.stringify({
          session_date: date,
          attendance_day_id: day?.id ?? null,
          shift_code: shiftCode,
          first_in: firstIn.time,
          last_out: lastOut?.time ?? null,
          duration_minutes: day?.gross_span_minutes ?? null,
          net_minutes: day?.productive_minutes ?? null,
          break_minutes: day?.break_minutes ?? null,
          status: "completed",
          source: "excel_v11_seed",
        })}::jsonb)
      `;
    }

    const existingBreak = (
      await client`SELECT id FROM attendance_breaks WHERE tenant_id = ${tenantId} AND attendance_session_id = ${sessionId} AND attributes->>'source_break_id' = ${row["Break ID"]} LIMIT 1`
    ) as Array<{ id: string }>;
    if (existingBreak[0]) continue;

    const breakStart = (row["Break start"] as string | null) ?? null;
    const breakEnd = (row["Break end"] as string | null) ?? null;
    const outEv = findEvent(events, "OUT", breakStart);
    const inEv = findEvent(events, "IN", breakEnd);

    await client`
      INSERT INTO attendance_breaks (id, tenant_id, attendance_session_id, out_event_id, in_event_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${sessionId}, ${outEv?.id ?? null}, ${inEv?.id ?? null}, ${JSON.stringify({
        source_break_id: row["Break ID"],
        attendance_date: date,
        employee_id: employeeId,
        break_seq: row["Break seq"] ?? null,
        break_start_time: breakStart,
        break_end_time: breakEnd,
        start_time: breakStart,
        end_time: breakEnd,
        break_start_ts: breakStart ? `${date}T${breakStart}:00+05:30` : null,
        break_end_ts: breakEnd ? `${date}T${breakEnd}:00+05:30` : null,
        duration_minutes: row["Break minutes"] ?? null,
        break_minutes: row["Break minutes"] ?? null,
        break_type: row["Break type"] ?? null,
        deducted: false,
        derived_from: row["Derived from"] ?? null,
        deducted_from_net_hours_raw: row["Deducted from net hours"] ?? null,
        demo_point: row["Demo point"] ?? null,
        time_zone: "Asia/Kolkata",
      })}::jsonb)
    `;
  }

  // =================================================================
  // 50. Attendance Regularisation -> attendance_regularizations
  // =================================================================
  console.log("--> Loading 50_Attendance_Regularisation...");
  const REG_KIND_RULES: Array<{ test: RegExp; kind: string }> = [
    { test: /out punch missed|missing (in|out) punch/i, kind: "missing_punch" },
    { test: /wrong device|reader fault|device fault/i, kind: "device_failure" },
  ];
  for (const row of (readSheetData("50_attendance_regularisation.json") as Array<Record<string, unknown>>).filter((r) => r["Request"] && r["Employee code"])) {
    const empCode = row["Employee code"] as string;
    const employeeId = employeeIdByCode[empCode];
    if (!employeeId) {
      console.warn(`[SKIP] 50_Attendance_Regularisation ${row["Request"]}: employee ${empCode} not found.`);
      continue;
    }
    const existing = (await client`SELECT id FROM attendance_regularizations WHERE tenant_id = ${tenantId} AND attributes->>'source_request_id' = ${row["Request"]} LIMIT 1`) as Array<{ id: string }>;
    if (existing[0]) continue;

    const date = row["Attendance date"] as string;
    const entryId = await resolveOrCreateAttendanceEntryId(employeeId, date);
    if (!entryId) {
      console.warn(`[SKIP] 50_Attendance_Regularisation ${row["Request"]}: could not resolve/create an attendance_entries row (no attendance policy exists yet).`);
      continue;
    }

    const reason = String(row["Reason"] ?? "");
    let kind: string | null = null;
    for (const rule of REG_KIND_RULES) {
      if (rule.test.test(reason)) {
        kind = rule.kind;
        break;
      }
    }
    const approvalStatusRaw = String(row["Approval status"] ?? "");
    const status = /approved/i.test(approvalStatusRaw) ? "approved" : /rejected/i.test(approvalStatusRaw) ? "rejected" : "submitted";

    await client`
      INSERT INTO attendance_regularizations (id, tenant_id, attendance_entry_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${entryId}, ${JSON.stringify({
        source_request_id: row["Request"],
        employee_id: employeeId,
        date,
        kind,
        reason: row["Reason"] ?? null,
        original_status: row["Original status"] ?? null,
        requested_status: row["Requested status"] ?? null,
        evidence: row["Evidence"] ?? null,
        document_ref: row["Evidence"] ?? null,
        current_status: row["Original status"] ?? null,
        raised_on: row["Raised on"] ?? null,
        raised_by: row["Raised by"] ?? null,
        approver: row["Approver"] ?? null,
        status,
        approval_status_raw: approvalStatusRaw,
        effect_once_approved: row["Effect once approved"] ?? null,
        demo_point: row["Demo point"] ?? null,
      })}::jsonb)
    `;
  }

  // =================================================================
  // 51. Attendance Exceptions -> attendance_exceptions
  // =================================================================
  console.log("--> Loading 51_Attendance_Exceptions...");
  for (const row of (readSheetData("51_attendance_exceptions.json") as Array<Record<string, unknown>>).filter((r) => r["Exception"] && r["Employee code"])) {
    const empCode = row["Employee code"] as string;
    const employeeId = employeeIdByCode[empCode];
    if (!employeeId) {
      console.warn(`[SKIP] 51_Attendance_Exceptions ${row["Exception"]}: employee ${empCode} not found.`);
      continue;
    }
    const existing = (await client`SELECT id FROM attendance_exceptions WHERE tenant_id = ${tenantId} AND attributes->>'exception_reference' = ${row["Exception"]} LIMIT 1`) as Array<{ id: string }>;
    if (existing[0]) continue;

    const date = row["Attendance date"] as string;
    const entryId = await resolveOrCreateAttendanceEntryId(employeeId, date);
    const statusRaw = String(row["Status"] ?? "");
    const status = /closed/i.test(statusRaw) ? "resolved" : statusRaw ? statusRaw.toLowerCase() : "open";

    await client`
      INSERT INTO attendance_exceptions (id, tenant_id, attendance_entry_id, employee_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${entryId}, ${employeeId}, ${JSON.stringify({
        exception_reference: row["Exception"],
        employee_id: employeeId,
        date,
        exception_type: row["Exception type"] ?? null,
        kind: row["Exception type"] ?? null,
        detail: row["Detail"] ?? null,
        severity: row["Severity"] ?? null,
        detected_on: row["Detected on"] ?? null,
        resolution_path: row["Resolution path"] ?? null,
        resolved_on: row["Resolved on"] ?? null,
        status,
        status_raw: statusRaw,
        demo_point: row["Demo point"] ?? null,
      })}::jsonb)
    `;
  }

  // =================================================================
  // 52. Shift Roster -> shift_assignments
  // =================================================================
  console.log("--> Loading 52_Shift_Roster...");
  for (const row of (readSheetData("52_shift_roster.json") as Array<Record<string, unknown>>).filter((r) => r["Roster"] && r["Employee code"])) {
    const empCode = row["Employee code"] as string;
    const employeeId = employeeIdByCode[empCode];
    if (!employeeId) {
      console.warn(`[SKIP] 52_Shift_Roster ${row["Roster"]}: employee ${empCode} not found.`);
      continue;
    }
    const shiftCode = row["Rostered shift"] as string;
    const shiftId = shiftIdByCode[shiftCode];
    if (!shiftId) {
      console.warn(`[SKIP] 52_Shift_Roster ${row["Roster"]}: shift ${shiftCode} not found.`);
      continue;
    }
    const existing = (await client`SELECT id FROM shift_assignments WHERE tenant_id = ${tenantId} AND attributes->>'roster' = ${row["Roster"]} LIMIT 1`) as Array<{ id: string }>;
    if (existing[0]) continue;

    await client`
      INSERT INTO shift_assignments (id, tenant_id, employee_id, shift_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${employeeId}, ${shiftId}, ${JSON.stringify({
        active: true,
        effective_from: row["From date"] ?? null,
        roster: row["Roster"],
        org_unit: row["Org unit"] ?? null,
        to_date: row["To date"] ?? null,
        rostered_shift: shiftCode,
        rotation_pattern: row["Rotation pattern"] ?? null,
        published_on: row["Published on"] ?? null,
        published_by: row["Published by"] ?? null,
        overridden_by_detection: row["Overridden by detection"] ?? null,
        demo_point: row["Demo point"] ?? null,
      })}::jsonb)
    `;
  }

  // =================================================================
  // 55. Payroll Register -> payroll_run_employees + payroll_lines + payslips (+ documents)
  // =================================================================
  console.log("--> Loading 55_Payroll_Register...");
  const raw55 = (readSheetData("55_payroll_register.json") as Array<Record<string, unknown>>).filter((r) => r["Run"] && r["Employee code"]);
  const payrollRunEmployeeIdByKey: Record<string, string> = {}; // `${empCode}|${runCode}`

  for (const row of raw55) {
    const empCode = row["Employee code"] as string;
    const runCode = row["Run"] as string;
    const employeeId = employeeIdByCode[empCode];
    if (!employeeId) {
      console.warn(`[SKIP] 55_Payroll_Register ${empCode}/${runCode}: employee not found.`);
      continue;
    }
    const payrollRunId = await resolvePayrollRunId(runCode);
    if (!payrollRunId) {
      console.warn(`[SKIP] 55_Payroll_Register ${empCode}/${runCode}: payroll run ${runCode} not resolvable yet.`);
      continue;
    }
    const preId = await resolveOrCreatePayrollRunEmployee(employeeId, payrollRunId, row);
    if (!preId) {
      console.warn(`[SKIP] 55_Payroll_Register ${empCode}/${runCode}: no employee_salary_assignments row exists for this employee.`);
      continue;
    }
    payrollRunEmployeeIdByKey[`${empCode}|${runCode}`] = preId;

    for (const col of PAYROLL_COLUMN_SYNONYMS) {
      const amount = Number(row[col.key]);
      if (!amount) continue; // zero/absent — nothing to book; the full row is preserved on payroll_run_employees.attributes.source_row regardless
      const componentId = resolvePayComponent(col.synonyms);
      if (!componentId) {
        console.warn(`[SKIP] 55_Payroll_Register ${empCode}/${runCode}: no pay_components row resolves for "${col.key}" — amount ${amount} kept only in source_row, no payroll_lines row written.`);
        continue;
      }
      const existingLine = (await client`SELECT id FROM payroll_lines WHERE tenant_id = ${tenantId} AND payroll_run_employee_id = ${preId} AND pay_component_id = ${componentId} LIMIT 1`) as Array<{ id: string }>;
      if (existingLine[0]) continue;
      await client`
        INSERT INTO payroll_lines (id, tenant_id, pay_component_id, payroll_run_employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${componentId}, ${preId}, ${JSON.stringify({
          source_column: col.key,
          amount_minor: toMinor(amount),
          run_code: runCode,
          employee_code: empCode,
        })}::jsonb)
      `;
    }

    const existingSlip = (await client`SELECT id FROM payslips WHERE tenant_id = ${tenantId} AND payroll_run_employee_id = ${preId} LIMIT 1`) as Array<{ id: string }>;
    if (!existingSlip[0]) {
      const docId = uuid();
      await client`
        INSERT INTO documents (id, tenant_id, employee_id, document_type_id, attributes)
        VALUES (${docId}, ${tenantId}, ${employeeId}, ${payslipDocTypeId}, ${JSON.stringify({
          label: `Payslip ${runCode} — ${empCode}`,
          source: "excel_v11_seed",
        })}::jsonb)
      `;
      await client`
        INSERT INTO payslips (id, tenant_id, document_id, payroll_run_employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${docId}, ${preId}, ${JSON.stringify({
          run_code: runCode,
          employee_code: empCode,
          net_pay_minor: toMinor(row["Net pay"]),
          gross_minor: toMinor(row["Gross"]),
          total_deductions_minor: toMinor(row["Total deductions"]),
          state: "published",
          payroll_group: row["Payroll group"] ?? null,
          work_location: row["Work location"] ?? null,
          what_to_point_out: row["What to point out"] ?? null,
          demo_point: row["Demo point"] ?? null,
        })}::jsonb)
      `;
    }
  }

  // =================================================================
  // 56. GL Journal -> payroll_exports + payroll_export_lines (+ gl_accounts)
  // =================================================================
  console.log("--> Loading 56_GL_Journal...");
  const exportIdByJournal: Record<string, string> = {};
  for (const row of (readSheetData("56_gl_journal.json") as Array<Record<string, unknown>>).filter((r) => r["Journal"] && r["Line"] != null)) {
    const journalCode = row["Journal"] as string;
    const runCode = row["Run"] as string;
    let exportId = exportIdByJournal[journalCode];
    if (!exportId) {
      const existing = (await client`SELECT id FROM payroll_exports WHERE tenant_id = ${tenantId} AND attributes->>'journal_code' = ${journalCode} LIMIT 1`) as Array<{ id: string }>;
      if (existing[0]) {
        exportId = existing[0].id;
      } else {
        const payrollRunId = await resolvePayrollRunId(runCode);
        if (!payrollRunId) {
          console.warn(`[SKIP] 56_GL_Journal ${journalCode}: run ${runCode} not resolvable yet.`);
          continue;
        }
        exportId = uuid();
        await client`
          INSERT INTO payroll_exports (id, tenant_id, payroll_run_id, attributes)
          VALUES (${exportId}, ${tenantId}, ${payrollRunId}, ${JSON.stringify({
            journal_code: journalCode,
            run_code: runCode,
            entity: row["Entity"] ?? null,
            period: row["Period"] ?? null,
          })}::jsonb)
        `;
      }
      exportIdByJournal[journalCode] = exportId;
    }

    const glAccountId = await resolveOrCreateGlAccount(String(row["GL account"]), row["Account name"] as string | null, (row["Entity"] as string) ?? "LE-01");
    if (!glAccountId) {
      console.warn(`[SKIP] 56_GL_Journal ${journalCode} line ${row["Line"]}: could not resolve/create GL account ${row["GL account"]}.`);
      continue;
    }
    const existingLine = (
      await client`SELECT id FROM payroll_export_lines WHERE tenant_id = ${tenantId} AND payroll_export_id = ${exportId} AND attributes->>'line_number' = ${String(row["Line"])} LIMIT 1`
    ) as Array<{ id: string }>;
    if (existingLine[0]) continue;

    await client`
      INSERT INTO payroll_export_lines (id, tenant_id, payroll_export_id, gl_account_id, attributes)
      VALUES (${uuid()}, ${tenantId}, ${exportId}, ${glAccountId}, ${JSON.stringify({
        line_number: row["Line"],
        mapping_id: row["Mapping ID"] ?? null,
        component_head: row["Pay component / head"] ?? null,
        dr_cr: row["Dr / Cr"] ?? null,
        gl_account_code: String(row["GL account"]),
        account_name: row["Account name"] ?? null,
        cost_centre_source: row["Cost centre source"] ?? null,
        debit_minor: toMinor(row["Debit (INR)"]),
        credit_minor: toMinor(row["Credit (INR)"]),
        posting_status: row["Posting status"] ?? null,
        erp_posting_reference: row["ERP posting reference"] ?? null,
        demo_point: row["Demo point"] ?? null,
      })}::jsonb)
    `;
  }

  // =================================================================
  // 58. FnF Settlement -> full_final_settlements + full_final_lines
  // (loaded before 57 so the bank file can reconcile against it)
  // =================================================================
  console.log("--> Loading 58_FnF_Settlement...");
  // Per 26_payroll_runs.json this is the one dedicated Full & final run
  // ("PR-2026-09-03", Employees: 2, demo point 16 — E1042 and E1068).
  const FNF_RUN_CODE = "PR-2026-09-03";
  const settlementIdByCode: Record<string, string> = {};
  const settlementNetMinorByCode: Record<string, number> = {};
  const settlementEmployeeCodeByCode: Record<string, string> = {};

  const raw58 = (readSheetData("58_fnf_settlement.json") as Array<Record<string, unknown>>).filter((r) => r["Settlement"] && r["Employee code"]);
  const settlementGroups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of raw58) {
    const code = row["Settlement"] as string;
    const arr = settlementGroups.get(code) ?? [];
    arr.push(row);
    settlementGroups.set(code, arr);
  }

  for (const [settlementCode, rows] of settlementGroups) {
    const header = rows.find((r) => r["Resigned on"]) ?? rows[0];
    const empCode = header["Employee code"] as string;
    const employeeId = employeeIdByCode[empCode];
    if (!employeeId) {
      console.warn(`[SKIP] 58_FnF_Settlement ${settlementCode}: employee ${empCode} not found.`);
      continue;
    }
    const employmentRows = (await client`SELECT id FROM employments WHERE tenant_id = ${tenantId} AND employee_id = ${employeeId} LIMIT 1`) as Array<{ id: string }>;
    const employmentId = employmentRows[0]?.id;
    if (!employmentId) {
      console.warn(`[SKIP] 58_FnF_Settlement ${settlementCode}: no employments row for ${empCode}.`);
      continue;
    }
    const offboardingCaseId = (
      (await client`SELECT id FROM offboarding_cases WHERE tenant_id = ${tenantId} AND employment_id = ${employmentId} ORDER BY created_at ASC LIMIT 1`) as Array<{ id: string }>
    )[0]?.id ?? null;
    const payrollRunId = await resolvePayrollRunId(FNF_RUN_CODE);

    const netRow = rows.find((r) => r["Type"] === "Net");
    const componentRows = rows.filter((r) => r["Type"] && r["Type"] !== "Net");

    let settlementId = (
      (await client`SELECT id FROM full_final_settlements WHERE tenant_id = ${tenantId} AND attributes->>'settlement_code' = ${settlementCode} LIMIT 1`) as Array<{ id: string }>
    )[0]?.id;
    if (!settlementId) {
      settlementId = uuid();
      await client`
        INSERT INTO full_final_settlements (id, tenant_id, employment_id, offboarding_case_id, payroll_run_id, attributes)
        VALUES (${settlementId}, ${tenantId}, ${employmentId}, ${offboardingCaseId}, ${payrollRunId}, ${JSON.stringify({
          settlement_code: settlementCode,
          employee_code: empCode,
          name: header["Name"] ?? null,
          resigned_on: header["Resigned on"] ?? null,
          last_working_day: header["Last working day"] ?? null,
          notice_required_days: header["Notice required"] ?? null,
          notice_served_days: header["Notice served"] ?? null,
          completed_years_of_service: header["Completed years of service"] ?? null,
          no_dues_status: header["No dues status"] ?? null,
          net_payable_minor: toMinor(netRow?.["Amount (INR)"]),
          net_basis: netRow?.["Basis"] ?? null,
          run_code: FNF_RUN_CODE,
          components: componentRows.map((r) => ({
            component: r["Component"],
            type: r["Type"],
            amount_minor: toMinor(r["Amount (INR)"]),
            basis: r["Basis"] ?? null,
            demo_point: r["Demo point"] ?? null,
          })),
          demo_point: netRow?.["Demo point"] ?? null,
        })}::jsonb)
      `;
    }
    settlementIdByCode[settlementCode] = settlementId;
    settlementNetMinorByCode[settlementCode] = toMinor(netRow?.["Amount (INR)"]);
    settlementEmployeeCodeByCode[settlementCode] = empCode;

    for (const row of componentRows) {
      const label = (row["Component"] as string) ?? "";
      const componentId = resolveFnfComponent(label);
      if (!componentId) {
        console.warn(`[SKIP] 58_FnF_Settlement ${settlementCode}: no pay_components row resolves for "${label}" — kept in full_final_settlements.attributes.components only, no full_final_lines row written.`);
        continue;
      }
      const existingLine = (
        await client`SELECT id FROM full_final_lines WHERE tenant_id = ${tenantId} AND full_final_settlement_id = ${settlementId} AND pay_component_id = ${componentId} LIMIT 1`
      ) as Array<{ id: string }>;
      if (existingLine[0]) continue;
      await client`
        INSERT INTO full_final_lines (id, tenant_id, full_final_settlement_id, pay_component_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${settlementId}, ${componentId}, ${JSON.stringify({
          component_label: label,
          type: row["Type"],
          amount_minor: toMinor(row["Amount (INR)"]),
          basis: row["Basis"] ?? null,
          demo_point: row["Demo point"] ?? null,
        })}::jsonb)
      `;
    }
  }

  // =================================================================
  // 57. Bank File -> disbursement_batches + disbursement_items (+ bank_accounts)
  // =================================================================
  console.log("--> Loading 57_Bank_File...");
  for (const row of (readSheetData("57_bank_file.json") as Array<Record<string, unknown>>).filter((r) => r["File"] && r["Run"])) {
    const fileCode = row["File"] as string;
    const runCode = row["Run"] as string;
    const payrollRunId = await resolvePayrollRunId(runCode);
    if (!payrollRunId) {
      console.warn(`[SKIP] 57_Bank_File ${fileCode}: run ${runCode} not resolvable yet.`);
      continue;
    }

    const existingBatch = (await client`SELECT id FROM disbursement_batches WHERE tenant_id = ${tenantId} AND attributes->>'file_code' = ${fileCode} LIMIT 1`) as Array<{ id: string }>;
    let batchRowId = existingBatch[0]?.id;
    if (!batchRowId) {
      batchRowId = uuid();
      await client`
        INSERT INTO disbursement_batches (id, tenant_id, payroll_run_id, attributes)
        VALUES (${batchRowId}, ${tenantId}, ${payrollRunId}, ${JSON.stringify({
          file_code: fileCode,
          run_code: runCode,
          entity: row["Entity"] ?? null,
          bank: row["Bank"] ?? null,
          format: row["Format"] ?? null,
          value_date: row["Value date"] ?? null,
          records_claimed: row["Records"] ?? null,
          total_amount_claimed_minor: toMinor(row["Total amount (INR)"]),
          status: row["Status"] ?? null,
          reconciles_to: row["Reconciles to"] ?? null,
          variance: row["Variance"] ?? null,
          demo_point: row["Demo point"] ?? null,
        })}::jsonb)
      `;
    }

    // Only source per-employee items from data we actually have for this exact
    // run: sheet 55's net pay for a regular/off-cycle run, or E1068's settlement
    // for the Full & final run (E1042 is explicitly excluded by the sheet's own
    // note — his settlement is held, not released).
    let sourceEmployees: Array<{ empCode: string; netMinor: number; settlementCode?: string }> = [];
    if (runCode === FNF_RUN_CODE) {
      const entry = Object.entries(settlementEmployeeCodeByCode).find(([, code]) => code === "E1068");
      if (entry) sourceEmployees = [{ empCode: "E1068", netMinor: settlementNetMinorByCode[entry[0]], settlementCode: entry[0] }];
    } else {
      sourceEmployees = raw55.filter((r) => r["Run"] === runCode).map((r) => ({ empCode: r["Employee code"] as string, netMinor: toMinor(r["Net pay"]) }));
    }

    for (const src of sourceEmployees) {
      const employeeId = employeeIdByCode[src.empCode];
      if (!employeeId) continue;
      const existingItem = (await client`SELECT id FROM disbursement_items WHERE tenant_id = ${tenantId} AND disbursement_batch_id = ${batchRowId} AND employee_id = ${employeeId} LIMIT 1`) as Array<{ id: string }>;
      if (existingItem[0]) continue;
      const bankAccountId = await resolveOrCreateBankAccount(employeeId, row["Bank"] as string | null);
      const preId = payrollRunEmployeeIdByKey[`${src.empCode}|${runCode}`] ?? null;
      const settlementId = src.settlementCode ? settlementIdByCode[src.settlementCode] ?? null : null;
      await client`
        INSERT INTO disbursement_items (id, tenant_id, bank_account_id, disbursement_batch_id, employee_id, full_final_settlement_id, payroll_run_employee_id, attributes)
        VALUES (${uuid()}, ${tenantId}, ${bankAccountId}, ${batchRowId}, ${employeeId}, ${settlementId}, ${preId}, ${JSON.stringify({
          employee_code: src.empCode,
          amount_minor: src.netMinor,
          file_code: fileCode,
          run_code: runCode,
          source: "excel_v11_seed",
        })}::jsonb)
      `;
    }

    if (sourceEmployees.length === 0) {
      console.log(
        `[NOTE] 57_Bank_File ${fileCode} (run ${runCode}): the sheet claims ${row["Records"]} records totalling INR ${row["Total amount (INR)"]}, but no per-employee net-pay source exists in the loaded sheets for this run — batch header written, 0 disbursement_items created (nothing fabricated to fill the gap).`,
      );
    }
  }

  console.log("\n✓ EXCEL v1.1 PAYROLL & ATTENDANCE TRANSACTIONAL SHEETS LOADED\n");
}
