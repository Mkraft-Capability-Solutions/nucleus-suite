import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tenantTx: vi.fn(), listLibrary: vi.fn(), getCareer: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const sqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values });
  sqlClient.query = (text: string, values: unknown[]) => ({ text, values });
  return { sqlClient };
});
vi.mock("@/server/platform/access", () => ({ tenantTx: mocks.tenantTx }));
vi.mock("@/server/documents/library", () => ({ listLibrary: mocks.listLibrary }));
vi.mock("@/server/organization/job-history", () => ({ getCareer: mocks.getCareer }));
vi.mock("@/server/ai/nucleus/app-knowledge", () => ({ resolveScreen: () => null }));

import {
  documentStatus, employeeLookup, expiringVisas, maskIdentifier, movementHistory, pickColumn, resolveActiveCompany,
} from "@/server/ai/nucleus/people-tools";
import type { Access } from "@/server/platform/access";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SELF = "22222222-2222-4222-8222-222222222222";
const COMPANY = "33333333-3333-4333-8333-333333333333";

function access(permissions: string[], employeeId: string | null = SELF): Access {
  return { tenantId: TENANT, context: { actorUserId: "u", membershipId: "m", tenantId: TENANT, employeeId, permissions, roles: ["employee"] } };
}

type Stmt = { text: string; values: unknown[] };
const columns = (list: Array<[string, string]>) => list.map(([table_name, column_name]) => ({ table_name, column_name }));
const person = { id: SELF, employee_code: "E1", name: "Asha Rao", designation: "Engineer", department: "R&D", location: "BLR", status: "active",
  joining_date: "2024-01-01", work_email: null, company_id: COMPANY, company_name: "Acme India", manager_name: null };

beforeEach(() => vi.clearAllMocks());

describe("pure helpers", () => {
  it("picks only candidate columns that exist", () => {
    expect(pickColumn(new Set(["visa_expiry", "x"]), ["visa_expiry_date", "visa_expiry"] as const)).toBe("visa_expiry");
    expect(pickColumn(new Set(["x"]), ["visa_expiry"] as const)).toBeNull();
  });
  it("masks all but the last four characters", () => {
    expect(maskIdentifier("P1234567")).toBe("••••4567");
    expect(maskIdentifier("12")).toBe("••••");
    expect(maskIdentifier(null)).toBeNull();
  });
});

describe("employee_lookup", () => {
  it("filters by tenant and validated company, and masks visa numbers without permission", async () => {
    mocks.tenantTx
      .mockResolvedValueOnce([columns([["employees", "legal_entity_id"], ["employees", "visa_number"], ["employees", "visa_expiry_date"]])])
      .mockResolvedValueOnce([[{ ...person, visa_number: "V9876543", visa_expiry: "2026-12-01" }]]);
    const result = await employeeLookup(access(["employee.read"]), "Asha", { companyId: COMPANY });
    const stmt = mocks.tenantTx.mock.calls[1][1][0] as Stmt;
    expect(stmt.values[0]).toBe(TENANT);
    expect(stmt.values[1]).toBeNull();
    expect(stmt.values[2]).toBe(COMPANY);
    expect(stmt.text).toContain("e.legal_entity_id = $3::uuid");
    expect(result.matches[0].visa).toMatchObject({ number: "••••6543", masked: true, expiresOn: "2026-12-01" });
    expect(result.actions[0]).toMatchObject({ tab: "people_core", sub: "core_people" });
  });

  it("shows the visa number to compliance readers", async () => {
    mocks.tenantTx
      .mockResolvedValueOnce([columns([["employees", "visa_number"]])])
      .mockResolvedValueOnce([[{ ...person, visa_number: "V9876543" }]]);
    const result = await employeeLookup(access(["employee.read", "compliance.read"]), "E1");
    expect(result.matches[0].visa).toMatchObject({ number: "V9876543", masked: false });
  });

  it("restricts a caller without employee.read to their own record", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    await employeeLookup(access([]), "Someone");
    const stmt = mocks.tenantTx.mock.calls[1][1][0] as Stmt;
    expect(stmt.values[1]).toBe(SELF);
    expect(stmt.text).not.toContain("legal_entity_id");
  });

  it("forbids a caller with neither employee.read nor a linked record", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]);
    await expect(employeeLookup(access([], null), "x")).rejects.toMatchObject({ status: 403 });
  });

  it("reports visa details as not recorded before the visa columns exist", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[person]]);
    const result = await employeeLookup(access(["employee.read"]), "Asha");
    expect(result.matches[0].visa).toMatchObject({ available: false });
  });
});

