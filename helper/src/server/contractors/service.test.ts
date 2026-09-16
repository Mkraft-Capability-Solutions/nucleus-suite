import { describe, expect, it } from "vitest";
import {
  assignWorkerSchema,
  createAgencySchema,
  createContractSchema,
  submitInvoiceSchema,
} from "@/server/contractors/service";
import { disputeInvoiceSchema } from "@/server/contractors/reconciliation";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

const AGENCY = {
  name: "Shree Powerloom",
  code: "SHP",
  licenceNo: "CLRA/KA/2026/0114",
  licenceValidTill: "2027-03-31",
  vendorPfCode: "KN/BNG/0012345/000",
  vendorEsiCode: "53000123450001099",
};

const CONTRACT = {
  agencyId: UUID,
  code: "AMC-26",
  startsOn: "2026-04-01",
  endsOn: "2027-03-31",
  locationCode: "Plant North",
  orgUnit: "Weaving",
  scopeOfWork: "Housekeeping and material movement across the weaving shed on all three shifts.",
  workerClass: "contract_labour",
  sanctionedCount: 40,
  rateCard: [{ skill: "Helper", dailyRateMinor: 60_000, overtimeRateMinor: 11_250 }],
  monthlyMinor: 15000000,
};

const INVOICE = {
  contractId: UUID,
  invoiceNumber: "INV-2026-0041",
  invoiceDate: "2026-08-31",
  contractedMinor: 15000000,
  billedMinor: 15200000,
  claimedDays: [{ skill: "Helper", days: 380, dailyRateMinor: 40_000, amountMinor: 15200000 }],
  vendorRemittanceRef: "doc:pf-challan-2026-08",
  period: "2026-08",
};

describe("contractors schemas", () => {
  it("validates agency creation", () => {
    expect(createAgencySchema.safeParse(AGENCY).success).toBe(true);
    expect(createAgencySchema.safeParse({ ...AGENCY, name: "" }).success).toBe(false);
  });

  it("validates contracts with date order and variance bounds", () => {
    const parsed = createContractSchema.safeParse(CONTRACT);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.varianceThresholdPct).toBe(2);
    expect(createContractSchema.safeParse({ ...CONTRACT, varianceThresholdPct: 101 }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...CONTRACT, endsOn: "2026-03-31" }).success).toBe(false);
  });

  it("validates invoices and worker assignments", () => {
    expect(submitInvoiceSchema.safeParse(INVOICE).success).toBe(true);
    expect(submitInvoiceSchema.safeParse({ ...INVOICE, period: "Aug" }).success).toBe(false);
    expect(assignWorkerSchema.safeParse({ contractId: UUID, personName: "Raju", startsOn: "2026-09-01" }).success).toBe(true);
    expect(assignWorkerSchema.safeParse({ contractId: UUID, personName: "Raju", category: "alien", startsOn: "2026-09-01" }).success).toBe(false);
  });
});

describe("CTG-01 contractor engagement", () => {
  it("insists on the licence and the statutory codes", () => {
    for (const field of ["code", "licenceNo", "licenceValidTill", "vendorPfCode", "vendorEsiCode"]) {
      const { [field]: _dropped, ...without } = AGENCY as Record<string, unknown>;
      expect(createAgencySchema.safeParse(without).success, field).toBe(false);
    }
    // Char(22) of uppercase letters, digits and separators - lower case and spaces are not codes.
    expect(createAgencySchema.safeParse({ ...AGENCY, vendorPfCode: "kn/bng/0012345/000" }).success).toBe(false);
    expect(createAgencySchema.safeParse({ ...AGENCY, vendorEsiCode: "5300 0123 4500 01099" }).success).toBe(false);
  });

  it("requires the deployment terms the engagement is worked under", () => {
    for (const field of ["locationCode", "orgUnit", "scopeOfWork", "workerClass", "sanctionedCount", "rateCard"]) {
      const { [field]: _dropped, ...without } = CONTRACT as Record<string, unknown>;
      expect(createContractSchema.safeParse(without).success, field).toBe(false);
    }
    expect(createContractSchema.safeParse({ ...CONTRACT, scopeOfWork: "Housekeeping." }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...CONTRACT, rateCard: [] }).success).toBe(false);
    expect(createContractSchema.safeParse({ ...CONTRACT, workerClass: "gig" }).success).toBe(false);
  });

  it("defaults attendance capture on and the record to active", () => {
    const parsed = createContractSchema.parse(CONTRACT);
    expect(parsed.attendanceRequired).toBe(true);
    expect(parsed.status).toBe("active");
  });
});

describe("CTG-02 contractor invoice reconciliation", () => {
  it("requires the invoice identity, the claim lines and the remittance proof", () => {
    for (const field of ["invoiceNumber", "invoiceDate", "claimedDays", "vendorRemittanceRef"]) {
      const { [field]: _dropped, ...without } = INVOICE as Record<string, unknown>;
      expect(submitInvoiceSchema.safeParse(without).success, field).toBe(false);
    }
    expect(submitInvoiceSchema.parse(INVOICE).claimedOtHours).toBe(0);
  });

  it("refuses an invoice amount that does not equal its claimed lines", () => {
    expect(submitInvoiceSchema.safeParse({ ...INVOICE, billedMinor: 15000000 }).success).toBe(false);
    const split = [
      { skill: "Helper", days: 200, dailyRateMinor: 40_000, amountMinor: 8_000_000 },
      { skill: "Fitter", days: 144, dailyRateMinor: 50_000, amountMinor: 7_200_000 },
    ];
    expect(submitInvoiceSchema.safeParse({ ...INVOICE, claimedDays: split, billedMinor: 15_200_000 }).success).toBe(true);
  });

  it("holds the variance disposition vocabulary and what each leg must state", () => {
    const query = { varianceAction: "query", reason: "Gate log shows 12 fewer days than the invoice claims." };
    expect(disputeInvoiceSchema.safeParse(query).success).toBe(true);
    expect(disputeInvoiceSchema.safeParse({ ...query, reason: "Too short" }).success).toBe(false);
    expect(disputeInvoiceSchema.safeParse({ varianceAction: "reduce", reason: "Reduced" }).success).toBe(false);
    expect(disputeInvoiceSchema.safeParse({ varianceAction: "reduce", reason: "Reduced", approvedAmountMinor: 14_000_000 }).success).toBe(true);
    expect(disputeInvoiceSchema.safeParse({ varianceAction: "escalate", reason: "x" }).success).toBe(false);
    // The console's existing dispute payload is the query leg and keeps working.
    expect(disputeInvoiceSchema.parse({ reason: "Gate log shows 12 fewer days than claimed." }).varianceAction).toBe("query");
  });
});
