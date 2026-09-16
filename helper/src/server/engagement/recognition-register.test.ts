import { describe, expect, it } from "vitest";
import {
  CITATION_MIN_LENGTH,
  RECOGNITION_ACTIONS,
  nominationWindowState,
  projectRecognitionRow,
  readProgrammeConfig,
  recognitionActionGates,
  recognitionTimeline,
  recognitionTransition,
  validateNomination,
  certificateReferenceFor,
  planRecognitionCertificate,
  readCertificate,
  type NominationContext,
  type NominationInput,
  type ProgrammeConfig,
  type RecognitionAction,
  type RecognitionRecordState,
  type RecognitionRegisterRaw,
  type RecognitionState,
  type RecognitionViewer,
} from "@/server/engagement/recognition-register";

const NOMINATOR = "11111111-1111-4111-8111-111111111111";
const NOMINEE = "22222222-2222-4222-8222-222222222222";
const COMMITTEE = "33333333-3333-4333-8333-333333333333";
const PROGRAMME_ID = "44444444-4444-4444-8444-444444444444";

/** 62 characters — comfortably over the printed-certificate minimum. */
const GOOD_CITATION =
  "Rebuilt the payroll reconciliation runbook and trained two teams.";

const programme = (attributes: Record<string, unknown> = {}): ProgrammeConfig =>
  readProgrammeConfig(PROGRAMME_ID, { name: "Star of the month", code: "STAR-MONTHLY", ...attributes });

function nomination(overrides: Partial<NominationInput> = {}): NominationInput {
  return {
    nominatorEmployeeId: NOMINATOR,
    recipientEmployeeId: NOMINEE,
    citation: GOOD_CITATION,
    awardMinor: 500_000,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    ...overrides,
  };
}

function context(overrides: Partial<NominationContext> = {}): NominationContext {
  return { recipientActive: true, programme: programme(), today: "2026-09-14", ...overrides };
}

const fields = (issues: Array<{ field: string; issue: string }>): string[] => issues.map((issue) => issue.field);

function record(overrides: Partial<RecognitionRecordState> = {}): RecognitionRecordState {
  return {
    state: "nominated",
    nominatorEmployeeId: NOMINATOR,
    recipientEmployeeId: NOMINEE,
    awardMinor: 500_000,
    citationLength: GOOD_CITATION.length,
    announcementId: null,
    paymentRecorded: false,
    ...overrides,
  };
}

const committee: RecognitionViewer = { employeeId: COMMITTEE, permissions: ["employee.read", "employee.write"] };

function gate(action: RecognitionAction, state: RecognitionRecordState, viewer: RecognitionViewer = committee) {
  const found = recognitionActionGates(state, viewer).find((candidate) => candidate.action === action);
  if (!found) throw new Error(`no gate for ${action}`);
  return found;
}

