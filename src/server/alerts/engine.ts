import "server-only";

import { sqlClient } from "@/lib/db";
import {
  ALERT_CATEGORIES, DEFAULT_THRESHOLDS, evaluateCandidates, normaliseThresholds,
  type AlertCandidate, type AlertCategory, type EvaluatedAlert,
} from "@/lib/compliance-alerts";
import { tenantTx, type Access } from "@/server/platform/access";
import { organisationContext } from "@/server/dashboards/query";

/**
 * Compliance alert engine (tables compliance_alerts, alert_rules, alert_scan_state; migration 0040).
 *
 * Sources per active employee:
 * - VISA_EXPIRY         employees.visa_expiry_date (0037, when present), else metadata.visaExpiry
 * - WORK_PERMIT_EXPIRY  employees.work_permit_expiry_date (0037, when present), else metadata.workPermitExpiry
 * - DOCUMENT_EXPIRY     latest document_expiries.expires_on, else documents.attributes.expires_at
 * - CUSTOM_DATE_ALERT   custom_field_values whose definition is DATE-typed
 * Candidates are upserted by unique_dedup_key; alerts no longer in range (date moved, employee left,
 * source removed) are RESOLVED. Everything for one run is written in one transaction.
 */

type Scope = { employeeId?: string };
type RuleMap = Partial<Record<AlertCategory, { enabled: boolean; thresholds: number[] }>>;
export type ScanSummary = { tenantId: string; today: string; candidates: number; open: number; resolved: number };

const INACTIVE = ["separated", "exited", "relieved", "archived", "inactive"];
const DATE_RE = "^\\d{4}-\\d{2}-\\d{2}";

let columnCache: { visa: boolean; permit: boolean } | null = null;

/** Whether the 0037 columns exist (guarded so the engine runs before and after that migration). */
async function expiryColumns(access: Access): Promise<{ visa: boolean; permit: boolean }> {
  if (columnCache?.visa && columnCache.permit) return columnCache;
  const [rows] = await tenantTx(access, [
    sqlClient`select column_name from information_schema.columns
              where table_schema = 'public' and table_name = 'employees' and column_name in ('visa_expiry_date', 'work_permit_expiry_date')`,
  ]);
  const names = new Set((rows as Array<{ column_name: string }>).map((row) => row.column_name));
  columnCache = { visa: names.has("visa_expiry_date"), permit: names.has("work_permit_expiry_date") };
  return columnCache;
}

async function loadRules(access: Access): Promise<RuleMap> {
  const [rows] = await tenantTx(access, [
    sqlClient`select alert_category, enabled, thresholds_days from alert_rules where tenant_id = ${access.tenantId}`,
  ]);
  const map: RuleMap = {};
  for (const category of ALERT_CATEGORIES) map[category] = { enabled: true, thresholds: [...DEFAULT_THRESHOLDS] };
  for (const row of rows as Array<{ alert_category: AlertCategory; enabled: boolean; thresholds_days: number[] | null }>) {
    map[row.alert_category] = { enabled: row.enabled, thresholds: normaliseThresholds(row.thresholds_days) };
  }
  return map;
}

