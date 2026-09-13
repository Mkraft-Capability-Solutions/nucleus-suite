import { describe, expect, it } from "vitest";
import { attachEvidenceSchema, createObligationSchema } from "@/server/compliance/service";
import { computeMciSchema, defineMetricSchema, MCI_WEIGHTS, snapshotMetricSchema } from "@/server/analytics/service";
import { assignWorkerSchema, createAgencySchema, createContractSchema, submitInvoiceSchema } from "@/server/contractors/service";
import { closeRightsCase, createHoldSchema, openRightsSchema } from "@/server/privacy/service";
import { connectSchema, createEndpointSchema } from "@/server/integrations/service";
import {
  decideReviewSchema,
  ingestKnowledgeSchema,
  proposeActionSchema,
  requestReviewSchema,
  startRunSchema,
  submitAiFeedbackSchema,
  ALLOWLISTED_TOOLS,
} from "@/server/ai/service";
import { auditQuerySchema } from "@/server/ops/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("compliance schemas (OC-P7-01)", () => {
  it("validates obligations and evidence links", () => {
    expect(createObligationSchema.safeParse({ title: "PF return", dueDate: "2026-09-15" }).success).toBe(true);
    expect(createObligationSchema.safeParse({ title: "", dueDate: "2026-09-15" }).success).toBe(false);
    expect(attachEvidenceSchema.safeParse({ calendarItemId: UUID, documentId: UUID }).success).toBe(true);
    expect(attachEvidenceSchema.safeParse({ calendarItemId: "nope", documentId: UUID }).success).toBe(false);
  });
});

describe("analytics schemas (OC-P7-02)", () => {
  it("pins MCI weights at 25/25/20/15/15", () => {
    expect({ ...MCI_WEIGHTS }).toEqual({ performance: 25, skills: 25, learning: 20, engagement: 15, tenure: 15 });
  });

  it("validates metric definitions, snapshots and MCI inputs", () => {
    expect(defineMetricSchema.safeParse({ code: "ATTR-90", name: "Attrition", definition: "90-day attrition" }).success).toBe(true);
    expect(snapshotMetricSchema.safeParse({ definitionCode: "ATTR-90", value: 6.8, cohortSize: 120 }).success).toBe(true);
    const mci = { employeeId: UUID, inputs: { performance: 80, skills: 70, learning: 90, engagement: 60, tenure: 50 } };
    expect(computeMciSchema.safeParse(mci).success).toBe(true);
    expect(computeMciSchema.safeParse({ ...mci, inputs: { ...mci.inputs, performance: 101 } }).success).toBe(false);
  });
});

describe("contractor and privacy schemas (OC-P7-04)", () => {
  it("validates agencies, contracts, invoices and assignments", () => {
    expect(createAgencySchema.safeParse({ name: "Shakti Staffing" }).success).toBe(true);
    const contract = { agencyId: UUID, code: "CTR-01", startsOn: "2026-04-01", endsOn: "2027-03-31", monthlyMinor: 10_000_000 };
    expect(createContractSchema.safeParse(contract).success).toBe(true);
    expect(createContractSchema.safeParse({ ...contract, endsOn: "2026-01-01" }).success).toBe(true);
    expect(submitInvoiceSchema.safeParse({ contractId: UUID, contractedMinor: 10_000_000, billedMinor: 10_500_000, period: "2026-09" }).success).toBe(true);
    expect(assignWorkerSchema.safeParse({ contractId: UUID, personName: "Raju", startsOn: "2026-09-01" }).success).toBe(true);
    expect(assignWorkerSchema.safeParse({ contractId: UUID, personName: "Raju" }).success).toBe(false);
  });

  it("validates rights cases and legal holds", () => {
    const rights = { kind: "erase", details: "Delete my data", identityProofRef: "kyc-9" };
    expect(openRightsSchema.safeParse(rights).success).toBe(true);
    expect(openRightsSchema.safeParse({ ...rights, kind: "sell" }).success).toBe(false);
    expect(createHoldSchema.safeParse({ reason: "Tribunal matter" }).success).toBe(true);
    expect(closeRightsCase).toBeTypeOf("function");
  });
});

describe("integration schemas (OC-P7-01/02)", () => {
  it("validates connections and webhook endpoints", () => {
    expect(connectSchema.safeParse({ catalogCode: "ERP", environment: "Sandbox" }).success).toBe(true);
    expect(connectSchema.safeParse({ catalogCode: "ERP", environment: "Live", verifiedRoundTrip: false }).success).toBe(true);
    expect(createEndpointSchema.safeParse({ url: "https://erp.example.test/hook", events: ["payroll.finalized"], secret: "sixteen-chars-min" }).success).toBe(true);
    expect(createEndpointSchema.safeParse({ url: "not-a-url", events: ["x"], secret: "sixteen-chars-min" }).success).toBe(false);
    expect(createEndpointSchema.safeParse({ url: "https://x.test", events: [], secret: "sixteen-chars-min" }).success).toBe(false);
  });
});

describe("AI platform schemas (OC-P8-01/02/04)", () => {
  it("keeps the tool allowlist narrow", () => {
    expect([...ALLOWLISTED_TOOLS]).toEqual(["policy.retrieve", "leave.read_balance", "attendance.read_day", "draft.prepare", "action.preview"]);
  });

  it("validates knowledge, runs, feedback, reviews and actions", () => {
    const knowledge = { title: "Leave policy", section: "Credits", text: "0123456789abcdef", keywords: ["leave", "credit"] };
    expect(ingestKnowledgeSchema.safeParse(knowledge).success).toBe(true);
    expect(ingestKnowledgeSchema.safeParse({ ...knowledge, text: "short" }).success).toBe(false);
    expect(startRunSchema.safeParse({ workflowCode: "policy-qa" }).success).toBe(true);
    expect(submitAiFeedbackSchema.safeParse({ runId: UUID, rating: "up" }).success).toBe(true);
    expect(submitAiFeedbackSchema.safeParse({ runId: UUID, rating: "meh" }).success).toBe(false);
    expect(requestReviewSchema.safeParse({ runId: UUID, summary: "Check this draft" }).success).toBe(true);
    expect(decideReviewSchema.safeParse({ decision: "accepted", comment: "Good" }).success).toBe(true);
    const action = { tool: "draft.prepare", effect: { kind: "draft", text: "hello" } };
    expect(proposeActionSchema.safeParse(action).success).toBe(true);
    expect(proposeActionSchema.safeParse({ tool: "", effect: {} }).success).toBe(false);
  });
});

describe("ops schemas (OC-P9-01/03)", () => {
  it("validates audit queries with safe defaults and a 100-row cap", () => {
    expect(auditQuerySchema.safeParse({}).data).toMatchObject({ page: 1, pageSize: 25 });
    expect(auditQuerySchema.safeParse({ pageSize: 100 }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });
});
