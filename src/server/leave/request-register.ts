import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export type LeaveRequestState =
  | "draft"
  | "validated"
  | "pending_approval"
  | "approved"
  | "availed"
  | "closed";

/**
 * Pure mapping from the stored approval status onto the SCR-030 state model
 * (unit-tested). An early return short-closes the request regardless of where
 * the approval chain had reached, and an approved request whose last day has
 * passed reads as availed.
 */
export function deriveLeaveRequestState(
  status: string | null | undefined,
  endsOn: string | null | undefined,
  actualReturnDate: string | null | undefined,
  today = new Date().toISOString().slice(0, 10),
): LeaveRequestState {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "draft") return "draft";
  if (["rejected", "cancelled", "canceled", "withdrawn"].includes(normalized)) return "closed";
  if (actualReturnDate) return "closed";
  if (normalized.startsWith("pending")) return "pending_approval";
  if (normalized === "approved") {
    const end = (endsOn ?? "").slice(0, 10);
    return end !== "" && end < today ? "availed" : "approved";
  }
  // Anything recorded but not yet in the approval chain reads as validated.
  return "validated";
}

/** Human label for the stored approval step, which the state model collapses. */
export function approvalStepLabel(status: string | null | undefined): string {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "pending_supervisor") return "Pending supervisor";
  if (normalized === "pending_hod") return "Pending HOD";
  if (normalized === "pending_hr") return "Pending HR";
  if (normalized === "") return "Not recorded";
  return normalized.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

export type LeaveRequestRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  department: string | null;
  leave_type: string;
  leave_type_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  requested_days: number;
  actual_return_date: string | null;
  reason: string | null;
  is_half_day_start: boolean;
  is_half_day_end: boolean;
  half_day_session: string | null;
  document_ref: string | null;
  contact: string | null;
  leave_address: string | null;
  handover_person_id: string | null;
  handover_person_name: string | null;
  raw_status: string;
  status: LeaveRequestState;
};

type LeaveRequestQueryRow = Omit<LeaveRequestRow, "status">;

const REQUEST_SELECT = `select r.id, r.employee_id,
    emp.employee_code,
    case when emp.id is null then null
         else trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')) end as employee_name,
    emp.department,
    coalesce(r.leave_type, '') as leave_type,
    lt.attributes->>'name' as leave_type_name,
    r.starts_on::text as starts_on, r.ends_on::text as ends_on,
    coalesce(r.requested_days, 0)::float as requested_days,
    r.actual_return_date::text as actual_return_date,
    r.reason,
    coalesce((r.attributes->>'is_half_day_start')::bool, false) as is_half_day_start,
    coalesce((r.attributes->>'is_half_day_end')::bool, false) as is_half_day_end,
    r.attributes->>'half_day_session' as half_day_session,
    r.attributes->>'document_ref' as document_ref,
    r.attributes->>'contact' as contact,
    r.attributes->>'leave_address' as leave_address,
    r.attributes->>'handover_person_id' as handover_person_id,
    case when hand.id is null then null
         else nullif(trim(coalesce(hand.first_name, '') || ' ' || coalesce(hand.last_name, '')), '') end as handover_person_name,
    coalesce(r.status, '') as raw_status
  from leave_requests r
  left join employees emp on emp.tenant_id = r.tenant_id and emp.id = r.employee_id
  left join employees hand on hand.tenant_id = r.tenant_id
    and hand.id::text = r.attributes->>'handover_person_id'
  left join leave_types lt on lt.tenant_id = r.tenant_id and lt.id = r.leave_type_id`;

/** Leave request queue with the applicant resolved to a named employee. */
export async function listLeaveRequestQueue(
  access: Access,
  args: { search: string; status: string | null },
): Promise<LeaveRequestRow[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const like = `%${args.search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const status = args.status && args.status.trim() !== "" ? args.status.trim().slice(0, 40) : null;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${REQUEST_SELECT}
       where r.tenant_id = $1
         and ($3::text is null or r.status = $3)
         and ($2 = '%%' or (coalesce(emp.employee_code, '') || ' ' || coalesce(emp.first_name, '') || ' '
              || coalesce(emp.last_name, '') || ' ' || coalesce(r.leave_type, '')) ilike $2)
       order by r.created_at desc, r.id desc limit 100`,
      [access.tenantId, like, status],
    ),
  ]);
  return (rows as LeaveRequestQueryRow[]).map((row) => ({
    ...row,
    status: deriveLeaveRequestState(row.raw_status, row.ends_on, row.actual_return_date),
  }));
}

/** One request with the ledger movements it caused and its audit trail. */
export async function getLeaveRequestRecord(access: Access, id: string) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${REQUEST_SELECT} where r.tenant_id = $1 and r.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const found = (rows as LeaveRequestQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const record: LeaveRequestRow = {
    ...found,
    status: deriveLeaveRequestState(found.raw_status, found.ends_on, found.actual_return_date),
  };

  // The ledger movements this request produced, so the detail explains the debit.
  let ledger: Array<Record<string, unknown>> = [];
  try {
    const [ledgerRows] = await tenantTx(access, [
      sqlClient`
        select l.id,
          coalesce(l.attributes->>'ledger_id', '') as ledger_reference,
          coalesce(l.attributes->>'transaction_type', initcap(coalesce(l.attributes->>'kind', ''))) as transaction_type,
          coalesce((l.attributes->>'days')::float, 0) as days,
          l.attributes->>'effective_date' as effective_date,
          l.attributes->>'narration' as narration
        from leave_ledger_entries l
        where l.tenant_id = ${access.tenantId} and l.leave_request_id = ${id}
        order by l.created_at asc limit 20
      `,
    ]);
    ledger = ledgerRows as Array<Record<string, unknown>>;
  } catch {
    ledger = [];
  }

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'leave_request' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return { record, ledger, auditTrail };
}
