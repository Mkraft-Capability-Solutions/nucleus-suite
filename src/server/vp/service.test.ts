import { describe, expect, it } from "vitest";
import { vpCommandSchema } from "./service";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("VP command API contract", () => {
  it.each([
    { action: "save_rule_set", domain: "attendance", code: "default", effectiveFrom: "2026-09-12", config: { grace: 15 } },
    { action: "grant_location", membershipId: UUID, locationId: UUID, validFrom: "2026-09-12" },
    { action: "run_leave_maintenance", mode: "expiry", asOf: "2026-09-12" },
    { action: "create_gl_posting", payrollRunId: UUID },
    { action: "ack_gl_posting", batchId: UUID, acknowledgementRef: "ERP-ACK-1" },
    { action: "generate_statutory_form", formCode: "FORM_F", stateCode: "KA", period: "2026", values: { employee: "Maya" } },
    { action: "record_feature", kind: "asset", status: "allocated", data: { assetCode: "LT-1" } },
    { action: "approve_manpower", planYear: 2026, departmentId: UUID, designation: "Operator", sanctionedCount: 4 },
    { action: "controlled_requisition", manpowerLineId: UUID, title: "Operator", hiringManagerEmployeeId: UUID, positionCode: "OP-4", requisitionType: "addition" },
  ])("accepts $action", (command) => expect(vpCommandSchema.safeParse(command).success).toBe(true));

  it("rejects replacement requisitions with malformed identifiers", () => {
    expect(vpCommandSchema.safeParse({ action: "controlled_requisition", manpowerLineId: "x", title: "Operator", hiringManagerEmployeeId: UUID, positionCode: "OP-4", requisitionType: "replacement" }).success).toBe(false);
  });

  it("rejects unrecognized commands", () => expect(vpCommandSchema.safeParse({ action: "delete_everything" }).success).toBe(false));
});
