import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace loading", () => {
  it("does not mount tenant pages before workspace bootstrap completes", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/hrms/app-shell.tsx"), "utf8");

    expect(source).toContain("loading ? (");
    expect(source).toMatch(/\)\s*:\s*workspace\s*\?\s*\(?\s*children\s*\)?\s*:\s*\(/);
  });

  it("invalidates in-flight GETs when tenant context changes", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/hrms/workspace-provider.tsx"), "utf8");

    expect(source).toContain("invalidateGetRequests();");
    expect(source).toContain('getJson("/api/v1/workspace/bootstrap")');
  });
});
