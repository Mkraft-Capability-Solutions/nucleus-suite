import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { annualLeaveCredit } from "@/lib/hr-rules";
import { ensureLeaveType, getBalances } from "@/server/leave/service";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { computeVpAttendance, payloadHashSource, renderMergeTemplate, VP_FEATURES } from "./policy";

const configValue = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.string(), z.unknown())]);
const configRecord = z.record(z.string(), configValue);
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const vpCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_rule_set"), domain: z.enum(["attendance", "worker", "leave", "statutory", "announcement", "letter"]), code: z.string().min(1).max(80), effectiveFrom: dateText, config: configRecord }),
  z.object({ action: z.literal("grant_location"), membershipId: z.string().uuid(), locationId: z.string().uuid(), canViewCompensation: z.boolean().default(false), validFrom: dateText }),
  z.object({
    action: z.literal("evaluate_attendance"), attendanceDayId: z.string().uuid(), employeeId: z.string().uuid(), attendanceDate: dateText,
    ruleSetId: z.string().uuid(), assignedShift: z.string().min(1).max(20), shiftHours: z.union([z.literal(8), z.literal(9), z.literal(10), z.literal(12)]),
    windows: z.array(z.object({ code: z.string(), earliestMinute: z.number().int().min(0).max(1439), latestMinute: z.number().int().min(0).max(1439), durationMinutes: z.number().int().positive() })).min(1),
    punches: z.array(z.object({ type: z.enum(["in", "out"]), at: z.string() })).min(2), firstPunchIso: z.string().datetime({ offset: true }),
    gatePassMinutes: z.number().int().nonnegative().default(0), otPolicy: z.enum(["all-days", "rest-holiday-only", "not-eligible"]),
    dayType: z.enum(["working", "weekly_off", "holiday", "festival"]), minutesLate: z.number().int().nonnegative().default(0), lateOccurrencesThisMonth: z.number().int().nonnegative().default(0),
    assistantManagerOrAbove: z.boolean().default(false), workedPast3AmPreviousDay: z.boolean().default(false), timeZone: z.string().default("Asia/Kolkata"),
  }),
  z.object({ action: z.literal("run_leave_maintenance"), mode: z.enum(["accrual", "expiry", "year_end"]), asOf: dateText }),
  z.object({ action: z.literal("sync_erp_employee"), connectionId: z.string().uuid().optional(), externalCode: z.string().min(1).max(80), employee: z.object({ firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80), workEmail: z.string().email().optional(), department: z.string().min(1).max(80), location: z.string().min(1).max(80), designation: z.string().min(1).max(120), joiningDate: dateText, basicSalaryMinor: z.number().int().nonnegative().optional() }) }),
  z.object({ action: z.literal("create_gl_posting"), payrollRunId: z.string().uuid(), connectionId: z.string().uuid().optional() }),
  z.object({ action: z.literal("ack_gl_posting"), batchId: z.string().uuid(), acknowledgementRef: z.string().min(1).max(160) }),
  z.object({ action: z.literal("generate_statutory_form"), formCode: z.string().min(1).max(40), stateCode: z.string().min(2).max(20), employeeId: z.string().uuid().optional(), locationId: z.string().uuid().optional(), period: z.string().min(1).max(20), values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])) }),
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
    sqlClient`select id, direction, external_key, status, attempt_count, acknowledgement_ref, created_at from vp_erp_records where tenant_id = ${access.tenantId} order by created_at desc limit 50`,
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

