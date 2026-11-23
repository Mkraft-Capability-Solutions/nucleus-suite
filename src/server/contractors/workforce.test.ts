import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), checkIdempotency: vi.fn(), storeIdempotency: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const sqlClient = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }), {
    query: (text: string, values: unknown[]) => ({ text, values }),
  });
  return { sqlClient };
});
vi.mock("@/server/platform/access", () => ({
  enforce: mocks.enforce, tenantTx: mocks.tenantTx, checkIdempotency: mocks.checkIdempotency, storeIdempotency: mocks.storeIdempotency,
  uuidOrNull: (value: string) => (/^[0-9a-f-]{36}$/i.test(value) ? value : null),
}));

const { assignContractWorker, assignContractWorkerSchema, complianceFor, listContractWorkforce, projectWorker, restDaysFor } = await import("@/server/contractors/workforce");
const { createAgencyRecord, createAgencySchema, listAgencyMaster, projectAgency } = await import("@/server/contractors/agency-master");
const { idempotentWrite, parseBody } = await import("@/server/contractors/write-guard");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: null, permissions: [], roles: [] } } as unknown as Access;
const CONTRACT = "11111111-1111-4111-8111-111111111111";
const LOCATION = "22222222-2222-4222-8222-222222222222";
const valid = { contractId: CONTRACT, personName: "Asha Rao", category: "contract", role: "Fitter", dailyWage: 700, locationId: LOCATION, startsOn: "2026-11-01" };

beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

describe("contract worker schema", () => {
  it("has no fabricated defaults and validates statutory formats", () => {
    const parsed = assignContractWorkerSchema.parse(valid);
    expect(parsed.uan).toBeUndefined();
    expect(parsed.aadhaar).toBeUndefined();
    expect(assignContractWorkerSchema.safeParse({ ...valid, uan: "123" }).success).toBe(false);
    expect(assignContractWorkerSchema.safeParse({ ...valid, aadhaar: "12345678901" }).success).toBe(false);
    expect(assignContractWorkerSchema.safeParse({ ...valid, contractId: undefined }).success).toBe(false);
    expect(assignContractWorkerSchema.safeParse({ ...valid, dailyWage: 0 }).success).toBe(false);
  });

  it("derives rest days and KYC state from the record only", () => {
    expect(restDaysFor("third-party-employee")).toBe(true);
    expect(restDaysFor("contract")).toBe(false);
    expect(complianceFor(true, null)).toBe("verified");
    expect(complianceFor(undefined, "100000000001")).toBe("pending_verification");
    expect(complianceFor(undefined, null)).toBe("kyc_incomplete");
  });
});

describe("listContractWorkforce", () => {
  it("enforces employee.read, scopes by tenant and returns nulls instead of invented values", async () => {
    mocks.tenantTx.mockResolvedValue([[{ id: "a-1", contractor_contract_id: CONTRACT, attributes: {}, agency_id: null, agency_name: null, contract_code: null, location_name: null, currency: null, total: 1 }]]);
    const result = await listContractWorkforce(access, { page: 1, pageSize: 25, search: "fit" });
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.read", { tenantId: "t-1" });
    const statement = mocks.tenantTx.mock.calls[0][1][0] as { text: string; values: unknown[] };
    expect(statement.text).toContain("cwa.tenant_id = $1");
    expect(statement.values).toEqual(["t-1", "%fit%", 25, 0]);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ name: null, agencyName: null, uan: null, esicNumber: null, site: null, dailyWage: null, compliance: "kyc_incomplete" });
  });

  it("reads both the legacy and the canonical attribute names", () => {
    const view = projectWorker({ id: "a", contractor_contract_id: CONTRACT, attributes: { person_name: "Old", role: "Helper", vendor_name: "V", daily_wage: "650" }, agency_id: null, agency_name: null, contract_code: "C-1", location_name: null, currency: "INR", total: 1 });
    expect(view).toMatchObject({ name: "Old", trade: "Helper", agencyName: "V", dailyWage: 650, contractCode: "C-1" });
  });
});

