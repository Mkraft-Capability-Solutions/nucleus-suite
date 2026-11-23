import { describe, expect, it } from "vitest";

import {
  GOVERNANCE_FIELDS_NOT_RECORDED,
  buildDetections,
  buildGuardrailRows,
  buildModelRegister,
  buildReviewQueue,
  severityTone,
  summariseEvalSuites,
  type SafetyEvaluationRow,
} from "./nucleus-intelligence";

function evaluation(id: string, suite: string, name: string, pass: boolean, createdAt: string): SafetyEvaluationRow {
  return {
    id,
    ai_run_id: `run-${id}`,
    attributes: { suite, case: name, expected: "refuse", pass },
    created_at: createdAt,
  };
}

describe("severityTone", () => {
  it("maps recorded severity words onto tones, defaulting to neutral", () => {
    expect(severityTone("critical")).toBe("danger");
    expect(severityTone("Fail")).toBe("danger");
    expect(severityTone("medium")).toBe("warning");
    expect(severityTone("pass")).toBe("success");
    expect(severityTone("low")).toBe("info");
    expect(severityTone("something nobody mapped")).toBe("neutral");
  });
});

describe("buildDetections", () => {
  it("reads the pass/fail verdict as the severity word and lifts open items first", () => {
    const detections = buildDetections({
      evaluations: [
        evaluation("1", "refusal", "leave-approval", true, "2026-09-10T00:00:00.000Z"),
        evaluation("2", "injection", "role-override", false, "2026-09-01T00:00:00.000Z"),
      ],
      anomalies: [],
    });
    expect(detections.map((detection) => detection.severity)).toEqual(["Fail", "Pass"]);
    expect(detections[0].open).toBe(true);
    expect(detections[0].subject).toBe("injection · role-override");
  });

  it("shows the recorded payroll severity verbatim rather than a graded guess", () => {
    const detections = buildDetections({
      evaluations: [],
      anomalies: [{ id: "a1", rule_code: "NET_NEGATIVE", severity: "high", status: "open", employee_id: "e1" }],
    });
    expect(detections[0].severity).toBe("high");
    expect(detections[0].tone).toBe("danger");
    expect(detections[0].open).toBe(true);
  });

  it("says a severity is not recorded rather than inventing one", () => {
    const detections = buildDetections({
      evaluations: [],
      anomalies: [{ id: "a2", rule_code: "DRIFT", status: "resolved" }],
    });
    expect(detections[0].severity).toBe("Not recorded");
    expect(detections[0].open).toBe(false);
  });
});

describe("buildGuardrailRows", () => {
  it("reflects the recorded lifecycle state, never an assumed one", () => {
    const rows = buildGuardrailRows([
      {
        id: "action-1",
        attributes: { status: "proposed", autonomy_ceiling: "dry-run" },
        created_at: "2026-09-01T00:00:00.000Z",
        principal: { code: "hr-assistant" },
        tool: { code: "draft.prepare" },
        simulations: 1,
        outcomes: 0,
        reversals: 0,
      },
    ]);
    expect(rows[0]).toMatchObject({
      agent: "hr-assistant",
      tool: "draft.prepare",
      status: "proposed",
      tone: "warning",
      autonomyCeiling: "dry-run",
      dryRunRecorded: true,
      outcomeRecorded: false,
      reversed: false,
    });
  });

  it("marks a reversed action as reversed whatever its own status says", () => {
    const rows = buildGuardrailRows([
      { id: "action-2", attributes: { status: "completed" }, outcomes: 1, reversals: 1 },
    ]);
    expect(rows[0].reversed).toBe(true);
    expect(rows[0].tone).toBe("danger");
  });

  it("reports missing principal, tool and ceiling as not recorded", () => {
    const rows = buildGuardrailRows([{ id: "action-3", attributes: {} }]);
    expect(rows[0]).toMatchObject({
      agent: "Not recorded",
      tool: "Not recorded",
      autonomyCeiling: "Not recorded",
      status: "not recorded",
      dryRunRecorded: false,
      outcomeRecorded: false,
    });
  });
});

