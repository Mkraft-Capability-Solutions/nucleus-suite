import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { resolveAttendanceScope } from "@/server/attendance/service";

export type GatePassState = "draft" | "pending_approval" | "approved" | "rejected" | "credited";

/**
 * Pure lifecycle mapping for one gate pass (unit-tested).
 *
 * The stored status is free text: imported rows carry title case ("Approved")
 * and a rejection may carry its whole explanation in the same field
 * ("Rejected — monthly ceiling of 240 minutes already used…"), while the
 * application's own writes use lower case ("submitted"). Matching is therefore
 * done on a lower-cased prefix, never on equality. Anything unrecognised or
 * absent stays a draft rather than being guessed into a decided state.
 */
export function deriveGatePassState(storedStatus: string | null | undefined): GatePassState {
  const normalized = (storedStatus ?? "").trim().toLowerCase();
  if (normalized.length === 0) return "draft";
  if (normalized.startsWith("reject") || normalized.startsWith("declin")) return "rejected";
  if (normalized.startsWith("credit")) return "credited";
  if (normalized.startsWith("approve")) return "approved";
  if (normalized.startsWith("submit") || normalized.startsWith("pending") || normalized.startsWith("await")) {
    return "pending_approval";
  }
  return "draft";
}

/**
 * Pure extraction of the explanation a stored status carries after its verdict
 * (unit-tested). The reference queue shows that whole sentence, and it must
 * come from the stored value — it is never composed here.
 */
export function rejectionNote(storedStatus: string | null | undefined): string | null {
  const value = (storedStatus ?? "").trim();
  if (value.length === 0) return null;
  const separator = value.search(/\s[—–-]\s/);
  if (separator < 0) return null;
  const tail = value.slice(separator).replace(/^\s[—–-]\s/, "").trim();
  return tail.length > 0 ? tail : null;
}

export type GatePassRow = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  date: string | null;
  minutes: number | null;
  from_time: string | null;
  to_time: string | null;
  type: string | null;
  reason: string | null;
  expected_return: string | null;
  actual_out_ts: string | null;
  actual_in_ts: string | null;
  decision_remarks: string | null;
  approver_code: string | null;
  status: GatePassState;
  rejection_note: string | null;
};

type GatePassQueryRow = Omit<GatePassRow, "status" | "rejection_note"> & { stored_status: string | null };

const NUMERIC = `~ '^-?[0-9]+$'`;

// The imported rows key the day as `pass_date`; the application's own writes use
// `date`. Both are read so neither origin disappears from the register.
const GATE_PASS_SELECT = `select gp.id,
    gp.employee_id,
    coalesce(e.employee_code, '') as employee_code,
    trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as employee_name,
    coalesce(gp.attributes->>'pass_date', gp.attributes->>'date') as date,
    case when coalesce(gp.attributes->>'minutes', '') ${NUMERIC}
         then (gp.attributes->>'minutes')::int end as minutes,
    gp.attributes->>'from_time' as from_time,
    gp.attributes->>'to_time' as to_time,
    gp.attributes->>'type' as type,
    gp.attributes->>'reason' as reason,
    gp.attributes->>'expected_return' as expected_return,
    gp.attributes->>'actual_out_ts' as actual_out_ts,
    gp.attributes->>'actual_in_ts' as actual_in_ts,
    gp.attributes->>'decision_remarks' as decision_remarks,
    gp.attributes->>'approver' as approver_code,
    gp.attributes->>'status' as stored_status
  from gate_passes gp
  left join employees e on e.tenant_id = gp.tenant_id and e.id = gp.employee_id`;

function project(row: GatePassQueryRow): GatePassRow {
  const { stored_status: storedStatus, ...rest } = row;
  const status = deriveGatePassState(storedStatus);
  return { ...rest, status, rejection_note: status === "rejected" ? rejectionNote(storedStatus) : null };
}

