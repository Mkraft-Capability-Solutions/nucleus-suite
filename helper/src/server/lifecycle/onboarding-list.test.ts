import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("onboarding worklist", () => {
  it("exposes tenant onboarding cases with employees and tasks", () => {
    const service = readFileSync(resolve(process.cwd(), "src/server/lifecycle/service.ts"), "utf8");
    const route = readFileSync(resolve(process.cwd(), "src/app/api/v1/onboarding/instances/route.ts"), "utf8");

    expect(service).toContain("export async function listOnboardingInstances");
    expect(service).toContain("join employees employee");
    expect(service).toContain("from onboarding_tasks task");
    expect(route).toContain("export async function GET");
    expect(route).toContain('self: "/api/v1/onboarding/instances"');
  });

  it("renders the worklist instead of endpoint instructions", () => {
    const page = readFileSync(resolve(process.cwd(), "src/components/hrms/people-pages.tsx"), "utf8");

    // The console reads the same governed endpoint; the module tab shell moved it
    // from the local useLive helper onto the shared register resource hook.
    expect(page).toContain('useRegisterResource("/api/v1/onboarding/instances")');
    expect(page).toContain("selected.tasks.map");
    expect(page).not.toContain("cases have no list endpoint");
  });
});
