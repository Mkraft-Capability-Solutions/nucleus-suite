import { describe, expect, it } from "vitest";

import {
  COVERAGE_STATES,
  LEDGER_STATES,
  MAKER_CHECKER_REASON,
  approvedOverlaps,
  buildOverlapPreview,
  classifyCoverage,
  ledgerActionAvailability,
  ledgerEditable,
  ledgerResource,
  ledgerWorkflowView,
  payrollAccountingQuerySchema,
  projectPostingPaths,
  summarizeCoverage,
  type CoverageComponent,
  type ErpBatch,
  type LedgerExport,
  type LedgerRegisterRecord,
} from "./accounting";
import { JOURNAL_DIMENSIONS, type GlAccountRef, type ResolvedMapping } from "./gl";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "11111111-1111-4111-8111-111111111111";
const ASOF = "2026-03-31";

const salaryExpense: GlAccountRef = { id: "acc-5001", code: "5001", name: "Salaries", type: "expense", purpose: "component" };
const pfLiability: GlAccountRef = { id: "acc-2001", code: "2001", name: "PF payable", type: "liability", purpose: "component" };

function mapping(overrides: Partial<ResolvedMapping> = {}): ResolvedMapping {
  return {
    legalEntityId: ENTITY,
    componentCode: "BASIC",
    componentName: "Basic",
    kind: "earning",
    postingSide: "debit",
    debitAccount: salaryExpense,
    creditAccount: null,
    costCenterSource: "employee",
    costCenterId: null,
    costCenterCode: null,
    startDate: "2026-01-01",
    endDate: null,
    status: "approved",
    workflowRecordId: "rec-basic",
    dimensionSource: ["employee"],
    locationOverrides: [],
    mappingId: null,
    dimensions: JOURNAL_DIMENSIONS,
    ...overrides,
  };
}

function component(overrides: Partial<CoverageComponent> = {}): CoverageComponent {
  return { code: "BASIC", name: "Basic", kind: "earning", active: true, ...overrides };
}

function record(overrides: Partial<LedgerRegisterRecord> = {}): LedgerRegisterRecord {
  return { id: "rec-1", status: "approved", componentCode: "BASIC", startDate: "2026-01-01", endDate: "2026-12-31", ...overrides };
}

function batch(overrides: Partial<ErpBatch> = {}): ErpBatch {
  return {
    id: "batch-1",
    payrollRunId: "run-1",
    period: "2026-03",
    runScope: "regular",
    status: "queued",
    debitMinor: 1_000_00,
    creditMinor: 1_000_00,
    acknowledgementRef: null,
    postedAt: null,
    connectionId: null,
    lineCount: 3,
    ...overrides,
  };
}

