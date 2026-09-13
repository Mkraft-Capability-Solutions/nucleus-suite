import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { getOrganizationTree, listEmployees } from "@/server/organization/service";
import type { Access } from "@/server/platform/access";

config({ path: [".env.local", ".env"], quiet: true });

// Opt-in live verification against the migrated dev database.
// Run: MKRAFT_LIVE_VERIFY=1 npx vitest run src/server/organization/live-verify.test.ts
// Regression proof for the set_config result-misalignment bug found in P2 smoke.
const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);

async function smokeAccess(): Promise<Access> {
  const client = neon(process.env.DATABASE_URL!);
  const users = (await client`select id from "user" where email = 'opencode-smoke@example.test' limit 1`) as Array<{ id: string }>;
  const userId = users[0]?.id;
  if (!userId) throw new Error("smoke user not found");
  const rows = (await client`
    select m.id as membership_id, m.tenant_id,
      coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys
    from memberships m
    left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
    left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
    left join permissions p on p.id = rp.permission_id and p.status = 'active'
    where m.user_id = ${userId} and m.status = 'active'
    group by m.id, m.tenant_id
  `) as Array<{ membership_id: string; tenant_id: string; permission_keys: string[] }>;
  const membership = rows[0];
  if (!membership) throw new Error("smoke membership not found");
  return {
    context: { actorUserId: userId, membershipId: membership.membership_id, tenantId: membership.tenant_id, permissions: membership.permission_keys ?? [], roles: ["employee"] },
    tenantId: membership.tenant_id,
  };
}

describe.skipIf(!LIVE)("live P2 verification (opt-in)", () => {
  it("lists people with zero set_config leakage", async () => {
    const directory = await listEmployees(await smokeAccess(), { search: "", page: 1, pageSize: 5 });
    expect(JSON.stringify(directory)).not.toContain("set_config");
    expect(directory.total).toBe(0);
    expect(directory.items).toEqual([]);
  });

  it("returns the org tree with zero set_config leakage", async () => {
    const tree = await getOrganizationTree(await smokeAccess());
    expect(JSON.stringify(tree)).not.toContain("set_config");
    expect(tree).toHaveProperty("entities");
    expect(tree).toHaveProperty("departments");
    expect(tree).toHaveProperty("positions");
    expect(tree).toHaveProperty("headcount");
  });
});
