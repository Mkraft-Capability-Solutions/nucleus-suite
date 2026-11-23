import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { resolveScreen } from "@/server/ai/nucleus/app-knowledge";
import { listLibrary } from "@/server/documents/library";
import { authorize } from "@/server/identity/authorization";
import { getCareer } from "@/server/organization/job-history";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * People-management read tools for the Nucleus Assistant.
 *
 * Every tool runs under the caller's own access: the tenant comes from the session, the company filter comes from a
 * company the caller was already checked against (see resolveActiveCompany), and every statement runs through
 * tenantTx with an explicit tenant_id filter (RLS is the backstop). A caller without employee.read only ever sees
 * their own linked employee record. Visa / work-permit numbers are masked unless the caller holds
 * employee.visa.read or compliance.read.
 *
 * Columns and tables added by later migrations (visa fields on employees, compliance_alerts,
 * employment_movement_logs) are discovered through information_schema, so the tools work before and after those
 * migrations land. Identifiers used in dynamic SQL only ever come from the fixed candidate lists below.
 */

export const PEOPLE_TOOLS = ["employee_lookup", "expiring_visas", "movement_history", "document_status"] as const;
export type PeopleTool = (typeof PEOPLE_TOOLS)[number];
export function isPeopleTool(name: string): name is PeopleTool {
  return (PEOPLE_TOOLS as readonly string[]).includes(name);
}

export type PeopleScope = { companyId?: string | null };
export type DeepLink = { label: string; tab: string; domain?: string; sub: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MATCH_CAP = 10;

export const VISA_NUMBER_COLUMNS = ["visa_number", "visa_no", "work_permit_number", "work_permit_no"] as const;
export const VISA_EXPIRY_COLUMNS = ["visa_expiry_date", "visa_expiry", "visa_expires_on", "work_permit_expiry_date", "work_permit_expiry", "work_permit_expires_on"] as const;
export const VISA_TYPE_COLUMNS = ["visa_type", "work_permit_type"] as const;
const ALERT_DATE_COLUMNS = ["expires_on", "expiry_date", "due_date", "due_on"] as const;
const ALERT_KIND_COLUMNS = ["alert_type", "kind", "category", "type"] as const;
const MOVEMENT_ORDER_COLUMNS = ["effective_date", "effective_from", "moved_on", "created_at"] as const;

/* ------------------------------------------------------------------------- */
/* Pure helpers (unit-tested)                                                 */
/* ------------------------------------------------------------------------- */

/** First candidate column that exists, or null. Only returns values from `candidates`. */
export function pickColumn<T extends string>(existing: ReadonlySet<string>, candidates: readonly T[]): T | null {
  return candidates.find((column) => existing.has(column)) ?? null;
}

/** Keeps only the last four characters of an identifier. */
export function maskIdentifier(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (raw === "") return null;
  return raw.length <= 4 ? "••••" : `••••${raw.slice(-4)}`;
}

function allowed(access: Access, action: string): boolean {
  return authorize(access.context, { action, resource: { tenantId: access.tenantId } }).allowed;
}

export function canReadVisa(access: Access): boolean {
  return allowed(access, "employee.visa.read") || allowed(access, "compliance.read");
}

export type Reach = { kind: "all" } | { kind: "self"; employeeId: string };

/** employee.read sees the (company-scoped) directory; otherwise only one's own linked record. */
export function reachOf(access: Access): Reach {
  if (allowed(access, "employee.read")) return { kind: "all" };
  const own = access.context.employeeId;
  if (own && UUID.test(own)) return { kind: "self", employeeId: own };
  throw new HttpError({ status: 403, code: "FORBIDDEN", message: "This action is not permitted for the current role." });
}

export function clampDays(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 30;
  return Math.min(365, Math.max(1, Math.trunc(n)));
}

function link(screenId: string, fallback: DeepLink): DeepLink {
  const target = resolveScreen(screenId);
  return target ? { label: target.label, tab: target.tab, domain: target.domain, sub: target.sub } : fallback;
}

export const PEOPLE_LINK: DeepLink = { label: "People Core", tab: "people_core", domain: "core_hr", sub: "core_people" };
export const DOCUMENTS_LINK: DeepLink = { label: "Documents", tab: "documents", domain: "documents", sub: "document_vault" };
export const COMPLIANCE_LINK: DeepLink = { label: "Statutory Compliance", tab: "compliance", domain: "core_hr", sub: "core_compliance" };

/* ------------------------------------------------------------------------- */
/* Schema discovery                                                           */
/* ------------------------------------------------------------------------- */

async function columnsOf(access: Access, tables: readonly string[]): Promise<Map<string, Set<string>>> {
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select table_name, column_name from information_schema.columns
        where table_schema = current_schema() and table_name = any($1::text[])`,
      [tables],
    ),
  ]);
  const map = new Map<string, Set<string>>();
  for (const row of rows as Array<{ table_name: string; column_name: string }>) {
    const set = map.get(row.table_name) ?? new Set<string>();
    set.add(row.column_name);
    map.set(row.table_name, set);
  }
  return map;
}

const ident = (name: string) => `"${name.replace(/"/g, "")}"`;

