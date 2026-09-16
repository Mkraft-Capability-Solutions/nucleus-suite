import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createExportSchema, enforceExportPermission } from "@/server/exports/service";
import type { Access } from "@/server/platform/access";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

function caller(permissions: string[]): Access {
  return {
    tenantId: "tenant-1",
    context: {
      actorUserId: "user-1",
      membershipId: "membership-1",
      tenantId: "tenant-1",
      permissions,
      roles: ["member"],
    },
  };
}

describe("exports schemas", () => {
  it("validates export requests with bounded enums", () => {
    expect(createExportSchema.safeParse({ resource: "employees", format: "csv" }).success).toBe(true);
    expect(createExportSchema.safeParse({ resource: "payroll-lines", format: "json", period: "2026-09", employeeId: UUID }).success).toBe(true);
    expect(createExportSchema.safeParse({ resource: "salaries", format: "csv" }).success).toBe(false);
    expect(createExportSchema.safeParse({ resource: "employees", format: "xml" }).success).toBe(false);
    expect(createExportSchema.safeParse({ resource: "employees", format: "csv", period: "Sep" }).success).toBe(false);
  });
});

/**
 * The build step is where an extract's data is actually read, so it carries the same
 * permission the request did. Before this, the job was looked up by tenant alone and any
 * authenticated member could build another member's queued payroll extract.
 */
describe("export permission (T-18)", () => {
  it("demands the payroll permission for payroll lines and loans", () => {
    const employeeOnly = caller(["employee.read"]);
    expect(() => enforceExportPermission(employeeOnly, "payroll-lines")).toThrowError(/not permitted/i);
    expect(() => enforceExportPermission(employeeOnly, "loans")).toThrowError(/not permitted/i);
    expect(() => enforceExportPermission(caller(["payroll.read"]), "payroll-lines")).not.toThrow();
  });

  it("demands the employee permission for every other resource", () => {
    expect(() => enforceExportPermission(caller(["payroll.read"]), "employees")).toThrowError(/not permitted/i);
    expect(() => enforceExportPermission(caller(["employee.read"]), "attendance-days")).not.toThrow();
  });

  it("runs that check inside buildExport, not only at request time", () => {
    const service = readFileSync(resolve(process.cwd(), "src/server/exports/service.ts"), "utf8");
    const build = service.slice(service.indexOf("export async function buildExport"));
    expect(build).toContain("enforceExportPermission(access, job.attributes.resource)");
    // Another member's queued job is an administrative read, not an ordinary one.
    expect(build).toContain("job.requested_by_membership_id !== access.context.membershipId");
    // RL-24: payroll amounts leave only for employees inside the caller's data scope.
    expect(build).toContain("inPayrollScope");
  });
});
