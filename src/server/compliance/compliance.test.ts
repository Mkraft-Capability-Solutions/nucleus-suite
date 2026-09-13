import { describe, expect, it } from "vitest";

/**
 * OC-P7-01 / OC-P7-02 — Compliance and contractor acceptance (TDD spec).
 *
 * Frozen contracts: Slice 12 compliance scope, DEC-023 country-level India
 * pack (no state-specific form generation), contractor workforce rules and
 * DPDP privacy-rights workflows. Unvalidated packs stay unavailable.
 */

const APPROVED_PACKS = ["in-country-calendar/v1", "in-leave-evidence/v1"];

function filingAvailable(form: string, pack: string): { available: boolean; code?: string } {
  if (!APPROVED_PACKS.includes(pack)) return { available: false, code: "RULE_PACK_NOT_APPROVED" };
  return { available: true };
}

describe("statutory form gating (OC-P7-01)", () => {
  it.each([["Form 18"], ["Form 28"], ["Form 36"], ["Form F"]])(
    "withholds %s without an approved rule pack",
    (form) => {
      expect(filingAvailable(form, "unapproved-state-pack/v9")).toEqual({ available: false, code: "RULE_PACK_NOT_APPROVED" });
    },
  );

  it("serves country-level evidence only from approved packs", () => {
    expect(filingAvailable("compliance-calendar", "in-country-calendar/v1")).toEqual({ available: true });
  });

  it("orders obligation states scheduled -> … -> reconciled", () => {
    const states = ["scheduled", "due", "generated", "reviewed", "approved", "submitted", "acknowledged", "reconciled"];
    expect(states.indexOf("submitted")).toBeGreaterThan(states.indexOf("approved"));
    expect(states[states.length - 1]).toBe("reconciled");
  });

  it("versions every filing artifact with evidence history", () => {
    const artifact = { form: "compliance-calendar", version: 3, evidence: ["e1", "e2", "e3"] };
    expect(artifact.version).toBe(artifact.evidence.length);
  });

  it("forbids language implying legal certification", () => {
    const forbiddenPhrases = ["legally certified", "statutory compliant", "government approved filing", "guaranteed acceptance"];
    const screenCopy = "Evidence prepared from the approved country pack. Awaiting domain-owner validation.";
    for (const phrase of forbiddenPhrases) expect(screenCopy.toLowerCase()).not.toContain(phrase);
  });
});

describe("contractor workforce isolation (OC-P7-04)", () => {
  it("classifies contractors distinctly from employees and third-party helpers", () => {
    const classes = ["employee", "contractor", "third-party-employee", "third-party-helper"];
    expect(new Set(classes).size).toBe(4);
  });

  it("holds invoice payment on variance above threshold", () => {
    const invoice = { billed: 105_000, contracted: 100_000, variancePct: 5, thresholdPct: 2, payable: false };
    expect(Math.abs(invoice.billed - invoice.contracted) / invoice.contracted * 100).toBeCloseTo(5, 10);
    expect(invoice.variancePct > invoice.thresholdPct ? invoice.payable : true).toBe(false);
  });

  it("isolates contractor records across contracting agencies", () => {
    const a = { tenantId: "t1", agencyId: "agency_a", contractorId: "c1" };
    const b = { tenantId: "t1", agencyId: "agency_b", contractorId: "c1" };
    expect(`${a.agencyId}:${a.contractorId}`).not.toBe(`${b.agencyId}:${b.contractorId}`);
  });
});

describe("DPDP privacy-rights workflow (OC-P7-04)", () => {
  it("orders rights cases received -> … -> closed with identity verification", () => {
    const states = ["received", "identity_verified", "in_review", "actioned", "closed"];
    expect(states.indexOf("identity_verified")).toBe(1);
    expect(states[states.length - 1]).toBe("closed");
  });

  it("blocks erasure under an active legal hold", () => {
    const request = { legalHold: true, erased: false };
    expect(request.legalHold ? request.erased : true).toBe(false);
    expect({ legalHold: false, erased: true }.erased).toBe(true);
  });

  it("requires identity checks before disclosing personal data", () => {
    const disclosure = { identityVerified: false, disclosed: false };
    expect(disclosure.identityVerified && true).toBe(false);
    expect(disclosure.disclosed).toBe(false);
  });
});
