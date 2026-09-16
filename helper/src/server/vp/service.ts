import "server-only";
import { commandPermissions } from "@/lib/command-permissions";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { punchClockToMinutes } from "@/lib/hr-rules";
import { loadAttendancePolicy, nightExtensionForShift, requireNightExtensionRule } from "@/server/attendance/attendance-policy";
import { listShiftMaster, resolveShift } from "@/server/attendance/shift-master";
import {
  allocateFormSerial, assertTemplateCoverage, confirmFormSerial, deriveStatutoryFormValues,
  SERIALISED_FORM_CODES, SERIAL_MERGE_FIELD, templateNotApprovedError, voidFormSerial,
  type StatutoryFormCode,
} from "@/server/compliance/statutory-forms";
import { abandonErpRecord, retryErpRecord, syncErpEmployee as applyErpEmployeeSync } from "@/server/integrations/erp-sync";
import { runLeaveAccrual } from "@/server/leave/accrual";
import { runCoffLapse } from "@/server/leave/coff";
import { runLeaveYearEnd } from "@/server/leave/year-end";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { clockMinute, computeVpAttendance, renderMergeTemplate, VP_FEATURES } from "./policy";

const configValue = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.string(), z.unknown())]);
const configRecord = z.record(z.string(), configValue);
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const vpCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_rule_set"), domain: z.enum(["attendance", "worker", "leave", "statutory", "announcement", "letter"]), code: z.string().min(1).max(80), effectiveFrom: dateText, config: configRecord }),
  z.object({ action: z.literal("grant_location"), membershipId: z.string().uuid(), locationId: z.string().uuid(), canViewCompensation: z.boolean().default(false), validFrom: dateText }),
  z.object({
    action: z.literal("evaluate_attendance"), attendanceDayId: z.string().uuid(), employeeId: z.string().uuid(), attendanceDate: dateText,
    ruleSetId: z.string().uuid(), assignedShift: z.string().min(1).max(20), shiftHours: z.union([z.literal(8), z.literal(9), z.literal(10), z.literal(12)]),
    // RL-19 puts the detection window on the shift master, so a window posted here
    // is accepted for compatibility and ignored: the shift records decide.
    windows: z.array(z.object({ code: z.string(), earliestMinute: z.number().int().min(0).max(1439), latestMinute: z.number().int().min(0).max(1439), durationMinutes: z.number().int().positive() })).optional(),
    punches: z.array(z.object({ type: z.enum(["in", "out"]), at: z.string() })).min(2), firstPunchIso: z.string().datetime({ offset: true }),
    gatePassMinutes: z.number().int().nonnegative().default(0), otPolicy: z.enum(["all-days", "rest-holiday-only", "not-eligible"]),
    dayType: z.enum(["working", "weekly_off", "holiday", "festival"]), minutesLate: z.number().int().nonnegative().default(0), lateOccurrencesThisMonth: z.number().int().nonnegative().default(0),
    assistantManagerOrAbove: z.boolean().default(false), workedPast3AmPreviousDay: z.boolean().default(false), timeZone: z.string().default("Asia/Kolkata"),
  }),
  z.object({ action: z.literal("run_leave_maintenance"), mode: z.enum(["accrual", "expiry", "year_end"]), asOf: dateText }),
  z.object({ action: z.literal("sync_erp_employee"), connectionId: z.string().uuid().optional(), externalCode: z.string().min(1).max(80), employee: z.object({ firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80), workEmail: z.string().email().optional(), department: z.string().min(1).max(80), location: z.string().min(1).max(80), designation: z.string().min(1).max(120), joiningDate: dateText, basicSalaryMinor: z.number().int().nonnegative().optional() }) }),
  z.object({ action: z.literal("retry_erp_record"), recordId: z.string().uuid() }),
  z.object({ action: z.literal("abandon_erp_record"), recordId: z.string().uuid(), reason: z.string().trim().min(10).max(500) }),
  z.object({ action: z.literal("create_gl_posting"), payrollRunId: z.string().uuid(), connectionId: z.string().uuid().optional() }),
  z.object({ action: z.literal("ack_gl_posting"), batchId: z.string().uuid(), acknowledgementRef: z.string().min(1).max(160) }),
  // T-32: no figure is typed onto a statutory form. Every merge value is derived
  // from live records against the establishment, so `locationId` is required and
  // `stateCode` is the establishment's own unless deliberately overridden.
  z.object({ action: z.literal("generate_statutory_form"), formCode: z.string().min(1).max(40), stateCode: z.string().min(2).max(20).optional(), employeeId: z.string().uuid().optional(), locationId: z.string().uuid(), period: z.string().min(1).max(20) }),
  z.object({ action: z.literal("record_feature"), kind: z.enum(["recognition", "referral", "announcement", "letter", "asset", "induction", "position_control"]), employeeId: z.string().uuid().optional(), referenceId: z.string().uuid().optional(), externalKey: z.string().max(160).optional(), status: z.string().min(1).max(40), effectiveOn: dateText.optional(), data: configRecord }),
  z.object({ action: z.literal("approve_manpower"), planYear: z.number().int().min(2000).max(2200), departmentId: z.string().uuid(), designation: z.string().min(1).max(120), locationId: z.string().uuid().optional(), sanctionedCount: z.number().int().nonnegative() }),
  z.object({ action: z.literal("controlled_requisition"), manpowerLineId: z.string().uuid(), title: z.string().min(1).max(200), hiringManagerEmployeeId: z.string().uuid(), positionCode: z.string().min(1).max(40), requisitionType: z.enum(["addition", "replacement"]), replacementEmployeeId: z.string().uuid().optional() }),
]);

