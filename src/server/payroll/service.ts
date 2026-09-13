import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertOtRunAllowed } from "@/server/vp/policy";

export const STANDARD_STRUCTURE = {
  basic: 5_000_000,
  hra: 2_000_000,
  da: 500_000,
  conveyance: 160_000,
  special: 840_000,
} as const;

const COMPONENTS = [
  { code: "basic", kind: "earning" },
  { code: "hra", kind: "earning" },
  { code: "da", kind: "earning" },
  { code: "conveyance", kind: "earning" },
  { code: "special", kind: "earning" },
  { code: "ot", kind: "earning" },
  { code: "pf", kind: "deduction" },
  { code: "esi", kind: "deduction" },
  { code: "pt", kind: "deduction" },
  { code: "tds", kind: "deduction" },
  { code: "loan_recovery", kind: "deduction" },
] as const;

export async function ensureComponent(access: Access, code: string, kind: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from pay_components where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into pay_components (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code, kind })}::jsonb)`,
  ]);
  return id;
}

export async function ensurePayrollScaffold(access: Access, period: string) {
  const [countryRows] = await tenantTx(access, [
    sqlClient`select id from countries where iso_code = 'IN' limit 1`,
  ]);
  let countryId = (countryRows as Array<{ id: string }>)[0]?.id;
  if (!countryId) {
    countryId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into countries (id, iso_code, name, default_currency_code, default_timezone) values (${countryId}, 'IN', 'India', 'INR', 'Asia/Kolkata')`,
    ]);
  }
  const [jurisdictionQueryRows] = await tenantTx(access, [
    sqlClient`
      select j.id from jurisdictions j join countries c on c.id = j.country_id
      where c.iso_code = 'IN' order by j.valid_from desc limit 1
    `,
  ]);
  let jurisdictionId = (jurisdictionQueryRows as Array<{ id: string }>)[0]?.id;
  if (!jurisdictionId) {
    jurisdictionId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into jurisdictions (id, country_id, code, name, kind) values (${jurisdictionId}, ${countryId}, 'IN', 'India', 'country')`,
    ]);
  }
  const [entityRows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} limit 1`,
  ]);
  let entityId = (entityRows as Array<{ id: string }>)[0]?.id;
  if (!entityId) {
    entityId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status) values (${entityId}, ${access.tenantId}, ${jurisdictionId}, 'MK-IND', 'MKraft Industrial Systems Pvt Ltd', 'INR', 'active')`,
    ]);
  }
  const [groupRows] = await tenantTx(access, [
    sqlClient`select id from pay_groups where tenant_id = ${access.tenantId} and attributes->>'code' = 'HO-MONTHLY' limit 1`,
  ]);
  let groupId = (groupRows as Array<{ id: string }>)[0]?.id;
  if (!groupId) {
    groupId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into pay_groups (id, tenant_id, legal_entity_id, attributes) values (${groupId}, ${access.tenantId}, ${entityId}, '{"code":"HO-MONTHLY","name":"Head Office Monthly","currency":"INR"}'::jsonb)`,
    ]);
  }
  const [periodRows] = await tenantTx(access, [
    sqlClient`select id from pay_periods where tenant_id = ${access.tenantId} and pay_group_id = ${groupId} and attributes->>'code' = ${period} limit 1`,
  ]);
  let payPeriodId = (periodRows as Array<{ id: string }>)[0]?.id;
  if (!payPeriodId) {
    payPeriodId = crypto.randomUUID();
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    await tenantTx(access, [
      sqlClient`insert into pay_periods (id, tenant_id, pay_group_id, attributes) values (${payPeriodId}, ${access.tenantId}, ${groupId}, ${JSON.stringify({ code: period, starts_on: `${period}-01`, ends_on: `${period}-${String(lastDay).padStart(2, "0")}`, status: "open" })}::jsonb)`,
    ]);
  }
  // Rule packs are global reference data: rule_pack_versions has no tenant_id.
  // countryId is already ensured above.
  const [packParentRows] = await tenantTx(access, [
    sqlClient`select id from statutory_rule_packs where country_id = ${countryId} and attributes->>'code' = 'in-pay' limit 1`,
  ]);
  let packParentId = (packParentRows as Array<{ id: string }>)[0]?.id;
  if (!packParentId) {
    packParentId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into statutory_rule_packs (id, country_id, jurisdiction_id, attributes) values (${packParentId}, ${countryId}, ${jurisdictionId}, '{"code":"in-pay","scope":"country-level-india"}'::jsonb)`,
    ]);
  }
  const [packRows] = await tenantTx(access, [
    sqlClient`select id from rule_pack_versions where statutory_rule_pack_id = ${packParentId} and attributes->>'code' = 'in-pay/v1' limit 1`,
  ]);
  let packId = (packRows as Array<{ id: string }>)[0]?.id;
  if (!packId) {
    packId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into rule_pack_versions (id, statutory_rule_pack_id, attributes) values (${packId}, ${packParentId}, '{"code":"in-pay/v1","status":"approved","scope":"country-level-india"}'::jsonb)`,
    ]);
  }
  const [structureRows] = await tenantTx(access, [
    sqlClient`select id from salary_structures where tenant_id = ${access.tenantId} and pay_group_id = ${groupId} and attributes->>'code' = 'STD-2026' limit 1`,
  ]);
  let structureId = (structureRows as Array<{ id: string }>)[0]?.id;
  if (!structureId) {
    structureId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into salary_structures (id, tenant_id, pay_group_id, attributes) values (${structureId}, ${access.tenantId}, ${groupId}, ${JSON.stringify({ code: "STD-2026", lines: STANDARD_STRUCTURE })}::jsonb)`,
    ]);
  }
  return { groupId, payPeriodId, packId, structureId };
}

async function ensureAssignment(access: Access, employeeId: string, groupId: string, structureId: string): Promise<{ id: string; basicMinor: number | null }> {
  const [rows] = await tenantTx(access, [
    sqlClient`select a.id, (a.attributes->>'basic_minor')::bigint as basic_minor from employee_salary_assignments a where a.tenant_id = ${access.tenantId} and a.employee_id = ${employeeId} and a.pay_group_id = ${groupId} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string; basic_minor: number | string | null }>)[0];
  if (existing) return { id: existing.id, basicMinor: existing.basic_minor === null ? null : Number(existing.basic_minor) };
  const [empRows] = await tenantTx(access, [
    sqlClient`select basic_salary_minor from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  const basicMinor = (empRows as Array<{ basic_salary_minor: number | string | null }>)[0]?.basic_salary_minor ?? null;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into employee_salary_assignments (id, tenant_id, employee_id, pay_group_id, salary_structure_id, attributes) values (${id}, ${access.tenantId}, ${employeeId}, ${groupId}, ${structureId}, ${JSON.stringify({ basic_minor: basicMinor === null ? null : Number(basicMinor) })}::jsonb)`,
  ]);
  return { id, basicMinor: basicMinor === null ? null : Number(basicMinor) };
}

