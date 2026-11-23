import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { ALERT_SEVERITIES, ALERT_STATUSES, type AlertListResponse, type ComplianceAlert } from "@/lib/compliance-alerts";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Compliance alert listing and acknowledgement (compliance_alerts, migration 0040).
 * Scope: HR/administrators (employee.write) see every employee of the tenant, optionally narrowed to
 * one company and its subsidiaries; everyone else sees their own record and their direct reports'.
 */

export const listAlertsSchema = z.object({
  severity: z.enum(ALERT_SEVERITIES).nullable().default(null),
  status: z.enum(ALERT_STATUSES).nullable().default(null),
  company: z.string().uuid().nullable().default(null),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type ListAlertsInput = z.infer<typeof listAlertsSchema>;

type Row = {
  id: string; employee_id: string; first_name: string | null; last_name: string | null; employee_code: string | null;
  company_id: string | null; root_group_id: string | null; alert_category: ComplianceAlert["category"]; severity: ComplianceAlert["severity"];
  title: string; trigger_date: string; days_remaining: number; status: ComplianceAlert["status"];
  acknowledged_by: string | null; acknowledged_at: string | null;
};

function seesAll(access: Access): boolean {
  return authorize(access.context, { action: "employee.write", resource: { tenantId: access.tenantId } }).allowed;
}

/** WHERE fragment for the caller's scope; parameters $1 tenant, $2 self employee, $3 sees-all, $4 company. */
const SCOPE = `
  a.tenant_id = $1::uuid
  and ($3::boolean or a.employee_id = $2::uuid or e.manager_employee_id = $2::uuid)
  and ($4::uuid is null or a.company_id in (
    with recursive sub as (select id, 0 as depth from legal_entities where tenant_id = $1::uuid and id = $4::uuid
      union all select c.id, sub.depth + 1 from legal_entities c join sub on c.parent_legal_entity_id = sub.id where c.tenant_id = $1::uuid and sub.depth < 12)
    select id from sub))`;

function toAlert(row: Row): ComplianceAlert {
  return {
    id: row.id, employeeId: row.employee_id, employeeName: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || (row.employee_code ?? ""),
    employeeCode: row.employee_code, companyId: row.company_id, rootGroupId: row.root_group_id, category: row.alert_category,
    severity: row.severity, title: row.title, triggerDate: row.trigger_date, daysRemaining: row.days_remaining, status: row.status,
    acknowledgedBy: row.acknowledged_by, acknowledgedAt: row.acknowledged_at,
  };
}

export async function listAlerts(access: Access, input: ListAlertsInput): Promise<AlertListResponse> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const all = seesAll(access);
  const self = uuidOrNull(access.context.employeeId ?? null);
  if (!all && !self) return { items: [], page: input.page, pageSize: input.pageSize, total: 0, counts: { active: 0, critical: 0, warning: 0, info: 0 } };
  const base = [access.tenantId, self, all, input.company];
  // Default listing hides resolved alerts.
  const filter = `and ($5::text is null or a.severity = $5) and (case when $6::text is null then a.status <> 'RESOLVED' else a.status = $6 end)`;
  const [rows, totals, counts] = await tenantTx(access, [
    sqlClient.query(
      `select a.id, a.employee_id, e.first_name, e.last_name, e.employee_code, a.company_id, a.root_group_id, a.alert_category, a.severity,
              a.title, a.trigger_date::text, a.days_remaining, a.status, a.acknowledged_by, a.acknowledged_at::text
       from compliance_alerts a join employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id
       where ${SCOPE} ${filter}
       order by case a.severity when 'CRITICAL' then 0 when 'WARNING' then 1 else 2 end, a.trigger_date, a.id
       limit $7 offset $8`,
      [...base, input.severity, input.status, input.pageSize, (input.page - 1) * input.pageSize],
    ),
    sqlClient.query(
      `select count(*)::int as total from compliance_alerts a join employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id where ${SCOPE} ${filter}`,
      [...base, input.severity, input.status],
    ),
    sqlClient.query(
      `select a.severity, count(*)::int as n from compliance_alerts a join employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id
       where ${SCOPE} and a.status = 'ACTIVE' group by a.severity`,
      base,
    ),
  ]);
  const bySeverity = new Map((counts as Array<{ severity: string; n: number }>).map((row) => [row.severity, Number(row.n)]));
  const critical = bySeverity.get("CRITICAL") ?? 0;
  const warning = bySeverity.get("WARNING") ?? 0;
  const info = bySeverity.get("INFO") ?? 0;
  return {
    items: (rows as Row[]).map(toAlert),
    page: input.page, pageSize: input.pageSize,
    total: Number((totals as Array<{ total: number }>)[0]?.total ?? 0),
    counts: { active: critical + warning + info, critical, warning, info },
  };
}

/** Acknowledge one alert in the caller's scope: alert update and audit row in one transaction. Idempotent on an acknowledged alert. */
export async function acknowledgeAlert(access: Access, alertId: string, requestId: string): Promise<ComplianceAlert> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  if (!uuidOrNull(alertId)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const all = seesAll(access);
  const self = uuidOrNull(access.context.employeeId ?? null);
  const base = [access.tenantId, self, all, null];
  const [found] = await tenantTx(access, [
    sqlClient.query(`select a.id, a.status from compliance_alerts a join employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id where ${SCOPE} and a.id = $5::uuid`, [...base, alertId]),
  ]);
  const current = (found as Array<{ id: string; status: string }>)[0];
  if (!current || (!all && !self)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (current.status === "RESOLVED") throw new HttpError({ status: 409, code: "CONFLICT", message: "This alert is already resolved." });
  if (current.status === "ACTIVE") {
    await tenantTx(access, [
      sqlClient`update compliance_alerts set status = 'ACKNOWLEDGED', acknowledged_by = ${access.context.actorUserId}, acknowledged_at = now(), updated_at = now()
                where tenant_id = ${access.tenantId} and id = ${alertId}::uuid and status = 'ACTIVE'`,
      sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
                values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'compliance_alert.acknowledged', 'compliance_alert',
                        ${alertId}, 'Alert acknowledged', ${JSON.stringify({ status: "ACKNOWLEDGED" })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
    ]);
  }
  const [rows] = await tenantTx(access, [
    sqlClient`select a.id, a.employee_id, e.first_name, e.last_name, e.employee_code, a.company_id, a.root_group_id, a.alert_category, a.severity,
                     a.title, a.trigger_date::text, a.days_remaining, a.status, a.acknowledged_by, a.acknowledged_at::text
              from compliance_alerts a join employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id
              where a.tenant_id = ${access.tenantId} and a.id = ${alertId}::uuid`,
  ]);
  return toAlert((rows as Row[])[0]!); // Present: it was found in scope above and alerts are never deleted.
}
