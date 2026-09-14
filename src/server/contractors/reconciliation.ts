import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Gate-punch versus invoice reconciliation for contract labour.
 *
 * This module is a read-only derivation. There is no debit-note table and no
 * persisted reconciliation result: every figure below is recomputed from
 * `contractor_invoices`, `contractor_invoice_lines`, `contract_worker_assignments`
 * and `attendance_entries` on each read. The only write is the dispute flag that
 * `disputeInvoice` records on the invoice itself.
 */

export type ReconciliationVerdict = "within_tolerance" | "action_required" | "disputed" | "approved";

/**
 * Verdict for one invoice. A stored decision wins over the arithmetic: an
 * invoice a user has disputed or approved keeps that verdict even once the
 * numbers move. Otherwise a variance beyond the contract's tolerance asks for
 * action. A NaN variance (no billed or verified basis at all) cannot prove an
 * overbill, so it reads as within tolerance rather than accusing the vendor.
 * Variance is compared on magnitude, so an under-billing of the same size is
 * flagged just as an over-billing is.
 */
export function deriveVerdict(
  variancePct: number,
  tolerancePct: number,
  storedStatus?: string | null,
): ReconciliationVerdict {
  const stored = (storedStatus ?? "").trim().toLowerCase();
  if (stored === "disputed") return "disputed";
  if (stored === "approved") return "approved";
  if (!Number.isFinite(variancePct)) return "within_tolerance";
  // A missing or negative tolerance is not a licence to overbill: it reads as zero tolerance.
  const tolerance = Number.isFinite(tolerancePct) ? Math.max(0, tolerancePct) : 0;
  return Math.abs(variancePct) > tolerance ? "action_required" : "within_tolerance";
}

/**
 * Hours billed against hours the gate actually verified.
 *
 * When `verifiedHours` is 0 the percentage is mathematically infinite, which is
 * not a figure anybody can act on, so the variance percentage is reported as 0
 * and only `deltaHours` carries the difference. A negative delta means the
 * vendor billed fewer hours than the gate recorded.
 */
export function computeVariance(
  billedHours: number,
  verifiedHours: number,
): { deltaHours: number; variancePct: number } {
  const billed = Number.isFinite(billedHours) ? billedHours : 0;
  const verified = Number.isFinite(verifiedHours) ? verifiedHours : 0;
  const deltaHours = Math.round((billed - verified) * 100) / 100;
  if (verified === 0) return { deltaHours, variancePct: 0 };
  return { deltaHours, variancePct: Math.round((deltaHours / verified) * 10000) / 100 };
}

export type ReconciliationRow = {
  id: string;
  agencyName: string;
  agencyCode: string;
  site: string;
  period: string;
  billedHours: number;
  billedMinor: number;
  verifiedHours: number;
  verifiedMinor: number;
  deltaHours: number;
  variancePct: number;
  currency: string;
  workerCount: number;
  status: string;
  verdict: ReconciliationVerdict;
};

type ReconciliationQueryRow = {
  id: string;
  agency_name: string;
  agency_code: string;
  site: string;
  period: string;
  invoice_hours: number;
  line_hours: number;
  billed_minor: number;
  verified_minutes: number;
  currency: string;
  worker_count: number;
  status: string;
  tolerance_pct: number;
};

/**
 * Billed hours come from the invoice header when it carries them, otherwise
 * from the sum of its lines. Neither source is invented: an invoice priced as a
 * monthly lump sum carries no hours at all and reports 0.
 *
 * Verified hours are the gate/turnstile minutes on the attendance day rows of
 * the workers assigned to this contract, restricted to the invoice period.
 * `contract_worker_assignments` reaches attendance only through `employment_id`,
 * so a worker with no employment row contributes nothing.
 */
