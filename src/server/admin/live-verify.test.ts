import { createHash } from "node:crypto";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import {
  assignMemberRoles,
  createInvite,
  createRole,
  getSettings,
  grantRolePermissions,
  patchSettings,
  revokeInvite,
} from "@/server/admin/service";

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

describe.skipIf(!LIVE)("live admin verification (opt-in)", () => {
  it("manages roles, invitations and tenant settings end to end", { timeout: 180_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const admin = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const roleCode = `tdd-hr-${suffix}`.toLowerCase();
    let roleId = "";
    let inviteId = "";
    try {
      const role = await createRole(admin, { code: roleCode, name: "TDD HR" });
      roleId = role.id;
      expect(role.duplicate).toBe(false);
      await expect(grantRolePermissions(admin, roleId, { permissionKeys: ["employee.read", "nope.unknown"] }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      const granted = await grantRolePermissions(admin, roleId, { permissionKeys: ["employee.read", "leave.read"] }, crypto.randomUUID());
      expect(granted.granted).toBe(2);
      const smokeUsers = (await db`select id from "user" where email = 'opencode-smoke@example.test' limit 1`) as Array<{ id: string }>;
      const mems = (await db`select id from memberships where user_id = ${smokeUsers[0]?.id ?? ""} and tenant_id = ${tenantId} limit 1`) as Array<{ id: string }>;
      const assigned = await assignMemberRoles(admin, { membershipId: mems[0]?.id ?? "", roleCodes: [roleCode] }, crypto.randomUUID());
      expect(assigned.roles).toEqual([roleCode]);
      const invite = await createInvite(admin, { email: `tdd-invite-${suffix}@example.test`, roleCodes: [roleCode], expiresInHours: 72 }, crypto.randomUUID());
      inviteId = invite.id;
      expect(invite.token.length).toBeGreaterThan(20);
      // Only the hash is stored; the raw token never touches the database.
      const stored = (await db`select token_hash from invitations where id = ${inviteId}`) as Array<{ token_hash: string }>;
      expect(stored[0]?.token_hash).toBe(createHash("sha256").update(invite.token).digest("hex"));
      expect(stored[0]?.token_hash).not.toContain(invite.token.slice(0, 8));
      const revoked = await revokeInvite(admin, inviteId, crypto.randomUUID());
      expect(revoked.status).toBe("revoked");
      await expect(revokeInvite(admin, inviteId, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      const before = await getSettings(admin);
      expect(before.timezone).toBeTruthy();
      const patched = await patchSettings(admin, { timezone: "Asia/Kolkata" }, crypto.randomUUID());
      expect(patched.timezone).toBe("Asia/Kolkata");
      await expect(patchSettings(admin, { timezone: "Mars/Olympus" }, crypto.randomUUID())).rejects.toMatchObject({ code: "BAD_REQUEST" });
    } finally {
      if (inviteId) await db`delete from invitations where id = ${inviteId}`;
      if (roleId) {
        await db`delete from membership_roles where tenant_id = ${tenantId} and role_id = ${roleId}`;
        await db`delete from role_permissions where tenant_id = ${tenantId} and role_id = ${roleId}`;
        await db`delete from roles where id = ${roleId}`;
      }
    }
  });
});
