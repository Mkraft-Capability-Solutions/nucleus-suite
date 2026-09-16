import { describe, expect, it } from "vitest";
import { auditQuerySchema } from "@/server/ops/service";

describe("ops schemas", () => {
  it("validates audit queries with pagination defaults", () => {
    const parsed = auditQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(25);
    }
    expect(auditQuerySchema.safeParse({ since: "2026-09-01", pageSize: 100 }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ since: "yesterday", pageSize: 101 }).success).toBe(false);
  });
});
