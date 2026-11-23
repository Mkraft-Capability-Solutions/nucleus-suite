import "server-only";

import type { ResolvedEntitlement } from "@/lib/entitlements/types";
import { entitlementsFor } from "@/server/entitlements/service";
import { barPanel, dayLabel, humanise, linePanel, listPanel, num, partsPanel, plural, tablePanel, withSource } from "../compose";
import { plain, runAll, type Row, type Scope } from "../query";
import type { Kpi, Panel } from "../types";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: string[]; employeesInScope: number | null };

const rowsOf = (rows: Row[] | null) => rows ?? [];
const first = (rows: Row[] | null): Row => rows?.[0] ?? {};

/* ================================================================== */
/* S10 · Workspace governance                                          */
/* ================================================================== */

export async function governanceBoard(scope: Scope): Promise<Built> {
  // $1 tenant · $2 timezone
  const [data, entitlements] = await Promise.all([
    runAll(scope.access, {
      people: plain(scope, `
        select
          (select count(*) from memberships where tenant_id = $1::uuid and status = 'active')::int as members,
          (select count(*) from memberships where tenant_id = $1::uuid and status = 'active' and employee_id is null)::int as unlinked,
          (select count(*) from invitations where tenant_id = $1::uuid and status = 'pending' and (expires_at is null or expires_at > now()))::int as invitations,
          (select count(*) from roles where tenant_id = $1::uuid and status = 'active')::int as roles`),
      roles: plain(scope, `
        select coalesce(r.name, r.code) as name, count(distinct mr.membership_id)::int as value
        from roles r
        left join membership_roles mr on mr.role_id = r.id
        left join memberships m on m.id = mr.membership_id and m.status = 'active'
        where r.tenant_id = $1::uuid and r.status = 'active'
        group by 1 order by 2 desc, 1 limit 12`),
      auditDaily: plain(scope, `
        select to_char(gs_day, 'YYYY-MM-DD') as day, count(a.id)::int as value
        from today t
        cross join lateral generate_series((t.d - 29)::timestamp, t.d::timestamp, interval '1 day') gs_day
        left join audit_events a on a.tenant_id = $1::uuid and (a.created_at at time zone $2::text)::date = gs_day::date
        group by gs_day order by gs_day`),
      auditActions: plain(scope, `
        select action as name, count(*)::int as value from audit_events, today t
        where tenant_id = $1::uuid and (created_at at time zone $2::text)::date > t.d - 30
        group by 1 order by 2 desc limit 10`),
      recent: plain(scope, `
        select a.action, a.entity_type, a.reason, to_char(a.created_at at time zone $2::text, 'YYYY-MM-DD HH24:MI') as at,
          (select u.name from "user" u where u.id = a.actor_user_id) as actor
        from audit_events a where a.tenant_id = $1::uuid order by a.created_at desc limit 10`),
      ai: plain(scope, `
        select coalesce(attributes->>'status', record_status, 'recorded') as name, count(*)::int as value
        from ai_runs where tenant_id = $1::uuid group by 1 order by 2 desc`),
      integrations: plain(scope, `
        select coalesce(attributes->>'name', attributes->>'code', 'Connection') as name, coalesce(attributes->>'status', record_status, 'configured') as status,
          to_char(updated_at at time zone $2::text, 'YYYY-MM-DD') as updated_on
        from integration_connections where tenant_id = $1::uuid order by updated_at desc limit 8`),
      privacy: plain(scope, `
        select count(*)::int as value from privacy_requests
        where tenant_id = $1::uuid and coalesce(attributes->>'status', 'open') not in ('closed', 'completed', 'rejected', 'fulfilled')`),
    }),
    entitlementsFor(scope.access).catch(() => null),
  ]);

  const people = first(data.people);
  const daily = rowsOf(data.auditDaily);
  const changes30 = daily.reduce((sum, row) => sum + num(row.value), 0);
  const modules: ResolvedEntitlement[] = entitlements ? (Object.values(entitlements.entries) as ResolvedEntitlement[]).filter((entry) => entry.scope === "module") : [];
  const activeModules = modules.filter((entry) => entry.active);
  const privacy = num(first(data.privacy).value);

  const kpis: Kpi[] = [
    { id: "members", label: "Active members", value: data.people ? num(people.members) : null, format: "count", hint: num(people.unlinked) ? `${num(people.unlinked)} not linked to an employee` : "All linked to employee records", target: "access_control" },
    { id: "invitations", label: "Pending invitations", value: data.people ? num(people.invitations) : null, format: "count", hint: "Not yet accepted" },
    { id: "roles", label: "Roles", value: data.people ? num(people.roles) : null, format: "count", hint: "Active roles", target: "access_control" },
    { id: "modules", label: "Modules switched on", value: entitlements ? activeModules.length : null, of: entitlements ? modules.length : null, format: "count", hint: "In this organisation's plan", target: "settings" },
    { id: "changes", label: "Changes recorded", value: data.auditDaily ? changes30 : null, format: "count", hint: "Last 30 days, audit trail" },
    { id: "privacy", label: "Open privacy requests", value: data.privacy ? privacy : null, format: "count", hint: "Access, correction and erasure", tone: privacy ? "attention" : "neutral" },
  ];

  const actions = rowsOf(data.auditActions);
  const roles = rowsOf(data.roles);
  const panels: Panel[] = [
    withSource(data.auditDaily, linePanel(
      { id: "activity", title: "Changes per day", subtitle: "Audit trail, last 30 days", span: 8, format: "count", emptyMessage: "No changes recorded in the last 30 days." },
      daily.map((row) => dayLabel(String(row.day))), [{ name: "Changes", data: daily.map((row) => num(row.value)) }],
    )),
    withSource(data.roles, barPanel(
      { id: "roles", title: "Members by role", span: 4, format: "count", emptyMessage: "No roles are assigned.", target: "access_control" },
      roles.map((row) => humanise(String(row.name))).reverse(), [{ name: "Members", data: roles.map((row) => num(row.value)).reverse() }], true,
    )),
    withSource(data.auditActions, barPanel(
      { id: "actions", title: "Most frequent changes", subtitle: "Last 30 days", span: 6, format: "count", emptyMessage: "No changes recorded in the last 30 days." },
      actions.map((row) => humanise(String(row.name))).reverse(), [{ name: "Changes", data: actions.map((row) => num(row.value)).reverse() }], true,
    )),
    withSource(data.recent, tablePanel(
      { id: "recent", title: "Latest changes", span: 6, emptyMessage: "No changes recorded." },
      [{ key: "at", label: "When" }, { key: "action", label: "Change" }, { key: "actor", label: "By" }],
      rowsOf(data.recent).map((row) => ({ at: String(row.at), action: humanise(String(row.action)), actor: row.actor ? String(row.actor) : "System" })),
    )),
    listPanel(
      { id: "modules", title: "Modules", subtitle: "Switched on for this organisation", span: 6, emptyMessage: "The organisation's plan could not be read.", target: "settings" },
      modules.map((entry) => ({ label: entry.name, status: entry.active ? "On" : "Off", tone: entry.active ? "positive" as const : "neutral" as const })),
    ),
    withSource(data.integrations, listPanel(
      { id: "integrations", title: "Integrations", span: 6, emptyMessage: "No integrations are connected.", target: "integrations" },
      rowsOf(data.integrations).map((row) => ({ label: String(row.name), detail: row.updated_on ? `Updated ${dayLabel(String(row.updated_on))}` : undefined, status: humanise(String(row.status)) })),
    )),
    withSource(data.ai, partsPanel(
      { id: "ai", title: "AI runs", subtitle: "By status", span: 12, format: "count", emptyMessage: "No AI runs recorded." },
      rowsOf(data.ai).map((row) => ({ name: humanise(String(row.name)), value: num(row.value) })),
    )),
  ];

  const insights: string[] = [];
  if (data.people) insights.push(`${plural(num(people.members), "member has", "members have")} access${num(people.invitations) ? ` and ${plural(num(people.invitations), "invitation is", "invitations are")} pending` : ""}.`);
  if (num(people.unlinked)) insights.push(`${plural(num(people.unlinked), "member is", "members are")} not linked to an employee record, so they have no personal dashboards.`);
  if (changes30) insights.push(`${plural(changes30, "change was", "changes were")} recorded in the last 30 days${actions[0] ? `, most often "${humanise(String(actions[0].name))}"` : ""}.`);
  if (entitlements) insights.push(`${activeModules.length} of ${modules.length} modules are switched on.`);

  return { kpis, panels, insights, employeesInScope: null };
}
