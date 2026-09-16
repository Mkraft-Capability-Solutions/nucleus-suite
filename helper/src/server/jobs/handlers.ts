import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { publishAnnouncement } from "@/server/engagement/service";
import {
  parseAudienceScopeConfig,
  planOccasions,
  type OccasionCandidate,
} from "@/server/engagement/occasion-announcements";
import { runLeaveAccrual, type BlockedEmployee } from "@/server/leave/accrual";
import { runCoffLapse } from "@/server/leave/coff";
import { runLeaveYearEnd } from "@/server/leave/year-end";
import { calculateRun } from "@/server/payroll/service";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const TASK_TYPES = [
  "leave.accrue_monthly",
  "leave.coff_expire",
  "leave.year_close",
  "documents.expire",
  "payroll.calculate_batch",
  "engagement.announce_occasions",
] as const;

export function isKnownTaskType(type: string): type is (typeof TASK_TYPES)[number] {
  return (TASK_TYPES as readonly string[]).includes(type);
}

/**
 * The engine names every employee it could not classify - a December joiner with
 * Q-02 unanswered, a tenant with no senior grade rank. The scheduled run is
 * unattended, so the names are written to the audit trail: the run's own
 * `leave.accrual_run` event carries only the count, and a skipped employee is
 * otherwise invisible until somebody notices a missing credit.
 */
async function recordBlockedAccruals(access: Access, period: string, blocked: BlockedEmployee[]) {
  if (blocked.length === 0) return;
  await tenantTx(access, [
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.accrual_blocked', 'leave_job', ${`leave.accrual:${period}`},
        ${`${blocked.length} employee(s) were skipped by the ${period} leave accrual because their scheme could not be resolved.`},
        ${JSON.stringify({ period, blocked })}::jsonb, null)
    `,
  ]);
}

async function accrueMonthly(access: Access, payload: Record<string, unknown>) {
  const period = z.string().regex(/^\d{4}-\d{2}$/).parse(payload.period);
  // The run defaults to preview; a scheduled task must ask for commit explicitly.
  const result = await runLeaveAccrual(access, { period, mode: "commit" });
  await recordBlockedAccruals(access, result.period, result.blocked);
  return { credited: result.movements, lines: result.lines, days: result.days, blocked: result.blocked };
}

async function coffExpire(access: Access, payload: Record<string, unknown>) {
  const asOf = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(payload.asOf);
  const result = await runCoffLapse(access, { asOf, mode: "commit" });
  return { expired: result.grants, days: result.days };
}

async function yearClose(access: Access, payload: Record<string, unknown>) {
  const year = z.number().int().min(2000).max(2100).parse(payload.year);
  const result = await runLeaveYearEnd(access, { year, mode: "commit" });
  // DAYS, not employees: the old counters incremented once per employee and
  // reported 1 and 2 where the client expects 7 and 5.
  return { encashed: result.encashedDays, lapsed: result.lapsedDays, employees: result.employees };
}

async function documentsExpire(access: Access, payload: Record<string, unknown>): Promise<{ expired: number }> {
  const asOf = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(payload.asOf);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id from document_versions
      where tenant_id = ${access.tenantId} and attributes->>'scan' = 'available'
        and attributes->>'expires_at' is not null and attributes->>'expires_at' < ${asOf}
    `,
  ]);
  const versions = rows as Array<{ id: string }>;
  for (const version of versions) {
    await tenantTx(access, [
      sqlClient`update document_versions set attributes = attributes || '{"expired":true}'::jsonb where id = ${version.id} and tenant_id = ${access.tenantId}`,
    ]);
  }
  return { expired: versions.length };
}

/**
 * R-21. Birthday and new-joiner announcements raise themselves from the employee
 * record. Run daily with `{"asOf":"YYYY-MM-DD"}`.
 *
 * Idempotent the way the other handlers are: every announcement carries the occasion
 * key, the keys already on `feed_posts` are read first, and `planOccasions` drops any
 * occasion that already has one. Re-running the job on the same day writes nothing.
 *
 * The audience each type reaches is configuration - `announcement_audience_scope` in
 * tenant settings - defaulting to the workbook's own defaults. An employee missing
 * the value the configured scope needs is skipped and named, never widened to `all`.
 */
