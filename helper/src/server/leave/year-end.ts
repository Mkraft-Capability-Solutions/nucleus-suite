import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { DEFAULT_RUN_MODE, type BlockedEmployee, type LeaveRunMode } from "./accrual";
import { loadLeaveScheme, leaveSchemeGaps, type LeaveSchemeGap } from "./configuration";
import { ensureLeaveTypes } from "./leave-types";
import { leaveBalancesFromLedger, ledgerAttributes, writtenOccurrences } from "./ledger";
import { yearEndTreatment, type YearEndTreatment } from "./scheme";

/**
 * RL-14 year-end processing, with the Preview the workbook requires.
 *
 * Three things were wrong with what this replaces. The run counted employees
 * rather than days, so a closing balance of 7 EL, 2 CL and 3 SL reported 1 and 2
 * instead of 7 and 5. The postings used `encash` and `lapse`, which the balance
 * arithmetic did not recognise, so nothing was ever reduced and a second run
 * would have encashed the same days again. And the treatment per leave type was
 * decided in code, where RL-14 makes it configuration.
 *
 * Preview and Commit walk the same code over the same as-at date and produce the
 * same figures; Commit additionally writes the ledger.
 */

export const LEAVE_YEAR_END_SOURCE = "leave.year_end";

export const yearEndRunSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  /** F-LVE-07 "Run mode", defaulting to Preview exactly as the workbook does. */
  mode: z.enum(["preview", "commit"]).default(DEFAULT_RUN_MODE),
  employeeId: z.string().uuid().optional(),
});

export type YearEndLine = {
  employeeId: string;
  employeeCode: string | null;
  leaveType: string;
  closingBalance: number;
  treatment: YearEndTreatment;
  days: number;
};

export type YearEndResult = {
  mode: LeaveRunMode;
  year: number;
  /** The date every balance is struck at; preview and commit share it. */
  asAt: string;
  employees: number;
  encashedDays: number;
  lapsedDays: number;
  carriedForwardDays: number;
  lines: YearEndLine[];
  alreadyProcessed: number;
  /** Leave types holding a balance whose year-end treatment nobody has configured. */
  unconfigured: BlockedEmployee[];
  configurationGaps: LeaveSchemeGap[];
};

type EmployeeRow = { id: string; employee_code: string | null };

async function population(access: Access, employeeId: string | null): Promise<EmployeeRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select e.id, e.employee_code from employees e
        where e.tenant_id = $1 and e.status = 'active' and ($2::uuid is null or e.id = $2::uuid)
        order by e.employee_code asc limit 5000`,
      [access.tenantId, employeeId],
    ),
  ]);
  return rows as EmployeeRow[];
}

/** The ledger kind each treatment posts. Carry-forward moves nothing; the balance stands. */
const TREATMENT_KIND: Record<YearEndTreatment, "encash" | "lapse" | null> = {
  encash: "encash",
  lapse: "lapse",
  carry_forward: null,
};

export async function runLeaveYearEnd(
  access: Access,
  input: z.infer<typeof yearEndRunSchema>,
  requestId?: string,
): Promise<YearEndResult> {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const { year, mode } = input;
  const asAt = `${year}-12-31`;
  const scheme = await loadLeaveScheme(access);
  const employees = await population(access, input.employeeId ?? null);
  const already = await writtenOccurrences(access, employees.map((employee) => employee.id));
  const source = `${LEAVE_YEAR_END_SOURCE}:${year}`;

  const result: YearEndResult = {
    mode,
    year,
    asAt,
    employees: 0,
    encashedDays: 0,
    lapsedDays: 0,
    carriedForwardDays: 0,
    lines: [],
    alreadyProcessed: 0,
    unconfigured: [],
    configurationGaps: leaveSchemeGaps(scheme),
  };

  const codesNeeded = new Set<string>();
  const balancesByEmployee = new Map<string, Record<string, { balance: number }>>();
  for (const employee of employees) {
    const balances = await leaveBalancesFromLedger(access, employee.id, asAt);
    balancesByEmployee.set(employee.id, balances);
    for (const code of Object.keys(balances)) codesNeeded.add(code);
  }
  const typeIds = await ensureLeaveTypes(access, [...codesNeeded]);

  for (const employee of employees) {
    const balances = balancesByEmployee.get(employee.id) ?? {};
    const statements = [];
    let touched = false;
    let skipped = false;
    for (const [code, balance] of Object.entries(balances)) {
      // What was already closed is asked first, before the balance is looked at. A
      // committed year end writes the encashment or lapse that takes the closing
      // balance to zero, so testing the balance first sent every re-run down the
      // `closing <= 0` path and the job reported nothing already processed — the one
      // number that proves the run is idempotent read zero precisely because it was.
      const occurrence = `year_end:${year}:${code}`;
      if (already.has(`${employee.id}:${occurrence}`)) {
        skipped = true;
        continue;
      }
      const closing = Math.round(balance.balance * 100) / 100;
      if (closing <= 0) continue;
      let treatment: YearEndTreatment;
      try {
        treatment = yearEndTreatment(scheme, code);
      } catch (error) {
        if (error instanceof HttpError && error.code === "LEAVE_SCHEME_INCOMPLETE") {
          result.unconfigured.push({ employeeId: employee.id, employeeCode: employee.employee_code, code, message: error.message });
          continue;
        }
        throw error;
      }
      result.lines.push({
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        leaveType: code,
        closingBalance: closing,
        treatment,
        days: closing,
      });
      if (treatment === "encash") result.encashedDays = Math.round((result.encashedDays + closing) * 100) / 100;
      if (treatment === "lapse") result.lapsedDays = Math.round((result.lapsedDays + closing) * 100) / 100;
      if (treatment === "carry_forward") result.carriedForwardDays = Math.round((result.carriedForwardDays + closing) * 100) / 100;
      touched = true;

      const kind = TREATMENT_KIND[treatment];
      const leaveTypeId = typeIds.get(code);
      if (kind === null || !leaveTypeId) continue;
      const movementId = crypto.randomUUID();
      statements.push(sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
        values (${access.tenantId}, ${employee.id}, ${leaveTypeId},
          ${JSON.stringify({
            ...ledgerAttributes({
              employeeId: employee.id,
              leaveTypeId,
              leaveType: code,
              kind,
              days: closing,
              effectiveDate: asAt,
              source,
              occurrence,
              movementId,
              note: `Year-end ${treatment === "encash" ? "encashment" : "lapse"} of the ${year} closing balance`,
            }),
            year: String(year),
          })}::jsonb)
      `);
    }
    if (touched) result.employees += 1;
    else if (skipped) result.alreadyProcessed += 1;
    if (mode === "commit" && statements.length > 0) await tenantTx(access, statements);
  }

  if (mode === "commit") {
    await tenantTx(access, [
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'leave.year_end_commit', 'leave_job', ${source}, ${`Year end ${year} committed`},
          ${JSON.stringify({ year, employees: result.employees, encashedDays: result.encashedDays, lapsedDays: result.lapsedDays })}::jsonb,
          ${uuidOrNull(requestId ?? null)}::uuid)
      `,
    ]);
  }
  return result;
}
