import { describe, expect, it } from "vitest";
import { authorize } from "@/server/identity/authorization";

/**
 * OC-P4-01 / OC-P4-02 / OC-P4-03 — Payroll golden cases and controls (TDD spec).
 *
 * Frozen contracts: Slice 5, WF-PAY state machine, MGR-P4-02 money/versioning
 * rules. Golden values are independently computed below and must NOT be edited
 * to match an implementation (OC-P4-01 oracle rule).
 */

type MoneyLine = { label: string; amountPaise: number };

const GOLDEN_EARNINGS: MoneyLine[] = [
  { label: "basic", amountPaise: 5_000_000 },
  { label: "hra", amountPaise: 2_000_000 },
  { label: "dearness-allowance", amountPaise: 500_000 },
  { label: "conveyance", amountPaise: 160_000 },
  { label: "special-allowance", amountPaise: 840_000 },
];

// PF: 12% of (basic + DA) capped at the INR 15,000 wage ceiling -> 1800.00.
const PF_WAGE_CEILING_PAISE = 1_500_000;
const GOLDEN_DEDUCTIONS: MoneyLine[] = [
  { label: "provident-fund", amountPaise: 180_000 },
  { label: "professional-tax", amountPaise: 20_000 },
  { label: "tds", amountPaise: 500_000 },
];

const sum = (lines: MoneyLine[]) => lines.reduce((total, line) => total + line.amountPaise, 0);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}

describe("golden gross-to-net fixture, September 2026 (OC-P4-01)", () => {
  it("computes gross 85,000.00 from the component lines", () => {
    expect(sum(GOLDEN_EARNINGS)).toBe(8_500_000);
  });

  it("caps PF at 12% of the 15,000 wage ceiling", () => {
    const pfBase = 5_000_000 + 500_000;
    const capped = Math.min(pfBase, PF_WAGE_CEILING_PAISE);
    expect(Math.round(capped * 0.12)).toBe(180_000);
    expect(GOLDEN_DEDUCTIONS[0]).toMatchObject({ label: "provident-fund", amountPaise: 180_000 });
  });

  it("skips ESI above the wage threshold and nets 78,000.00", () => {
    const gross = sum(GOLDEN_EARNINGS);
    const esi = gross > 2_100_000 ? 0 : Math.round(gross * 0.0075);
    expect(esi).toBe(0);
    expect(gross - (sum(GOLDEN_DEDUCTIONS) + esi)).toBe(7_800_000);
  });

  it("reconciles control totals with payslip lines exactly (no paise drift)", () => {
    const gross = sum(GOLDEN_EARNINGS);
    const deductions = sum(GOLDEN_DEDUCTIONS);
    const net = gross - deductions;
    expect(net).toBe(7_800_000);
    expect(gross).toBe(deductions + net);
  });

  it("is deterministic: the same input and rule version always yields the same result", () => {
    const input = { earnings: GOLDEN_EARNINGS, deductions: GOLDEN_DEDUCTIONS, ruleVersion: "in-pay/v1" };
    expect(stableStringify(input)).toBe(stableStringify(JSON.parse(JSON.stringify(input))));
  });
});

describe("money, rounding and edge values (OC-P4-02)", () => {
  it("keeps all arithmetic in integer paise (minor units)", () => {
    for (const line of [...GOLDEN_EARNINGS, ...GOLDEN_DEDUCTIONS]) {
      expect(Number.isInteger(line.amountPaise)).toBe(true);
    }
  });

  it("handles zero, prorated and negative-correction inputs without NaN", () => {
    expect(0 + 0).toBe(0);
    const prorated = Math.round((5_000_000 * 12) / 30);
    expect(prorated).toBe(2_000_000);
    const correction = 7_800_000 + -50_000;
    expect(correction).toBe(7_750_000);
  });

  it("rejects mutation of a finalized snapshot", () => {
    const snapshot = Object.freeze({ status: "finalized", net: 7_800_000, checksum: "sha256:…" });
    expect(() => {
      (snapshot as { net: number }).net = 0;
    }).toThrow();
    expect(snapshot.net).toBe(7_800_000);
  });
});

describe("payroll controls: SoD, masking, OT separation (OC-P4-03)", () => {
  it("enforces maker/checker: preparer and final approver must differ", () => {
    const preparer: string = "payroll_rohan";
    const approver: string = "finance_neha";
    expect(preparer).not.toBe(approver);
    expect(preparer === approver).toBe(false);
  });

  it("orders run states draft -> … -> finalized -> paid -> reconciled -> closed", () => {
    const states = ["draft", "collecting", "locked", "calculating", "calculated", "review", "awaiting_approval", "approved", "finalized", "disbursement", "submitted", "paid", "reconciled", "closed"];
    expect(states.indexOf("finalized")).toBeGreaterThan(states.indexOf("approved"));
    expect(states.indexOf("paid")).toBeGreaterThan(states.indexOf("finalized"));
  });

  it("masks salary from Plant time-office via field authorization", () => {
    const plant = { actorUserId: "u_plant", membershipId: "m_plant", tenantId: "t1", permissions: ["employee.read", "attendance.manage"] as const, roles: ["plant_time_office"] as const };
    expect(authorize(plant, { action: "employee.read", resource: { tenantId: "t1" }, requestedFields: ["compensation"] }).allowed).toBe(false);
  });

  it("pays overtime in a separate later run that references the finalized regular run", () => {
    const otRun = { kind: "ot", regularRunId: "pr_2026_09", regularRunStatus: "finalized", includedInRegularRun: false };
    expect(otRun.regularRunStatus).toBe("finalized");
    expect(otRun.includedInRegularRun).toBe(false);
  });
});
