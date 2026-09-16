import { describe, expect, it } from "vitest";
import { normalizeValue, permitted, unwrapRecords, workflowOperations, workflowSections } from "./workflow-catalog";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("workflow form contracts", () => {
  it("omits optional empty fields and converts nested amounts without losing zero", () => {
    const schema = { kind: "object", fields: [{ name: "reason", kind: "text", optional: true }, { name: "lines", kind: "array", item: { kind: "object", fields: [{ name: "amountMinor", kind: "number", integer: true }] } }] };
    expect(normalizeValue(schema, { reason: "", lines: [{ amountMinor: "0" }] })).toEqual({ lines: [{ amountMinor: 0 }] });
    expect(() => normalizeValue({ kind: "number", integer: true }, "1.5")).toThrow("whole number");
    expect(() => normalizeValue({ kind: "number" }, "")).toThrow("required");
  });
  it("flattens collection attributes while preserving record identity", () => {
    expect(unwrapRecords({ data: [{ id: "a", version: 2, attributes: { name: "Course" } }] })[0]).toMatchObject({ id: "a", version: 2, name: "Course" });
    expect(unwrapRecords({ data: { departments: [{ id: "a" }], positions: [{ id: "b" }] } })).toHaveLength(2);
  });
  it("hides scheduled actions and payroll processing from insufficient permissions", () => {
    const op = workflowOperations.find(o => o.method === "POST" && o.path === "/api/v1/ops/scheduled-tasks")!;
    expect(op.permissions).toContain("tenant.manage");
    expect(permitted(op, ["employee.read"])).toBe(false);
    // Payslips are deliberately self-service: payslips.ts documents that a caller without
    // `payroll.read` sees only the payslips of the employee their membership is linked to.
    // Everything that runs or corrects payroll stays behind a permission.
    const visible = workflowSections("payroll", ["employee.read"]);
    expect(visible).not.toContain("payroll-runs");
    expect(visible).not.toContain("payroll-inputs");
    expect(visible).not.toContain("payroll-anomalies");
    expect(visible).toEqual(["payslips"]);
  });
  it("maps each action to a real handler and preserves nested correction input", () => {
    expect(new Set(workflowOperations.map(o => o.id)).size).toBe(workflowOperations.length);
    for (const op of workflowOperations) expect(readFileSync(resolve(process.cwd(), op.source), "utf8"), op.id).toContain("export async function " + op.method + "(");
    const correction = workflowOperations.find(o => o.path.endsWith("/correct"))!;
    expect(correction.body.fields?.find(f => f.name === "adjustments")?.item?.kind).toBe("object");
  });
});
