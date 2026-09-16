import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { loadLeaveScheme, leaveSchemeGaps, type LeaveSchemeGap } from "./configuration";
import { ensureLeaveTypes } from "./leave-types";
import { ledgerAttributes, writtenOccurrences } from "./ledger";
import { planLeaveAccrual, periodOf, type AccrualPlan, type LeaveScheme } from "./scheme";

/**
 * The leave accrual engine — one implementation, two callers.
 *
 * Before this module there were two disjoint engines: the scheduled task
 * (`leave.accrue_monthly`) credited EL only and skipped every senior employee,
 * while the VP command (`run_leave_maintenance`) credited EL plus CL and SL in
 * January under a different ledger `kind`. Neither could see the other's
 * idempotency key, so running both double-credited the same month.
 *
 * `runLeaveAccrual` is now the only place accrual is decided or written. Both
 * entry points call it, share one occurrence key per employee per event, and a
 * second run — from either side — writes nothing.
 */

export type LeaveRunMode = "preview" | "commit";

/** RL-14's run mode, and the workbook's default: nothing is written unless asked. */
export const DEFAULT_RUN_MODE: LeaveRunMode = "preview";

export const LEAVE_ACCRUAL_SOURCE = "leave.accrual";

export type AccrualCreditLine = {
  employeeId: string;
  employeeCode: string | null;
  leaveType: string;
  days: number;
  basis: string;
  occurrence: string;
  movementId: string;
  note: string;
};

export type BlockedEmployee = {
  employeeId: string;
  employeeCode: string | null;
  code: string;
  message: string;
};

export type LeaveAccrualResult = {
  mode: LeaveRunMode;
  /** The date the accrual takes effect, and the date every line is stamped with. */
  asOf: string;
  period: string;
  /** Employees who received at least one line. */
  employees: number;
  /** One movement per employee credited — RL-07's 18/6/6 is one movement, three lines. */
  movements: number;
  /** Ledger lines written (or that would be written in preview). */
  lines: number;
  /** Days credited per leave type. */
  days: Record<string, number>;
  credits: AccrualCreditLine[];
  /** Employees skipped because they already carry the occurrence. */
  alreadyCredited: number;
  blocked: BlockedEmployee[];
  configurationGaps: LeaveSchemeGap[];
};

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  designation_level: number;
  joining_date: string;
  trainee_type: string | null;
};

const EMPLOYEE_SELECT = `select e.id, e.employee_code, coalesce(e.designation_level, 0) as designation_level,
    e.joining_date::text as joining_date,
    coalesce(e.metadata->>'trainee_type', e.metadata->>'traineeType') as trainee_type
  from employees e
  where e.tenant_id = $1 and e.status = 'active'
    and ($2::uuid is null or e.id = $2::uuid)
  order by e.employee_code asc
  limit 5000`;

