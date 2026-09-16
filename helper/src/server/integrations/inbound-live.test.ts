import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { listInbound, provisionInboundSecret, receiveInbound, sealSecret, signInboundPayload, unsealSecret } from "@/server/integrations/inbound";
import { connectIntegration } from "@/server/integrations/service";

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

describe.skipIf(!LIVE)("live inbound webhook verification (opt-in)", () => {
  it("seals secrets, verifies HMAC intake and blocks replays", { timeout: 180_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const admin = await accessFor("admin@mkraft.local", tenantId);
    const secret = "inbound-shared-secret-0123456789abcdef";
    expect(unsealSecret(sealSecret(secret))).toBe(secret);
    const suffix = Date.now().toString(36).toUpperCase();
    const connection = await connectIntegration(admin, { catalogCode: `BIO-TDD-${suffix}`, environment: "Sandbox", config: {}, verifiedRoundTrip: false }, crypto.randomUUID());
    await provisionInboundSecret(admin, { connectionId: connection.id, secret, label: "biometric intake secret" }, crypto.randomUUID());
    // Secrets at rest are sealed, never plaintext.
    const stored = (await db`select attributes from integration_secrets where tenant_id = ${tenantId} and integration_connection_id = ${connection.id} order by created_at desc limit 1`) as Array<{ attributes: { sealed: string } }>;
    expect(JSON.stringify(stored[0]?.attributes)).not.toContain(secret);
    const body = JSON.stringify({ event: "biometric.punch", device: "gate-1" });
    const timestamp = new Date().toISOString();
    const signature = signInboundPayload(secret, timestamp, "tdd-nonce-1", body);
    const received = await receiveInbound(connection.id, { timestamp, nonce: "tdd-nonce-1", signature }, body);
    expect(received.event).toBe("biometric.punch");
    expect(received.tenantId).toBe(tenantId);
    await expect(receiveInbound(connection.id, { timestamp, nonce: "tdd-nonce-1", signature }, body)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(receiveInbound(connection.id, { timestamp, nonce: "tdd-nonce-2", signature: "0".repeat(64) }, body)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const events = await listInbound(admin, connection.id);
    expect((events as unknown[]).length).toBeGreaterThanOrEqual(1);
    await db`delete from inbound_events where tenant_id = ${tenantId} and integration_connection_id = ${connection.id}`;
    await db`delete from integration_secrets where tenant_id = ${tenantId} and integration_connection_id = ${connection.id}`;
    await db`delete from integration_connections where id = ${connection.id}`;
  });
});
