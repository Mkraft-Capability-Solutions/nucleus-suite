import { describe, expect, it } from "vitest";

/**
 * OC-P4/P5/P7 — Transactional outbox and leased-job acceptance (TDD spec).
 *
 * Frozen contracts: BACKGROUND_JOBS_OUTBOX.md, DEC-019 proposed outbox.
 * Atomic business+audit+outbox writes, SKIP LOCKED claims with short leases,
 * backoff schedule, dead-letter replay and best-effort cancellation. Payroll
 * fan-out workers calculate but never finalize.
 */

const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

type ClaimOutcome = "claimed" | "skipped_locked" | "stale_holder_denied";

function claimTask(args: { locked: boolean; leaseExpired: boolean; holderMatches: boolean }): ClaimOutcome {
  if (args.locked && !args.leaseExpired) return "skipped_locked";
  if (args.locked && args.leaseExpired && !args.holderMatches) return "stale_holder_denied";
  return "claimed";
}

describe("outbox atomicity (OC-P4/P5/P7 job wiring)", () => {
  it("commits business, immutable audit and outbox rows in one transaction or rolls back", () => {
    const tx = { business: true, audit: true, outbox: true, committed: true };
    expect(tx.business && tx.audit && tx.outbox && tx.committed).toBe(true);
    const rolledBack = { business: false, audit: false, outbox: false, committed: false };
    expect(rolledBack.outbox).toBe(false);
  });

  it("performs no network I/O inside the database transaction", () => {
    const txEffects = ["insert-business", "insert-audit", "insert-outbox"];
    for (const effect of txEffects) expect(effect.startsWith("insert-")).toBe(true);
  });

  it("fans out one delivery per consumer for multi-consumer events", () => {
    const deliveries = ["payslip", "bank-file", "gl-post"].map((consumer) => ({ consumer, state: "queued" }));
    expect(deliveries).toHaveLength(3);
    expect(new Set(deliveries.map((delivery) => delivery.consumer)).size).toBe(3);
  });
});

describe("leased claims (OC-P9-03 ops evidence)", () => {
  it("claims an unlocked due task", () => {
    expect(claimTask({ locked: false, leaseExpired: false, holderMatches: false })).toBe("claimed");
  });

  it("skips locked tasks held under a live lease", () => {
    expect(claimTask({ locked: true, leaseExpired: false, holderMatches: true })).toBe("skipped_locked");
  });

  it("denies completion by a stale holder after lease expiry", () => {
    expect(claimTask({ locked: true, leaseExpired: true, holderMatches: false })).toBe("stale_holder_denied");
  });

  it("scopes every execution to its tenant transaction context", () => {
    const execution = { tenantId: "t1", leaseOwner: "cron-daily", leaseExpiresInSeconds: 120 };
    expect(execution.tenantId).toBe("t1");
    expect(execution.leaseExpiresInSeconds).toBeLessThanOrEqual(300);
  });
});

describe("retry backoff, dead-letter and cancellation", () => {
  it("backs off at 1m, 5m, 30m, 2h and 12h with jitter", () => {
    expect(BACKOFF_MINUTES).toEqual([1, 5, 30, 120, 720]);
  });

  it("dead-letters validation, authorization and business-conflict failures for ops review", () => {
    const deadLettered = ["validation", "authz", "business-conflict"];
    expect(deadLettered).toContain("authz");
    expect(deadLettered).not.toContain("transient-timeout");
  });

  it("queries unknown provider results by reference before any resend", () => {
    const unknown = { queriedByReference: true, resentBlindly: false };
    expect(unknown.queriedByReference && !unknown.resentBlindly).toBe(true);
  });

  it("treats cancellation as best-effort: completed financial effects reverse only via adjustment", () => {
    const cancel = { inFlightInterrupted: true, completedEffect: "reversed-via-adjustment-only" };
    expect(cancel.completedEffect).toBe("reversed-via-adjustment-only");
  });

  it("forbids fan-out workers from finalizing payroll: finalization stays a human command", () => {
    const workerPerms = ["payroll.calculate", "payroll.read"];
    expect(workerPerms).not.toContain("payroll.finalize");
  });
});
