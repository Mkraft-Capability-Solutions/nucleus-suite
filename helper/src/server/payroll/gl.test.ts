import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/platform/http";

import {
  JOURNAL_DIMENSIONS,
  affectsNetPay,
  assertBalanced,
  composeJournal,
  dimensionKey,
  findUnmappedComponents,
  journalFingerprint,
  mappingEffective,
  mappingIssue,
  mergeMappings,
  naturalSide,
  periodEndDate,
  resolveCostCenter,
  resolveExportAction,
  upsertGlAccountSchema,
  type GlAccountRef,
  type GlAccountRow,
  type LedgerRecord,
  type LineDimensions,
  type ResolvedMapping,
  type SourceLine,
} from "./gl";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "11111111-1111-4111-8111-111111111111";
const OTHER_ENTITY = "22222222-2222-4222-8222-222222222222";

function account(id: string, code: string, type: GlAccountRef["type"], purpose: GlAccountRef["purpose"] = "component"): GlAccountRef {
  return { id, code, name: `${code} account`, type, purpose };
}

const salaryExpense = account("acc-salary", "5001", "expense");
const pfLiability = account("acc-pf", "2001", "liability");
const tdsLiability = account("acc-tds", "2002", "liability");
const bank = account("acc-bank", "1001", "asset", "net_pay");

function mapping(overrides: Partial<ResolvedMapping> & Pick<ResolvedMapping, "componentCode" | "kind">): ResolvedMapping {
  return {
    legalEntityId: ENTITY,
    componentName: overrides.componentCode,
    postingSide: naturalSide(overrides.kind) ?? "debit",
    debitAccount: null,
    creditAccount: null,
    costCenterSource: "employee_assignment",
    costCenterId: null,
    costCenterCode: null,
    startDate: "2026-01-01",
    endDate: null,
    status: "approved",
    workflowRecordId: "wf-1",
    mappingId: null,
    dimensions: JOURNAL_DIMENSIONS,
    dimensionSource: ["employee_assignment"],
    locationOverrides: [],
    ...overrides,
  };
}

const basicMapping = mapping({ componentCode: "basic", kind: "earning", debitAccount: salaryExpense });
const pfMapping = mapping({ componentCode: "pf", kind: "deduction", creditAccount: pfLiability });
const tdsMapping = mapping({ componentCode: "tds", kind: "deduction", creditAccount: tdsLiability });

function dimensions(overrides: Partial<LineDimensions> = {}): LineDimensions {
  return {
    costCenterId: "cc-1",
    costCenterCode: "CC-OPS",
    departmentId: "dep-1",
    department: "Operations",
    locationId: "loc-1",
    location: "Pune",
    projectId: null,
    runType: "regular",
    ...overrides,
  };
}

function line(overrides: Partial<SourceLine> & Pick<SourceLine, "payrollLineId" | "componentCode" | "kind" | "amountMinor">): SourceLine {
  return {
    payrollRunEmployeeId: "pre-1",
    employeeId: "emp-1",
    employeeCode: "E-001",
    employeeName: "Asha Rao",
    legalEntityId: ENTITY,
    costCenterOptions: { assignmentId: "cc-1", assignmentCode: "CC-OPS", positionId: "cc-pos", positionCode: "CC-POS" },
    dimensions: dimensions(),
    ...overrides,
  };
}

const composeArgs = { runId: "run-1", runType: "regular", legalEntityId: ENTITY, netPayAccount: bank, asOf: "2026-03-31" };

// ---------------------------------------------------------------------------