const RECONCILIATION_SELECT = `select inv.id,
    coalesce(org.attributes->>'name', 'Unnamed agency') as agency_name,
    coalesce(org.attributes->>'code', '') as agency_code,
    coalesce(loc.attributes->>'name', '') as site,
    coalesce(inv.attributes->>'period', '') as period,
    coalesce((inv.attributes->>'billed_hours')::float, (inv.attributes->>'hours')::float, 0) as invoice_hours,
    coalesce((select sum(coalesce((line.attributes->>'billed_hours')::float, (line.attributes->>'hours')::float, 0))
      from contractor_invoice_lines line
      where line.tenant_id = inv.tenant_id and line.contractor_invoice_id = inv.id), 0) as line_hours,
    coalesce((inv.attributes->>'gross_amount_minor')::float, (inv.attributes->>'billed_minor')::float,
      (select sum(coalesce((line.attributes->>'amount_minor')::float, 0))
        from contractor_invoice_lines line
        where line.tenant_id = inv.tenant_id and line.contractor_invoice_id = inv.id), 0) as billed_minor,
    coalesce((select sum(coalesce((ae.attributes->>'gross_minutes')::float, 0))
      from contract_worker_assignments cwa
      join employments emp on emp.tenant_id = cwa.tenant_id and emp.id = cwa.employment_id
      join attendance_entries ae on ae.tenant_id = emp.tenant_id and ae.employee_id = emp.employee_id
      where cwa.tenant_id = inv.tenant_id
        and cwa.contractor_contract_id = inv.contractor_contract_id
        and left(coalesce(ae.attributes->>'date', ''), 7) = coalesce(inv.attributes->>'period', '')), 0) as verified_minutes,
    coalesce(ten.default_currency, 'INR') as currency,
    coalesce((select count(*) from contract_worker_assignments roster
      where roster.tenant_id = inv.tenant_id
        and roster.contractor_contract_id = inv.contractor_contract_id), 0) as worker_count,
    coalesce(inv.attributes->>'reconciliation_status', inv.attributes->>'status', '') as status,
    coalesce((ct.attributes->>'variance_threshold_pct')::float, (ct.attributes->>'tolerance_pct')::float, 2) as tolerance_pct
  from contractor_invoices inv
  join contractor_contracts ct on ct.tenant_id = inv.tenant_id and ct.id = inv.contractor_contract_id
  left join contractor_organizations org on org.tenant_id = ct.tenant_id and org.id = ct.contractor_organization_id
  left join locations loc on loc.tenant_id = ct.tenant_id and loc.establishment_id = ct.establishment_id
  left join tenants ten on ten.id = inv.tenant_id`;

/** Projects one queried invoice into the reconciliation row the console renders. */
function projectReconciliation(row: ReconciliationQueryRow): ReconciliationRow {
  const billedHours = Math.round((Number(row.invoice_hours) || Number(row.line_hours) || 0) * 100) / 100;
  const verifiedHours = Math.round((Number(row.verified_minutes) / 60) * 100) / 100;
  const billedMinor = Math.round(Number(row.billed_minor) || 0);
  const { deltaHours, variancePct } = computeVariance(billedHours, verifiedHours);
  // The verified value is the billed amount re-priced at the verified hours.
  // With no hourly rate on file there is nothing to re-price, so it stays 0.
  const verifiedMinor = billedHours > 0 ? Math.round((billedMinor / billedHours) * verifiedHours) : 0;
  return {
    id: row.id,
    agencyName: row.agency_name,
    agencyCode: row.agency_code,
    site: row.site,
    period: row.period,
    billedHours,
    billedMinor,
    verifiedHours,
    verifiedMinor,
    deltaHours,
    variancePct,
    currency: row.currency,
    workerCount: Number(row.worker_count) || 0,
    status: row.status,
    verdict: deriveVerdict(variancePct, Number(row.tolerance_pct), row.status),
  };
}

