import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import {
  erpMatchTarget,
  ErpOwnershipError,
  planErpFieldWrites,
  type ErpConflict,
  type ErpFieldValues,
  type ErpSettings,
  type ErpWritePlan,
} from "@/lib/erp-field-ownership";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { payloadHashSource } from "@/server/vp/policy";
import { resolveErpSettings } from "./erp-settings";

/**
 * R-15 / T-28 — ERP employee master sync, and what happens when it fails.
 *
 * `vp_erp_records` was always shaped for this: it carries `status` values
 * `failed` and `dead`, an `attempt_count` and an `error_message`. Nothing in the
 * application ever wrote any of the three, so a failed sync produced an HTTP
 * error and no record at all — indistinguishable from a sync nobody ran.
 *
 * Two further defects fell out of the same code path and are fixed here.
 *
 *  1. **The replay guard ignored status.** It matched on
 *     `(direction, external_key, payload_hash)` alone, so once a row existed for
 *     a payload, re-sending that identical payload returned `{ replay: true }`
 *     whether or not it had ever been applied. A sync that failed half-way
 *     could therefore never be repaired by re-sending it.
 *     `resolveInboundReplay` now answers `replay` only for a record that
 *     actually reached `applied`.
 *
 *  2. **The record and the employee row were written in separate
 *     transactions.** The record was inserted as `validated`, the employee was
 *     upserted, and only then was the record marked `applied`. A failure between
 *     the second and third step left the record stuck at `validated` forever.
 *     `applyErpEmployee` writes the employee change and the record's own
 *     `applied` state in ONE transaction, so the two can only agree.
 *
 * The retry is deliberately manual and uncapped. `vp_erp_records.status`
 * includes `dead`, but no source states how many automatic attempts a record
 * gets before it is abandoned, so this module does not invent a threshold:
 * `retryErpRecord` re-runs one record on request and `abandonErpRecord` is the
 * recorded human decision to stop.
 *
 * Q-15 — which system owns which employee field — is answered per connection by
 * the ERP Integration and Field Ownership form (FRM-FIN-02, `erp-settings.ts`),
 * and this module obeys it: `match_key` decides how a record is matched,
 * `unmatched_action` decides create / hold / reject, `field_owner` decides
 * which fields an inbound record may overwrite, and `conflict_policy` decides
 * what happens when a Nucleus-owned field disagrees. A connection with no
 * saved map refuses to sync (`ERP_FIELD_OWNERSHIP_UNCONFIGURED`) rather than
 * overwriting everything.
 */

export const ERP_DIRECTIONS = ["inbound_employee", "outbound_gl"] as const;
export type ErpDirection = (typeof ERP_DIRECTIONS)[number];

/** `vp_erp_records.status`, as the table's own check constraint defines it. */
export const ERP_RECORD_STATUSES = ["received", "validated", "applied", "queued", "posted", "failed", "dead"] as const;
export type ErpRecordStatus = (typeof ERP_RECORD_STATUSES)[number];

/** The states a record may still be retried from. `applied`/`posted` are done; `dead` was abandoned. */
export const ERP_RETRYABLE_STATUSES: readonly ErpRecordStatus[] = ["received", "validated", "queued", "failed"];

export const erpEmployeePayloadSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  workEmail: z.string().email().optional(),
  department: z.string().min(1).max(80),
  location: z.string().min(1).max(80),
  designation: z.string().min(1).max(120),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date must be YYYY-MM-DD."),
  basicSalaryMinor: z.number().int().nonnegative().optional(),
});

export type ErpEmployeePayload = z.infer<typeof erpEmployeePayloadSchema>;

export const syncErpEmployeeSchema = z.object({
  connectionId: z.string().uuid().optional(),
  externalCode: z.string().min(1).max(80),
  employee: erpEmployeePayloadSchema,
  /**
   * When the ERP's copy last changed. Outside the payload hash on purpose — a
   * re-send of the same content is still a replay — and required only when the
   * connection's conflict policy is "Latest wins".
   */
  erpChangedAt: z.string().datetime({ offset: true }).optional(),
});

export type SyncErpEmployeeInput = z.infer<typeof syncErpEmployeeSchema>;

/** The canonical payload hash. Key order is normalised so it depends on content only. */
export function erpPayloadHash(payload: unknown): { canonical: string; hash: string } {
  const canonical = JSON.stringify(payloadHashSource(payload));
  return { canonical, hash: createHash("sha256").update(canonical).digest("hex") };
}

