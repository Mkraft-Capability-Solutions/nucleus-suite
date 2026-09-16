import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { calculateRun, createRun } from "@/server/payroll/service";
import {
  approveCompProposal,
  createBand,
  createBudget,
  createCompCycle,
  proposeCompensation,
} from "@/server/compensation/service";
import {
  answerSurvey,
  awardReferral,
  createSurvey,
  listAnnouncements,
  publishAnnouncement,
  recognizeEmployee,
  referCandidate,
  startSurveyRun,
  surveyResults,
} from "@/server/engagement/service";
import { approveRequisition, createRequisition } from "@/server/talent/service";
import {
  completeEnrollment,
  createCourse,
  enrollEmployee,
} from "@/server/learning/service";
import {
  createCalibrationSession,
  createCheckin,
  createKeyResult,
  createObjective,
  createReviewCycle,
  createSuccessionPlan,
  listFeedback,
  recordCalibrationAdjustment,
  requestFeedback,
  submitFeedback,
} from "@/server/performance/service";

/** Far enough ahead that the "required by is not in the past" gate stays satisfied. */
const FUTURE_DATE = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);


config({ path: [".env.local", ".env"], quiet: true });

const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);
const client = () => neon(process.env.DATABASE_URL!);

async function accessFor(email: string, tenantId: string): Promise<Access> {
  const db = client();
  const users = (await db`select id from "user" where email = ${email} limit 1`) as Array<{ id: string }>;
  const rows = (await db`
    select m.id as membership_id,
      coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys
    from memberships m
    left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
    left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
    left join permissions p on p.id = rp.permission_id and p.status = 'active'
    where m.user_id = ${users[0]?.id ?? ""} and m.tenant_id = ${tenantId} and m.status = 'active'
    group by m.id
  `) as Array<{ membership_id: string; permission_keys: string[] }>;
  const membership = rows[0];
  if (!membership) throw new Error(`membership for ${email} not found`);
  return {
    context: { actorUserId: users[0]?.id ?? "", membershipId: membership.membership_id, tenantId, permissions: membership.permission_keys ?? [], roles: ["test"] },
    tenantId,
  };
}