describe("recognition citation minimum (SCR-065)", () => {
  it("refuses a citation under 50 characters and states the shortfall", () => {
    expect(CITATION_MIN_LENGTH).toBe(50);
    const short = "Great work this quarter.";
    expect(short.length).toBeLessThan(CITATION_MIN_LENGTH);
    const result = validateNomination(nomination({ citation: short }), context());
    expect(result.ok).toBe(false);
    expect(fields(result.issues)).toContain("citation");
    expect(result.issues.find((issue) => issue.field === "citation")?.issue).toContain(String(short.length));
  });

  it("refuses an empty or whitespace-only citation as mandatory", () => {
    const blank = validateNomination(nomination({ citation: "   " }), context());
    expect(blank.ok).toBe(false);
    expect(blank.issues.find((issue) => issue.field === "citation")?.issue).toContain("mandatory");
  });

  it("accepts a citation of exactly the minimum length", () => {
    const exact = "x".repeat(CITATION_MIN_LENGTH);
    expect(validateNomination(nomination({ citation: exact }), context()).ok).toBe(true);
    expect(validateNomination(nomination({ citation: "x".repeat(CITATION_MIN_LENGTH - 1) }), context()).ok).toBe(false);
  });

  it("blocks approval of an award whose stored citation is too short", () => {
    const decision = gate("approve", record({ citationLength: 12 }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("50-character minimum");
  });
});

describe("recognition self-nomination refusal (SCR-065)", () => {
  it("refuses a nomination where the nominator is the nominee", () => {
    const result = validateNomination(nomination({ recipientEmployeeId: NOMINATOR }), context());
    expect(result.ok).toBe(false);
    expect(result.issues.find((issue) => issue.field === "nominee")?.issue).toContain("Self-nomination is not allowed");
  });

  it("refuses a nominee without an active assignment", () => {
    const result = validateNomination(nomination(), context({ recipientActive: false }));
    expect(result.ok).toBe(false);
    expect(result.issues.find((issue) => issue.field === "nominee")?.issue).toContain("no active assignment");
  });

  it("refuses a nomination from an account with no linked employee profile", () => {
    const result = validateNomination(nomination({ nominatorEmployeeId: null }), context());
    expect(result.ok).toBe(false);
    expect(fields(result.issues)).toContain("nominator");
  });

  it("refuses the nominee and the nominator as deciders but allows a third party", () => {
    const nominee: RecognitionViewer = { employeeId: NOMINEE, permissions: ["employee.write"] };
    const nominator: RecognitionViewer = { employeeId: NOMINATOR, permissions: ["employee.write"] };
    expect(gate("approve", record(), nominee).allowed).toBe(false);
    expect(gate("approve", record(), nominee).reason).toContain("their own recognition award");
    expect(gate("reject", record(), nominator).allowed).toBe(false);
    expect(gate("reject", record(), nominator).reason).toContain("raised this nomination");
    expect(gate("approve", record(), committee).allowed).toBe(true);
  });
});

describe("recognition programme ceiling (SCR-065)", () => {
  it("enforces a configured ceiling and reports that it enforced one", () => {
    const capped = context({ programme: programme({ award_ceiling_minor: 250_000 }) });
    const over = validateNomination(nomination({ awardMinor: 250_001 }), capped);
    expect(over.ok).toBe(false);
    expect(over.ceilingEnforced).toBe(true);
    expect(over.issues.find((issue) => issue.field === "awardValue")?.issue).toContain("250000");

    const atCeiling = validateNomination(nomination({ awardMinor: 250_000 }), capped);
    expect(atCeiling.ok).toBe(true);
    expect(atCeiling.ceilingEnforced).toBe(true);
  });

  it("invents no ceiling when the programme configures none", () => {
    const uncapped = programme();
    expect(uncapped.ceilingConfigured).toBe(false);
    expect(uncapped.awardCeilingMinor).toBeNull();
    expect(uncapped.defaultConfigured).toBe(false);
    expect(uncapped.defaultAwardMinor).toBeNull();

    const huge = validateNomination(nomination({ awardMinor: 999_999_999 }), context({ programme: uncapped }));
    expect(huge.ok).toBe(true);
    expect(huge.ceilingEnforced).toBe(false);
    expect(fields(huge.issues)).not.toContain("awardValue");
  });

  it("reads the default award only when the programme carries one", () => {
    expect(programme({ default_award_minor: 100_000 }).defaultAwardMinor).toBe(100_000);
    expect(programme({ default_award_minor: "not-a-number" }).defaultAwardMinor).toBeNull();
    expect(programme({ award_ceiling_minor: -5 }).awardCeilingMinor).toBeNull();
  });

  it("accepts a nomination with no monetary component at all (RL-490)", () => {
    const result = validateNomination(nomination({ awardMinor: null }), context({ programme: programme({ award_ceiling_minor: 1 }) }));
    expect(result.ok).toBe(true);
  });
});

describe("recognition nomination window (SCR-065)", () => {
  it("reports an unconfigured window and refuses nothing on it", () => {
    const open = programme();
    expect(nominationWindowState(open, "2026-09-14")).toBe("not_configured");
    const result = validateNomination(nomination(), context({ programme: open }));
    expect(result.ok).toBe(true);
    expect(result.windowEnforced).toBe(false);
  });

  it("refuses a nomination before the window opens and after it closes", () => {
    const windowed = programme({ nomination_opens_on: "2026-09-01", nomination_closes_on: "2026-09-10" });
    expect(nominationWindowState(windowed, "2026-08-31")).toBe("not_yet_open");
    expect(nominationWindowState(windowed, "2026-09-05")).toBe("open");
    expect(nominationWindowState(windowed, "2026-09-11")).toBe("closed");

    const late = validateNomination(nomination(), context({ programme: windowed, today: "2026-09-11" }));
    expect(late.ok).toBe(false);
    expect(late.windowEnforced).toBe(true);
    expect(late.issues.find((issue) => issue.field === "programme")?.issue).toContain("closed");
  });

  it("requires a period and refuses one that ends before it starts (RL-490)", () => {
    expect(validateNomination(nomination({ periodEnd: "2026-08-01" }), context()).ok).toBe(false);
    expect(validateNomination(nomination({ periodStart: "" }), context()).ok).toBe(false);
  });
});

describe("recognition committee decision (SCR-065)", () => {
  it("marks reject as the one action that demands a reason", () => {
    const gates = recognitionActionGates(record(), committee);
    expect(gates.find((candidate) => candidate.action === "reject")?.requiresReason).toBe(true);
    expect(gates.filter((candidate) => candidate.requiresReason).map((candidate) => candidate.action)).toEqual(["reject"]);
  });

  it("refuses every write to a caller without employee.write", () => {
    const reader: RecognitionViewer = { employeeId: COMMITTEE, permissions: ["employee.read"] };
    for (const action of RECOGNITION_ACTIONS) {
      const candidate = gate(action, record({ state: action === "mark_paid" ? "published" : action === "publish" ? "approved" : "nominated" }), reader);
      expect(candidate.allowed).toBe(false);
    }
    expect(gate("approve", record(), reader).reason).toContain("employee.write");
  });

  it("refuses a decider with no linked employee profile", () => {
    const unlinked: RecognitionViewer = { employeeId: null, permissions: ["employee.write"] };
    expect(gate("approve", record(), unlinked).allowed).toBe(false);
    expect(gate("approve", record(), unlinked).reason).toContain("employee profile");
  });
});

describe("recognition state machine (SCR-065)", () => {
  it("walks the four states in order", () => {
    expect(recognitionTransition("nominated", "approve")).toBe("approved");
    expect(recognitionTransition("approved", "publish")).toBe("published");
    expect(recognitionTransition("published", "mark_paid")).toBe("paid");
    expect(recognitionTransition("nominated", "reject")).toBe("rejected");
  });

  it("refuses every illegal transition", () => {
    const illegal: Array<[RecognitionState, RecognitionAction]> = [
      ["nominated", "publish"],
      ["nominated", "mark_paid"],
      ["approved", "approve"],
      ["approved", "reject"],
      ["approved", "mark_paid"],
      ["published", "approve"],
      ["published", "publish"],
      ["paid", "approve"],
      ["paid", "publish"],
      ["paid", "mark_paid"],
      ["rejected", "approve"],
      ["rejected", "reject"],
      ["rejected", "publish"],
      ["rejected", "mark_paid"],
    ];
    for (const [state, action] of illegal) {
      expect(recognitionTransition(state, action)).toBeNull();
      expect(gate(action, record({ state })).allowed).toBe(false);
    }
  });

  it("states the illegal transition in the words the screen shows", () => {
    const refusal = gate("mark_paid", record({ state: "nominated" }));
    expect(refusal.reason).toContain("only possible from published");
    expect(refusal.reason).toContain("This award is nominated");
  });

  it("refuses marking an award paid when it carries no money, and twice over", () => {
    const noMoney = gate("mark_paid", record({ state: "published", awardMinor: null }));
    expect(noMoney.allowed).toBe(false);
    expect(noMoney.reason).toContain("no monetary component");

    expect(gate("mark_paid", record({ state: "published", awardMinor: 0 })).allowed).toBe(false);
    const again = gate("mark_paid", record({ state: "published", paymentRecorded: true }));
    expect(again.allowed).toBe(false);
    expect(again.reason).toContain("already recorded");
    expect(gate("mark_paid", record({ state: "published" })).allowed).toBe(true);
  });

  it("refuses a second announcement for an award that already has one", () => {
    const again = gate("publish", record({ state: "approved", announcementId: "a-1" }));
    expect(again.allowed).toBe(false);
    expect(again.reason).toContain("already published");
  });

  it("marks the timeline current, done and halted", () => {
    const published = recognitionTimeline("published", ["nominated", "approved"]);
    expect(published.map((stage) => stage.state)).toEqual(["done", "done", "current", "pending"]);
    const rejected = recognitionTimeline("rejected", ["nominated"]);
    expect(rejected.map((stage) => stage.state)).toEqual(["done", "halted", "halted", "halted"]);
  });
});

describe("recognition row projection (SCR-065)", () => {
  const raw = (attributes: Record<string, unknown>, overrides: Partial<RecognitionRegisterRaw> = {}): RecognitionRegisterRaw => ({
    id: "55555555-5555-4555-8555-555555555555",
    version: 3,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: null,
    recipient_employee_id: NOMINEE,
    nominator_employee_id: NOMINATOR,
    recognition_program_id: PROGRAMME_ID,
    attributes,
    recipient_code: "E-100",
    recipient_first_name: "Asha",
    recipient_last_name: "Rao",
    recipient_designation: "Analyst",
    recipient_department: "Finance",
    recipient_status: "active",
    nominator_code: "E-200",
    nominator_first_name: "Devi",
    nominator_last_name: "Menon",
    programme_attributes: { name: "Star of the month", code: "STAR-MONTHLY" },
    recipient_has_assignment: true,
    announcement_id: null,
    announcement_attributes: null,
    announcement_created_at: null,
    payment_id: null,
    payment_attributes: null,
    payment_created_at: null,
    trail: [],
    ...overrides,
  });

  it("projects a full award with its decision and its announcement", () => {
    const row = projectRecognitionRow(
      raw(
        {
          state: "published",
          citation: GOOD_CITATION,
          award_minor: 250_000,
          currency: "INR",
          period_start: "2026-09-01",
          period_end: "2026-09-30",
          decision_outcome: "approved",
          decision_at: "2026-09-05T00:00:00.000Z",
          decision_reason: "Unanimous",
        },
        {
          announcement_id: "66666666-6666-4666-8666-666666666666",
          announcement_attributes: { title: "Asha Rao — Star of the month", body: GOOD_CITATION, audience: "all" },
          announcement_created_at: "2026-09-05T01:00:00.000Z",
          trail: [{ action: "engage.recognition_approve", reason: "Unanimous", created_at: "2026-09-05T00:00:00.000Z" }],
        },
      ),
      committee,
    );
    expect(row.state).toBe("published");
    expect(row.nomineeName).toBe("Asha Rao");
    expect(row.programmeName).toBe("Star of the month");
    expect(row.awardMinor).toBe(250_000);
    expect(row.citationMeetsMinimum).toBe(true);
    expect(row.decision).toEqual({ outcome: "approved", at: "2026-09-05T00:00:00.000Z", reason: "Unanimous" });
    expect(row.announcement?.id).toBe("66666666-6666-4666-8666-666666666666");
    expect(row.legacyKudos).toBe(false);
    expect(row.timeline.map((stage) => stage.state)).toEqual(["done", "done", "current", "pending"]);
    expect(row.audit).toHaveLength(1);
    expect(row.actions.find((candidate) => candidate.action === "mark_paid")?.allowed).toBe(true);
  });

  it("treats a legacy kudos row as Nominated, flags it, and refuses to approve it", () => {
    const row = projectRecognitionRow(raw({ message: "Nice work!", points: 100 }), committee);
    expect(row.state).toBe("nominated");
    expect(row.legacyKudos).toBe(true);
    expect(row.citation).toBe("Nice work!");
    expect(row.citationMeetsMinimum).toBe(false);
    expect(row.awardMinor).toBeNull();
    expect(row.periodStart).toBeNull();
    expect(row.programme?.ceilingConfigured).toBe(false);
    expect(row.actions.find((candidate) => candidate.action === "approve")?.allowed).toBe(false);
  });

  it("falls back to Nominated for an unrecognised stored state", () => {
    expect(projectRecognitionRow(raw({ state: "banana", citation: GOOD_CITATION }), committee).state).toBe("nominated");
  });

  it("reads a recorded payment without treating it as points", () => {
    const row = projectRecognitionRow(
      raw(
        { state: "paid", citation: GOOD_CITATION, award_minor: 250_000 },
        {
          payment_id: "77777777-7777-4777-8777-777777777777",
          payment_attributes: { amount_minor: 250_000, currency: "INR", payment_reference: "NEFT-9001", paid_on: "2026-09-12" },
          payment_created_at: "2026-09-12T00:00:00.000Z",
        },
      ),
      committee,
    );
    expect(row.payment).toEqual({
      id: "77777777-7777-4777-8777-777777777777",
      amountMinor: 250_000,
      currency: "INR",
      reference: "NEFT-9001",
      paidOn: "2026-09-12",
      recordedAt: "2026-09-12T00:00:00.000Z",
    });
    expect(row.actions.every((candidate) => !candidate.allowed)).toBe(true);
  });
});

describe("the award certificate carries the period and the criteria (T-33)", () => {
  const FACTS = {
    id: "8f14e45f-ceea-467a-9c2b-9e0f0e0a1111",
    nomineeName: "Asha Rao",
    nomineeCode: "MK-0001",
    nomineeDesignation: "Spinning Operator",
    programmeName: "Star of the month",
    awardCategory: "star_performer",
    citation: GOOD_CITATION,
    awardMinor: 250_000,
    currency: "INR",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
  };

  it("issues a certificate naming both, with a deterministic reference", () => {
    const plan = planRecognitionCertificate(FACTS, "2026-10-01");
    expect(plan.issue).toBe(true);
    if (!plan.issue) return;
    expect(plan.certificate.reference).toBe(certificateReferenceFor(FACTS.id));
    expect(plan.certificate.period).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(plan.certificate.criteria).toEqual({ code: "star_performer", label: "Star performer" });
    // The printable text must show both; a certificate that only stored them is not one.
    const printed = plan.certificate.lines.join("\n");
    expect(printed).toContain("2026-09-01 to 2026-09-30");
    expect(printed).toContain("Star performer");
  });

  it("refuses to issue one that would omit the period or the criteria", () => {
    const noPeriod = planRecognitionCertificate({ ...FACTS, periodEnd: null }, "2026-10-01");
    expect(noPeriod.issue).toBe(false);
    if (!noPeriod.issue) expect(noPeriod.reason).toContain("the award period");
    const noCriteria = planRecognitionCertificate({ ...FACTS, awardCategory: null }, "2026-10-01");
    expect(noCriteria.issue).toBe(false);
    if (!noCriteria.issue) expect(noCriteria.reason).toContain("the nomination criteria");
  });

  it("reads a stamped certificate back, and reads a partial one as none", () => {
    const plan = planRecognitionCertificate(FACTS, "2026-10-01");
    if (!plan.issue) throw new Error("expected a certificate");
    const stored = {
      reference: plan.certificate.reference,
      issued_on: plan.certificate.issuedOn,
      nominee_name: plan.certificate.nomineeName,
      programme: plan.certificate.programme,
      period: plan.certificate.period,
      criteria: plan.certificate.criteria,
      citation: plan.certificate.citation,
      award_minor: plan.certificate.awardMinor,
      currency: plan.certificate.currency,
      lines: plan.certificate.lines,
    };
    expect(readCertificate(stored)?.period).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(readCertificate({ ...stored, period: { start: "2026-09-01" } })).toBeNull();
    expect(readCertificate(null)).toBeNull();
  });
});
