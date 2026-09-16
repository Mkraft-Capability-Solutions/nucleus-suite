import "server-only";

import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";
import { movementDirection } from "./ledger-register";

/**
 * The leave ledger is the only balance there is.
 *
 * Nothing in this module accrues, prorates or expires anything: it reads the
 * movements already written and sums them. That matters for two of the defects
 * this replaces — a projected annual credit that was added on top of the
 * accruals already in the ledger (so a mid-year joiner's 9 EL counted twice),
 * and a balance that netted only `debit` and `credit` while the year-end job
 * wrote `encash` and `lapse` (so an encashment never reduced anything and a
 * re-run would have encashed the same days again).
 */

/**
 * The date a movement takes effect. Entries carry it as `effective_date`, as a
 * `period` when written by a monthly run, or not at all — in which case the row's
 * own creation date stands in.
 */
export const LEDGER_EFFECTIVE_DATE = `coalesce(
    nullif(l.attributes->>'effective_date', ''),
    nullif(l.attributes->>'period', '') || '-01',
    l.created_at::date::text)`;

export type LeaveTypeBalance = { leaveType: string; credited: number; debited: number; balance: number };

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Folds raw movements into one balance per leave type (unit-tested).
 *
 * A movement that names the entry it reverses unwinds that entry's column instead of
 * filling the opposite one. Both give the same `balance`, but only this one gives the
 * right `used`: an approved request writes `reserve` on submit and `release` + `debit`
 * on final approval, so counting the release as a fresh credit left ten days availed
 * reading as twenty days used. It is equally what makes a partial reversal read
 * correctly — an early return that gives back four of ten days leaves six days used,
 * not ten used against four credited, which would have overstated both columns.
 */
export function foldLedgerBalances(
  movements: Array<{ leaveType: string; kind: string | null; days: number; reversesEntryId?: string | null }>,
): Record<string, LeaveTypeBalance> {
  const balances: Record<string, LeaveTypeBalance> = {};
  for (const movement of movements) {
    const code = (movement.leaveType ?? "").trim().toUpperCase();
    if (code === "") continue;
    const direction = movementDirection(movement.kind);
    if (direction === "none") continue;
    const days = Number.isFinite(movement.days) ? Math.abs(Number(movement.days)) : 0;
    const bucket = balances[code] ?? { leaveType: code, credited: 0, debited: 0, balance: 0 };
    const unwinds = typeof movement.reversesEntryId === "string" && movement.reversesEntryId !== "";
    if (direction === "credit") {
      if (unwinds) bucket.debited = round(bucket.debited - days);
      else bucket.credited = round(bucket.credited + days);
    } else if (unwinds) {
      bucket.credited = round(bucket.credited - days);
    } else {
      bucket.debited = round(bucket.debited + days);
    }
    bucket.balance = round(bucket.credited - bucket.debited);
    balances[code] = bucket;
  }
  return balances;
}

/**
 * One employee's balance per leave type, optionally as at a date. `asOf` is what
 * makes the year-end run reproducible: preview and commit both close the same
 * 31 December, whatever has been posted since.
 */
export async function leaveBalancesFromLedger(
  access: Access,
  employeeId: string,
  asOf?: string,
): Promise<Record<string, LeaveTypeBalance>> {
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select coalesce(lt.attributes->>'code', l.attributes->>'leave_type', '') as "leaveType",
          coalesce(l.attributes->>'kind', lower(coalesce(l.attributes->>'transaction_type', ''))) as kind,
          l.reverses_entry_id::text as "reversesEntryId",
          case when coalesce(l.attributes->>'days', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
               then (l.attributes->>'days')::float else 0 end as days
        from leave_ledger_entries l
        left join leave_types lt on lt.tenant_id = l.tenant_id and lt.id = l.leave_type_id
        where l.tenant_id = $1 and l.employee_id = $2::uuid
          and ($3::text is null or ${LEDGER_EFFECTIVE_DATE} <= $3::text)
        limit 2000`,
      [access.tenantId, employeeId, asOf ?? null],
    ),
  ]);
  return foldLedgerBalances(
    (rows as Array<{ leaveType: string; kind: string | null; days: number; reversesEntryId: string | null }>).map((row) => ({
      ...row,
      days: Number(row.days) || 0,
    })),
  );
}

export type LedgerMovementInput = {
  employeeId: string;
  leaveTypeId: string;
  leaveType: string;
  kind: string;
  days: number;
  effectiveDate: string;
  /** Names the run that wrote it, so a ledger row can always be traced to its job. */
  source: string;
  /** What makes this movement unique for the employee; a re-run matches on it. */
  occurrence: string;
  /** Groups the lines of one movement — RL-07's 18/6/6 is one movement, three lines. */
  movementId: string;
  note: string;
  compOffGrantId?: string | null;
  reversesEntryId?: string | null;
};

/** The jsonb bag one movement writes. Kept in one place so every run agrees on the key names. */
export function ledgerAttributes(movement: LedgerMovementInput): Record<string, unknown> {
  return {
    kind: movement.kind,
    days: movement.days,
    leave_type: movement.leaveType,
    effective_date: movement.effectiveDate,
    source: movement.source,
    occurrence: movement.occurrence,
    movement_id: movement.movementId,
    note: movement.note,
  };
}

/**
 * The occurrences already written for one employee, so a run can skip what it has
 * already done. Both entry points share this, which is what stops the scheduled
 * job and the VP command double-crediting each other's work.
 */
export async function writtenOccurrences(access: Access, employeeIds: string[]): Promise<Set<string>> {
  if (employeeIds.length === 0) return new Set();
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select l.employee_id, l.attributes->>'occurrence' as occurrence
        from leave_ledger_entries l
        where l.tenant_id = $1 and l.employee_id = any($2::uuid[])
          and l.attributes->>'occurrence' is not null`,
      [access.tenantId, employeeIds],
    ),
  ]);
  return new Set((rows as Array<{ employee_id: string; occurrence: string }>).map((row) => `${row.employee_id}:${row.occurrence}`));
}
