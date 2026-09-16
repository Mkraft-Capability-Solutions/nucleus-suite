import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import {
  approveAction,
  decideHumanReview,
  executeAction,
  getAction,
  getRun,
  ingestKnowledge,
  proposeAction,
  recordStep,
  requestHumanReview,
  reverseAction,
  searchKnowledge,
  startRun,
  submitAiFeedback,
} from "@/server/ai/service";

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

describe.skipIf(!LIVE)("live P8 verification (opt-in)", () => {
  it("proves knowledge, runs, reviews and governed actions", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const proposer = await accessFor("opencode-smoke@example.test", tenantId);
    const approver = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const knowledgeIds: string[] = [];
    let runId = "";
    let actionId = "";
    try {
      // Knowledge: ingest + tenant-filtered ranked retrieval.
      const leaveDoc = await ingestKnowledge(proposer, {
        title: `Leave Policy TDD-${suffix}`, section: "Credits",
        text: "AGM and above receive 18 EL, 6 CL and 6 SL on 1 January. COFF expires after 60 days.",
        keywords: ["leave", "credit", "earned", "coff", "expiry"], audience: "all",
      }, crypto.randomUUID());
      knowledgeIds.push(leaveDoc.knowledgeId);
      expect(leaveDoc.chunks).toBeGreaterThan(0);
      const loanDoc = await ingestKnowledge(proposer, {
        title: `Loan Policy TDD-${suffix}`, section: "Ceiling",
        text: "The maximum principal is four times basic monthly salary.",
        keywords: ["loan", "maximum", "ceiling", "basic"], audience: "all",
      }, crypto.randomUUID());
      knowledgeIds.push(loanDoc.knowledgeId);
      const results = await searchKnowledge(proposer, "When does COFF expiry happen?", 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.title).toContain("Leave Policy");
      // Runs: start -> step -> feedback -> read-back.
      const run = await startRun(proposer, { workflowCode: `policy-qa-tdd-${suffix}` });
      runId = run.id;
      await recordStep(proposer, runId, "retrieve", { passages: 2 });
      await submitAiFeedback(proposer, { runId, rating: "up", comment: "Grounded answer" });
      const fetched = await getRun(proposer, runId);
      expect((fetched.steps as unknown[])).toHaveLength(1);
      expect((fetched.feedback as unknown[])).toHaveLength(1);
      // Human review: request -> decide; double decision blocked.
      const review = await requestHumanReview(proposer, { runId, summary: "Check this draft" }, crypto.randomUUID());
      const decided = await decideHumanReview(approver, review.id, { decision: "accepted", comment: "Good" }, crypto.randomUUID());
      expect(decided.decision).toBe("accepted");
      await expect(decideHumanReview(approver, review.id, { decision: "rejected", comment: "Again" }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      // Governed actions: allowlisted tool only; proposer != approver; idempotent execute; legal reversal.
      await expect(proposeAction(proposer, { principalCode: "hr-assistant", tool: "sql.query", effect: { q: 1 }, simulation: {} }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      const proposed = await proposeAction(proposer, { principalCode: "hr-assistant", tool: "draft.prepare", effect: { kind: "draft", text: "hello" }, simulation: { diff: [{ field: "x", before: 1, after: 2 }] } }, crypto.randomUUID());
      actionId = proposed.id;
      await expect(approveAction(proposer, actionId, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
      const approved = await approveAction(approver, actionId, crypto.randomUUID());
      expect(approved.status).toBe("approved");
      const executed = await executeAction(proposer, actionId, "idem-tdd-1", crypto.randomUUID());
      expect(executed.replayed).toBe(false);
      const replayed = await executeAction(proposer, actionId, "idem-tdd-1", crypto.randomUUID());
      expect(replayed.replayed).toBe(true);
      expect(replayed.outcomeId).toBe(executed.outcomeId);
      await expect(executeAction(proposer, actionId, "idem-tdd-2", crypto.randomUUID())).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
      const detail = await getAction(proposer, actionId);
      expect((detail.outcomes as unknown[])).toHaveLength(1);
      const reversed = await reverseAction(approver, actionId, "Wrong effective date", crypto.randomUUID());
      expect(reversed.status).toBe("reversed");
    } finally {
      if (actionId) {
        await db`delete from agent_action_reversals where tenant_id = ${tenantId} and original_agent_action_id = ${actionId}`;
        await db`delete from agent_action_outcomes where tenant_id = ${tenantId} and agent_action_id = ${actionId}`;
        await db`delete from agent_action_simulations where tenant_id = ${tenantId} and agent_action_id = ${actionId}`;
        await db`delete from agent_actions where tenant_id = ${tenantId} and (id = ${actionId} or attributes->>'reverses' = ${actionId})`;
      }
      if (runId) {
        await db`delete from human_review_decisions where tenant_id = ${tenantId} and human_review_request_id in (select id from human_review_requests where ai_run_id = ${runId})`;
        await db`delete from human_review_requests where tenant_id = ${tenantId} and ai_run_id = ${runId}`;
        await db`delete from ai_feedback where tenant_id = ${tenantId} and ai_run_id = ${runId}`;
        await db`delete from ai_run_steps where tenant_id = ${tenantId} and ai_run_id = ${runId}`;
        await db`delete from ai_artifacts where tenant_id = ${tenantId} and ai_run_id = ${runId}`;
        await db`delete from ai_runs where id = ${runId}`;
      }
      for (const knowledgeId of knowledgeIds) {
        await db`delete from knowledge_chunks where tenant_id = ${tenantId} and knowledge_document_id = ${knowledgeId}`;
        const docs = (await db`select document_id from knowledge_documents where id = ${knowledgeId}`) as Array<{ document_id: string }>;
        await db`delete from knowledge_documents where id = ${knowledgeId}`;
        for (const doc of docs) {
          await db`delete from document_versions where tenant_id = ${tenantId} and document_id = ${doc.document_id}`;
          await db`delete from documents where id = ${doc.document_id}`;
        }
      }
    }
  });
});
