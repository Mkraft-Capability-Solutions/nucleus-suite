import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, recordAudit, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { csvRows } from "@/utils/csv";
import { isoOrNull, minorOrNull, textOrNull } from "./route-support";

/**
 * ERP master sync log and the GL posting queue for the compliance workspace.
 *
 * - Inbound employee records live in `vp_erp_records` (direction `inbound_employee`). The log groups
 *   them per connection per day with real received / applied / blocked counts.
 * - GL batches live in `vp_gl_batches` + `vp_gl_lines` (created from a finalized payroll run). Debits,
 *   credits and balance are summed from the stored lines, never assumed.
 * - Dispatch queues a balanced batch for the integration worker through `transactional_outbox`. The
 *   ERP's acknowledgement reference is recorded by a person (or the worker) when the ERP issues it; this
 *   module never fabricates one. Reconcile is allowed only for a posted, balanced batch.
 */

const ERP_CATALOG_PATTERN = /(sap|netsuite|oracle|tally|erp|dynamics|workday|zoho)/i;

export type ErpConnector = { id: string; code: string; environment: string | null; status: string | null; verifiedRoundTrip: boolean };
export type ErpSyncBatch = {
  key: string; day: string; connectionId: string | null; connector: string | null;
  received: number; applied: number; blocked: number; lastAt: string | null; status: "applied" | "partial" | "failed" | "pending";
};

type ConnectionRow = { id: string; attributes: Record<string, unknown> | null; catalog: Record<string, unknown> | null };
type SyncRow = { connection_id: string | null; day: string; received: number; applied: number; blocked: number; last_at: unknown };

export function syncBatchStatus(received: number, applied: number, blocked: number): ErpSyncBatch["status"] {
  if (received === 0) return "pending";
  if (applied === received) return "applied";
  if (blocked === received) return "failed";
  return applied > 0 ? "partial" : "pending";
}

export async function loadErpOverview(access: Access): Promise<{ connectors: ErpConnector[]; syncLog: ErpSyncBatch[] }> {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  const [connectionRows, syncRows] = await tenantTx(access, [
    sqlClient`select c.id, c.attributes, k.attributes as catalog
      from integration_connections c join integration_catalog k on k.id = c.integration_catalog_id
      where c.tenant_id = ${access.tenantId} order by c.created_at desc limit 100`,
    sqlClient`select connection_id, created_at::date::text as day, count(*)::int as received,
        count(*) filter (where status = 'applied')::int as applied,
        count(*) filter (where status in ('failed','dead'))::int as blocked,
        max(updated_at) as last_at
      from vp_erp_records where tenant_id = ${access.tenantId} and direction = 'inbound_employee'
      group by connection_id, created_at::date order by created_at::date desc limit 60`,
  ]);
  const connectors = (connectionRows as ConnectionRow[])
    .map((row) => ({
      id: row.id,
      code: textOrNull(row.catalog?.code) ?? "",
      environment: textOrNull(row.attributes?.environment),
      status: textOrNull(row.attributes?.status),
      verifiedRoundTrip: row.attributes?.verified_round_trip === true,
    }))
    .filter((connector) => ERP_CATALOG_PATTERN.test(connector.code));
  const names = new Map(connectors.map((c) => [c.id, c.code]));
  const syncLog = (syncRows as SyncRow[]).map((row) => ({
    key: `${row.day}:${row.connection_id ?? "direct"}`,
    day: row.day,
    connectionId: row.connection_id,
    connector: row.connection_id ? names.get(row.connection_id) ?? null : null,
    received: Number(row.received),
    applied: Number(row.applied),
    blocked: Number(row.blocked),
    lastAt: isoOrNull(row.last_at),
    status: syncBatchStatus(Number(row.received), Number(row.applied), Number(row.blocked)),
  }));
  return { connectors, syncLog };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

/** One ERP-pushed employee record. Only ERP-owned and shared fields are accepted (strict). */
export const inboundEmployeeSchema = z.object({
  connectionId: z.string().uuid().optional(),
  externalCode: z.string().trim().min(1).max(80),
  employee: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      workEmail: z.string().email().optional(),
      department: z.string().trim().min(1).max(80),
      location: z.string().trim().min(1).max(80),
      designation: z.string().trim().min(1).max(120),
      joiningDate: isoDate,
      basicSalaryMinor: z.number().int().nonnegative().optional(),
    })
    .strict(),
});