/** Gate punch versus invoice queue, optionally narrowed to one YYYY-MM period. */
export async function listReconciliations(access: Access, period: string | null): Promise<ReconciliationRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const scoped = period && /^\d{4}-\d{2}$/.test(period.trim()) ? period.trim() : "";
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${RECONCILIATION_SELECT}
       where inv.tenant_id = $1 and ($2 = '' or coalesce(inv.attributes->>'period', '') = $2)
       order by coalesce(inv.attributes->>'period', '') desc, inv.created_at desc
       limit 200`,
      [access.tenantId, scoped],
    ),
  ]);
  return (rows as ReconciliationQueryRow[]).map(projectReconciliation);
}

export type WorkerLog = {
  id: string;
  workerName: string;
  workerCode: string;
  trade: string;
  billedHours: number;
  verifiedHours: number;
  deltaHours: number;
};

type WorkerLogQueryRow = {
  id: string;
  worker_name: string;
  worker_code: string;
  trade: string;
  billed_hours: number;
  verified_minutes: number;
};

/** One invoice, the per-worker breakdown behind it and its audit trail. */
export async function getReconciliationRecord(
  access: Access,
  id: string,
): Promise<{ record: ReconciliationRow; workerLogs: WorkerLog[]; auditTrail: Array<Record<string, unknown>> }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${RECONCILIATION_SELECT} where inv.tenant_id = $1 and inv.id = $2::uuid limit 1`, [
      access.tenantId,
      id,
    ]),
  ]);
  const found = (rows as ReconciliationQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const record = projectReconciliation(found);

  const [workerRows] = await tenantTx(access, [
    sqlClient.query(
      `select cwa.id,
         coalesce(cwa.attributes->>'worker_name', '') as worker_name,
         coalesce(cwa.attributes->>'gate_badge_number', cwa.attributes->>'worker_code', '') as worker_code,
         coalesce(cwa.attributes->>'trade', '') as trade,
         coalesce((select sum(coalesce((line.attributes->>'billed_hours')::float, (line.attributes->>'hours')::float, 0))
           from contractor_invoice_lines line
           where line.tenant_id = cwa.tenant_id
             and line.contract_worker_assignment_id = cwa.id
             and line.contractor_invoice_id = $2::uuid), 0) as billed_hours,
         coalesce((select sum(coalesce((ae.attributes->>'gross_minutes')::float, 0))
           from employments emp
           join attendance_entries ae on ae.tenant_id = emp.tenant_id and ae.employee_id = emp.employee_id
           where emp.tenant_id = cwa.tenant_id and emp.id = cwa.employment_id
             and left(coalesce(ae.attributes->>'date', ''), 7) = $3), 0) as verified_minutes
       from contract_worker_assignments cwa
       join contractor_invoices inv on inv.tenant_id = cwa.tenant_id
         and inv.contractor_contract_id = cwa.contractor_contract_id
       where cwa.tenant_id = $1 and inv.id = $2::uuid
       order by coalesce(cwa.attributes->>'worker_name', ''), cwa.created_at
       limit 200`,
      [access.tenantId, id, record.period],
    ),
  ]);
  const workerLogs = (workerRows as WorkerLogQueryRow[]).map((row) => {
    const billedHours = Math.round((Number(row.billed_hours) || 0) * 100) / 100;
    const verifiedHours = Math.round((Number(row.verified_minutes) / 60) * 100) / 100;
    return {
      id: row.id,
      workerName: row.worker_name,
      workerCode: row.worker_code,
      trade: row.trade,
      billedHours,
      verifiedHours,
      deltaHours: computeVariance(billedHours, verifiedHours).deltaHours,
    };
  });

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'contractor_invoice' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return { record, workerLogs, auditTrail };
}

/**
 * CTG-02 variance disposition. The console's existing dispute button is the "query" leg, so
 * that stays the default and its payload keeps working; "accept" and "reduce" settle the
 * invoice instead, and both must state the amount that will actually be paid.
 *
 * The approver is not a field: it is the acting membership, which the audit event records.
 */
