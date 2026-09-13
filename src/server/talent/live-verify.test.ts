import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import {
  advanceApplication,
  approveJobDescription,
  approveRequisition,
  createCandidate,
  createJobDescription,
  createOffer,
  createRequisition,
  disposeApplication,
  getApplication,
  scoreApplication,
  submitApplication,
  submitResume,
  transitionOffer,
} from "@/server/talent/service";
import {
  clearClearanceItem,
  completeOnboardingTask,
  onboardingReadiness,
  settleFullAndFinal,
  startOffboarding,
  startOnboarding,
} from "@/server/lifecycle/service";

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

const RESUME = [
  "Asha Verma",
  "5 years operating ring frames in spinning mills.",
  "Maintained shift output above target for 12 months.",
  "Trained 3 junior operators on safety procedures.",
].join("\n");

describe.skipIf(!LIVE)("live P5 verification (opt-in)", () => {
  it("runs vacancy -> one-score assessment -> human disposition -> offer -> employee", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const recruiter = await accessFor("opencode-smoke@example.test", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const managerId = crypto.randomUUID();
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${managerId}, ${tenantId}, ${personId}, ${`HO-TDD-HM-${suffix}`}, 'Hiring', 'Manager', 'Manager', 'Weaving', 'Plant North', '2020-01-15', 8000000)`;
    let candidateId = "";
    let applicationId = "";
    let jdId = "";
    let requisitionId = "";
    let offerId = "";
    try {
      const requisition = await createRequisition(recruiter, { title: "Spinning Operator", departmentName: "Weaving", positionCode: "SPN-OP-03", hiringManagerEmployeeId: managerId, manpowerRef: "MP-2026-014" }, crypto.randomUUID());
      expect(requisition.status).toBe("draft");
      requisitionId = requisition.id;
      await approveRequisition(recruiter, requisitionId, crypto.randomUUID());
      const jd = await createJobDescription(recruiter, {
        requisitionId,
        title: "Spinning Operator JD",
        requirements: [
          { ref: "R1", text: "Operate ring frames", mustHave: true },
          { ref: "R2", text: "Safety procedures", mustHave: false },
          { ref: "R3", text: "SAP proficiency", mustHave: false },
        ],
      }, crypto.randomUUID());
      jdId = jd.id;
      // Scoring a draft JD is blocked; only the approved version scores.
      const candidate = await createCandidate(recruiter, { name: "Asha Verma", email: "asha@example.test", source: "referral" });
      candidateId = candidate.id;
      const resume = await submitResume(recruiter, candidateId, { title: "Resume", mimeType: "text/plain", contentBase64: Buffer.from(RESUME, "utf8").toString("base64") });
      const application = await submitApplication(recruiter, { requisitionId, candidateId, extractionId: resume.extractionId, consent: true }, crypto.randomUUID());
      applicationId = application.id;
      await expect(submitApplication(recruiter, { requisitionId, candidateId, extractionId: resume.extractionId, consent: true }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      await expect(scoreApplication(recruiter, applicationId, {
        jobDescriptionId: jdId, scoreValue: 72, extractionChecksum: resume.checksum,
        findings: [{ requirementRef: "R1", judgment: "strong", evidence: [{ locator: "resume:2", excerptHash: "abc" }], provenance: "literal" }],
      }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      await approveJobDescription(recruiter, jdId, crypto.randomUUID());
      const scored = await scoreApplication(recruiter, applicationId, {
        jobDescriptionId: jdId, scoreValue: 72, extractionChecksum: resume.checksum,
        findings: [
          { requirementRef: "R1", judgment: "strong", evidence: [{ locator: "resume:line2", excerptHash: "e1" }], provenance: "literal" },
          { requirementRef: "R2", judgment: "partial", evidence: [{ locator: "resume:line4", excerptHash: "e2" }], provenance: "tree-context" },
          { requirementRef: "R3", judgment: "not_evidenced", evidence: [], provenance: "tree-context" },
        ],
      }, crypto.randomUUID());
      expect(scored.scoreValue).toBe(72);
      // Forbidden second-score fields are rejected at the service boundary.
      await expect(scoreApplication(recruiter, applicationId, {
        jobDescriptionId: jdId, scoreValue: 72, extractionChecksum: resume.checksum,
        findings: [{ requirementRef: "R1", judgment: "strong", evidence: [{ locator: "resume:line2", excerptHash: "e1" }], provenance: "literal" }],
        confidence: 0.9,
      } as unknown as Parameters<typeof scoreApplication>[2], crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      const detail = await getApplication(recruiter, applicationId);
      expect((detail.latestResult as { score_value: number } | null)?.score_value).toBe(72);
      // Human disposition is separate and reasoned.
      const disposition = await disposeApplication(recruiter, applicationId, { resultId: scored.resultId, decision: "advance", reason: "Strong shift evidence" }, crypto.randomUUID());
      expect(disposition.decision).toBe("advance");
      // Stages advance one human step at a time; skipping is blocked.
      await expect(advanceApplication(recruiter, applicationId, "interview", crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      for (const stage of ["screening", "shortlisted", "interview", "background", "offer_review", "offered"]) {
        const moved = await advanceApplication(recruiter, applicationId, stage, crypto.randomUUID());
        expect(moved.to).toBe(stage);
      }
      const offer = await createOffer(recruiter, { applicationId, positionCode: "SPN-OP-03", basicMinor: 3_000_000, currency: "INR", joiningDate: "2026-11-01" }, crypto.randomUUID());
      offerId = offer.id;
      await expect(transitionOffer(recruiter, offerId, "accept", crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      await transitionOffer(recruiter, offerId, "send", crypto.randomUUID());
      const accepted = await transitionOffer(recruiter, offerId, "accept", crypto.randomUUID());
      expect(accepted.status).toBe("accepted");
      expect(accepted.linked).toBe(false);
      const convertedEmployeeId = (accepted as { employeeId?: string }).employeeId ?? "";
      expect(convertedEmployeeId).toBeTruthy();
      // Onboarding to Day-1 readiness.
      const onboarding = await startOnboarding(recruiter, { employeeId: convertedEmployeeId, templateCode: "DAY1-STD" }, crypto.randomUUID());
      expect(onboarding.tasks).toBe(6);
      let readiness = await onboardingReadiness(recruiter, onboarding.id);
      expect(readiness.day1Ready).toBe(false);
      const taskRows = (await db`select id from onboarding_tasks where tenant_id = ${tenantId} and onboarding_instance_id = ${onboarding.id}`) as Array<{ id: string }>;
      for (const task of taskRows) {
        await completeOnboardingTask(recruiter, task.id, undefined, crypto.randomUUID());
      }
      readiness = await onboardingReadiness(recruiter, onboarding.id);
      expect(readiness.day1Ready).toBe(true);
      // Exit with no-dues gate and same-day F&F.
      const offboarding = await startOffboarding(recruiter, { employeeId: convertedEmployeeId, reason: "Resigned", lastWorkingDate: "2026-09-30" }, crypto.randomUUID());
      await expect(settleFullAndFinal(recruiter, offboarding.caseId, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      const clearRows = (await db`select id from clearance_items where tenant_id = ${tenantId} and offboarding_case_id = ${offboarding.caseId}`) as Array<{ id: string }>;
      expect(clearRows).toHaveLength(3);
      for (const item of clearRows) {
        await clearClearanceItem(recruiter, item.id, undefined, crypto.randomUUID());
      }
      const settlement = await settleFullAndFinal(recruiter, offboarding.caseId, crypto.randomUUID());
      expect(settlement.status).toBe("settled");
      expect(settlement.lines.map((line) => line.code)).toContain("net_payable");
    } finally {
      await db`delete from full_final_settlements where tenant_id = ${tenantId} and offboarding_case_id in (select id from offboarding_cases where tenant_id = ${tenantId})`;
      await db`delete from clearance_items where tenant_id = ${tenantId} and offboarding_case_id in (select id from offboarding_cases where tenant_id = ${tenantId})`;
      await db`delete from offboarding_cases where tenant_id = ${tenantId}`;
      await db`delete from lifecycle_events where tenant_id = ${tenantId}`;
      await db`delete from onboarding_tasks where tenant_id = ${tenantId} and onboarding_instance_id in (select id from onboarding_instances where tenant_id = ${tenantId})`;
      await db`delete from onboarding_instances where tenant_id = ${tenantId}`;
      await db`delete from employments where tenant_id = ${tenantId}`;
      const links = (await db`select employee_id, person_id from candidate_employee_links where tenant_id = ${tenantId}`) as Array<{ employee_id: string; person_id: string }>;
      await db`delete from candidate_employee_links where tenant_id = ${tenantId}`;
      for (const link of links) {
        await db`delete from employees where id = ${link.employee_id}`;
        await db`delete from people where id = ${link.person_id}`;
      }
      await db`delete from offers where tenant_id = ${tenantId}`;
      await db`delete from candidate_match_dispositions where tenant_id = ${tenantId}`;
      await db`delete from match_evidence where tenant_id = ${tenantId}`;
      await db`delete from candidate_match_results where tenant_id = ${tenantId}`;
      await db`delete from candidate_match_runs where tenant_id = ${tenantId}`;
      await db`delete from application_stage_history where tenant_id = ${tenantId}`;
      await db`delete from applications where tenant_id = ${tenantId}`;
      await db`delete from candidate_documents where tenant_id = ${tenantId}`;
      await db`delete from document_extractions where tenant_id = ${tenantId}`;
      await db`delete from document_versions where tenant_id = ${tenantId} and document_id in (select id from documents where tenant_id = ${tenantId} and candidate_id is not null)`;
      await db`delete from documents where tenant_id = ${tenantId} and candidate_id is not null`;
      await db`delete from candidates where tenant_id = ${tenantId}`;
      await db`delete from job_skill_requirements where tenant_id = ${tenantId}`;
      await db`delete from job_descriptions where tenant_id = ${tenantId} and id = ${jdId}`;
      await db`delete from requisitions where tenant_id = ${tenantId} and id = ${requisitionId}`;
      if (offerId) {
        await db`delete from offers where id = ${offerId}`;
      }
      await db`delete from employees where id = ${managerId}`;
      await db`delete from people where id = ${personId}`;
      // Candidate-linked employees were removed via links above; sweep stragglers.
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id not in (select id from employees)`;
    }
  });
});
