import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { convertFxQuote, latestFxRate, quoteFxRate } from "@/server/fx/service";

config({ path: [".env.local", ".env"], quiet: true });

const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);
const client = () => neon(process.env.DATABASE_URL!);

describe.skipIf(!LIVE)("live FX verification (opt-in)", () => {
  it("quotes, reads back and converts through versioned snapshots", { timeout: 120_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const users = (await db`select id from "user" where email = 'admin@mkraft.local' limit 1`) as Array<{ id: string }>;
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
    const access: Access = {
      context: { actorUserId: users[0]?.id ?? "", membershipId: rows[0]?.membership_id ?? "", tenantId, permissions: rows[0]?.permission_keys ?? [], roles: ["test"] },
      tenantId,
    };
    const quoted = await quoteFxRate(access, { baseCode: "USD", quoteCode: "INR", rate: "84.00", source: "RBI_REFERENCE" }, crypto.randomUUID());
    expect(quoted.pair).toBe("USD/INR");
    const latest = await latestFxRate(access, "USD", "INR");
    expect(latest.rate).toBe("84.00");
    const converted = await convertFxQuote(access, { baseCode: "USD", quoteCode: "INR", amountMinor: 240_000 });
    expect(converted.quoteMinor).toBe(20_160_000);
    await db`delete from exchange_rate_snapshots where id = ${quoted.id}`;
  });
});