export const disputeInvoiceSchema = z.object({
  varianceAction: z.enum(picklistValues("PL_VARIANCE_ACTION")).default("query"),
  reason: z.string().trim().min(3).max(500),
  approvedAmountMinor: z.number().int().nonnegative().optional(),
}).superRefine((value, context) => {
  if (value.varianceAction === "query" && value.reason.length < 20) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "A query note must explain the challenge in at least 20 characters." });
  }
  if (value.varianceAction !== "query" && value.approvedAmountMinor === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["approvedAmountMinor"], message: "Settling a variance requires the amount that will be paid." });
  }
});

const DISPUTE_ACTION = "contractor.invoice_dispute";

/** The reconciliation state each disposition leaves the invoice in. */
const VARIANCE_OUTCOME = { accept: "accepted", query: "disputed", reduce: "reduced" } as const;
export type VarianceOutcome = (typeof VARIANCE_OUTCOME)[keyof typeof VARIANCE_OUTCOME];

/**
 * Dispositions the variance on a contractor invoice. There is no debit-note table
 * in this topology, so the outcome is recorded on the invoice's own attributes
 * and evidenced by an append-only audit event.
 */
export async function disputeInvoice(
  access: Access,
  id: string,
  input: z.infer<typeof disputeInvoiceSchema>,
  requestId: string,
): Promise<{ id: string; status: VarianceOutcome; approvedAmountMinor: number | null }> {
  const reason = input.reason;
  const outcome = VARIANCE_OUTCOME[input.varianceAction];
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select coalesce(attributes->>'reconciliation_status', '') as reconciliation_status,
        coalesce(attributes->>'status', '') as status,
        coalesce(attributes->>'invoice_number', '') as invoice_number,
        coalesce((attributes->>'billed_minor')::bigint, 0) as billed_minor
      from contractor_invoices where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const invoice = (rows as Array<{ reconciliation_status: string; status: string; invoice_number: string; billed_minor: string | number }>)[0];
  if (!invoice) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (invoice.reconciliation_status.toLowerCase() === "disputed") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "This invoice is already under dispute.",
    });
  }
  // "Cannot exceed the invoice amount" - a settlement may reduce what is paid, never inflate it.
  const invoiceMinor = Number(invoice.billed_minor) || 0;
  const approvedAmountMinor = input.approvedAmountMinor ?? null;
  if (approvedAmountMinor !== null && invoiceMinor > 0 && approvedAmountMinor > invoiceMinor) {
    throw new HttpError({
      status: 422, code: "POLICY_VIOLATION",
      message: `The approved amount cannot exceed the invoice amount of ${invoiceMinor}.`,
    });
  }
  const before = { reconciliation_status: invoice.reconciliation_status, status: invoice.status };
  const after = {
    reconciliation_status: outcome,
    variance_action: input.varianceAction,
    approved_amount_minor: approvedAmountMinor,
    invoice_number: invoice.invoice_number,
  };
  await tenantTx(access, [
    sqlClient`update contractor_invoices
      set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
        reconciliation_status: outcome,
        variance_action: input.varianceAction,
        approved_amount_minor: approvedAmountMinor,
        query_note: input.varianceAction === "query" ? reason : null,
      })}::jsonb
          || jsonb_build_object('dispositioned_on', to_char(current_date, 'YYYY-MM-DD')),
        updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${DISPUTE_ACTION}, 'contractor_invoice', ${id}, ${reason},
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: outcome, approvedAmountMinor };
}

export type AgencyRow = {
  id: string;
  name: string;
  code: string;
  pan: string;
  contactPerson: string;
  contactPhone: string;
  contractCount: number;
  workerCount: number;
  evidenceState: string;
  evidencePeriod: string;
};

/** Staffing vendor master: every agency with its contract and evidence state. */
export async function listAgencies(access: Access): Promise<AgencyRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select org.id,
         coalesce(org.attributes->>'name', 'Unnamed agency') as name,
         coalesce(org.attributes->>'code', '') as code,
         coalesce(org.attributes->>'pan', '') as pan,
         coalesce(org.attributes->>'contact_person', '') as contact_person,
         coalesce(org.attributes->>'contact_phone', '') as contact_phone,
         (select count(*) from contractor_contracts ct
           where ct.tenant_id = org.tenant_id and ct.contractor_organization_id = org.id) as contract_count,
         (select count(*) from contract_worker_assignments cwa
           join contractor_contracts ct on ct.tenant_id = cwa.tenant_id and ct.id = cwa.contractor_contract_id
           where cwa.tenant_id = org.tenant_id and ct.contractor_organization_id = org.id) as worker_count,
         coalesce((select ev.attributes->>'verification_status' from contractor_statutory_evidence ev
           where ev.tenant_id = org.tenant_id and ev.contractor_organization_id = org.id
           order by coalesce(ev.attributes->>'period', '') desc limit 1), '') as evidence_state,
         coalesce((select ev.attributes->>'period' from contractor_statutory_evidence ev
           where ev.tenant_id = org.tenant_id and ev.contractor_organization_id = org.id
           order by coalesce(ev.attributes->>'period', '') desc limit 1), '') as evidence_period
       from contractor_organizations org
       where org.tenant_id = $1
       order by coalesce(org.attributes->>'name', '')
       limit 200`,
      [access.tenantId],
    ),
  ]);
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    pan: String(row.pan),
    contactPerson: String(row.contact_person),
    contactPhone: String(row.contact_phone),
    contractCount: Number(row.contract_count) || 0,
    workerCount: Number(row.worker_count) || 0,
    evidenceState: String(row.evidence_state),
    evidencePeriod: String(row.evidence_period),
  }));
}

