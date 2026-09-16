import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { planReferralAward, type ReferralAwardScheme } from "@/server/talent/pipeline";
import {
  AWARD_MATURATION_LABELS,
  AWARD_MATURATION_STATES,
  REFERRAL_TRACKING_STATES,
  awardActionFor,
  deriveAwardMaturation,
  forfeitureReason,
  referralTrackingState,
  type AwardMaturationState,
} from "./referral-tracking";

/**
 * Fixture values only. They are deliberately NOT the reference screen's
 * 25,000 / 10,000 / 15,000 / 90 days: those figures exist only in a demo string
 * file, and a test that repeated them would make them look like a default.
 */
const SCHEME: ReferralAwardScheme = {
  code: "REF-PROG-TEST",
  currency: "INR",
  joiningAmountMinor: 700_000,
  confirmationAmountMinor: 1_300_000,
  confirmationTenureDays: 45,
};

function plan(args: {
  scheme?: ReferralAwardScheme | null;
  joinedOn?: string | null;
  confirmedOn?: string | null;
  tenureDays?: number | null;
  disbursed?: readonly string[];
}) {
  return planReferralAward({
    scheme: args.scheme === undefined ? SCHEME : args.scheme,
    joinedOn: args.joinedOn ?? null,
    confirmedOn: args.confirmedOn ?? null,
    confirmationCaptured: (args.confirmedOn ?? null) !== null,
    tenureDays: args.tenureDays ?? null,
    disbursedMilestones: args.disbursed ?? [],
  });
}

function maturationOf(args: Parameters<typeof plan>[0] & { forfeitedReason?: string | null }) {
  return deriveAwardMaturation({
    plan: plan(args),
    forfeitedReason: args.forfeitedReason ?? null,
  });
}

describe("two-part award maturation, RL-471 (SCR-091)", () => {
  it("reports nothing due while the referred candidate has not joined", () => {
    const maturation = maturationOf({ joinedOn: null });
    expect(maturation.state).toBe<AwardMaturationState>("not_due");
    expect(maturation.label).toBe(AWARD_MATURATION_LABELS.not_due);
    expect(maturation.outstandingMilestone).toBe("joining");
    expect(maturation.blockedBy).toBe("The referred candidate has not joined as an employee.");
    expect(maturation.disbursedMinor).toBe(0);
  });

  it("puts a joined-but-unpaid referral against the confirmation gate", () => {
    const maturation = maturationOf({ joinedOn: "2026-01-01", tenureDays: 10 });
    expect(maturation.state).toBe<AwardMaturationState>("balance_pending_confirmation");
    // The joining leg is earned, so the eligible total is the joining leg alone.
    expect(maturation.eligibleMinor).toBe(SCHEME.joiningAmountMinor);
    expect(maturation.disbursedMinor).toBe(0);
  });

  it("reports the joining part as paid once an award row settles that leg", () => {
    const maturation = maturationOf({ joinedOn: "2026-01-01", tenureDays: 10, disbursed: ["joining"] });
    expect(maturation.state).toBe<AwardMaturationState>("part_paid_on_joining");
    expect(maturation.outstandingMilestone).toBe("confirmation");
    expect(maturation.disbursedMinor).toBe(SCHEME.joiningAmountMinor);
    expect(maturation.blockedBy).toContain("No confirmation event is captured");
  });

  it("reports full maturation only when both legs are disbursed", () => {
    const maturation = maturationOf({
      joinedOn: "2026-01-01",
      confirmedOn: "2026-03-01",
      tenureDays: 60,
      disbursed: ["joining", "confirmation"],
    });
    expect(maturation.state).toBe<AwardMaturationState>("fully_matured");
    expect(maturation.outstandingMilestone).toBeNull();
    expect(maturation.disbursedMinor).toBe(SCHEME.joiningAmountMinor + SCHEME.confirmationAmountMinor);
  });

  it("reports forfeiture, and states the reason in place of a generic blocker", () => {
    const maturation = maturationOf({
      joinedOn: null,
      forfeitedReason: "The application ended as \"Rejected\" and the candidate never joined, so no leg of the award can mature.",
    });
    expect(maturation.state).toBe<AwardMaturationState>("forfeited");
    expect(maturation.blockedBy).toContain("never joined");
  });

  it("never lets forfeiture overwrite an award that was already paid in full", () => {
    const maturation = maturationOf({
      joinedOn: "2026-01-01",
      confirmedOn: "2026-03-01",
      tenureDays: 60,
      disbursed: ["joining", "confirmation"],
      forfeitedReason: "The referred employee's record is \"separated\".",
    });
    expect(maturation.state).toBe<AwardMaturationState>("fully_matured");
  });

  it("partitions every leg combination into exactly one of the five states", () => {
    const observed = new Set<AwardMaturationState>();
    for (const joinedOn of [null, "2026-01-01"]) {
      for (const confirmedOn of [null, "2026-03-01"]) {
        for (const disbursed of [[], ["joining"], ["joining", "confirmation"]]) {
          for (const forfeitedReason of [null, "ended"]) {
            const state = maturationOf({ joinedOn, confirmedOn, tenureDays: 60, disbursed, forfeitedReason }).state;
            expect(AWARD_MATURATION_STATES).toContain(state);
            observed.add(state);
          }
        }
      }
    }
    expect([...observed].sort()).toEqual([...AWARD_MATURATION_STATES].sort());
  });
});

