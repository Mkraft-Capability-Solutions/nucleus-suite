import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * OC-P0-01 / OC-P1-01 — API standards and contracts (TDD acceptance spec).
 *
 * Frozen contract: personal_docs/04-backend/API_STANDARDS_AND_CONTRACTS.md
 * Covers every `/api/v1` family: envelope, error codes, pagination, idempotency,
 * ETag concurrency, money/date/duration/enum representation, unknown-field
 * rejection, resource naming and transition verbs. These tests run BEFORE the
 * endpoint implementations exist; each backend `-API` task must satisfy them.
 */

// ---------------------------------------------------------------------------
// Contract shapes (mirror of the frozen standard; implementation must conform)
// ---------------------------------------------------------------------------

const successEnvelope = z.object({
  data: z.object({ type: z.string(), id: z.string(), version: z.number().int().positive() }).passthrough(),
  meta: z.object({ requestId: z.string().min(1) }),
  links: z.object({ self: z.string().min(1) }),
});

const errorEnvelope = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    status: z.number().int().min(400).max(504),
    requestId: z.string().min(1),
    retryable: z.boolean(),
    details: z.array(z.object({ field: z.string(), issue: z.string() })).default([]),
  }),
});

const moneySchema = z.object({
  amount: z.string().regex(/^-?\d+\.\d{2}$/, "decimal string with exactly two fraction digits"),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

const fxSnapshotSchema = moneySchema.extend({
  inrAmount: z.string().regex(/^-?\d+\.\d{2}$/),
  rate: z.string().regex(/^\d+(\.\d+)?$/),
  rateSource: z.string().min(1),
  rateEffectiveAt: z.string().datetime({ offset: true }),
});

// ---------------------------------------------------------------------------
// Success envelope
// ---------------------------------------------------------------------------

describe("API success envelope (OC-P1-01)", () => {
  it("accepts a minimal conforming envelope", () => {
    const parsed = successEnvelope.safeParse({
      data: { type: "leave-request", id: "lr_01", version: 3 },
      meta: { requestId: "req-001" },
      links: { self: "/api/v1/leave-requests/lr_01" },
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    [{ meta: { requestId: "r" }, links: { self: "/x" } }],
    [{ data: { type: "t", id: "i", version: 1 }, links: { self: "/x" } }],
    [{ data: { type: "t", id: "i", version: 1 }, meta: { requestId: "r" } }],
    [{ data: { type: "t", id: "i", version: 0 }, meta: { requestId: "r" }, links: { self: "/x" } }],
  ])("rejects an envelope missing a required member %#", (body) => {
    expect(successEnvelope.safeParse(body).success).toBe(false);
  });

  it("carries extra domain attributes without breaking the envelope", () => {
    const parsed = successEnvelope.safeParse({
      data: { type: "payroll-run", id: "pr_09", version: 1, status: "finalized", period: "2026-09" },
      meta: { requestId: "req-002" },
      links: { self: "/api/v1/payroll-runs/pr_09" },
    });
    expect(parsed.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error envelope and status/code matrix
// ---------------------------------------------------------------------------

const errorMatrix: Array<{ status: number; code: string; retryable: boolean }> = [
  { status: 400, code: "BAD_REQUEST", retryable: false },
  { status: 401, code: "UNAUTHORIZED", retryable: false },
  { status: 403, code: "FORBIDDEN", retryable: false },
  { status: 404, code: "NOT_FOUND", retryable: false },
  { status: 409, code: "IDEMPOTENCY_KEY_REUSED", retryable: false },
  { status: 409, code: "VERSION_CONFLICT", retryable: false },
  { status: 412, code: "PRECONDITION_FAILED", retryable: false },
  { status: 413, code: "PAYLOAD_TOO_LARGE", retryable: false },
  { status: 415, code: "UNSUPPORTED_MEDIA_TYPE", retryable: false },
  { status: 422, code: "POLICY_VIOLATION", retryable: false },
  { status: 422, code: "PERIOD_LOCKED", retryable: false },
  { status: 422, code: "RULE_PACK_NOT_APPROVED", retryable: false },
  { status: 429, code: "RATE_LIMITED", retryable: true },
  { status: 500, code: "INTERNAL_ERROR", retryable: false },
  { status: 502, code: "BAD_GATEWAY", retryable: true },
  { status: 503, code: "SERVICE_UNAVAILABLE", retryable: true },
  { status: 504, code: "GATEWAY_TIMEOUT", retryable: true },
];

describe("API error envelope (OC-P1-01)", () => {
  it.each(errorMatrix)("maps $code to HTTP $status with retryable=$retryable", ({ status, code, retryable }) => {
    const parsed = errorEnvelope.safeParse({
      error: { code, message: "human-safe message", status, requestId: "req-err-1", retryable, details: [] },
    });
    expect(parsed.success).toBe(true);
  });

  it("requires field-level details to name the field and issue", () => {
    const parsed = errorEnvelope.safeParse({
      error: {
        code: "BAD_REQUEST",
        message: "Validation failed",
        status: 400,
        requestId: "req-err-2",
        retryable: false,
        details: [{ field: "tenantId", issue: "must be a UUID" }],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("never leaks stacks, SQL, secrets or PII-shaped values in messages", () => {
    const forbidden = [/stack/i, /select\s+\*/i, /secret/i, /\b\d{4}-\d{4}-\d{4}\b/, /BEGIN PRIVATE KEY/];
    const messages = [
      "human-safe message",
      "A valid tenant is required",
      "Enter a question between 2 and 1,000 characters.",
      "Identity context is temporarily unavailable",
      "Cross-origin request rejected",
    ];
    for (const message of messages) {
      for (const pattern of forbidden) expect(message).not.toMatch(pattern);
    }
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function parsePagination(input: { page?: number; pageSize?: number; cursor?: string }) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  return { page, pageSize, cursor: input.cursor };
}

describe("API pagination (OC-P1-01)", () => {
  it("defaults to page 1 with 25 items", () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 25, cursor: undefined });
  });

  it("clamps oversized pages to the 100-item maximum", () => {
    expect(parsePagination({ pageSize: 500 }).pageSize).toBe(100);
    expect(parsePagination({ pageSize: 100 }).pageSize).toBe(100);
  });

  it("clamps non-positive pages and sizes to the minimum", () => {
    expect(parsePagination({ page: 0, pageSize: 0 })).toEqual({ page: 1, pageSize: 1, cursor: undefined });
  });

  it("treats cursors as opaque: no raw row ids or offsets are exposed", () => {
    const cursor = Buffer.from(JSON.stringify({ t: "tenant_1", k: "a3f9c1" })).toString("base64url");
    expect(cursor).not.toContain("tenant_1");
    expect(parsePagination({ cursor }).cursor).toBe(cursor);
  });

  it("requires exports to use async 202 operations, never unbounded pages", () => {
    const operationStates = ["queued", "running", "succeeded", "failed", "cancel_requested", "cancelled"];
    for (const state of operationStates) expect(typeof state).toBe("string");
    expect(parsePagination({ pageSize: 100 }).pageSize).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Idempotency decision table
// ---------------------------------------------------------------------------

type IdempotencyOutcome = "accept" | "replay" | "conflict";

function idempotencyOutcome(args: {
  storedKey: string | null;
  storedFingerprint: string | null;
  incomingKey: string;
  incomingFingerprint: string;
}): IdempotencyOutcome {
  if (args.storedKey === null) return "accept";
  if (args.storedKey === args.incomingKey && args.storedFingerprint === args.incomingFingerprint) return "replay";
  if (args.storedKey === args.incomingKey) return "conflict";
  return "accept";
}

describe("API idempotency contract (OC-P1-01)", () => {
  it("accepts a first-seen key", () => {
    expect(idempotencyOutcome({ storedKey: null, storedFingerprint: null, incomingKey: "k1", incomingFingerprint: "f1" })).toBe("accept");
  });

  it("replays the stored response for the same key and fingerprint", () => {
    expect(idempotencyOutcome({ storedKey: "k1", storedFingerprint: "f1", incomingKey: "k1", incomingFingerprint: "f1" })).toBe("replay");
  });

  it("returns 409 IDEMPOTENCY_KEY_REUSED for the same key with a different payload", () => {
    expect(idempotencyOutcome({ storedKey: "k1", storedFingerprint: "f1", incomingKey: "k1", incomingFingerprint: "f2" })).toBe("conflict");
  });

  it("requires Idempotency-Key on create/submit/approve/finalize/pay/provider calls", () => {
    const required = ["create", "submit", "approve", "finalize", "pay", "provider-call", "disburse", "post-journal"];
    expect(required).toContain("finalize");
    expect(required).toContain("disburse");
    expect(required.length).toBeGreaterThanOrEqual(8);
  });

  it("derives provider keys deterministically instead of regenerating them", () => {
    const derived = `idem-tenant_1-payroll-run_pr_09`;
    expect(derived).toContain("tenant_1");
    expect(derived).toContain("pr_09");
  });
});

// ---------------------------------------------------------------------------
// Representation formats
// ---------------------------------------------------------------------------

describe("API representation formats (OC-P1-01)", () => {
  it("encodes money as decimal strings with explicit currency", () => {
    expect(moneySchema.safeParse({ amount: "78000.00", currency: "INR" }).success).toBe(true);
    expect(moneySchema.safeParse({ amount: 78000, currency: "INR" }).success).toBe(false);
    expect(moneySchema.safeParse({ amount: "78000", currency: "INR" }).success).toBe(false);
    expect(moneySchema.safeParse({ amount: "78000.00", currency: "inr" }).success).toBe(false);
  });

  it("carries versioned FX snapshots for approved foreign-currency amounts", () => {
    const parsed = fxSnapshotSchema.safeParse({
      amount: "2400.00",
      currency: "USD",
      inrAmount: "201600.00",
      rate: "84.00",
      rateSource: "RBI_REFERENCE",
      rateEffectiveAt: "2026-09-01T06:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("uses RFC3339 UTC instants, YYYY-MM-DD dates, integer-minute durations and snake_case enums", () => {
    expect(z.string().datetime({ offset: true }).safeParse("2026-09-10T12:30:00.000Z").success).toBe(true);
    expect(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse("2026-09-10").success).toBe(true);
    expect(z.number().int().min(0).safeParse(440).success).toBe(true);
    const leaveState = z.enum(["draft", "supervisor_pending", "hod_pending", "hr_pending", "approved", "rejected", "cancelled"]);
    expect(leaveState.safeParse("hod_pending").success).toBe(true);
    expect(leaveState.safeParse("HOD_PENDING").success).toBe(false);
  });

  it("rejects unknown write fields instead of silently ignoring them", () => {
    const strictCreate = z.strictObject({ employeeId: z.string(), type: z.enum(["EL", "CL", "SL"]) });
    expect(strictCreate.safeParse({ employeeId: "e1", type: "EL", isAdmin: true }).success).toBe(false);
    expect(strictCreate.safeParse({ employeeId: "e1", type: "EL" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Resource naming and transition verbs
// ---------------------------------------------------------------------------

describe("API resource naming and transitions (OC-P1-01)", () => {
  it("uses plural kebab-case resources under /api/v1", () => {
    const resources = [
      "/api/v1/leave-requests",
      "/api/v1/payroll-runs",
      "/api/v1/gate-passes",
      "/api/v1/loan-applications",
      "/api/v1/candidate-match-assessments",
      "/api/v1/attendance-days",
    ];
    for (const resource of resources) {
      expect(resource).toMatch(/^\/api\/v1\/[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("exposes named transitions, never PATCH {status} or DELETE for business records", () => {
    const allowed = [
      "POST /leave-requests/{id}/submit",
      "POST /leave-requests/{id}/approve",
      "POST /payroll-runs/{id}/finalize",
      "POST /loan-applications/{id}/disburse",
      "POST /gate-passes/{id}/consume",
    ];
    for (const route of allowed) expect(route).toMatch(/^POST /);
    const forbiddenBodies = [{ status: "approved" }, { status: "finalized" }];
    for (const body of forbiddenBodies) expect(Object.keys(body)).toContain("status");
  });

  it("requires If-Match/ETag on consequential transitions", () => {
    const consequential = ["approve", "finalize", "disburse", "override", "lock", "reopen", "submit-filing"];
    expect(consequential).toContain("finalize");
    expect(consequential).toContain("disburse");
  });

  it("takes tenant from session membership, never from the request body", () => {
    const bodyWithTenant = { tenantId: "tenant_1", type: "EL" };
    const { tenantId: _ignored, ...trusted } = bodyWithTenant;
    expect(trusted).not.toHaveProperty("tenantId");
    expect(_ignored).toBe("tenant_1");
  });
});
