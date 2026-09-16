import { describe, expect, it } from "vitest";

import {
  DUE_DATE_INERT,
  DUE_SOON_DAYS,
  EVIDENCE_UPLOAD_UNREACHABLE,
  MY_LEARNING_STATES,
  MY_LEARNING_STATE_BACKING,
  applyMyLearningFilters,
  assignGate,
  buildMyLearningItems,
  completionGate,
  daysBetweenDates,
  deriveMyLearningState,
  dueBanding,
  isClosedState,
  myLearningScopeFrom,
  myLearningTimeline,
  normalizeMyLearningFilters,
  pathsForCourse,
  resolveSubjectEmployeeId,
  type LearningPathRow,
  type MyCompletionRow,
  type MyEmployeeCertificationRow,
  type MyEnrollmentRow,
  type MyLearningState,
} from "./my-learning";
import type { CertificationRow, CourseRow } from "./progress";

const TODAY = "2026-09-14";
const EMPLOYEE = "11111111-1111-4111-8111-111111111111";
const OTHER_EMPLOYEE = "22222222-2222-4222-8222-222222222222";

const course = (code: string, attributes: Record<string, unknown> = {}): CourseRow => ({
  id: `course-${code}`,
  attributes: { code, title: `${code} course`, ...attributes },
  created_at: "2026-01-01T00:00:00.000Z",
});

const enrollment = (id: string, attributes: Record<string, unknown>, employeeId = EMPLOYEE): MyEnrollmentRow => ({
  id,
  version: 1,
  employee_id: employeeId,
  attributes,
  created_at: "2026-08-01T00:00:00.000Z",
  employee_code: "E-001",
  first_name: "Asha",
  last_name: "Rao",
});

const completion = (id: string, enrollmentId: string, attributes: Record<string, unknown> = {}, createdAt = "2026-09-01T00:00:00.000Z"): MyCompletionRow => ({
  id,
  enrollment_id: enrollmentId,
  document_id: null,
  attributes,
  created_at: createdAt,
});

describe("my learning state derivation (SCR-063)", () => {
  it("reports Assigned for the status enrollEmployee actually writes", () => {
    expect(deriveMyLearningState({ status: "assigned", hasCompletion: false, certificateHeld: false })).toBe("assigned");
    expect(deriveMyLearningState({ status: "", hasCompletion: false, certificateHeld: false })).toBe("assigned");
  });

  it("reports Verified for the single completion event completeEnrollment records", () => {
    expect(deriveMyLearningState({ status: "verified", hasCompletion: true, certificateHeld: false })).toBe("verified");
    expect(deriveMyLearningState({ status: "assigned", hasCompletion: true, certificateHeld: false })).toBe("verified");
  });

  it("reports Certified only when the learner actually holds the course's certification", () => {
    expect(deriveMyLearningState({ status: "verified", hasCompletion: true, certificateHeld: true })).toBe("certified");
    expect(deriveMyLearningState({ status: "verified", hasCompletion: true, certificateHeld: false })).not.toBe("certified");
  });

  it("never returns Completed, because it is the same recorded event as Verified", () => {
    const states = new Set<MyLearningState>();
    for (const status of ["assigned", "verified", "completed", "enrolled", "", "in_review"]) {
      for (const hasCompletion of [true, false]) {
        for (const certificateHeld of [true, false]) {
          states.add(deriveMyLearningState({ status, hasCompletion, certificateHeld }));
        }
      }
    }
    expect(states.has("completed")).toBe(false);
    expect(MY_LEARNING_STATE_BACKING.completed.backed).toBe(false);
  });

  it("marks In progress as unreachable: no writer produces a third status", () => {
    // The branch exists defensively, but nothing in the system writes such a status.
    expect(deriveMyLearningState({ status: "in_review", hasCompletion: false, certificateHeld: false })).toBe("in_progress");
    expect(MY_LEARNING_STATE_BACKING.in_progress.backed).toBe(false);
  });

  it("backs exactly three of the five spec states", () => {
    const backed = MY_LEARNING_STATES.filter((state) => MY_LEARNING_STATE_BACKING[state].backed);
    expect(backed).toEqual(["assigned", "verified", "certified"]);
  });

  it("treats every recorded-completion state as closed", () => {
    expect(isClosedState("assigned")).toBe(false);
    expect(isClosedState("in_progress")).toBe(false);
    expect(isClosedState("verified")).toBe(true);
    expect(isClosedState("certified")).toBe(true);
  });
});