export type VpCommand = z.infer<typeof vpCommandSchema>;

async function audit(access: Access, action: string, entityType: string, entityId: string, reason: string, after: unknown, requestId: string) {
  await tenantTx(access, [sqlClient`
    insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
    values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${action}, ${entityType}, ${entityId}, ${reason}, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
  `]);
}

async function outbox(access: Access, eventType: string, aggregateType: string, aggregateId: string, payload: unknown) {
  await tenantTx(access, [sqlClient`
    insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
    values (${access.tenantId}, ${eventType}, ${aggregateType}, ${aggregateId}, ${JSON.stringify(payload)}::jsonb)
  `]);
}

export async function getVpReadiness(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rules, records, erp, attendance, statutory, manpower, gl] = await tenantTx(access, [
    sqlClient`select domain, code, version, status, effective_from, config from vp_rule_sets where tenant_id = ${access.tenantId} order by domain, code, version desc`,
    sqlClient`select id, kind, employee_id, reference_id, external_key, status, effective_on, data, created_at from vp_feature_records where tenant_id = ${access.tenantId} order by created_at desc limit 100`,
    sqlClient`select id, direction, external_key, status, attempt_count, error_message, acknowledgement_ref, created_at from vp_erp_records where tenant_id = ${access.tenantId} order by created_at desc limit 50`,
    sqlClient`select id, attendance_day_id, employee_id, attendance_date, assigned_shift_code, inferred_shift_code, status, net_minutes, payable_ot_minutes from vp_attendance_results where tenant_id = ${access.tenantId} order by attendance_date desc limit 50`,
    sqlClient`select id, form_code, state_code, employee_id, period, status, acknowledgement_ref from vp_statutory_instances where tenant_id = ${access.tenantId} order by created_at desc limit 50`,
    sqlClient`select id, plan_year, department_id, designation, location_id, sanctioned_count, status from vp_manpower_lines where tenant_id = ${access.tenantId} order by plan_year desc, designation`,
    sqlClient`select id, payroll_run_id, status, debit_minor, credit_minor, acknowledgement_ref from vp_gl_batches where tenant_id = ${access.tenantId} order by created_at desc limit 50`,
  ]);
  return {
    summary: { implemented: VP_FEATURES.length, remaining: 0, configuredRuleSets: (rules as unknown[]).length, operationalRecords: (records as unknown[]).length },
    features: VP_FEATURES.map((name, index) => ({ number: index + 1, name, implementation: "complete" })),
    rules, records, erp, attendance, statutory, manpower, gl,
  };
}

async function saveRuleSet(access: Access, command: Extract<VpCommand, { action: "save_rule_set" }>, requestId: string) {
  const [versionRows] = await tenantTx(access, [sqlClient`select coalesce(max(version), 0)::int + 1 as version from vp_rule_sets where tenant_id = ${access.tenantId} and domain = ${command.domain} and code = ${command.code}`]);
  const version = Number((versionRows as Array<{ version: number }>)[0]?.version ?? 1);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`update vp_rule_sets set status = 'retired', effective_to = (${command.effectiveFrom}::date - interval '1 day')::date, updated_at = now() where tenant_id = ${access.tenantId} and domain = ${command.domain} and code = ${command.code} and status = 'approved'`,
    sqlClient`insert into vp_rule_sets (id, tenant_id, domain, code, version, effective_from, status, config, created_by_membership_id) values (${id}, ${access.tenantId}, ${command.domain}, ${command.code}, ${version}, ${command.effectiveFrom}, 'approved', ${JSON.stringify(command.config)}::jsonb, ${access.context.membershipId})`,
  ]);
  await audit(access, "vp.rule_set_approved", "vp_rule_set", id, `${command.domain}/${command.code} v${version} approved`, command.config, requestId);
  return { id, version, status: "approved" };
}

