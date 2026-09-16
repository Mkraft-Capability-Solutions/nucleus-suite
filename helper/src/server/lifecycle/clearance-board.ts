import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * SCR-061 Clearance board.
 *
 * The board is driven from `clearance_items` rather than `offboarding_cases`
 * because the case rows are duplicated in the estate (14 rows, 2 distinct
 * employments). Clearing stays in `src/server/lifecycle/service.ts`; only the
 * waiver transition is added here.
 */

export type ClearanceState = "open" | "cleared" | "waived" | "held";

/** Pure status mapping shared by the clearance contract (unit-tested). */
export function deriveClearanceState(rawStatus: string | null | undefined): ClearanceState {
  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "cleared") return "cleared";
  if (normalized === "waived") return "waived";
  if (normalized === "held") return "held";
  return "open";
}

/** Pure settlement gate: blocking items that are neither cleared nor waived. */
export function deriveSettlementReadiness(
  items: Array<{ blocking: boolean; status: ClearanceState }>,
): { blockingOpen: number; settleable: boolean } {
  const blockingOpen = items.filter(
    (item) => item.blocking === true && (item.status === "open" || item.status === "held"),
  ).length;
  return { blockingOpen, settleable: blockingOpen === 0 };
}

/**
 * RL-25 / W-07: an item still stands between the leaver and release when it is
 * neither cleared nor waived, or when it is waived with no reason recorded.
 *
 * This is the single definition every gate and every count uses. It is a SQL
 * string rather than a query fragment because the three call sites are
 * hand-written statements, and the alias is the only thing that varies.
 * `deriveClearanceState` above is the same rule in TypeScript - both compare in
 * lower case, because the board and the exit workflow have each written the
 * status in their own casing.
 */
export function clearanceBlockingSql(alias: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`Unsafe SQL alias "${alias}".`);
  return `(lower(coalesce(${alias}.attributes->>'status', 'pending')) not in ('cleared', 'waived')
    or (lower(coalesce(${alias}.attributes->>'status', '')) = 'waived'
        and coalesce(trim(${alias}.attributes->>'waive_reason'), '') = ''))`;
}

/**
 * The TypeScript twin of `clearanceBlockingSql`, kept beside it so the two can be
 * asserted equivalent in a unit test and so callers holding rows rather than a
 * query can ask the same question.
 */
export function isClearanceBlocking(item: { status: string | null | undefined; waiveReason: string | null | undefined }): boolean {
  const state = deriveClearanceState(item.status);
  if (state === "cleared") return false;
  if (state === "waived") return (item.waiveReason ?? "").trim().length === 0;
  return true;
}

export type ClearanceBoardRow = {
  id: string;
  case_id: string;
  leaver_code: string | null;
  leaver_name: string | null;
  owner_code: string | null;
  owner_name: string | null;
  item_name: string;
  blocking: boolean;
  cleared_on: string | null;
  recovery_amount_minor: number | string | null;
  recovery_description: string | null;
  waive_reason: string | null;
  status: ClearanceState;
  last_working_day: string | null;
  resigned_on: string | null;
  ff_state: string | null;
};

type ClearanceQueryRow = Omit<ClearanceBoardRow, "status"> & { raw_status: string | null };

const CLEARANCE_BOARD_SELECT = `select item.id, item.offboarding_case_id as case_id,
    leaver.employee_code as leaver_code,
    case when leaver.id is null then null
         else trim(coalesce(leaver.first_name, '') || ' ' || coalesce(leaver.last_name, '')) end as leaver_name,
    item.attributes->>'owner' as owner_code,
    case when holder.id is null then null
         else trim(coalesce(holder.first_name, '') || ' ' || coalesce(holder.last_name, '')) end as owner_name,
    coalesce(item.attributes->>'item_name', 'Clearance item') as item_name,
    ((item.attributes->>'blocking')::boolean is true) as blocking,
    item.attributes->>'cleared_on' as cleared_on,
    (item.attributes->>'recovery_amount_minor')::bigint as recovery_amount_minor,
    item.attributes->>'recovery_description' as recovery_description,
    item.attributes->>'waive_reason' as waive_reason,
    item.attributes->>'status' as raw_status,
    ocase.attributes->>'last_working_day' as last_working_day,
    ocase.attributes->>'resigned_on' as resigned_on,
    ocase.attributes->>'ff_state' as ff_state
  from clearance_items item
  left join offboarding_cases ocase on ocase.tenant_id = item.tenant_id and ocase.id = item.offboarding_case_id
  left join employments employment on employment.tenant_id = item.tenant_id and employment.id = ocase.employment_id
  left join employees leaver on leaver.tenant_id = item.tenant_id and leaver.id = employment.employee_id
  left join employees holder on holder.tenant_id = item.tenant_id and holder.employee_code = item.attributes->>'owner'`;