export const createRunSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  scope: z.enum(["regular", "ot"]).default("regular"),
});

export async function createRun(access: Access, input: z.infer<typeof createRunSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const scaffold = await ensurePayrollScaffold(access, input.period);
  if (input.scope === "ot") {
    const [regularRows] = await tenantTx(access, [
      sqlClient`select status from payroll_runs where tenant_id = ${access.tenantId} and period = ${input.period} and scope = 'regular' order by created_at desc limit 1`,
    ]);
    const regularStatus = (regularRows as Array<{ status: string }>)[0]?.status ?? null;
    try {
      assertOtRunAllowed(input.scope, regularStatus);
    } catch (error) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: error instanceof Error ? error.message : "Regular salary must be finalized before OT." });
    }
  }
  const [dupRows] = await tenantTx(access, [
    sqlClient`select id from payroll_runs where tenant_id = ${access.tenantId} and period = ${input.period} and scope = ${input.scope} limit 1`,
  ]);
  if ((dupRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `A ${input.scope} run already exists for ${input.period}.` });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into payroll_runs (id, tenant_id, period, scope, status, pay_group_id, pay_period_id, rule_pack_version_id)
      values (${id}, ${access.tenantId}, ${input.period}, ${input.scope}, 'draft', ${scaffold.groupId}, ${scaffold.payPeriodId}, ${scaffold.packId})
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.run_create', 'payroll_run', ${id}, 'Payroll run drafted',
        ${JSON.stringify({ period: input.period, scope: input.scope, created_by: access.context.actorUserId })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, period: input.period, scope: input.scope, status: "draft" };
}

type RunRow = { id: string; period: string; scope: string; status: string; pay_group_id: string; pay_period_id: string; rule_pack_version_id: string };

