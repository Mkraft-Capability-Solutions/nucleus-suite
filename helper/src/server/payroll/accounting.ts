import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { listComponents, type ComponentKind } from "./components";
import {
  listGlMappings,
  mappingIssue,
  unmappedComponents,
  type ResolvedMapping,
  type UnmappedComponent,
} from "./gl";

/**
 * Payroll accounting (module `accounting`).
 *
 * This module deliberately owns none of the journal. SCR-102
 * (`gl-mapping-page.tsx` + `src/server/payroll/gl.ts`) already builds, balances,
 * dimensions and posts the per-run journal. What was missing is everything
 * *around* it:
 *
 *  1. The mapping lifecycle — the `ledger` operational resource through its own
 *     draft -> submitted -> approved (+ return/reject/cancel) and retire states,
 *     including the effective-date overlap guard in
 *     `src/server/workflows/operational-service.ts`.
 *  2. Coverage — which pay components carry an approved, effective mapping for a
 *     chosen legal entity on a chosen date, and which do not. An uncovered
 *     component blocks the run (RL-521). That rule is NOT reimplemented here:
 *     `unmappedComponents` from `./gl` is called for the blocking list, and the
 *     same `mappingIssue` predicate it is built on is reused to classify the
 *     components that are not blocking.
 *  3. The ERP handoff, and the fact that there are TWO separate posting paths:
 *       - `payroll_exports` / `payroll_export_lines`, written by `gl.ts`
 *         (`postJournal`). This is the dimensioned, balanced journal.
 *       - `vp_gl_batches` / `vp_gl_lines`, written by the `create_gl_posting`
 *         and `ack_gl_posting` commands in `src/server/vp/service.ts`.
 *     They are built from different arithmetic, keyed differently (one export
 *     per run per legal entity vs one batch per run) and nothing reconciles
 *     them. `projectPostingPaths` reports them side by side and never merges
 *     them or derives a combined total.
 *
 * Writes are not implemented here either. Mapping records are created and moved
 * through `/api/v1/operations/ledger`; the ERP batch commands run through
 * `POST /api/v1/vp/readiness`. Both already carry their own permissions,
 * idempotency, audit trail and guards.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// The `ledger` mapping workflow, read from the catalog rather than restated
// ---------------------------------------------------------------------------

/** The `ledger` resource definition as `src/lib/operational-catalog.ts` declares it. */
export const ledgerResource = operationalResources.ledger;

/** draft | submitted | approved | returned | rejected | cancelled | retired. */
export const LEDGER_ACTIONS = ["submit", "approve", "return", "reject", "cancel", "retire"] as const;
export type LedgerAction = (typeof LEDGER_ACTIONS)[number];

const ACTION_LABELS: Record<LedgerAction, string> = {
  submit: "submitted",
  approve: "approved",
  return: "returned",
  reject: "rejected",
  cancel: "cancelled",
  retire: "retired",
};

/** Every state the `ledger` workflow can hold, derived from its own transitions. */
export const LEDGER_STATES: string[] = [
  ...new Set([
    ledgerResource.initial,
    ...Object.values(ledgerResource.transitions).flatMap((transition) => [...transition.from, transition.to]),
  ]),
].sort();

export const MAKER_CHECKER_REASON =
  "You created this mapping. Approval, return, rejection and retirement need a different person.";

export type ActionAvailability = { allowed: boolean; reason: string };

/**
 * Whether one workflow action is legal on a mapping right now, and — when it is
 * not — the reason a user can read, so the button can be disabled with its cause
 * visible instead of silently missing.
 *
 * Two independent gates, both enforced server-side by
 * `mutateOperationalRecord`: the `from` states of the transition, and (for the
 * transitions marked `approval`) the maker/checker split, which refuses an
 * approval by the membership that created the record.
 */
