import { describe, expect, it } from "vitest";
import { confirmationBlockers, confirmEmploymentSchema } from "./service";

/** The standard template's shape: `required` gates Day-1, `blocksConfirmation` gates confirmation. */
const STANDARD = [
  { key: "documents", required: true },
  { key: "induction", required: true, blocksConfirmation: true },
  { key: "assets", required: true, blocksConfirmation: true },
  { key: "tour", required: false },
];

describe("confirmationBlockers (R-24)", () => {
  it("takes the items the template marks as blocking confirmation", () => {
    expect(confirmationBlockers(STANDARD).map((task) => task.key)).toEqual(["induction", "assets"]);
  });

  it("falls back to the required items for a template that predates the setting", () => {
    const legacy = [{ key: "documents", required: true }, { key: "tour", required: false }];
    expect(confirmationBlockers(legacy).map((task) => task.key)).toEqual(["documents"]);
  });

  it("never lets a template that blocks nothing confirm unconditionally by accident", () => {
    // Every item optional and none marked: there is genuinely nothing to gate on, which is
    // a template the tenant has deliberately left open rather than a silent bypass.
    expect(confirmationBlockers([{ key: "tour", required: false }])).toEqual([]);
  });
});

describe("confirmEmploymentSchema", () => {
  it("requires a reason long enough to explain the decision", () => {
    const parsed = confirmEmploymentSchema.safeParse({
      employeeId: "0b3f3d3a-6b6f-4f0b-9f4e-2f9b8c1d7e11",
      confirmationDate: "2026-04-01",
      reason: "too short",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a dated, reasoned confirmation", () => {
    const parsed = confirmEmploymentSchema.safeParse({
      employeeId: "0b3f3d3a-6b6f-4f0b-9f4e-2f9b8c1d7e11",
      confirmationDate: "2026-04-01",
      reason: "Probation completed and induction signed off by the plant HR lead.",
    });
    expect(parsed.success).toBe(true);
  });
});