async function loadRun(access: Access, runId: string): Promise<RunRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, period, scope, status, pay_group_id, pay_period_id, rule_pack_version_id from payroll_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1`,
  ]);
  const run = (rows as RunRow[])[0];
  if (!run) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return run;
}

function assertMutable(run: RunRow): void {
  if (run.status === "finalized" || run.status === "paid" || run.status === "closed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `A ${run.status} run is immutable.` });
  }
}

async function raiseAnomaly(access: Access, runId: string, employeeId: string, ruleCode: string, severity: string, facts: unknown): Promise<void> {
  await tenantTx(access, [
    sqlClient`
      insert into payroll_anomalies (tenant_id, payroll_run_id, employee_id, rule_code, severity, facts)
      values (${access.tenantId}, ${runId}, ${employeeId}, ${ruleCode}, ${severity}, ${JSON.stringify(facts)}::jsonb)
    `,
  ]);
}

export async function calculateRun(access: Access, runId: string, employeeIds: string[] | undefined, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  assertMutable(run);
  const scaffold = await ensurePayrollScaffold(access, run.period);
  const componentIds: Record<string, string> = {};
  for (const component of COMPONENTS) componentIds[component.code] = await ensureComponent(access, component.code, component.kind);
  const [employeeRows] = await tenantTx(access, [
    employeeIds && employeeIds.length > 0
      ? sqlClient`select id, basic_salary_minor from employees where tenant_id = ${access.tenantId} and id = any(${employeeIds})`
      : sqlClient`select id, basic_salary_minor from employees where tenant_id = ${access.tenantId} and status = 'active'`,
  ]);
  const employees = (employeeRows as Array<{ id: string; basic_salary_minor: number | string | null }>).map((row) => ({
    id: row.id,
    basic_salary_minor: row.basic_salary_minor === null ? null : Number(row.basic_salary_minor),
  }));
  let gross = 0, deductions = 0, calculated = 0;
  for (const employee of employees) {
    const assignment = await ensureAssignment(access, employee.id, scaffold.groupId, scaffold.structureId);
    const basic = assignment.basicMinor ?? employee.basic_salary_minor;
    if (!basic || basic <= 0) {
      await raiseAnomaly(access, runId, employee.id, "missing-salary", "high", { reason: "No basic salary available for calculation." });
      continue;
    }
    if (run.scope === "ot") {
      const [otRows] = await tenantTx(access, [
        sqlClient`select coalesce(sum(payable_ot_minutes), 0)::int as minutes from attendance_days where tenant_id = ${access.tenantId} and employee_id = ${employee.id} and attendance_date::text like ${`${run.period}%`} and locked_at is not null`,
      ]);
      const minutes = (otRows as Array<{ minutes: number }>)[0]?.minutes ?? 0;
      if (minutes <= 0) continue;
      const hourlyMinor = basic / (30 * 8 * 60);
      const amount = Math.round(hourlyMinor * minutes * 2);
      await persistEmployeeResult(access, run, employee.id, assignment.id, [{ code: "ot", kind: "earning", amount }], componentIds, requestId);
      gross += amount;
      calculated += 1;
      if (minutes > 3600) await raiseAnomaly(access, runId, employee.id, "ot-outlier", "medium", { minutes });
      continue;
    }
    const hra = Math.round(basic * 0.4);
    const da = Math.round(basic * 0.1);
    const conveyance = STANDARD_STRUCTURE.conveyance;
    const special = STANDARD_STRUCTURE.special;
    const earnings = basic + hra + da + conveyance + special;
    const pf = Math.min(Math.round((basic + da) * 0.12), Math.round(1_500_000 * 0.12));
    const esi = earnings > 2_100_000 ? 0 : Math.round(earnings * 0.0075);
    const pt = 20_000;
    const [inputRows] = await tenantTx(access, [
      sqlClient`
        select attributes->>'component' as component, (attributes->>'amount_minor')::bigint as amount
        from payroll_inputs where tenant_id = ${access.tenantId} and employee_id = ${employee.id} and pay_period_id = ${scaffold.payPeriodId}
      `,
    ]);
    const inputsByComponent: Record<string, number> = {};
    for (const row of inputRows as Array<{ component: string; amount: number | null }>) {
      if (row.component === "loan_recovery") continue;
      inputsByComponent[row.component] = Number(row.amount ?? 0);
    }
    const tds = inputsByComponent.tds ?? 0;
    const extraLines: Array<{ code: string; kind: string; amount: number }> = [];
    for (const [code, amount] of Object.entries(inputsByComponent)) {
      if (code === "tds" || amount === 0) continue;
      const kind = ["advance_paid", "bonus", "arrear", "overtime_extra"].includes(code) ? "earning" : "deduction";
      extraLines.push({ code, kind, amount });
    }
    const [loanRows] = await tenantTx(access, [
      sqlClient`
        select id, (attributes->>'outstanding_minor')::bigint as outstanding
        from employee_loans
        where tenant_id = ${access.tenantId} and employee_id = ${employee.id} and attributes->>'status' = 'disbursed'
        order by created_at limit 1
      `,
    ]);
    const loan = (loanRows as Array<{ id: string; outstanding: number }>)[0];
    const loanRecovery = loan ? Math.min(Math.round(basic * 0.2), Number(loan.outstanding)) : 0;
    for (const extra of extraLines) {
      if (!componentIds[extra.code]) componentIds[extra.code] = await ensureComponent(access, extra.code, extra.kind);
    }
    const lines = [
      { code: "basic", kind: "earning", amount: basic },
      { code: "hra", kind: "earning", amount: hra },
      { code: "da", kind: "earning", amount: da },
      { code: "conveyance", kind: "earning", amount: conveyance },
      { code: "special", kind: "earning", amount: special },
      { code: "pf", kind: "deduction", amount: pf },
      { code: "esi", kind: "deduction", amount: esi },
      { code: "pt", kind: "deduction", amount: pt },
      { code: "tds", kind: "deduction", amount: tds },
      ...(loanRecovery > 0 ? [{ code: "loan_recovery", kind: "deduction", amount: loanRecovery }] : []),
      ...extraLines,
    ];
    const extraEarnings = extraLines.filter((line) => line.kind === "earning").reduce((total, line) => total + line.amount, 0);
    const extraDeductions = extraLines.filter((line) => line.kind === "deduction").reduce((total, line) => total + line.amount, 0);
    const net = earnings + extraEarnings - (pf + esi + pt + tds + loanRecovery + extraDeductions);
    if (net < 0) {
      await raiseAnomaly(access, runId, employee.id, "negative-net", "high", { earnings, deductions: pf + esi + pt + tds + loanRecovery + extraDeductions });
      continue;
    }
    await persistEmployeeResult(access, run, employee.id, assignment.id, lines, componentIds, requestId, loan?.id, loanRecovery);
    gross += earnings + extraEarnings;
    deductions += pf + esi + pt + tds + loanRecovery + extraDeductions;
    calculated += 1;
  }
  const net = gross - deductions;
  await tenantTx(access, [
    sqlClient`update payroll_runs set status = 'calculated', employee_count = ${calculated}, gross_minor = ${gross}, deductions_minor = ${deductions}, net_minor = ${net}, updated_at = now() where id = ${run.id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.calculate', 'payroll_run', ${run.id}, 'Run calculated deterministically',
        ${JSON.stringify({ calculated, gross, deductions, net })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { runId: run.id, calculated, gross, deductions, net };
}

async function persistEmployeeResult(
  access: Access,
  run: RunRow,
  employeeId: string,
  assignmentId: string,
  lines: Array<{ code: string; kind: string; amount: number }>,
  componentIds: Record<string, string>,
  requestId: string,
  loanId?: string,
  loanRecovery?: number,
): Promise<string> {
  const runEmployeeId = crypto.randomUUID();
  const gross = lines.filter((line) => line.kind === "earning").reduce((total, line) => total + line.amount, 0);
  const deductions = lines.filter((line) => line.kind === "deduction").reduce((total, line) => total + line.amount, 0);
  await tenantTx(access, [
    sqlClient`
      insert into payroll_run_employees (id, tenant_id, employee_id, payroll_run_id, salary_assignment_id, attributes)
      values (${runEmployeeId}, ${access.tenantId}, ${employeeId}, ${run.id}, ${assignmentId},
        ${JSON.stringify({ gross_minor: gross, deductions_minor: deductions, net_minor: gross - deductions, rule: "in-pay/v1" })}::jsonb)
    `,
    ...lines.map((line) => sqlClient`
      insert into payroll_lines (tenant_id, pay_component_id, payroll_run_employee_id, attributes)
      values (${access.tenantId}, ${componentIds[line.code]}, ${runEmployeeId},
        ${JSON.stringify({ code: line.code, kind: line.kind, amount_minor: line.amount })}::jsonb)
    `),
    ...(loanId && loanRecovery
      ? [sqlClient`
        insert into loan_transactions (tenant_id, employee_loan_id, attributes)
        values (${access.tenantId}, ${loanId}, ${JSON.stringify({ kind: "recovery", amount_minor: loanRecovery, payroll_run_id: run.id })}::jsonb)
      `,
        sqlClient`
          update employee_loans
          set attributes = jsonb_set(attributes, '{outstanding_minor}', to_jsonb((attributes->>'outstanding_minor')::bigint - ${loanRecovery})),
              updated_at = now()
          where id = ${loanId} and tenant_id = ${access.tenantId}`,
        sqlClient`
          update loans set outstanding_minor = outstanding_minor - ${loanRecovery}, updated_at = now()
          where id = ${loanId} and tenant_id = ${access.tenantId}`]
      : []),
  ]);
  void requestId;
  return runEmployeeId;
}

export async function approveRun(access: Access, runId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  assertMutable(run);
  if (run.status !== "calculated") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only a calculated run can be approved." });
  }
  await tenantTx(access, [
    sqlClient`
      insert into payroll_approvals (tenant_id, membership_id, payroll_run_id, attributes)
      values (${access.tenantId}, ${access.context.membershipId}, ${runId},
        ${JSON.stringify({ stage: "final", decision: "approved", actor: access.context.actorUserId })}::jsonb)
    `,
    sqlClient`update payroll_runs set status = 'approved', updated_at = now() where id = ${runId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.approve', 'payroll_run', ${runId}, 'Run approved', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: runId, status: "approved" };
}

export async function finalizeRun(access: Access, runId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  assertMutable(run);
  if (run.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only an approved run can be finalized." });
  }
  const [approvalRows] = await tenantTx(access, [
    sqlClient`select attributes->>'actor' as actor from payroll_approvals where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} and attributes->>'decision' = 'approved'`,
  ]);
  const approvers = new Set((approvalRows as Array<{ actor: string }>).map((row) => row.actor));
  if (!approvers.size || (approvers.size === 1 && approvers.has(access.context.actorUserId))) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Finalization requires a maker/checker pair: an approver distinct from the finalizer." });
  }
  const [typeRows] = await tenantTx(access, [
    sqlClient`select id from document_types where tenant_id = ${access.tenantId} and attributes->>'code' = 'PAYSLIP' limit 1`,
  ]);
  let payslipTypeId = (typeRows as Array<{ id: string }>)[0]?.id;
  if (!payslipTypeId) {
    payslipTypeId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into document_types (id, tenant_id, attributes) values (${payslipTypeId}, ${access.tenantId}, '{"code":"PAYSLIP","name":"Payslip"}'::jsonb)`,
    ]);
  }
  const [memberRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes from payroll_run_employees where tenant_id = ${access.tenantId} and payroll_run_id = ${runId}`,
  ]);
  const members = memberRows as Array<{ id: string; employee_id: string; attributes: { gross_minor: number; deductions_minor: number; net_minor: number } }>;
  await tenantTx(access, [
    sqlClient`update payroll_runs set status = 'finalized', finalized_at = now(), updated_at = now() where id = ${runId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      update salary_advances set attributes = attributes || '{"status":"recovered"}'::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and attributes->>'status' = 'paid'
        and payroll_input_id in (select id from payroll_inputs where tenant_id = ${access.tenantId} and pay_period_id = ${run.pay_period_id})
    `,
    ...members.flatMap((member) => {
      const documentId = crypto.randomUUID();
      const payslipId = crypto.randomUUID();
      return [
        sqlClient`
          insert into documents (id, tenant_id, document_type_id, employee_id, attributes)
          values (${documentId}, ${access.tenantId}, ${payslipTypeId}, ${member.employee_id},
            ${JSON.stringify({ title: `Payslip ${run.period}`, current_version: 1 })}::jsonb)
        `,
        sqlClient`
          insert into payslips (id, tenant_id, document_id, payroll_run_employee_id, attributes)
          values (${payslipId}, ${access.tenantId}, ${documentId}, ${member.id},
            ${JSON.stringify({ period: run.period, scope: run.scope, totals: member.attributes })}::jsonb)
        `,
      ];
    }),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.finalize', 'payroll_run', ${runId}, 'Run finalized and immutable', ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'payroll.finalized', 'payroll_run', ${runId}, ${JSON.stringify({ period: run.period, scope: run.scope })}::jsonb)
    `,
  ]);
  return { id: runId, status: "finalized", payslips: members.length };
}

