import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allocateAssetSchema, deriveAssetState, isCustodyOpen, openCustodySql, returnAssetSchema } from "./service";

describe("deriveAssetState", () => {
  it("treats a written-off condition as terminal regardless of status or holder", () => {
    expect(deriveAssetState("Allocated", "Written off", true)).toBe("written_off");
    expect(deriveAssetState("Returned", "  damaged - WRITTEN OFF ", false)).toBe("written_off");
    expect(deriveAssetState(null, "written off", false)).toBe("written_off");
  });

  it("marks allocated catalogue rows as allocated", () => {
    expect(deriveAssetState("Allocated", "Good", false)).toBe("allocated");
    expect(deriveAssetState(" allocated ", null, false)).toBe("allocated");
  });

  it("marks a held asset as allocated unless it has already been returned", () => {
    expect(deriveAssetState("", "Good", true)).toBe("allocated");
    expect(deriveAssetState(null, null, true)).toBe("allocated");
    expect(deriveAssetState(undefined, undefined, true)).toBe("allocated");
    expect(deriveAssetState("Returned", "Good", true)).toBe("returned");
  });

  it("marks returned assets as returned", () => {
    expect(deriveAssetState("Returned", null, false)).toBe("returned");
    expect(deriveAssetState("RETURNED", "Good", false)).toBe("returned");
  });

  it("falls back to available for unknown or missing status without a holder", () => {
    expect(deriveAssetState(null, null, false)).toBe("available");
    expect(deriveAssetState(undefined, undefined, false)).toBe("available");
    expect(deriveAssetState("", "", false)).toBe("available");
    expect(deriveAssetState("In store", "Good", false)).toBe("available");
  });
});

describe("asset register contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/assets/service.ts"), "utf8");
  const region = service.slice(service.indexOf("ASSET_STATUS_CASE"));

  function regionSql(): string {
    return [...region.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1].replace(/\$\{[^}]*\}/g, "")).join("\n");
  }

  it("references only migrated tables", () => {
    const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
    const operations = readFileSync(resolve(process.cwd(), "db/migrations/0016_operational_workflows.sql"), "utf8");
    const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
    for (const match of operations.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)) known.add(match[1]);
    expect(known.size).toBeGreaterThan(100);
    const sql = regionSql();
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join|insert into)\s+([a-z_]+)/g)) {
      if (!["latest", "lateral", "status"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.has("asset_catalog")).toBe(true);
    expect(tables.has("asset_assignments")).toBe(true);
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("binds every SQL table alias it references", () => {
    const sql = regionSql();
    // `excluded` is the row proposed by an INSERT ... ON CONFLICT, not a table alias.
    const bound = new Set<string>(["excluded"]);
    for (const match of sql.matchAll(/(?:from|join|insert into|update)\s+"?([a-z_]+)"?(?:\s+(?:as\s+)?([a-z_]+))?/g)) {
      bound.add(match[1]);
      if (match[2] && !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group", "lateral"].includes(match[2])) {
        bound.add(match[2]);
      }
    }
    for (const match of sql.matchAll(/\)\s+([a-z_]+)\s+on\b/g)) bound.add(match[1]);
    const referenced = new Set<string>();
    for (const match of sql.matchAll(/\b([a-z_]+)\.[a-z_]+/g)) referenced.add(match[1]);
    expect(referenced.size).toBeGreaterThan(0);
    for (const alias of referenced) {
      expect(bound.has(alias), `alias ${alias} is referenced but never bound`).toBe(true);
    }
  });

  it("filters the uncatalogued junk row out of the register under either vocabulary", () => {
    expect(region).toContain("coalesce(ac.attributes->>'type', ac.attributes->>'category') is not null");
  });

  it("mirrors custody into the operational register full and final reads", () => {
    expect(region).toContain("insert into hrms_operation_records");
    expect(region).toContain("'assets'");
  });

  it("uses no DDL and isolates the audit trail", () => {
    expect(region).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
    expect((region.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});

describe("asset allocation and return (FRM-PPL-06)", () => {
  const employeeId = "123e4567-e89b-12d3-a456-426614174000";

  it("opens an allocation as new and unacknowledged", () => {
    const parsed = allocateAssetSchema.parse({ employeeId, issuedOn: "2026-04-01", reason: "Day one issue" });
    expect(parsed.conditionAtIssue).toBe("new");
    expect(parsed.acknowledgedByEmployee).toBe(false);
    expect(allocateAssetSchema.safeParse({ employeeId, issuedOn: "2026-04-01", conditionAtIssue: "pristine", reason: "Day one issue" }).success).toBe(false);
    expect(allocateAssetSchema.safeParse({ employeeId, issuedOn: "2026-04-01", expectedReturn: "not-a-date", reason: "Day one issue" }).success).toBe(false);
  });

  it("takes the return condition from the return vocabulary, not the issue one", () => {
    const base = { returnedOn: "2026-09-01", reason: "Exit clearance" };
    expect(returnAssetSchema.safeParse({ ...base, condition: "good" }).success).toBe(true);
    expect(returnAssetSchema.safeParse({ ...base, condition: "not_returned" }).success).toBe(true);
    // "New" and "Fair" belong to the condition asked at issue.
    expect(returnAssetSchema.safeParse({ ...base, condition: "new" }).success).toBe(false);
    expect(returnAssetSchema.safeParse({ ...base, condition: "fair" }).success).toBe(false);
  });

  it("holds a damaged or lost return to a recovery amount and full remarks", () => {
    const damaged = { condition: "damaged", returnedOn: "2026-09-01" };
    expect(returnAssetSchema.safeParse({ ...damaged, reason: "Cracked screen on return" }).success).toBe(false);
    expect(returnAssetSchema.safeParse({ ...damaged, recoveryAmountMinor: 450000, reason: "Cracked" }).success).toBe(false);
    expect(returnAssetSchema.safeParse({ ...damaged, recoveryAmountMinor: 450000, reason: "Cracked screen on return" }).success).toBe(true);
    // A nil recovery is a decision, not an omission, so zero is accepted.
    expect(returnAssetSchema.safeParse({ ...damaged, recoveryAmountMinor: 0, reason: "Cracked screen on return" }).success).toBe(true);
    // An undamaged return needs neither.
    expect(returnAssetSchema.safeParse({ condition: "good", returnedOn: "2026-09-01", reason: "OK." }).success).toBe(true);
  });
});

describe("open custody (R-24)", () => {
  // The Asset Register writes "Allocated" and the operational asset workflow writes
  // "allocated". One predicate answers for both, or a register-issued asset returned
  // through the workflow leaves its custody row open.
  it.each(["Allocated", "allocated", " ALLOCATED "])("treats %s as still out with its holder", (status) => {
    expect(isCustodyOpen(status)).toBe(true);
  });

  it.each(["Returned", "returned", "", null, undefined])("treats %s as closed", (status) => {
    expect(isCustodyOpen(status)).toBe(false);
  });

  it("compares in lower case in SQL too, and refuses an unsafe alias", () => {
    expect(openCustodySql("a")).toBe("lower(trim(coalesce(a.attributes->>'status', ''))) = 'allocated'");
    expect(() => openCustodySql("a; drop table x")).toThrow("Unsafe SQL alias");
  });
});