describe("chart of accounts (SCR-102)", () => {
  it("requires a legal entity, code, name, type and start date", () => {
    const parsed = upsertGlAccountSchema.safeParse({ code: "5001", name: "Salary expense" });
    expect(parsed.success).toBe(false);
  });

  it("defaults an account to an active component account with an open end date", () => {
    const parsed = upsertGlAccountSchema.safeParse({ legalEntityId: ENTITY, code: "5001", name: "Salary expense", type: "expense", effectiveFrom: "2026-01-01" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toMatchObject({ purpose: "component", status: "active", effectiveTo: null });
  });

  it("rejects an end date that precedes the start date", () => {
    const parsed = upsertGlAccountSchema.safeParse({ legalEntityId: ENTITY, code: "5001", name: "Salary expense", type: "expense", effectiveFrom: "2026-04-01", effectiveTo: "2026-01-01" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown field rather than silently dropping it", () => {
    const parsed = upsertGlAccountSchema.safeParse({ legalEntityId: ENTITY, code: "5001", name: "Salary expense", type: "expense", effectiveFrom: "2026-01-01", glCode: "oops" });
    expect(parsed.success).toBe(false);
  });
});

describe("mapping effectivity (SCR-102)", () => {
  it("closes the period on the last calendar day, February included", () => {
    expect(periodEndDate("2026-03")).toBe("2026-03-31");
    expect(periodEndDate("2026-02")).toBe("2026-02-28");
    expect(periodEndDate("2024-02")).toBe("2024-02-29");
  });

  it("only posts an approved mapping whose window covers the resolution date", () => {
    expect(mappingEffective({ status: "approved", startDate: "2026-01-01", endDate: null }, "2026-03-31")).toBe(true);
    expect(mappingEffective({ status: "submitted", startDate: "2026-01-01", endDate: null }, "2026-03-31")).toBe(false);
    expect(mappingEffective({ status: "approved", startDate: "2026-04-01", endDate: null }, "2026-03-31")).toBe(false);
    expect(mappingEffective({ status: "approved", startDate: "2026-01-01", endDate: "2026-02-28" }, "2026-03-31")).toBe(false);
    expect(mappingEffective({ status: "retired", startDate: "2026-01-01", endDate: null }, "2026-03-31")).toBe(false);
  });

  it("names the reason a mapping cannot post, including a posting side that contradicts the kind", () => {
    expect(mappingIssue(undefined, "earning", "2026-03-31")).toContain("No GL mapping");
    expect(mappingIssue(mapping({ componentCode: "basic", kind: "earning", status: "submitted", debitAccount: salaryExpense }), "earning", "2026-03-31")).toContain("submitted");
    expect(mappingIssue(mapping({ componentCode: "basic", kind: "earning", postingSide: "credit", creditAccount: pfLiability }), "earning", "2026-03-31")).toContain("credit side");
    expect(mappingIssue(mapping({ componentCode: "basic", kind: "earning", debitAccount: null }), "earning", "2026-03-31")).toContain("debit account does not exist");
    expect(mappingIssue(basicMapping, "earning", "2026-03-31")).toBeNull();
  });

  it("puts each component kind on the side double-entry requires", () => {
    expect(naturalSide("earning")).toBe("debit");
    expect(naturalSide("reimbursement")).toBe("debit");
    expect(naturalSide("employer_contribution")).toBe("debit");
    expect(naturalSide("deduction")).toBe("credit");
    expect(naturalSide("information_only")).toBeNull();
    expect(affectsNetPay("employer_contribution")).toBe(false);
    expect(affectsNetPay("deduction")).toBe(true);
  });
});

describe("unmapped component detection (SCR-102)", () => {
  const lines = [
    line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 5_000_000 }),
    line({ payrollLineId: "l2", componentCode: "pf", kind: "deduction", amountMinor: 600_000 }),
    line({ payrollLineId: "l3", componentCode: "pf", kind: "deduction", amountMinor: 400_000, employeeId: "emp-2", payrollRunEmployeeId: "pre-2" }),
  ];

  it("reports nothing when every component is mapped and effective", () => {
    expect(findUnmappedComponents(lines, [basicMapping, pfMapping], "2026-03-31")).toEqual([]);
  });

  it("blocks with the component, its exposure and the employees behind it", () => {
    const unmapped = findUnmappedComponents(lines, [basicMapping], "2026-03-31");
    expect(unmapped).toHaveLength(1);
    expect(unmapped[0].componentCode).toBe("pf");
    expect(unmapped[0].amountMinor).toBe(1_000_000);
    expect(unmapped[0].employeeCount).toBe(2);
    expect(unmapped[0].reason).toContain("No GL mapping");
  });

  it("treats a mapping in a different legal entity as no mapping at all", () => {
    const foreign = mapping({ componentCode: "pf", kind: "deduction", legalEntityId: OTHER_ENTITY, creditAccount: pfLiability });
    expect(findUnmappedComponents(lines, [basicMapping, foreign], "2026-03-31").map((item) => item.componentCode)).toEqual(["pf"]);
  });

  it("blocks a line whose employee has no legal entity rather than guessing one", () => {
    const orphan = [line({ payrollLineId: "l9", componentCode: "basic", kind: "earning", amountMinor: 100, legalEntityId: null })];
    expect(findUnmappedComponents(orphan, [basicMapping], "2026-03-31")[0].reason).toContain("no legal entity");
  });

  it("ignores information-only components, which never reach the ledger", () => {
    const notional = [line({ payrollLineId: "l8", componentCode: "ctc_note", kind: "information_only", amountMinor: 1 })];
    expect(findUnmappedComponents(notional, [], "2026-03-31")).toEqual([]);
  });
});

describe("journal composition (SCR-102 / RL-522)", () => {
  it("balances a run to the minor unit: earnings debit, deductions credit, net pay credits the bank", () => {
    const journal = composeJournal({
      ...composeArgs,
      lines: [
        line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 5_000_000 }),
        line({ payrollLineId: "l2", componentCode: "pf", kind: "deduction", amountMinor: 600_000 }),
        line({ payrollLineId: "l3", componentCode: "tds", kind: "deduction", amountMinor: 123_457 }),
      ],
      mappings: [basicMapping, pfMapping, tdsMapping],
    });
    expect(journal.balanced).toBe(true);
    expect(journal.residualMinor).toBe(0);
    expect(journal.totalDebitMinor).toBe(5_000_000);
    expect(journal.totalCreditMinor).toBe(5_000_000);
    const netLine = journal.lines.find((entry) => entry.accountCode === bank.code);
    expect(netLine?.creditMinor).toBe(5_000_000 - 600_000 - 123_457);
    expect(netLine?.componentCode).toBeNull();
  });

  it("writes no account string of its own: every leg names a mapped account", () => {
    const journal = composeJournal({
      ...composeArgs,
      lines: [line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 1_000 })],
      mappings: [basicMapping],
    });
    expect(journal.lines.map((entry) => entry.accountCode).sort()).toEqual([bank.code, salaryExpense.code].sort());
    expect(journal.lines.some((entry) => entry.accountCode.includes("-payable"))).toBe(false);
  });

  it("balances an employer contribution across expense and liability without moving net pay", () => {
    const contribution = mapping({ componentCode: "pf_employer", kind: "employer_contribution", debitAccount: salaryExpense, creditAccount: pfLiability });
    const journal = composeJournal({
      ...composeArgs,
      lines: [
        line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 1_000_000 }),
        line({ payrollLineId: "l2", componentCode: "pf_employer", kind: "employer_contribution", amountMinor: 120_000 }),
      ],
      mappings: [basicMapping, contribution],
    });
    expect(journal.balanced).toBe(true);
    expect(journal.lines.find((entry) => entry.accountCode === bank.code)?.creditMinor).toBe(1_000_000);
  });

  it("debits the net-pay account when deductions exceed earnings, and still balances", () => {
    const journal = composeJournal({
      ...composeArgs,
      lines: [
        line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 100_000 }),
        line({ payrollLineId: "l2", componentCode: "pf", kind: "deduction", amountMinor: 150_000 }),
      ],
      mappings: [basicMapping, pfMapping],
    });
    expect(journal.balanced).toBe(true);
    expect(journal.lines.find((entry) => entry.accountCode === bank.code)?.debitMinor).toBe(50_000);
  });

  it("keeps every contributing payroll line and employee on the journal line (RL-531)", () => {
    const journal = composeJournal({
      ...composeArgs,
      lines: [
        line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 300 }),
        line({ payrollLineId: "l2", componentCode: "basic", kind: "earning", amountMinor: 700, employeeId: "emp-2", employeeCode: "E-002", employeeName: "Rahul Nair", payrollRunEmployeeId: "pre-2" }),
      ],
      mappings: [basicMapping],
    });
    const expense = journal.lines.find((entry) => entry.accountCode === salaryExpense.code);
    expect(expense?.debitMinor).toBe(1_000);
    expect(expense?.contributions.map((item) => item.payrollLineId)).toEqual(["l1", "l2"]);
    expect(expense?.contributions.map((item) => item.employeeId)).toEqual(["emp-1", "emp-2"]);
  });

  it("refuses to compose while a component is unmapped", () => {
    expect(() => composeJournal({
      ...composeArgs,
      lines: [line({ payrollLineId: "l1", componentCode: "pf", kind: "deduction", amountMinor: 100 })],
      mappings: [basicMapping],
    })).toThrowError(/GL_MAPPING_MISSING|cannot post/);
  });

  it("rejects a non-integer amount rather than rounding it into the residual", () => {
    expect(() => composeJournal({
      ...composeArgs,
      lines: [line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 100.5 })],
      mappings: [basicMapping],
    })).toThrowError(/non-integer/);
  });
});

