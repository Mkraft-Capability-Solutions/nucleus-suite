import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXTENSION_MONTHS,
  REVIEW_DECISION_STATUS,
  decideConfirmationReviewSchema,
  effectiveDateRefusal,
  probationEndOf,
  submitConfirmationReviewSchema,
} from "./confirmation";

const UUID = "0b3f3d3a-6b6f-4f0b-9f4e-2f9b8c1d7e11";
const ASSESSMENT = "Consistently met production targets, completed induction and safety training, and works well with the shift team.";

describe("FRM-LCY-02 manager review schema", () => {
  const valid = { employeeId: UUID, recommendation: "confirm", probationRating: "meets_expectations", assessment: ASSESSMENT };

  it("takes the recommendation and rating from their picklists", () => {
    expect(submitConfirmationReviewSchema.safeParse(valid).success).toBe(true);
    expect(submitConfirmationReviewSchema.safeParse({ ...valid, recommendation: "promote" }).success).toBe(false);
    expect(submitConfirmationReviewSchema.safeParse({ ...valid, probationRating: "good" }).success).toBe(false);
  });

  it("holds the assessment to fifty characters and its field width", () => {
    expect(submitConfirmationReviewSchema.safeParse({ ...valid, assessment: "Did fine." }).success).toBe(false);
    expect(submitConfirmationReviewSchema.safeParse({ ...valid, assessment: "x".repeat(1000) }).success).toBe(true);
    expect(submitConfirmationReviewSchema.safeParse({ ...valid, assessment: "x".repeat(1001) }).success).toBe(false);
  });

  it("requires an extension reason of thirty characters only when extending, and defaults the months to three", () => {
    const extend = { ...valid, recommendation: "extend_probation" };
    expect(submitConfirmationReviewSchema.safeParse(extend).success).toBe(false);
    expect(submitConfirmationReviewSchema.safeParse({ ...extend, extensionReason: "Needs more time." }).success).toBe(false);
    const parsed = submitConfirmationReviewSchema.safeParse({ ...extend, extensionReason: "Safety certification still outstanding after the first quarter." });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.extensionMonths).toBe(DEFAULT_EXTENSION_MONTHS);
    expect(submitConfirmationReviewSchema.safeParse({ ...extend, extensionMonths: 7, extensionReason: "Safety certification still outstanding after the first quarter." }).success).toBe(false);
    expect(submitConfirmationReviewSchema.safeParse({ ...extend, extensionMonths: 0, extensionReason: "Safety certification still outstanding after the first quarter." }).success).toBe(false);
  });
});

describe("FRM-LCY-02 HR decision schema", () => {
  it("defaults the letter on and the salary revision off", () => {
    const parsed = decideConfirmationReviewSchema.parse({ decision: "approve" });
    expect(parsed.issueLetter).toBe(true);
    expect(parsed.reviseSalary).toBe(false);
  });

  it("requires remarks on anything but an approval", () => {
    expect(decideConfirmationReviewSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(decideConfirmationReviewSchema.safeParse({ decision: "reject", remarks: "Assessment does not support confirmation." }).success).toBe(true);
    expect(REVIEW_DECISION_STATUS.return_for_correction).toBe("draft");
    expect(REVIEW_DECISION_STATUS.delegate).toBe("pending_approval");
  });

  it("needs the revised basic when the salary revision toggle is on", () => {
    expect(decideConfirmationReviewSchema.safeParse({ decision: "approve", reviseSalary: true }).success).toBe(false);
    expect(decideConfirmationReviewSchema.safeParse({ decision: "approve", reviseSalary: true, salaryRevision: { newBasicMinor: 32_000_00 } }).success).toBe(true);
    expect(decideConfirmationReviewSchema.safeParse({ decision: "approve", reviseSalary: true, salaryRevision: { newBasicMinor: 0 } }).success).toBe(false);
  });

  it("accepts only an ISO effective date", () => {
    expect(decideConfirmationReviewSchema.safeParse({ decision: "approve", confirmationEffectiveDate: "2026-10-01" }).success).toBe(true);
    expect(decideConfirmationReviewSchema.safeParse({ decision: "approve", confirmationEffectiveDate: "01/10/2026" }).success).toBe(false);
  });
});

describe("probation end and effective date", () => {
  it("reads the recorded end first, then joining plus months, and otherwise nothing", () => {
    expect(probationEndOf({ probationEndDate: "2026-09-30", probationMonths: 6, joiningDate: "2026-01-15" })).toBe("2026-09-30");
    expect(probationEndOf({ probationEndDate: null, probationMonths: 6, joiningDate: "2026-01-15" })).toBe("2026-07-15");
    expect(probationEndOf({ probationEndDate: null, probationMonths: "3", joiningDate: "2026-11-30" })).toBe("2027-02-28");
    expect(probationEndOf({ probationEndDate: null, probationMonths: null, joiningDate: "2026-01-15" })).toBeNull();
    expect(probationEndOf({ probationEndDate: null, probationMonths: 6, joiningDate: null })).toBeNull();
  });

  it("refuses a date before joining, and a backdated one without a reason", () => {
    const base = { today: "2026-09-15", joiningDate: "2026-03-01" };
    expect(effectiveDateRefusal({ ...base, effectiveDate: "2026-02-01", backdatingReason: "late" })).toContain("joining date");
    expect(effectiveDateRefusal({ ...base, effectiveDate: "2026-09-01", backdatingReason: null })).toContain("backdated");
    expect(effectiveDateRefusal({ ...base, effectiveDate: "2026-09-01", backdatingReason: "Review meeting slipped past the due date." })).toBeNull();
    expect(effectiveDateRefusal({ ...base, effectiveDate: "2026-09-15", backdatingReason: null })).toBeNull();
    expect(effectiveDateRefusal({ ...base, effectiveDate: "2026-10-01", backdatingReason: null })).toBeNull();
  });
});