describe("an unconfigured award scheme states nothing (SCR-091)", () => {
  it("returns null amounts rather than zero when no scheme is configured", () => {
    const maturation = maturationOf({ scheme: null, joinedOn: "2026-01-01", tenureDays: 400 });
    expect(maturation.eligibleMinor).toBeNull();
    expect(maturation.disbursedMinor).toBeNull();
    expect(maturation.currency).toBeNull();
    // A zero would read on screen as "nothing is due", which is a different and
    // false statement from "the amount has never been configured".
    expect(maturation.eligibleMinor).not.toBe(0);
    expect(maturation.disbursedMinor).not.toBe(0);
  });

  it("names the missing configuration instead of a figure", () => {
    const unconfigured = plan({ scheme: null, joinedOn: "2026-01-01" });
    expect(unconfigured.configured).toBe(false);
    expect(unconfigured.missing.join(" ")).toContain("not configured");
    for (const milestone of unconfigured.milestones) {
      expect(milestone.amountMinor).toBeNull();
      expect(milestone.state).toBe("not_configured");
    }
  });

  it("refuses the award action with no scheme, because no tenure threshold can be sent", () => {
    const action = awardActionFor({
      maturation: maturationOf({ scheme: null, joinedOn: "2026-01-01", tenureDays: 400 }),
      scheme: null,
      referralStatus: "referred",
      tenureDays: 400,
    });
    expect(action.enabled).toBe(false);
    expect(action.request).toBeNull();
    expect(action.reason).toContain("not configured");
  });

  it("offers the joining leg, with a reason on every refusal", () => {
    const joined = { joinedOn: "2026-01-01", tenureDays: 10 } as const;
    const enabled = awardActionFor({
      maturation: maturationOf(joined),
      scheme: SCHEME,
      referralStatus: "referred",
      tenureDays: 10,
    });
    expect(enabled.enabled).toBe(true);
    expect(enabled.request).toEqual({ milestone: "joining", tenureDays: 10, requiredDays: 0 });

    // Not yet joined: refused, and the refusal names the joining gate.
    const notJoined = awardActionFor({
      maturation: maturationOf({ joinedOn: null }),
      scheme: SCHEME,
      referralStatus: "referred",
      tenureDays: null,
    });
    expect(notJoined.enabled).toBe(false);
    expect(notJoined.reason).toContain("has not joined");

    // The balance leg is refused while nothing records a confirmation, and the
    // refusal names that gate rather than a limitation of the endpoint.
    const uncaptured = awardActionFor({
      maturation: maturationOf({ ...joined, disbursed: ["joining"] }),
      scheme: SCHEME,
      referralStatus: "part_awarded",
      tenureDays: 10,
    });
    expect(uncaptured.enabled).toBe(false);
    expect(uncaptured.reason).toContain("No confirmation event is captured");
  });

  it("offers the balance leg once confirmation is recorded and tenure is met", () => {
    const action = awardActionFor({
      maturation: maturationOf({
        joinedOn: "2026-01-01",
        confirmedOn: "2026-03-01",
        tenureDays: 60,
        disbursed: ["joining"],
      }),
      scheme: SCHEME,
      referralStatus: "part_awarded",
      tenureDays: 60,
    });
    expect(action.enabled).toBe(true);
    // The threshold shown is the scheme's, never a figure the request supplies.
    expect(action.request).toEqual({ milestone: "confirmation", tenureDays: 60, requiredDays: SCHEME.confirmationTenureDays });
  });

  it("refuses any further leg once both are processed", () => {
    const action = awardActionFor({
      maturation: maturationOf({
        joinedOn: "2026-01-01",
        confirmedOn: "2026-03-01",
        tenureDays: 60,
        disbursed: ["joining", "confirmation"],
      }),
      scheme: SCHEME,
      referralStatus: "awarded",
      tenureDays: 60,
    });
    expect(action.enabled).toBe(false);
    expect(action.request).toBeNull();
  });
});

