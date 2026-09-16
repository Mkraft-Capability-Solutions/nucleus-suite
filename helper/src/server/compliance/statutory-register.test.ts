import { describe, expect, it } from "vitest";
import { operationalResources } from "@/lib/operational-catalog";

import {
  ABANDONED_FILING_STATES,
  DUE_SOON_DAYS,
  EXTERNAL_FILING_DISCLAIMER,
  FILED_FILING_STATES,
  FILING_ACTIONS,
  FILING_STATES,
  FILING_TRANSITIONS,
  LATE_REASON_MIN_LENGTH,
  OUTCOME_RECORDABLE_STATES,
  TERMINAL_FILING_STATES,
  daysUntilDue,
  dueBand,
  epochDay,
  filingActionAvailability,
  generateFormAvailability,
  isLateFiling,
  lateByDays,
  remittanceExternalKey,
  summariseRemittance,
  validateFilingOutcome,
} from "./statutory-register";

/**
 * SCR-072 — pure specification for the statutory filing register.
 *
 * Everything exercised here is a plain function over plain values: no database,
 * no request, no clock. `today` is always passed in, so a test that passes in
 * June still passes in December.
 */

const TODAY = "2026-09-14";

describe("filing state machine (mirrors the operational catalogue)", () => {
  it("offers exactly the actions the filings resource defines", () => {
    expect([...FILING_ACTIONS].sort()).toEqual(Object.keys(operationalResources.filings.transitions).sort());
  });

  it("carries the catalogue's own from/to states, not a restatement", () => {
    for (const action of FILING_ACTIONS) {
      const catalogue = operationalResources.filings.transitions[action];
      expect(FILING_TRANSITIONS[action].to).toBe(catalogue.to);
      expect(FILING_TRANSITIONS[action].from).toEqual(catalogue.from);
    }
  });

  it("walks draft -> submitted -> approved -> filed -> accepted", () => {
    expect(FILING_TRANSITIONS.submit.from).toContain("draft");
    expect(FILING_TRANSITIONS.submit.to).toBe("submitted");
    expect(FILING_TRANSITIONS.approve.from).toEqual(["submitted"]);
    expect(FILING_TRANSITIONS.file.from).toEqual(["approved"]);
    expect(FILING_TRANSITIONS.file.to).toBe("filed");
    expect(FILING_TRANSITIONS.accept.from).toEqual(["filed"]);
    expect(FILING_TRANSITIONS.accept.to).toBe("accepted");
  });

  it("treats accepted, rejected and cancelled as terminal", () => {
    expect([...TERMINAL_FILING_STATES].sort()).toEqual(["accepted", "cancelled", "rejected"]);
    expect(FILING_STATES).toContain("returned");
  });

  it("marks file and accept as approval-gated", () => {
    expect(FILING_TRANSITIONS.file.approval).toBe(true);
    expect(FILING_TRANSITIONS.accept.approval).toBe(true);
    expect(FILING_TRANSITIONS.submit.approval).toBe(false);
  });
});

describe("action availability", () => {
  it("allows only submit and cancel from draft", () => {
    const allowed = filingActionAvailability("draft").filter((entry) => entry.allowed).map((entry) => entry.action);
    expect(allowed.sort()).toEqual(["cancel", "submit"]);
  });

  it("refuses filing before approval and says why", () => {
    const file = filingActionAvailability("draft").find((entry) => entry.action === "file");
    expect(file?.allowed).toBe(false);
    expect(file?.reason).toContain("approved");
  });

  it("refuses accept until the filing is recorded as filed", () => {
    expect(filingActionAvailability("approved").find((entry) => entry.action === "accept")?.allowed).toBe(false);
    expect(filingActionAvailability("filed").find((entry) => entry.action === "accept")?.allowed).toBe(true);
  });

  it("refuses everything once accepted", () => {
    expect(filingActionAvailability("accepted").every((entry) => !entry.allowed)).toBe(true);
  });

  it("refuses everything once cancelled or rejected", () => {
    for (const state of ABANDONED_FILING_STATES) {
      expect(filingActionAvailability(state).every((entry) => !entry.allowed)).toBe(true);
    }
  });

  it("gives every refused action a reason, and every allowed one none", () => {
    for (const state of FILING_STATES) {
      for (const entry of filingActionAvailability(state)) {
        if (entry.allowed) expect(entry.reason).toBeNull();
        else expect((entry.reason ?? "").length).toBeGreaterThan(10);
      }
    }
  });

  it("cannot submit an approved filing back into review", () => {
    expect(filingActionAvailability("approved").find((entry) => entry.action === "submit")?.allowed).toBe(false);
  });

  it("stops form generation once the filing is recorded as filed", () => {
    for (const state of FILED_FILING_STATES) {
      const verdict = generateFormAvailability({ status: state, generatedFormId: "f1" });
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toContain("overwrite");
    }
    expect(generateFormAvailability({ status: "draft", generatedFormId: null }).allowed).toBe(true);
  });
});