describe("balance assertion (SCR-102)", () => {
  it("names the residual and the run when debits and credits disagree", () => {
    let caught: unknown;
    try {
      assertBalanced(
        [{ debitMinor: 5_000_000, creditMinor: 0 }, { debitMinor: 0, creditMinor: 4_400_000 }, { debitMinor: 0, creditMinor: 600_000 }, { debitMinor: 0, creditMinor: 600_000 }],
        { runId: "run-1", legalEntityId: ENTITY },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpError);
    const error = caught as HttpError;
    expect(error.status).toBe(422);
    expect(error.code).toBe("GL_JOURNAL_UNBALANCED");
    // The reference implementation credited earnings-minus-deductions AND each
    // deduction, double-counting the deductions. The residual must be named.
    expect(error.message).toContain("-600000");
    expect(error.details).toEqual([{ field: "residualMinor", issue: "-600000" }]);
  });

  it("returns both totals for a journal that balances", () => {
    expect(assertBalanced([{ debitMinor: 100, creditMinor: 0 }, { debitMinor: 0, creditMinor: 100 }], { runId: "run-1", legalEntityId: ENTITY }))
      .toEqual({ totalDebitMinor: 100, totalCreditMinor: 100 });
  });
});

describe("dimension passthrough (SCR-102)", () => {
  it("carries cost centre, department, location, project and run type on every line", () => {
    const journal = composeJournal({
      ...composeArgs,
      lines: [line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 1_000 })],
      mappings: [basicMapping],
    });
    for (const entry of journal.lines) {
      expect(entry.dimensions.costCenterId).toBe("cc-1");
      expect(entry.dimensions.department).toBe("Operations");
      expect(entry.dimensions.location).toBe("Pune");
      expect(entry.dimensions.runType).toBe("regular");
      // No payroll line carries a project today: reported as null, never invented.
      expect(entry.dimensions.projectId).toBeNull();
    }
  });

  it("stamps the run type from the run, not from the source line", () => {
    const journal = composeJournal({
      ...composeArgs,
      runType: "full_final",
      lines: [line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 1_000, dimensions: dimensions({ runType: "regular" }) })],
      mappings: [basicMapping],
    });
    expect(journal.lines.every((entry) => entry.dimensions.runType === "full_final")).toBe(true);
  });

  it("honours the mapping's cost centre source, including a source that yields null", () => {
    const options = { assignmentId: "cc-1", assignmentCode: "CC-OPS", positionId: "cc-pos", positionCode: "CC-POS" };
    const fixed = { costCenterId: "cc-fixed", costCenterCode: "CC-FIX" };
    expect(resolveCostCenter("employee_assignment", options, fixed)).toEqual({ costCenterId: "cc-1", costCenterCode: "CC-OPS" });
    expect(resolveCostCenter("position", options, fixed)).toEqual({ costCenterId: "cc-pos", costCenterCode: "CC-POS" });
    expect(resolveCostCenter("mapping", options, fixed)).toEqual({ costCenterId: "cc-fixed", costCenterCode: "CC-FIX" });
    expect(resolveCostCenter("none", options, fixed)).toEqual({ costCenterId: null, costCenterCode: null });
    expect(resolveCostCenter("", options, fixed)).toEqual({ costCenterId: null, costCenterCode: null });
  });

  it("marks a genuinely unavailable cost centre null instead of substituting another", () => {
    const journal = composeJournal({
      ...composeArgs,
      lines: [line({
        payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 1_000,
        costCenterOptions: { assignmentId: null, assignmentCode: null, positionId: null, positionCode: null },
        dimensions: dimensions({ costCenterId: null, costCenterCode: null, departmentId: null, department: null }),
      })],
      mappings: [basicMapping],
    });
    for (const entry of journal.lines) {
      expect(entry.dimensions.costCenterId).toBeNull();
      expect(entry.dimensions.department).toBeNull();
      expect(entry.dimensions.location).toBe("Pune");
    }
  });

  it("splits one account across two cost centres rather than merging them", () => {
    const journal = composeJournal({
      ...composeArgs,
      lines: [
        line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 400 }),
        line({
          payrollLineId: "l2", componentCode: "basic", kind: "earning", amountMinor: 600, employeeId: "emp-2", payrollRunEmployeeId: "pre-2",
          costCenterOptions: { assignmentId: "cc-2", assignmentCode: "CC-PLANT", positionId: null, positionCode: null },
          dimensions: dimensions({ costCenterId: "cc-2", costCenterCode: "CC-PLANT" }),
        }),
      ],
      mappings: [basicMapping],
    });
    const expenseLines = journal.lines.filter((entry) => entry.accountCode === salaryExpense.code);
    expect(expenseLines).toHaveLength(2);
    expect(expenseLines.map((entry) => entry.dimensions.costCenterId).sort()).toEqual(["cc-1", "cc-2"]);
    expect(journal.balanced).toBe(true);
  });

  it("gives identical dimension sets the same aggregation key and differing ones a different key", () => {
    expect(dimensionKey(dimensions())).toBe(dimensionKey(dimensions()));
    expect(dimensionKey(dimensions())).not.toBe(dimensionKey(dimensions({ costCenterId: "cc-2" })));
  });
});