function toClearanceRow(raw: ClearanceQueryRow): ClearanceBoardRow {
  return {
    id: raw.id,
    case_id: raw.case_id,
    leaver_code: raw.leaver_code ?? null,
    leaver_name: raw.leaver_name ?? null,
    owner_code: raw.owner_code ?? null,
    owner_name: raw.owner_name ?? null,
    item_name: raw.item_name,
    blocking: raw.blocking === true,
    cleared_on: raw.cleared_on ?? null,
    recovery_amount_minor: raw.recovery_amount_minor ?? null,
    recovery_description: raw.recovery_description ?? null,
    waive_reason: raw.waive_reason ?? null,
    status: deriveClearanceState(raw.raw_status),
    last_working_day: raw.last_working_day ?? null,
    resigned_on: raw.resigned_on ?? null,
    ff_state: raw.ff_state ?? null,
  };
}

/** Clearance queue across every leaver, ordered by leaver then item. */
export async function listClearanceBoard(access: Access, search: string): Promise<ClearanceBoardRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${CLEARANCE_BOARD_SELECT}
       where item.tenant_id = $1
         and (coalesce(leaver.employee_code, '') || ' ' || coalesce(leaver.first_name, '') || ' '
              || coalesce(leaver.last_name, '') || ' ' || coalesce(item.attributes->>'item_name', '') || ' '
              || coalesce(item.attributes->>'owner', '')) ilike $2
       order by leaver.employee_code asc nulls last, coalesce(item.attributes->>'item_name', '') asc
       limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return (rows as ClearanceQueryRow[]).map(toClearanceRow);
}

/** Single clearance item plus every sibling item on the same case. */
export async function getClearanceRecord(
  access: Access,
  id: string,
): Promise<{ record: ClearanceBoardRow; caseItems: ClearanceBoardRow[]; auditTrail: Array<Record<string, unknown>> }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${CLEARANCE_BOARD_SELECT}
       where item.tenant_id = $1 and item.id = $2::uuid
       limit 1`,
      [access.tenantId, id],
    ),
  ]);
  const raw = (rows as ClearanceQueryRow[])[0];
  if (!raw) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const record = toClearanceRow(raw);
  const [siblingRows] = await tenantTx(access, [
    sqlClient.query(
      `${CLEARANCE_BOARD_SELECT}
       where item.tenant_id = $1 and item.offboarding_case_id = $2::uuid
       order by coalesce(item.attributes->>'item_name', '') asc
       limit 100`,
      [access.tenantId, record.case_id],
    ),
  ]);
  // The audit trail is auxiliary: a projection failure must never fail the record.
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'clearance_item' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record, caseItems: (siblingRows as ClearanceQueryRow[]).map(toClearanceRow), auditTrail };
}

/**
 * Waiving a no-dues item lets settlement proceed without the clearance, so the workbook
 * holds its reason to twenty characters - long enough to say what was forgiven and why.
 */
export const WAIVER_REASON_MIN_LENGTH = 20;

export const waiveClearanceSchema = z.object({
  reason: z.string().trim().min(WAIVER_REASON_MIN_LENGTH).max(500),
});

/** Waive a no-dues item so settlement can proceed without a clearance. */
export async function waiveClearanceItem(access: Access, id: string, reason: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const parsed = waiveClearanceSchema.safeParse({ reason });
  if (!parsed.success) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: `A reason (min ${WAIVER_REASON_MIN_LENGTH} characters) is required to waive a clearance item.` });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`select id, offboarding_case_id, attributes from clearance_items
      where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const item = (rows as Array<{ id: string; offboarding_case_id: string; attributes: Record<string, unknown> | null }>)[0];
  if (!item) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const from = deriveClearanceState(typeof item.attributes?.status === "string" ? (item.attributes.status as string) : null);
  if (from === "cleared" || from === "waived") {
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "This clearance item has already been settled." });
  }
  const before = JSON.stringify({ status: from });
  const after = JSON.stringify({ status: "waived" });
  await tenantTx(access, [
    sqlClient`update clearance_items
      set attributes = attributes || jsonb_build_object('status', 'waived', 'waived_on', to_char(current_date, 'YYYY-MM-DD'), 'waive_reason', ${parsed.data.reason}::text),
          updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.clearance_waive', 'clearance_item', ${id}, ${parsed.data.reason},
        ${before}::jsonb, ${after}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from, to: "waived" as const };
}