describe("expiring_visas", () => {
  it("is honestly unavailable when no source table or column exists", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]);
    const result = await expiringVisas(access(["employee.read"]), 30);
    expect(result.expiring).toMatchObject({ available: false });
    expect(mocks.tenantTx).toHaveBeenCalledTimes(1);
  });

  it("merges employee columns and compliance alerts, scoped and masked", async () => {
    mocks.tenantTx
      .mockResolvedValueOnce([columns([
        ["employees", "legal_entity_id"], ["employees", "visa_number"], ["employees", "visa_expiry_date"],
        ["compliance_alerts", "tenant_id"], ["compliance_alerts", "employee_id"], ["compliance_alerts", "due_date"], ["compliance_alerts", "alert_type"],
      ])])
      .mockResolvedValueOnce([
        [{ employee_id: SELF, employee_code: "E1", name: "Asha Rao", company: "Acme", kind: "visa", number: "V9876543", expires_on: "2026-12-10", days_left: 17 }],
        [{ employee_id: SELF, employee_code: "E1", name: "Asha Rao", company: "Acme", kind: "visa", number: null, expires_on: "2026-12-10", days_left: 17 },
         { employee_id: "x", employee_code: "E2", name: "B", company: "Acme", kind: "work_permit", number: null, expires_on: "2026-11-30", days_left: 7 }],
      ]);
    const result = await expiringVisas(access(["employee.read"]), 30, { companyId: COMPANY });
    const statements = mocks.tenantTx.mock.calls[1][1] as Stmt[];
    expect(statements).toHaveLength(2);
    for (const stmt of statements) expect(stmt.values).toEqual([TENANT, null, COMPANY, 30]);
    expect(result.count).toBe(2);
    if (!("value" in result.expiring) || !result.expiring.value) throw new Error("expected rows");
    expect(result.expiring.value[0].employeeCode).toBe("E2");
    expect(result.expiring.value[1].number).toBe("••••6543");
  });
});

describe("movement_history", () => {
  it("falls back to job history and keeps only intra-group moves", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[person]]);
    mocks.getCareer.mockResolvedValueOnce({ entries: [
      { movementType: "group_transfer", effectiveFrom: "2025-04-01", companyName: "Acme UAE", location: null, department: null, designation: null, reason: "Project" },
      { movementType: "promotion", effectiveFrom: "2025-01-01", companyName: "Acme India", location: null, department: null, designation: null, reason: null },
    ] });
    const result = await movementHistory(access(["employee.read"]), "E1");
    if (!("movements" in result)) throw new Error("expected movements");
    expect(result.movements.value).toHaveLength(1);
    expect(result.movements.origin).toBe("employee_job_history");
  });

  it("returns candidates instead of choosing when several employees match", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[person, { ...person, id: "b", employee_code: "E2" }]]);
    const result = await movementHistory(access(["employee.read"]), "Asha");
    expect(result).toMatchObject({ ambiguous: true });
    expect(mocks.getCareer).not.toHaveBeenCalled();
  });

  it("404s when nobody in scope matches", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    await expect(movementHistory(access(["employee.read"]), "ghost")).rejects.toMatchObject({ status: 404 });
  });
});

describe("document_status", () => {
  it("reads through the document library rules and finds the nearest expiry", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[person]]);
    mocks.listLibrary.mockResolvedValueOnce({ truncated: false, documents: [
      { title: "Passport", type: "ID", verification: "verified", issuedOn: null, expiresOn: "2027-01-01" },
      { title: "Visa", type: "ID", verification: "verified", issuedOn: null, expiresOn: "2026-12-01" },
      { title: "Old permit", type: "ID", verification: "verified", issuedOn: null, expiresOn: "2025-01-01" },
    ] });
    const result = await documentStatus(access(["employee.read", "document.read"]), "E1", {}, "2026-11-23");
    expect(mocks.listLibrary).toHaveBeenCalledWith(expect.anything(), { employee: SELF });
    expect(result).toMatchObject({ total: 3, expired: 1, nearestExpiry: { title: "Visa", expiresOn: "2026-12-01" } });
  });
});

describe("resolveActiveCompany", () => {
  it("rejects a company outside the caller's tenant", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]);
    await expect(resolveActiveCompany(access(["employee.read"]), COMPANY)).rejects.toMatchObject({ status: 404 });
    const stmt = mocks.tenantTx.mock.calls[0][1][0] as Stmt;
    expect(stmt.values).toEqual([TENANT, COMPANY]);
  });
  it("accepts an owned company and ignores an absent one", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: COMPANY }]]);
    await expect(resolveActiveCompany(access(["employee.read"]), COMPANY)).resolves.toBe(COMPANY);
    await expect(resolveActiveCompany(access(["employee.read"]), null)).resolves.toBeNull();
    await expect(resolveActiveCompany(access(["employee.read"]), "nope")).rejects.toMatchObject({ status: 400 });
  });
});
