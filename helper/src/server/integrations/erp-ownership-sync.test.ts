import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenantTx, enforce } = vi.hoisted(() => ({ tenantTx: vi.fn(), enforce: vi.fn() }));
vi.mock("@/lib/db", () => ({ sqlClient: (parts: TemplateStringsArray, ...values: unknown[]) => ({ sql: parts.join("?"), values }) }));
vi.mock("@/server/platform/access", () => ({ tenantTx, enforce, uuidOrNull: (value: string) => value }));

import type { Access } from "@/server/platform/access";
import { chooseErpSettings } from "./erp-settings";
import { erpEmployeePayloadSchema, syncErpEmployee } from "./erp-sync";
import { ERP_SYNC_FIELDS, type ErpSettings } from "@/lib/erp-field-ownership";

/**
 * FRM-FIN-02 driving the inbound ERP sync: which settings govern a sync, and
 * what the sync then does with match_key, unmatched_action, field_owner and
 * conflict_policy. The database is a scripted queue of results, so what is
 * asserted is the statements the sync chose to run.
 */

const access = { tenantId: "tenant-a", context: { actorUserId: "user-a", membershipId: "membership-a" } } as Access;
const connectionId = "5d2c1a1e-9b7a-4c1c-8f4e-1b2c3d4e5f60";

type Statement = { sql: string; values: unknown[] };

function settings(overrides: Partial<ErpSettings> = {}): ErpSettings {
  return {
    connectionId,
    masterMode: "co_owned",
    erpSystem: "sap",
    syncFrequency: "daily",
    fieldOwners: { firstName: "nucleus", lastName: "nucleus", workEmail: "erp", department: "erp", location: "erp", designation: "erp", joiningDate: "erp", basicSalaryMinor: "erp" },
    conflictPolicy: "owner_wins",
    matchKey: "employee_code",
    unmatchedAction: "hold",
    ...overrides,
  };
}

const employee = { firstName: "Anil", lastName: "Yadav", department: "Weaving", location: "PLANT-N", designation: "Weaving Operator", joiningDate: "2021-02-01" };
const matchedRow = { id: "emp-1", first_name: "Anil", last_name: "Yadav", work_email: null, department: "Weaving", location: "PLANT-N", designation: "Weaving Operator", joining_date: "2021-02-01", basic_salary_minor: null, updated_at: "2026-09-01T10:00:00Z" };
const recordRow = { id: "rec-1", connection_id: connectionId, direction: "inbound_employee", external_key: "ERP-001", status: "validated", attempt_count: 1, payload: employee };

/** Script the database: prior lookup, claim, claim-id, connections, match, then whatever the branch runs. */
function script(args: { connections: Array<{ id: string; attributes: Record<string, unknown> }>; matches: unknown[] }) {
  const queue: unknown[][] = [[[]], [[]], [[{ id: "rec-1" }]], [args.connections.map((row) => ({ ...row, version: 1, catalog: null, updated_at: "" }))], [args.matches]];
  tenantTx.mockReset();
  tenantTx.mockImplementation(async () => queue.shift() ?? [[recordRow]]);
}

function statements(): Statement[] {
  return tenantTx.mock.calls.flatMap((call) => call[1] as Statement[]);
}

function sqlOf(needle: string): Statement[] {
  return statements().filter((statement) => statement.sql.includes(needle));
}

const configured = { id: connectionId, attributes: { erp_settings: settings() } };

beforeEach(() => {
  enforce.mockReset();
});