describe("my learning progress reporting (SCR-063)", () => {
  it("reports an open enrollment as untracked rather than zero percent", () => {
    const [item] = buildMyLearningItems({
      enrollments: [enrollment("e1", { course_code: "SAFETY", status: "assigned" })],
      completions: [],
      courses: [course("SAFETY")],
      paths: [],
      certifications: [],
      employeeCertifications: [],
      today: TODAY,
      canWrite: false,
    });
    expect(item.progress.percentComplete).toBeNull();
    expect(item.progress.percentComplete).not.toBe(0);
    expect(item.progress.tracked).toBe(false);
    expect(item.progress.basis).toMatch(/no progress event|not tracked/i);
  });

  it("reports a completed enrollment at 100 because a completion row exists", () => {
    const [item] = buildMyLearningItems({
      enrollments: [enrollment("e1", { course_code: "SAFETY", status: "verified" })],
      completions: [completion("c1", "e1", { score_pct: 88 })],
      courses: [course("SAFETY")],
      paths: [],
      certifications: [],
      employeeCertifications: [],
      today: TODAY,
      canWrite: false,
    });
    expect(item.progress.percentComplete).toBe(100);
    expect(item.progress.tracked).toBe(true);
    expect(item.scorePct).toBe(88);
  });
});

describe("my learning due-date banding (SCR-063)", () => {
  const open = (dueDate: string | null) => dueBanding({ dueDate, today: TODAY, state: "assigned", completedOn: null });

  it("counts whole days between two dates", () => {
    expect(daysBetweenDates(TODAY, "2026-09-21")).toBe(7);
    expect(daysBetweenDates(TODAY, "2026-09-13")).toBe(-1);
    expect(daysBetweenDates("not-a-date", TODAY)).toBeNull();
  });

  it("treats a due date equal to today as due today, not overdue", () => {
    const position = open(TODAY);
    expect(position.band).toBe("due_today");
    expect(position.daysOverdue).toBeNull();
    expect(position.daysUntilDue).toBe(0);
  });

  it("treats yesterday as overdue by exactly one day", () => {
    const position = open("2026-09-13");
    expect(position.band).toBe("overdue");
    expect(position.daysOverdue).toBe(1);
    expect(position.label).toBe("Overdue by 1 day");
  });

  it("holds the due-soon boundary inclusive at DUE_SOON_DAYS and flips the day after", () => {
    expect(DUE_SOON_DAYS).toBe(7);
    expect(open("2026-09-15").band).toBe("due_soon");
    expect(open("2026-09-21").band).toBe("due_soon");
    expect(open("2026-09-22").band).toBe("scheduled");
  });

  it("reports no due date when none was supplied or the stored value is unusable", () => {
    expect(open(null).band).toBe("no_due_date");
    expect(open("soon").band).toBe("no_due_date");
  });

  it("says plainly that nothing acts on an overdue date", () => {
    expect(open("2026-09-13").note).toBe(DUE_DATE_INERT);
    expect(DUE_DATE_INERT).toMatch(/no reminder/i);
  });

  it("closes a completed enrollment instead of calling it overdue, and says whether it landed late", () => {
    const late = dueBanding({ dueDate: "2026-08-01", today: TODAY, state: "verified", completedOn: "2026-09-01" });
    expect(late.band).toBe("closed");
    expect(late.closedLate).toBe(true);
    const onTime = dueBanding({ dueDate: "2026-09-30", today: TODAY, state: "certified", completedOn: "2026-09-01" });
    expect(onTime.band).toBe("closed");
    expect(onTime.closedLate).toBe(false);
  });
});