export type ContractWorkerRow = {
  id: string;
  workerName: string;
  workerCode: string;
  trade: string;
  category: string;
  agencyName: string;
  contractNumber: string;
  site: string;
  verified: boolean;
};

/** Contract worker registry: every assigned worker with agency, site and category. */
export async function listContractWorkers(access: Access): Promise<ContractWorkerRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select cwa.id,
         coalesce(cwa.attributes->>'worker_name', '') as worker_name,
         coalesce(cwa.attributes->>'gate_badge_number', cwa.attributes->>'worker_code', '') as worker_code,
         coalesce(cwa.attributes->>'trade', '') as trade,
         coalesce(wc.attributes->>'name', cwa.attributes->>'category', '') as category,
         coalesce(org.attributes->>'name', '') as agency_name,
         coalesce(ct.attributes->>'contract_number', ct.attributes->>'code', '') as contract_number,
         coalesce(loc.attributes->>'name', '') as site,
         coalesce(cwa.attributes->>'verified', 'false') as verified
       from contract_worker_assignments cwa
       join contractor_contracts ct on ct.tenant_id = cwa.tenant_id and ct.id = cwa.contractor_contract_id
       left join contractor_organizations org on org.tenant_id = ct.tenant_id and org.id = ct.contractor_organization_id
       left join locations loc on loc.tenant_id = ct.tenant_id and loc.establishment_id = ct.establishment_id
       left join employments emp on emp.tenant_id = cwa.tenant_id and emp.id = cwa.employment_id
       left join worker_categories wc on wc.tenant_id = emp.tenant_id and wc.id = emp.worker_category_id
       where cwa.tenant_id = $1
       order by coalesce(cwa.attributes->>'worker_name', ''), cwa.created_at
       limit 200`,
      [access.tenantId],
    ),
  ]);
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    workerName: String(row.worker_name),
    workerCode: String(row.worker_code),
    trade: String(row.trade),
    category: String(row.category),
    agencyName: String(row.agency_name),
    contractNumber: String(row.contract_number),
    site: String(row.site),
    verified: String(row.verified) === "true",
  }));
}