/** Gate pass approval queue, limited to the caller's attendance scope. */
export async function listGatePassRegister(access: Access, search: string): Promise<GatePassRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) return [];
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${GATE_PASS_SELECT}
       where gp.tenant_id = $1 and gp.employee_id = any($2::uuid[])
         and ($3 = '%%' or (coalesce(e.employee_code, '') || ' ' || coalesce(e.first_name, '')
              || ' ' || coalesce(e.last_name, '') || ' ' || coalesce(gp.attributes->>'type', '')
              || ' ' || coalesce(gp.attributes->>'reason', '')) ilike $3)
       order by coalesce(gp.attributes->>'pass_date', gp.attributes->>'date', '') desc, gp.created_at desc
       limit 200`,
      [access.tenantId, scope.employeeIds, like],
    ),
  ]);
  return (rows as GatePassQueryRow[]).map(project);
}

export type GatePassQuota = {
  usedMinutes: number;
  ceilingMinutes: number | null;
  instancesUsed: number;
  instanceLimit: number | null;
  period: string | null;
};

/**
 * One gate pass with the employee's consumption for that pass's month and the
 * stored monthly ceiling. The ceiling and instance limit are read from
 * `gate_pass_policies` — when no policy row exists they are reported as null
 * rather than assumed.
 */
export async function getGatePassRecord(access: Access, id: string) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const scope = await resolveAttendanceScope(access);
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${GATE_PASS_SELECT} where gp.tenant_id = $1 and gp.id = $2::uuid limit 1`,
      [access.tenantId, id],
    ),
  ]);
  const found = (rows as GatePassQueryRow[])[0];
  if (!found || !scope.employeeIds.includes(found.employee_id)) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const record = project(found);
  const period = record.date ? record.date.slice(0, 7) : null;

  // Only approved passes consume the ceiling; a rejected or pending pass never
  // does. Counted from the stored rows, never estimated.
  let usedMinutes = 0;
  let instancesUsed = 0;
  if (period) {
    const [usageRows] = await tenantTx(access, [
      sqlClient`
        select coalesce(sum(case when coalesce(peer.attributes->>'minutes', '') ~ '^-?[0-9]+$'
                                 then (peer.attributes->>'minutes')::int else 0 end), 0)::int as minutes,
               count(*)::int as instances
        from gate_passes peer
        where peer.tenant_id = ${access.tenantId} and peer.employee_id = ${record.employee_id}
          and lower(coalesce(peer.attributes->>'status', '')) like 'approve%'
          and left(coalesce(peer.attributes->>'pass_date', peer.attributes->>'date', ''), 7) = ${period}
      `,
    ]);
    const usage = (usageRows as Array<{ minutes: number; instances: number }>)[0];
    usedMinutes = usage?.minutes ?? 0;
    instancesUsed = usage?.instances ?? 0;
  }

  // The ceiling is a stored value. It is held either as hours
  // (`max_hours_per_month`, multiplied by 60) or already as minutes
  // (`monthly_minutes`); both spellings are read, and neither is defaulted.
  let ceilingMinutes: number | null = null;
  let instanceLimit: number | null = null;
  const [policyRows] = await tenantTx(access, [
    sqlClient`
      select case when coalesce(pol.attributes->>'monthly_minutes', '') ~ '^[0-9]+$'
                  then (pol.attributes->>'monthly_minutes')::int
                  when coalesce(pol.attributes->>'max_hours_per_month', '') ~ '^[0-9]+(\\.[0-9]+)?$'
                  then round((pol.attributes->>'max_hours_per_month')::numeric * 60)::int end as ceiling_minutes,
             case when coalesce(pol.attributes->>'max_instances_per_month', '') ~ '^[0-9]+$'
                  then (pol.attributes->>'max_instances_per_month')::int
                  when coalesce(pol.attributes->>'max_count', '') ~ '^[0-9]+$'
                  then (pol.attributes->>'max_count')::int end as instance_limit
      from gate_passes gp
      join gate_pass_policies pol on pol.tenant_id = gp.tenant_id and pol.id = gp.gate_pass_policy_id
      where gp.tenant_id = ${access.tenantId} and gp.id = ${id} limit 1
    `,
  ]);
  const policy = (policyRows as Array<{ ceiling_minutes: number | null; instance_limit: number | null }>)[0];
  if (policy) {
    ceilingMinutes = policy.ceiling_minutes;
    instanceLimit = policy.instance_limit;
  }

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'gate_pass' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  const quota: GatePassQuota = { usedMinutes, ceilingMinutes, instancesUsed, instanceLimit, period };
  return { record, quota, auditTrail };
}
