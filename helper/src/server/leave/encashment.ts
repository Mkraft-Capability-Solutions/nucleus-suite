import "server-only";

import { sqlClient } from "@/lib/db";
import { picklistLabel, type PicklistValue } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { listComponents, listStructureComponents, resolveStructure, STANDARD_COMPONENTS_BY_CODE } from "@/server/payroll/components";
import { ensureComponent, ensurePayrollScaffold } from "@/server/payroll/service";
import { loadLeaveScheme } from "./configuration";
import {
  CLOSED_RUN_STATUSES,
  ENCASHMENT_DECISION_STATUS,
  LEAVE_ENCASHMENT_SETTINGS_PATH,
  LEAVE_TYPE_CODE_BY_PICKLIST,
  encashableDays,
  encashmentPolicyGaps,
  encashmentRefusal,
  estimateEncashment,
  parseEncashmentPolicy,
  type DecideEncashmentInput,
  type EncashableResult,
  type EncashmentEstimate,
  type EncashmentPolicy,
  type EncashmentPolicyGap,
  type RequestEncashmentInput,
  type TagEncashmentInput,
} from "./encashment-rules";
import { ensureLeaveType } from "./leave-types";
import { LEDGER_EFFECTIVE_DATE, leaveBalancesFromLedger, ledgerAttributes } from "./ledger";

/**
 * FRM-LVE-04 Leave Encashment Request.
 *
 * The request reads the balance the ledger holds, the approval records a
 * PL_DECISION, and the payroll step files the payout as a `payroll_inputs` row
 * against an open run and writes the one `encash` movement that reduces the
 * balance — the same ledger kind, source and occurrence discipline the year-end
 * run uses, so the two can never encash the same days twice.
 */

export const LEAVE_ENCASHMENT_SOURCE = "leave.encashment";
const ENCASHMENT_COMPONENT = "leave_encashment";
const SETTINGS_KEY = "leave_encashment";

export type EncashmentStatus = "requested" | "approved" | "rejected" | "returned" | "tagged";

type EmployeeRow = { id: string; basic_salary_minor: number | string | null; currency: string | null };

