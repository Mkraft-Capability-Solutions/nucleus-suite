import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const NOTIFIABLE_EVENTS: Record<string, { template: string; recipients: "actor" | "requester" | "borrower" | "payroll-operators" | "panel" }> = {
  "leave.requested": { template: "leave.submitted", recipients: "requester" },
  "leave.approved": { template: "leave.decided", recipients: "requester" },
  "payroll.finalized": { template: "payroll.finalized", recipients: "payroll-operators" },
  "loan.disbursed": { template: "loan.status", recipients: "borrower" },
  "loan.repaid": { template: "loan.status", recipients: "borrower" },
  "attendance.day_reopened": { template: "attendance.reopened", recipients: "actor" },
};

const TEMPLATES: Record<string, { title: string; body: string }> = {
  "leave.submitted": { title: "Leave submitted", body: "Leave {{leaveType}} for {{days}} day(s) starting {{startsOn}} is pending approval." },
  "leave.decided": { title: "Leave decided", body: "Leave {{leaveType}} for {{days}} day(s) is {{status}}." },
  "payroll.finalized": { title: "Payroll finalized", body: "Payroll {{period}} ({{scope}}) is finalized and immutable." },
  "loan.status": { title: "Loan update", body: "Loan of {{principalMinor}} minor units is {{status}}." },
  "attendance.reopened": { title: "Attendance reopened", body: "An attendance day was reopened; payroll readiness is invalidated." },
};

export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

async function ensureTemplate(access: Access, code: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from notification_templates where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const fallback = TEMPLATES[code] ?? { title: code, body: code };
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into notification_templates (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code, title: fallback.title, body: fallback.body })}::jsonb)
    `,
  ]);
  return id;
}

async function membershipForEmployee(access: Access, employeeId: string): Promise<string | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from memberships where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and status = 'active' limit 1`,
  ]);
  return (rows as Array<{ id: string }>)[0]?.id ?? null;
}

async function payrollOperators(access: Access): Promise<string[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select distinct m.id from memberships m
      join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
        and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
      join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
      join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
      join permissions p on p.id = rp.permission_id and p.permission_key = 'payroll.run' and p.status = 'active'
      where m.tenant_id = ${access.tenantId} and m.status = 'active'
    `,
  ]);
  return (rows as Array<{ id: string }>).map((row) => row.id);
}

async function isMuted(access: Access, membershipId: string, eventType: string): Promise<boolean> {
  const [rows] = await tenantTx(access, [
    sqlClient`select attributes from notification_preferences where tenant_id = ${access.tenantId} and membership_id = ${membershipId} limit 1`,
  ]);
  const prefs = (rows as Array<{ attributes: { muted_events?: string[] } }>)[0];
  return prefs?.attributes.muted_events?.includes(eventType) ?? false;
}

export async function fanOutEvent(
  access: Access,
  eventType: string,
  payload: Record<string, unknown>,
  actorMembershipId: string,
): Promise<number> {
  const rule = NOTIFIABLE_EVENTS[eventType];
  if (!rule) return 0;
  const templateId = await ensureTemplate(access, rule.template);
  const [templateRows] = await tenantTx(access, [
    sqlClient`select attributes from notification_templates where id = ${templateId} and tenant_id = ${access.tenantId} limit 1`,
  ]);
  const template = (templateRows as Array<{ attributes: { title: string; body: string } }>)[0];
  if (!template) return 0;
  let recipients: string[] = [];
  if (rule.recipients === "actor") {
    recipients = [actorMembershipId];
  } else if (rule.recipients === "requester" || rule.recipients === "borrower") {
    const employeeId = payload.employeeId as string | undefined;
    const linked = employeeId ? await membershipForEmployee(access, employeeId) : null;
    recipients = linked ? [linked] : [actorMembershipId];
  } else if (rule.recipients === "payroll-operators") {
    recipients = await payrollOperators(access);
  } else if (rule.recipients === "panel") {
    recipients = [actorMembershipId];
  }
  let created = 0;
  for (const membershipId of [...new Set(recipients)]) {
    if (await isMuted(access, membershipId, eventType)) continue;
    await tenantTx(access, [
      sqlClient`
        insert into notifications (tenant_id, membership_id, template_id, attributes)
        values (${access.tenantId}, ${membershipId}, ${templateId},
          ${JSON.stringify({
            title: renderTemplate(template.attributes.title, payload),
            body: renderTemplate(template.attributes.body, payload),
            event_type: eventType,
            read: false,
          })}::jsonb)
      `,
    ]);
    created += 1;
  }
  return created;
}

export const upsertPreferencesSchema = z.object({
  channels: z.object({ inapp: z.boolean(), email: z.boolean().default(false), sms: z.boolean().default(false) }),
  mutedEvents: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
});

export async function upsertPreferences(access: Access, input: z.infer<typeof upsertPreferencesSchema>) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from notification_preferences where tenant_id = ${access.tenantId} and membership_id = ${access.context.membershipId} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) {
    await tenantTx(access, [
      sqlClient`
        update notification_preferences set attributes = ${JSON.stringify({ channels: input.channels, muted_events: input.mutedEvents })}::jsonb
        where id = ${existing.id} and tenant_id = ${access.tenantId}
      `,
    ]);
    return { id: existing.id, updated: true };
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into notification_preferences (id, tenant_id, membership_id, attributes)
      values (${id}, ${access.tenantId}, ${access.context.membershipId},
        ${JSON.stringify({ channels: input.channels, muted_events: input.mutedEvents })}::jsonb)
    `,
  ]);
  return { id, updated: false };
}

export async function listNotifications(access: Access, unreadOnly: boolean) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, attributes, created_at from notifications
      where tenant_id = ${access.tenantId} and membership_id = ${access.context.membershipId}
        and (${unreadOnly}::boolean = false or attributes->>'read' is distinct from 'true')
      order by created_at desc limit 50
    `,
  ]);
  const items = rows as Array<{ id: string; attributes: Record<string, unknown>; created_at: string }>;
  const [countRows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from notifications
      where tenant_id = ${access.tenantId} and membership_id = ${access.context.membershipId}
        and attributes->>'read' is distinct from 'true'
    `,
  ]);
  return { items, unread: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export async function markNotificationRead(access: Access, notificationId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from notifications where tenant_id = ${access.tenantId} and id = ${notificationId} and membership_id = ${access.context.membershipId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  await tenantTx(access, [
    sqlClient`update notifications set attributes = attributes || '{"read":true}'::jsonb where id = ${notificationId} and tenant_id = ${access.tenantId}`,
  ]);
  return { id: notificationId, read: true };
}