async function todayFor(access: Access): Promise<string> {
  const { timezone } = await organisationContext(access);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** One statement returning every candidate date for the tenant (or one employee). */
export function candidateQuery(tenantId: string, columns: { visa: boolean; permit: boolean }, scope: Scope) {
  const visa = columns.visa ? "coalesce(e.visa_expiry_date::text, e.metadata->>'visaExpiry')" : "(e.metadata->>'visaExpiry')";
  const permit = columns.permit ? "coalesce(e.work_permit_expiry_date::text, e.metadata->>'workPermitExpiry')" : "(e.metadata->>'workPermitExpiry')";
  const text = `
    with recursive tree as (
      select id, id as root, 0 as depth from legal_entities where tenant_id = $1::uuid and parent_legal_entity_id is null
      union all
      select c.id, t.root, t.depth + 1 from legal_entities c join tree t on c.parent_legal_entity_id = t.id
      where c.tenant_id = $1::uuid and t.depth < 12
    ),
    emp as (
      select e.*, tree.root as root_group_id from employees e left join tree on tree.id = e.legal_entity_id
      where e.tenant_id = $1::uuid and coalesce(lower(e.status), 'active') <> all($2::text[])
        and ($3::uuid is null or e.id = $3::uuid)
    ),
    raw as (
      select e.id as employee_id, e.legal_entity_id as company_id, e.root_group_id, 'VISA_EXPIRY' as category, 'visa' as source_ref,
             'Visa expiry' as title, ${visa} as trigger_date from emp e
      union all
      select e.id, e.legal_entity_id, e.root_group_id, 'WORK_PERMIT_EXPIRY', 'work_permit', 'Work permit expiry', ${permit} from emp e
      union all
      select e.id, e.legal_entity_id, e.root_group_id, 'DOCUMENT_EXPIRY', 'document:' || d.id::text,
             coalesce(nullif(d.attributes->>'title', ''), dt.attributes->>'name', 'Document'),
             coalesce((select x.attributes->>'expires_on' from document_expiries x where x.tenant_id = d.tenant_id and x.document_id = d.id order by x.created_at desc limit 1), d.attributes->>'expires_at')
      from emp e join documents d on d.tenant_id = e.tenant_id and d.employee_id = e.id and d.record_status <> 'deleted'
      left join document_types dt on dt.tenant_id = d.tenant_id and dt.id = d.document_type_id
      union all
      select e.id, e.legal_entity_id, e.root_group_id, 'CUSTOM_DATE_ALERT', 'custom:' || f.id::text,
             coalesce(f.attributes->>'label', f.attributes->>'name', 'Custom date'), v.attributes->>'value'
      from custom_field_values v
      join custom_field_definitions f on f.tenant_id = v.tenant_id and f.id = v.custom_field_definition_id
      join emp e on e.id::text = coalesce(v.attributes->>'employee_id', v.attributes->>'entity_id')
      where v.tenant_id = $1::uuid and v.record_status <> 'deleted' and f.record_status <> 'deleted'
        and upper(coalesce(f.attributes->>'data_type', f.attributes->>'field_type', f.attributes->>'type', '')) = 'DATE'
    )
    select employee_id::text, company_id::text, root_group_id::text, category, source_ref, title, substr(trigger_date, 1, 10) as trigger_date
    from raw where trigger_date ~ '${DATE_RE}'`;
  return sqlClient.query(text, [tenantId, INACTIVE, scope.employeeId ?? null]);
}

type CandidateRow = { employee_id: string; company_id: string | null; root_group_id: string | null; category: AlertCategory; source_ref: string; title: string; trigger_date: string };

/** Upsert the open alerts and resolve the rest of the scope, in one transaction. */
export function writeStatements(access: Access, open: EvaluatedAlert[], scope: Scope, today: string) {
  const payload = JSON.stringify(open.map((alert) => ({
    employee_id: alert.employeeId, company_id: alert.companyId, root_group_id: alert.rootGroupId, alert_category: alert.category,
    severity: alert.severity, title: alert.title, source_ref: alert.sourceRef, trigger_date: alert.triggerDate,
    days_remaining: alert.daysRemaining, unique_dedup_key: alert.dedupKey,
  })));
  const keys = open.map((alert) => alert.dedupKey);
  const statements = [
    sqlClient.query(
      `insert into compliance_alerts (tenant_id, employee_id, company_id, root_group_id, alert_category, severity, title, source_ref, trigger_date, days_remaining, unique_dedup_key)
       select $1::uuid, r.employee_id, r.company_id, r.root_group_id, r.alert_category, r.severity, r.title, r.source_ref, r.trigger_date, r.days_remaining, r.unique_dedup_key
       from jsonb_to_recordset($2::jsonb) as r(employee_id uuid, company_id uuid, root_group_id uuid, alert_category text, severity text, title text,
            source_ref text, trigger_date date, days_remaining integer, unique_dedup_key text)
       on conflict (tenant_id, unique_dedup_key) do update set
         severity = excluded.severity, title = excluded.title, company_id = excluded.company_id, root_group_id = excluded.root_group_id,
         days_remaining = excluded.days_remaining, trigger_date = excluded.trigger_date,
         status = case when compliance_alerts.status = 'RESOLVED' or compliance_alerts.trigger_date <> excluded.trigger_date then 'ACTIVE' else compliance_alerts.status end,
         acknowledged_by = case when compliance_alerts.status = 'RESOLVED' or compliance_alerts.trigger_date <> excluded.trigger_date then null else compliance_alerts.acknowledged_by end,
         acknowledged_at = case when compliance_alerts.status = 'RESOLVED' or compliance_alerts.trigger_date <> excluded.trigger_date then null else compliance_alerts.acknowledged_at end,
         resolved_at = null, updated_at = now()`,
      [access.tenantId, payload],
    ),
    sqlClient.query(
      `update compliance_alerts set status = 'RESOLVED', resolved_at = now(), updated_at = now()
       where tenant_id = $1::uuid and status <> 'RESOLVED' and unique_dedup_key <> all($2::text[])
         and ($3::uuid is null or employee_id = $3::uuid)
         and alert_category in ('VISA_EXPIRY', 'WORK_PERMIT_EXPIRY', 'DOCUMENT_EXPIRY', 'CUSTOM_DATE_ALERT')
       returning id`,
      [access.tenantId, keys, scope.employeeId ?? null],
    ),
  ];
  if (!scope.employeeId) {
    statements.push(sqlClient.query(
      `insert into alert_scan_state (tenant_id, last_scan_on, last_summary) values ($1::uuid, $2::date, $3::jsonb)
       on conflict (tenant_id) do update set last_scan_on = excluded.last_scan_on, last_summary = excluded.last_summary, updated_at = now()`,
      [access.tenantId, today, JSON.stringify({ open: open.length })],
    ));
  }
  return statements;
}

async function run(access: Access, scope: Scope): Promise<ScanSummary> {
  const [columns, rules, today] = await Promise.all([expiryColumns(access), loadRules(access), todayFor(access)]);
  const [rows] = await tenantTx(access, [candidateQuery(access.tenantId, columns, scope)]);
  const candidates: AlertCandidate[] = (rows as CandidateRow[]).map((row) => ({
    employeeId: row.employee_id, companyId: row.company_id, rootGroupId: row.root_group_id, category: row.category,
    sourceRef: row.source_ref, title: row.title, triggerDate: row.trigger_date,
  }));
  const open = evaluateCandidates(candidates, rules, today);
  const results = await tenantTx(access, writeStatements(access, open, scope, today));
  return { tenantId: access.tenantId, today, candidates: candidates.length, open: open.length, resolved: (results[1] as unknown[]).length };
}

async function asAccess(target: Access | string): Promise<Access> {
  if (typeof target !== "string") return target;
  const { systemAccess } = await import("@/server/jobs/worker");
  return systemAccess(target);
}

/** Full scan of one tenant (an Access, or a tenant id run under the worker's system access). */
export async function scanTenantAlerts(target: Access | string): Promise<ScanSummary> {
  return run(await asAccess(target), {});
}

/** Re-evaluate one employee's alerts right after their record, documents or custom fields change. */
export async function recomputeEmployeeAlerts(access: Access, employeeId: string): Promise<ScanSummary> {
  return run(access, { employeeId });
}

/** Daily scan from the cron tick: each tenant at most once per organisation-local day. Failures are reported per tenant. */
export async function runDailyAlertScans(tenantIds: readonly string[]): Promise<{ scanned: number; skipped: number; failed: number }> {
  const result = { scanned: 0, skipped: 0, failed: 0 };
  for (const tenantId of tenantIds) {
    try {
      const access = await asAccess(tenantId);
      const today = await todayFor(access);
      const [rows] = await tenantTx(access, [sqlClient`select last_scan_on::text as last from alert_scan_state where tenant_id = ${tenantId}`]);
      if ((rows as Array<{ last: string }>)[0]?.last === today) { result.skipped += 1; continue; }
      await run(access, {});
      result.scanned += 1;
    } catch {
      // One tenant's failure (e.g. no owner membership) must not stop the others; it is counted in the tick summary.
      result.failed += 1;
    }
  }
  return result;
}