function exportRow(overrides: Partial<LedgerExport> = {}): LedgerExport {
  return {
    id: "exp-1",
    payrollRunId: "run-1",
    period: "2026-03",
    legalEntityId: ENTITY,
    state: "posted",
    totalDebitMinor: 1_200_00,
    totalCreditMinor: 1_200_00,
    lineCount: 7,
    postedAt: "2026-04-01T00:00:00.000Z",
    balanced: true,
    failedAt: null,
    failureCode: null,
    failureMessage: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Coverage classification
// ---------------------------------------------------------------------------

describe("mapping coverage classification (SCR-102 accounting)", () => {
  it("reports an approved, effective mapping as covered and non-blocking", () => {
    const row = classifyCoverage(component(), mapping(), ASOF);
    expect(row.state).toBe("mapped");
    expect(row.blocksRun).toBe(false);
    expect(row.reason).toBeNull();
    expect(row.accountCode).toBe("5001");
  });

  it("reports a component with no mapping at all as unmapped, and blocking", () => {
    const row = classifyCoverage(component({ code: "HRA", name: "House rent allowance" }), undefined, ASOF);
    expect(row.state).toBe("unmapped");
    expect(row.blocksRun).toBe(true);
    expect(row.reason).toBe("No GL mapping exists for this component and legal entity.");
    expect(row.accountCode).toBeNull();
  });

  it("separates a mapping still inside its workflow from one that was refused", () => {
    expect(classifyCoverage(component(), mapping({ status: "submitted" }), ASOF).state).toBe("in_workflow");
    expect(classifyCoverage(component(), mapping({ status: "draft" }), ASOF).state).toBe("in_workflow");
    expect(classifyCoverage(component(), mapping({ status: "returned" }), ASOF).state).toBe("in_workflow");
    expect(classifyCoverage(component(), mapping({ status: "rejected" }), ASOF).state).toBe("refused");
    expect(classifyCoverage(component(), mapping({ status: "cancelled" }), ASOF).state).toBe("refused");
  });

  it("reports a retired mapping as retired rather than as never mapped", () => {
    const row = classifyCoverage(component(), mapping({ status: "retired" }), ASOF);
    expect(row.state).toBe("retired");
    expect(row.blocksRun).toBe(true);
    expect(row.reason).toBe("The GL mapping is retired, not approved.");
  });

  it("treats the effective window as inclusive at both ends", () => {
    const startsToday = mapping({ startDate: ASOF, endDate: null });
    expect(classifyCoverage(component(), startsToday, ASOF).state).toBe("mapped");

    const endsToday = mapping({ startDate: "2026-01-01", endDate: ASOF });
    expect(classifyCoverage(component(), endsToday, ASOF).state).toBe("mapped");
  });

  it("reports the day before a mapping starts as not yet effective", () => {
    const row = classifyCoverage(component(), mapping({ startDate: "2026-04-01" }), ASOF);
    expect(row.state).toBe("not_yet_effective");
    expect(row.blocksRun).toBe(true);
    expect(row.reason).toBe(`The GL mapping is not effective on ${ASOF}.`);
  });

  it("reports the day after a mapping ends as expired", () => {
    const row = classifyCoverage(component(), mapping({ startDate: "2026-01-01", endDate: "2026-03-30" }), ASOF);
    expect(row.state).toBe("expired");
    expect(row.blocksRun).toBe(true);
  });

  it("treats an open-ended mapping as covering every later date", () => {
    expect(classifyCoverage(component(), mapping({ startDate: null, endDate: null }), "2099-12-31").state).toBe("mapped");
  });

  it("names a mapping that is approved and effective but points the wrong way", () => {
    const row = classifyCoverage(component(), mapping({ postingSide: "credit", debitAccount: null, creditAccount: pfLiability }), ASOF);
    expect(row.state).toBe("misconfigured");
    expect(row.blocksRun).toBe(true);
    expect(row.reason).toBe("The mapping posts to the credit side, but a earning posts to the debit side.");
  });

  it("excludes information-only components, which never reach the ledger", () => {
    const row = classifyCoverage(component({ code: "CTC", kind: "information_only" }), undefined, ASOF);
    expect(row.state).toBe("not_applicable");
    expect(row.blocksRun).toBe(false);
  });

  it("does not let an inactive component block a run, while still showing the gap", () => {
    const row = classifyCoverage(component({ active: false }), undefined, ASOF);
    expect(row.state).toBe("unmapped");
    expect(row.blocksRun).toBe(false);
  });

  it("summarises every coverage state and counts only the blocking ones", () => {
    const rows = [
      classifyCoverage(component(), mapping(), ASOF),
      classifyCoverage(component({ code: "HRA" }), undefined, ASOF),
      classifyCoverage(component({ code: "PF" }), mapping({ componentCode: "PF", status: "retired" }), ASOF),
      classifyCoverage(component({ code: "CTC", kind: "information_only" }), undefined, ASOF),
    ];
    const summary = summarizeCoverage(rows);
    expect(summary.total).toBe(4);
    expect(summary.mapped).toBe(1);
    expect(summary.unmapped).toBe(1);
    expect(summary.retired).toBe(1);
    expect(summary.not_applicable).toBe(1);
    expect(summary.blocking).toBe(2);
    for (const state of COVERAGE_STATES) expect(typeof summary[state]).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// The mapping state machine
// ---------------------------------------------------------------------------

describe("mapping state machine (SCR-102 accounting)", () => {
  const OTHER = "membership-checker";
  const AUTHOR = "membership-maker";

  function availability(action: string, status: string, viewer = OTHER) {
    return ledgerActionAvailability(action, { status, createdByMembershipId: AUTHOR, viewerMembershipId: viewer });
  }

  it("reads its transitions from the ledger resource definition, not a local copy", () => {
    expect(ledgerResource.module).toBe("accounting");
    expect(ledgerResource.permission).toBe("payroll.accounting");
    expect(ledgerResource.initial).toBe("draft");
    expect(Object.keys(ledgerResource.transitions).sort()).toEqual(["approve", "cancel", "reject", "retire", "return", "submit"]);
  });

  it("allows the happy path draft -> submitted -> approved -> retired", () => {
    expect(availability("submit", "draft").allowed).toBe(true);
    expect(availability("approve", "submitted").allowed).toBe(true);
    expect(availability("retire", "approved").allowed).toBe(true);
  });

  it("allows a returned mapping to be resubmitted", () => {
    expect(availability("submit", "returned").allowed).toBe(true);
  });

  it("refuses to approve a draft, and says why", () => {
    const outcome = availability("approve", "draft");
    expect(outcome.allowed).toBe(false);
    expect(outcome.reason).toBe("A draft mapping cannot be approved. This action applies only to submitted.");
  });

  it("refuses to submit an already approved mapping", () => {
    const outcome = availability("submit", "approved");
    expect(outcome.allowed).toBe(false);
    expect(outcome.reason).toContain("cannot be submitted");
  });

  it("refuses to retire anything that is not approved", () => {
    for (const status of ["draft", "submitted", "returned", "rejected", "cancelled", "retired"]) {
      expect(availability("retire", status).allowed).toBe(false);
    }
  });

  it("refuses every action on a terminal mapping", () => {
    for (const status of ["rejected", "cancelled", "retired"]) {
      for (const action of ["submit", "approve", "return", "reject", "cancel", "retire"]) {
        expect(availability(action, status).allowed).toBe(false);
      }
    }
  });

  it("allows cancel from draft, returned and submitted only", () => {
    expect(availability("cancel", "draft").allowed).toBe(true);
    expect(availability("cancel", "returned").allowed).toBe(true);
    expect(availability("cancel", "submitted").allowed).toBe(true);
    expect(availability("cancel", "approved").allowed).toBe(false);
  });

  it("enforces the maker/checker split on approval-side actions", () => {
    for (const action of ["approve", "return", "reject"]) {
      const outcome = availability(action, "submitted", AUTHOR);
      expect(outcome.allowed).toBe(false);
      expect(outcome.reason).toBe("You created this mapping. Approval, return, rejection and retirement need a different person.");
    }
    expect(availability("retire", "approved", AUTHOR).allowed).toBe(false);
  });

  it("does not apply the maker/checker split to submit or cancel", () => {
    expect(availability("submit", "draft", AUTHOR).allowed).toBe(true);
    expect(availability("cancel", "draft", AUTHOR).allowed).toBe(true);
  });

  it("rejects an action the workflow does not define", () => {
    const outcome = availability("post", "approved");
    expect(outcome.allowed).toBe(false);
    expect(outcome.reason).toBe("post is not an action on the GL mapping workflow.");
  });

  it("permits field edits only in the editable states", () => {
    expect(ledgerEditable("draft")).toBe(true);
    expect(ledgerEditable("returned")).toBe(true);
    expect(ledgerEditable("submitted")).toBe(false);
    expect(ledgerEditable("approved")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The effective-date overlap guard
// ---------------------------------------------------------------------------

describe("effective-date overlap guard preview (SCR-102 accounting)", () => {
  it("finds an approved mapping whose window overlaps the candidate's", () => {
    const existing = record({ id: "rec-live", startDate: "2026-01-01", endDate: "2026-12-31" });
    const candidate = record({ id: "rec-new", startDate: "2026-06-01", endDate: "2027-05-31" });
    expect(approvedOverlaps(candidate, [existing]).map((row) => row.id)).toEqual(["rec-live"]);
  });

  it("treats a shared boundary day as an overlap, exactly as the SQL does", () => {
    const existing = record({ id: "rec-live", startDate: "2026-01-01", endDate: "2026-06-30" });
    const candidate = record({ id: "rec-new", startDate: "2026-06-30", endDate: "2026-12-31" });
    expect(approvedOverlaps(candidate, [existing])).toHaveLength(1);
  });

  it("allows a window that starts the day after the previous one ends", () => {
    const existing = record({ id: "rec-live", startDate: "2026-01-01", endDate: "2026-06-30" });
    const candidate = record({ id: "rec-new", startDate: "2026-07-01", endDate: "2026-12-31" });
    expect(approvedOverlaps(candidate, [existing])).toHaveLength(0);
  });

  it("ignores mappings for a different component", () => {
    const existing = record({ id: "rec-hra", componentCode: "HRA" });
    expect(approvedOverlaps(record({ id: "rec-new" }), [existing])).toHaveLength(0);
  });

  it("ignores mappings that are not approved", () => {
    for (const status of ["draft", "submitted", "returned", "rejected", "cancelled", "retired"]) {
      expect(approvedOverlaps(record({ id: "rec-new" }), [record({ id: "rec-other", status })])).toHaveLength(0);
    }
  });

  it("never reports a record against itself", () => {
    const same = record({ id: "rec-same" });
    expect(approvedOverlaps(same, [same])).toHaveLength(0);
  });

  it("reports nothing when either window is open, because the SQL comparison is null there", () => {
    expect(approvedOverlaps(record({ id: "a", endDate: null }), [record({ id: "b" })])).toHaveLength(0);
    expect(approvedOverlaps(record({ id: "a" }), [record({ id: "b", startDate: null })])).toHaveLength(0);
  });

  it("keys the register-wide preview by record and omits the records with no conflict", () => {
    const live = record({ id: "rec-live", startDate: "2026-01-01", endDate: "2026-12-31" });
    const clashing = record({ id: "rec-draft", status: "draft", startDate: "2026-06-01", endDate: "2027-05-31" });
    const clear = record({ id: "rec-clear", status: "draft", componentCode: "HRA" });
    const preview = buildOverlapPreview([live, clashing, clear]);
    expect(Object.keys(preview)).toEqual(["rec-draft"]);
    expect(preview["rec-draft"].map((row) => row.id)).toEqual(["rec-live"]);
  });
});

// ---------------------------------------------------------------------------
// The workflow view handed to the screen
// ---------------------------------------------------------------------------

describe("ledger workflow view (SCR-102 accounting)", () => {
  const view = ledgerWorkflowView();

  it("lists every state the transitions can reach", () => {
    expect(view.states).toEqual(LEDGER_STATES);
    expect(view.states).toEqual(["approved", "cancelled", "draft", "rejected", "retired", "returned", "submitted"]);
  });

  it("names the approval-gated actions", () => {
    expect(view.approvalActions.sort()).toEqual(["approve", "reject", "retire", "return"]);
    expect(view.makerCheckerReason).toBe(MAKER_CHECKER_REASON);
  });

  it("carries one availability entry for every state and action pair", () => {
    for (const status of view.states) {
      for (const action of view.actions) {
        expect(view.matrix[status][action]).toEqual(
          ledgerActionAvailability(action, { status, createdByMembershipId: "author", viewerMembershipId: "checker" }),
        );
      }
    }
  });

  it("evaluates the matrix for a checker, leaving the maker/checker test to the caller", () => {
    expect(view.matrix.submitted.approve.allowed).toBe(true);
    expect(view.matrix.draft.approve.allowed).toBe(false);
    expect(view.editable).toEqual(["draft", "returned"]);
  });
});

// ---------------------------------------------------------------------------
// The two posting paths
// ---------------------------------------------------------------------------

describe("two-posting-path projection (SCR-102 accounting)", () => {
  it("reports each path under its own table and never merges them", () => {
    const projection = projectPostingPaths({ erpBatches: [batch()], ledgerExports: [exportRow()] });
    expect(projection.reconciled).toBe(false);
    expect(projection.erp.table).toBe("vp_gl_batches");
    expect(projection.ledgerJournal.table).toBe("payroll_exports");
    expect(projection.erp.items).toHaveLength(1);
    expect(projection.ledgerJournal.items).toHaveLength(1);
    // Same run, different amounts on the two paths. Neither is adjusted to the
    // other and no combined total is produced.
    expect(projection.erp.items[0].debitMinor).toBe(1_000_00);
    expect(projection.ledgerJournal.items[0].totalDebitMinor).toBe(1_200_00);
    expect(Object.keys(projection)).toEqual(["reconciled", "erp", "ledgerJournal", "presence"]);
  });

  it("counts queued and acknowledged ERP batches separately", () => {
    const projection = projectPostingPaths({
      erpBatches: [
        batch({ id: "b1", payrollRunId: "run-1", status: "queued" }),
        batch({ id: "b2", payrollRunId: "run-2", status: "reconciled", acknowledgementRef: "ERP-88" }),
        batch({ id: "b3", payrollRunId: "run-3", status: "failed" }),
      ],
      ledgerExports: [],
    });
    expect(projection.erp.queued).toBe(1);
    expect(projection.erp.acknowledged).toBe(1);
    expect(projection.ledgerJournal.posted).toBe(0);
  });

  it("counts posted and superseded journal exports separately", () => {
    const projection = projectPostingPaths({
      erpBatches: [],
      ledgerExports: [
        exportRow({ id: "e1", payrollRunId: "run-1", state: "posted" }),
        exportRow({ id: "e2", payrollRunId: "run-1", state: "superseded" }),
        exportRow({ id: "e3", payrollRunId: "run-2", state: "posted" }),
      ],
    });
    expect(projection.ledgerJournal.posted).toBe(2);
    expect(projection.ledgerJournal.superseded).toBe(1);
    expect(projection.erp.queued).toBe(0);
  });

  it("reports presence per run without claiming the two paths agree", () => {
    const projection = projectPostingPaths({
      erpBatches: [batch({ id: "b1", payrollRunId: "run-both" }), batch({ id: "b2", payrollRunId: "run-erp-only" })],
      ledgerExports: [
        exportRow({ id: "e1", payrollRunId: "run-both" }),
        exportRow({ id: "e2", payrollRunId: "run-journal-only" }),
      ],
    });
    expect(projection.presence.runsOnBothPaths).toEqual(["run-both"]);
    expect(projection.presence.runsOnlyInErpBatches).toEqual(["run-erp-only"]);
    expect(projection.presence.runsOnlyInLedgerJournal).toEqual(["run-journal-only"]);
  });

  it("does not count a superseded export as journal presence for its run", () => {
    const projection = projectPostingPaths({
      erpBatches: [batch({ payrollRunId: "run-1" })],
      ledgerExports: [exportRow({ payrollRunId: "run-1", state: "superseded" })],
    });
    expect(projection.presence.runsOnBothPaths).toEqual([]);
    expect(projection.presence.runsOnlyInErpBatches).toEqual(["run-1"]);
  });

  it("returns empty, not zeroed, projections when neither path has written anything", () => {
    const projection = projectPostingPaths({ erpBatches: [], ledgerExports: [] });
    expect(projection.erp.items).toEqual([]);
    expect(projection.ledgerJournal.items).toEqual([]);
    expect(projection.presence.runsOnBothPaths).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Query contract
// ---------------------------------------------------------------------------

describe("query schema (SCR-102 accounting)", () => {
  it("accepts an empty query and treats every filter as absent", () => {
    const parsed = payrollAccountingQuerySchema.parse({ legalEntityId: null, asOf: null, batchId: null });
    expect(parsed).toEqual({ legalEntityId: null, asOf: null, batchId: null });
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    const parsed = payrollAccountingQuerySchema.safeParse({ legalEntityId: null, asOf: "31-03-2026", batchId: null });
    expect(parsed.success).toBe(false);
  });

  it("rejects a legal entity that is not a uuid", () => {
    expect(payrollAccountingQuerySchema.safeParse({ legalEntityId: "acme", asOf: null, batchId: null }).success).toBe(false);
  });
});