describe("my learning self-scope (SCR-063)", () => {
  it("gives tenant-wide learning scope only to a caller who may write enrollments", () => {
    expect(myLearningScopeFrom(["employee.read"])).toBe("self");
    expect(myLearningScopeFrom([])).toBe("self");
    expect(myLearningScopeFrom(["employee.read", "employee.write"])).toBe("all");
  });

  it("pins a self-scoped caller to their own employee row whatever they ask for", () => {
    expect(
      resolveSubjectEmployeeId({ scope: "self", requestedEmployeeId: OTHER_EMPLOYEE, selfEmployeeId: EMPLOYEE }),
    ).toBe(EMPLOYEE);
  });

  it("defaults a broader caller to self and reaches another learner only on an explicit ask", () => {
    expect(resolveSubjectEmployeeId({ scope: "all", requestedEmployeeId: null, selfEmployeeId: EMPLOYEE })).toBe(EMPLOYEE);
    expect(resolveSubjectEmployeeId({ scope: "all", requestedEmployeeId: OTHER_EMPLOYEE, selfEmployeeId: EMPLOYEE })).toBe(OTHER_EMPLOYEE);
  });

  it("yields no subject for a self-scoped caller with no employee link, so the read can refuse", () => {
    expect(resolveSubjectEmployeeId({ scope: "self", requestedEmployeeId: null, selfEmployeeId: null })).toBeNull();
  });
});

describe("my learning action gates (SCR-063)", () => {
  it("refuses completion without employee.write, naming the permission", () => {
    const gate = completionGate({ state: "assigned", canWrite: false });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/employee\.write/);
  });

  it("refuses completion once a completion is already recorded", () => {
    expect(completionGate({ state: "verified", canWrite: true }).allowed).toBe(false);
    expect(completionGate({ state: "certified", canWrite: true }).allowed).toBe(false);
  });

  it("allows completion for an assigned enrollment, which is all completeEnrollment accepts", () => {
    expect(completionGate({ state: "assigned", canWrite: true })).toEqual({ allowed: true, reason: null });
  });

  it("refuses assignment without a writer permission, a learner or a course", () => {
    expect(assignGate({ canWrite: false, subjectEmployeeId: EMPLOYEE, courseCount: 3 }).allowed).toBe(false);
    expect(assignGate({ canWrite: true, subjectEmployeeId: null, courseCount: 3 }).reason).toMatch(/employee profile/);
    expect(assignGate({ canWrite: true, subjectEmployeeId: EMPLOYEE, courseCount: 0 }).reason).toMatch(/No courses/);
    expect(assignGate({ canWrite: true, subjectEmployeeId: EMPLOYEE, courseCount: 1 }).allowed).toBe(true);
  });

  it("states that completion evidence has no upload path", () => {
    expect(EVIDENCE_UPLOAD_UNREACHABLE).toMatch(/learning_completions\.document_id/);
    expect(EVIDENCE_UPLOAD_UNREACHABLE).toMatch(/no writer/i);
  });
});

describe("my learning path resolution (SCR-063)", () => {
  const paths: LearningPathRow[] = [
    { id: "p1", attributes: { code: "IND", title: "Induction", course_codes: ["SAFETY", "ETHICS"] } },
    { id: "p2", attributes: { code: "SAF", title: "Safety track", course_codes: ["SAFETY"] } },
  ];

  it("resolves every path whose course_codes contain the course", () => {
    expect(pathsForCourse("SAFETY", paths).map((path) => path.id)).toEqual(["p1", "p2"]);
    expect(pathsForCourse("ETHICS", paths).map((path) => path.title)).toEqual(["Induction"]);
  });

  it("returns nothing for a course no path contains, and for a blank code", () => {
    expect(pathsForCourse("FIRE", paths)).toEqual([]);
    expect(pathsForCourse("", paths)).toEqual([]);
  });

  it("labels an unlisted course as outside a learning path rather than inventing one", () => {
    const [item] = buildMyLearningItems({
      enrollments: [enrollment("e1", { course_code: "FIRE", status: "assigned" })],
      completions: [],
      courses: [course("FIRE")],
      paths,
      certifications: [],
      employeeCertifications: [],
      today: TODAY,
      canWrite: true,
    });
    expect(item.learningPath).toBeNull();
    expect(item.learningPathLabel).toBe("Not part of a learning path");
  });

  it("flags a course that sits in more than one path instead of silently picking one", () => {
    const [item] = buildMyLearningItems({
      enrollments: [enrollment("e1", { course_code: "SAFETY", status: "assigned" })],
      completions: [],
      courses: [course("SAFETY")],
      paths,
      certifications: [],
      employeeCertifications: [],
      today: TODAY,
      canWrite: true,
    });
    expect(item.learningPathCount).toBe(2);
    expect(item.learningPathLabel).toBe("Induction (+1 more)");
  });
});