/* ------------------------------------------------------------------------- */
/* Employee resolution                                                        */
/* ------------------------------------------------------------------------- */

type EmployeeRow = {
  id: string; employee_code: string; name: string; designation: string | null; department: string | null; location: string | null;
  status: string | null; joining_date: string | null; work_email: string | null; company_id: string | null; company_name: string | null;
  manager_name: string | null; visa_number?: string | null; visa_expiry?: string | null; visa_type?: string | null;
};

async function searchEmployees(access: Access, query: string, scope: PeopleScope, employeeColumns: ReadonlySet<string>): Promise<EmployeeRow[]> {
  const reach = reachOf(access);
  const numberCol = pickColumn(employeeColumns, VISA_NUMBER_COLUMNS);
  const expiryCol = pickColumn(employeeColumns, VISA_EXPIRY_COLUMNS);
  const typeCol = pickColumn(employeeColumns, VISA_TYPE_COLUMNS);
  const hasCompany = employeeColumns.has("legal_entity_id");
  const trimmed = query.trim().slice(0, 80);
  const like = `%${trimmed.replace(/[%_\\]/g, "")}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select e.id, e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name,
          coalesce(jp.attributes->>'title', e.designation) as designation, coalesce(dep.attributes->>'name', e.department) as department,
          e.location, e.status, e.joining_date::text as joining_date, e.work_email,
          ${hasCompany ? "le.id::text as company_id, le.legal_name as company_name" : "null::text as company_id, null::text as company_name"},
          case when mgr.id is null then null else trim(coalesce(mgr.first_name, '') || ' ' || coalesce(mgr.last_name, '')) end as manager_name
          ${numberCol ? `, e.${ident(numberCol)}::text as visa_number` : ""}
          ${expiryCol ? `, e.${ident(expiryCol)}::text as visa_expiry` : ""}
          ${typeCol ? `, e.${ident(typeCol)}::text as visa_type` : ""}
        from employees e
        left join job_profiles jp on jp.tenant_id = e.tenant_id and jp.attributes->>'code' = e.designation
        left join departments dep on dep.tenant_id = e.tenant_id and dep.attributes->>'code' = e.department
        left join employees mgr on mgr.tenant_id = e.tenant_id and mgr.id = e.manager_employee_id
        ${hasCompany ? "left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id" : ""}
        where e.tenant_id = $1
          and ($2::uuid is null or e.id = $2::uuid)
          and ($3::uuid is null ${hasCompany ? "or e.legal_entity_id = $3::uuid" : ""})
          and ($4::uuid = e.id or e.employee_code ilike $5 or (e.first_name || ' ' || coalesce(e.last_name, '') || ' ' || e.employee_code) ilike $6)
        order by (e.employee_code = $5) desc, e.employee_code asc
        limit ${MATCH_CAP + 1}`,
      [
        access.tenantId,
        reach.kind === "self" ? reach.employeeId : null,
        scope.companyId ?? null,
        UUID.test(trimmed) ? trimmed : null,
        trimmed,
        like,
      ],
    ),
  ]);
  return rows as EmployeeRow[];
}

