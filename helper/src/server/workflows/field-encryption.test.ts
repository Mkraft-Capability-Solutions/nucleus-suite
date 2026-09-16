import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptFields, decryptFields } from "./field-encryption";
afterEach(() => vi.unstubAllEnvs());
describe("protected dossier storage", () => {
  it("encrypts and authenticates fields against tenant, resource and record", () => {
    vi.stubEnv("HRMS_FIELD_ENCRYPTION_KEY", "ab".repeat(32));
    const fields = { accountNumber: "123456789", bankName: "Test bank" };
    const encrypted = encryptFields(fields, "tenant-a:bank:record-a");
    expect(JSON.stringify(encrypted)).not.toContain(fields.accountNumber);
    expect(decryptFields(encrypted, "tenant-a:bank:record-a")).toEqual(fields);
    expect(() => decryptFields(encrypted, "tenant-b:bank:record-a")).toThrow();
    expect(() => decryptFields({ ...encrypted, tag: "AA==" }, "tenant-a:bank:record-a")).toThrow();
  });
  it("fails closed without a key or with legacy plaintext", () => {
    vi.stubEnv("HRMS_FIELD_ENCRYPTION_KEY", "");
    expect(() => encryptFields({ value: "secret" }, "context")).toThrow();
    expect(() => decryptFields({ accountNumber: "123" }, "context")).toThrow();
  });
});
