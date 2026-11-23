import "server-only";

import { randomUUID } from "node:crypto";
import { sqlClient } from "@/lib/db";
import { createModuleRecord, getModuleRecord, updateModuleRecord, type OperationalModuleConfig } from "@/server/ops/modules-service";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { isUndefinedTable, moduleStates, resolveModuleStore, type ModuleStore } from "./module-store";

/**
 * Tenant-scoped CRUD for operational-module records (registry screens rendered by OperationalModuleView).
 * Every read enforces the module's read permission, every write its write permission, every write is
 * audited in the same transaction, and nothing is invented: unknown ids are 404, missing storage is 503.
 */

export type ModuleRecord = {
  id: string;
  status: string | null;
  employeeId: string | null;
  attributes: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

type TableRow = {
  id: string;
  employee_id: string | null;
  status: string | null;
  attributes: Record<string, unknown> | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  start_time?: string | null;
  end_time?: string | null;
};

type Statement = { text: string; values: unknown[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROSTER = "roster_schedule";

/** Build a positional statement; `?` becomes $1..$n in order (tenantTx re-binds positionally). */
export function statement(text: string, values: unknown[]): Statement {
  let index = 0;
  return { text: text.replace(/\?/g, () => `$${++index}`), values };
}

const iso = (value: string | Date | null | undefined): string | null =>
  value === null || value === undefined ? null : value instanceof Date ? value.toISOString() : String(value);

function columns(store: ModuleStore & { kind: "table" }): string {
  return store.moduleId === ROSTER
    ? "id, employee_id, status, attributes, created_at, updated_at, start_time, end_time"
    : "id, employee_id, status, attributes, created_at, updated_at";
}

function fromRow(row: TableRow): ModuleRecord {
  const attributes = { ...(row.attributes ?? {}) };
  if (row.start_time && attributes.startTime === undefined) attributes.startTime = row.start_time;
  if (row.end_time && attributes.endTime === undefined) attributes.endTime = row.end_time;
  return { id: row.id, status: row.status ?? null, employeeId: row.employee_id ?? null, attributes, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function fromEvent(id: string, values: Record<string, unknown> | null, createdAt: string | Date | null): ModuleRecord {
  const attributes = values ?? {};
  const status = typeof attributes.status === "string" ? attributes.status : null;
  const updatedAt = typeof attributes.updatedAt === "string" ? attributes.updatedAt : iso(createdAt);
  const employeeId = typeof attributes.employeeId === "string" ? attributes.employeeId : null;
  return { id, status, employeeId, attributes, createdAt: iso(createdAt), updatedAt };
}

function employeeIdOf(payload: Record<string, unknown>): string | null {
  for (const key of ["employeeId", "personId"]) {
    const value = payload[key];
    if (typeof value === "string" && UUID.test(value)) return value;
  }
  return null;
}

function storageUnavailable(moduleId: string): HttpError {
  return new HttpError({ status: 503, code: "STORAGE_UNAVAILABLE", retryable: false, message: `The record store for module '${moduleId}' is not provisioned in this database.` });
}

function notFound(moduleId: string, id: string): HttpError {
  return new HttpError({ status: 404, code: "RECORD_NOT_FOUND", message: `Record '${id}' was not found in module '${moduleId}'.` });
}

function auditInsert(access: Access, action: string, entityType: string, id: string, reason: string, before: unknown, after: unknown, requestId: string) {
  return sqlClient`
    insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
    values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${action}, ${entityType}, ${id},
            ${reason}, ${before === null ? null : JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)`;
}

/** Run a table-path operation; fall back to the audit-event store only when the table does not exist. */
async function withTable<T>(store: ModuleStore & { kind: "table" }, run: () => Promise<T>, fallback: ((service: OperationalModuleConfig) => Promise<T>) | null): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isUndefinedTable(error)) throw error;
    if (store.service && fallback) return fallback(store.service);
    throw storageUnavailable(store.moduleId);
  }
}

export type ListArgs = { page: number; pageSize: number; search?: string | null };

async function listEvents(access: Access, service: OperationalModuleConfig, args: ListArgs, pattern: string | null) {
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    statement(
      `with latest as (select distinct on (entity_id) entity_id, after from audit_events
         where tenant_id = ?::uuid and entity_type = ? order by entity_id, created_at desc)
       select count(*)::int as total from latest where (?::text is null or after::text ilike ?)`,
      [access.tenantId, service.table, pattern, pattern],
    ),
    statement(
      `with latest as (select distinct on (entity_id) entity_id, after, created_at from audit_events
         where tenant_id = ?::uuid and entity_type = ? order by entity_id, created_at desc),
       first_seen as (select entity_id, min(created_at) as created_at from audit_events
         where tenant_id = ?::uuid and entity_type = ? group by entity_id)
       select l.entity_id, l.after, f.created_at, l.created_at as updated_at from latest l join first_seen f using (entity_id)
       where (?::text is null or l.after::text ilike ?)
       order by l.created_at desc, l.entity_id desc limit ? offset ?`,
      [access.tenantId, service.table, access.tenantId, service.table, pattern, pattern, args.pageSize, offset],
    ),
  ]);
  const total = (countRows as Array<{ total: number }>)[0]?.total ?? 0;
  const items = (rows as Array<{ entity_id: string; after: Record<string, unknown> | null; created_at: string | Date; updated_at: string | Date }>).map((row) => {
    const record = fromEvent(row.entity_id, row.after, row.created_at);
    return { ...record, updatedAt: record.updatedAt ?? iso(row.updated_at) };
  });
  return { items, total };
}

