import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { issueLetterSchema } from "./service";

/** FRM-EXP-01 field rules that hold without a database. */
describe("issueLetterSchema (FRM-EXP-01)", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  const base = {
    letterType: "experience",
    templateId: uuid,
    employeeId: uuid,
    effectiveDate: "2026-09-30",
    approver: "R. Iyer",
    reason: "Requested for a visa application",
  };

  it("defaults delivery to email plus the portal and requires acknowledgement", () => {
    const parsed = issueLetterSchema.parse(base);
    expect(parsed.deliveryChannels).toEqual(["email", "employee_portal"]);
    expect(parsed.acknowledgementRequired).toBe(true);
  });

  it("takes the letter type and channels from the workbook vocabularies", () => {
    expect(issueLetterSchema.safeParse({ ...base, letterType: "congratulations" }).success).toBe(false);
    expect(issueLetterSchema.safeParse({ ...base, deliveryChannels: ["whatsapp", "printed_copy"] }).success).toBe(true);
    expect(issueLetterSchema.safeParse({ ...base, deliveryChannels: ["carrier_pigeon"] }).success).toBe(false);
    expect(issueLetterSchema.safeParse({ ...base, deliveryChannels: [] }).success).toBe(false);
  });

  it("requires a reason to reprint", () => {
    expect(issueLetterSchema.safeParse({ ...base, reprintOfLetterId: uuid }).success).toBe(false);
    expect(issueLetterSchema.safeParse({ ...base, reprintOfLetterId: uuid, reprintReason: "Lost" }).success).toBe(false);
    expect(issueLetterSchema.safeParse({ ...base, reprintOfLetterId: uuid, reprintReason: "Original lost in transit" }).success).toBe(true);
  });

  it("accepts manual merge values as named fields", () => {
    expect(issueLetterSchema.safeParse({ ...base, manualFields: { project_name: "Line 3 upgrade" } }).success).toBe(true);
  });
});

describe("issued letters are vault documents", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/letters/service.ts"), "utf8");
  const issue = source.slice(source.indexOf("export async function issueLetter"));

  // generated_letters.document_id is NOT NULL on the live schema (migrations 0008/0009).
  // The insert once omitted it, and nothing but a live issue would have shown that.
  it("writes the rendered letter as a document and links it on the issue row", () => {
    expect(issue).toMatch(/insert into documents \(id, tenant_id, document_type_id, employee_id, attributes\)/);
    expect(issue).toMatch(/insert into document_versions \(tenant_id, document_id, attributes\)/);
    expect(issue).toMatch(/insert into generated_letters \(id, tenant_id, letter_template_id, employee_id, document_id, attributes\)/);
    expect(issue).toMatch(/return \{ id, reference, documentId \}/);
  });
});