describe("chooseErpSettings (the Q-15 posture)", () => {
  it("refuses to sync when no connection has a field-ownership map", () => {
    expect(chooseErpSettings([{ connectionId, settings: null }], null)).toMatchObject({ action: "refuse", code: "ERP_FIELD_OWNERSHIP_UNCONFIGURED" });
    expect(chooseErpSettings([], null)).toMatchObject({ action: "refuse", code: "ERP_FIELD_OWNERSHIP_UNCONFIGURED" });
  });

  it("refuses a named connection whose map is missing, and a connection that does not exist", () => {
    expect(chooseErpSettings([{ connectionId, settings: null }], connectionId)).toMatchObject({ action: "refuse", code: "ERP_FIELD_OWNERSHIP_UNCONFIGURED" });
    expect(chooseErpSettings([{ connectionId, settings: settings() }], "other")).toMatchObject({ action: "refuse", code: "NOT_FOUND" });
  });

  it("uses the single configured connection when the sync names none, and refuses to guess between two", () => {
    expect(chooseErpSettings([{ connectionId, settings: settings() }, { connectionId: "c2", settings: null }], null)).toMatchObject({ action: "use" });
    expect(chooseErpSettings([{ connectionId, settings: settings() }, { connectionId: "c2", settings: settings() }], null)).toMatchObject({ action: "refuse", code: "ERP_CONNECTION_AMBIGUOUS" });
  });
});

