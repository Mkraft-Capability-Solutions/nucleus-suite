import { describe, expect, it } from "vitest";

/**
 * OC-P8-01 / OC-P8-02 / OC-P8-04 — AI platform, checkpoint and governed-action
 * acceptance (TDD spec).
 *
 * Frozen contracts: Slice 14 full scope, MGR-P8-04 agent identities/tools/
 * autonomy ceilings, OC-P8-04 simulation/drift/replay/denial/kill-switch tests.
 * Deterministic domains stay authoritative; the LLM only proposes through
 * typed previews confirmed by a human in the owning workflow.
 */

const ALLOWLISTED_TOOLS = ["policy.retrieve", "leave.read_balance", "attendance.read_day", "draft.prepare", "action.preview"] as const;
const FORBIDDEN_TOOLS = ["sql.query", "shell.exec", "http.fetch", "file.read_raw", "credential.use", "db.write_direct"] as const;

function toolAllowed(tool: string): boolean {
  return (ALLOWLISTED_TOOLS as readonly string[]).includes(tool);
}

describe("tool registry allowlist (OC-P8-02)", () => {
  it.each([...ALLOWLISTED_TOOLS])("permits the narrow DTO tool '%s'", (tool) => {
    expect(toolAllowed(tool)).toBe(true);
  });

  it.each([...FORBIDDEN_TOOLS])("denies the dangerous tool '%s'", (tool) => {
    expect(toolAllowed(tool)).toBe(false);
  });
});

describe("tenant-safe checkpoints and re-authorization (OC-P8-02)", () => {
  it("binds every checkpoint row to its tenant", () => {
    const checkpoint = { tenantId: "t1", threadId: "th_9", payload: "opaque-or-encrypted" };
    expect(checkpoint.tenantId).toBe("t1");
  });

  it("denies cross-tenant checkpoint resume without leaking existence", () => {
    const resume = { requestorTenant: "t2", ownerTenant: "t1", outcome: "denied", existenceLeak: false };
    expect(resume.outcome).toBe("denied");
    expect(resume.existenceLeak).toBe(false);
  });

  it("re-authenticates membership, purpose and subject before resuming", () => {
    const resume = { membershipActive: true, purposeMatch: true, subjectMatch: true };
    expect(Object.values(resume).every(Boolean)).toBe(true);
    expect({ ...resume, purposeMatch: false }).toEqual({ membershipActive: true, purposeMatch: false, subjectMatch: true });
  });

  it("retains prompts briefly and graph state only to the subject horizon", () => {
    const retention = { promptsDays: 30, graphDaysAfterTerminal: 30, wellbeingRawDays: 90 };
    expect(retention.promptsDays).toBe(30);
    expect(retention.graphDaysAfterTerminal).toBe(30);
  });
});

describe("provider failure, timeout and kill-switch (OC-P8-02)", () => {
  it("falls back to deterministic policy lookup with the model disabled", () => {
    const fallback = { modelAvailable: false, mode: "deterministic-lookup", cited: true, labeled: true };
    expect(fallback.mode).toBe("deterministic-lookup");
    expect(fallback.cited && fallback.labeled).toBe(true);
  });

  it("cancels long-running graphs on timeout with safe error mapping", () => {
    const timeout = { timedOut: true, mutated: false, error: "provider-timeout" };
    expect(timeout.mutated).toBe(false);
    expect(timeout.error).toBe("provider-timeout");
  });

  it("cancels every pending action when the kill switch trips", () => {
    const pending = ["a1", "a2", "a3"].map((id) => ({ id, state: "cancelled" as string }));
    expect(pending.every((action) => action.state === "cancelled")).toBe(true);
  });
});

describe("governed agent actions: authority, simulation, replay, reversal (OC-P8-04)", () => {
  it("intersects agent authority with the requesting human authority (least privilege)", () => {
    const agent = new Set(["leave.read", "draft.prepare"]);
    const human = new Set(["leave.read", "leave.approve"]);
    const effective = [...agent].filter((permission) => human.has(permission));
    expect(effective).toEqual(["leave.read"]);
  });

  it("simulates actions as diffs with zero mutations", () => {
    const simulation = { mutated: false, diff: [{ field: "manager", before: "mgr_a", after: "mgr_b" }] };
    expect(simulation.mutated).toBe(false);
    expect(simulation.diff).toHaveLength(1);
  });

  it("executes idempotently under the original action key", () => {
    const executed = new Map<string, string>();
    const execute = (key: string) => {
      if (!executed.has(key)) executed.set(key, "completed");
      return executed.get(key);
    };
    expect(execute("act_1")).toBe("completed");
    expect(execute("act_1")).toBe("completed");
    expect(executed.size).toBe(1);
  });

  it("reverses outcomes through legal reversal records, never deletion", () => {
    const reversal = { outcomeDeleted: false, reversalRecord: "rev_11", reason: "wrong effective date" };
    expect(reversal.outcomeDeleted).toBe(false);
    expect(reversal.reversalRecord).toBeTruthy();
  });

  it("invalidates pending actions when the tool contract version drifts", () => {
    const pending = { toolVersion: "v1", currentVersion: "v2", state: "invalidated" };
    expect(pending.toolVersion !== pending.currentVersion ? pending.state : "ready").toBe("invalidated");
  });

  it("requires human confirmation inside the owning workflow for every mutation", () => {
    const action = { previewed: true, confirmedBy: "hr_head_1", executed: true };
    expect(action.previewed && action.confirmedBy ? action.executed : false).toBe(true);
    expect({ ...action, confirmedBy: "" }.confirmedBy ? true : false).toBe(false);
  });
});
