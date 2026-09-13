import { describe, expect, it } from "vitest";
import { isPooledNeonUrl, migrationConfigurationProblems, readRuntimeConfiguration, runtimeConfigurationProblems } from "@/lib/runtime-config";

const validRuntime = {
  BETTER_AUTH_URL: "https://people.example.test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://runtime@ep-calm-forest-pooler.us-east-2.aws.neon.tech/mkraft",
};

describe("runtime configuration", () => {
  it("requires database and authentication configuration together", () => {
    expect(runtimeConfigurationProblems(readRuntimeConfiguration({}))).toEqual(["DATABASE_URL is required"]);
    expect(runtimeConfigurationProblems(readRuntimeConfiguration({ DATABASE_URL: "postgresql://runtime@db/mkraft" }))).toEqual(["BETTER_AUTH_URL is required", "BETTER_AUTH_SECRET must be at least 32 characters"]);
    expect(runtimeConfigurationProblems(readRuntimeConfiguration(validRuntime))).toEqual([]);
  });

  it("requires a separate direct migration connection", () => {
    expect(migrationConfigurationProblems(readRuntimeConfiguration(validRuntime))).toEqual(["MIGRATION_DATABASE_URL is required"]);
    expect(migrationConfigurationProblems(readRuntimeConfiguration({ ...validRuntime, MIGRATION_DATABASE_URL: validRuntime.DATABASE_URL }))).toEqual(["MIGRATION_DATABASE_URL must use Neon’s direct, non-pooled endpoint"]);
    expect(migrationConfigurationProblems(readRuntimeConfiguration({ ...validRuntime, MIGRATION_DATABASE_URL: "postgresql://migrator@ep-calm-forest.us-east-2.aws.neon.tech/mkraft" }))).toEqual([]);
  });

  it("recognizes Neon pooled endpoints without treating arbitrary URLs as pooled", () => {
    expect(isPooledNeonUrl(validRuntime.DATABASE_URL)).toBe(true);
    expect(isPooledNeonUrl("postgresql://runtime@localhost/mkraft")).toBe(false);
  });
});

describe('deployment configuration boundaries', () => {
  it('rejects the unsupported database workspace mode and inert invalid settings', async () => {
    const { environmentProblems } = await import('./runtime-config');
    expect(environmentProblems({ APP_DATA_MODE: 'database' }).join(' ')).toMatch(/not implemented/);
    for (const env of [{ AI_MAX_RETRIES: '-1' }, { AI_REQUEST_TIMEOUT_MS: 'NaN' }, { AUTH_COOKIE_MAX_AGE: '0' }, { AUTH_COOKIE_SAME_SITE: 'none' }]) {
      expect(environmentProblems(env).length).toBeGreaterThan(0);
    }
    expect(environmentProblems({ AI_MAX_RETRIES: '0', AI_REQUEST_TIMEOUT_MS: '30000', OPENAI_MODEL: '' })).toEqual([]);
  });
  it.each([{ NETLIFY: 'true' }, { VERCEL: '1' }])('rejects localhost and unsafe hosted origins: %j', async (platform) => {
    const { environmentProblems } = await import('./runtime-config');
    for (const origin of ['http://localhost:3000', 'https://localhost', 'https://example.test/path', 'https://*.example.test', 'https://user:secret@example.test']) {
      const problems = environmentProblems({ ...platform, BETTER_AUTH_URL: origin });
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.join(' ')).not.toContain('user:secret');
    }
    expect(environmentProblems(platform).join(' ')).toMatch(/BETTER_AUTH_URL is required/);
    expect(environmentProblems({ ...platform, BETTER_AUTH_URL: 'https://workspace.example.test' })).toEqual([]);
  });
  it('does not equate valid preview settings with customer-production readiness', async () => {
    const { productionReadinessProblems } = await import('./runtime-config');
    expect(productionReadinessProblems(validRuntime).join(' ')).toMatch(/Customer release blocked/);
  });
});
