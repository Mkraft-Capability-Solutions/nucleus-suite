import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    // T-32: the establishment is required and no merge value is accepted from the caller.
    { action: "generate_statutory_form", formCode: "FORM_F", locationId: UUID, period: "2026" },
    { action: "retry_erp_record", recordId: UUID },
    { action: "abandon_erp_record", recordId: UUID, reason: "The ERP reissued this employee under a new code." },
    { action: "record_feature", kind: "asset", status: "allocated", data: { assetCode: "LT-1" } },
    { action: "approve_manpower", planYear: 2026, departmentId: UUID, designation: "Operator", sanctionedCount: 4 },
    { action: "controlled_requisition", manpowerLineId: UUID, title: "Operator", hiringManagerEmployeeId: UUID, positionCode: "OP-4", requisitionType: "addition" },
  ])("accepts $action", (command) => expect(vpCommandSchema.safeParse(command).success).toBe(true));

  it("rejects replacement requisitions with malformed identifiers", () => {
    expect(vpCommandSchema.safeParse({ action: "controlled_requisition", manpowerLineId: "x", title: "Operator", hiringManagerEmployeeId: UUID, positionCode: "OP-4", requisitionType: "replacement" }).success).toBe(false);
  });

  it("rejects unrecognized commands", () => expect(vpCommandSchema.safeParse({ action: "delete_everything" }).success).toBe(false));

  // T-32 expects "no figure is typed in": the establishment decides every value, so a
  // form raised against no establishment cannot be derived and is refused at the schema.
  it("requires an establishment on a statutory form", () => {
    expect(vpCommandSchema.safeParse({ action: "generate_statutory_form", formCode: "FORM_F", stateCode: "KA", period: "2026" }).success).toBe(false);
  });
});

describe("team history compensation scope (RL-24)", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/vp/service.ts"), "utf8");
  const body = source.slice(source.indexOf("export async function getTeamHistory"));

  // This endpoint returns basic_salary_minor. It once treated "no location grant" as
  // "every location", which handed raw salary to exactly the caller the employee screen
  // masks. Both defects were one clause each, so both are guarded by shape here.
  it("does not treat an absent grant as permission to see every location", () => {
    expect(body).not.toMatch(/grants\.length === 0 \|\|/);
    expect(body).toMatch(/grants\.length > 0 && grants\.every/);
  });

  it("never widens the location filter when the caller has no grants", () => {
    expect(body).not.toMatch(/locationIds\.length === 0/);
    expect(body).toMatch(/ea\.location_id = any\(\$\{locationIds\}\)/);
  });

  it("gates the compensation projection on the rate permission, as the employee screen does", () => {
    expect(body).toMatch(/requestedFields: \["compensation"\]/);
    expect(body).toMatch(/ratePermitted &&/);
  });
});