export async function getRun(access: Access, runId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  const [memberRows, anomalyRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes from payroll_run_employees where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} order by created_at`,
    sqlClient`select id, employee_id, rule_code, severity, status from payroll_anomalies where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} order by created_at`,
  ]);
  return { run, members: memberRows, anomalies: anomalyRows };
}

export async function listRuns(access: Access, args: { period?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from payroll_runs where tenant_id = ${access.tenantId} and (${args.period ?? null}::text is null or period = ${args.period})`,
    sqlClient`
      select id, period, scope, status, employee_count, gross_minor, deductions_minor, net_minor, currency, finalized_at
      from payroll_runs where tenant_id = ${access.tenantId} and (${args.period ?? null}::text is null or period = ${args.period})
      order by period desc, created_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export async function getJournal(access: Access, runId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  const [lineRows] = await tenantTx(access, [
    sqlClient`
      select (l.attributes->>'code') as code, (l.attributes->>'kind') as kind, (l.attributes->>'amount_minor')::bigint as amount
      from payroll_lines l join payroll_run_employees e on e.id = l.payroll_run_employee_id
      where l.tenant_id = ${access.tenantId} and e.payroll_run_id = ${runId}
    `,
  ]);
  const lines = lineRows as Array<{ code: string; kind: string; amount: number }>;
  const byCode: Record<string, number> = {};
  for (const line of lines) byCode[line.code] = (byCode[line.code] ?? 0) + Number(line.amount);
  const earnings = lines.filter((line) => line.kind === "earning").reduce((total, line) => total + Number(line.amount), 0);
  const deductions = lines.filter((line) => line.kind === "deduction").reduce((total, line) => total + Number(line.amount), 0);
  const journal = [
    { account: "salary-expense", debitMinor: earnings, creditMinor: 0 },
    { account: "bank-payable", debitMinor: 0, creditMinor: earnings - deductions },
    { account: "pf-payable", debitMinor: 0, creditMinor: byCode.pf ?? 0 },
    { account: "esi-payable", debitMinor: 0, creditMinor: byCode.esi ?? 0 },
    { account: "pt-payable", debitMinor: 0, creditMinor: byCode.pt ?? 0 },
    { account: "tds-payable", debitMinor: 0, creditMinor: byCode.tds ?? 0 },
    { account: "loan-recovery-payable", debitMinor: 0, creditMinor: byCode.loan_recovery ?? 0 },
  ].filter((entry) => entry.debitMinor !== 0 || entry.creditMinor !== 0);
  const balanced = journal.reduce((total, entry) => total + entry.debitMinor, 0) === journal.reduce((total, entry) => total + entry.creditMinor, 0);
  return { runId: run.id, period: run.period, balanced, journal };
}

export async function getPayslip(access: Access, payslipId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select p.id, p.attributes, e.employee_id, r.period, r.scope
      from payslips p
      join payroll_run_employees e on e.id = p.payroll_run_employee_id
      join payroll_runs r on r.id = e.payroll_run_id
      where p.tenant_id = ${access.tenantId} and p.id = ${payslipId} limit 1
    `,
  ]);
  const slip = (rows as Array<{ id: string; attributes: unknown; employee_id: string; period: string; scope: string }>)[0];
  if (!slip) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [lineRows] = await tenantTx(access, [
    sqlClient`
      select (attributes->>'code') as code, (attributes->>'kind') as kind, (attributes->>'amount_minor')::bigint as amount
      from payroll_lines where tenant_id = ${access.tenantId} and payroll_run_employee_id = (select payroll_run_employee_id from payslips where id = ${payslipId} and tenant_id = ${access.tenantId})
      order by created_at
    `,
  ]);
  return { ...slip, lines: lineRows };
}

