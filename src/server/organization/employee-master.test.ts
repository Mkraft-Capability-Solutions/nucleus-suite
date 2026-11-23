import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), recompute: vi.fn(), authorize: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }) }));
vi.mock("@/server/platform/access", () => ({
  enforce: mocks.enforce, tenantTx: mocks.tenantTx,
  uuidOrNull: (value: string) => (/^[0-9a-f-]{36}$/i.test(value) ? value : null),
}));
vi.mock("@/server/alerts/recompute-hook", () => ({ onEmployeeAlertSourcesChanged: mocks.recompute }));
vi.mock("@/server/identity/authorization", () => ({ authorize: mocks.authorize }));

process.env.HRMS_FIELD_ENCRYPTION_KEY = "a".repeat(64);
const { patchEmployeeMasterSchema } = await import("@/lib/employee-master/contract");
const { buildEmployeeUpdate, patchEmployeeMaster, projectMaster, validatePatch, listCustomFieldDefinitions } = await import("@/server/organization/employee-master");
const { encryptToBytes } = await import("@/server/workflows/field-encryption");

const ID = "11111111-1111-1111-1111-111111111111";
const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", permissions: [], roles: [] } } as unknown as Access;

const baseRow = {
  id: ID, version: 3, employee_code: "E-1", first_name: "Asha", last_name: "Rao", work_email: null, designation: "Analyst", department: "Finance", location: "Pune",
  status: "active", joining_date: "2024-01-01", legal_entity_id: null, currency: "INR", base_currency: null, payroll_currency: null, fx_rate_override: null,
  is_expatriate: false, home_country: null, host_country: null, tax_residency_country: null, sponsor_entity_id: null, visa_type: null, visa_number_ciphertext: null,
  visa_number_last4: null, visa_issuing_country: null, visa_issue_date: null, visa_expiry_date: null, visa_entry_type: null, work_permit_number: null, work_permit_expiry_date: null,
};
const defs = [
  { id: "d-1", key: "blood_bank_donor", label: "Donor", type: "BOOLEAN" as const, required: false, options: [], sortOrder: 1 },
  { id: "d-2", key: "shirt_size", label: "Shirt", type: "SELECT" as const, required: true, options: ["S", "M"], sortOrder: 2 },
];

beforeEach(() => { vi.clearAllMocks(); mocks.authorize.mockReturnValue({ allowed: false }); });

describe("employee master validation", () => {
  it("requires host country and visa fields for an expatriate", () => {
    const input = patchEmployeeMasterSchema.parse({ visa: { isExpatriate: true } });
    expect(() => validatePatch(baseRow, input, [])).toThrow(expect.objectContaining({ status: 422 }));
    try { validatePatch(baseRow, input, []); } catch (error) {
      const fields = (error as { details: Array<{ field: string }> }).details.map((d) => d.field);
      expect(fields).toEqual(expect.arrayContaining(["visa.hostCountry", "visa.visaType", "visa.visaNumber", "visa.visaIssuingCountry", "visa.visaExpiryDate"]));
    }
  });

  it("rejects an expiry date that is not after the issue date", () => {
    const input = patchEmployeeMasterSchema.parse({ visa: { visaIssueDate: "2025-05-01", visaExpiryDate: "2025-05-01" } });
    expect(() => validatePatch(baseRow, input, [])).toThrow(expect.objectContaining({ status: 422 }));
  });

  it("rejects bad ISO codes at the schema", () => {
    expect(patchEmployeeMasterSchema.safeParse({ currency: { baseCurrency: "RUPEE" } }).success).toBe(false);
    expect(patchEmployeeMasterSchema.safeParse({ visa: { hostCountry: "IND" } }).success).toBe(false);
    expect(patchEmployeeMasterSchema.parse({ currency: { baseCurrency: "usd" } }).currency?.baseCurrency).toBe("USD");
  });

  it("types custom values and rejects unknown keys and invalid options", () => {
    const ok = validatePatch(baseRow, patchEmployeeMasterSchema.parse({ customFields: { blood_bank_donor: true, shirt_size: "M" } }), defs);
    expect(ok.map((w) => w.value)).toEqual([true, "M"]);
    expect(() => validatePatch(baseRow, patchEmployeeMasterSchema.parse({ customFields: { shirt_size: "XL" } }), defs)).toThrow(expect.objectContaining({ status: 422 }));
    expect(() => validatePatch(baseRow, patchEmployeeMasterSchema.parse({ customFields: { nope: "x" } }), defs)).toThrow(expect.objectContaining({ status: 422 }));
  });
});