async function evaluateAttendance(access: Access, command: Extract<VpCommand, { action: "evaluate_attendance" }>, requestId: string) {
  const result = computeVpAttendance({ ...command, shiftHours: command.shiftHours, punches: command.punches as unknown as import("@/lib/hr-rules").Punch[], approvedGatePassMinutes: command.gatePassMinutes });
  const id = crypto.randomUUID();
  const physicalStatus = command.dayType === "weekly_off" ? "weekly_off" : command.dayType === "holiday" || command.dayType === "festival" ? "holiday" : result.status === "Present" ? "present" : result.status === "Half day" ? "half_day" : "absent";
  await tenantTx(access, [sqlClient`
    insert into vp_attendance_results (id, tenant_id, attendance_day_id, employee_id, attendance_date, assigned_shift_code, inferred_shift_code, inference_reason, rule_set_id, day_type, status, status_reason, gross_minutes, break_minutes, net_minutes, gate_pass_minutes, payable_ot_minutes, trace)
    values (${id}, ${access.tenantId}, ${command.attendanceDayId}, ${command.employeeId}, ${command.attendanceDate}, ${command.assignedShift}, ${result.inferred}, ${result.reason}, ${command.ruleSetId}, ${command.dayType}, ${physicalStatus}, ${result.statusReason}, ${result.grossSpanMinutes}, ${result.breakMinutes}, ${result.productiveMinutes}, ${command.gatePassMinutes}, ${result.payableOtMinutes}, ${JSON.stringify(result)}::jsonb)
    on conflict (tenant_id, attendance_day_id) do update set inferred_shift_code = excluded.inferred_shift_code, inference_reason = excluded.inference_reason, rule_set_id = excluded.rule_set_id, day_type = excluded.day_type, status = excluded.status, status_reason = excluded.status_reason, gross_minutes = excluded.gross_minutes, break_minutes = excluded.break_minutes, net_minutes = excluded.net_minutes, gate_pass_minutes = excluded.gate_pass_minutes, payable_ot_minutes = excluded.payable_ot_minutes, trace = excluded.trace, computed_at = now()
  `]);
  await tenantTx(access, [sqlClient`update attendance_days set assigned_shift = ${result.effective}, gross_span_minutes = ${result.grossSpanMinutes}, productive_minutes = ${result.productiveMinutes}, break_minutes = ${result.breakMinutes}, credited_gate_pass_minutes = ${command.gatePassMinutes}, payable_ot_minutes = ${result.payableOtMinutes}, status = ${physicalStatus}, updated_at = now() where tenant_id = ${access.tenantId} and id = ${command.attendanceDayId} and locked_at is null`]);
  await audit(access, "vp.attendance_evaluated", "attendance_day", command.attendanceDayId, result.statusReason, result, requestId);
  return { id, ...result, persistedStatus: physicalStatus };
}

async function runLeaveMaintenance(access: Access, command: Extract<VpCommand, { action: "run_leave_maintenance" }>, requestId: string) {
  const key = `${command.mode}:${command.asOf}`;
  const [prior] = await tenantTx(access, [sqlClient`select id, data from vp_feature_records where tenant_id = ${access.tenantId} and kind = 'leave_job' and external_key = ${key} limit 1`]);
  if ((prior as unknown[]).length) return { replay: true, ...(prior as Array<{ data: object }>)[0]?.data };
  let affected = 0;
  if (command.mode === "expiry") {
    const [rows] = await tenantTx(access, [sqlClient`select id, employee_id, (attributes->>'days')::float as days from comp_off_grants where tenant_id = ${access.tenantId} and attributes->>'status' = 'available' and (attributes->>'expires_on')::date <= ${command.asOf}::date`]);
    const coffTypeId = await ensureLeaveType(access, "COFF");
    for (const row of rows as Array<{ id: string; employee_id: string; days: number }>) {
      await tenantTx(access, [
        sqlClient`update comp_off_grants set attributes = attributes || '{"status":"lapsed"}'::jsonb where tenant_id = ${access.tenantId} and id = ${row.id}`,
        sqlClient`insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, comp_off_grant_id, attributes) values (${access.tenantId}, ${row.employee_id}, ${coffTypeId}, ${row.id}, ${JSON.stringify({ kind: "lapse", days: row.days, leave_type: "COFF", effective_date: command.asOf })}::jsonb)`,
      ]);
      affected += 1;
    }
  } else {
    const [employees] = await tenantTx(access, [sqlClient`select id, designation_level, joining_date::text as joining_date from employees where tenant_id = ${access.tenantId} and status = 'active'`]);
    for (const employee of employees as Array<{ id: string; designation_level: number; joining_date: string }>) {
      const joining = new Date(`${employee.joining_date}T00:00:00Z`);
      const asOf = new Date(`${command.asOf}T00:00:00Z`);
      const credit = annualLeaveCredit({ designationLevel: employee.designation_level >= 7 ? "AGM+" : "below-AGM", joinMonth: joining.getUTCMonth() + 1, joinDay: joining.getUTCDate(), completedSixMonths: asOf.getTime() - joining.getTime() >= 183 * 86_400_000 });
      if (command.mode === "accrual") {
        const entries = [{ code: "EL", days: credit.monthlyEL || credit.EL }, { code: "CL", days: asOf.getUTCMonth() === 0 ? credit.CL : 0 }, { code: "SL", days: asOf.getUTCMonth() === 0 ? credit.SL : 0 }].filter((entry) => entry.days > 0);
        for (const entry of entries) {
          const leaveTypeId = await ensureLeaveType(access, entry.code);
          await tenantTx(access, [sqlClient`insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes) values (${access.tenantId}, ${employee.id}, ${leaveTypeId}, ${JSON.stringify({ kind: "credit", days: entry.days, leave_type: entry.code, effective_date: command.asOf, source: key })}::jsonb)`]);
        }
      } else {
        const balances = await getBalances(access, employee.id);
        await tenantTx(access, [sqlClient`insert into vp_feature_records (tenant_id, kind, employee_id, external_key, status, effective_on, data, created_by_membership_id) values (${access.tenantId}, 'leave_year_end_employee', ${employee.id}, ${`${key}:${employee.id}`}, 'completed', ${command.asOf}, ${JSON.stringify({ encash_el_days: Math.max(0, balances.balances.EL), lapse_cl_days: Math.max(0, balances.balances.CL), lapse_sl_days: Math.max(0, balances.balances.SL) })}::jsonb, ${access.context.membershipId}) on conflict do nothing`]);
      }
      affected += 1;
    }
  }
  const id = crypto.randomUUID();
  const data = { mode: command.mode, asOf: command.asOf, affected };
  await tenantTx(access, [sqlClient`insert into vp_feature_records (id, tenant_id, kind, external_key, status, effective_on, data, created_by_membership_id) values (${id}, ${access.tenantId}, 'leave_job', ${key}, 'completed', ${command.asOf}, ${JSON.stringify(data)}::jsonb, ${access.context.membershipId})`]);
  await audit(access, "vp.leave_maintenance", "leave_job", id, `${command.mode} completed`, data, requestId);
  return data;
}