async function employeeRow(access: Access, employeeId: string): Promise<EmployeeRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, basic_salary_minor, currency from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  const row = (rows as EmployeeRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

async function loadEncashmentPolicy(access: Access): Promise<EncashmentPolicy> {
  const [rows] = await tenantTx(access, [
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const raw = (rows as Array<{ settings: unknown }>)[0]?.settings;
  const bag = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return parseEncashmentPolicy(bag[SETTINGS_KEY]);
}

/**
 * The three candidate monthly wages, resolved the way the settlement working
 * resolves them: the salary assignment against its structure, or basic alone
 * when no structure is assigned.
 */
async function monthlyWages(access: Access, employee: EmployeeRow): Promise<{ basic: number; da: number; gross: number; source: string }> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select salary_structure_id, (attributes->>'basic_minor')::bigint as basic_minor
      from employee_salary_assignments where tenant_id = ${access.tenantId} and employee_id = ${employee.id}
      order by created_at desc limit 1
    `,
  ]);
  const assignment = (rows as Array<{ salary_structure_id: string | null; basic_minor: string | number | null }>)[0];
  const fallbackBasic = Number(employee.basic_salary_minor ?? 0);
  const basic = Number(assignment?.basic_minor ?? fallbackBasic) || fallbackBasic;
  const lines = assignment?.salary_structure_id ? await listStructureComponents(access, assignment.salary_structure_id) : [];
  if (lines.length === 0) {
    return { basic, da: 0, gross: basic, source: assignment ? "salary assignment basic (no structure lines)" : "employees.basic_salary_minor (no salary structure assignment)" };
  }
  const amounts = resolveStructure(lines, basic);
  const definitions: Record<string, { kind: string }> = { ...STANDARD_COMPONENTS_BY_CODE };
  for (const component of await listComponents(access)) definitions[component.code] = component;
  const earnings = Object.entries(amounts).filter(([code]) => (definitions[code]?.kind ?? "earning") === "earning" && code !== "ot");
  return {
    basic: amounts.basic ?? basic,
    da: amounts.da ?? 0,
    gross: earnings.reduce((sum, [, value]) => sum + value, 0),
    source: "employee salary assignment resolved against its salary structure",
  };
}

type LeaveTypeRow = { id: string; code: string; name: string | null; is_encashable: boolean | null; encashment_cap: number | null };

/**
 * Resolves the workbook's PL_LEAVE_TYPE value to the tenant's leave type. The
 * codes the engine already knows resolve directly; any other value must match a
 * configured type by name, because nothing in the app ties the two vocabularies.
 */
async function resolveLeaveType(access: Access, value: PicklistValue<"PL_LEAVE_TYPE">): Promise<LeaveTypeRow> {
  const canonical = LEAVE_TYPE_CODE_BY_PICKLIST[value] ?? null;
  const label = picklistLabel("PL_LEAVE_TYPE", value);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select lt.id, coalesce(lt.attributes->>'code', '') as code, lt.attributes->>'name' as name,
             (lt.attributes->'configuration'->>'is_encashable')::boolean as is_encashable,
             case when coalesce(lt.attributes->'configuration'->>'encashment_cap', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  then (lt.attributes->'configuration'->>'encashment_cap')::float end as encashment_cap
      from leave_types lt
      where lt.tenant_id = ${access.tenantId}
        and (upper(coalesce(lt.attributes->>'code', '')) = ${canonical ?? value.toUpperCase()}
          or lower(coalesce(lt.attributes->>'name', '')) = ${label.toLowerCase()})
      order by case when upper(coalesce(lt.attributes->>'code', '')) = ${canonical ?? value.toUpperCase()} then 0 else 1 end
      limit 1
    `,
  ]);
  const found = (rows as LeaveTypeRow[])[0];
  if (found) return { ...found, code: found.code.toUpperCase(), encashment_cap: found.encashment_cap === null ? null : Number(found.encashment_cap) };
  if (canonical) {
    // A code the engine knows but nobody has configured yet: the row is created bare,
    // exactly as the year-end run does, and stays unconfigured.
    const id = await ensureLeaveType(access, canonical);
    return { id, code: canonical, name: null, is_encashable: null, encashment_cap: null };
  }
  throw new HttpError({
    status: 422,
    code: "LEAVE_TYPE_UNKNOWN",
    message: `No leave type named "${label}" is configured for this tenant, so it cannot be encashed.`,
    details: [{ field: "leaveType", issue: "Configure the type through FRM-LVE-01 first." }],
  });
}

/** Sum of the `encash` movements of one type written in a calendar year. */
async function encashedInYear(access: Access, employeeId: string, leaveTypeId: string, year: number): Promise<number> {
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select coalesce(sum(case when coalesce(l.attributes->>'days', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                then abs((l.attributes->>'days')::float) else 0 end), 0)::float as days
        from leave_ledger_entries l
        where l.tenant_id = $1 and l.employee_id = $2::uuid and l.leave_type_id = $3::uuid
          and lower(coalesce(l.attributes->>'kind', l.attributes->>'transaction_type', '')) in ('encash', 'encashment', 'encashed')
          and left(${LEDGER_EFFECTIVE_DATE}, 4) = $4::text`,
      [access.tenantId, employeeId, leaveTypeId, String(year)],
    ),
  ]);
  return Number((rows as Array<{ days: number }>)[0]?.days ?? 0);
}

/** Days on this type's requests that are still in flight and so already spoken for. */
async function pendingEncashmentDays(access: Access, employeeId: string, leaveTypeId: string, excludingId: string | null): Promise<number> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select coalesce(sum((attributes->>'days_to_encash')::float), 0)::float as days
      from leave_encashments
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and leave_type_id = ${leaveTypeId}
        and attributes->>'status' in ('requested', 'approved')
        and (${excludingId}::uuid is null or id <> ${excludingId}::uuid)
    `,
  ]);
  return Number((rows as Array<{ days: number }>)[0]?.days ?? 0);
}