describe("visa number protection", () => {
  const cipherRow = { ...baseRow, visa_number_ciphertext: encryptToBytes("P1234567", `employee-visa:t-1:${ID}`), visa_number_last4: "4567" };

  it("shows only last4 without employee.visa.read / employee.write", () => {
    const view = projectMaster(access, cipherRow, [], []);
    expect(view.visa.visaNumber).toBeNull();
    expect(view.visa.visaNumberLast4).toBe("4567");
    expect(view.visa.visaNumberMasked).toBe(true);
  });

  it("decrypts for a permitted caller", () => {
    mocks.authorize.mockReturnValue({ allowed: true });
    expect(projectMaster(access, cipherRow, [], []).visa.visaNumber).toBe("P1234567");
  });

  it("never puts the plain visa number in the update SQL", () => {
    const update = buildEmployeeUpdate("t-1", ID, patchEmployeeMasterSchema.parse({ visa: { visaNumber: "P1234567", visaType: "Work" } }), { bytes: Buffer.from([1]), last4: "4567" });
    expect(update.values).not.toContain("P1234567");
    expect(update.text).toMatch(/visa_type = \$1, visa_number_ciphertext = \$2, visa_number_last4 = \$3/);
    expect(update.text).toMatch(/where tenant_id = \$4 and id = \$5/);
  });
});

describe("patchEmployeeMaster", () => {
  it("writes employee, custom values, audit and outbox in one transaction and triggers alert recompute", async () => {
    mocks.tenantTx
      .mockResolvedValueOnce([[baseRow], [{ id: "d-1", field_key: "blood_bank_donor", label: "Donor", field_type: "BOOLEAN", is_required: false, options: [], sort_order: 1 }], []])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ ...baseRow, version: 4 }], [], []]);
    await patchEmployeeMaster(access, ID, patchEmployeeMasterSchema.parse({ version: 3, visa: { visaExpiryDate: "2030-01-01" }, customFields: { blood_bank_donor: true } }), "req");
    const write = mocks.tenantTx.mock.calls[1][1] as Array<{ text: string }>;
    expect(write.map((s) => s.text).join(" ")).toMatch(/update employees[\s\S]*custom_field_values[\s\S]*audit_events[\s\S]*transactional_outbox/);
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "t-1" });
    expect(mocks.recompute).toHaveBeenCalledWith(access, ID);
  });

  it("returns 409 on a stale version", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[baseRow], [], []]);
    await expect(patchEmployeeMaster(access, ID, { version: 2 }, "req")).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a sponsor entity outside the tenant", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[baseRow], [], []]);
    await expect(patchEmployeeMaster(access, ID, patchEmployeeMasterSchema.parse({ visa: { sponsorEntityId: "22222222-2222-4222-8222-222222222222" } }), "req")).rejects.toMatchObject({ status: 422 });
  });
});

describe("custom field definitions", () => {
  it("only serves EMPLOYEE_MASTER", async () => {
    await expect(listCustomFieldDefinitions(access, "PAYROLL")).rejects.toMatchObject({ status: 400 });
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "d", field_key: "k", label: "K", field_type: "WEIRD", is_required: false, options: [], sort_order: 0 }]]);
    expect(await listCustomFieldDefinitions(access, "EMPLOYEE_MASTER")).toEqual([]);
  });
});
