import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("command-centre data loading", () => {
  it("does not fetch skills once per employee", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/hrms/dashboard.tsx"), "utf8");

    expect(source).not.toContain("/api/v1/employee-skills?employeeId=");
    expect(source).not.toContain("/api/v1/workspace/bootstrap");
    expect(source).not.toContain("/api/v1/people?");
    expect(source).not.toContain("/api/v1/leave-requests?");
    expect(source).not.toContain("/api/v1/compliance/obligations");
    expect(source.match(/getJson\(/g)).toHaveLength(1);
    expect(source).toContain("home.capabilityByDepartment");
  });
});