describe("summariseEvalSuites", () => {
  it("scores a defined suite from its recorded rows", () => {
    const suites = summariseEvalSuites(
      [
        evaluation("1", "refusal", "a", true, "2026-09-01T00:00:00.000Z"),
        evaluation("2", "refusal", "b", false, "2026-09-05T00:00:00.000Z"),
      ],
      { refusal: { description: "Consequential actions must be refused." } },
    );
    expect(suites).toHaveLength(1);
    expect(suites[0]).toMatchObject({
      suite: "refusal",
      passed: 1,
      total: 2,
      passRatePct: 50,
      everRun: true,
      lastRunAt: "2026-09-05T00:00:00.000Z",
    });
  });

  it("reports a defined suite that never ran as never run, not as zero passed", () => {
    const suites = summariseEvalSuites([], { citation: { description: "Policy answers must cite." } });
    expect(suites[0].everRun).toBe(false);
    expect(suites[0].passRatePct).toBeNull();
    expect(suites[0].lastRunAt).toBeNull();
  });

  it("keeps a recorded suite that is no longer declared in code", () => {
    const suites = summariseEvalSuites([evaluation("1", "retired", "a", true, "2026-01-01T00:00:00.000Z")], {});
    expect(suites[0].suite).toBe("retired");
    expect(suites[0].description).toBeNull();
  });
});

describe("buildModelRegister", () => {
  it("renders only the fields model_configs actually carries", () => {
    const register = buildModelRegister([
      { id: "m1", attributes: { model: "deterministic-fallback" }, created_at: "2026-01-01T00:00:00.000Z", runs: 4, last_run_at: "2026-09-01T00:00:00.000Z" },
      { id: "m2", attributes: {}, runs: null, last_run_at: null },
    ]);
    expect(register[0]).toEqual({
      id: "m1",
      model: "deterministic-fallback",
      runs: 4,
      registeredAt: "2026-01-01T00:00:00.000Z",
      lastRunAt: "2026-09-01T00:00:00.000Z",
    });
    expect(register[1]).toMatchObject({ model: "Not recorded", runs: 0, lastRunAt: null });
  });

  it("names every governance field the platform does not store", () => {
    const fields = GOVERNANCE_FIELDS_NOT_RECORDED.map((entry) => entry.field);
    expect(fields).toContain("Bias / fairness audit");
    expect(fields).toContain("DPDP or privacy impact assessment");
    expect(GOVERNANCE_FIELDS_NOT_RECORDED.every((entry) => entry.detail.length > 0)).toBe(true);
  });
});

describe("buildReviewQueue", () => {
  it("marks only a pending request as decidable and points at the real endpoint", () => {
    const queue = buildReviewQueue([
      { id: "r1", ai_run_id: "run-1", assigned_membership_id: null, attributes: { summary: "Check this answer", status: "pending" }, created_at: "2026-09-01T00:00:00.000Z" },
    ]);
    expect(queue[0].decidable).toBe(true);
    expect(queue[0].decideEndpoint).toBe("/api/v1/ai/reviews/r1/decide");
    expect(queue[0].decision).toBeNull();
  });

  it("carries the recorded decision and refuses to offer a second one", () => {
    const queue = buildReviewQueue([
      {
        id: "r2",
        ai_run_id: null,
        assigned_membership_id: "m1",
        attributes: { summary: "Reviewed", status: "decided" },
        created_at: "2026-09-01T00:00:00.000Z",
        decision: { decision: "rejected", comment: "Cited the wrong policy" },
        decided_at: "2026-09-02T00:00:00.000Z",
      },
    ]);
    expect(queue[0].decidable).toBe(false);
    expect(queue[0].decision).toBe("rejected");
    expect(queue[0].comment).toBe("Cited the wrong policy");
    expect(queue[0].runId).toBeNull();
  });
});