export async function listAnomalies(access: Access, runId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, rule_code, severity, facts, status, resolution from payroll_anomalies where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} order by created_at`,
  ]);
  return rows;
}

/** Command-centre lookup that runs in parallel with the payroll summary. */
export async function listLatestRunAnomalies(access: Access) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_id, rule_code, severity, facts, status, resolution
      from payroll_anomalies
      where tenant_id = ${access.tenantId}
        and payroll_run_id = (
          select id from payroll_runs
          where tenant_id = ${access.tenantId}
          order by created_at desc limit 1
        )
      order by created_at
      limit 20
    `,
  ]);
  return rows;
}

export const resolveAnomalySchema = z.object({ status: z.enum(["acknowledged", "resolved", "overridden"]), resolution: z.string().trim().min(1).max(500) });

export async function resolveAnomaly(access: Access, anomalyId: string, input: z.infer<typeof resolveAnomalySchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, status from payroll_anomalies where tenant_id = ${access.tenantId} and id = ${anomalyId} limit 1`,
  ]);
  const anomaly = (rows as Array<{ id: string; status: string }>)[0];
  if (!anomaly) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (anomaly.status !== "open") throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The anomaly is already resolved." });
  await tenantTx(access, [
    sqlClient`update payroll_anomalies set status = ${input.status}, resolution = ${input.resolution}, updated_at = now() where id = ${anomalyId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`payroll.anomaly_${input.status}`}, 'payroll_anomaly', ${anomalyId}, ${input.resolution}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: anomalyId, status: input.status };
}