describe("my learning timeline (SCR-063)", () => {
  it("marks the two states no writer can produce as unreachable", () => {
    const steps = myLearningTimeline("assigned", true);
    expect(steps.find((step) => step.key === "in_progress")?.state).toBe("unreachable");
    expect(steps.find((step) => step.key === "completed")?.state).toBe("unreachable");
  });

  it("makes Certified unreachable when the course defines no certification", () => {
    expect(myLearningTimeline("verified", false).find((step) => step.key === "certified")?.state).toBe("unreachable");
    expect(myLearningTimeline("verified", true).find((step) => step.key === "certified")?.state).toBe("todo");
  });

  it("walks Assigned to Verified to Certified as the record advances", () => {
    expect(myLearningTimeline("assigned", true).find((step) => step.key === "assigned")?.state).toBe("current");
    expect(myLearningTimeline("verified", true).find((step) => step.key === "verified")?.state).toBe("current");
    const certified = myLearningTimeline("certified", true);
    expect(certified.find((step) => step.key === "verified")?.state).toBe("done");
    expect(certified.find((step) => step.key === "certified")?.state).toBe("current");
  });
});

describe("my learning queue assembly and filters (SCR-063)", () => {
  const certifications: CertificationRow[] = [
    { id: "cert-1", attributes: { course_code: "SAFETY", name: "Safety Level 1", issuing_body: "Internal", validity_months: 12 } },
  ];
  const held: MyEmployeeCertificationRow[] = [
    { id: "ec-1", employee_id: EMPLOYEE, certification_id: "cert-1", attributes: { issued_on: "2026-09-01", credential_reference: "CERT-SAFETY-ABCD" } },
  ];

  const items = () =>
    buildMyLearningItems({
      enrollments: [
        enrollment("e1", { course_code: "SAFETY", status: "verified", due_date: "2026-08-01" }),
        enrollment("e2", { course_code: "ETHICS", status: "assigned", due_date: "2026-09-13" }),
        enrollment("e3", { course_code: "FIRE", status: "assigned", due_date: null }),
      ],
      completions: [completion("c1", "e1", { score_pct: 91 })],
      courses: [course("SAFETY"), course("ETHICS"), course("FIRE")],
      paths: [{ id: "p1", attributes: { code: "IND", title: "Induction", course_codes: ["SAFETY", "ETHICS"] } }],
      certifications,
      employeeCertifications: held,
      today: TODAY,
      canWrite: true,
    });

  it("derives one row per enrollment with its own state, path and due position", () => {
    const rows = items();
    expect(rows.map((row) => row.state)).toEqual(["certified", "assigned", "assigned"]);
    expect(rows[0].certificateHeld).toBe(true);
    expect(rows[0].certification?.name).toBe("Safety Level 1");
    expect(rows[1].due.band).toBe("overdue");
    expect(rows[2].due.band).toBe("no_due_date");
  });

  it("carries no evidence document, because nothing writes learning_completions.document_id", () => {
    expect(items().every((row) => row.evidenceDocumentId === null)).toBe(true);
  });

  it("disables completion on the rows where completeEnrollment would refuse", () => {
    const rows = items();
    expect(rows[0].complete.allowed).toBe(false);
    expect(rows[1].complete.allowed).toBe(true);
  });

  it("filters by state, overdue and free text", () => {
    const rows = items();
    expect(applyMyLearningFilters(rows, normalizeMyLearningFilters({ state: "certified" })).map((row) => row.id)).toEqual(["e1"]);
    expect(applyMyLearningFilters(rows, normalizeMyLearningFilters({ overdue: "true" })).map((row) => row.id)).toEqual(["e2"]);
    expect(applyMyLearningFilters(rows, normalizeMyLearningFilters({ q: "induction" })).map((row) => row.id)).toEqual(["e1", "e2"]);
  });

  it("ignores a state filter the vocabulary does not contain", () => {
    expect(normalizeMyLearningFilters({ state: "archived" }).state).toBeNull();
    expect(normalizeMyLearningFilters({ state: "IN_PROGRESS" }).state).toBe("in_progress");
  });
});
