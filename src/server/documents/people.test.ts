import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ tenantTx: vi.fn(), recompute: vi.fn(), allowed: new Set<string>() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const sqlClient = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }), { query: (text: string, values: unknown[]) => ({ text, values }) });
  return { sqlClient };
});
vi.mock("@/server/platform/access", () => ({ tenantTx: mocks.tenantTx, uuidOrNull: (value: string | null) => value }));
vi.mock("@/server/identity/authorization", () => ({ authorize: (_: unknown, request: { action: string }) => ({ allowed: mocks.allowed.has(request.action) }) }));
vi.mock("@/server/alerts/engine", () => ({ recomputeEmployeeAlerts: mocks.recompute }));

const people = await import("@/server/documents/people");
const signed = await import("@/lib/documents/signed-url");

const T = "00000000-0000-4000-8000-000000000001";
const E = "00000000-0000-4000-8000-0000000000e1";
const OTHER = "00000000-0000-4000-8000-0000000000e2";
const C = "00000000-0000-4000-8000-0000000000c1";
const G = "00000000-0000-4000-8000-0000000000a1";
const access = (employeeId: string | null = null) => ({ tenantId: T, context: { actorUserId: "00000000-0000-4000-8000-0000000000f1", membershipId: "m-1", tenantId: T, employeeId, permissions: [], roles: [] } }) as unknown as Access;
const PDF = Buffer.from("%PDF-1.4 test").toString("base64");
const SECRET = "x".repeat(40);

beforeEach(() => {
  mocks.tenantTx.mockReset(); mocks.recompute.mockReset(); mocks.allowed.clear();
  process.env[signed.SIGNING_SECRET_ENV] = SECRET;
});

describe("vault rules", () => {
  it("limits self reach to one's own folder", () => {
    expect(people.mayReach("all", null, E)).toBe(true);
    expect(people.mayReach("self", E, E)).toBe(true);
    expect(people.mayReach("self", E, OTHER)).toBe(false);
    expect(people.mayReach("self", null, E)).toBe(false);
    expect(people.mayReach(null, E, E)).toBe(false);
  });
  it("builds the scoped storage key", () => {
    expect(people.storageKey(G, C, E, "f")).toBe(`group/${G}/company/${C}/employees/${E}/f`);
  });
  it("accepts only PDF, PNG, JPEG and WebP by their bytes", () => {
    expect(people.checkVaultFile(new Uint8Array(Buffer.from("%PDF-1.7")), "a.pdf").mime).toBe("application/pdf");
    expect(() => people.checkVaultFile(new Uint8Array(Buffer.from("hello")), "a.txt")).toThrow(/PDF, PNG, JPEG or WebP/);
    expect(() => people.checkVaultFile(new Uint8Array(0), "a.pdf")).toThrow(/empty/);
    expect(() => people.checkVaultFile(new Uint8Array(10 * 1024 * 1024 + 1), "a.pdf")).toThrow(/10 MB/);
  });
  it("validates categories in the schema", () => {
    expect(people.vaultUploadSchema.safeParse({ category: "PASSPORT", fileName: "a.pdf", contentBase64: PDF }).success).toBe(true);
    expect(people.vaultUploadSchema.safeParse({ category: "AADHAAR", fileName: "a.pdf", contentBase64: PDF }).success).toBe(false);
  });
});

describe("signed links", () => {
  it("verifies signature and expiry", () => {
    const now = Date.UTC(2026, 0, 1);
    const { token } = signed.signToken({ t: T, d: "d", e: E, m: "view" }, SECRET, now);
    expect(signed.verifyToken(token, SECRET, now + 1000).ok).toBe(true);
    expect(signed.verifyToken(token, SECRET, now + 5 * 60 * 1000 + 1).reason).toBe("expired");
    expect(signed.verifyToken(token, "y".repeat(40), now).reason).toBe("signature");
    expect(signed.verifyToken(`${token.split(".")[0]}x.${token.split(".")[1]}`, SECRET, now).reason).toBe("signature");
    expect(signed.verifyToken("garbage", SECRET, now).reason).toBe("malformed");
  });
  it("fails fast without a secret", () => {
    expect(() => signed.signingSecret({})).toThrow(/DOCUMENT_URL_SIGNING_SECRET/);
    expect(() => signed.signingSecret({ DOCUMENT_URL_SIGNING_SECRET: "short" })).toThrow();
  });
  it("refuses a link from another tenant", async () => {
    const { token } = signed.signToken({ t: "00000000-0000-4000-8000-000000000999", d: "d", e: E, m: "view" }, SECRET);
    await expect(people.readSignedFile(access(), token)).rejects.toMatchObject({ status: 403 });
    expect(mocks.tenantTx).not.toHaveBeenCalled();
  });
  it("logs every issued link in the access log", async () => {
    mocks.allowed.add("document.read");
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "d", company_id: C }]]).mockResolvedValueOnce([[], []]);
    const link = await people.issueAccessLink(access(), E, "00000000-0000-4000-8000-0000000000d1", "download", "r");
    expect(link.url).toContain("/api/v1/documents/people/file?token=");
    const statements = mocks.tenantTx.mock.calls[1]![1] as Array<{ text: string; values: unknown[] }>;
    expect(statements[0]!.text).toContain("insert into document_access_log");
    expect(statements[0]!.values).toContain("download");
  });
});

describe("upload", () => {
  it("refuses a self user uploading to someone else", async () => {
    mocks.allowed.add("document.self.write");
    await expect(people.uploadEmployeeDocument(access(E), OTHER, { category: "VISA", fileName: "a.pdf", contentBase64: PDF }, "r")).rejects.toMatchObject({ status: 403 });
  });
  it("writes documents, version, vault row and audit in one transaction and recomputes alerts on expiry", async () => {
    mocks.allowed.add("document.write");
    mocks.tenantTx
      .mockResolvedValueOnce([[{ id: E, employee_code: "E1", name: "Asha Rao", company_id: C, company: "Acme" }]])
      .mockResolvedValueOnce([[{ id: G }], [{ id: "00000000-0000-4000-8000-0000000000b1" }], [], [{ name: "HR" }]])
      .mockResolvedValueOnce([]);
    const created = await people.uploadEmployeeDocument(access(), E, { category: "VISA", fileName: "visa.pdf", contentBase64: PDF, expiryDate: "2099-01-01" }, "r");
    const writes = mocks.tenantTx.mock.calls[2]![1] as Array<{ text: string; values: unknown[] }>;
    expect(writes.map((entry) => entry.text.match(/insert into (\w+)/)?.[1])).toEqual(["documents", "document_versions", "employee_documents", "audit_events"]);
    expect(String(writes[2]!.values.find((value) => typeof value === "string" && value.startsWith("group/")))).toMatch(new RegExp(`^group/${G}/company/${C}/employees/${E}/`));
    expect(mocks.recompute).toHaveBeenCalledWith(expect.anything(), E);
    expect(created.alertsRecomputed).toBe(true);
  });
  it("needs a company on the employee", async () => {
    mocks.allowed.add("document.write");
    mocks.tenantTx.mockResolvedValueOnce([[{ id: E, employee_code: "E1", name: "Asha", company_id: null, company: null }]]);
    await expect(people.uploadEmployeeDocument(access(), E, { category: "OTHER", fileName: "a.pdf", contentBase64: PDF }, "r")).rejects.toMatchObject({ status: 422 });
  });
});