describe("date arithmetic", () => {
  it("reads a calendar date and rejects a non-date", () => {
    expect(epochDay("1970-01-01")).toBe(0);
    expect(epochDay("1970-01-02")).toBe(1);
    expect(epochDay("")).toBeNull();
    expect(epochDay(null)).toBeNull();
    expect(epochDay("2026-9-14")).toBeNull();
    expect(epochDay("not-a-date")).toBeNull();
  });

  it("rejects a day that does not exist rather than rolling it forward", () => {
    expect(epochDay("2026-02-30")).toBeNull();
    expect(epochDay("2026-02-28")).not.toBeNull();
  });

  it("counts days to the due date with the sign pointing the right way", () => {
    expect(daysUntilDue("2026-09-14", TODAY)).toBe(0);
    expect(daysUntilDue("2026-09-15", TODAY)).toBe(1);
    expect(daysUntilDue("2026-09-13", TODAY)).toBe(-1);
    expect(daysUntilDue(null, TODAY)).toBeNull();
  });

  it("crosses a month and a leap day correctly", () => {
    expect(daysUntilDue("2026-10-01", "2026-09-30")).toBe(1);
    expect(daysUntilDue("2028-03-01", "2028-02-28")).toBe(2);
  });
});

describe("due-date banding", () => {
  const filing = (dueDate: string | null, overrides: Partial<{ status: string; filedOn: string | null }> = {}) =>
    dueBand({ status: overrides.status ?? "approved", dueDate, filedOn: overrides.filedOn ?? null, today: TODAY });

  it("bands a past due date as overdue", () => {
    expect(filing("2026-09-13")).toBe("overdue");
    expect(filing("2026-01-01")).toBe("overdue");
  });

  it("bands the due date itself as due soon, not overdue", () => {
    expect(filing(TODAY)).toBe("due_soon");
  });

  it("holds the due-soon window open to exactly DUE_SOON_DAYS", () => {
    expect(DUE_SOON_DAYS).toBe(7);
    expect(filing("2026-09-21")).toBe("due_soon");
    expect(filing("2026-09-22")).toBe("scheduled");
  });

  it("bands a recorded filed date as filed however late it was", () => {
    expect(filing("2026-01-01", { status: "filed", filedOn: "2026-09-10" })).toBe("filed");
    expect(filing("2026-12-31", { status: "accepted", filedOn: "2026-09-10" })).toBe("filed");
  });

  it("bands a workflow-filed record as filed even with no outcome date yet", () => {
    expect(filing("2026-01-01", { status: "filed", filedOn: null })).toBe("filed");
    expect(filing("2026-01-01", { status: "accepted", filedOn: null })).toBe("filed");
  });

  it("never calls a cancelled or rejected filing overdue", () => {
    for (const status of ABANDONED_FILING_STATES) {
      expect(filing("2020-01-01", { status })).toBe("closed");
    }
  });

  it("says it does not know rather than guessing when no due date exists", () => {
    expect(filing(null)).toBe("unknown");
    expect(filing("")).toBe("unknown");
  });
});

describe("late filing", () => {
  it("is not late when filed on the due date", () => {
    expect(isLateFiling("2026-09-14", "2026-09-14")).toBe(false);
    expect(lateByDays("2026-09-14", "2026-09-14")).toBe(0);
  });

  it("is not late when filed early", () => {
    expect(isLateFiling("2026-09-14", "2026-09-13")).toBe(false);
    expect(lateByDays("2026-09-14", "2026-09-13")).toBe(-1);
  });

  it("is late by one day when filed the day after", () => {
    expect(isLateFiling("2026-09-14", "2026-09-15")).toBe(true);
    expect(lateByDays("2026-09-14", "2026-09-15")).toBe(1);
  });

  it("cannot decide lateness without both dates", () => {
    expect(lateByDays(null, "2026-09-15")).toBeNull();
    expect(isLateFiling(null, "2026-09-15")).toBe(false);
    expect(isLateFiling("2026-09-14", null)).toBe(false);
  });
});

