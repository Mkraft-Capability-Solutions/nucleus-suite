import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { DEFAULT_RUN_MODE, type LeaveRunMode } from "./accrual";
import { loadLeaveScheme, leaveSchemeGaps, type LeaveSchemeGap } from "./configuration";
import { ensureLeaveType } from "./leave-types";
import { ledgerAttributes } from "./ledger";
import { coffLapseDate, type LeaveScheme } from "./scheme";

/**
 * RL-06 comp-off lapse.
 *
 * "A nightly job moves any COFF still Available ON ITS EXPIRY DATE to Lapsed and
 * writes a ledger entry naming the run." Both halves matter: the scheduled task
 * used `expiry < asOf`, which lapsed a day late, and wrote status `expired` with
 * no ledger row at all — so the balance never moved and nothing said which run
 * had done it.
 *
 * The lapse date is recomputed here from the scheme rather than trusted from the
 * grant, so a window changed after the grant was written still governs, and so a
 * tenant that has not answered Q-07 is refused rather than lapsed on an assumed
 * calendar-day count.
 */

export const COFF_LAPSE_SOURCE = "leave.coff_lapse";

export const coffLapseRunSchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["preview", "commit"]).default(DEFAULT_RUN_MODE),
});

export type CoffLapseLine = {
  grantId: string;
  employeeId: string;
  employeeCode: string | null;
  earnedOn: string;
  lapsesOn: string;
  /** What the grant itself recorded, so a drift from the scheme is visible. */
  storedExpiresOn: string | null;
  days: number;
};

export type CoffLapseResult = {
  mode: LeaveRunMode;
  asOf: string;
  grants: number;
  days: number;
  lines: CoffLapseLine[];
  configurationGaps: LeaveSchemeGap[];
};

type GrantRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  earned_on: string | null;
  expires_on: string | null;
  days: number | null;
  days_remaining: number | null;
};

/**
 * The date a comp-off grant lapses, from the scheme in force. Exported so the
 * grant path and the lapse run can never disagree about it.
 */
export function grantLapseDate(earnedOn: string, scheme: LeaveScheme): string {
  return coffLapseDate(earnedOn, scheme);
}

export async function runCoffLapse(
  access: Access,
  input: z.infer<typeof coffLapseRunSchema>,
  requestId?: string,
): Promise<CoffLapseResult> {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const { asOf, mode } = input;
  const scheme = await loadLeaveScheme(access);
  const source = `${COFF_LAPSE_SOURCE}:${asOf}`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select g.id, g.employee_id, emp.employee_code,
          g.attributes->>'earned_on' as earned_on,
          g.attributes->>'expires_on' as expires_on,
          case when coalesce(g.attributes->>'days', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' then (g.attributes->>'days')::float end as days,
          case when coalesce(g.attributes->>'days_remaining', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' then (g.attributes->>'days_remaining')::float end as days_remaining
        from comp_off_grants g
        left join employees emp on emp.tenant_id = g.tenant_id and emp.id = g.employee_id
        where g.tenant_id = $1 and coalesce(g.attributes->>'status', '') = 'available'
        order by coalesce(g.attributes->>'earned_on', '') asc
        limit 2000`,
      [access.tenantId],
    ),
  ]);

  const result: CoffLapseResult = {
    mode,
    asOf,
    grants: 0,
    days: 0,
    lines: [],
    configurationGaps: leaveSchemeGaps(scheme),
  };

  const coffTypeId = await ensureLeaveType(access, "COFF");
  for (const grant of rows as GrantRow[]) {
    const earnedOn = (grant.earned_on ?? "").slice(0, 10);
    if (earnedOn === "") continue;
    // Refuses for the whole run when the window is unconfigured (Q-07), rather
    // than lapsing some grants on an assumed basis and leaving the rest.
    const lapsesOn = grantLapseDate(earnedOn, scheme);
    if (asOf < lapsesOn) continue;
    const days = grant.days_remaining ?? grant.days ?? 0;
    result.grants += 1;
    result.days = Math.round((result.days + days) * 100) / 100;
    result.lines.push({
      grantId: grant.id,
      employeeId: grant.employee_id,
      employeeCode: grant.employee_code,
      earnedOn,
      lapsesOn,
      storedExpiresOn: grant.expires_on,
      days,
    });
    if (mode !== "commit") continue;
    const movementId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`
        update comp_off_grants
        set attributes = attributes || ${JSON.stringify({ status: "lapsed", lapsed_on: lapsesOn, days_remaining: 0, lapse_source: source })}::jsonb,
            updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${grant.id}
      `,
      sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, comp_off_grant_id, attributes)
        values (${access.tenantId}, ${grant.employee_id}, ${coffTypeId}, ${grant.id},
          ${JSON.stringify(
            ledgerAttributes({
              employeeId: grant.employee_id,
              leaveTypeId: coffTypeId,
              leaveType: "COFF",
              kind: "lapse",
              days,
              effectiveDate: lapsesOn,
              source,
              occurrence: `coff_lapse:${grant.id}`,
              movementId,
              note: `Comp-off earned ${earnedOn} lapsed by run ${source}`,
            }),
          )}::jsonb)
      `,
    ]);
  }

  if (mode === "commit") {
    await tenantTx(access, [
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'leave.coff_lapse_run', 'leave_job', ${source}, ${`Comp-off lapse run for ${asOf}`},
          ${JSON.stringify({ asOf, grants: result.grants, days: result.days })}::jsonb,
          ${uuidOrNull(requestId ?? null)}::uuid)
      `,
    ]);
  }
  return result;
}
