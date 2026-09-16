import { describe, expect, it } from "vitest";
import {
  actionDeclaration,
  fieldToSchema,
  findAction,
  NUCLEUS_ACTIONS,
  nucleusActionsFor,
  requiredFields,
  resolveOperation,
} from "@/lib/ai/nucleus-catalog";
import { declarationsFor } from "@/lib/ai/nucleus-tools";
import { workflowOperations } from "@/lib/workflow-catalog";

/**
 * The tool surface is generated from the published operation catalog, so these
 * tests guard the two ways that generation can silently go wrong: an action
 * pointing at an operation that no longer exists, and a tool reaching a caller
 * who does not hold the permission for it.
 */

const ALL_PERMISSIONS = [...new Set(workflowOperations.flatMap((operation) => operation.permissions))];

describe("Nucleus action catalog", () => {
  it("resolves every declared action to a real published operation", () => {
    const unresolved = NUCLEUS_ACTIONS.filter((action) => !resolveOperation(action));
    expect(unresolved.map((action) => action.operationId)).toEqual([]);
  });

  it("names each action once", () => {
    const names = NUCLEUS_ACTIONS.map((action) => action.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("drafts nothing irreversible", () => {
    const paths = NUCLEUS_ACTIONS.map((action) => action.operationId);
    for (const forbidden of ["finalize", "disburse", "release", "settle", "approve", "delete"]) {
      expect(paths.filter((path) => path.includes(forbidden))).toEqual([]);
    }
  });

  it("offers nothing to a caller holding no permission at all", () => {
    expect(nucleusActionsFor([])).toEqual([]);
  });

  it("offers leave but not attendance writes to a leave-only caller", () => {
    const names = nucleusActionsFor(["leave.read"]).map((action) => action.name);
    expect(names).toContain("apply_leave");
    expect(names).not.toContain("record_attendance_punches");
  });

  it("offers every action to a caller holding every permission", () => {
    expect(nucleusActionsFor(ALL_PERMISSIONS)).toHaveLength(NUCLEUS_ACTIONS.length);
  });
});

describe("catalog field tree to Gemini schema", () => {
  it("carries a select through as a constrained string", () => {
    const schema = fieldToSchema({ name: "leaveType", kind: "select", options: ["EL", "CL", "SL"] });
    expect(schema).toMatchObject({ type: "STRING", enum: ["EL", "CL", "SL"] });
  });

  it("marks an integer as INTEGER and a plain number as NUMBER", () => {
    expect(fieldToSchema({ name: "days", kind: "number" }).type).toBe("NUMBER");
    expect(fieldToSchema({ name: "count", kind: "number", integer: true }).type).toBe("INTEGER");
  });

  it("tells the model where a uuid has to come from", () => {
    expect(fieldToSchema({ name: "employeeId", kind: "text", format: "uuid" }).description).toContain("find_employee");
  });

  it("drops a derived field, because the service overwrites whatever is sent", () => {
    const schema = fieldToSchema({
      kind: "object",
      fields: [{ name: "reason", kind: "text" }, { name: "computedTotal", kind: "number", derived: true }],
    });
    expect(Object.keys(schema.properties ?? {})).toEqual(["reason"]);
  });

  it("marks non-optional object members as required and omits an empty required list", () => {
    const withRequired = fieldToSchema({ kind: "object", fields: [{ name: "title", kind: "text" }] });
    expect(withRequired.required).toEqual(["title"]);
    const allOptional = fieldToSchema({ kind: "object", fields: [{ name: "note", kind: "text", optional: true }] });
    expect(allOptional.required).toBeUndefined();
  });

  it("carries a shape it cannot model as a JSON string rather than guessing", () => {
    const schema = fieldToSchema({ name: "config", kind: "record", item: { kind: "unknown" } });
    expect(schema.type).toBe("STRING");
    expect(schema.description).toContain("JSON");
  });
});

describe("declarations handed to the model", () => {
  it("states the required leave fields the workbook defines", () => {
    const action = findAction("apply_leave");
    expect(action).toBeDefined();
    expect(requiredFields(action!)).toEqual(["employeeId", "leaveType", "startsOn", "endsOn", "days"]);
  });

  it("tells the model a draft is not a submission", () => {
    const action = findAction("apply_leave")!;
    expect(actionDeclaration(action).description).toContain("confirms");
  });

  it("gives a permissionless caller the reads and the navigation, and no actions", () => {
    const names = declarationsFor([]).map((declaration) => declaration.name);
    expect(names).toContain("workforce_analysis");
    expect(names).toContain("find_employee");
    expect(names).toContain("open_screen");
    expect(names).not.toContain("apply_leave");
  });

  it("names every declaration uniquely for a fully privileged caller", () => {
    const names = declarationsFor(ALL_PERMISSIONS).map((declaration) => declaration.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
