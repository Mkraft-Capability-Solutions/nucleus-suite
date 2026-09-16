import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import {
  claimBenefit,
  createBenefitOption,
  createBenefitPlan,
  enrollBenefit,
} from "@/server/benefits/service";
import {
  approveJobDescription,
  approveRequisition,
  createCandidate,
  createJobDescription,
  createRequisition,
  submitApplication,
  submitResume,
} from "@/server/talent/service";
import {
  createInterviewPlan,
  createPosting,
  debriefSession,
  scheduleSession,
  sessionScores,
  submitScore,
} from "@/server/interviews/service";

/** Far enough ahead that the "required by is not in the past" gate stays satisfied. */
const FUTURE_DATE = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);


/** A complete card for the two-competency rubric the interview plan in this suite declares. */
function card(rating: number) {
  return {
    competencyRatings: [
      { competency: "skills", rating },
      { competency: "attitude", rating },
    ],
    strengths: "Ran the ring frame unaided through the whole assessment shift.",
    concerns: "No exposure to the autoconer line; would need a week of shadowing.",
  };
}


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

describe.skipIf(!LIVE)("live interviews, postings and benefits verification (opt-in)", () => {
  it("seals scorecards until debrief and enforces coverage caps", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const recruiter = await accessFor("opencode-smoke@example.test", tenantId);
    const interviewer = await accessFor("approver-one@example.test", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const managerId = crypto.randomUUID();
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${managerId}, ${tenantId}, ${personId}, ${`HO-TDD-IV-${suffix}`}, 'Hiring', 'Manager', 'Manager', 'Weaving', 'Plant North', '2020-01-15', 8000000)`;
    const outsider = await accessFor("admin@mkraft.local", tenantId);
    try {
      const requisition = await createRequisition(recruiter, { title: "Spinning Operator", departmentName: "Weaving", positionCode: "SPN-OP-03", hiringManagerEmployeeId: managerId, requisitionType: "addition", positions: 1, designation: "Operator", locationCode: "Plant North", workerClass: "workman_permanent", requiredBy: FUTURE_DATE, employmentType: "permanent", ctcMinMinor: 3_00_000_00, ctcMaxMinor: 4_50_000_00, justification: "Third shift restart needs a full spinning crew from November.", skills: ["ring frame operation", "doffing"], qualificationRequired: "ITI or 10th with mill-floor experience", experienceMinYears: 1, experienceMaxYears: 5 }, crypto.randomUUID());
      await approveRequisition(recruiter, requisition.id, { override: false, recruiterEmployeeId: managerId }, crypto.randomUUID());
      const jd = await createJobDescription(recruiter, { requisitionId: requisition.id, title: "IV JD", requirements: [{ ref: "R1", text: "Operate ring frames", mustHave: true }] }, crypto.randomUUID());
      await approveJobDescription(recruiter, jd.id, crypto.randomUUID());
      const posting = await createPosting(recruiter, { jobDescriptionId: jd.id, requisitionId: requisition.id, channels: ["careers-page"], opensOn: "2026-09-01", closesOn: "2026-09-30" });
      expect(posting.status).toBe("open");
      const candidate = await createCandidate(recruiter, { name: "IV Candidate", email: "iv.candidate@example.test", phone: "+919800000001", source: "job_portal", totalExperienceYears: 4 });
      const resume = await submitResume(recruiter, candidate.id, { title: "Resume", mimeType: "text/plain", contentBase64: Buffer.from("five years ring frames", "utf8").toString("base64") });
      const application = await submitApplication(recruiter, { requisitionId: requisition.id, candidateId: candidate.id, extractionId: resume.extractionId, consent: true }, crypto.randomUUID());
      const plan = await createInterviewPlan(recruiter, { requisitionId: requisition.id, title: "Operator panel", rounds: ["technical_1", "hr"], rubric: ["skills", "attitude"] }, crypto.randomUUID());
      // Non-panel members cannot score.
      const session = await scheduleSession(recruiter, { applicationId: application.id, planId: plan.id, scheduledAt: "2026-10-01T10:00:00+05:30", durationMinutes: 45, panelMembershipIds: [recruiter.context.membershipId, interviewer.context.membershipId], round: "technical_1", mode: "in_person" });
      expect(session.panel).toBe(2);
      await expect(submitScore(outsider, { sessionId: session.id, ...card(5), overallRating: "hire" }, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
      const score = await submitScore(recruiter, { sessionId: session.id, ...card(4), overallRating: "hire" }, crypto.randomUUID());
      expect(score.sealed).toBe(true);
      await submitScore(interviewer, { sessionId: session.id, ...card(3), overallRating: "hold" }, crypto.randomUUID());
      await expect(submitScore(recruiter, { sessionId: session.id, ...card(5), overallRating: "hire" }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      // Sealed: each panelist sees only their own card.
      const sealedView = await sessionScores(recruiter, session.id);
      expect(sealedView.debriefed).toBe(false);
      expect((sealedView.scores as unknown[])).toHaveLength(1);
      expect(sealedView.totalCards).toBe(2);
      await debriefSession(recruiter, session.id, crypto.randomUUID());
      const openView = await sessionScores(recruiter, session.id);
      expect(openView.debriefed).toBe(true);
      expect((openView.scores as unknown[])).toHaveLength(2);
      // Benefits: plan -> option -> enroll -> claim within coverage; over-coverage blocked.
      const plan2 = await createBenefitPlan(recruiter, { code: `MED-TDD-${suffix}`, name: "Mediclaim", coverageMinor: 500_000_00 });
      await createBenefitOption(recruiter, { planCode: `MED-TDD-${suffix}`, code: "SELF", name: "Self", employeeShareMinor: 12_000_00 });
      const person2 = crypto.randomUUID();
      const emp2 = crypto.randomUUID();
      await db`insert into people (id, tenant_id) values (${person2}, ${tenantId})`;
      await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date) values (${emp2}, ${tenantId}, ${person2}, ${`HO-TDD-BN-${suffix}`}, 'Ben', 'Efit', 'Operator', 'Weaving', 'Plant North', '2022-01-15')`;
      const enrollment = await enrollBenefit(recruiter, { employeeId: emp2, optionCode: "SELF" }, crypto.randomUUID());
      await expect(enrollBenefit(recruiter, { employeeId: emp2, optionCode: "SELF" }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      const claim = await claimBenefit(recruiter, { enrollmentId: enrollment.id, amountMinor: 45_000_00, diagnosis: "Fracture" }, crypto.randomUUID());
      expect(claim.remainingMinor).toBe(500_000_00 - 45_000_00);
      await expect(claimBenefit(recruiter, { enrollmentId: enrollment.id, amountMinor: 500_000_00, diagnosis: "Too much" }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      // Cleanup in FK-safe order.
      await db`delete from benefit_claims where tenant_id = ${tenantId} and benefit_enrollment_id = ${enrollment.id}`;
      await db`delete from benefit_enrollments where id = ${enrollment.id}`;
      await db`delete from benefit_options where tenant_id = ${tenantId} and attributes->>'code' = 'SELF'`;
      await db`delete from benefit_plans where id = ${plan2.id}`;
      await db`delete from employees where id = ${emp2}`;
      await db`delete from people where id = ${person2}`;
      await db`delete from interview_scores where tenant_id = ${tenantId} and interview_session_id = ${session.id}`;
      await db`delete from interview_panel_members where tenant_id = ${tenantId} and interview_session_id = ${session.id}`;
      await db`delete from interview_sessions where id = ${session.id}`;
      await db`delete from interview_plans where id = ${plan.id}`;
      await db`delete from scorecards where tenant_id = ${tenantId} and requisition_id = ${requisition.id}`;
      await db`delete from job_postings where tenant_id = ${tenantId} and requisition_id = ${requisition.id}`;
      await db`delete from application_stage_history where tenant_id = ${tenantId} and application_id = ${application.id}`;
      await db`delete from applications where id = ${application.id}`;
      await db`delete from candidate_documents where tenant_id = ${tenantId} and candidate_id = ${candidate.id}`;
      await db`delete from document_extractions where tenant_id = ${tenantId} and id = ${resume.extractionId}`;
      await db`delete from document_versions where tenant_id = ${tenantId} and document_id = ${resume.documentId}`;
      await db`delete from documents where id = ${resume.documentId}`;
      await db`delete from candidates where id = ${candidate.id}`;
      await db`delete from job_skill_requirements where tenant_id = ${tenantId} and job_description_id = ${jd.id}`;
      await db`delete from job_descriptions where id = ${jd.id}`;
      await db`delete from requisitions where id = ${requisition.id}`;
      await db`delete from employees where id = ${managerId}`;
      await db`delete from people where id = ${personId}`;
    } finally {
      await db`delete from benefit_claims where tenant_id = ${tenantId} and benefit_enrollment_id in (select id from benefit_enrollments where tenant_id = ${tenantId})`;
      await db`delete from benefit_enrollments where tenant_id = ${tenantId} and employee_id not in (select id from employees)`;
      await db`delete from interview_scores where tenant_id = ${tenantId} and interview_session_id in (select id from interview_sessions where tenant_id = ${tenantId})`;
      await db`delete from interview_panel_members where tenant_id = ${tenantId} and interview_session_id in (select id from interview_sessions where tenant_id = ${tenantId})`;
      await db`delete from interview_sessions where tenant_id = ${tenantId}`;
    }
  });
});