export async function listRecords(access: Access, moduleId: string, args: ListArgs): Promise<{ items: ModuleRecord[]; total: number }> {
  const store = resolveModuleStore(moduleId);
  enforce(access.context, store.read, { tenantId: access.tenantId });
  const search = args.search?.trim().slice(0, 100);
  const pattern = search ? `%${search}%` : null;
  if (store.kind === "service") return listEvents(access, store.service, args, pattern);
  return withTable(store, async () => {
    const offset = (args.page - 1) * args.pageSize;
    const [countRows, rows] = await tenantTx(access, [
      statement(`select count(*)::int as total from "${store.table}" where tenant_id = ? and (?::text is null or attributes::text ilike ?)`, [access.tenantId, pattern, pattern]),
      statement(
        `select ${columns(store)} from "${store.table}" where tenant_id = ? and (?::text is null or attributes::text ilike ?)
         order by created_at desc, id desc limit ? offset ?`,
        [access.tenantId, pattern, pattern, args.pageSize, offset],
      ),
    ]);
    return { items: (rows as TableRow[]).map(fromRow), total: (countRows as Array<{ total: number }>)[0]?.total ?? 0 };
  }, (service) => listEvents(access, service, args, pattern));
}

async function getEvent(access: Access, moduleId: string, id: string): Promise<ModuleRecord> {
  const record = await getModuleRecord(access, moduleId, id);
  return fromEvent(record.id, record.values, record.createdAt);
}

export async function getRecord(access: Access, moduleId: string, id: string): Promise<ModuleRecord> {
  const store = resolveModuleStore(moduleId);
  enforce(access.context, store.read, { tenantId: access.tenantId });
  if (store.kind === "service") return getEvent(access, moduleId, id);
  if (!UUID.test(id)) throw notFound(moduleId, id);
  return withTable(store, async () => {
    const [rows] = await tenantTx(access, [statement(`select ${columns(store)} from "${store.table}" where tenant_id = ? and id = ?::uuid limit 1`, [access.tenantId, id])]);
    const row = (rows as TableRow[])[0];
    if (!row) throw notFound(moduleId, id);
    return fromRow(row);
  }, () => getEvent(access, moduleId, id));
}

export async function createRecord(access: Access, moduleId: string, payload: Record<string, unknown>, requestId: string): Promise<ModuleRecord> {
  const store = resolveModuleStore(moduleId);
  enforce(access.context, store.write, { tenantId: access.tenantId });
  const viaService = async () => {
    const created = await createModuleRecord(access, moduleId, payload, requestId);
    return fromEvent(created.id, created.attributes, created.createdAt);
  };
  if (store.kind === "service") return viaService();
  return withTable(store, async () => {
    const id = randomUUID();
    const roster = store.moduleId === ROSTER;
    const insert = roster
      ? statement(
        `insert into "${store.table}" (id, tenant_id, employee_id, status, attributes, start_time, end_time) values (?::uuid, ?, ?::uuid, 'active', ?::jsonb, ?, ?) returning ${columns(store)}`,
        [id, access.tenantId, employeeIdOf(payload), JSON.stringify(payload), payload.startTime ? String(payload.startTime) : null, payload.endTime ? String(payload.endTime) : null],
      )
      : statement(
        `insert into "${store.table}" (id, tenant_id, employee_id, status, attributes) values (?::uuid, ?, ?::uuid, 'active', ?::jsonb) returning ${columns(store)}`,
        [id, access.tenantId, employeeIdOf(payload), JSON.stringify(payload)],
      );
    const [rows] = await tenantTx(access, [insert, auditInsert(access, `ops.${moduleId}.create`, moduleId, id, "Module record created", null, payload, requestId)]);
    const row = (rows as TableRow[])[0];
    if (!row) throw storageUnavailable(moduleId);
    return fromRow(row);
  }, viaService);
}