export async function applyInboundEmployee(access: Access, input: z.infer<typeof inboundEmployeeSchema>, requestId: string): Promise<{ id: string; employeeId: string | null; status: string; replay: boolean }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const canonical = JSON.stringify(input.employee, Object.keys(input.employee).sort());
  const hash = createHash("sha256").update(canonical).digest("hex");
  const [prior, connection, existing] = await tenantTx(access, [
    sqlClient`select id, status from vp_erp_records where tenant_id = ${access.tenantId} and direction = 'inbound_employee'
      and external_key = ${input.externalCode} and payload_hash = ${hash} limit 1`,
    input.connectionId
      ? sqlClient`select id from integration_connections where tenant_id = ${access.tenantId} and id = ${input.connectionId} limit 1`
      : sqlClient`select null::uuid as id where false`,
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and employee_code = ${input.externalCode} limit 1`,
  ]);
  const replay = (prior as Array<{ id: string; status: string }>)[0];
  if (replay) return { id: replay.id, employeeId: null, status: replay.status, replay: true };
  if (input.connectionId && (connection as unknown[]).length === 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "That ERP connection does not exist in this workspace.", details: [{ field: "connectionId", issue: "unknown" }] });
  }
  const recordId = randomUUID();
  const e = input.employee;
  let employeeId = (existing as Array<{ id: string }>)[0]?.id ?? null;
  const statements = [
    sqlClient`insert into vp_erp_records (id, tenant_id, connection_id, direction, external_key, payload_hash, payload, status, attempt_count, applied_at)
      values (${recordId}, ${access.tenantId}, ${input.connectionId ?? null}, 'inbound_employee', ${input.externalCode}, ${hash}, ${canonical}::jsonb, 'applied', 1, now())`,
  ];
  if (employeeId) {
    statements.push(sqlClient`update employees set first_name = ${e.firstName}, last_name = ${e.lastName}, work_email = coalesce(${e.workEmail ?? null}, work_email),
      department = ${e.department}, location = ${e.location}, designation = ${e.designation}, joining_date = ${e.joiningDate},
      basic_salary_minor = coalesce(${e.basicSalaryMinor ?? null}, basic_salary_minor), updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${employeeId}`);
  } else {
    const personId = randomUUID();
    employeeId = randomUUID();
    statements.push(
      sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
      sqlClient`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, work_email, department, location, designation, joining_date, basic_salary_minor)
        values (${employeeId}, ${access.tenantId}, ${personId}, ${input.externalCode}, ${e.firstName}, ${e.lastName}, ${e.workEmail ?? null}, ${e.department}, ${e.location}, ${e.designation}, ${e.joiningDate}, ${e.basicSalaryMinor ?? null})`,
    );
  }
  await tenantTx(access, statements);
  await recordAudit(access, { action: "compliance.erp_employee_applied", entityType: "employee", entityId: employeeId, reason: "ERP-owned employee fields synchronized", after: { externalCode: input.externalCode, payloadHash: hash, recordId }, requestId });
  return { id: recordId, employeeId, status: "applied", replay: false };
}

// ---------------------------------------------------------------------------
// GL posting queue
// ---------------------------------------------------------------------------

export type GlLine = { id: string; accountCode: string; costCentre: string | null; componentCode: string; debitMinor: number; creditMinor: number; narration: string };
export type GlBatch = {
  id: string; payrollRunId: string; period: string | null; currency: string; status: string; connector: string | null;
  debitMinor: number; creditMinor: number; lineDebitMinor: number; lineCreditMinor: number; varianceMinor: number; balanced: boolean;
  acknowledgementRef: string | null; postedAt: string | null; createdAt: string | null; lines: GlLine[];
};

type BatchRow = { id: string; payroll_run_id: string; connection_id: string | null; status: string; debit_minor: unknown; credit_minor: unknown; acknowledgement_ref: string | null; posted_at: unknown; created_at: unknown; period: string | null; currency: string | null; connector: string | null };
type LineRow = { id: string; batch_id: string; account_code: string; cost_centre: string | null; component_code: string; debit_minor: unknown; credit_minor: unknown; narration: string };

export function assembleBatch(row: BatchRow, lineRows: readonly LineRow[]): GlBatch {
  const lines = lineRows.map((l) => ({
    id: l.id, accountCode: l.account_code, costCentre: l.cost_centre, componentCode: l.component_code,
    debitMinor: minorOrNull(l.debit_minor) ?? 0, creditMinor: minorOrNull(l.credit_minor) ?? 0, narration: l.narration,
  }));
  const lineDebitMinor = lines.reduce((sum, l) => sum + l.debitMinor, 0);
  const lineCreditMinor = lines.reduce((sum, l) => sum + l.creditMinor, 0);
  const debitMinor = minorOrNull(row.debit_minor) ?? 0;
  const creditMinor = minorOrNull(row.credit_minor) ?? 0;
  return {
    id: row.id, payrollRunId: row.payroll_run_id, period: row.period, currency: row.currency ?? "INR", status: row.status,
    connector: textOrNull(row.connector), debitMinor, creditMinor, lineDebitMinor, lineCreditMinor,
    varianceMinor: lineDebitMinor - lineCreditMinor,
    balanced: lines.length > 0 && lineDebitMinor === lineCreditMinor && lineDebitMinor === debitMinor && lineCreditMinor === creditMinor,
    acknowledgementRef: row.acknowledgement_ref, postedAt: isoOrNull(row.posted_at), createdAt: isoOrNull(row.created_at), lines,
  };
}

async function readBatches(access: Access, batchId: string | null): Promise<GlBatch[]> {
  const [batchRows, lineRows] = await tenantTx(access, [
    sqlClient`select b.id, b.payroll_run_id, b.connection_id, b.status, b.debit_minor, b.credit_minor, b.acknowledgement_ref, b.posted_at, b.created_at,
        r.period, r.currency, k.attributes->>'code' as connector
      from vp_gl_batches b
      left join payroll_runs r on r.tenant_id = b.tenant_id and r.id = b.payroll_run_id
      left join integration_connections c on c.tenant_id = b.tenant_id and c.id = b.connection_id
      left join integration_catalog k on k.id = c.integration_catalog_id
      where b.tenant_id = ${access.tenantId} and (${batchId}::uuid is null or b.id = ${batchId}::uuid)
      order by b.created_at desc limit 50`,
    sqlClient`select id, batch_id, account_code, cost_centre, component_code, debit_minor, credit_minor, narration
      from vp_gl_lines where tenant_id = ${access.tenantId}
        and batch_id in (select id from vp_gl_batches where tenant_id = ${access.tenantId} and (${batchId}::uuid is null or id = ${batchId}::uuid) order by created_at desc limit 50)
      order by created_at, id limit 5000`,
  ]);
  const byBatch = new Map<string, LineRow[]>();
  for (const line of lineRows as LineRow[]) byBatch.set(line.batch_id, [...(byBatch.get(line.batch_id) ?? []), line]);
  return (batchRows as BatchRow[]).map((row) => assembleBatch(row, byBatch.get(row.id) ?? []));
}

export async function listGlBatches(access: Access): Promise<{ batches: GlBatch[] }> {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  return { batches: await readBatches(access, null) };
}

export const glTransitionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dispatch"), batchId: z.string().uuid() }),
  z.object({ action: z.literal("acknowledge"), batchId: z.string().uuid(), acknowledgementRef: z.string().trim().min(3, "Enter the reference the ERP issued.").max(160) }),
  z.object({ action: z.literal("reconcile"), batchId: z.string().uuid() }),
]);
export type GlTransition = z.infer<typeof glTransitionSchema>;

export const GL_TRANSITIONS: Record<GlTransition["action"], { from: readonly string[]; to: string; permission: string }> = {
  dispatch: { from: ["draft", "failed"], to: "queued", permission: "payroll.accounting.write" },
  acknowledge: { from: ["queued"], to: "posted", permission: "payroll.accounting.approve" },
  reconcile: { from: ["posted"], to: "reconciled", permission: "payroll.accounting.approve" },
};

export async function transitionGlBatch(access: Access, input: GlTransition, requestId: string): Promise<{ id: string; status: string; acknowledgementRef: string | null }> {
  const rule = GL_TRANSITIONS[input.action];
  enforce(access.context, rule.permission, { tenantId: access.tenantId });
  const batch = (await readBatches(access, input.batchId))[0];
  if (!batch) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That GL batch was not found." });
  if (!rule.from.includes(batch.status)) {
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: `This batch is ${batch.status}; ${input.action} needs it to be ${rule.from.join(" or ")}.` });
  }
  if (!batch.balanced) {
    throw new HttpError({ status: 422, code: "GL_UNBALANCED", message: "The journal lines do not balance against the batch totals, so it cannot move forward." });
  }
  const ackRef = input.action === "acknowledge" ? input.acknowledgementRef : batch.acknowledgementRef;
  if (input.action === "reconcile" && !ackRef) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Record the ERP acknowledgement before reconciling." });
  }
  const statements = [
    sqlClient`update vp_gl_batches set status = ${rule.to}, acknowledgement_ref = ${ackRef ?? null},
        posted_at = case when ${rule.to} = 'posted' then now() else posted_at end, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${batch.id} and status = ${batch.status} returning id`,
  ];
  if (input.action === "dispatch") {
    const payload = { batchId: batch.id, payrollRunId: batch.payrollRunId, period: batch.period, currency: batch.currency, debitMinor: batch.lineDebitMinor, creditMinor: batch.lineCreditMinor, lines: batch.lines };
    const payloadJson = JSON.stringify(payload);
    const hash = createHash("sha256").update(payloadJson).digest("hex");
    statements.push(
      sqlClient`insert into vp_erp_records (tenant_id, direction, external_key, payload_hash, payload, status, attempt_count)
        values (${access.tenantId}, 'outbound_gl', ${batch.id}, ${hash}, ${payloadJson}::jsonb, 'queued', 0)
        on conflict (tenant_id, direction, external_key, payload_hash) do update set status = 'queued', updated_at = now()`,
      sqlClient`insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key)
        values (${access.tenantId}, 'erp.gl_posting_dispatch_requested', 'vp_gl_batch', ${batch.id}, ${JSON.stringify({ batchId: batch.id, payloadHash: hash })}::jsonb, ${`gl-dispatch:${batch.id}:${hash}`})
        on conflict (tenant_id, idempotency_key) do nothing`,
    );
  } else if (input.action === "acknowledge") {
    statements.push(sqlClient`update vp_erp_records set status = 'posted', acknowledgement_ref = ${ackRef ?? null}, acknowledged_at = now(), updated_at = now()
      where tenant_id = ${access.tenantId} and direction = 'outbound_gl' and external_key = ${batch.id}`);
  }
  const [updated] = await tenantTx(access, statements);
  if ((updated as unknown[]).length === 0) throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "This batch changed meanwhile. Refresh and retry." });
  await recordAudit(access, { action: `compliance.gl_${input.action}`, entityType: "vp_gl_batch", entityId: batch.id, reason: `GL batch ${batch.status} → ${rule.to}`, after: { status: rule.to, acknowledgementRef: ackRef ?? null, debitMinor: batch.lineDebitMinor, creditMinor: batch.lineCreditMinor }, requestId });
  return { id: batch.id, status: rule.to, acknowledgementRef: ackRef ?? null };
}

// ---------------------------------------------------------------------------
// Export payloads (built on the server from stored lines, audited)
// ---------------------------------------------------------------------------

export const GL_EXPORT_FORMATS = ["sap_idoc", "netsuite_csv", "tally_xml"] as const;
export type GlExportFormat = (typeof GL_EXPORT_FORMATS)[number];

function xml(value: unknown): string {
  return String(value ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);
}
const amount = (minor: number) => (minor / 100).toFixed(2);

export function renderGlExport(batch: GlBatch, format: GlExportFormat): { filename: string; contentType: string; body: string } {
  const period = batch.period ?? batch.id;
  if (format === "netsuite_csv") {
    const rows: unknown[][] = [["Journal", "Period", "Account", "Cost Centre", "Component", "Debit", "Credit", "Memo"]];
    for (const l of batch.lines) rows.push([batch.id, period, l.accountCode, l.costCentre ?? "", l.componentCode, l.debitMinor ? amount(l.debitMinor) : "", l.creditMinor ? amount(l.creditMinor) : "", l.narration]);
    return { filename: `gl-${period}.csv`, contentType: "text/csv; charset=utf-8", body: csvRows(rows) };
  }
  if (format === "tally_xml") {
    const entries = batch.lines
      .map((l) => `      <ALLLEDGERENTRIES.LIST><LEDGERNAME>${xml(l.accountCode)}</LEDGERNAME><ISDEEMEDPOSITIVE>${l.debitMinor > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${l.debitMinor > 0 ? "-" : ""}${amount(l.debitMinor || l.creditMinor)}</AMOUNT></ALLLEDGERENTRIES.LIST>`)
      .join("\n");
    const body = `<ENVELOPE>\n  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>\n  <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>\n    <TALLYMESSAGE><VOUCHER VCHTYPE="Journal" ACTION="Create"><NARRATION>${xml(`Payroll ${period}`)}</NARRATION><VOUCHERNUMBER>${xml(batch.id)}</VOUCHERNUMBER>\n${entries}\n    </VOUCHER></TALLYMESSAGE>\n  </REQUESTDATA></IMPORTDATA></BODY>\n</ENVELOPE>\n`;
    return { filename: `gl-${period}-tally.xml`, contentType: "application/xml; charset=utf-8", body };
  }
  const items = batch.lines
    .map((l, i) => `    <E1FISEG><BUZEI>${String(i + 1).padStart(3, "0")}</BUZEI><HKONT>${xml(l.accountCode)}</HKONT><KOSTL>${xml(l.costCentre ?? "")}</KOSTL><SHKZG>${l.debitMinor > 0 ? "S" : "H"}</SHKZG><WRBTR>${amount(l.debitMinor || l.creditMinor)}</WRBTR><SGTXT>${xml(l.narration)}</SGTXT></E1FISEG>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<FIDCCP02>\n  <IDOC BEGIN="1">\n   <EDI_DC40 SEGMENT="1"><IDOCTYP>FIDCCP02</IDOCTYP><MESTYP>FIDCC2</MESTYP></EDI_DC40>\n   <E1FIKPF SEGMENT="1"><BKTXT>${xml(`Payroll ${period}`)}</BKTXT><XBLNR>${xml(batch.id.slice(0, 16))}</XBLNR><WAERS>${xml(batch.currency)}</WAERS>\n${items}\n   </E1FIKPF>\n  </IDOC>\n</FIDCCP02>\n`;
  return { filename: `gl-${period}-idoc.xml`, contentType: "application/xml; charset=utf-8", body };
}

export async function exportGlBatch(access: Access, batchId: string, format: GlExportFormat, requestId: string) {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  const batch = (await readBatches(access, batchId))[0];
  if (!batch) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That GL batch was not found." });
  if (batch.lines.length === 0) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This batch has no journal lines to export." });
  const rendered = renderGlExport(batch, format);
  await recordAudit(access, { action: "compliance.gl_export", entityType: "vp_gl_batch", entityId: batch.id, reason: `GL batch exported as ${format}`, after: { format, lines: batch.lines.length }, requestId });
  return rendered;
}