describe("posting idempotency (SCR-102)", () => {
  const journal = composeJournal({
    ...composeArgs,
    lines: [
      line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 5_000_000 }),
      line({ payrollLineId: "l2", componentCode: "pf", kind: "deduction", amountMinor: 600_000 }),
    ],
    mappings: [basicMapping, pfMapping],
  });

  it("fingerprints the same journal identically no matter how often it is built", () => {
    const again = composeJournal({
      ...composeArgs,
      lines: [
        line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 5_000_000 }),
        line({ payrollLineId: "l2", componentCode: "pf", kind: "deduction", amountMinor: 600_000 }),
      ],
      mappings: [basicMapping, pfMapping],
    });
    expect(journalFingerprint(again)).toBe(journalFingerprint(journal));
  });

  it("changes the fingerprint when an amount moves", () => {
    const changed = composeJournal({
      ...composeArgs,
      lines: [
        line({ payrollLineId: "l1", componentCode: "basic", kind: "earning", amountMinor: 5_000_001 }),
        line({ payrollLineId: "l2", componentCode: "pf", kind: "deduction", amountMinor: 600_000 }),
      ],
      mappings: [basicMapping, pfMapping],
    });
    expect(journalFingerprint(changed)).not.toBe(journalFingerprint(journal));
  });

  it("creates the first export, leaves an unchanged re-post alone and supersedes a changed one", () => {
    const fingerprint = journalFingerprint(journal);
    expect(resolveExportAction(null, fingerprint)).toEqual({ action: "create" });
    expect(resolveExportAction({ id: "exp-1", state: "posted", fingerprint }, fingerprint)).toEqual({ action: "unchanged", exportId: "exp-1" });
    expect(resolveExportAction({ id: "exp-1", state: "posted", fingerprint: "other" }, fingerprint)).toEqual({ action: "supersede", exportId: "exp-1" });
  });

  it("does not re-use a superseded export: the record is kept, a new one is created", () => {
    const fingerprint = journalFingerprint(journal);
    expect(resolveExportAction({ id: "exp-0", state: "superseded", fingerprint }, fingerprint)).toEqual({ action: "create" });
  });
});