export type ReplayDecision =
  | { action: "replay"; recordId: string }
  | { action: "retry"; recordId: string }
  | { action: "apply" };

/**
 * What to do with an inbound payload whose hash has been seen before.
 *
 * Pure, so the rule can be asserted without a database. `applied` and `posted`
 * are the only states that mean the payload actually landed; everything else is
 * an attempt that did not finish and must be allowed to run again.
 */
export function resolveInboundReplay(
  existing: { id: string; status: string } | null,
): ReplayDecision {
  if (!existing) return { action: "apply" };
  const status = existing.status.trim().toLowerCase();
  if (status === "applied" || status === "posted") return { action: "replay", recordId: existing.id };
  // Everything else - received, validated, queued, failed, and even dead - is an
  // attempt that never landed. A fresh send from the ERP revives the record and
  // tries again; only `retryErpRecord` refuses to re-run an abandoned copy,
  // because abandoning it was a decision about that attempt, not about the data.
  return { action: "retry", recordId: existing.id };
}

type ErpRecordRow = {
  id: string;
  connection_id: string | null;
  direction: string;
  external_key: string;
  payload_hash: string;
  payload: unknown;
  status: string;
  attempt_count: number | string;
  error_message: string | null;
  acknowledgement_ref: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpQueueRow = {
  id: string;
  direction: string;
  externalKey: string;
  status: ErpRecordStatus;
  attemptCount: number;
  /** Why the last attempt stopped. Null when it has not failed. */
  errorMessage: string | null;
  retryable: boolean;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function queueRow(row: ErpRecordRow): ErpQueueRow {
  const status = ((ERP_RECORD_STATUSES as readonly string[]).includes(row.status) ? row.status : "received") as ErpRecordStatus;
  return {
    id: row.id,
    direction: row.direction,
    externalKey: row.external_key,
    status,
    attemptCount: Number(row.attempt_count ?? 0),
    errorMessage: row.error_message,
    retryable: ERP_RETRYABLE_STATUSES.includes(status),
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadRecord(access: Access, id: string): Promise<ErpRecordRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, connection_id, direction, external_key, payload_hash, payload, status, attempt_count, error_message,
        acknowledgement_ref, applied_at::text as applied_at, created_at::text as created_at, updated_at::text as updated_at
      from vp_erp_records where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const row = (rows as ErpRecordRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

/**
 * Claim the record for an attempt: create it if the payload is new, and count
 * the attempt either way. Committed on its own, BEFORE the apply, so a failure
 * in the apply still leaves a row in the queue to look at and retry.
 */
async function claimAttempt(
  access: Access,
  input: { recordId: string | null; direction: ErpDirection; externalKey: string; hash: string; stored: string; connectionId: string | null },
): Promise<string> {
  const id = input.recordId ?? crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into vp_erp_records (id, tenant_id, connection_id, direction, external_key, payload_hash, payload, status, attempt_count)
      values (${id}, ${access.tenantId}, ${input.connectionId}, ${input.direction}, ${input.externalKey}, ${input.hash}, ${input.stored}::jsonb, 'validated', 1)
      on conflict (tenant_id, direction, external_key, payload_hash) do update set
        status = 'validated',
        attempt_count = vp_erp_records.attempt_count + 1,
        error_message = null,
        payload = excluded.payload,
        connection_id = coalesce(excluded.connection_id, vp_erp_records.connection_id),
        updated_at = now()
    `,
  ]);
  const [rows] = await tenantTx(access, [
    sqlClient`select id from vp_erp_records where tenant_id = ${access.tenantId} and direction = ${input.direction}
      and external_key = ${input.externalKey} and payload_hash = ${input.hash} limit 1`,
  ]);
  const claimed = (rows as Array<{ id: string }>)[0];
  if (!claimed) throw new HttpError({ status: 500, code: "INTERNAL_ERROR", message: "The ERP record could not be claimed." });
  return claimed.id;
}

/** Record why an attempt stopped, so the queue can show it and a human can act. */
async function recordFailure(access: Access, recordId: string, error: unknown, requestId: string): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await tenantTx(access, [
      sqlClient`update vp_erp_records set status = 'failed', error_message = ${message.slice(0, 2000)}, updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${recordId}`,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'integration.erp_sync_failed', 'vp_erp_record', ${recordId}, ${message.slice(0, 500)},
          ${JSON.stringify({ error: message })}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);
  } catch {
    // The caller must see the sync error, not a logging error.
  }
}

/** The link the sync keeps on the employee row, whatever the match key: how the ERP names this person. */
const ERP_EXTERNAL_ID_KEY = "erp_external_id";

type MatchedEmployee = {
  id: string;
  current: ErpFieldValues;
  updatedAt: string | null;
};

type EmployeeMatchRow = {
  id: string;
  first_name: string;
  last_name: string;
  work_email: string | null;
  department: string;
  location: string;
  designation: string;
  joining_date: string;
  basic_salary_minor: number | string | null;
  updated_at: string | null;
};

/**
 * Find the employee the record refers to, on the connection's `match_key`.
 * The workbook requires the key to be unique in both systems, so two matches
 * are refused rather than resolved by picking one.
 */
async function findMatchedEmployee(access: Access, settings: ErpSettings, input: SyncErpEmployeeInput): Promise<MatchedEmployee | null> {
  const target = erpMatchTarget(settings.matchKey, { externalCode: input.externalCode, workEmail: input.employee.workEmail });
  if (target.value === null) {
    throw new HttpError({ status: 422, code: "ERP_MATCH_KEY_MISSING", message: target.issue });
  }
  // Three statements rather than one with a dynamic column: the key is an identifier, not a value.
  const statement =
    target.key === "employee_code"
      ? sqlClient`select id, first_name, last_name, work_email, department, location, designation,
          joining_date::text as joining_date, basic_salary_minor, updated_at::text as updated_at
        from employees where tenant_id = ${access.tenantId} and employee_code = ${target.value} limit 2`
      : target.key === "external_id"
        ? sqlClient`select id, first_name, last_name, work_email, department, location, designation,
            joining_date::text as joining_date, basic_salary_minor, updated_at::text as updated_at
          from employees where tenant_id = ${access.tenantId} and metadata->>${ERP_EXTERNAL_ID_KEY} = ${target.value} limit 2`
        : sqlClient`select id, first_name, last_name, work_email, department, location, designation,
            joining_date::text as joining_date, basic_salary_minor, updated_at::text as updated_at
          from employees where tenant_id = ${access.tenantId} and lower(work_email) = ${target.value} limit 2`;
  const [rows] = await tenantTx(access, [statement]);
  const matches = rows as EmployeeMatchRow[];
  if (matches.length > 1) {
    throw new HttpError({
      status: 409,
      code: "ERP_MATCH_AMBIGUOUS",
      message: `${matches.length} employees match on ${settings.matchKey} "${target.value}"; the match key must be unique in both systems.`,
    });
  }
  const row = matches[0];
  if (!row) return null;
  return {
    id: row.id,
    current: {
      firstName: row.first_name,
      lastName: row.last_name,
      workEmail: row.work_email,
      department: row.department,
      location: row.location,
      designation: row.designation,
      joiningDate: row.joining_date,
      basicSalaryMinor: row.basic_salary_minor,
    },
    updatedAt: row.updated_at,
  };
}

function markAppliedStatement(access: Access, recordId: string) {
  return sqlClient`
    update vp_erp_records set status = 'applied', applied_at = now(), error_message = null, updated_at = now()
    where tenant_id = ${access.tenantId} and id = ${recordId}
  `;
}

function appliedAuditStatement(access: Access, input: { employeeId: string; reason: string; after: Record<string, unknown>; requestId: string }) {
  return sqlClient`
    insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
    values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
      'vp.erp_employee_applied', 'employee', ${input.employeeId}, ${input.reason},
      ${JSON.stringify(input.after)}::jsonb, ${uuidOrNull(input.requestId)}::uuid)
  `;
}

/**
 * `unmatched_action = create`: a new employee from the ERP record. Every sent
 * field is written — there is no Nucleus value to protect yet — and the ERP's
 * code is remembered on the row so later records match under any match key.
 */
async function createErpEmployee(
  access: Access,
  input: { recordId: string; externalCode: string; employee: ErpEmployeePayload; hash: string; requestId: string },
): Promise<string> {
  const employeeId = crypto.randomUUID();
  const personId = crypto.randomUUID();
  const employee = input.employee;
  await tenantTx(access, [
    sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
    sqlClient`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, work_email, department, location, designation, joining_date, basic_salary_minor, metadata)
      values (${employeeId}, ${access.tenantId}, ${personId}, ${input.externalCode}, ${employee.firstName}, ${employee.lastName},
        ${employee.workEmail ?? null}, ${employee.department}, ${employee.location}, ${employee.designation},
        ${employee.joiningDate}, ${employee.basicSalaryMinor ?? null}, ${JSON.stringify({ [ERP_EXTERNAL_ID_KEY]: input.externalCode })}::jsonb)`,
    markAppliedStatement(access, input.recordId),
    appliedAuditStatement(access, {
      employeeId,
      reason: "Employee created from ERP record (unmatched_action = create)",
      after: { externalCode: input.externalCode, payloadHash: input.hash, created: true },
      requestId: input.requestId,
    }),
  ]);
  return employeeId;
}

/**
 * Write only the fields the plan allows and mark the record applied, in one
 * transaction. A field absent from `writes` keeps its Nucleus value: the
 * `coalesce(null, column)` form leaves it untouched inside a single UPDATE.
 */
async function applyErpFieldWrites(
  access: Access,
  input: { recordId: string; employeeId: string; externalCode: string; writes: ErpFieldValues; conflicts: ErpConflict[]; hash: string; requestId: string },
): Promise<void> {
  const w = input.writes;
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const salary = w.basicSalaryMinor === undefined || w.basicSalaryMinor === null ? null : Number(w.basicSalaryMinor);
  await tenantTx(access, [
    sqlClient`update employees set
        first_name = coalesce(${text(w.firstName)}, first_name),
        last_name = coalesce(${text(w.lastName)}, last_name),
        work_email = coalesce(${text(w.workEmail)}, work_email),
        department = coalesce(${text(w.department)}, department),
        location = coalesce(${text(w.location)}, location),
        designation = coalesce(${text(w.designation)}, designation),
        joining_date = coalesce(${text(w.joiningDate)}::date, joining_date),
        basic_salary_minor = coalesce(${salary}::bigint, basic_salary_minor),
        metadata = metadata || ${JSON.stringify({ [ERP_EXTERNAL_ID_KEY]: input.externalCode })}::jsonb,
        updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${input.employeeId}`,
    markAppliedStatement(access, input.recordId),
    appliedAuditStatement(access, {
      employeeId: input.employeeId,
      reason: "ERP-owned employee fields synchronized",
      after: { externalCode: input.externalCode, payloadHash: input.hash, written: Object.keys(w), conflicts: input.conflicts },
      requestId: input.requestId,
    }),
  ]);
}

/**
 * Park the record for a human: an unmatched record under `unmatched_action =
 * hold`, or a Nucleus-owned field in conflict under `hold_for_review`. `queued`
 * is retryable, so once the map or the data is corrected the same record runs
 * again; nothing on the employee is touched meanwhile.
 */
async function holdRecord(access: Access, recordId: string, reason: string, after: Record<string, unknown>, requestId: string): Promise<void> {
  await tenantTx(access, [
    sqlClient`update vp_erp_records set status = 'queued', error_message = ${reason.slice(0, 2000)}, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${recordId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'integration.erp_sync_held', 'vp_erp_record', ${recordId}, ${reason.slice(0, 500)},
        ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
}

export type ErpSyncResult = {
  id: string;
  employeeId: string | null;
  status: ErpRecordStatus;
  replay: boolean;
  attemptCount: number;
  /** Nucleus-owned fields the ERP disagreed on, and how each was settled. */
  conflicts?: ErpConflict[];
  /** Why the record is parked (`status: "queued"`); null when it applied. */
  holdReason?: string | null;
};

/**
 * Apply one ERP employee change. Replaces the body of `syncErpEmployee` in
 * `src/server/vp/service.ts`; the permission check stays with the command
 * dispatcher that calls it.
 *
 * The record is claimed BEFORE the ownership settings are consulted, so a sync
 * refused for want of a field-ownership map still lands in the queue as
 * `failed` with the named reason, and is retried — not re-sent — once the form
 * has been completed.
 */
export async function syncErpEmployee(access: Access, input: SyncErpEmployeeInput, requestId: string): Promise<ErpSyncResult> {
  const { hash } = erpPayloadHash(input.employee);
  const [priorRows] = await tenantTx(access, [
    sqlClient`select id, status, attempt_count from vp_erp_records
      where tenant_id = ${access.tenantId} and direction = 'inbound_employee'
        and external_key = ${input.externalCode} and payload_hash = ${hash} limit 1`,
  ]);
  const prior = (priorRows as Array<{ id: string; status: string; attempt_count: number | string }>)[0] ?? null;
  const decision = resolveInboundReplay(prior);
  if (decision.action === "replay") {
    return { id: decision.recordId, employeeId: null, status: "applied", replay: true, attemptCount: Number(prior?.attempt_count ?? 1) };
  }
  // What is stored is what the ERP sent, change time included; the hash stays on content alone.
  const stored = JSON.stringify(payloadHashSource(input.erpChangedAt ? { ...input.employee, erpChangedAt: input.erpChangedAt } : input.employee));
  const recordId = await claimAttempt(access, {
    recordId: decision.action === "retry" ? decision.recordId : null,
    direction: "inbound_employee",
    externalKey: input.externalCode,
    hash,
    stored,
    connectionId: input.connectionId ?? null,
  });
  try {
    const settings = await resolveErpSettings(access, input.connectionId ?? null);
    const matched = await findMatchedEmployee(access, settings, input);
    if (!matched) {
      if (settings.unmatchedAction === "reject") {
        throw new HttpError({
          status: 422,
          code: "ERP_RECORD_UNMATCHED",
          message: `No employee matches ${settings.matchKey} "${input.externalCode}" and the connection's unmatched-record action is Reject.`,
        });
      }
      if (settings.unmatchedAction === "hold") {
        const holdReason = `Held: no employee matches ${settings.matchKey} "${input.externalCode}" (unmatched-record action is Hold).`;
        await holdRecord(access, recordId, holdReason, { externalCode: input.externalCode, matchKey: settings.matchKey }, requestId);
        const record = await loadRecord(access, recordId);
        return { id: recordId, employeeId: null, status: "queued", replay: false, attemptCount: Number(record.attempt_count ?? 1), conflicts: [], holdReason };
      }
      const employeeId = await createErpEmployee(access, { recordId, externalCode: input.externalCode, employee: input.employee, hash, requestId });
      const record = await loadRecord(access, recordId);
      return { id: recordId, employeeId, status: "applied", replay: false, attemptCount: Number(record.attempt_count ?? 1), conflicts: [], holdReason: null };
    }
    let plan: ErpWritePlan;
    try {
      plan = planErpFieldWrites({
        owners: settings.fieldOwners,
        conflictPolicy: settings.conflictPolicy,
        incoming: input.employee,
        current: matched.current,
        erpChangedAt: input.erpChangedAt ?? null,
        nucleusChangedAt: matched.updatedAt,
      });
    } catch (error) {
      if (error instanceof ErpOwnershipError) {
        throw new HttpError({ status: 422, code: error.code, message: error.message, details: error.details });
      }
      throw error;
    }
    if (plan.action === "hold") {
      await holdRecord(access, recordId, plan.reason, { employeeId: matched.id, conflicts: plan.conflicts }, requestId);
      const record = await loadRecord(access, recordId);
      return { id: recordId, employeeId: matched.id, status: "queued", replay: false, attemptCount: Number(record.attempt_count ?? 1), conflicts: plan.conflicts, holdReason: plan.reason };
    }
    await applyErpFieldWrites(access, {
      recordId,
      employeeId: matched.id,
      externalCode: input.externalCode,
      writes: plan.writes,
      conflicts: plan.conflicts,
      hash,
      requestId,
    });
    const record = await loadRecord(access, recordId);
    return { id: recordId, employeeId: matched.id, status: "applied", replay: false, attemptCount: Number(record.attempt_count ?? 1), conflicts: plan.conflicts, holdReason: null };
  } catch (error) {
    await recordFailure(access, recordId, error, requestId);
    throw error;
  }
}

/**
 * Re-run one record from the queue, using the payload the ERP originally sent.
 * The retry is the same code path as the first attempt, so a record that now
 * succeeds is applied exactly as it would have been.
 */
export async function retryErpRecord(access: Access, recordId: string, requestId: string): Promise<ErpSyncResult> {
  enforce(access.context, ERP_SYNC_PERMISSION, { tenantId: access.tenantId });
  const record = await loadRecord(access, recordId);
  const status = (record.status ?? "").toLowerCase();
  if (status === "applied" || status === "posted") {
    return { id: record.id, employeeId: null, status: status as ErpRecordStatus, replay: true, attemptCount: Number(record.attempt_count ?? 0) };
  }
  if (status === "dead") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "This record was abandoned. Re-send it from the ERP rather than retrying the abandoned copy.",
    });
  }
  if (record.direction !== "inbound_employee") {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: `Only an inbound employee record can be retried here; this one is "${record.direction}".`,
    });
  }
  const parsed = erpEmployeePayloadSchema.safeParse(record.payload);
  if (!parsed.success) {
    // The stored payload no longer satisfies the contract: retrying it would fail
    // forever, so say exactly which field is wrong instead of looping.
    const detail = parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message }));
    await recordFailure(access, recordId, new Error(`Stored payload is not a valid employee record: ${detail.map((entry) => `${entry.field} ${entry.issue}`).join("; ")}`), requestId);
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The stored ERP payload is not a valid employee record and cannot be retried.", details: detail });
  }
  // The stored payload is what the ERP sent, so the retry runs under the same
  // connection and, for "Latest wins", the same change time as the first attempt.
  const storedChangedAt = typeof record.payload === "object" && record.payload !== null && "erpChangedAt" in record.payload
    ? (record.payload as { erpChangedAt?: unknown }).erpChangedAt
    : undefined;
  return syncErpEmployee(
    access,
    {
      connectionId: record.connection_id ?? undefined,
      externalCode: record.external_key,
      employee: parsed.data,
      erpChangedAt: typeof storedChangedAt === "string" ? storedChangedAt : undefined,
    },
    requestId,
  );
}