function visaView(row: EmployeeRow, visible: boolean) {
  if (row.visa_number === undefined && row.visa_expiry === undefined && row.visa_type === undefined) {
    return { available: false, message: "The platform does not record visa or work-permit details yet." };
  }
  return {
    available: true,
    number: visible ? row.visa_number ?? null : maskIdentifier(row.visa_number),
    type: row.visa_type ?? null,
    expiresOn: row.visa_expiry ?? null,
    masked: !visible,
  };
}

/* ------------------------------------------------------------------------- */
/* Tools                                                                      */
/* ------------------------------------------------------------------------- */

export async function employeeLookup(access: Access, query: string, scope: PeopleScope = {}) {
  if (query.trim() === "") throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Name or employee code is required." });
  const columns = await columnsOf(access, ["employees"]);
  const rows = await searchEmployees(access, query, scope, columns.get("employees") ?? new Set());
  const visible = canReadVisa(access);
  const people = link("core_people", PEOPLE_LINK);
  const matches = rows.slice(0, MATCH_CAP).map((row) => ({
    id: row.id,
    employeeCode: row.employee_code,
    name: row.name,
    company: row.company_name,
    designation: row.designation,
    department: row.department,
    location: row.location,
    status: row.status,
    joiningDate: row.joining_date,
    manager: row.manager_name,
    visa: visaView(row, visible),
  }));
  return {
    query,
    matchCount: matches.length,
    truncated: rows.length > MATCH_CAP,
    ambiguous: matches.length > 1,
    matches,
    actions: [people],
  };
}

type Expiring = { employeeId: string; employeeCode: string; name: string; company: string | null; kind: string; number: string | null; expiresOn: string; daysLeft: number; origin: string };

