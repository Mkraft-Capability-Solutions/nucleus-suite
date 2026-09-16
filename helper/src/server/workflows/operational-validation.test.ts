import { describe, expect, it } from "vitest";
import { operationalResources } from "@/lib/operational-catalog";
import { assertPassedAmount, parseOperationalInput, transitionDefinition } from "./operational-validation";
import { mutateOperationalRecord } from "./operational-service";
import { saveDossier } from "./dossier-service";
import { enforceVpCommand } from "@/server/vp/service";
import type { Access } from "@/server/platform/access";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";
const access: Access = { tenantId: employeeId, context: { tenantId: employeeId, actorUserId: "u", membershipId: employeeId, permissions: ["employee.write"], roles: [] } };
const travel = { employeeId, requestType: "business_travel", purpose: "Factory inspection", origin: "Pune", destination: "Mumbai", startDate: "2026-09-20", endDate: "2026-09-21", transport: "rail", estimatedCostMinor: 100000, advanceMinor: 20000, contactPhone: "+911234567890" };

describe("operational contracts", () => {
  it("rejects missing fields, unknown fields, invalid dates and excessive advances", () => {
    expect(parseOperationalInput("travel", travel)).toMatchObject(travel);
    for (const invalid of [{ ...travel, employeeId: undefined }, { ...travel, status: "approved" }, { ...travel, endDate: "2026-09-19" }, { ...travel, startDate: "2026-02-30" }, { ...travel, advanceMinor: 100001 }]) expect(() => parseOperationalInput("travel", invalid)).toThrow();
  });
  it("does not allow client-selected states or actions outside the lifecycle", () => {
    expect(() => transitionDefinition("travel", "delete")).toThrow();
    expect(transitionDefinition("travel", "approve")).toEqual({ from: ["submitted"], to: "approved", approval: true });
    expect(transitionDefinition("assets", "allocate").from).not.toContain("allocated");
    for (const definition of Object.values(operationalResources)) expect(definition.editable).not.toContain("approved");
  });
  it("rejects general employee-write access before touching storage", async () => {
    await expect(mutateOperationalRecord(access, "travel", { action: "create", input: travel, key: "request" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveDossier(access, "bank", { input: {}, key: "request" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(() => enforceVpCommand(access, { action: "create_gl_posting", payrollRunId: employeeId })).toThrow();
  });
  it("requires bank field access even with dossier-write permission", async () => {
    const scoped = { ...access, context: { ...access.context, permissions: ["employee.dossier.write"] } };
    await expect(saveDossier(scoped, "bank", { input: {}, key: "request" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("computes settlement net from explicit reviewed amounts without demo proration", () => {
    const result = parseOperationalInput("settlements", { employeeId, offboardingCaseId: employeeId, payrollRunId: employeeId, lastWorkingDate: "2026-09-20", salaryPayableMinor: 10000, leaveEncashmentMinor: 2000, gratuityMinor: 500, otherEarningsMinor: 0, loanRecoveryMinor: 1000, noticeRecoveryMinor: 0, taxDeductionMinor: 500, calculationPolicyReference: "Approved payroll / policy v3", notes: "Reviewed inputs" });
    expect(result.netPayableMinor).toBe(11000);
  });
});

describe("amount passed at approval (SCR-058)", () => {
  it("accepts an amount equal to the claim", () => {
    expect(assertPassedAmount(12_000, 12_000)).toBe(12_000);
  });

  it("accepts a reduction, which is the whole point of recording it", () => {
    expect(assertPassedAmount(12_000, 9_500)).toBe(9_500);
  });

  it("accepts a full disallowance", () => {
    expect(assertPassedAmount(12_000, 0)).toBe(0);
  });

  it("refuses more than was claimed, naming both figures", () => {
    expect(() => assertPassedAmount(12_000, 12_001)).toThrowError(/Claimed 12000, passed 12001/);
  });

  it("refuses a negative amount", () => {
    expect(() => assertPassedAmount(12_000, -1)).toThrowError(/whole, non-negative|whole number/);
  });

  it("refuses a fractional amount, since money is held in minor units", () => {
    expect(() => assertPassedAmount(12_000, 950.5)).toThrowError(/whole number of minor units/);
  });

  it("refuses a non-numeric amount rather than coercing it", () => {
    expect(() => assertPassedAmount(12_000, "nine thousand")).toThrowError(/whole number of minor units/);
    expect(() => assertPassedAmount(12_000, null)).toThrowError(/whole number of minor units/);
  });
});