describe("mapping resolution (SCR-102)", () => {
  const accounts: GlAccountRow[] = [
    { ...salaryExpense, legalEntityId: ENTITY, status: "active" as const, effectiveFrom: "2026-01-01", effectiveTo: null },
    { ...pfLiability, legalEntityId: ENTITY, status: "active" as const, effectiveFrom: "2026-01-01", effectiveTo: null },
  ];
  const components = [
    { code: "basic", name: "Basic", kind: "earning" as const },
    { code: "pf", name: "Provident fund", kind: "deduction" as const },
  ];
  /** A `ledger` record as `loadLedgerRecords` builds it: every FRM-FIN-01 key present. */
  const record = (over: Partial<LedgerRecord> & Pick<LedgerRecord, "id" | "componentCode">): LedgerRecord => ({
    status: "approved",
    entityCode: null,
    accountCode: "5001",
    postingSide: "debit",
    debitAccountCode: null,
    creditAccountCode: null,
    dimensionSource: [],
    costCenterSource: "",
    locationOverrides: [],
    startDate: null,
    endDate: null,
    ...over,
  });
  const ledger: LedgerRecord[] = [
    record({ id: "wf-basic", componentCode: "basic", accountCode: "5001", costCenterSource: "employee_assignment", startDate: "2026-01-01" }),
    record({ id: "wf-pf", status: "submitted", componentCode: "pf", accountCode: "2001", postingSide: "credit", costCenterSource: "none", startDate: "2026-01-01" }),
  ];

  it("carries the real workflow state through, rather than labelling every row validated", () => {
    const resolved = mergeMappings({ legalEntityIds: [ENTITY], components, ledgerRecords: ledger, accounts, mappingRows: [], asOf: "2026-03-31" });
    expect(resolved.map((item) => [item.componentCode, item.status])).toEqual([["basic", "approved"], ["pf", "submitted"]]);
  });

  it("resolves the account code against the chart of accounts of that legal entity only", () => {
    const resolved = mergeMappings({ legalEntityIds: [ENTITY, OTHER_ENTITY], components, ledgerRecords: ledger, accounts, mappingRows: [], asOf: "2026-03-31" });
    expect(resolved.find((item) => item.legalEntityId === ENTITY && item.componentCode === "basic")?.debitAccount?.id).toBe(salaryExpense.id);
    expect(resolved.find((item) => item.legalEntityId === OTHER_ENTITY && item.componentCode === "basic")?.debitAccount).toBeNull();
  });

  it("keeps the declared posting side and cost centre source on the resolved mapping", () => {
    const resolved = mergeMappings({ legalEntityIds: [ENTITY], components, ledgerRecords: ledger, accounts, mappingRows: [], asOf: "2026-03-31" });
    const pf = resolved.find((item) => item.componentCode === "pf");
    expect(pf?.postingSide).toBe("credit");
    expect(pf?.creditAccount?.id).toBe(pfLiability.id);
    expect(pf?.debitAccount).toBeNull();
    expect(pf?.costCenterSource).toBe("none");
    expect(pf?.dimensions).toEqual(JOURNAL_DIMENSIONS);
  });

  it("prefers the workflow record whose window covers the resolution date", () => {
    const dated: LedgerRecord[] = [
      record({ id: "wf-old", componentCode: "basic", costCenterSource: "none", startDate: "2025-01-01", endDate: "2025-12-31" }),
      record({ id: "wf-new", componentCode: "basic", costCenterSource: "position", startDate: "2026-01-01" }),
    ];
    const resolved = mergeMappings({ legalEntityIds: [ENTITY], components, ledgerRecords: dated, accounts, mappingRows: [], asOf: "2026-03-31" });
    expect(resolved[0].workflowRecordId).toBe("wf-new");
    expect(resolved[0].costCenterSource).toBe("position");
  });

  it("lets a materialised gl_mappings row supply the cost centre the workflow only named a source for", () => {
    const resolved = mergeMappings({
      legalEntityIds: [ENTITY],
      components,
      ledgerRecords: ledger,
      accounts,
      mappingRows: [{ id: "map-1", legalEntityId: ENTITY, componentCode: "basic", debitAccountId: salaryExpense.id, creditAccountId: salaryExpense.id, costCenterId: "cc-fixed", costCenterCode: "CC-FIX", status: null, postingSide: null, costCenterSource: null, startDate: null, endDate: null }],
      asOf: "2026-03-31",
    });
    const basic = resolved.find((item) => item.componentCode === "basic");
    expect(basic?.mappingId).toBe("map-1");
    expect(basic?.costCenterId).toBe("cc-fixed");
    expect(basic?.status).toBe("approved");
  });
});

