import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { decideRegularization, decideShiftSwap, requestRegularization, requestShiftSwap } from "@/server/attendance/regularizations";
import { buildExport, createExport, getExport } from "@/server/exports/service";
import { applyImport } from "@/server/organization/import-apply";
import { createTemplate, listTemplates, updateTemplate } from "@/server/lifecycle/templates";
import { enrollParticipant, participantResponses, submitResponse } from "@/server/performance/reviews";
import { employeeSkills, recordEvidence, verifyEvidence } from "@/server/skills/service";

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

describe.skipIf(!LIVE)("live remaining-flows verification (opt-in)", () => {
  it("proves regularizations, swaps, exports, reviews, skills, templates and import apply", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const hr = await accessFor("opencode-smoke@example.test", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const mkEmployee = async (code: string, name: string) => {
      const personId = crypto.randomUUID();
      const employeeId = crypto.randomUUID();
      await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
      await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date) values (${employeeId}, ${tenantId}, ${personId}, ${code}, ${name}, 'Tdd', 'Operator', 'Weaving', 'Plant North', '2022-01-15')`;
      return { personId, employeeId };
    };
    const empA = await mkEmployee(`HO-TDD-RM-${suffix}-A`, "RegA");
    const empB = await mkEmployee(`HO-TDD-RM-${suffix}-B`, "RegB");
    // Link smoke login for self-review identity.
    const smokeUsers = (await db`select id from "user" where email = 'opencode-smoke@example.test' limit 1`) as Array<{ id: string }>;
    await db`update memberships set employee_id = ${empA.employeeId} where tenant_id = ${tenantId} and user_id = ${smokeUsers[0]?.id ?? ""}`;
    try {
      // Regularization request -> approve; double decision blocked.
      const regularization = await requestRegularization(hr, { employeeId: empA.employeeId, date: "2026-09-10", kind: "missing_punch", reason: "Forgot to punch out at the gate", claimedIn: "09:00 AM", claimedOut: "08:00 PM" }, crypto.randomUUID());
      expect(regularization.status).toBe("submitted");
      const decided = await decideRegularization(hr, regularization.id, { approve: true }, crypto.randomUUID());
      expect(decided.status).toBe("approved");
      await expect(decideRegularization(hr, regularization.id, { approve: true }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      // Shift swap request -> approve.
      const swap = await requestShiftSwap(hr, { requesterEmployeeId: empA.employeeId, counterpartyEmployeeId: empB.employeeId, date: "2026-09-12", reason: "Family event" }, crypto.randomUUID());
      const swapDecided = await decideShiftSwap(hr, swap.id, true, crypto.randomUUID());
      expect(swapDecided.status).toBe("approved");
      // Export request -> build -> read-back with rows.
      const job = await createExport(hr, { resource: "employees", format: "csv" }, crypto.randomUUID());
      const built = await buildExport(hr, job.id);
      expect(built.status).toBe("succeeded");
      expect(built.rows).toBeGreaterThanOrEqual(2);
      const fetched = await getExport(hr, job.id);
      expect((fetched.attributes as { rows: number }).rows).toBeGreaterThanOrEqual(2);
      // Review participant + self response + read-back.
      const participant = await enrollParticipant(hr, { employeeId: empA.employeeId, cycleCode: `TDD-${suffix}`, templateCode: "STD-360" });
      await submitResponse(hr, { participantId: participant.id, relationship: "self", ratings: { delivery: 4 }, summary: "Solid" }, crypto.randomUUID());
      const responses = await participantResponses(hr, participant.id);
      expect((responses as unknown[])).toHaveLength(1);
      // Skill evidence -> verify updates proficiency.
      const evidence = await recordEvidence(hr, { employeeId: empA.employeeId, skillName: "Ring frames", source: "course-completion", level: "L3", reference: "course-9" }, crypto.randomUUID());
      const verified = await verifyEvidence(hr, { evidenceId: evidence.id, verdict: "verified" }, crypto.randomUUID());
      expect(verified.status).toBe("verified");
      const skills = await employeeSkills(hr, empA.employeeId);
      expect((skills as Array<{ proficiency: { proficiency: string; verified: boolean } }>)[0]?.proficiency).toMatchObject({ proficiency: "L3", verified: true });
      // Onboarding template CRUD.
      const template = await createTemplate(hr, { code: `TDD-TPL-${suffix}`, name: "TDD template", tasks: [{ key: "docs", title: "Documents", required: true, owner: "hr" }] }, crypto.randomUUID());
      const templates = await listTemplates(hr, false);
      expect((templates as Array<{ id: string }>).some((row) => row.id === template.id)).toBe(true);
      const updated = await updateTemplate(hr, template.id, { status: "archived" }, crypto.randomUUID());
      expect(updated.status).toBe("archived");
      const visible = await listTemplates(hr, false);
      expect((visible as Array<{ id: string }>).some((row) => row.id === template.id)).toBe(false);
      // Import apply creates people without duplicates.
      const applied = await applyImport(hr, { rows: [{ employeeCode: `HO-TDD-IM-${suffix}`, firstName: "Import", lastName: "Ed", department: "Weaving" }] }, crypto.randomUUID());
      expect(applied.created).toBe(1);
      await expect(applyImport(hr, { rows: [{ employeeCode: `HO-TDD-IM-${suffix}`, firstName: "Import", lastName: "Ed", department: "Weaving" }] }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      // Cleanup in FK-safe order.
      const importedPeople = (await db`select person_id from employees where tenant_id = ${tenantId} and employee_code = ${`HO-TDD-IM-${suffix}`}`) as Array<{ person_id: string }>;
      await db`delete from employees where tenant_id = ${tenantId} and employee_code = ${`HO-TDD-IM-${suffix}`}`;
      for (const row of importedPeople) {
        await db`delete from people where id = ${row.person_id}`;
      }
      await db`delete from onboarding_templates where id = ${template.id}`;
      await db`delete from skill_evidence where tenant_id = ${tenantId} and employee_skill_id in (select id from employee_skills where employee_id = ${empA.employeeId})`;
      await db`delete from employee_skills where tenant_id = ${tenantId} and employee_id = ${empA.employeeId}`;
      await db`delete from review_responses where tenant_id = ${tenantId} and review_participant_id = ${participant.id}`;
      await db`delete from review_participants where id = ${participant.id}`;
      await db`delete from export_jobs where id = ${job.id}`;
      await db`delete from shift_swap_requests where id = ${swap.id}`;
      await db`delete from attendance_regularizations where id = ${regularization.id}`;
      await db`delete from attendance_entries where tenant_id = ${tenantId} and employee_id = ${empA.employeeId}`;
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and (employee_id = ${empA.employeeId} or employee_id = ${empB.employeeId})`;
      await db`delete from employees where id in (${empA.employeeId}, ${empB.employeeId})`;
      await db`delete from people where id in (${empA.personId}, ${empB.personId})`;
    } finally {
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id in (select id from employees where tenant_id = ${tenantId} and (employee_code like 'HO-TDD-RM-%' or employee_code like 'HO-TDD-IM-%'))`;
      await db`delete from onboarding_templates where tenant_id = ${tenantId} and attributes->>'code' like 'TDD-TPL-%'`;
      await db`delete from skill_evidence where tenant_id = ${tenantId} and employee_skill_id in (select id from employee_skills where tenant_id = ${tenantId} and employee_id in (select id from employees where employee_code like 'HO-TDD-RM-%'))`;
      await db`delete from employee_skills where tenant_id = ${tenantId} and employee_id in (select id from employees where employee_code like 'HO-TDD-RM-%')`;
      await db`delete from review_responses where tenant_id = ${tenantId} and review_participant_id in (select id from review_participants where tenant_id = ${tenantId})`;
      await db`delete from review_participants where tenant_id = ${tenantId} and employee_id in (select id from employees where employee_code like 'HO-TDD-RM-%')`;
      await db`delete from export_jobs where tenant_id = ${tenantId}`;
      await db`delete from shift_swap_requests where tenant_id = ${tenantId}`;
      await db`delete from attendance_regularizations where tenant_id = ${tenantId}`;
      await db`delete from attendance_entries where tenant_id = ${tenantId} and employee_id in (select id from employees where employee_code like 'HO-TDD-RM-%')`;
      await db`delete from employees where tenant_id = ${tenantId} and (employee_code like 'HO-TDD-RM-%' or employee_code like 'HO-TDD-IM-%')`;
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id not in (select id from employees where tenant_id = ${tenantId})`;
    }
  });
});
