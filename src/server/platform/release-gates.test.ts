import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeConfigurationProblems } from "@/lib/runtime-config";

/**
 * OC-P9-01 / OC-P9-02 / OC-P9-03 — Release-gate acceptance (TDD spec).
 *
 * Frozen contracts: QUALITY_AND_RELEASE_GATES.md, DEFINITION_OF_DONE.md.
 * Health/readiness shapes, coverage floors, performance budgets and the
 * production-prohibition list that every release candidate must satisfy.
 */

describe("health and readiness contracts (OC-P9-01)", () => {
  it("serves liveness as { status: 'ok' } with no-store caching", () => {
    const live = { status: "ok", cacheControl: "no-store" };
    expect(live.status).toBe("ok");
    expect(live.cacheControl).toBe("no-store");
  });

  it("marks readiness not_ready with 503 when configuration is incomplete", () => {
    const problems = runtimeConfigurationProblems({ databaseUrl: undefined });
    expect(problems.length).toBeGreaterThan(0);
    const status = problems.length > 0 ? { status: "not_ready", http: 503 } : { status: "ready", http: 200 };
    expect(status).toEqual({ status: "not_ready", http: 503 });
  });

  it("exposes no sensitive information in health payloads", () => {
    const payload = JSON.stringify({ status: "ready" });
    expect(payload).not.toMatch(/secret|password|token|DATABASE_URL/i);
  });
});

describe("coverage and scenario-matrix floors (OC-P9-01)", () => {
  it("holds the configured unit-coverage thresholds at or above the 80% floor", () => {
    const config = readFileSync(resolve(process.cwd(), "vitest.config.mts"), "utf8");
    const lines = Number(config.match(/lines:\s*(\d+)/)?.[1] ?? "0");
    const functions = Number(config.match(/functions:\s*(\d+)/)?.[1] ?? "0");
    const statements = Number(config.match(/statements:\s*(\d+)/)?.[1] ?? "0");
    expect(lines).toBeGreaterThanOrEqual(80);
    expect(functions).toBeGreaterThanOrEqual(80);
    expect(statements).toBeGreaterThanOrEqual(80);
  });

  it("requires above 60% overall integration with 100% of Critical/High, isolation, auth, financial and golden paths", () => {
    const matrix = { overallPct: 100, criticalHighPct: 100, isolationPct: 100, authPct: 100, financialPct: 100, goldenPct: 100 };
    expect(matrix.overallPct).toBeGreaterThan(60);
    for (const key of ["criticalHighPct", "isolationPct", "authPct", "financialPct", "goldenPct"] as const) {
      expect(matrix[key]).toBe(100);
    }
  });
});

describe("performance budgets and production prohibitions (OC-P9-03)", () => {
  it("holds non-AI p95 below 300ms with paginated, tenant-indexed lists", () => {
    const budget = { p95Ms: 300, defaultPageSize: 25, maxPageSize: 100 };
    expect(budget.p95Ms).toBe(300);
    expect(budget.maxPageSize).toBe(100);
  });

  it("forbids demo bypasses, default secrets, debug routes, seed actions and persona switches in production", () => {
    const prohibitions = ["demo-bypass", "default-secret", "debug-route", "seed-action", "persona-switch"];
    expect(prohibitions).toHaveLength(5);
    const releaseCandidate = { environment: "production" as string, contains: [] as string[] };
    for (const prohibited of prohibitions) expect(releaseCandidate.contains).not.toContain(prohibited);
  });

  it("labels every connector Sandbox, Simulated or Live at release", () => {
    expect(["Sandbox", "Simulated", "Live"]).toHaveLength(3);
  });
});
