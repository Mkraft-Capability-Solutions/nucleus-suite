import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * One person's leave position per leave type, for the leave screen.
 *
 * The stored balance is `leave_balances` (latest row per type, as the dashboards read it). Leave
 * approved after that balance was struck is subtracted and days credited to the ledger since
 * (accrual credits, early returns) are added, so fresh activity shows at once; leave still in the
 * approval chain is reported separately as pending, never subtracted twice.
 * Read access: one's own record, or anyone who approves leave or manages employee records.
 */

export type LeaveBalanceLine = {
  leaveType: string;
  leaveTypeName: string | null;
  /** Stored balance less leave approved since, plus days credited since; null when no balance is stored. */
  available: number | null;
  storedBalance: number | null;
  approvedSince: number;
  creditedSince: number;
  pending: number;
  takenThisYear: number;
  asOf: string | null;
  expiresOn: string | null;
};

export type LeaveBalanceSummary = { employeeId: string; lines: LeaveBalanceLine[] };

type Stored = { leave_type: string; balance: number; as_of: string | null; expires_on: string | null };
type Sum = { leave_type: string; days: number };

/** Pure fold of the stored balances and request totals into one line per type (unit-tested). */
export function foldBalanceSummary(args: {
  stored: Stored[];
  approvedSince: Sum[];
  creditedSince: Sum[];
  pending: Sum[];
  takenThisYear: Sum[];
  names: Array<{ code: string; name: string | null }>;
}): LeaveBalanceLine[] {
  const codes = new Set<string>([...args.stored, ...args.pending, ...args.takenThisYear].map((row) => row.leave_type).filter(Boolean));
  const sum = (rows: Sum[], code: string) => Math.round(rows.filter((row) => row.leave_type === code).reduce((total, row) => total + Number(row.days || 0), 0) * 100) / 100;
  return [...codes].sort().map((code) => {
    const stored = args.stored.find((row) => row.leave_type === code) ?? null;
    const since = sum(args.approvedSince, code);
    const credited = sum(args.creditedSince, code);
    return {
      leaveType: code,
      leaveTypeName: args.names.find((entry) => entry.code === code)?.name ?? null,
      available: stored ? Math.round((Number(stored.balance) - since + credited) * 100) / 100 : null,
      storedBalance: stored ? Number(stored.balance) : null,
      approvedSince: since,
      creditedSince: credited,
      pending: sum(args.pending, code),
      takenThisYear: sum(args.takenThisYear, code),
      asOf: stored?.as_of ?? null,
      expiresOn: stored?.expires_on ?? null,
    };
  });
}

export async function leaveBalanceSummary(access: Access, employeeId: string): Promise<LeaveBalanceSummary> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const own = access.context.employeeId === employeeId;
  const permitted = own || access.context.permissions.includes("leave.approve") || access.context.permissions.includes("employee.write");
  if (!permitted) throw new HttpError({ status: 403, code: "FORBIDDEN", message: "You can only see your own leave balances." });

  const [stored, approvedSince, creditedSince, pending, taken, names] = await tenantTx(access, [
    sqlClient`
      select distinct on (leave_type) leave_type, balance::float as balance, as_of_date::date::text as as_of, expires_at::date::text as expires_on
      from leave_balances where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
      order by leave_type, as_of_date desc`,
    sqlClient`
      select r.leave_type, coalesce(sum(r.requested_days), 0)::float as days
      from leave_requests r
      where r.tenant_id = ${access.tenantId} and r.employee_id = ${employeeId} and r.status = 'approved'
        and r.updated_at::date > coalesce((select max(b.as_of_date)::date from leave_balances b
          where b.tenant_id = r.tenant_id and b.employee_id = r.employee_id and b.leave_type = r.leave_type), '-infinity'::date)
      group by 1`,
    sqlClient`
      select l.attributes->>'leave_type' as leave_type, coalesce(sum((l.attributes->>'days')::float), 0)::float as days
      from leave_ledger_entries l
      where l.tenant_id = ${access.tenantId} and l.employee_id = ${employeeId} and l.attributes->>'kind' = 'credit'
        and l.attributes->>'days' ~ '^[0-9]+([.][0-9]+)?$'
        and l.created_at::date > coalesce((select max(b.as_of_date)::date from leave_balances b
          where b.tenant_id = l.tenant_id and b.employee_id = l.employee_id and b.leave_type = l.attributes->>'leave_type'), '-infinity'::date)
      group by 1`,
    sqlClient`
      select leave_type, coalesce(sum(requested_days), 0)::float as days
      from leave_requests where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and status like 'pending%'
      group by 1`,
    sqlClient`
      select leave_type, coalesce(sum(requested_days), 0)::float as days
      from leave_requests where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and status = 'approved'
        and starts_on >= date_trunc('year', current_date)::date
      group by 1`,
    sqlClient`select attributes->>'code' as code, attributes->>'name' as name from leave_types where tenant_id = ${access.tenantId}`,
  ]);
  return {
    employeeId,
    lines: foldBalanceSummary({
      stored: stored as Stored[],
      approvedSince: approvedSince as Sum[],
      creditedSince: creditedSince as Sum[],
      pending: pending as Sum[],
      takenThisYear: taken as Sum[],
      names: names as Array<{ code: string; name: string | null }>,
    }),
  };
}