export type EncashmentQuote = {
  employeeId: string;
  leaveType: PicklistValue<"PL_LEAVE_TYPE">;
  leaveTypeCode: string;
  leaveTypeName: string | null;
  encashableType: boolean;
  /** FRM-LVE-04 `current_balance`, from the ledger. */
  currentBalance: number;
  ceiling: EncashableResult;
  annualCap: number | null;
  encashedThisYear: number;
  pendingDays: number;
  retentionFloorDays: number | null;
  daysToEncash: number | null;
  /** FRM-LVE-04 `rate_basis` and `estimated_amount`; null with the rule named until policy supplies them. */
  estimate: EncashmentEstimate | null;
  wageSource: string;
  currency: string;
  policyGaps: EncashmentPolicyGap[];
  refusal: string | null;
};

/**
 * Everything the form derives: the balance, the ceiling a request may not
 * exceed, and the indicative amount when policy allows one to be computed.
 */
export async function quoteEncashment(
  access: Access,
  args: { employeeId: string; leaveType: PicklistValue<"PL_LEAVE_TYPE">; daysToEncash: number | null; excludingId?: string | null },
): Promise<EncashmentQuote> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const employee = await employeeRow(access, args.employeeId);
  const [type, policy, scheme] = await Promise.all([resolveLeaveType(access, args.leaveType), loadEncashmentPolicy(access), loadLeaveScheme(access)]);
  const balances = await leaveBalancesFromLedger(access, employee.id);
  const currentBalance = balances[type.code]?.balance ?? 0;
  const year = new Date().getUTCFullYear();
  const [encashedThisYear, pendingDays, wages] = await Promise.all([
    encashedInYear(access, employee.id, type.id, year),
    pendingEncashmentDays(access, employee.id, type.id, args.excludingId ?? null),
    monthlyWages(access, employee),
  ]);
  // "Encashable types only": the configured flag, or the client's stated year-end policy for the type.
  const encashableType = type.is_encashable === true || scheme.types[type.code]?.yearEndTreatment === "encash";
  const retentionFloorDays = policy.retentionFloorDays[type.code] ?? null;
  const ceiling = encashableDays({ balance: currentBalance, annualCap: type.encashment_cap, encashedThisYear, pendingDays, retentionFloorDays });
  const estimate = args.daysToEncash === null ? null : estimateEncashment({ days: args.daysToEncash, policy, monthlyWagesMinor: wages });
  const refusal = !encashableType
    ? `${type.name ?? type.code} is not an encashable leave type.`
    : args.daysToEncash === null ? null : encashmentRefusal(args.daysToEncash, ceiling);
  return {
    employeeId: employee.id,
    leaveType: args.leaveType,
    leaveTypeCode: type.code,
    leaveTypeName: type.name,
    encashableType,
    currentBalance,
    ceiling,
    annualCap: type.encashment_cap,
    encashedThisYear,
    pendingDays,
    retentionFloorDays,
    daysToEncash: args.daysToEncash,
    estimate,
    wageSource: wages.source,
    currency: employee.currency ?? "INR",
    policyGaps: encashmentPolicyGaps(policy),
    refusal,
  };
}

