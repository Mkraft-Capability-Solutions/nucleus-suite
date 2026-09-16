import { describe, expect, it } from "vitest";

import {
  PROGRESS_UNTRACKED_IN_PROGRESS,
  PROGRESS_UNTRACKED_NOT_STARTED,
  addMonths,
  certificationForCourse,
  classifyCourseCompliance,
  completionRatePct,
  deriveEnrollmentState,
  deriveProgress,
  impactReadiness,
  planCertificateIssuance,
  summariseLearning,
  timeToCompletion,
  type CertificationRow,
  type CourseRow,
  type EmployeeCertificationRow,
} from "./progress";

const course = (code: string, attributes: Record<string, unknown> = {}): CourseRow => ({
  id: `course-${code}`,
  attributes: { code, title: `${code} course`, ...attributes },
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("enrollment state derivation (SCR-063)", () => {
  it("treats a recorded completion row as completed regardless of the stored status", () => {
    expect(deriveEnrollmentState("assigned", true)).toBe("completed");
    expect(deriveEnrollmentState("", true)).toBe("completed");
  });

  it("treats the verified status written by completeEnrollment as completed", () => {
    expect(deriveEnrollmentState("verified", false)).toBe("completed");
    expect(deriveEnrollmentState("VERIFIED", false)).toBe("completed");
  });

  it("treats assigned — the only other status the service writes — as not started", () => {
    expect(deriveEnrollmentState("assigned", false)).toBe("not_started");
    expect(deriveEnrollmentState("", false)).toBe("not_started");
  });

  it("does not collapse an unrecognised status into a known state", () => {
    expect(deriveEnrollmentState("in_progress", false)).toBe("in_progress");
    expect(deriveEnrollmentState("suspended", false)).toBe("in_progress");
  });
});

describe("progress is reported as untracked, never as zero (SCR-063)", () => {
  it("reports an in-progress enrollment as untracked rather than 0%", () => {
    const progress = deriveProgress("in_progress");
    expect(progress.percentComplete).toBeNull();
    expect(progress.percentComplete).not.toBe(0);
    expect(progress.tracked).toBe(false);
    expect(progress.basis).toBe(PROGRESS_UNTRACKED_IN_PROGRESS);
  });

  it("reports a not-started enrollment as untracked rather than 0%", () => {
    const progress = deriveProgress("not_started");
    expect(progress.percentComplete).toBeNull();
    expect(progress.tracked).toBe(false);
    expect(progress.basis).toBe(PROGRESS_UNTRACKED_NOT_STARTED);
  });

  it("reports 100% only for a completion that is actually recorded", () => {
    const progress = deriveProgress("completed");
    expect(progress.percentComplete).toBe(100);
    expect(progress.tracked).toBe(true);
  });
});

describe("mandatory-course compliance classification (SCR-063)", () => {
  it("marks a course complete when every enrollment is verified", () => {
    expect(classifyCourseCompliance({ mandatory: true, enrolled: 3, completed: 3 })).toBe("complete");
    expect(classifyCourseCompliance({ mandatory: false, enrolled: 1, completed: 1 })).toBe("complete");
  });

  it("marks a mandatory course outstanding while any enrollment is unverified", () => {
    expect(classifyCourseCompliance({ mandatory: true, enrolled: 3, completed: 2 })).toBe("mandatory_outstanding");
  });

  it("marks a mandatory course with nobody enrolled as outstanding, not as satisfied", () => {
    expect(classifyCourseCompliance({ mandatory: true, enrolled: 0, completed: 0 })).toBe("mandatory_outstanding");
  });

  it("does not apply the compliance treatment to a non-mandatory course", () => {
    expect(classifyCourseCompliance({ mandatory: false, enrolled: 3, completed: 1 })).toBe("in_progress");
    expect(classifyCourseCompliance({ mandatory: false, enrolled: 0, completed: 0 })).toBe("not_enrolled");
  });
});

describe("completion-rate arithmetic (SCR-063)", () => {
  it("computes a rate to one decimal place", () => {
    expect(completionRatePct(1, 3)).toBe(33.3);
    expect(completionRatePct(3, 4)).toBe(75);
    expect(completionRatePct(4, 4)).toBe(100);
  });

  it("returns null with zero enrollments instead of reporting 0%", () => {
    expect(completionRatePct(0, 0)).toBeNull();
    expect(completionRatePct(0, 0)).not.toBe(0);
  });

  it("reports a genuine zero rate when enrollments exist but none completed", () => {
    expect(completionRatePct(0, 5)).toBe(0);
  });
});

describe("certificate issuance only where a certification is defined (SCR-063)", () => {
  const certification: CertificationRow = {
    id: "cert-1",
    attributes: { course_code: "SAFETY-01", name: "Loom safety", issuing_body: "Plant EHS", validity_months: 12 },
  };

  it("links a certification to a course by course_code", () => {
    expect(certificationForCourse(course("SAFETY-01"), [certification])?.id).toBe("cert-1");
  });

  it("links a certification the course names through certification_code", () => {
    const declared: CertificationRow = { id: "cert-2", attributes: { code: "EHS-L2", name: "EHS level 2" } };
    expect(certificationForCourse(course("WEAVE-101", { certification_code: "EHS-L2" }), [declared])?.id).toBe("cert-2");
  });

  it("finds no certification for an unlinked course", () => {
    expect(certificationForCourse(course("WEAVE-101"), [certification])).toBeNull();
  });

  it("issues nothing when the course defines no certification", () => {
    const plan = planCertificateIssuance({ certification: null, employeeId: "emp-1", held: [], completedOn: "2026-09-14" });
    expect(plan.issue).toBe(false);
    expect(plan.reason).toBe("course_defines_no_certification");
    expect(plan.certificationId).toBeNull();
  });

  it("issues the certification with an expiry derived from validity_months", () => {
    const plan = planCertificateIssuance({ certification, employeeId: "emp-1", held: [], completedOn: "2026-09-14" });
    expect(plan.issue).toBe(true);
    expect(plan.certificationId).toBe("cert-1");
    expect(plan.issuedOn).toBe("2026-09-14");
    expect(plan.expiresOn).toBe("2027-09-14");
  });

  it("leaves the expiry open when the certification declares no validity period", () => {
    const perpetual: CertificationRow = { id: "cert-3", attributes: { course_code: "SAFETY-01", name: "Induction" } };
    const plan = planCertificateIssuance({ certification: perpetual, employeeId: "emp-1", held: [], completedOn: "2026-09-14" });
    expect(plan.issue).toBe(true);
    expect(plan.expiresOn).toBeNull();
  });

  it("does not issue a duplicate to a learner who already holds it", () => {
    const held: EmployeeCertificationRow[] = [{ id: "ec-1", employee_id: "emp-1", certification_id: "cert-1", attributes: {} }];
    expect(planCertificateIssuance({ certification, employeeId: "emp-1", held, completedOn: "2026-09-14" }).reason).toBe("already_held");
    expect(planCertificateIssuance({ certification, employeeId: "emp-2", held, completedOn: "2026-09-14" }).issue).toBe(true);
  });

  it("clamps a month-end issue date onto a shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("time to completion (SCR-063)", () => {
  it("reports no samples when no enrollment has both timestamps", () => {
    const result = timeToCompletion([{ enrolledAt: "2026-01-01T00:00:00.000Z", completedAt: null }]);
    expect(result).toMatchObject({ samples: 0, medianDays: null, averageDays: null });
  });

  it("computes the median and average in days", () => {
    const result = timeToCompletion([
      { enrolledAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-03T00:00:00.000Z" },
      { enrolledAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-05T00:00:00.000Z" },
      { enrolledAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-11T00:00:00.000Z" },
    ]);
    expect(result.samples).toBe(3);
    expect(result.medianDays).toBe(4);
    expect(result.averageDays).toBe(5.3);
  });
});

describe("learning impact is reported as not computable (SCR-063)", () => {
  it("produces no ROI number and names every missing input", () => {
    const impact = impactReadiness();
    expect(impact.roiPct).toBeNull();
    expect(impact.computed).toBe(false);
    expect(impact.missing).toHaveLength(3);
    expect(impact.statement).toMatch(/baseline/i);
    expect(impact.statement).toMatch(/comparison window/i);
  });
});

describe("screen projection (SCR-063)", () => {
  it("derives cards, cohort counts and analytics from recorded state only", () => {
    const projection = summariseLearning({
      courses: [
        course("SAFETY-01", { mandatory: true, duration_minutes: 90, category: "Compliance" }),
        course("WEAVE-101", { mandatory: false, duration_minutes: 240 }),
      ],
      enrollments: [
        { id: "e1", employee_id: "emp-1", attributes: { course_code: "SAFETY-01", status: "verified" }, created_at: "2026-01-01T00:00:00.000Z" },
        { id: "e2", employee_id: "emp-2", attributes: { course_code: "SAFETY-01", status: "assigned" }, created_at: "2026-01-01T00:00:00.000Z" },
        { id: "e3", employee_id: "emp-3", attributes: { course_code: "WEAVE-101", status: "assigned" }, created_at: "2026-01-01T00:00:00.000Z" },
      ],
      completions: [
        { id: "c1", employee_id: "emp-1", enrollment_id: "e1", attributes: { score_pct: 88 }, created_at: "2026-01-05T00:00:00.000Z" },
      ],
      certifications: [{ id: "cert-1", attributes: { course_code: "SAFETY-01", name: "Loom safety", issuing_body: "Plant EHS", validity_months: 12 } }],
      employeeCertifications: [{ id: "ec-1", employee_id: "emp-1", certification_id: "cert-1", attributes: {} }],
    });

    const safety = projection.courses.find((card) => card.code === "SAFETY-01");
    expect(safety?.compliance).toBe("mandatory_outstanding");
    expect(safety?.cohort).toMatchObject({ enrolled: 2, completed: 1, notStarted: 1, completionRatePct: 50 });
    expect(safety?.certification).toMatchObject({ id: "cert-1", holders: 1 });

    const weave = projection.courses.find((card) => card.code === "WEAVE-101");
    expect(weave?.compliance).toBe("in_progress");
    expect(weave?.certification).toBeNull();
    expect(weave?.certificationNote).toMatch(/defines no certification/i);

    expect(projection.enrollments.find((card) => card.id === "e1")).toMatchObject({
      state: "completed",
      percentComplete: 100,
      scorePct: 88,
      certificateHeld: true,
    });
    expect(projection.enrollments.find((card) => card.id === "e2")).toMatchObject({
      state: "not_started",
      percentComplete: null,
      progressTracked: false,
      certificateHeld: false,
    });

    expect(projection.analytics).toMatchObject({
      courses: 2,
      mandatoryCourses: 1,
      enrollments: 3,
      completed: 1,
      completionRatePct: 33.3,
      mandatoryCoveragePct: 0,
      mandatoryOutstandingCourses: 1,
      certificatesIssued: 1,
      coursesDefiningCertification: 1,
    });
    expect(projection.analytics.timeToCompletion).toMatchObject({ samples: 1, medianDays: 4 });
    expect(projection.analytics.impact.roiPct).toBeNull();
  });

  it("reports null rates on an empty tenant rather than zeroes", () => {
    const projection = summariseLearning({ courses: [], enrollments: [], completions: [], certifications: [], employeeCertifications: [] });
    expect(projection.analytics.completionRatePct).toBeNull();
    expect(projection.analytics.mandatoryCoveragePct).toBeNull();
    expect(projection.analytics.timeToCompletion.samples).toBe(0);
    expect(projection.courses).toHaveLength(0);
  });
});