export const abandonErpRecordSchema = z.object({ reason: z.string().trim().min(10).max(500) });

/**
 * Stop retrying a record. `dead` is a decision somebody took and signed for, not
 * an attempt threshold this module invented.
 */
export async function abandonErpRecord(access: Access, recordId: string, reason: string, requestId: string): Promise<{ id: string; status: "dead" }> {
  enforce(access.context, ERP_SYNC_PERMISSION, { tenantId: access.tenantId });
  const parsed = abandonErpRecordSchema.safeParse({ reason });
  if (!parsed.success) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reason of at least 10 characters is required to abandon an ERP record." });
  }
  const record = await loadRecord(access, recordId);
  if ((record.status ?? "").toLowerCase() === "applied") {
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "This record was applied; there is nothing to abandon." });
  }
  await tenantTx(access, [
    sqlClient`update vp_erp_records set status = 'dead', error_message = ${parsed.data.reason}, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${recordId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'integration.erp_record_abandoned', 'vp_erp_record', ${recordId}, ${parsed.data.reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: recordId, status: "dead" };
}

/** The permission the ERP sync commands already run under. */
export const ERP_SYNC_PERMISSION = "integration.sync";

export type ErpQueueView = {
  items: ErpQueueRow[];
  failed: number;
  retryable: number;
  applied: number;
  /** Said out loud on the screen rather than implied by an empty column. */
  ownershipNote: string;
};

export const ERP_FIELD_OWNERSHIP_NOTE =
  "Which system owns which employee field (Q-15) is recorded per ERP connection on the ERP Integration and Field Ownership form. A sync writes only the fields that form assigns to the ERP; a Nucleus-owned field that disagrees is settled by the connection's conflict policy, and a connection with no saved map refuses to sync.";

/** RP-style queue read: what failed, why, and whether it can be retried. */
export async function listErpQueue(
  access: Access,
  filters: { direction?: string | null; status?: string | null; limit?: number } = {},
): Promise<ErpQueueView> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const limit = Math.min(200, Math.max(1, Math.trunc(filters.limit ?? 100)));
  const direction = filters.direction ?? null;
  const status = filters.status ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`select id, direction, external_key, payload_hash, payload, status, attempt_count, error_message,
        acknowledgement_ref, applied_at::text as applied_at, created_at::text as created_at, updated_at::text as updated_at
      from vp_erp_records
      where tenant_id = ${access.tenantId}
        and (${direction}::text is null or direction = ${direction})
        and (${status}::text is null or status = ${status})
      order by (status = 'failed') desc, created_at desc
      limit ${limit}`,
  ]);
  const items = (rows as ErpRecordRow[]).map(queueRow);
  return {
    items,
    failed: items.filter((item) => item.status === "failed").length,
    retryable: items.filter((item) => item.retryable).length,
    applied: items.filter((item) => item.status === "applied").length,
    ownershipNote: ERP_FIELD_OWNERSHIP_NOTE,
  };
}
