import { describe, expect, it } from "vitest";
import { OPERATIONAL_MODULES, createModuleRecordSchema } from "@/server/ops/modules-service";

describe("operational modules service", () => {
  it("registers all 17 critical operational modules with valid screenId and tables", () => {
    const requiredModules = [
      "document_vault",
      "attendance_detail",
      "overtime_register",
      "attendance_exceptions",
      "leave_policy_admin",
      "tax_declarations",
      "bank_disbursement",
      "rule_pack_manager",
      "golden_case_library",
      "gl_mapping",
      "reconciliation",
      "clearance_board",
      "asset_register",
      "letters_register",
      "check_in_out",
      "my_attendance",
      "full_and_final",
    ];

    for (const modId of requiredModules) {
      const config = OPERATIONAL_MODULES[modId];
      expect(config).toBeDefined();
      expect(config.screenId).toMatch(/^SCR-\d{3}$/);
      expect(config.table).toBeTruthy();
      expect(config.permission).toBeTruthy();
      expect(config.auditAction).toBeTruthy();
    }
  });

  it("validates dynamic record payloads with createModuleRecordSchema", () => {
    const valid = {
      employee: "EMP-101",
      documentType: "Passport",
      issuedOn: "2024-01-01",
      expiresOn: "2034-01-01",
    };
    expect(createModuleRecordSchema.safeParse(valid).success).toBe(true);
    expect(createModuleRecordSchema.safeParse("not an object").success).toBe(false);
  });
});