export function ledgerActionAvailability(
  action: string,
  context: { status: string; createdByMembershipId: string | null; viewerMembershipId: string | null },
): ActionAvailability {
  const transition = Object.hasOwn(ledgerResource.transitions, action) ? ledgerResource.transitions[action] : undefined;
  if (!transition) {
    return { allowed: false, reason: `${action} is not an action on the GL mapping workflow.` };
  }
  if (!transition.from.includes(context.status)) {
    const label = ACTION_LABELS[action as LedgerAction] ?? action;
    return {
      allowed: false,
      reason: `A ${context.status} mapping cannot be ${label}. This action applies only to ${transition.from.join(", ")}.`,
    };
  }
  if (
    transition.approval === true &&
    context.createdByMembershipId !== null &&
    context.viewerMembershipId !== null &&
    context.createdByMembershipId === context.viewerMembershipId
  ) {
    return { allowed: false, reason: MAKER_CHECKER_REASON };
  }
  return { allowed: true, reason: "" };
}

/** Whether the mapping's own fields can still be edited in this state. */
export function ledgerEditable(status: string): boolean {
  return ledgerResource.editable.includes(status);
}

export type LedgerWorkflowView = {
  states: string[];
  editable: string[];
  actions: LedgerAction[];
  /**
   * status -> action -> availability, evaluated for a checker who did not create
   * the record. The screen renders this verbatim and applies only the
   * maker/checker comparison itself, so the state machine has exactly one
   * implementation and the disabled reasons cannot drift from it.
   */
  matrix: Record<string, Record<string, ActionAvailability>>;
  makerCheckerReason: string;
  approvalActions: LedgerAction[];
};

export function ledgerWorkflowView(): LedgerWorkflowView {
  const matrix: Record<string, Record<string, ActionAvailability>> = {};
  for (const status of LEDGER_STATES) {
    matrix[status] = Object.fromEntries(
      LEDGER_ACTIONS.map((action) => [
        action,
        ledgerActionAvailability(action, { status, createdByMembershipId: "author", viewerMembershipId: "checker" }),
      ]),
    );
  }
  return {
    states: LEDGER_STATES,
    editable: [...ledgerResource.editable],
    actions: [...LEDGER_ACTIONS],
    matrix,
    makerCheckerReason: MAKER_CHECKER_REASON,
    approvalActions: LEDGER_ACTIONS.filter((action) => ledgerResource.transitions[action]?.approval === true),
  };
}

// ---------------------------------------------------------------------------
// Effective-date overlap guard — preview only
// ---------------------------------------------------------------------------

export type LedgerRegisterRecord = {
  id: string;
  status: string;
  componentCode: string;
  startDate: string | null;
  endDate: string | null;
};

/**
 * Mirrors the guard in `src/server/workflows/operational-service.ts`:
 *
 *   ($3 <> 'ledger' or c.status <> 'approved' or not exists(
 *      select 1 ... t.resource='ledger' and t.id<>c.id and t.status='approved'
 *        and t.data->>'componentCode' = c.data->>'componentCode'
 *        and t.data->>'startDate' <= c.data->>'endDate'
 *        and t.data->>'endDate'   >= c.data->>'startDate'))
 *
 * A null date makes the SQL comparison null, so the guard does not fire; this
 * preview reproduces that rather than guessing an open-ended window. The server
 * remains the authority — it refuses with a single combined
 * `WORKFLOW_CONFLICT`, which is why the screen needs this preview to be able to
 * name the overlap specifically.
 */
export function approvedOverlaps(
  candidate: LedgerRegisterRecord,
  records: LedgerRegisterRecord[],
): LedgerRegisterRecord[] {
  if (candidate.startDate === null || candidate.endDate === null) return [];
  return records.filter((other) => {
    if (other.id === candidate.id) return false;
    if (other.status !== "approved") return false;
    if (other.componentCode !== candidate.componentCode) return false;
    if (other.startDate === null || other.endDate === null) return false;
    return other.startDate <= (candidate.endDate as string) && other.endDate >= (candidate.startDate as string);
  });
}

/**
 * The overlap the guard would find for every mapping in the register, keyed by
 * record id. A record with no conflict is omitted rather than carrying an empty
 * array, so the screen shows a warning only where there is something to warn
 * about.
 */