describe("GL mapping form (FRM-FIN-01)", () => {
  const ENTITY = "11111111-1111-4111-8111-111111111111";
  const OTHER_ENTITY = "22222222-2222-4222-8222-222222222222";
  const debitAccount = { id: "acc-dr", legalEntityId: ENTITY, code: "5001", name: "Salary expense", type: "expense" as const, purpose: "component" as const, status: "active" as const, effectiveFrom: "2026-01-01", effectiveTo: null };
  const creditAccount = { id: "acc-cr", legalEntityId: ENTITY, code: "2001", name: "Salary payable", type: "liability" as const, purpose: "component" as const, status: "active" as const, effectiveFrom: "2026-01-01", effectiveTo: null };
  const components = [{ code: "basic", name: "Basic", kind: "earning" as const }];
  const record = (over: Partial<LedgerRecord> & Pick<LedgerRecord, "id">): LedgerRecord => ({
    status: "approved",
    entityCode: null,
    componentCode: "basic",
    accountCode: "",
    postingSide: "debit",
    debitAccountCode: null,
    creditAccountCode: null,
    dimensionSource: [],
    costCenterSource: "",
    locationOverrides: [],
    startDate: null,
    endDate: null,
    ...over,
  });
  const merge = (ledgerRecords: LedgerRecord[], legalEntityCodes?: Record<string, string>) =>
    mergeMappings({ legalEntityIds: [ENTITY], components, ledgerRecords, accounts: [debitAccount, creditAccount], mappingRows: [], asOf: "2026-03-31", legalEntityCodes });

  it("resolves a debit and a credit account from one record, as the workbook specifies", () => {
    const [resolved] = merge([record({ id: "wf-1", debitAccountCode: "5001", creditAccountCode: "2001" })]);
    expect(resolved.debitAccount?.id).toBe("acc-dr");
    expect(resolved.creditAccount?.id).toBe("acc-cr");
  });

  it("still reads the single-sided accountCode plus postingSide form, leaving the other side unmapped", () => {
    const [debitOnly] = merge([record({ id: "wf-2", accountCode: "5001", postingSide: "debit" })]);
    expect(debitOnly.debitAccount?.id).toBe("acc-dr");
    expect(debitOnly.creditAccount).toBeNull();
    const [creditOnly] = merge([record({ id: "wf-3", accountCode: "2001", postingSide: "credit" })]);
    expect(creditOnly.creditAccount?.id).toBe("acc-cr");
    expect(creditOnly.debitAccount).toBeNull();
  });

  it("applies an entity's own mapping over one that names no entity", () => {
    const resolved = merge(
      [
        record({ id: "wf-any", accountCode: "5001", startDate: "2026-01-01" }),
        record({ id: "wf-mine", entityCode: "MK-IND", debitAccountCode: "5001", creditAccountCode: "2001", startDate: "2026-01-01" }),
      ],
      { [ENTITY]: "MK-IND" },
    );
    expect(resolved[0].workflowRecordId).toBe("wf-mine");
    expect(resolved[0].creditAccount?.id).toBe("acc-cr");
  });

  it("does not let one entity's mapping leak onto another entity", () => {
    const resolved = mergeMappings({
      legalEntityIds: [ENTITY, OTHER_ENTITY],
      components,
      ledgerRecords: [record({ id: "wf-mine", entityCode: "MK-IND", debitAccountCode: "5001" })],
      accounts: [debitAccount, creditAccount],
      mappingRows: [],
      asOf: "2026-03-31",
      legalEntityCodes: { [ENTITY]: "MK-IND", [OTHER_ENTITY]: "MK-SEZ" },
    });
    expect(resolved.find((item) => item.legalEntityId === ENTITY)?.debitAccount?.id).toBe("acc-dr");
    // The other entity has no mapping at all, so it does not appear as a mapped row.
    expect(resolved.find((item) => item.legalEntityId === OTHER_ENTITY)?.debitAccount ?? null).toBeNull();
  });

  it("carries the dimension sources and location overrides through to the resolved mapping", () => {
    const [resolved] = merge([
      record({ id: "wf-4", debitAccountCode: "5001", dimensionSource: ["cost_center", "location"], locationOverrides: [{ location: "PLANT-1", debitAccountCode: "5002", creditAccountCode: null }] }),
    ]);
    expect(resolved.dimensionSource).toEqual(["cost_center", "location"]);
    expect(resolved.locationOverrides).toEqual([{ location: "PLANT-1", debitAccountCode: "5002", creditAccountCode: null }]);
  });

  it("falls back to the single cost-centre source when no dimension list was captured", () => {
    const [resolved] = merge([record({ id: "wf-5", debitAccountCode: "5001", costCenterSource: "employee_assignment" })]);
    expect(resolved.dimensionSource).toEqual(["employee_assignment"]);
  });
});