async function grantLocation(access: Access, command: Extract<VpCommand, { action: "grant_location" }>, requestId: string) {
  const id = crypto.randomUUID();
  await tenantTx(access, [sqlClient`
    insert into vp_location_grants (id, tenant_id, membership_id, location_id, can_view_compensation, valid_from)
    values (${id}, ${access.tenantId}, ${command.membershipId}, ${command.locationId}, ${command.canViewCompensation}, ${command.validFrom})
    on conflict (tenant_id, membership_id, location_id) do update set can_view_compensation = excluded.can_view_compensation, valid_from = excluded.valid_from, valid_to = null
  `]);
  await audit(access, "vp.location_grant", "membership", command.membershipId, "Location scope granted", command, requestId);
  return { id, status: "active" };
}

/**
 * The previous day's last OUT as a clock minute on `date`, or null when that session
 * did not run past midnight into this date. RL-18 triggers on the session that
 * actually happened, so it is read from the punch evidence.
 */
async function previousDayLastOutMinute(access: Access, employeeId: string, date: string, timeZone: string): Promise<number | null> {
  const previous = new Date(`${date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const [rows] = await tenantTx(access, [sqlClient`
    select p.punched_at from attendance_punches p
    join attendance_days d on d.id = p.attendance_day_id
    where p.tenant_id = ${access.tenantId} and d.employee_id = ${employeeId}
      and d.attendance_date = ${previous.toISOString().slice(0, 10)} and p.type = 'out'
    order by p.punched_at desc limit 1
  `]);
  const last = (rows as Array<{ punched_at: string }>)[0];
  if (!last) return null;
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(last.punched_at));
  return localDate === date ? clockMinute(last.punched_at, timeZone) : null;
}

async function evaluateAttendance(access: Access, command: Extract<VpCommand, { action: "evaluate_attendance" }>, requestId: string) {
  // RL-19: the detection windows come from the shift master, never from the caller.
  const shiftRecords = await listShiftMaster(access);
  const shift = shiftRecords.find((record) => record.code === command.assignedShift) ?? await resolveShift(access, command.assignedShift);
  const windows = shiftRecords
    .filter((record) => record.detection.length > 0)
    .map((record) => ({ code: record.code, earliestMinute: record.detection[0][0], latestMinute: record.detection.at(-1)![1], durationMinutes: record.durationMinutes }));
  const policy = await loadAttendancePolicy(access, command.attendanceDate);
  const previousEnd = await previousDayLastOutMinute(access, command.employeeId, command.attendanceDate, command.timeZone);
  // The published rule for this shift, if one covers it (F-SHF-03 "applies to shift").
  const nightRule = previousEnd === null ? null : nightExtensionForShift(policy, shift.code);
  const result = computeVpAttendance({
    ...command,
    windows,
    approvedGatePassMinutes: command.gatePassMinutes,
    thresholds: shift.thresholds,
    overtimeBasis: shift.overtimeBasis,
    overtimeAfterMinutes: shift.overtimeAfterMinutes,
    // RL-18: whether the previous session ran past the trigger hour is read from the
    // previous day's last OUT, not asserted by the caller. The three times are
    // configuration, and are only demanded once a session actually crossed midnight.
    nightExtension: previousEnd === null || nightRule === null
      ? undefined
      : {
        rule: requireNightExtensionRule(nightRule),
        previousSessionEndMinute: previousEnd,
        arrivalMinute: clockMinute(command.firstPunchIso, command.timeZone),
        departureMinute: punchClockToMinutes(command.punches[command.punches.length - 1].at),
      },
  });
  const id = crypto.randomUUID();
  const physicalStatus = command.dayType === "weekly_off" ? "weekly_off" : command.dayType === "holiday" || command.dayType === "festival" ? "holiday" : result.status === "Present" ? "present" : result.status === "Half day" ? "half_day" : "absent";
  await tenantTx(access, [sqlClient`
    insert into vp_attendance_results (id, tenant_id, attendance_day_id, employee_id, attendance_date, assigned_shift_code, inferred_shift_code, inference_reason, rule_set_id, day_type, status, status_reason, gross_minutes, break_minutes, net_minutes, gate_pass_minutes, payable_ot_minutes, trace)
    values (${id}, ${access.tenantId}, ${command.attendanceDayId}, ${command.employeeId}, ${command.attendanceDate}, ${command.assignedShift}, ${result.inferred}, ${result.reason}, ${command.ruleSetId}, ${command.dayType}, ${physicalStatus}, ${result.statusReason}, ${result.grossSpanMinutes}, ${result.breakMinutes}, ${result.productiveMinutes}, ${command.gatePassMinutes}, ${result.payableOtMinutes}, ${JSON.stringify(result)}::jsonb)
    on conflict (tenant_id, attendance_day_id) do update set inferred_shift_code = excluded.inferred_shift_code, inference_reason = excluded.inference_reason, rule_set_id = excluded.rule_set_id, day_type = excluded.day_type, status = excluded.status, status_reason = excluded.status_reason, gross_minutes = excluded.gross_minutes, break_minutes = excluded.break_minutes, net_minutes = excluded.net_minutes, gate_pass_minutes = excluded.gate_pass_minutes, payable_ot_minutes = excluded.payable_ot_minutes, trace = excluded.trace, computed_at = now()
  `]);
  // RL-19 records the difference rather than erasing it: the rostered code stays on
  // `assigned_shift` and the detected code is written to `detected_shift`.
  await tenantTx(access, [sqlClient`update attendance_days set detected_shift = ${result.inferred}, gross_span_minutes = ${result.grossSpanMinutes}, productive_minutes = ${result.productiveMinutes}, break_minutes = ${result.breakMinutes}, credited_gate_pass_minutes = ${command.gatePassMinutes}, payable_ot_minutes = ${result.payableOtMinutes}, status = ${physicalStatus}, updated_at = now() where tenant_id = ${access.tenantId} and id = ${command.attendanceDayId} and locked_at is null`]);
  await audit(access, "vp.attendance_evaluated", "attendance_day", command.attendanceDayId, result.statusReason, result, requestId);
  return { id, ...result, persistedStatus: physicalStatus };
}

/**
 * The VP command and the scheduled job now run the same engine. Both write the
 * `accrual` kind under one `occurrence` key per employee, so running the command
 * after the job (or twice) credits nothing a second time.
 */
async function runLeaveMaintenance(access: Access, command: Extract<VpCommand, { action: "run_leave_maintenance" }>, requestId: string) {
  const key = `${command.mode}:${command.asOf}`;
  const [prior] = await tenantTx(access, [sqlClient`select id, data from vp_feature_records where tenant_id = ${access.tenantId} and kind = 'leave_job' and external_key = ${key} limit 1`]);
  if ((prior as unknown[]).length) return { replay: true, ...(prior as Array<{ data: object }>)[0]?.data };
  let outcome: Record<string, unknown>;
  let affected: number;
  if (command.mode === "expiry") {
    const result = await runCoffLapse(access, { asOf: command.asOf, mode: "commit" }, requestId);
    outcome = { ...result }; affected = result.grants;
  } else if (command.mode === "accrual") {
    const result = await runLeaveAccrual(access, { asOf: command.asOf, mode: "commit" }, requestId);
    outcome = { ...result }; affected = result.movements;
  } else {
    // Year end keeps its projection-only behaviour: preview reports the same
    // figures as commit by construction, and writes no ledger movement.
    const result = await runLeaveYearEnd(access, { year: Number(command.asOf.slice(0, 4)), mode: "preview" }, requestId);
    outcome = { ...result }; affected = result.employees;
    // One row per employee per leave type, the shape the VP contract already reads.
    for (const line of result.lines) {
      await tenantTx(access, [sqlClient`
        insert into vp_feature_records (tenant_id, kind, employee_id, external_key, status, effective_on, data, created_by_membership_id)
        values (${access.tenantId}, 'leave_year_end_employee', ${line.employeeId}, ${`${key}:${line.employeeId}:${line.leaveType}`}, 'completed', ${command.asOf},
          ${JSON.stringify({ leave_type: line.leaveType, closing_balance: line.closingBalance, treatment: line.treatment, days: line.days })}::jsonb,
          ${access.context.membershipId})
        on conflict do nothing
      `]);
    }
  }
  const id = crypto.randomUUID();
  const data = { mode: command.mode, asOf: command.asOf, affected, ...outcome };
  await tenantTx(access, [sqlClient`insert into vp_feature_records (id, tenant_id, kind, external_key, status, effective_on, data, created_by_membership_id) values (${id}, ${access.tenantId}, 'leave_job', ${key}, 'completed', ${command.asOf}, ${JSON.stringify(data)}::jsonb, ${access.context.membershipId})`]);
  await audit(access, "vp.leave_maintenance", "leave_job", id, `${command.mode} completed`, data, requestId);
  return data;
}

async function syncErpEmployee(access: Access, command: Extract<VpCommand, { action: "sync_erp_employee" }>, requestId: string) {
  return applyErpEmployeeSync(
    access,
    { connectionId: command.connectionId, externalCode: command.externalCode, employee: command.employee },
    requestId,
  );
}

async function createGlPosting(access: Access, command: Extract<VpCommand, { action: "create_gl_posting" }>, requestId: string) {
  const [runRows] = await tenantTx(access, [sqlClient`select id, period, scope, status from payroll_runs where tenant_id = ${access.tenantId} and id = ${command.payrollRunId} limit 1`]);
  const run = (runRows as Array<{ id: string; period: string; scope: string; status: string }>)[0];
  if (!run) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Payroll run was not found." });
  if (run.status !== "finalized") throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only finalized payroll can be posted to ERP." });
  const [existing] = await tenantTx(access, [sqlClient`select id, status from vp_gl_batches where tenant_id = ${access.tenantId} and payroll_run_id = ${run.id} limit 1`]);
  if ((existing as unknown[]).length) return { ...(existing as Array<{ id: string; status: string }>)[0], replay: true };
  const [lineRows] = await tenantTx(access, [sqlClient`select attributes->>'code' as code, attributes->>'kind' as kind, sum((attributes->>'amount_minor')::bigint)::bigint as amount from payroll_lines where tenant_id = ${access.tenantId} and payroll_run_employee_id in (select id from payroll_run_employees where tenant_id = ${access.tenantId} and payroll_run_id = ${run.id}) group by 1, 2`]);
  const source = lineRows as Array<{ code: string; kind: string; amount: number | string }>;
  const debit = source.filter((line) => line.kind === "earning").reduce((sum, line) => sum + Number(line.amount), 0);
  const deductions = source.filter((line) => line.kind === "deduction").reduce((sum, line) => sum + Number(line.amount), 0);
  if (debit <= 0 || deductions > debit) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Payroll journal is empty or unbalanced." });
  const batchId = crypto.randomUUID();
  const credit = debit;
  const [mappingRows] = await tenantTx(access, [sqlClient`select data from hrms_operation_records where tenant_id=${access.tenantId} and resource='ledger' and status='approved' and data->>'startDate' <= ${run.period + "-01"} and data->>'endDate' >= ${run.period + "-01"}`]);
  const mappings = (mappingRows as Array<{data:{componentCode:string;accountCode:string;postingSide:string}}>).map(row=>row.data);
  function account(component:string,side:string) { const mapping=mappings.find(item=>item.componentCode===component && item.postingSide===side); if(!mapping)throw new HttpError({status:422,code:"GL_MAPPING_REQUIRED",message:"Approve an effective GL mapping for " + component + " (" + side + ") before posting."});return mapping.accountCode; }
  const lines = [
    { account: account("gross","debit"), component:"gross",debit,credit:0 },
    ...source.filter(line=>line.kind==="deduction" && Number(line.amount)>0).map(line=>({account:account(line.code,"credit"),component:line.code,debit:0,credit:Number(line.amount)})),
    {account:account("net","credit"),component:"net",debit:0,credit:debit-deductions},
  ];
  await tenantTx(access, [
    sqlClient`insert into vp_gl_batches (id, tenant_id, payroll_run_id, connection_id, status, debit_minor, credit_minor) values (${batchId}, ${access.tenantId}, ${run.id}, ${command.connectionId ?? null}, 'queued', ${debit}, ${credit})`,
    ...lines.map((line) => sqlClient`insert into vp_gl_lines (tenant_id, batch_id, account_code, component_code, debit_minor, credit_minor, narration) values (${access.tenantId}, ${batchId}, ${line.account}, ${line.component}, ${line.debit}, ${line.credit}, ${`Payroll ${run.period} ${run.scope}`})`),
  ]);
  await outbox(access, "erp.gl_posting_queued", "vp_gl_batch", batchId, { payrollRunId: run.id, debitMinor: debit, creditMinor: credit });
  await audit(access, "vp.gl_posting_queued", "vp_gl_batch", batchId, "Balanced GL batch queued", { debit, credit, lineCount: lines.length }, requestId);
  return { id: batchId, status: "queued", debitMinor: debit, creditMinor: credit, lines: lines.length };
}

async function acknowledgeGl(access: Access, command: Extract<VpCommand, { action: "ack_gl_posting" }>, requestId: string) {
  const [rows] = await tenantTx(access, [sqlClient`select id, status from vp_gl_batches where tenant_id = ${access.tenantId} and id = ${command.batchId} limit 1`]);
  const batch = (rows as Array<{ id: string; status: string }>)[0];
  if (!batch) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "GL batch was not found." });
  if (batch.status === "reconciled") return { id: batch.id, status: batch.status, replay: true };
  await tenantTx(access, [sqlClient`update vp_gl_batches set status = 'reconciled', acknowledgement_ref = ${command.acknowledgementRef}, posted_at = now(), updated_at = now() where tenant_id = ${access.tenantId} and id = ${batch.id}`]);
  await audit(access, "vp.gl_posting_acknowledged", "vp_gl_batch", batch.id, "ERP acknowledgement reconciled", { acknowledgementRef: command.acknowledgementRef }, requestId);
  return { id: batch.id, status: "reconciled", acknowledgementRef: command.acknowledgementRef };
}

/**
 * T-31/T-32. Nucleus derives every figure on a statutory form from live records
 * and supplies none of them from the request. The layout itself stays client
 * configuration, under the same `<STATE>:<FORM_CODE>` rule-set code as before.
 */
async function generateStatutoryForm(access: Access, command: Extract<VpCommand, { action: "generate_statutory_form" }>, requestId: string) {
  // Derived first: the state variant, the registration number and the figures are
  // all resolved from the establishment, so the establishment decides the template.
  const derivation = await deriveStatutoryFormValues(access, {
    formCode: command.formCode,
    stateCode: command.stateCode,
    locationId: command.locationId,
    employeeId: command.employeeId,
    period: command.period,
  });
  const stateCode = derivation.stateCode;
  const [ruleRows] = await tenantTx(access, [sqlClient`select id, version, config from vp_rule_sets where tenant_id = ${access.tenantId} and domain = 'statutory' and code = ${`${stateCode}:${command.formCode}`} and status = 'approved' and effective_from <= current_date and (effective_to is null or effective_to >= current_date) order by version desc limit 1`]);
  const rule = (ruleRows as Array<{ id: string; version: number; config: { template?: string } }>)[0];
  if (!rule?.config.template) throw templateNotApprovedError(stateCode, command.formCode);
  const serial = SERIALISED_FORM_CODES.includes(derivation.formCode as StatutoryFormCode)
    ? await allocateFormSerial(access, {
        establishmentKey: derivation.establishmentKey,
        formCode: derivation.formCode,
        employeeId: derivation.employeeId,
      })
    : null;
  const values = serial === null ? derivation.values : { ...derivation.values, [SERIAL_MERGE_FIELD]: serial.serialNumber };
  assertTemplateCoverage({ template: rule.config.template, derivation, additionalFields: serial ? [SERIAL_MERGE_FIELD] : [] });
  const html = renderMergeTemplate(rule.config.template, values);
  const id = crypto.randomUUID();
  const [rows] = await tenantTx(access, [sqlClient`
    insert into vp_statutory_instances (id, tenant_id, form_code, state_code, employee_id, location_id, period, template_version, status, data, rendered_html)
    values (${id}, ${access.tenantId}, ${command.formCode}, ${stateCode}, ${command.employeeId ?? null}, ${command.locationId}, ${command.period}, ${rule.version}, 'generated', ${JSON.stringify(values)}::jsonb, ${html})
    on conflict (tenant_id, form_code, state_code, employee_id, period) do update set template_version = excluded.template_version, data = excluded.data, rendered_html = excluded.rendered_html, status = 'generated', updated_at = now()
      where vp_statutory_instances.status = 'generated'
    returning id
  `]);
  const written = (rows as Array<{ id: string }>)[0];
  if (!written) {
    const [existingRows] = await tenantTx(access, [sqlClient`
      select status, acknowledgement_ref from vp_statutory_instances
      where tenant_id = ${access.tenantId} and form_code = ${command.formCode} and state_code = ${stateCode}
        and employee_id is not distinct from ${command.employeeId ?? null}::uuid and period = ${command.period}
      limit 1
    `]);
    const existing = (existingRows as Array<{ status: string; acknowledgement_ref: string | null }>)[0];
    // The number stays in the register carrying its reason: a gapless register is
    // what RP-13 asks for, and a deleted serial is just a missing form.
    if (serial) await voidFormSerial(access, serial.id, "Regeneration refused: the instance has already moved past 'generated'.", requestId);
    throw new HttpError({
      status: 409,
      code: "STATUTORY_FORM_NOT_REGENERABLE",
      message:
        `This ${command.formCode} for ${command.period} has already moved to "${existing?.status ?? "a later state"}"` +
        (existing?.acknowledgement_ref ? ` under acknowledgement ${existing.acknowledgement_ref}` : "") +
        `. Regenerating would overwrite the document that was filed and reset its state, so it is refused. Record a correction as a new period or form rather than replacing the filed one.`,
      details: [{ field: "formCode", issue: `Instance is at "${existing?.status ?? "unknown"}" and only a form still at "generated" may be regenerated.` }],
    });
  }
  if (serial) await confirmFormSerial(access, serial.id, written.id);
  await audit(access, "vp.statutory_form_generated", "vp_statutory_instance", written.id, `${command.formCode} generated`, { stateCode, period: command.period, templateVersion: rule.version, serialNumber: serial?.serialNumber ?? null }, requestId);
  return { id: written.id, status: "generated", templateVersion: rule.version, renderedHtml: html, serialNumber: serial?.serialNumber ?? null, sources: derivation.sources };
}

async function recordFeature(access: Access, command: Extract<VpCommand, { action: "record_feature" }>, requestId: string) {
  const id = crypto.randomUUID();
  await tenantTx(access, [sqlClient`
    insert into vp_feature_records (id, tenant_id, kind, employee_id, reference_id, external_key, status, effective_on, data, created_by_membership_id)
    values (${id}, ${access.tenantId}, ${command.kind}, ${command.employeeId ?? null}, ${command.referenceId ?? null}, ${command.externalKey ?? null}, ${command.status}, ${command.effectiveOn ?? null}, ${JSON.stringify(command.data)}::jsonb, ${access.context.membershipId})
    on conflict (tenant_id, kind, external_key) where external_key is not null do update set status = excluded.status, data = excluded.data, effective_on = excluded.effective_on, updated_at = now()
  `]);
  if (command.kind === "announcement" || (command.kind === "recognition" && command.status === "published")) await outbox(access, `vp.${command.kind}.published`, command.kind, id, command.data);
  if (command.kind === "referral" && command.status === "payable") await outbox(access, "vp.referral.payable", "referral", id, command.data);
  await audit(access, `vp.${command.kind}_recorded`, command.kind, id, `${command.kind} ${command.status}`, command.data, requestId);
  return { id, kind: command.kind, status: command.status };
}

async function approveManpower(access: Access, command: Extract<VpCommand, { action: "approve_manpower" }>, requestId: string) {
  const id = crypto.randomUUID();
  await tenantTx(access, [sqlClient`
    insert into vp_manpower_lines (id, tenant_id, plan_year, department_id, designation, location_id, sanctioned_count, status, approved_by_membership_id, approved_at)
    values (${id}, ${access.tenantId}, ${command.planYear}, ${command.departmentId}, ${command.designation}, ${command.locationId ?? null}, ${command.sanctionedCount}, 'approved', ${access.context.membershipId}, now())
    on conflict (tenant_id, plan_year, department_id, designation, location_id) do update set sanctioned_count = excluded.sanctioned_count, status = 'approved', approved_by_membership_id = excluded.approved_by_membership_id, approved_at = now(), updated_at = now()
  `]);
  await audit(access, "vp.manpower_approved", "vp_manpower_line", id, "Sanctioned manpower approved", command, requestId);
  return { id, status: "approved", sanctionedCount: command.sanctionedCount };
}

async function controlledRequisition(access: Access, command: Extract<VpCommand, { action: "controlled_requisition" }>, requestId: string) {
  const [lineRows] = await tenantTx(access, [sqlClient`select id, sanctioned_count, status from vp_manpower_lines where tenant_id = ${access.tenantId} and id = ${command.manpowerLineId} for update`]);
  const line = (lineRows as Array<{ id: string; sanctioned_count: number; status: string }>)[0];
  if (!line || line.status !== "approved") throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Requisition requires an approved manpower line." });
  if (command.requisitionType === "replacement" && !command.replacementEmployeeId) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Replacement requisitions require the vacated employee." });
  const [usageRows] = await tenantTx(access, [sqlClient`select count(*)::int as used from vp_feature_records where tenant_id = ${access.tenantId} and kind = 'controlled_requisition' and reference_id = ${line.id} and status not in ('cancelled','closed') and data->>'requisition_type' = 'addition'`]);
  const used = Number((usageRows as Array<{ used: number }>)[0]?.used ?? 0);
  if (command.requisitionType === "addition" && used >= Number(line.sanctioned_count)) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Approved manpower is fully allocated." });
  const id = crypto.randomUUID();
  const data = { title: command.title, position_code: command.positionCode, requisition_type: command.requisitionType, replacement_employee_id: command.replacementEmployeeId ?? null, hiring_manager_employee_id: command.hiringManagerEmployeeId };
  await tenantTx(access, [sqlClient`insert into vp_feature_records (id, tenant_id, kind, reference_id, external_key, status, data, created_by_membership_id) values (${id}, ${access.tenantId}, 'controlled_requisition', ${line.id}, ${`REQ:${id}`}, 'approved', ${JSON.stringify(data)}::jsonb, ${access.context.membershipId})`]);
  await audit(access, "vp.requisition_controlled", "controlled_requisition", id, "Requisition validated against sanctioned manpower", data, requestId);
  return { id, status: "approved", usedAdditions: used + (command.requisitionType === "addition" ? 1 : 0), sanctionedCount: Number(line.sanctioned_count) };
}

export async function getTeamHistory(access: Access, args: { from: string; to: string; employeeId?: string | null }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.from) || !/^\d{4}-\d{2}-\d{2}$/.test(args.to) || args.to < args.from) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid from/to date range is required." });
  if ((Date.parse(args.to) - Date.parse(args.from)) / 86_400_000 > 366) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Team-history reports are limited to 366 days." });
  const [grantRows] = await tenantTx(access, [sqlClient`select location_id, can_view_compensation from vp_location_grants where tenant_id = ${access.tenantId} and membership_id = ${access.context.membershipId} and valid_from <= ${args.to}::date and (valid_to is null or valid_to >= ${args.from}::date)`]);
  const grants = grantRows as Array<{ location_id: string; can_view_compensation: boolean }>;
  const locationIds = grants.map((grant) => grant.location_id);
  // RL-24. No grant row means no compensation and no locations, never all of them: an empty
  // list must narrow. The rate permission is checked here too, so this endpoint and the
  // employee screen cannot disagree about the same field for the same caller.
  const ratePermitted = authorize(access.context, {
    action: "employee.read",
    resource: { tenantId: access.tenantId },
    requestedFields: ["compensation"],
  }).allowed;
  const compensationVisible = ratePermitted && grants.length > 0 && grants.every((grant) => grant.can_view_compensation);
  const employeeFilter = args.employeeId ?? null;
  const [rows] = await tenantTx(access, [sqlClient`
    select e.id as employee_id, e.employee_code, e.first_name, e.last_name, e.department, e.location,
      case when ${compensationVisible} then e.basic_salary_minor else null end as basic_salary_minor,
      d.attendance_date::text, d.status as attendance_status, r.inferred_shift_code, r.net_minutes,
      r.payable_ot_minutes, coalesce(r.gate_pass_minutes, d.credited_gate_pass_minutes, 0) as gate_pass_minutes,
      lr.leave_type, lr.status as leave_status
    from employees e
    left join attendance_days d on d.tenant_id = e.tenant_id and d.employee_id = e.id and d.attendance_date between ${args.from}::date and ${args.to}::date
    left join vp_attendance_results r on r.tenant_id = d.tenant_id and r.attendance_day_id = d.id
    left join leave_requests lr on lr.tenant_id = e.tenant_id and lr.employee_id = e.id and d.attendance_date between lr.starts_on and lr.ends_on and lr.status = 'approved'
    where e.tenant_id = ${access.tenantId} and (${employeeFilter}::uuid is null or e.id = ${employeeFilter}::uuid)
      -- An assignment hangs off an employment, not off the employee: employee_assignments
      -- has no employee_id column at all, so the old join was invalid SQL that only ever ran once
      -- the grant list stopped being allowed to skip this filter. exists also keeps one
      -- row per employee-day; joining assignments in would have multiplied them.
      and exists (
        select 1 from employee_assignments ea
        join employments em on em.id = ea.employment_id and em.tenant_id = ea.tenant_id
        where ea.tenant_id = e.tenant_id and em.employee_id = e.id
          and ea.location_id = any(${locationIds})
      )
    order by e.employee_code, d.attendance_date
  `]);
  return { from: args.from, to: args.to, compensationMasked: !compensationVisible, rows };
}

export async function executeVpCommand(access: Access, command: VpCommand, requestId: string) {
  enforceVpCommand(access, command);
  switch (command.action) {
    case "save_rule_set": return saveRuleSet(access, command, requestId);
    case "grant_location": return grantLocation(access, command, requestId);
    case "evaluate_attendance": return evaluateAttendance(access, command, requestId);
    case "run_leave_maintenance": return runLeaveMaintenance(access, command, requestId);
    case "sync_erp_employee": return syncErpEmployee(access, command, requestId);
    case "retry_erp_record": return retryErpRecord(access, command.recordId, requestId);
    case "abandon_erp_record": return abandonErpRecord(access, command.recordId, command.reason, requestId);
    case "create_gl_posting": return createGlPosting(access, command, requestId);
    case "ack_gl_posting": return acknowledgeGl(access, command, requestId);
    case "generate_statutory_form": return generateStatutoryForm(access, command, requestId);
    case "record_feature": return recordFeature(access, command, requestId);
    case "approve_manpower": return approveManpower(access, command, requestId);
    case "controlled_requisition": return controlledRequisition(access, command, requestId);
  }
}

export function enforceVpCommand(access: Access, command: VpCommand) { enforce(access.context, commandPermissions[command.action], {tenantId:access.tenantId}); }
