import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/platform/http";
import { parseObjectivePayload } from "@/server/performance/objective-payload";

const UUID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function fields(body: unknown): string[] {
  try {
    parseObjectivePayload(body);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    const details = ((error as HttpError).details ?? []) as Array<{ field: string }>;
    return details.map((detail) => detail.field);
  }
}

describe("parseObjectivePayload", () => {
  it("accepts a title and an owner", () => {
    expect(parseObjectivePayload({ title: " Grow output ", ownerEmployeeId: UUID })).toEqual({ title: "Grow output", ownerEmployeeId: UUID });
  });
  it("rejects a missing title instead of defaulting one", () => {
    expect(fields({ ownerEmployeeId: UUID })).toContain("title");
  });
  it("rejects a missing or malformed owner instead of assigning one", () => {
    expect(fields({ title: "Goal" })).toContain("ownerEmployeeId");
    expect(fields({ title: "Goal", ownerEmployeeId: "abc" })).toContain("ownerEmployeeId");
  });
  it("rejects an empty body", () => {
    expect(fields(null).sort()).toEqual(["ownerEmployeeId", "title"]);
  });
});
