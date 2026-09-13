import { describe, expect, it } from "vitest";
import {
  assignWorkerSchema,
  createAgencySchema,
  createContractSchema,
  submitInvoiceSchema,
} from "@/server/contractors/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("contractors schemas", () => {
  it("validates agency creation", () => {
    expect(createAgencySchema.safeParse({ name: "Shree Powerloom" }).success).toBe(true);
    expect(createAgencySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("validates contracts with date order and variance bounds", () => {
    const valid = { agencyId: UUID, code: "AMC-26", startsOn: "2026-04-01", endsOn: "2027-03-31", monthlyMinor: 15000000 };
    const parsed = createContractSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.varianceThresholdPct).toBe(2);
    expect(createContractSchema.safeParse({ ...valid, varianceThresholdPct: 101 }).success).toBe(false);
  });

  it("validates invoices and worker assignments", () => {
    expect(submitInvoiceSchema.safeParse({ contractId: UUID, contractedMinor: 15000000, billedMinor: 15200000, period: "2026-08" }).success).toBe(true);
    expect(submitInvoiceSchema.safeParse({ contractId: UUID, contractedMinor: 1, billedMinor: 1, period: "Aug" }).success).toBe(false);
    expect(assignWorkerSchema.safeParse({ contractId: UUID, personName: "Raju", startsOn: "2026-09-01" }).success).toBe(true);
    expect(assignWorkerSchema.safeParse({ contractId: UUID, personName: "Raju", category: "alien", startsOn: "2026-09-01" }).success).toBe(false);
  });
});
