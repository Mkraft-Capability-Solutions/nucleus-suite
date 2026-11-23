import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: () => ({}) }));
vi.mock("@/server/platform/access", () => ({ enforce: vi.fn(), tenantTx: vi.fn(), uuidOrNull: (value: string) => value }));

const policy = await import("@/server/engagement/policy-documents");

const base = { title: "Leave policy", category: "general", versionTag: "v1", effectiveFrom: "2026-01-01", fileName: "p.pdf", mimeType: "application/pdf", contentBase64: "JVBERi0=" };

describe("policy documents", () => {
  it("detects the PDF signature", () => {
    expect(policy.isPdf(Buffer.from("%PDF-1.7 rest"))).toBe(true);
    expect(policy.isPdf(Buffer.from("PK\u0003\u0004zip"))).toBe(false);
    expect(policy.isPdf(Buffer.from("%PD"))).toBe(false);
  });

  it("accepts only PDF uploads with a valid code", () => {
    expect(policy.uploadPolicySchema.safeParse(base).success).toBe(true);
    expect(policy.uploadPolicySchema.safeParse({ ...base, mimeType: "image/png" }).success).toBe(false);
    expect(policy.uploadPolicySchema.safeParse({ ...base, code: "a" }).success).toBe(false);
  });

  it("caps uploads at 10 MB", () => {
    expect(policy.MAX_POLICY_BYTES).toBe(10 * 1024 * 1024);
  });
});