describe("syncErpEmployee under a saved ownership map", () => {
  it("keeps the ownership grid in step with the fields an inbound record can carry", () => {
    expect([...ERP_SYNC_FIELDS].sort()).toEqual(Object.keys(erpEmployeePayloadSchema.shape).sort());
  });

  it("refuses with a named error and parks the record as failed when no map is saved", async () => {
    script({ connections: [{ id: connectionId, attributes: {} }], matches: [] });
    await expect(syncErpEmployee(access, { externalCode: "ERP-001", employee }, "req")).rejects.toMatchObject({ code: "ERP_FIELD_OWNERSHIP_UNCONFIGURED", status: 422 });
    expect(sqlOf("update employees")).toHaveLength(0);
    expect(sqlOf("insert into employees")).toHaveLength(0);
    const failure = sqlOf("status = 'failed'");
    expect(failure).toHaveLength(1);
    expect(String(failure[0].values[0])).toContain("Q-15");
  });

  it("writes only ERP-owned fields to a matched employee and leaves Nucleus-owned ones untouched", async () => {
    script({ connections: [configured], matches: [matchedRow] });
    const result = await syncErpEmployee(access, { connectionId, externalCode: "ERP-001", employee: { ...employee, firstName: "Anil Kumar", department: "Dyeing" } }, "req");
    expect(result.status).toBe("applied");
    expect(result.employeeId).toBe("emp-1");
    expect(result.conflicts).toEqual([{ field: "firstName", nucleusValue: "Anil", erpValue: "Anil Kumar", resolution: "nucleus_kept" }]);
    const update = sqlOf("update employees set")[0];
    expect(update.sql).toContain("first_name = coalesce(?, first_name)");
    // Positional: first_name is the first bound value and must be null (kept); department is the fourth and carries the ERP value.
    expect(update.values[0]).toBeNull();
    expect(update.values[3]).toBe("Dyeing");
    expect(sqlOf("status = 'applied'")).toHaveLength(1);
  });

  it("matches on the connection's match key", async () => {
    script({ connections: [{ id: connectionId, attributes: { erp_settings: settings({ matchKey: "external_id" }) } }], matches: [matchedRow] });
    await syncErpEmployee(access, { connectionId, externalCode: "ERP-001", employee }, "req");
    expect(sqlOf("metadata->>? = ?")).toHaveLength(1);
    expect(sqlOf("employee_code = ?")).toHaveLength(0);

    script({ connections: [{ id: connectionId, attributes: { erp_settings: settings({ matchKey: "work_email" }) } }], matches: [matchedRow] });
    await syncErpEmployee(access, { connectionId, externalCode: "ERP-001", employee: { ...employee, workEmail: "Anil@Example.test" } }, "req");
    const byEmail = sqlOf("lower(work_email) = ?");
    expect(byEmail).toHaveLength(1);
    expect(byEmail[0].values).toContain("anil@example.test");
  });

  it("refuses a work-email match for a record that carries no email", async () => {
    script({ connections: [{ id: connectionId, attributes: { erp_settings: settings({ matchKey: "work_email" }) } }], matches: [] });
    await expect(syncErpEmployee(access, { connectionId, externalCode: "ERP-001", employee }, "req")).rejects.toMatchObject({ code: "ERP_MATCH_KEY_MISSING" });
  });

  it("refuses two matches, because the key must be unique in both systems", async () => {
    script({ connections: [configured], matches: [matchedRow, { ...matchedRow, id: "emp-2" }] });
    await expect(syncErpEmployee(access, { connectionId, externalCode: "ERP-001", employee }, "req")).rejects.toMatchObject({ code: "ERP_MATCH_AMBIGUOUS", status: 409 });
    expect(sqlOf("update employees")).toHaveLength(0);
  });

  it("holds a conflicting record for review without touching the employee", async () => {
    script({ connections: [{ id: connectionId, attributes: { erp_settings: settings({ conflictPolicy: "hold_for_review" }) } }], matches: [matchedRow] });
    const result = await syncErpEmployee(access, { connectionId, externalCode: "ERP-001", employee: { ...employee, lastName: "Yadav-Singh" } }, "req");
    expect(result.status).toBe("queued");
    expect(result.holdReason).toContain("Last name");
    expect(sqlOf("update employees")).toHaveLength(0);
    expect(sqlOf("status = 'queued'")).toHaveLength(1);
    expect(sqlOf("integration.erp_sync_held")).toHaveLength(1);
  });

  it("unmatched + hold: parks the record; unmatched + reject: fails it; unmatched + create: adds the employee", async () => {
    script({ connections: [configured], matches: [] });
    const held = await syncErpEmployee(access, { connectionId, externalCode: "ERP-009", employee }, "req");
    expect(held.status).toBe("queued");
    expect(held.employeeId).toBeNull();
    expect(sqlOf("insert into employees")).toHaveLength(0);

    script({ connections: [{ id: connectionId, attributes: { erp_settings: settings({ unmatchedAction: "reject" }) } }], matches: [] });
    await expect(syncErpEmployee(access, { connectionId, externalCode: "ERP-009", employee }, "req")).rejects.toMatchObject({ code: "ERP_RECORD_UNMATCHED", status: 422 });
    expect(sqlOf("status = 'failed'")).toHaveLength(1);

    script({ connections: [{ id: connectionId, attributes: { erp_settings: settings({ unmatchedAction: "create" }) } }], matches: [] });
    const created = await syncErpEmployee(access, { connectionId, externalCode: "ERP-009", employee }, "req");
    expect(created.status).toBe("applied");
    expect(created.employeeId).not.toBeNull();
    const insert = sqlOf("insert into employees")[0];
    expect(insert.values).toContain("ERP-009");
    expect(String(insert.values.at(-1))).toContain("erp_external_id");
  });

  it("latest_wins without the ERP's change time is refused, not guessed", async () => {
    script({ connections: [{ id: connectionId, attributes: { erp_settings: settings({ conflictPolicy: "latest_wins" }) } }], matches: [matchedRow] });
    await expect(syncErpEmployee(access, { connectionId, externalCode: "ERP-001", employee: { ...employee, firstName: "Anil Kumar" } }, "req")).rejects.toMatchObject({ code: "ERP_CHANGE_TIME_REQUIRED" });

    script({ connections: [{ id: connectionId, attributes: { erp_settings: settings({ conflictPolicy: "latest_wins" }) } }], matches: [matchedRow] });
    const applied = await syncErpEmployee(access, { connectionId, externalCode: "ERP-001", employee: { ...employee, firstName: "Anil Kumar" }, erpChangedAt: "2026-09-10T10:00:00+05:30" }, "req");
    expect(applied.conflicts?.[0].resolution).toBe("erp_applied");
    expect(sqlOf("update employees set")[0].values[0]).toBe("Anil Kumar");
    // The change time is stored with the record so a retry decides the same way.
    expect(String(sqlOf("insert into vp_erp_records")[0].values[6])).toContain("erpChangedAt");
  });
});
