import { describe, expect, it } from "vitest";
import { enforce, stripPrelude, tenantPrelude, TENANT_PRELUDE_LENGTH, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

const ACCESS: Access = {
  context: { actorUserId: "u", membershipId: "m", tenantId: "t", permissions: [], roles: [] },
  tenantId: "t",
};

describe("tenant transaction alignment (regression: set_config leak)", () => {
  it("prepends exactly TENANT_PRELUDE_LENGTH GUC statements", () => {
    expect(tenantPrelude(ACCESS)).toHaveLength(TENANT_PRELUDE_LENGTH);
    expect(TENANT_PRELUDE_LENGTH).toBe(3);
  });

  it("strips prelude outputs so results align 1:1 with statements", () => {
    const raw = ["set-user", "set-tenant", "set-membership", "count-result", "select-result"];
    expect(stripPrelude(raw)).toEqual(["count-result", "select-result"]);
  });

  it("returns an empty array when statements produce no rows", () => {
    expect(stripPrelude(["a", "b", "c"])).toEqual([]);
  });

  it("nulls non-UUID request ids so ::uuid casts never fail", () => {
    expect(uuidOrNull("2d7e4f65-d3d8-43ef-8113-6924fac7174e")).toBe("2d7e4f65-d3d8-43ef-8113-6924fac7174e");
    expect(uuidOrNull("req-1")).toBeNull();
    expect(uuidOrNull(undefined)).toBeNull();
  });
});

describe("enforce() denial mapping (OC-P1-03)", () => {
  const actor: Access = {
    context: { actorUserId: "u", membershipId: "m", tenantId: "t1", permissions: ["employee.read"], roles: ["r"] },
    tenantId: "t1",
  };

  it("passes through allowed checks silently", () => {
    expect(() => enforce(actor.context, "employee.read", { tenantId: "t1" })).not.toThrow();
  });

  it("maps cross-tenant denial to 404 NOT_FOUND (no existence leak)", () => {
    try {
      enforce(actor.context, "employee.read", { tenantId: "t2" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(404);
      expect((error as HttpError).code).toBe("NOT_FOUND");
    }
  });

  it("maps missing action grants to 403 FORBIDDEN", () => {
    try {
      enforce(actor.context, "leave.approve", { tenantId: "t1" });
      expect.unreachable();
    } catch (error) {
      expect((error as HttpError).status).toBe(403);
      expect((error as HttpError).code).toBe("FORBIDDEN");
    }
  });

  it("maps protected-field denial to 403 with a field-specific message", () => {
    try {
      enforce(actor.context, "employee.read", { tenantId: "t1" }, ["compensation"]);
      expect.unreachable();
    } catch (error) {
      expect((error as HttpError).status).toBe(403);
      expect((error as HttpError).message).toContain("fields");
    }
  });
});