async function updateTable(access: Access, store: ModuleStore & { kind: "table" }, id: string, patch: Record<string, unknown>, status: string | null, action: string, reason: string, requestId: string) {
  if (!UUID.test(id)) throw notFound(store.moduleId, id);
  const roster = store.moduleId === ROSTER;
  const returning = columns(store).split(", ").map((column) => `t.${column}`).join(", ");
  const rosterSet = roster ? ", start_time = coalesce(?, t.start_time), end_time = coalesce(?, t.end_time)" : "";
  const rosterValues = roster ? [patch.startTime ? String(patch.startTime) : null, patch.endTime ? String(patch.endTime) : null] : [];
  // One statement: lock the prior row, merge the patch into attributes (never replace), audit before/after.
  const [rows] = await tenantTx(access, [
    statement(
      `with prior as (select id, attributes from "${store.table}" where tenant_id = ? and id = ?::uuid for update),
       updated as (update "${store.table}" as t set attributes = t.attributes || ?::jsonb, status = coalesce(?, t.status), updated_at = now()${rosterSet}
         from prior p where t.tenant_id = ? and t.id = p.id returning ${returning}),
       logged as (insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
         select ?::uuid, ?, ?::uuid, ?, ?, u.id::text, ?, p.attributes, u.attributes, ?::uuid from updated u join prior p on p.id = u.id)
       select * from updated`,
      [
        access.tenantId, id,
        JSON.stringify(patch), status, ...rosterValues, access.tenantId,
        access.tenantId, access.context.actorUserId, access.context.membershipId, action, store.moduleId, reason, uuidOrNull(requestId),
      ],
    ),
  ]);
  const row = (rows as TableRow[])[0];
  if (!row) throw notFound(store.moduleId, id);
  return fromRow(row);
}

export async function updateRecord(access: Access, moduleId: string, id: string, patch: Record<string, unknown>, requestId: string): Promise<ModuleRecord> {
  const store = resolveModuleStore(moduleId);
  enforce(access.context, store.write, { tenantId: access.tenantId });
  const viaService = async () => {
    await getModuleRecord(access, moduleId, id); // 404 when the record does not exist
    const updated = await updateModuleRecord(access, moduleId, id, patch, requestId);
    return fromEvent(updated.id, updated.attributes, null);
  };
  if (store.kind === "service") return viaService();
  return withTable(store, () => updateTable(access, store, id, patch, null, `ops.${moduleId}.update`, "Module record updated", requestId), viaService);
}

/** Move a record to one of the module's registry states (case-insensitive match, canonical casing stored). */
export async function transitionRecord(access: Access, moduleId: string, id: string, requested: string, requestId: string): Promise<ModuleRecord> {
  const store = resolveModuleStore(moduleId);
  enforce(access.context, store.write, { tenantId: access.tenantId });
  const states = moduleStates(moduleId);
  const state = states.length ? states.find((item) => item.toLowerCase() === requested.trim().toLowerCase()) : requested.trim();
  if (!state) {
    throw new HttpError({ status: 422, code: "INVALID_STATE", message: `'${requested}' is not a state of this module.`, details: [{ field: "state", issue: `Allowed: ${states.join(", ")}` }] });
  }
  const patch = { status: state, state };
  const viaService = async () => {
    await getModuleRecord(access, moduleId, id);
    const updated = await updateModuleRecord(access, moduleId, id, patch, requestId);
    return fromEvent(updated.id, updated.attributes, null);
  };
  if (store.kind === "service") return viaService();
  return withTable(store, () => updateTable(access, store, id, patch, state, "ops.state_transition", `State transitioned to ${state}`, requestId), viaService);
}

export async function deleteRecord(access: Access, moduleId: string, id: string, requestId: string): Promise<{ id: string; deleted: true }> {
  const store = resolveModuleStore(moduleId);
  enforce(access.context, store.write, { tenantId: access.tenantId });
  if (store.kind === "service") {
    throw new HttpError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Records in this module are kept for audit and cannot be deleted. Move the record to a closing state instead." });
  }
  if (!UUID.test(id)) throw notFound(moduleId, id);
  return withTable(store, async () => {
    const [rows] = await tenantTx(access, [
      statement(
        `with removed as (delete from "${store.table}" where tenant_id = ? and id = ?::uuid returning id, attributes),
         logged as (insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
           select ?::uuid, ?, ?::uuid, ?, ?, r.id::text, 'Module record deleted', r.attributes, '{}'::jsonb, ?::uuid from removed r)
         select id from removed`,
        [access.tenantId, id, access.tenantId, access.context.actorUserId, access.context.membershipId, `ops.${moduleId}.delete`, moduleId, uuidOrNull(requestId)],
      ),
    ]);
    if ((rows as unknown[]).length === 0) throw notFound(moduleId, id);
    return { id, deleted: true as const };
  }, null);
}