describe("assignContractWorker", () => {
  it("requires employee.write and rejects an unknown contract without writing", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[], [{ id: LOCATION, name: "Plant 1" }]]);
    await expect(assignContractWorker(access, assignContractWorkerSchema.parse(valid), "req")).rejects.toMatchObject({ status: 422 });
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "t-1" });
    expect(mocks.tenantTx).toHaveBeenCalledTimes(1);
  });

  it("rejects a start date outside the contract period", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: CONTRACT, status: "active", starts_on: "2027-01-01", ends_on: "2027-12-31", agency_name: "A" }], [{ id: LOCATION, name: "Plant 1" }]]);
    await expect(assignContractWorker(access, assignContractWorkerSchema.parse(valid), "req")).rejects.toMatchObject({ status: 422, details: [{ field: "startsOn" }] });
  });

  it("writes the person, assignment and audit event, and keeps only the Aadhaar last four", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: CONTRACT, status: "active", starts_on: null, ends_on: null, agency_name: "Agency" }], [{ id: LOCATION, name: "Plant 1" }]]).mockResolvedValueOnce([]);
    const result = await assignContractWorker(access, assignContractWorkerSchema.parse({ ...valid, aadhaar: "123456789012" }), "req");
    const writes = mocks.tenantTx.mock.calls[1][1] as Array<{ values: unknown[] }>;
    expect(writes).toHaveLength(3);
    const attributes = JSON.parse(String(writes[1].values.find((value) => typeof value === "string" && value.startsWith("{"))));
    expect(attributes).toMatchObject({ worker_name: "Asha Rao", aadhaar_last4: "9012", site: "Plant 1", verified: false });
    expect(JSON.stringify(attributes)).not.toContain("123456789012");
    expect(result).toMatchObject({ agencyName: "Agency", site: "Plant 1", hasRestDays: false });
  });
});

describe("agency master", () => {
  it("lists agencies with null evidence when none is filed", async () => {
    mocks.tenantTx.mockResolvedValue([[{ id: "o-1", name: "Agency", code: null, licence_number: null, contract_count: "2", worker_count: "5", pf_status: null, pf_period: null, esic_status: "filed", esic_period: "2026-10" }]]);
    const rows = await listAgencyMaster(access);
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.read", { tenantId: "t-1" });
    expect(rows[0]).toMatchObject({ contractCount: 2, workerCount: 5, pfEvidence: { status: null }, esicEvidence: { status: "filed", period: "2026-10" } });
    expect(projectAgency({ id: "x" }).name).toBeNull();
  });

  it("rejects a duplicate name and audits a create", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "o-1" }]]);
    await expect(createAgencyRecord(access, createAgencySchema.parse({ name: "Agency" }), "req")).rejects.toMatchObject({ status: 409 });
    mocks.tenantTx.mockResolvedValueOnce([[]]).mockResolvedValueOnce([]);
    const created = await createAgencyRecord(access, createAgencySchema.parse({ name: "New Agency", pan: "abcde1234f" }), "req");
    expect(created.name).toBe("New Agency");
    expect(mocks.tenantTx.mock.calls[2][1]).toHaveLength(2);
    expect(createAgencySchema.safeParse({ name: "A", pan: "bad" }).success).toBe(false);
  });
});

describe("write guard", () => {
  it("maps zod issues to field errors", () => {
    expect(() => parseBody(createAgencySchema, {}, "bad")).toThrow(expect.objectContaining({ status: 400, details: [expect.objectContaining({ field: "name" })] }));
  });

  it("replays a stored key without writing and rejects a reused key with a different payload", async () => {
    const write = vi.fn().mockResolvedValue({ id: "new" });
    mocks.checkIdempotency.mockResolvedValueOnce({ outcome: "replay", responseLocator: "old" });
    expect(await idempotentWrite(access, "op", "k", { a: 1 }, write)).toEqual({ kind: "replayed", id: "old" });
    mocks.checkIdempotency.mockResolvedValueOnce({ outcome: "conflict", responseLocator: null });
    await expect(idempotentWrite(access, "op", "k", { a: 2 }, write)).rejects.toMatchObject({ status: 409 });
    mocks.checkIdempotency.mockResolvedValueOnce({ outcome: "accept", responseLocator: null });
    expect(await idempotentWrite(access, "op", "k2", { a: 1 }, write)).toEqual({ kind: "written", id: "new", result: { id: "new" } });
    expect(write).toHaveBeenCalledTimes(1);
    expect(mocks.storeIdempotency).toHaveBeenCalledWith(access, "op", "k2", expect.any(String), 201, "new");
  });
});