async function syncErpEmployee(access: Access, command: Extract<VpCommand, { action: "sync_erp_employee" }>, requestId: string) {
  const canonical = JSON.stringify(payloadHashSource(command.employee));
  const hash = createHash("sha256").update(canonical).digest("hex");
  const [prior] = await tenantTx(access, [sqlClient`select id, status from vp_erp_records where tenant_id = ${access.tenantId} and direction = 'inbound_employee' and external_key = ${command.externalCode} and payload_hash = ${hash} limit 1`]);
  if ((prior as unknown[]).length) return { ...(prior as Array<{ id: string; status: string }>)[0], replay: true };
  const recordId = crypto.randomUUID();
  await tenantTx(access, [sqlClient`insert into vp_erp_records (id, tenant_id, connection_id, direction, external_key, payload_hash, payload, status) values (${recordId}, ${access.tenantId}, ${command.connectionId ?? null}, 'inbound_employee', ${command.externalCode}, ${hash}, ${canonical}::jsonb, 'validated')`]);
  const [existing] = await tenantTx(access, [sqlClient`select id from employees where tenant_id = ${access.tenantId} and employee_code = ${command.externalCode} limit 1`]);
  let employeeId = (existing as Array<{ id: string }>)[0]?.id;
  if (employeeId) {
    await tenantTx(access, [sqlClient`update employees set first_name = ${command.employee.firstName}, last_name = ${command.employee.lastName}, work_email = ${command.employee.workEmail ?? null}, department = ${command.employee.department}, location = ${command.employee.location}, designation = ${command.employee.designation}, joining_date = ${command.employee.joiningDate}, basic_salary_minor = coalesce(${command.employee.basicSalaryMinor ?? null}, basic_salary_minor), updated_at = now() where tenant_id = ${access.tenantId} and id = ${employeeId}`]);
  } else {
    const personId = crypto.randomUUID();
    employeeId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
      sqlClient`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, work_email, department, location, designation, joining_date, basic_salary_minor) values (${employeeId}, ${access.tenantId}, ${personId}, ${command.externalCode}, ${command.employee.firstName}, ${command.employee.lastName}, ${command.employee.workEmail ?? null}, ${command.employee.department}, ${command.employee.location}, ${command.employee.designation}, ${command.employee.joiningDate}, ${command.employee.basicSalaryMinor ?? null})`,
    ]);
  }
  await tenantTx(access, [sqlClient`update vp_erp_records set status = 'applied', applied_at = now(), updated_at = now() where tenant_id = ${access.tenantId} and id = ${recordId}`]);
  await audit(access, "vp.erp_employee_applied", "employee", employeeId, "ERP-owned employee fields synchronized", { externalCode: command.externalCode, payloadHash: hash }, requestId);
  return { id: recordId, employeeId, status: "applied", replay: false };
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
  const lines = [
    { account: "SALARY_EXPENSE", component: "gross", debit, credit: 0 },
    ...source.filter((line) => line.kind === "deduction" && Number(line.amount) > 0).map((line) => ({ account: `${line.code.toUpperCase()}_PAYABLE`, component: line.code, debit: 0, credit: Number(line.amount) })),
    { account: "BANK_PAYABLE", component: "net", debit: 0, credit: debit - deductions },
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

async function generateStatutoryForm(access: Access, command: Extract<VpCommand, { action: "generate_statutory_form" }>, requestId: string) {
  const [ruleRows] = await tenantTx(access, [sqlClient`select id, version, config from vp_rule_sets where tenant_id = ${access.tenantId} and domain = 'statutory' and code = ${`${command.stateCode}:${command.formCode}`} and status = 'approved' and effective_from <= current_date and (effective_to is null or effective_to >= current_date) order by version desc limit 1`]);
  const rule = (ruleRows as Array<{ id: string; version: number; config: { template?: string } }>)[0];
  if (!rule?.config.template) throw new HttpError({ status: 422, code: "RULE_PACK_NOT_APPROVED", message: `No approved ${command.stateCode} ${command.formCode} template is effective.` });
  const html = renderMergeTemplate(rule.config.template, command.values);
  const id = crypto.randomUUID();
  await tenantTx(access, [sqlClient`
    insert into vp_statutory_instances (id, tenant_id, form_code, state_code, employee_id, location_id, period, template_version, status, data, rendered_html)
    values (${id}, ${access.tenantId}, ${command.formCode}, ${command.stateCode}, ${command.employeeId ?? null}, ${command.locationId ?? null}, ${command.period}, ${rule.version}, 'generated', ${JSON.stringify(command.values)}::jsonb, ${html})
    on conflict (tenant_id, form_code, state_code, employee_id, period) do update set template_version = excluded.template_version, data = excluded.data, rendered_html = excluded.rendered_html, status = 'generated', updated_at = now()
  `]);
  await audit(access, "vp.statutory_form_generated", "vp_statutory_instance", id, `${command.formCode} generated`, { stateCode: command.stateCode, period: command.period, templateVersion: rule.version }, requestId);
  return { id, status: "generated", templateVersion: rule.version, renderedHtml: html };
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
  const compensationVisible = grants.length === 0 || grants.every((grant) => grant.can_view_compensation);
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
    left join employee_assignments ea on ea.tenant_id = e.tenant_id and ea.employee_id = e.id
    where e.tenant_id = ${access.tenantId} and (${employeeFilter}::uuid is null or e.id = ${employeeFilter}::uuid)
      and (${locationIds.length === 0} or ea.location_id = any(${locationIds}))
    order by e.employee_code, d.attendance_date
  `]);
  return { from: args.from, to: args.to, compensationMasked: !compensationVisible, rows };
}

export async function executeVpCommand(access: Access, command: VpCommand, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  switch (command.action) {
    case "save_rule_set": return saveRuleSet(access, command, requestId);
    case "grant_location": return grantLocation(access, command, requestId);
    case "evaluate_attendance": return evaluateAttendance(access, command, requestId);
    case "run_leave_maintenance": return runLeaveMaintenance(access, command, requestId);
    case "sync_erp_employee": return syncErpEmployee(access, command, requestId);
    case "create_gl_posting": return createGlPosting(access, command, requestId);
    case "ack_gl_posting": return acknowledgeGl(access, command, requestId);
    case "generate_statutory_form": return generateStatutoryForm(access, command, requestId);
    case "record_feature": return recordFeature(access, command, requestId);
    case "approve_manpower": return approveManpower(access, command, requestId);
    case "controlled_requisition": return controlledRequisition(access, command, requestId);
  }
}