async function announceOccasions(
  access: Access,
  payload: Record<string, unknown>,
): Promise<{ birthdays: number; joiners: number; skipped: string[] }> {
  const asOf = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(payload.asOf);
  const [employeeRows, keyRows, settingsRows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.employee_code, e.first_name, e.last_name, e.department, e.location, e.designation,
             e.joining_date::text as joining_date, e.metadata->>'dateOfBirth' as date_of_birth
      from employees e
      where e.tenant_id = ${access.tenantId} and e.status = 'active'
        and (e.joining_date::text = ${asOf} or right(e.metadata->>'dateOfBirth', 5) = ${asOf.slice(5)})
      order by e.employee_code
    `,
    sqlClient`
      select attributes->>'auto_occasion_key' as key from feed_posts
      where tenant_id = ${access.tenantId} and attributes->>'auto_occasion_key' is not null
        and right(attributes->>'auto_occasion_key', 4) = ${asOf.slice(0, 4)}
    `,
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);

  const employees: OccasionCandidate[] = (
    employeeRows as Array<{
      id: string; employee_code: string | null; first_name: string | null; last_name: string | null;
      department: string | null; location: string | null; designation: string | null;
      joining_date: string | null; date_of_birth: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    employeeCode: row.employee_code ?? "",
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || (row.employee_code ?? row.id),
    department: row.department,
    location: row.location,
    designation: row.designation,
    legalEntityId: null,
    dateOfBirth: row.date_of_birth,
    joiningDate: row.joining_date,
  }));

  const settings = ((settingsRows as Array<{ settings: unknown }>)[0]?.settings ?? {}) as Record<string, unknown>;
  const plan = planOccasions({
    asOf,
    employees,
    config: parseAudienceScopeConfig(settings.announcement_audience_scope),
    existingKeys: new Set(
      (keyRows as Array<{ key: string | null }>).map((row) => row.key).filter((key): key is string => key !== null),
    ),
  });

  let birthdays = 0;
  let joiners = 0;
  for (const occasion of plan.planned) {
    await publishAnnouncement(
      access,
      {
        title: occasion.copy.title,
        body: occasion.copy.body,
        audience: occasion.rule,
        kind: occasion.kind,
        // Both occasions are the workbook's Celebration type on the portal, and
        // neither asks for an acknowledgement: it is news, not a policy.
        announcementType: "celebration",
        channels: ["employee_portal"],
        // No `publishAt`: it defaults to the moment the job raises the announcement.
        // Stamping the occasion date would make a catch-up run publish into the past,
        // which `publishAnnouncement` refuses - and the occasion date is on the key.
        acknowledgementRequired: false,
      },
      crypto.randomUUID(),
      { autoGenerated: true, occasionKey: occasion.key },
    );
    if (occasion.kind === "birthday") birthdays += 1;
    else joiners += 1;
  }
  return { birthdays, joiners, skipped: plan.skipped.map((entry) => entry.reason) };
}

async function calculateBatch(access: Access, payload: Record<string, unknown>): Promise<{ calculated: number }> {
  const runId = z.string().uuid().parse(payload.runId);
  const employeeIds = z.array(z.string().uuid()).min(1).max(200).parse(payload.employeeIds);
  const result = await calculateRun(access, runId, employeeIds, crypto.randomUUID());
  return { calculated: result.calculated };
}

export async function dispatchTask(access: Access, taskType: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isKnownTaskType(taskType)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown task type: ${taskType}; dead-lettered without retry.` });
  }
  switch (taskType) {
    case "leave.accrue_monthly":
      return accrueMonthly(access, payload);
    case "leave.coff_expire":
      return coffExpire(access, payload);
    case "leave.year_close":
      return yearClose(access, payload);
    case "documents.expire":
      return documentsExpire(access, payload);
    case "payroll.calculate_batch":
      return calculateBatch(access, payload);
    case "engagement.announce_occasions":
      return announceOccasions(access, payload);
  }
}