describe("filing outcome validation", () => {
  const base = { dueDate: "2026-09-14", filedOn: "2026-09-14" };

  it("accepts an on-time filing with no reason", () => {
    expect(validateFilingOutcome(base)).toEqual([]);
  });

  it("requires a late-filing reason once filed after the due date", () => {
    const issues = validateFilingOutcome({ ...base, filedOn: "2026-09-15" });
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("lateFilingReason");
    expect(issues[0].issue).toContain("1 day after the due date");
  });

  it("pluralises the delay it reports", () => {
    expect(validateFilingOutcome({ ...base, filedOn: "2026-09-17" })[0].issue).toContain("3 days after the due date");
  });

  it("rejects a token late reason shorter than the minimum", () => {
    // CMP-01 sets the explanation at 20 characters.
    expect(LATE_REASON_MIN_LENGTH).toBe(20);
    const issues = validateFilingOutcome({ ...base, filedOn: "2026-09-15", lateFilingReason: "late" });
    expect(issues.map((issue) => issue.field)).toEqual(["lateFilingReason"]);
  });

  it("does not count whitespace towards the late reason", () => {
    const issues = validateFilingOutcome({ ...base, filedOn: "2026-09-15", lateFilingReason: "   late     " });
    expect(issues.map((issue) => issue.field)).toEqual(["lateFilingReason"]);
  });

  it("accepts a late filing that explains itself", () => {
    expect(validateFilingOutcome({ ...base, filedOn: "2026-09-15", lateFilingReason: "Portal outage on the due date." })).toEqual([]);
  });

  it("does not demand a reason when the due date is unknown", () => {
    expect(validateFilingOutcome({ dueDate: null, filedOn: "2026-09-15" })).toEqual([]);
  });

  it("rejects a filed-on date that is not a calendar date", () => {
    expect(validateFilingOutcome({ ...base, filedOn: "14-09-2026" }).map((issue) => issue.field)).toEqual(["filedOn"]);
  });

  it("accepts an omitted remitted amount", () => {
    expect(validateFilingOutcome(base)).toEqual([]);
    expect(validateFilingOutcome({ ...base, amountRemittedMinor: null })).toEqual([]);
  });

  it("accepts a genuine zero remittance", () => {
    expect(validateFilingOutcome({ ...base, amountRemittedMinor: 0 })).toEqual([]);
  });

  it("rejects a negative or fractional remitted amount", () => {
    expect(validateFilingOutcome({ ...base, amountRemittedMinor: -1 }).map((issue) => issue.field)).toEqual(["amountRemittedMinor"]);
    expect(validateFilingOutcome({ ...base, amountRemittedMinor: 10.5 }).map((issue) => issue.field)).toEqual(["amountRemittedMinor"]);
  });

  it("reports every problem at once rather than one at a time", () => {
    const issues = validateFilingOutcome({ dueDate: "2026-09-14", filedOn: "2026-09-20", amountRemittedMinor: -5 });
    expect(issues.map((issue) => issue.field).sort()).toEqual(["amountRemittedMinor", "lateFilingReason"]);
  });
});

describe("remitted amount", () => {
  const recorded = (amountRemittedMinor: number | null, currency = "INR", filingId = "f1") => ({
    filingId,
    period: "2026-08",
    amountRemittedMinor,
    currency,
  });

  it("returns null, never zero, when nothing recorded an amount", () => {
    const summary = summariseRemittance([]);
    expect(summary.totalMinor).toBeNull();
    expect(summary.recordedCount).toBe(0);
    expect(summary.reason).toContain("No filing outcome");
  });

  it("returns null when filings exist but none states an amount", () => {
    const summary = summariseRemittance([recorded(null), recorded(null, "INR", "f2")]);
    expect(summary.totalMinor).toBeNull();
    expect(summary.missingCount).toBe(2);
    expect(summary.reason).toContain("no remitted amount");
  });

  it("distinguishes a recorded zero from an absent amount", () => {
    const summary = summariseRemittance([recorded(0)]);
    expect(summary.totalMinor).toBe(0);
    expect(summary.recordedCount).toBe(1);
    expect(summary.missingCount).toBe(0);
  });

  it("totals minor units exactly", () => {
    const summary = summariseRemittance([recorded(125_050), recorded(74_950, "INR", "f2")]);
    expect(summary.totalMinor).toBe(200_000);
    expect(summary.currency).toBe("INR");
    expect(summary.reason).toBeNull();
  });

  it("excludes filings with no amount and says how many", () => {
    const summary = summariseRemittance([recorded(500), recorded(null, "INR", "f2")]);
    expect(summary.totalMinor).toBe(500);
    expect(summary.missingCount).toBe(1);
    expect(summary.reason).toContain("1 filing");
  });

  it("refuses to add across currencies", () => {
    const summary = summariseRemittance([recorded(500), recorded(700, "USD", "f2")]);
    expect(summary.totalMinor).toBeNull();
    expect(summary.mixedCurrency).toBe(true);
    expect(summary.reason).toContain("INR, USD");
  });
});

describe("outcome recording rules", () => {
  it("only allows an outcome once the filing is recorded as filed", () => {
    expect([...OUTCOME_RECORDABLE_STATES].sort()).toEqual(["accepted", "filed"]);
    for (const state of ["draft", "submitted", "returned", "approved", "rejected", "cancelled"]) {
      expect(OUTCOME_RECORDABLE_STATES).not.toContain(state);
    }
  });

  it("keys one outcome per filing so a repeat record updates rather than duplicates", () => {
    expect(remittanceExternalKey("abc")).toBe("STATREMIT:abc");
    expect(remittanceExternalKey("abc")).toBe(remittanceExternalKey("abc"));
    expect(remittanceExternalKey("abc")).not.toBe(remittanceExternalKey("abd"));
  });
});

describe("what the screen is allowed to claim", () => {
  it("states that filing happens outside this system", () => {
    expect(EXTERNAL_FILING_DISCLAIMER).toContain("outside this system");
    expect(EXTERNAL_FILING_DISCLAIMER).toContain("No return is transmitted");
  });

  it("never implies a submission was transmitted or certified", () => {
    const forbidden = ["legally certified", "statutory compliant", "government approved filing", "guaranteed acceptance", "submitted to the authority"];
    for (const phrase of forbidden) expect(EXTERNAL_FILING_DISCLAIMER.toLowerCase()).not.toContain(phrase);
  });
});