export async function expiringVisas(access: Access, days: number, scope: PeopleScope = {}) {
  const reach = reachOf(access);
  const columns = await columnsOf(access, ["employees", "compliance_alerts"]);
  const employeeColumns = columns.get("employees") ?? new Set<string>();
  const alertColumns = columns.get("compliance_alerts");
  const visible = canReadVisa(access);
  const hasCompany = employeeColumns.has("legal_entity_id");
  const selfId = reach.kind === "self" ? reach.employeeId : null;
  const statements: unknown[] = [];
  const origins: string[] = [];

  const numberCol = pickColumn(employeeColumns, VISA_NUMBER_COLUMNS);
  const expiryCols = VISA_EXPIRY_COLUMNS.filter((column) => employeeColumns.has(column));
  for (const expiryCol of expiryCols) {
    const kind = expiryCol.startsWith("work_permit") ? "work_permit" : "visa";
    statements.push(
      sqlClient.query(
        `select e.id::text as employee_id, e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name,
            ${hasCompany ? "le.legal_name" : "null::text"} as company, '${kind}' as kind,
            ${numberCol ? `e.${ident(numberCol)}::text` : "null::text"} as number,
            e.${ident(expiryCol)}::date::text as expires_on, (e.${ident(expiryCol)}::date - current_date)::int as days_left
          from employees e
          ${hasCompany ? "left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id" : ""}
          where e.tenant_id = $1 and ($2::uuid is null or e.id = $2::uuid)
            and ($3::uuid is null ${hasCompany ? "or e.legal_entity_id = $3::uuid" : ""})
            and coalesce(lower(e.status), 'active') not in ('separated', 'exited', 'relieved', 'archived')
            and e.${ident(expiryCol)} is not null
            and e.${ident(expiryCol)}::date between current_date and current_date + $4::int
          order by 7 limit 200`,
        [access.tenantId, selfId, scope.companyId ?? null, days],
      ),
    );
    origins.push(`employees.${expiryCol}`);
  }

  const alertDate = alertColumns ? pickColumn(alertColumns, ALERT_DATE_COLUMNS) : null;
  if (alertColumns && alertDate && alertColumns.has("employee_id") && alertColumns.has("tenant_id")) {
    const alertKind = pickColumn(alertColumns, ALERT_KIND_COLUMNS);
    statements.push(
      sqlClient.query(
        `select e.id::text as employee_id, e.employee_code, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name,
            ${hasCompany ? "le.legal_name" : "null::text"} as company,
            ${alertKind ? `coalesce(a.${ident(alertKind)}::text, 'visa')` : "'visa'"} as kind, null::text as number,
            a.${ident(alertDate)}::date::text as expires_on, (a.${ident(alertDate)}::date - current_date)::int as days_left
          from compliance_alerts a
          join employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id
          ${hasCompany ? "left join legal_entities le on le.tenant_id = e.tenant_id and le.id = e.legal_entity_id" : ""}
          where a.tenant_id = $1 and ($2::uuid is null or e.id = $2::uuid)
            and ($3::uuid is null ${hasCompany ? "or e.legal_entity_id = $3::uuid" : ""})
            ${alertKind ? `and (a.${ident(alertKind)}::text ilike '%visa%' or a.${ident(alertKind)}::text ilike '%permit%')` : ""}
            ${alertColumns.has("status") ? "and coalesce(lower(a.status::text), 'open') not in ('resolved', 'closed', 'dismissed')" : ""}
            and a.${ident(alertDate)}::date between current_date and current_date + $4::int
          order by 7 limit 200`,
        [access.tenantId, selfId, scope.companyId ?? null, days],
      ),
    );
    origins.push("compliance_alerts");
  }

  const actions = [link("core_compliance", COMPLIANCE_LINK), link("core_people", PEOPLE_LINK)];
  if (statements.length === 0) {
    return {
      days,
      expiring: { available: false, value: null, message: "The platform does not record visa or work-permit expiry dates yet." },
      actions,
    };
  }
  const results = await tenantTx(access, statements);
  const seen = new Set<string>();
  const expiring: Expiring[] = [];
  for (const rows of results as Array<Array<Record<string, unknown>>>) {
    for (const row of rows) {
      const key = `${row.employee_id}|${row.kind}|${row.expires_on}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expiring.push({
        employeeId: String(row.employee_id),
        employeeCode: String(row.employee_code),
        name: String(row.name),
        company: (row.company as string | null) ?? null,
        kind: String(row.kind),
        number: visible ? ((row.number as string | null) ?? null) : maskIdentifier(row.number as string | null),
        expiresOn: String(row.expires_on),
        daysLeft: Number(row.days_left),
        origin: "",
      });
    }
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft || a.employeeCode.localeCompare(b.employeeCode));
  return {
    days,
    count: expiring.length,
    masked: !visible,
    expiring: { available: true, value: expiring.map(({ origin: _origin, ...rest }) => rest), origin: origins.join(", ") },
    actions,
  };
}

async function resolveOne(access: Access, employee: string, scope: PeopleScope) {
  const columns = await columnsOf(access, ["employees", "employment_movement_logs"]);
  const rows = await searchEmployees(access, employee, scope, columns.get("employees") ?? new Set());
  if (rows.length === 0) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "No employee matched in your scope." });
  return { rows, columns };
}

function ambiguousResult(rows: EmployeeRow[]) {
  return {
    ambiguous: true,
    matches: rows.slice(0, MATCH_CAP).map((row) => ({ id: row.id, employeeCode: row.employee_code, name: row.name, company: row.company_name })),
    actions: [link("core_people", PEOPLE_LINK)],
  };
}

const INTRA_GROUP_MOVES = new Set(["group_transfer", "secondment", "transfer", "joined"]);

export async function movementHistory(access: Access, employee: string, scope: PeopleScope = {}) {
  const { rows, columns } = await resolveOne(access, employee, scope);
  if (rows.length > 1) return ambiguousResult(rows);
  const person = rows[0];
  const header = { id: person.id, employeeCode: person.employee_code, name: person.name, company: person.company_name };
  const actions = [link("core_people", PEOPLE_LINK)];
  const logColumns = columns.get("employment_movement_logs");

  if (logColumns && logColumns.has("tenant_id") && logColumns.has("employee_id")) {
    const orderCol = pickColumn(logColumns, MOVEMENT_ORDER_COLUMNS);
    const [logRows] = await tenantTx(access, [
      sqlClient.query(
        `select to_jsonb(m) - 'tenant_id' as entry from employment_movement_logs m
          where m.tenant_id = $1 and m.employee_id = $2::uuid
          ${orderCol ? `order by m.${ident(orderCol)} desc` : ""} limit 50`,
        [access.tenantId, person.id],
      ),
    ]);
    return {
      employee: header,
      movements: { available: true, value: (logRows as Array<{ entry: Record<string, unknown> }>).map((row) => row.entry), origin: "employment_movement_logs" },
      actions,
    };
  }

  const career = await getCareer(access, person.id);
  const movements = career.entries
    .filter((entry) => INTRA_GROUP_MOVES.has(entry.movementType))
    .map((entry) => ({ movementType: entry.movementType, effectiveFrom: entry.effectiveFrom, company: entry.companyName, location: entry.location, department: entry.department, designation: entry.designation, reason: entry.reason }));
  return { employee: header, movements: { available: true, value: movements, origin: "employee_job_history" }, actions };
}

export async function documentStatus(access: Access, employee: string, scope: PeopleScope = {}, today: string = new Date().toISOString().slice(0, 10)) {
  const { rows } = await resolveOne(access, employee, scope);
  if (rows.length > 1) return ambiguousResult(rows);
  const person = rows[0];
  // listLibrary applies the document.read / document.self.read rules on its own.
  const library = await listLibrary(access, { employee: person.id });
  const documents = library.documents.map((doc) => ({ title: doc.title, type: doc.type, verification: doc.verification, issuedOn: doc.issuedOn, expiresOn: doc.expiresOn }));
  const upcoming = documents.filter((doc) => doc.expiresOn && doc.expiresOn >= today).sort((a, b) => String(a.expiresOn).localeCompare(String(b.expiresOn)));
  const expired = documents.filter((doc) => doc.expiresOn && doc.expiresOn < today).length;
  return {
    employee: { id: person.id, employeeCode: person.employee_code, name: person.name, company: person.company_name },
    total: documents.length,
    expired,
    nearestExpiry: upcoming[0] ? { title: upcoming[0].title, expiresOn: upcoming[0].expiresOn } : null,
    documents: { available: true, value: documents, origin: "Document library" },
    actions: [link("document_vault", DOCUMENTS_LINK), link("core_people", PEOPLE_LINK)],
  };
}

/* ------------------------------------------------------------------------- */
/* Dispatch                                                                   */
/* ------------------------------------------------------------------------- */

const employeeArgs = z.object({ employee: z.string().trim().min(1).max(80) });
const lookupArgs = z.object({ query: z.string().trim().min(1).max(80) });
const visaArgs = z.object({ days: z.unknown().optional() });

export async function runPeopleTool(access: Access, tool: PeopleTool, args: unknown, scope: PeopleScope = {}): Promise<unknown> {
  switch (tool) {
    case "employee_lookup":
      return employeeLookup(access, lookupArgs.parse(args ?? {}).query, scope);
    case "expiring_visas":
      return expiringVisas(access, clampDays(visaArgs.parse(args ?? {}).days), scope);
    case "movement_history":
      return movementHistory(access, employeeArgs.parse(args ?? {}).employee, scope);
    case "document_status":
      return documentStatus(access, employeeArgs.parse(args ?? {}).employee, scope);
  }
}

/**
 * Validates a client-supplied company id against the caller's tenant. Returns null when absent; 404 when the
 * company does not belong to the caller's tenant (existence is never leaked across tenants).
 */
export async function resolveActiveCompany(access: Access, companyId: string | null | undefined): Promise<string | null> {
  if (!companyId) return null;
  if (!UUID.test(companyId)) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "activeCompanyId must be a company identifier." });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} and id = ${companyId}::uuid limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return companyId;
}
