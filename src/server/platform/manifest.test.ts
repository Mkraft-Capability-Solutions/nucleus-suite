import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/route";

/**
 * OC-P9-01 — Manifest ↔ route-file parity (TDD spec).
 *
 * Every route advertised in GET /api/v1 must resolve to a real route.ts
 * (with :id segments mapped to [id] directories). Catches manifest drift
 * as the surface grows: no documented-but-missing endpoints.
 */

const ROOT = resolve(process.cwd());

function manifestPathToFile(route: string): string {
  const [method, path] = route.split(" ");
  void method;
  const base = path.startsWith("/api/v1/") ? path.replace(/^\/api\/v1\/?/, "v1/") : path.replace(/^\/api\/?/, "");
  const segments = base
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.startsWith(":") ? `[${segment.slice(1)}]` : segment));
  return join(ROOT, "src", "app", "api", ...segments, "route.ts");
}

describe("v1 manifest parity (OC-P9-01)", () => {
  it("advertises only implemented routes", async () => {
    const { resources } = await (await GET()).json() as { resources: Array<{ family: string; routes: string[]; auth: string }> };
    expect(resources.length).toBeGreaterThan(20);
    const missing: string[] = [];
    for (const resource of resources) {
      for (const route of resource.routes) {
        if (!existsSync(manifestPathToFile(route))) missing.push(route);
      }
    }
    expect(missing).toEqual([]);
  });

  it("documents the auth model and stability contract for every family", async () => {
    const { resources } = await (await GET()).json() as { resources: Array<{ family: string; routes: string[]; auth: string }> };
    for (const resource of resources) {
      expect(resource.auth, `${resource.family} auth`).toBeTruthy();
      expect(resource.routes.length, `${resource.family} routes`).toBeGreaterThan(0);
    }
  });
});