export async function requestEncashment(access: Access, input: RequestEncashmentInput, requestId: string) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const quote = await quoteEncashment(access, { employeeId: input.employeeId, leaveType: input.leaveType, daysToEncash: input.daysToEncash });
  if (quote.refusal !== null) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: quote.refusal, details: [{ field: "daysToEncash", issue: quote.refusal }] });
  }
  const type = await resolveLeaveType(access, input.leaveType);
  const id = crypto.randomUUID();
  const attributes = {
    status: "requested" as EncashmentStatus,
    leave_type: input.leaveType,
    leave_type_code: type.code,
    // The balance and ceiling as they stood when the request was made; the ledger stays the authority.
    current_balance: quote.currentBalance,
    encashable_at_request: quote.ceiling.encashable,
    days_to_encash: input.daysToEncash,
    rate_basis: quote.estimate?.rateBasis ?? null,
    estimated_amount_minor: quote.estimate?.amountMinor ?? null,
    estimate_blocked_by: quote.estimate?.blockedBy ?? [],
    currency: quote.currency,
    reason: input.reason ?? null,
    requested_by: access.context.actorUserId,
    decision: null,
    decision_remarks: null,
    approver_id: null,
    tagged_run_id: null,
    tagged_period: null,
  };
  await tenantTx(access, [
    sqlClient`
      insert into leave_encashments (id, tenant_id, employee_id, leave_type_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${type.id}, ${JSON.stringify(attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.encashment_request', 'leave_encashment', ${id}, ${input.reason ?? "Leave encashment requested"},
        ${JSON.stringify({ leaveType: type.code, daysToEncash: input.daysToEncash, estimatedAmountMinor: attributes.estimated_amount_minor })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: attributes.status, estimatedAmountMinor: attributes.estimated_amount_minor, rateBasis: attributes.rate_basis, estimateBlockedBy: attributes.estimate_blocked_by };
}

type EncashmentRow = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  payroll_input_id: string | null;
  attributes: Record<string, unknown> & { status: EncashmentStatus; leave_type: PicklistValue<"PL_LEAVE_TYPE">; leave_type_code: string; days_to_encash: number };
  created_at: string;
};

async function loadEncashment(access: Access, id: string): Promise<EncashmentRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, leave_type_id, payroll_input_id, attributes, created_at::text as created_at
      from leave_encashments where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const row = (rows as EncashmentRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

export async function decideEncashment(access: Access, id: string, input: DecideEncashmentInput, requestId: string) {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const row = await loadEncashment(access, id);
  if (row.attributes.status !== "requested") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Encashment request is ${row.attributes.status}.` });
  }
  if (row.attributes.requested_by === access.context.actorUserId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Self-approval is not permitted." });
  }
  if (input.decision === "approve") {
    // The ceiling is re-read at approval: a leave taken since the request may have moved the balance.
    const quote = await quoteEncashment(access, { employeeId: row.employee_id, leaveType: row.attributes.leave_type, daysToEncash: Number(row.attributes.days_to_encash), excludingId: id });
    if (quote.refusal !== null) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Cannot approve: ${quote.refusal}` });
    }
  }
  const status = ENCASHMENT_DECISION_STATUS[input.decision];
  const decided = { status, decision: input.decision, decision_remarks: input.remarks ?? null, approver_id: access.context.actorUserId };
  await tenantTx(access, [
    sqlClient`update leave_encashments set attributes = attributes || ${JSON.stringify(decided)}::jsonb, version = version + 1, updated_at = now()
      where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`leave.encashment_${input.decision}`}, 'leave_encashment', ${id}, ${input.remarks ?? `Encashment ${input.decision}`}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status, decision: input.decision };
}

/** The last day of a YYYY-MM period: the date the movement takes effect on the ledger. */
function periodEnd(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(lastDay).padStart(2, "0")}`;
}

async function requireOpenRun(access: Access, runId: string): Promise<{ id: string; period: string; status: string }> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, period, status from payroll_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1`,
  ]);
  const run = (rows as Array<{ id: string; period: string; status: string }>)[0];
  if (!run) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The payroll run was not found in this tenant." });
  if ((CLOSED_RUN_STATUSES as readonly string[]).includes(run.status)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `The payroll run is ${run.status} and can take no further inputs.` });
  }
  return run;
}

/**
 * FRM-LVE-04 "Tag to payroll run". Files the payout as a payroll input on the
 * run's period and writes the `encash` movement that reduces the balance.
 *
 * The workbook debits the ledger "only when the run is approved". Run approval
 * lives in `src/server/payroll/service.ts`, which this module may not hook, so
 * the movement is written here — the last step this module controls — dated
 * to the run's period, and recorded in tmp/_audit/requests/forms-lifecycle.md.
 */