describe("stage is read from the application, never from the referral (SCR-091)", () => {
  it("maps the application's stage onto the screen's five states", () => {
    const base = { awarded: false, joined: false };
    expect(referralTrackingState({ ...base, applicationStage: "applied" })).toBe("referred");
    expect(referralTrackingState({ ...base, applicationStage: "screening" })).toBe("screening");
    expect(referralTrackingState({ ...base, applicationStage: "shortlisted" })).toBe("screening");
    expect(referralTrackingState({ ...base, applicationStage: "interview" })).toBe("interviewing");
    expect(referralTrackingState({ ...base, applicationStage: "offered" })).toBe("interviewing");
    expect(referralTrackingState({ ...base, applicationStage: "converted" })).toBe("hired");
    for (const state of REFERRAL_TRACKING_STATES) {
      expect(REFERRAL_TRACKING_STATES).toContain(state);
    }
  });

  it("reports an award as awarded whatever the application now says", () => {
    expect(referralTrackingState({ applicationStage: "screening", awarded: true, joined: false })).toBe("awarded");
  });

  it("does not dress a terminal application up as pipeline progress", () => {
    for (const stage of ["rejected", "withdrawn", "declined", "closed"]) {
      expect(referralTrackingState({ applicationStage: stage, awarded: false, joined: false })).toBe("referred");
    }
  });

  it("falls back to employment only when the referral carries no application", () => {
    expect(referralTrackingState({ applicationStage: null, awarded: false, joined: true })).toBe("hired");
    expect(referralTrackingState({ applicationStage: null, awarded: false, joined: false })).toBe("referred");
  });

  it("reads the stage column out of `applications`, and holds no copy on `referrals`", () => {
    const source = readFileSync(
      join(resolve(process.cwd()), "src/server/engagement/referral-tracking.ts"),
      "utf8",
    );
    // The stage is selected from the joined application row...
    expect(source).toContain("app.attributes as application_attributes");
    expect(source).toContain("const stage = text(application.stage);");
    // ...and never from the referral's own attributes.
    expect(source).not.toMatch(/referralAttributes\.stage/);
    expect(source).not.toMatch(/ref\.attributes->>'stage'/);
  });

  it("keeps recognition out of the referral register", () => {
    const source = readFileSync(
      join(resolve(process.cwd()), "src/server/engagement/referral-tracking.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from recognition_events/);
    expect(source).not.toMatch(/join recognition_events/);
  });
});

describe("forfeiture is derived, never assumed (SCR-091)", () => {
  it("forfeits a terminal application whose candidate never joined", () => {
    const reason = forfeitureReason({ applicationStage: "rejected", joined: false, employmentStatus: null });
    expect(reason).toContain("Rejected");
    expect(reason).toContain("never joined");
  });

  it("does not forfeit a live application", () => {
    expect(forfeitureReason({ applicationStage: "interview", joined: false, employmentStatus: null })).toBeNull();
    expect(forfeitureReason({ applicationStage: null, joined: false, employmentStatus: null })).toBeNull();
  });

  it("forfeits once the referred employee's record is no longer active", () => {
    expect(forfeitureReason({ applicationStage: "converted", joined: true, employmentStatus: "separated" })).toContain(
      "separated",
    );
    expect(forfeitureReason({ applicationStage: "converted", joined: true, employmentStatus: "active" })).toBeNull();
  });

  it("does not forfeit a hired candidate whose application ended as closed", () => {
    // The requisition closing is not the candidate failing; they are employed.
    expect(forfeitureReason({ applicationStage: "closed", joined: true, employmentStatus: "active" })).toBeNull();
  });
});

describe("an award row with no milestone key is the joining leg (SCR-091)", () => {
  it("reads a pre-milestone award row as the joining leg", () => {
    const source = readFileSync(
      join(resolve(process.cwd()), "src/server/engagement/referral-tracking.ts"),
      "utf8",
    );
    // `awardReferral` now stamps a milestone, but rows written before it did not.
    // The read model must still say which leg one of those settled.
    expect(source).toContain('text(attributesOf(row.attributes).milestone) ?? "joining"');
  });
});