describe.skipIf(!LIVE)("live P6 verification (opt-in)", () => {
  it("proves performance, learning, compensation and engagement flows", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const hr = await accessFor("opencode-smoke@example.test", tenantId);
    const checker = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const mkEmployee = async (code: string, name: string) => {
      const personId = crypto.randomUUID();
      const employeeId = crypto.randomUUID();
      await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
      await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${code}, ${name}, 'Tdd', 'Operator', 'Weaving', 'Plant North', '2021-03-01', 6000000)`;
      return { personId, employeeId };
    };
    const manager = await mkEmployee(`HO-TDD-MG-${suffix}`, "PerfMgr");
    const employee = await mkEmployee(`HO-TDD-EM-${suffix}`, "PerfEmp");
    const smokeUsers = (await db`select id from "user" where email = 'opencode-smoke@example.test' limit 1`) as Array<{ id: string }>;
    await db`update memberships set employee_id = ${manager.employeeId} where tenant_id = ${tenantId} and user_id = ${smokeUsers[0]?.id ?? ""}`;
    let payRunId = "";
    let krId = "";
    let objectiveId = "";
    try {
      // Performance: cycle -> objective -> KR -> check-in -> 360 with anonymity flip.
      const cycle = await createReviewCycle(hr, { code: `P6TDD-${suffix}`, name: "P6 live cycle" }, crypto.randomUUID());
      expect(cycle.code).toBe(`P6TDD-${suffix}`);
      const objective = await createObjective(hr, { title: "Grow shift output", ownerEmployeeId: employee.employeeId });
      objectiveId = objective.id;
      const kr = await createKeyResult(hr, { objectiveId: objective.id, title: "Output above target", target: 95, unit: "pct" });
      krId = kr.id;
      await createCheckin(hr, { employeeId: employee.employeeId, objectiveId: objective.id, keyResultId: kr.id, notes: "On track", progressPct: 70 });
      const feedbackReq = await requestFeedback(hr, { subjectEmployeeId: employee.employeeId, reviewCycleCode: `P6TDD-${suffix}`, prompt: "Share strengths and one growth area." });
      await submitFeedback(hr, { requestId: feedbackReq.id, authorEmployeeId: manager.employeeId, body: "Solid shift lead", rating: 4 });
      const masked = await listFeedback(hr, employee.employeeId);
      expect(masked.anonymous).toBe(true);
      expect(masked.entries[0]?.author).toBeNull();
      for (let index = 0; index < 4; index += 1) {
        await submitFeedback(hr, { requestId: feedbackReq.id, authorEmployeeId: manager.employeeId, body: `Peer note ${index}`, rating: 4 });
      }
      const revealed = await listFeedback(hr, employee.employeeId);
      expect(revealed.anonymous).toBe(false);
      expect(revealed.entries[0]?.author).toBe(manager.employeeId);
      const calibration = await createCalibrationSession(hr, { reviewCycleCode: `P6TDD-${suffix}` });
      const adjusted = await recordCalibrationAdjustment(hr, calibration.id, { employeeId: employee.employeeId, from: "meets", to: "exceeds", reason: "Verified Kaizen impact" }, crypto.randomUUID());
      expect(adjusted.adjustments).toBe(1);
      const succession = await createSuccessionPlan(hr, { positionCode: "SPN-OP-03", candidates: [{ employeeId: employee.employeeId, readiness: "ready-1-2y", gaps: ["planning"] }] });
      expect(succession.candidates).toBe(1);
      // Learning: course -> enroll -> verify; double completion blocked.
      const course = await createCourse(hr, { code: `FANUC-TDD-${suffix}`, title: "Fanuc control", mandatory: true, durationMinutes: 120 });
      expect(course.duplicate).toBe(false);
      const enrollment = await enrollEmployee(hr, { employeeId: employee.employeeId, courseCode: `FANUC-TDD-${suffix}` });
      const completed = await completeEnrollment(hr, enrollment.id, 88, crypto.randomUUID());
      expect(completed.status).toBe("verified");
      await expect(completeEnrollment(hr, enrollment.id, 90, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      // Compensation: band -> cycle -> payroll-backed assignment -> propose -> checker approves.
      await createBand(hr, { gradeCode: "E3", minMinor: 70_000_00, maxMinor: 90_000_00, currency: "INR" });
      const compCycle = await createCompCycle(hr, { code: `COMP-TDD-${suffix}`, budgetMinor: 10_00_00_000 }, crypto.randomUUID());
      await createBudget(hr, { cycleId: compCycle.id, departmentName: "Weaving", amountMinor: 5_00_00_000 });
      const payRun = await createRun(hr, { period: "2026-09", runType: "regular", payDate: "2026-09-30", includeArrears: true }, crypto.randomUUID());
      payRunId = payRun.id;
      await calculateRun(hr, payRun.id, [employee.employeeId], crypto.randomUUID());
      const proposal = await proposeCompensation(hr, { cycleId: compCycle.id, employeeId: employee.employeeId, newBasicMinor: 82_00_000, effectiveDate: "2026-10-01", justification: "Market correction after benchmarking", revisionType: "market_correction", issueLetter: true }, crypto.randomUUID());
      await expect(approveCompProposal(hr, proposal.id, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
      const approved = await approveCompProposal(checker, proposal.id, crypto.randomUUID());
      expect(approved.status).toBe("approved");
      // Engagement: announcement, recognition, referral award, aggregate-only pulse.
      const announcement = await publishAnnouncement(hr, { title: "Diwali shutdown", body: "The plant is closed from 20 October and reopens on 23 October.", audience: "plant-north", kind: "management", announcementType: "general", channels: ["employee_portal"], acknowledgementRequired: false }, crypto.randomUUID());
      const announcements = await listAnnouncements(hr, "plant-north");
      expect((announcements as Array<{ id: string }>).some((row) => row.id === announcement.id)).toBe(true);
      await recognizeEmployee(hr, { recipientEmployeeId: employee.employeeId, message: "Star shift", points: 100 }, crypto.randomUUID());
      const candidateId = crypto.randomUUID();
      await db`insert into candidates (id, tenant_id, attributes) values (${candidateId}, ${tenantId}, '{"name":"Ref Cand","consent":true}'::jsonb)`;
      // A referral needs an open requisition to mature against, so raise and approve one.
      const referralRequisition = await createRequisition(
        hr,
        { title: "Referral opening", departmentName: "Weaving", positionCode: "SPN-OP-09", requisitionType: "addition", positions: 1, skills: ["ring frame operation", "doffing"], hiringManagerEmployeeId: employee.employeeId, designation: "Spinning Operator", locationCode: "Plant North", workerClass: "workman_permanent", requiredBy: FUTURE_DATE, employmentType: "permanent", ctcMinMinor: 3_00_000_00, ctcMaxMinor: 4_50_000_00, justification: "Third shift restart needs a full spinning crew from November.", qualificationRequired: "ITI or 10th with mill-floor experience", experienceMinYears: 1, experienceMaxYears: 5 },
        crypto.randomUUID(),
      );
      await approveRequisition(hr, referralRequisition.id, { override: false, recruiterEmployeeId: employee.employeeId }, crypto.randomUUID());
      const referral = await referCandidate(hr, { requisitionId: referralRequisition.id, candidateId, relationship: "former_colleague" });
      // No award scheme is configured yet, so the amount is unknown and the award is refused.
      await expect(awardReferral(hr, referral.id, { milestone: "joining", tenureDays: 95 }, crypto.randomUUID()))
        .rejects.toMatchObject({ code: "REFERRAL_SCHEME_INCOMPLETE" });
      await db`
        update tenant_settings
        set settings = coalesce(settings, '{}'::jsonb) || ${JSON.stringify({
          referral_award_scheme: {
            code: "REF-TDD",
            currency: "INR",
            joiningAmountMinor: 700_000,
            confirmationAmountMinor: 1_300_000,
            confirmationTenureDays: 90,
          },
        })}::jsonb
        where tenant_id = ${tenantId}
      `;
      // The confirmation leg is the only one with a tenure gate, and it is the scheme's.
      await expect(awardReferral(hr, referral.id, { milestone: "confirmation", tenureDays: 40 }, crypto.randomUUID()))
        .rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      const award = await awardReferral(hr, referral.id, { milestone: "joining", tenureDays: 95 }, crypto.randomUUID());
      expect(award.status).toBe("payable");
      // The payout reaches payroll as an input, linked back from the award row.
      expect(award.payrollInputId).toBeTruthy();
      const linked = (await db`select payroll_input_id from referral_awards where tenant_id = ${tenantId} and id = ${award.awardId}`) as Array<{ payroll_input_id: string | null }>;
      expect(linked[0]?.payroll_input_id).toBe(award.payrollInputId);
      // The same leg twice is refused; the other leg is a separate call.
      await expect(awardReferral(hr, referral.id, { milestone: "joining", tenureDays: 95 }, crypto.randomUUID()))
        .rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      const pulse = await createSurvey(hr, { code: `PULSE-TDD-${suffix}`, title: "Pulse", questions: [{ key: "q1", text: "Recommend?", scale: 5 }] });
      const run = await startSurveyRun(hr, pulse.id, null);
      for (let index = 0; index < 5; index += 1) {
        await answerSurvey(hr, { runId: run.id, answers: { q1: 4 }, anonymous: true });
      }
      const results = await surveyResults(hr, run.id);
      expect(results.suppressed).toBe(false);
      expect(results.means?.q1).toBe(4);
      const run2 = await startSurveyRun(hr, pulse.id, null);
      await answerSurvey(hr, { runId: run2.id, answers: { q1: 5 }, anonymous: true });
      await answerSurvey(hr, { runId: run2.id, answers: { q1: 3 }, anonymous: true });
      const suppressed = await surveyResults(hr, run2.id);
      expect(suppressed.suppressed).toBe(true);
    } finally {
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id = ${manager.employeeId}`;
      await db`delete from survey_responses where tenant_id = ${tenantId} and survey_run_id in (select id from survey_runs where tenant_id = ${tenantId})`;
      await db`delete from survey_runs where tenant_id = ${tenantId}`;
      await db`delete from surveys where tenant_id = ${tenantId} and attributes->>'code' like 'PULSE-TDD-%'`;
      await db`delete from payroll_inputs where tenant_id = ${tenantId} and attributes->>'component' = 'referral_award'`;
      await db`delete from referral_awards where tenant_id = ${tenantId}`;
      await db`delete from referrals where tenant_id = ${tenantId}`;
      await db`update tenant_settings set settings = settings - 'referral_award_scheme' where tenant_id = ${tenantId}`;
      await db`delete from candidates where tenant_id = ${tenantId} and attributes->>'name' = 'Ref Cand'`;
      await db`delete from recognition_events where tenant_id = ${tenantId}`;
      await db`delete from feed_posts where tenant_id = ${tenantId}`;
      await db`delete from compensation_proposals where tenant_id = ${tenantId}`;
      await db`delete from compensation_budgets where tenant_id = ${tenantId}`;
      await db`delete from compensation_cycles where tenant_id = ${tenantId} and attributes->>'code' like 'COMP-TDD-%'`;
      await db`delete from learning_completions where tenant_id = ${tenantId} and employee_id = ${employee.employeeId}`;
      await db`delete from enrollments where tenant_id = ${tenantId} and employee_id = ${employee.employeeId}`;
      await db`delete from courses where tenant_id = ${tenantId} and attributes->>'code' like 'FANUC-TDD-%'`;
      await db`delete from succession_plans where tenant_id = ${tenantId}`;
      await db`delete from calibration_sessions where tenant_id = ${tenantId}`;
      await db`delete from feedback_entries where tenant_id = ${tenantId} and subject_employee_id = ${employee.employeeId}`;
      await db`delete from feedback_requests where tenant_id = ${tenantId} and subject_employee_id = ${employee.employeeId}`;
      await db`delete from checkins where tenant_id = ${tenantId} and employee_id = ${employee.employeeId}`;
      if (krId) await db`delete from key_results where id = ${krId}`;
      if (objectiveId) await db`delete from objectives where id = ${objectiveId}`;
      await db`delete from review_cycles where tenant_id = ${tenantId} and attributes->>'code' like 'P6TDD-%'`;
      const members = (await db`select id from payroll_run_employees where tenant_id = ${tenantId} and employee_id = ${employee.employeeId}`) as Array<{ id: string }>;
      for (const member of members) {
        await db`delete from payslips where payroll_run_employee_id = ${member.id}`;
        await db`delete from payroll_lines where payroll_run_employee_id = ${member.id}`;
      }
      await db`delete from payroll_run_employees where tenant_id = ${tenantId} and employee_id = ${employee.employeeId}`;
      await db`delete from payroll_anomalies where tenant_id = ${tenantId} and employee_id = ${employee.employeeId}`;
      if (payRunId) {
        await db`delete from payroll_approvals where tenant_id = ${tenantId} and payroll_run_id = ${payRunId}`;
        await db`delete from payroll_runs where id = ${payRunId}`;
      }
      await db`delete from employee_salary_assignments where tenant_id = ${tenantId} and employee_id = ${employee.employeeId}`;
      await db`delete from employees where id = ${employee.employeeId} or id = ${manager.employeeId}`;
      await db`delete from people where id = ${employee.personId} or id = ${manager.personId}`;
    }
  });
});