async function accrualPopulation(access: Access, employeeId: string | null): Promise<EmployeeRow[]> {
  const [rows] = await tenantTx(access, [sqlClient.query(EMPLOYEE_SELECT, [access.tenantId, employeeId])]);
  return rows as EmployeeRow[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-\d{2}$/;

/**
 * The effective date of one accrual run.
 *
 * A caller may name either a date or an accrual period. A period resolves to its
 * first day, which is what RL-08's "1.5 EL each month" and T-13's "on 1 September
 * a single credit of 9 EL" both describe. Open question Q-05 asks whether the
 * month's accrual should instead land at period end; the answer moves this one
 * line and nothing else.
 */
export function resolveRunDate(input: { asOf?: string | null; period?: string | null }): string {
  const asOf = (input.asOf ?? "").trim();
  if (ISO_DATE.test(asOf)) return asOf;
  const period = (input.period ?? "").trim();
  if (PERIOD.test(period)) return `${period}-01`;
  throw new HttpError({
    status: 400,
    code: "BAD_REQUEST",
    message: "An accrual run needs either an asOf date (YYYY-MM-DD) or a period (YYYY-MM).",
  });
}

function planFor(scheme: LeaveScheme, employee: EmployeeRow, asOf: string): AccrualPlan {
  return planLeaveAccrual({
    scheme,
    gradeRank: Number(employee.designation_level) || 0,
    joiningDate: employee.joining_date,
    asOf,
    traineeType: employee.trainee_type,
  });
}

/**
 * Runs accrual for one date.
 *
 * Preview and commit walk identical code and produce identical figures; commit
 * additionally writes the ledger. Each employee's lines are one movement: one
 * `movement_id`, one transaction, so RL-07's senior credit reads as a single
 * 18/6/6 movement rather than three unrelated rows.
 *
 * An employee whose scheme cannot be resolved — a December joiner with Q-02
 * unanswered, a tenant with no senior grade rank — is listed in `blocked` with
 * the rule that is missing. The rest of the population still accrues; nothing is
 * credited on a guess.
 */
export async function runLeaveAccrual(
  access: Access,
  input: { asOf?: string | null; period?: string | null; mode?: LeaveRunMode; employeeId?: string | null },
  requestId?: string,
): Promise<LeaveAccrualResult> {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const asOf = resolveRunDate(input);
  const mode = input.mode ?? DEFAULT_RUN_MODE;
  const scheme = await loadLeaveScheme(access);
  const population = await accrualPopulation(access, input.employeeId ?? null);
  const already = await writtenOccurrences(access, population.map((employee) => employee.id));
  const source = `${LEAVE_ACCRUAL_SOURCE}:${asOf}`;

  const result: LeaveAccrualResult = {
    mode,
    asOf,
    period: periodOf(asOf),
    employees: 0,
    movements: 0,
    lines: 0,
    days: {},
    credits: [],
    alreadyCredited: 0,
    blocked: [],
    configurationGaps: leaveSchemeGaps(scheme),
  };

  const typeIds = await ensureLeaveTypes(access, ["EL", "CL", "SL"]);

  for (const employee of population) {
    let plan: AccrualPlan;
    try {
      plan = planFor(scheme, employee, asOf);
    } catch (error) {
      if (error instanceof HttpError && error.code === "LEAVE_SCHEME_INCOMPLETE") {
        result.blocked.push({ employeeId: employee.id, employeeCode: employee.employee_code, code: error.code, message: error.message });
        continue;
      }
      throw error;
    }
    const pending = plan.lines.filter((line) => !already.has(`${employee.id}:${line.occurrence}`));
    if (pending.length === 0) {
      if (plan.lines.length > 0) result.alreadyCredited += 1;
      continue;
    }

    // One movement per employee per run: the lines are written together and
    // carry the same movement id, so the register shows one credit event.
    const movementId = crypto.randomUUID();
    const statements = [];
    for (const line of pending) {
      const leaveTypeId = typeIds.get(line.leaveType);
      if (!leaveTypeId) continue;
      const attributes = ledgerAttributes({
        employeeId: employee.id,
        leaveTypeId,
        leaveType: line.leaveType,
        kind: "accrual",
        days: line.days,
        effectiveDate: asOf,
        source,
        occurrence: line.occurrence,
        movementId,
        note: line.note,
      });
      statements.push(sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
        values (${access.tenantId}, ${employee.id}, ${leaveTypeId},
          ${JSON.stringify({ ...attributes, period: periodOf(asOf), basis: line.basis, senior: plan.senior })}::jsonb)
      `);
      result.credits.push({
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        leaveType: line.leaveType,
        days: line.days,
        basis: line.basis,
        occurrence: line.occurrence,
        movementId,
        note: line.note,
      });
      result.days[line.leaveType] = Math.round(((result.days[line.leaveType] ?? 0) + line.days) * 100) / 100;
      result.lines += 1;
    }
    if (statements.length === 0) continue;
    result.employees += 1;
    result.movements += 1;
    if (mode === "commit") await tenantTx(access, statements);
  }

  if (mode === "commit") {
    await tenantTx(access, [
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'leave.accrual_run', 'leave_job', ${source}, ${`Leave accrual committed for ${asOf}`},
          ${JSON.stringify({ asOf, movements: result.movements, lines: result.lines, days: result.days, blocked: result.blocked.length })}::jsonb,
          ${uuidOrNull(requestId ?? null)}::uuid)
      `,
    ]);
  }
  return result;
}
