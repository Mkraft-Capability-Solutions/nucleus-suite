import { describe, expect, it } from "vitest";
import { resolveExportAction } from "@/server/payroll/gl";
import { clearanceBlockingSql, isClearanceBlocking } from "@/server/lifecycle/clearance-board";
import { isAdvanceSettled, TERMINAL_ADVANCE_STATUSES } from "@/server/advances/status";
import {
  erpEmployeePayloadSchema,
  ERP_RETRYABLE_STATUSES,
  erpPayloadHash,
  resolveInboundReplay,
} from "./erp-sync";

/**
 * T-28 (ERP failure queue), T-29 (a failed posting is visible), T-30 (a waived
 * no-dues line releases the settlement) and T-19 (a recovered advance stops
 * blocking) — the decisions behind each, asserted without a database.
 */

describe("resolveInboundReplay (T-28)", () => {
  it("applies a payload that has never been seen", () => {
    expect(resolveInboundReplay(null)).toEqual({ action: "apply" });
  });

  it("replays only a record that actually landed", () => {
    expect(resolveInboundReplay({ id: "r1", status: "applied" })).toEqual({ action: "replay", recordId: "r1" });
    expect(resolveInboundReplay({ id: "r1", status: "posted" })).toEqual({ action: "replay", recordId: "r1" });
  });

  it("retries a record that stopped part-way, which the status-blind guard called a replay", () => {
    // This is the defect: the same payload against a `validated` row used to
    // return {replay:true} and never apply, so a half-failed sync was unrepairable.
    for (const status of ["received", "validated", "queued", "failed", "dead"]) {
      expect(resolveInboundReplay({ id: "r1", status })).toEqual({ action: "retry", recordId: "r1" });
    }
  });

  it("compares status case- and whitespace-insensitively", () => {
    expect(resolveInboundReplay({ id: "r1", status: " Applied " })).toEqual({ action: "replay", recordId: "r1" });
  });

  it("does not offer a retry for a record that is already done", () => {
    expect(ERP_RETRYABLE_STATUSES).not.toContain("applied");
    expect(ERP_RETRYABLE_STATUSES).not.toContain("dead");
    expect(ERP_RETRYABLE_STATUSES).toContain("failed");
  });
});

describe("erpPayloadHash", () => {
  it("depends on content, not key order", () => {
    const left = erpPayloadHash({ firstName: "Anil", lastName: "Yadav" });
    const right = erpPayloadHash({ lastName: "Yadav", firstName: "Anil" });
    expect(left.hash).toBe(right.hash);
  });

  it("changes when a value changes, so an edited employee is not mistaken for a replay", () => {
    expect(erpPayloadHash({ department: "Weaving" }).hash).not.toBe(erpPayloadHash({ department: "Dyeing" }).hash);
  });
});

describe("erpEmployeePayloadSchema", () => {
  const payload = {
    firstName: "Anil",
    lastName: "Yadav",
    department: "Weaving",
    location: "PLANT-N",
    designation: "Weaving Operator",
    joiningDate: "2021-02-01",
  };

  it("accepts the fields the ERP owns", () => {
    expect(erpEmployeePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("refuses a malformed joining date, so a bad record fails once rather than every retry", () => {
    expect(erpEmployeePayloadSchema.safeParse({ ...payload, joiningDate: "01-02-2021" }).success).toBe(false);
  });
});

describe("resolveExportAction with a failed posting (T-29)", () => {
  const fingerprint = "abc";

  it("re-posts after a failure instead of reporting the journal unchanged", () => {
    expect(resolveExportAction({ id: "e1", state: "failed", fingerprint }, fingerprint)).toEqual({ action: "create" });
  });

  it("still treats a posted journal with the same content as a no-op", () => {
    expect(resolveExportAction({ id: "e1", state: "posted", fingerprint }, fingerprint)).toEqual({ action: "unchanged", exportId: "e1" });
  });

  it("still supersedes a posted journal whose content changed", () => {
    expect(resolveExportAction({ id: "e1", state: "posted", fingerprint: "other" }, fingerprint)).toEqual({ action: "supersede", exportId: "e1" });
  });
});

describe("clearance blocking rule (T-30)", () => {
  it("releases a waived line that carries a reason", () => {
    expect(isClearanceBlocking({ status: "waived", waiveReason: "Asset written off by facilities" })).toBe(false);
  });

  it("still blocks a waiver with no reason, as W-07 requires", () => {
    expect(isClearanceBlocking({ status: "waived", waiveReason: null })).toBe(true);
    expect(isClearanceBlocking({ status: "waived", waiveReason: "   " })).toBe(true);
  });

  it("releases a cleared line and blocks everything else", () => {
    expect(isClearanceBlocking({ status: "cleared", waiveReason: null })).toBe(false);
    expect(isClearanceBlocking({ status: "pending", waiveReason: null })).toBe(true);
    expect(isClearanceBlocking({ status: "held", waiveReason: null })).toBe(true);
    expect(isClearanceBlocking({ status: null, waiveReason: null })).toBe(true);
  });

  it("is case-insensitive, because the board wrote 'Waived' and every gate compared lower case", () => {
    expect(isClearanceBlocking({ status: "Waived", waiveReason: "Asset written off by facilities" })).toBe(false);
    expect(isClearanceBlocking({ status: "CLEARED", waiveReason: null })).toBe(false);
  });

  it("emits SQL that lower-cases the status and demands a waiver reason", () => {
    const sql = clearanceBlockingSql("i");
    expect(sql).toContain("lower(coalesce(i.attributes->>'status', 'pending'))");
    expect(sql).toContain("not in ('cleared', 'waived')");
    expect(sql).toContain("i.attributes->>'waive_reason'");
  });

  it("refuses an alias that is not a plain identifier", () => {
    expect(() => clearanceBlockingSql("i; drop table clearance_items --")).toThrow("Unsafe SQL alias");
  });
});

describe("advance terminal statuses (T-19)", () => {
  it("counts the status payroll actually writes on recovery", () => {
    // `finalizePayrollRun` writes 'recovered'; the loans module's list omitted it,
    // so a fully recovered advance blocked every later loan permanently.
    expect(TERMINAL_ADVANCE_STATUSES).toContain("recovered");
    expect(isAdvanceSettled("recovered")).toBe(true);
  });

  it("also counts a directly repaid or closed advance", () => {
    expect(isAdvanceSettled("repaid")).toBe(true);
    expect(isAdvanceSettled("closed")).toBe(true);
    expect(isAdvanceSettled("rejected")).toBe(true);
    expect(isAdvanceSettled("cancelled")).toBe(true);
  });

  it("leaves a live advance blocking", () => {
    expect(isAdvanceSettled("paid")).toBe(false);
    expect(isAdvanceSettled("approved")).toBe(false);
    expect(isAdvanceSettled(null)).toBe(false);
  });
});