export async function tagEncashmentToRun(access: Access, id: string, input: TagEncashmentInput, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const row = await loadEncashment(access, id);
  if (row.attributes.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only approved encashment requests can be tagged to a payroll run." });
  }
  const run = await requireOpenRun(access, input.runId);
  const days = Number(row.attributes.days_to_encash);
  // Payroll recomputes at run time, so the amount is re-priced now rather than copied from the request.
  const quote = await quoteEncashment(access, { employeeId: row.employee_id, leaveType: row.attributes.leave_type, daysToEncash: days, excludingId: id });
  if (quote.estimate === null || quote.estimate.amountMinor === null) {
    throw new HttpError({
      status: 422,
      code: "RULE_PACK_INCOMPLETE",
      message: `The encashment rate is not configured (${(quote.estimate?.blockedBy ?? []).join(", ")}), so no payroll input can be filed. Supply it under ${LEAVE_ENCASHMENT_SETTINGS_PATH}.`,
      details: quote.policyGaps.map((gap) => ({ field: gap.rule, issue: gap.detail })),
    });
  }
  const scaffold = await ensurePayrollScaffold(access, run.period);
  const componentId = await ensureComponent(access, ENCASHMENT_COMPONENT, "earning");
  const inputId = crypto.randomUUID();
  const movementId = crypto.randomUUID();
  const occurrence = `encashment:${id}`;
  const effectiveDate = periodEnd(run.period);
  const tagged = {
    status: "tagged" as EncashmentStatus,
    tagged_run_id: run.id,
    tagged_period: run.period,
    tagged_by: access.context.actorUserId,
    rate_basis: quote.estimate.rateBasis,
    amount_minor: quote.estimate.amountMinor,
    per_day_minor: quote.estimate.perDayMinor,
    ledger_movement_id: movementId,
  };
  await tenantTx(access, [
    sqlClient`
      insert into payroll_inputs (id, tenant_id, employee_id, pay_component_id, pay_period_id, attributes)
      values (${inputId}, ${access.tenantId}, ${row.employee_id}, ${componentId}, ${scaffold.payPeriodId},
        ${JSON.stringify({ amount_minor: quote.estimate.amountMinor, component: ENCASHMENT_COMPONENT, days, rate_basis: quote.estimate.rateBasis, leave_encashment_id: id, payroll_run_id: run.id })}::jsonb)
    `,
    sqlClient`
      insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
      values (${access.tenantId}, ${row.employee_id}, ${row.leave_type_id},
        ${JSON.stringify({
          ...ledgerAttributes({
            employeeId: row.employee_id,
            leaveTypeId: row.leave_type_id,
            leaveType: row.attributes.leave_type_code,
            kind: "encash",
            days,
            effectiveDate,
            source: LEAVE_ENCASHMENT_SOURCE,
            occurrence,
            movementId,
            note: `Encashment of ${days} ${row.attributes.leave_type_code} day${days === 1 ? "" : "s"} filed on payroll run ${run.period}`,
          }),
          leave_encashment_id: id,
          payroll_run_id: run.id,
        })}::jsonb)
    `,
    sqlClient`
      update leave_encashments set payroll_input_id = ${inputId}, attributes = attributes || ${JSON.stringify(tagged)}::jsonb,
        version = version + 1, updated_at = now()
      where id = ${id} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.encashment_tag', 'leave_encashment', ${id}, ${`Tagged to payroll run ${run.period}`},
        ${JSON.stringify({ runId: run.id, period: run.period, amountMinor: quote.estimate.amountMinor, days, payrollInputId: inputId })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: tagged.status, runId: run.id, period: run.period, payrollInputId: inputId, amountMinor: quote.estimate.amountMinor, days };
}

export type EncashmentListRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  payroll_input_id: string | null;
  created_at: string;
  attributes: Record<string, unknown>;
};

export async function listEncashments(access: Access, args: { employeeId?: string | null; status?: string | null }): Promise<EncashmentListRow[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const employeeFilter = args.employeeId ?? null;
  const statusFilter = args.status ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select le.id, le.employee_id, e.employee_code,
             trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as employee_name,
             le.payroll_input_id, le.created_at::text as created_at, le.attributes
      from leave_encashments le
      left join employees e on e.tenant_id = le.tenant_id and e.id = le.employee_id
      where le.tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or le.employee_id = ${employeeFilter}::uuid)
        and (${statusFilter}::text is null or le.attributes->>'status' = ${statusFilter})
      order by le.created_at desc limit 200
    `,
  ]);
  return rows as EncashmentListRow[];
}
