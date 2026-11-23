import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }) }));
vi.mock("@/server/platform/access", () => ({
  enforce: mocks.enforce,
  tenantTx: mocks.tenantTx,
  uuidOrNull: (value: string | null | undefined) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : null),
}));

const { raiseRequisition, raiseRequisitionSchema } = await import("./requisition-raise");
const { referralIntakeSchema, submitReferral } = await import("./referral-intake");
const { assertNoStageChange, updateCandidateRecord, updateCandidateSchema } = await import("./candidate-record");

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: UUID, permissions: [], roles: [] } } as unknown as Access;
const addition = { title: "Weaving supervisor", departmentId: UUID, designation: "Supervisor", requisitionType: "addition", hiringManagerEmployeeId: UUID, ctcMaxMinor: 90000000 };

type Statement = { text: string; values: unknown[] };
const statementsOf = (call: number) => mocks.tenantTx.mock.calls[call]?.[1] as Statement[];

beforeEach(() => {
  mocks.enforce.mockReset();
  mocks.tenantTx.mockReset();
});

describe("raise requisition", () => {
  it("requires the fields the establishment gate reads", () => {
    expect(raiseRequisitionSchema.safeParse(addition).success).toBe(true);
    expect(raiseRequisitionSchema.safeParse({ ...addition, designation: "" }).success).toBe(false);
    expect(raiseRequisitionSchema.safeParse({ ...addition, requisitionType: "replacement" }).success).toBe(false);
    expect(raiseRequisitionSchema.safeParse({ ...addition, overrideRequested: true, overrideReason: "too short" }).success).toBe(false);
    expect(raiseRequisitionSchema.safeParse({ ...addition, ctcMaxMinor: 0 }).success).toBe(false);
  });

  it("refuses an unknown hiring manager instead of picking someone", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: UUID }], [], [], [], [], [{ total: 0 }]]);
    await expect(raiseRequisition(access, raiseRequisitionSchema.parse(addition), "req-1")).rejects.toMatchObject({ status: 422 });
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "t-1" });
    expect(mocks.tenantTx).toHaveBeenCalledTimes(1);
  });

  it("writes the TAL-01 terms and an audit row", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: UUID }], [{ id: UUID }], [], [], [], [{ total: 4 }]]).mockResolvedValueOnce([[], []]);
    const result = await raiseRequisition(access, raiseRequisitionSchema.parse(addition), "req-1");
    expect(result.code).toMatch(/^REQ-\d{4}-005$/);
    const [insert, auditRow] = statementsOf(1);
    const attributes = JSON.parse(String(insert?.values.at(-1)));
    expect(attributes).toMatchObject({ requisition_type: "addition", designation: "Supervisor", positions: 1, ctc_max_minor: 90000000, status: "draft" });
    expect(auditRow?.text).toContain("audit_events");
  });
});

describe("referral intake", () => {
  const referral = { candidateName: "Sanya Kapoor", requisitionId: UUID };

  it("writes no fabricated score, skills or bonus", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ employee_id: UUID }], [{ id: UUID, status: "draft" }], []]).mockResolvedValueOnce([]);
    const result = await submitReferral(access, referralIntakeSchema.parse(referral), "req-1");
    expect(result.applicationId).not.toBeNull();
    const written = statementsOf(1).map((statement) => statement.values.map(String).join(" ")).join(" ");
    expect(written).not.toMatch(/matchScore|biasScore|skills|bonus|25,000/);
    expect(statementsOf(1).some((statement) => statement.text.includes("into applications"))).toBe(true);
  });

  it("requires a linked employee and refuses duplicates", async () => {
    const unlinked = { ...access, context: { ...access.context, employeeId: null } } as Access;
    mocks.tenantTx.mockResolvedValueOnce([[], [{ id: UUID, status: "draft" }], []]);
    await expect(submitReferral(unlinked, referralIntakeSchema.parse(referral), "req-1")).rejects.toMatchObject({ status: 403 });
    mocks.tenantTx.mockResolvedValueOnce([[{ employee_id: UUID }], [{ id: UUID, status: "draft" }], [{ id: "ref-1" }]]);
    await expect(submitReferral(access, referralIntakeSchema.parse(referral), "req-1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("candidate record", () => {
  it("refuses stage edits and returns 404 for an unknown candidate", async () => {
    expect(() => assertNoStageChange({ stage: "offer" })).toThrow(/advance/);
    expect(updateCandidateSchema.safeParse({ matchScore: 92 }).success).toBe(false);
    mocks.tenantTx.mockResolvedValueOnce([[]]);
    await expect(updateCandidateRecord(access, UUID, { name: "Sanya" }, "req-1")).rejects.toMatchObject({ status: 404 });
  });
});
