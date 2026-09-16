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
