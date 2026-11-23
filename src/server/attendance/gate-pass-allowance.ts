import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { assertAttendanceEmployeeVisible } from "@/server/attendance/service";

/**
 * Monthly gate-pass allowance for one employee: personal passes that are submitted or approved in the period (the
 * same rows the request check counts) against the stored monthly ceiling and instance limit of the tenant's active
 * gate-pass policy. A limit that no policy row states is reported as null, never as an assumed number.
 */
export type GatePassAllowance = {
  period: string;
  usedMinutes: number;
  usedRequests: number;
  ceilingMinutes: number | null;
  requestLimit: number | null;
  remainingMinutes: number | null;
  remainingRequests: number | null;
  allowedMinutes: number[];
};

/** Pure remaining-allowance math (unit-tested). */
export function remaining(limit: number | null, used: number): number | null {
  return limit === null ? null : Math.max(0, limit - used);
}

/** Pure parser for the stored `allowed_minutes` list (unit-tested); anything that is not a positive integer is dropped. */
export function allowedMinutesFrom(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((entry) => Number.isInteger(entry) && entry > 0))].sort((a, b) => a - b);
}

export async function getGatePassAllowance(access: Access, employeeId: string, period: string): Promise<GatePassAllowance> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, employeeId);
  const [policyRows, usageRows] = await tenantTx(access, [
    sqlClient`select
        max(case when attributes->>'monthly_minutes' ~ '^[0-9]+$' then (attributes->>'monthly_minutes')::int
                 when attributes->>'max_hours_per_month' ~ '^[0-9]+(\\.[0-9]+)?$' then round((attributes->>'max_hours_per_month')::numeric * 60)::int end) as ceiling_minutes,
        max(case when attributes->>'max_instances_per_month' ~ '^[0-9]+$' then (attributes->>'max_instances_per_month')::int
                 when attributes->>'max_count' ~ '^[0-9]+$' then (attributes->>'max_count')::int end) as request_limit,
        (array_agg(attributes->'allowed_minutes') filter (where jsonb_typeof(attributes->'allowed_minutes') = 'array'))[1] as allowed_minutes
      from gate_pass_policies
      where tenant_id = ${access.tenantId} and record_status = 'active'`,
    sqlClient`select
        coalesce(sum(case when attributes->>'minutes' ~ '^[0-9]+$' then (attributes->>'minutes')::int else 0 end), 0)::int as used_minutes,
        count(*)::int as used_requests
      from gate_passes
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and lower(coalesce(attributes->>'status', '')) similar to '(approved|submitted)%'
        and lower(coalesce(attributes->>'type', 'personal')) = 'personal'
        and left(coalesce(attributes->>'pass_date', attributes->>'date', to_char(created_at, 'YYYY-MM-DD')), 7) = ${period}`,
  ]);
  const policy = (policyRows as Array<{ ceiling_minutes: number | null; request_limit: number | null; allowed_minutes: unknown }>)[0];
  const usage = (usageRows as Array<{ used_minutes: number; used_requests: number }>)[0];
  const ceilingMinutes = typeof policy?.ceiling_minutes === "number" ? policy.ceiling_minutes : null;
  const requestLimit = typeof policy?.request_limit === "number" ? policy.request_limit : null;
  const usedMinutes = usage?.used_minutes ?? 0;
  const usedRequests = usage?.used_requests ?? 0;
  return {
    period,
    usedMinutes,
    usedRequests,
    ceilingMinutes,
    requestLimit,
    remainingMinutes: remaining(ceilingMinutes, usedMinutes),
    remainingRequests: remaining(requestLimit, usedRequests),
    allowedMinutes: allowedMinutesFrom(policy?.allowed_minutes),
  };
}