export function buildOverlapPreview(records: LedgerRegisterRecord[]): Record<string, LedgerRegisterRecord[]> {
  const preview: Record<string, LedgerRegisterRecord[]> = {};
  for (const candidate of records) {
    const conflicts = approvedOverlaps(candidate, records);
    if (conflicts.length > 0) preview[candidate.id] = conflicts;
  }
  return preview;
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export const COVERAGE_STATES = [
  "mapped",
  "unmapped",
  "in_workflow",
  "not_yet_effective",
  "expired",
  "retired",
  "refused",
  "misconfigured",
  "not_applicable",
] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

export type CoverageComponent = {
  code: string;
  name: string;
  kind: ComponentKind;
  active: boolean;
};

export type CoverageRow = {
  componentCode: string;
  componentName: string;
  kind: ComponentKind;
  state: CoverageState;
  /** True when RL-521 would stop the payroll run over this component. */
  blocksRun: boolean;
  /** Verbatim from `mappingIssue` in `./gl`; null only when the component posts. */
  reason: string | null;
  accountCode: string | null;
  postingSide: string | null;
  startDate: string | null;
  endDate: string | null;
  mappingStatus: string | null;
  workflowRecordId: string | null;
};

/**
 * Classify one component's coverage on `asOf`.
 *
 * The pass/fail decision is `mappingIssue` from `./gl` — the same predicate
 * `findUnmappedComponents` (RL-521) uses — so this can never disagree with the
 * check that blocks the run. Everything this function adds is the *shape* of the
 * failure, which RL-521 does not need but a mapping register does.
 */
export function classifyCoverage(
  component: CoverageComponent,
  mapping: ResolvedMapping | undefined,
  asOf: string,
): CoverageRow {
  const base = {
    componentCode: component.code,
    componentName: component.name,
    kind: component.kind,
    accountCode: mapping?.postingSide === "credit"
      ? mapping?.creditAccount?.code ?? null
      : mapping?.debitAccount?.code ?? null,
    postingSide: mapping?.postingSide ?? null,
    startDate: mapping?.startDate ?? null,
    endDate: mapping?.endDate ?? null,
    mappingStatus: mapping?.status ?? null,
    workflowRecordId: mapping?.workflowRecordId ?? null,
  };

  // `naturalSide` in ./gl returns null for information_only: such a component
  // never reaches the ledger, so it is neither mapped nor a gap.
  if (component.kind === "information_only") {
    return { ...base, state: "not_applicable", blocksRun: false, reason: "Information-only components never post to the ledger." };
  }

  const reason = mappingIssue(mapping, component.kind, asOf);
  if (reason === null) {
    return { ...base, state: "mapped", blocksRun: false, reason: null };
  }

  // Only a component that is actually live can stop a run.
  const blocksRun = component.active;
  let state: CoverageState;
  if (!mapping) state = "unmapped";
  else if (mapping.status === "retired") state = "retired";
  else if (mapping.status === "rejected" || mapping.status === "cancelled") state = "refused";
  else if (mapping.status !== "approved") state = "in_workflow";
  else if (mapping.startDate !== null && mapping.startDate > asOf) state = "not_yet_effective";
  else if (mapping.endDate !== null && mapping.endDate < asOf) state = "expired";
  else state = "misconfigured";

  return { ...base, state, blocksRun, reason };
}

export type CoverageSummary = Record<CoverageState, number> & { total: number; blocking: number };

export function summarizeCoverage(rows: CoverageRow[]): CoverageSummary {
  const summary = Object.fromEntries(COVERAGE_STATES.map((state) => [state, 0])) as Record<CoverageState, number>;
  let blocking = 0;
  for (const row of rows) {
    summary[row.state] += 1;
    if (row.blocksRun) blocking += 1;
  }
  return { ...summary, total: rows.length, blocking };
}

// ---------------------------------------------------------------------------
// The two posting paths
// ---------------------------------------------------------------------------

export type ErpBatch = {
  id: string;
  payrollRunId: string;
  period: string | null;
  runScope: string | null;
  /** draft | queued | posted | failed | reconciled, per the table's own check. */
  status: string;
  debitMinor: number;
  creditMinor: number;
  acknowledgementRef: string | null;
  postedAt: string | null;
  connectionId: string | null;
  lineCount: number;
};

export type LedgerExport = {
  id: string;
  payrollRunId: string;
  period: string | null;
  legalEntityId: string | null;
  /** draft | validated | posted | failed | superseded, per `JOURNAL_STATES` in ./gl. */
  state: string;
  totalDebitMinor: number | null;
  totalCreditMinor: number | null;
  lineCount: number | null;
  postedAt: string | null;
  balanced: boolean | null;
  /** RP-15: why a posting stopped, and when. Null on every state but `failed`. */
  failedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
};

export type PostingPathProjection = {
  /**
   * Explicit: these two projections are never added together. They are produced
   * by different code from different arithmetic and nothing in the repository
   * reconciles one against the other.
   */
  reconciled: false;
  erp: {
    table: "vp_gl_batches";
    writtenBy: "commands/create_gl_posting, commands/ack_gl_posting (src/server/vp/service.ts)";
    items: ErpBatch[];
    queued: number;
    acknowledged: number;
  };
  ledgerJournal: {
    table: "payroll_exports";
    writtenBy: "postJournal (src/server/payroll/gl.ts), surfaced on SCR-102";
    items: LedgerExport[];
    posted: number;
    superseded: number;
    /** RP-15: postings that stopped. A run with only these has NOT been posted. */
    failed: number;
  };
  /**
   * Presence only — which runs appear on which path. This compares whether a row
   * exists, never whether the amounts agree.
   */
  presence: {
    runsOnBothPaths: string[];
    runsOnlyInErpBatches: string[];
    runsOnlyInLedgerJournal: string[];
  };
};

export function projectPostingPaths(input: { erpBatches: ErpBatch[]; ledgerExports: LedgerExport[] }): PostingPathProjection {
  const erpRuns = new Set(input.erpBatches.map((batch) => batch.payrollRunId));
  // A failed attempt is not presence on the ledger path: nothing reached the
  // ledger, so a run carrying only failures still counts as un-posted.
  const ledgerRuns = new Set(
    input.ledgerExports.filter((row) => row.state !== "superseded" && row.state !== "failed").map((row) => row.payrollRunId),
  );
  const sorted = (values: Iterable<string>): string[] => [...values].sort();
  return {
    reconciled: false,
    erp: {
      table: "vp_gl_batches",
      writtenBy: "commands/create_gl_posting, commands/ack_gl_posting (src/server/vp/service.ts)",
      items: input.erpBatches,
      queued: input.erpBatches.filter((batch) => batch.status === "queued").length,
      acknowledged: input.erpBatches.filter((batch) => batch.status === "reconciled").length,
    },
    ledgerJournal: {
      table: "payroll_exports",
      writtenBy: "postJournal (src/server/payroll/gl.ts), surfaced on SCR-102",
      items: input.ledgerExports,
      posted: input.ledgerExports.filter((row) => row.state === "posted").length,
      superseded: input.ledgerExports.filter((row) => row.state === "superseded").length,
      failed: input.ledgerExports.filter((row) => row.state === "failed").length,
    },
    presence: {
      runsOnBothPaths: sorted([...erpRuns].filter((runId) => ledgerRuns.has(runId))),
      runsOnlyInErpBatches: sorted([...erpRuns].filter((runId) => !ledgerRuns.has(runId))),
      runsOnlyInLedgerJournal: sorted([...ledgerRuns].filter((runId) => !erpRuns.has(runId))),
    },
  };
}

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

export const payrollAccountingQuerySchema = z
  .object({
    legalEntityId: z.string().uuid().nullable().default(null),
    asOf: z.string().regex(DATE_PATTERN, "A date of the form YYYY-MM-DD is required.").nullable().default(null),
    batchId: z.string().uuid().nullable().default(null),
  })
  .strict();

export type PayrollAccountingQuery = z.infer<typeof payrollAccountingQuerySchema>;

export type LegalEntityRef = { id: string; code: string; legalName: string };

export type ErpBatchLine = {
  batchId: string;
  accountCode: string;
  componentCode: string;
  debitMinor: number;
  creditMinor: number;
  narration: string;
};

export type PayrollAccountingOverview = {
  asOf: string;
  viewerMembershipId: string | null;
  legalEntities: LegalEntityRef[];
  legalEntityId: string | null;
  /** Null — with a stated reason — rather than an empty list, when nothing can be computed. */
  coverage: { rows: CoverageRow[]; summary: CoverageSummary } | null;
  coverageUnavailableReason: string | null;
  /** RL-521 verbatim: `unmappedComponents` from ./gl for this entity and date. */
  blocking: UnmappedComponent[] | null;
  posting: PostingPathProjection;
  batchLines: ErpBatchLine[] | null;
  /** The `ledger` state machine, so the screen never restates it. */
  mappingWorkflow: LedgerWorkflowView;
  /** Record id -> the approved mappings its effective window collides with. */
  overlapPreview: Record<string, LedgerRegisterRecord[]>;
};

type LegalEntityRowShape = { id: string; code: string; legal_name: string };
type BatchRowShape = {
  id: string;
  payroll_run_id: string;
  status: string;
  debit_minor: number | string;
  credit_minor: number | string;
  acknowledgement_ref: string | null;
  posted_at: string | Date | null;
  connection_id: string | null;
  period: string | null;
  scope: string | null;
  line_count: number | string;
};
type ExportRowShape = { id: string; payroll_run_id: string; period: string | null; attributes: Record<string, unknown> | null };
type LedgerRecordRowShape = {
  id: string;
  status: string;
  component_code: string | null;
  start_date: string | null;
  end_date: string | null;
};
type BatchLineRowShape = {
  batch_id: string;
  account_code: string;
  component_code: string;
  debit_minor: number | string;
  credit_minor: number | string;
  narration: string;
};

function toInt(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toNullableInt(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/**
 * One read for the whole screen. Everything it returns has a named source; a
 * section with no source comes back null with a reason rather than as zeroes.
 */
export async function getPayrollAccountingOverview(
  access: Access,
  query: PayrollAccountingQuery,
): Promise<PayrollAccountingOverview> {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  const asOf = query.asOf ?? new Date().toISOString().slice(0, 10);

  const [entityRows, batchRows, exportRows, batchLineRows, ledgerRows] = await tenantTx(access, [
    sqlClient`select id, code, legal_name from legal_entities where tenant_id = ${access.tenantId} order by code`,
    sqlClient`
      select b.id, b.payroll_run_id, b.status, b.debit_minor, b.credit_minor, b.acknowledgement_ref,
             b.posted_at, b.connection_id, r.period, r.scope,
             (select count(*) from vp_gl_lines l where l.tenant_id = b.tenant_id and l.batch_id = b.id) as line_count
      from vp_gl_batches b
      left join payroll_runs r on r.tenant_id = b.tenant_id and r.id = b.payroll_run_id
      where b.tenant_id = ${access.tenantId}
      order by b.created_at desc
      limit 50
    `,
    sqlClient`
      select e.id, e.payroll_run_id, e.attributes, r.period
      from payroll_exports e
      left join payroll_runs r on r.tenant_id = e.tenant_id and r.id = e.payroll_run_id
      where e.tenant_id = ${access.tenantId}
      order by e.created_at desc
      limit 100
    `,
    sqlClient`
      select batch_id, account_code, component_code, debit_minor, credit_minor, narration
      from vp_gl_lines
      where tenant_id = ${access.tenantId} and (${query.batchId}::uuid is not null and batch_id = ${query.batchId}::uuid)
      order by created_at, account_code
    `,
    sqlClient`
      select id, status, data->>'componentCode' as component_code,
             data->>'startDate' as start_date, data->>'endDate' as end_date
      from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = 'ledger'
    `,
  ]);

  const legalEntities: LegalEntityRef[] = (entityRows as LegalEntityRowShape[]).map((row) => ({
    id: row.id,
    code: row.code,
    legalName: row.legal_name,
  }));

  const erpBatches: ErpBatch[] = (batchRows as BatchRowShape[]).map((row) => ({
    id: row.id,
    payrollRunId: row.payroll_run_id,
    period: row.period,
    runScope: row.scope,
    status: row.status,
    debitMinor: toInt(row.debit_minor),
    creditMinor: toInt(row.credit_minor),
    acknowledgementRef: row.acknowledgement_ref,
    postedAt: toIso(row.posted_at),
    connectionId: row.connection_id,
    lineCount: toInt(row.line_count),
  }));

  const ledgerExports: LedgerExport[] = (exportRows as ExportRowShape[]).map((row) => {
    const attributes = row.attributes ?? {};
    return {
      id: row.id,
      payrollRunId: row.payroll_run_id,
      period: row.period ?? (attributes.period ? String(attributes.period) : null),
      legalEntityId: attributes.legal_entity_id ? String(attributes.legal_entity_id) : null,
      state: String(attributes.state ?? "draft"),
      totalDebitMinor: toNullableInt(attributes.total_debit_minor),
      totalCreditMinor: toNullableInt(attributes.total_credit_minor),
      lineCount: toNullableInt(attributes.line_count),
      postedAt: attributes.posted_at ? String(attributes.posted_at) : null,
      balanced: typeof attributes.balanced === "boolean" ? attributes.balanced : null,
      failedAt: attributes.failed_at ? String(attributes.failed_at) : null,
      failureCode: attributes.failure_code ? String(attributes.failure_code) : null,
      failureMessage: attributes.failure_message ? String(attributes.failure_message) : null,
    };
  });

  const batchLines: ErpBatchLine[] | null = query.batchId === null
    ? null
    : (batchLineRows as BatchLineRowShape[]).map((row) => ({
        batchId: row.batch_id,
        accountCode: row.account_code,
        componentCode: row.component_code,
        debitMinor: toInt(row.debit_minor),
        creditMinor: toInt(row.credit_minor),
        narration: row.narration,
      }));

  const posting = projectPostingPaths({ erpBatches, ledgerExports });
  const mappingWorkflow = ledgerWorkflowView();
  const overlapPreview = buildOverlapPreview(
    (ledgerRows as LedgerRecordRowShape[]).map((row) => ({
      id: row.id,
      status: row.status,
      componentCode: row.component_code ?? "",
      startDate: row.start_date,
      endDate: row.end_date,
    })),
  );

  const legalEntityId = query.legalEntityId ?? legalEntities[0]?.id ?? null;
  if (legalEntityId === null) {
    return {
      asOf,
      viewerMembershipId: access.context.membershipId ?? null,
      legalEntities,
      legalEntityId: null,
      coverage: null,
      coverageUnavailableReason:
        "This workspace has no legal entity, and a GL mapping is resolved per legal entity. Create one before coverage can be computed.",
      blocking: null,
      posting,
      batchLines,
      mappingWorkflow,
      overlapPreview,
    };
  }
  if (query.legalEntityId !== null && !legalEntities.some((entity) => entity.id === query.legalEntityId)) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The legal entity was not found in this tenant." });
  }

  const [components, mappings, blocking] = await Promise.all([
    listComponents(access),
    listGlMappings(access, { legalEntityId, asOf }),
    // RL-521 itself. Not a re-implementation: the exact function that refuses to
    // build a journal is asked the same question for this entity and date.
    unmappedComponents(access, { legalEntityId, asOf }),
  ]);

  const mappingIndex = new Map(mappings.map((mapping) => [mapping.componentCode, mapping]));
  const rows = components
    .map((component) =>
      classifyCoverage(
        { code: component.code, name: component.name, kind: component.kind, active: component.status === "active" },
        mappingIndex.get(component.code),
        asOf,
      ),
    )
    .sort((left, right) => left.componentCode.localeCompare(right.componentCode));

  return {
    asOf,
    viewerMembershipId: access.context.membershipId ?? null,
    legalEntities,
    legalEntityId,
    coverage: { rows, summary: summarizeCoverage(rows) },
    coverageUnavailableReason: null,
    blocking: blocking.items,
    posting,
    batchLines,
    mappingWorkflow,
    overlapPreview,
  };
}