export async function simulateWageBase(access: Access, args: { basicMinor: number; dearnessMinor: number; scenario: string }, requestId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  if (args.basicMinor < 0 || args.dearnessMinor < 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Wage inputs must be non-negative." });
  }
  const [packRows] = await tenantTx(access, [
    sqlClient`select id from rule_pack_versions where attributes->>'code' = 'in-pay/v1' limit 1`,
  ]);
  let packId = (packRows as Array<{ id: string }>)[0]?.id;
  const now = new Date();
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const scaffold = await ensurePayrollScaffold(access, currentPeriod);
  if (!packId) packId = scaffold.packId;
  const result = args.basicMinor + args.dearnessMinor;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into wage_base_simulations (id, tenant_id, requested_by_membership_id, rule_pack_version_id, salary_structure_id, attributes)
      values (${id}, ${access.tenantId}, ${access.context.membershipId}, ${packId}, ${scaffold.structureId},
        ${JSON.stringify({ scenario: args.scenario, inputs: { basic_minor: args.basicMinor, dearness_minor: args.dearnessMinor }, result_minor: result, posted: false, formula: "wage-base/v1" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.wage_simulate', 'wage_base_simulation', ${id}, 'Wage-base simulation (non-posting)', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, resultMinor: result, posted: false };
}

export const INPUT_COMPONENTS = ["tds", "bonus", "arrear", "advance_paid", "advance_recovery", "overtime_extra", "other"] as const;

export const upsertInputSchema = z.object({
  employeeId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  component: z.enum(INPUT_COMPONENTS),
  amountMinor: z.number().int(),
  note: z.string().trim().max(500).optional(),
});

export async function upsertPayrollInput(access: Access, input: z.infer<typeof upsertInputSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const scaffold = await ensurePayrollScaffold(access, input.period);
  const kind = ["advance_paid", "bonus", "arrear", "overtime_extra"].includes(input.component) ? "earning" : "deduction";
  const componentId = await ensureComponent(access, input.component, kind);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, attributes from payroll_inputs
      where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId}
        and pay_period_id = ${scaffold.payPeriodId} and pay_component_id = ${componentId} limit 1
    `,
  ]);
  const existing = (rows as Array<{ id: string; attributes: { amount_minor: number } }>)[0];
  if (existing) {
    const before = Number(existing.attributes.amount_minor ?? 0);
    await tenantTx(access, [
      sqlClient`
        update payroll_inputs set attributes = attributes || ${JSON.stringify({ amount_minor: input.amountMinor, component: input.component, note: input.note ?? null })}::jsonb
        where id = ${existing.id} and tenant_id = ${access.tenantId}
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'payroll.input_update', 'payroll_input', ${existing.id}, 'Payroll input corrected',
          ${JSON.stringify({ before_minor: before, after_minor: input.amountMinor })}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);
    return { id: existing.id, updated: true };
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into payroll_inputs (id, tenant_id, employee_id, pay_component_id, pay_period_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${componentId}, ${scaffold.payPeriodId},
        ${JSON.stringify({ amount_minor: input.amountMinor, component: input.component, note: input.note ?? null })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.input_create', 'payroll_input', ${id}, 'Payroll input recorded', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, updated: false };
}

export async function listPayrollInputs(access: Access, args: { employeeId?: string | null; period?: string | null }) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const employeeFilter = args.employeeId ?? null;
  const periodFilter = args.period ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select i.id, i.employee_id, (i.attributes->>'component') as component,
             (i.attributes->>'amount_minor')::bigint as amount_minor, p.attributes->>'code' as period
      from payroll_inputs i join pay_periods p on p.id = i.pay_period_id
      where i.tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or i.employee_id = ${args.employeeId})
        and (${periodFilter}::text is null or p.attributes->>'code' = ${args.period})
      order by i.created_at desc limit 200
    `,
  ]);
  return rows;
}

export const correctRunSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  adjustments: z.array(z.object({
    employeeId: z.string().uuid(),
    component: z.string().trim().min(1).max(60),
    amountMinor: z.number().int().refine((value) => value !== 0, "Adjustments must be non-zero."),
    reversesLineId: z.string().uuid().optional(),
  })).min(1).max(200),
});

export async function correctRun(access: Access, runId: string, input: z.infer<typeof correctRunSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const source = await loadRun(access, runId);
  if (source.status !== "finalized") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Corrections apply only to finalized runs; the source run is untouched." });
  }
  const correctionId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into payroll_runs (id, tenant_id, period, scope, status, pay_group_id, pay_period_id, rule_pack_version_id)
      values (${correctionId}, ${access.tenantId}, ${source.period}, 'correction', 'draft', ${source.pay_group_id}, ${source.pay_period_id}, ${source.rule_pack_version_id})
    `,
  ]);
  let gross = 0, deductions = 0, calculated = 0;
  for (const adjustment of input.adjustments) {
    const [assignmentRows] = await tenantTx(access, [
      sqlClient`select id from employee_salary_assignments where tenant_id = ${access.tenantId} and employee_id = ${adjustment.employeeId} order by created_at desc limit 1`,
    ]);
    const assignmentId = (assignmentRows as Array<{ id: string }>)[0]?.id;
    if (!assignmentId) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Correction needs an existing salary assignment per employee." });
    }
    if (adjustment.reversesLineId) {
      const [lineRows] = await tenantTx(access, [
        sqlClient`
          select l.id from payroll_lines l join payroll_run_employees e on e.id = l.payroll_run_employee_id
          where l.tenant_id = ${access.tenantId} and l.id = ${adjustment.reversesLineId} and e.payroll_run_id = ${runId} limit 1
        `,
      ]);
      if ((lineRows as unknown[]).length === 0) {
        throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Reversed lines must belong to the corrected run." });
      }
    }
    const kind = adjustment.amountMinor > 0 ? "earning" : "deduction";
    const magnitude = Math.abs(adjustment.amountMinor);
    const componentId = await ensureComponent(access, adjustment.component, kind === "earning" ? "earning" : "deduction");
    const runEmployeeId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`
        insert into payroll_run_employees (id, tenant_id, employee_id, payroll_run_id, salary_assignment_id, attributes)
        values (${runEmployeeId}, ${access.tenantId}, ${adjustment.employeeId}, ${correctionId}, ${assignmentId},
          ${JSON.stringify({ gross_minor: kind === "earning" ? magnitude : 0, deductions_minor: kind === "deduction" ? magnitude : 0, net_minor: adjustment.amountMinor, rule: "in-pay/v1", correction: true })}::jsonb)
      `,
      sqlClient`
        insert into payroll_lines (tenant_id, pay_component_id, payroll_run_employee_id, reverses_line_id, attributes)
        values (${access.tenantId}, ${componentId}, ${runEmployeeId}, ${adjustment.reversesLineId ?? null},
          ${JSON.stringify({ code: adjustment.component, kind, amount_minor: magnitude, sign: adjustment.amountMinor > 0 ? 1 : -1 })}::jsonb)
      `,
    ]);
    if (kind === "earning") gross += magnitude; else deductions += magnitude;
    calculated += 1;
  }
  const net = gross - deductions;
  await tenantTx(access, [
    sqlClient`update payroll_runs set status = 'calculated', employee_count = ${calculated}, gross_minor = ${gross}, deductions_minor = ${deductions}, net_minor = ${net}, updated_at = now() where id = ${correctionId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.correct', 'payroll_run', ${correctionId}, ${input.reason},
        ${JSON.stringify({ corrects_run_id: runId, adjustments: input.adjustments.length })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'payroll.correction_ready', 'payroll_run', ${correctionId}, ${JSON.stringify({ corrects_run_id: runId })}::jsonb)
    `,
  ]);
  return { correctionId, calculated, gross, deductions, net };
}
