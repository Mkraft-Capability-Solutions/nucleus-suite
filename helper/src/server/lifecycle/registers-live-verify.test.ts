import { config } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";

config({ path: [".env.local", ".env"], quiet: true });

// Opt-in live verification of the People & Lifecycle registers against the
// migrated dev database. Proves each queue actually resolves joined rows rather
// than the bare jsonb the generic workflow list used to return.
// Run: MKRAFT_LIVE_VERIFY=1 npx vitest run src/server/lifecycle/registers-live-verify.test.ts
const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);

// The db client reads DATABASE_URL when its module is first evaluated, and the
// dotenv call above only runs after static imports resolve. Loading the services
// lazily is what lets them see the real connection string instead of the
// localhost fallback.
type Registers = {
  listSanctionedStrength: typeof import("@/server/organization/sanctioned-strength")["listSanctionedStrength"];
  getSanctionedStrengthRecord: typeof import("@/server/organization/sanctioned-strength")["getSanctionedStrengthRecord"];
  listDocumentVault: typeof import("@/server/documents/vault")["listDocumentVault"];
  getDocumentVaultRecord: typeof import("@/server/documents/vault")["getDocumentVaultRecord"];
  listJoiningChain: typeof import("@/server/lifecycle/joining-chain")["listJoiningChain"];
  getJoiningChainRecord: typeof import("@/server/lifecycle/joining-chain")["getJoiningChainRecord"];
  listClearanceBoard: typeof import("@/server/lifecycle/clearance-board")["listClearanceBoard"];
  getClearanceRecord: typeof import("@/server/lifecycle/clearance-board")["getClearanceRecord"];
  listAssetRegister: typeof import("@/server/assets/service")["listAssetRegister"];
  getAssetRecord: typeof import("@/server/assets/service")["getAssetRecord"];
  listLettersRegister: typeof import("@/server/letters/service")["listLettersRegister"];
  getLetterRecord: typeof import("@/server/letters/service")["getLetterRecord"];
  listPolicyAcknowledgements: typeof import("@/server/engagement/policy-acknowledgements")["listPolicyAcknowledgements"];
  getPolicyAcknowledgementRecord: typeof import("@/server/engagement/policy-acknowledgements")["getPolicyAcknowledgementRecord"];
  listEmployeeHomeActions: typeof import("@/server/home/actions")["listEmployeeHomeActions"];
};

let api: Registers;
let access: Access;

/** An administrator membership, so every register is reachable in one pass. */
async function adminAccess(): Promise<Access> {
  const client = neon(process.env.DATABASE_URL!);
  const rows = (await client`
    select m.user_id, m.id as membership_id, m.tenant_id,
      coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys
    from memberships m
    left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
    left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
    left join permissions p on p.id = rp.permission_id and p.status = 'active'
    where m.status = 'active'
    group by m.user_id, m.id, m.tenant_id
    order by count(distinct p.permission_key) desc
    limit 1
  `) as Array<{ user_id: string; membership_id: string; tenant_id: string; permission_keys: string[] }>;
  const membership = rows[0];
  if (!membership) throw new Error("no active membership found");
  return {
    context: {
      actorUserId: membership.user_id,
      membershipId: membership.membership_id,
      tenantId: membership.tenant_id,
      permissions: membership.permission_keys ?? [],
      roles: ["owner"],
    },
    tenantId: membership.tenant_id,
  };
}

describe.skipIf(!LIVE)("People & Lifecycle registers — live verification (opt-in)", () => {
  beforeAll(async () => {
    const [sanctioned, vault, joining, clearance, assets, letters, policies, home] = await Promise.all([
      import("@/server/organization/sanctioned-strength"),
      import("@/server/documents/vault"),
      import("@/server/lifecycle/joining-chain"),
      import("@/server/lifecycle/clearance-board"),
      import("@/server/assets/service"),
      import("@/server/letters/service"),
      import("@/server/engagement/policy-acknowledgements"),
      import("@/server/home/actions"),
    ]);
    api = {
      listSanctionedStrength: sanctioned.listSanctionedStrength,
      getSanctionedStrengthRecord: sanctioned.getSanctionedStrengthRecord,
      listDocumentVault: vault.listDocumentVault,
      getDocumentVaultRecord: vault.getDocumentVaultRecord,
      listJoiningChain: joining.listJoiningChain,
      getJoiningChainRecord: joining.getJoiningChainRecord,
      listClearanceBoard: clearance.listClearanceBoard,
      getClearanceRecord: clearance.getClearanceRecord,
      listAssetRegister: assets.listAssetRegister,
      getAssetRecord: assets.getAssetRecord,
      listLettersRegister: letters.listLettersRegister,
      getLetterRecord: letters.getLetterRecord,
      listPolicyAcknowledgements: policies.listPolicyAcknowledgements,
      getPolicyAcknowledgementRecord: policies.getPolicyAcknowledgementRecord,
      listEmployeeHomeActions: home.listEmployeeHomeActions,
    };
    access = await adminAccess();
  });

  it("SCR-013 resolves sanctioned lines to named organisations and drops the unplanned row", async () => {
    const rows = await api.listSanctionedStrength(access, "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.organisation).not.toBe("");
      expect(Number.isFinite(row.sanctioned)).toBe(true);
      expect(row.headroom).toBe(row.sanctioned - row.filled);
      expect(["within_headroom", "at_limit", "over_plan"]).toContain(row.status);
      // The seeded plan carries one prose-only row with no sanctioned figure.
      expect(row.record_code.length).toBeLessThan(40);
    }
    const detail = await api.getSanctionedStrengthRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
    expect(Array.isArray(detail.auditTrail)).toBe(true);
  });

  it("SCR-014 resolves documents to their type and expiry", async () => {
    const rows = await api.listDocumentVault(access, "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.title).not.toBe("");
      expect(["pending_verification", "verified", "expired", "replaced"]).toContain(row.status);
    }
    const detail = await api.getDocumentVaultRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
    expect(Array.isArray(detail.versions)).toBe(true);
  });

  it("SCR-060 resolves joining chains to named joiners with task rollups", async () => {
    const rows = await api.listJoiningChain(access, "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.employee_code).not.toBe("");
      expect(row.done).toBeLessThanOrEqual(row.total);
      expect(["not_started", "in_progress", "blocked", "ready"]).toContain(row.status);
    }
    const detail = await api.getJoiningChainRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
    expect(detail.tasks.length).toBe(rows[0].total);
  });

  it("SCR-061 resolves clearance items to named leavers rather than bare uuids", async () => {
    const rows = await api.listClearanceBoard(access, "");
    expect(rows.length).toBeGreaterThan(0);
    // The old generic list could only show uuids; every row must now name its leaver.
    expect(rows.every((row) => Boolean(row.leaver_code))).toBe(true);
    for (const row of rows) {
      expect(row.item_name).not.toBe("");
      expect(["open", "cleared", "waived", "held"]).toContain(row.status);
    }
    const detail = await api.getClearanceRecord(access, rows[0].id);
    expect(detail.caseItems.length).toBeGreaterThan(0);
  });

  it("SCR-064 resolves assets to their holder and drops the unplanned catalogue row", async () => {
    const rows = await api.listAssetRegister(access, "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.asset_code).not.toBe("");
      expect(row.asset_type).not.toBe("");
      expect(["available", "allocated", "returned", "written_off"]).toContain(row.status);
    }
    expect(rows.some((row) => Boolean(row.holder_code))).toBe(true);
    const detail = await api.getAssetRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
  });

  it("SCR-067 returns the template library and every issued letter in one queue", async () => {
    const rows = await api.listLettersRegister(access, "");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.kind === "template")).toBe(true);
    for (const row of rows) {
      expect(row.letter).not.toBe("");
      expect(row.reference).not.toBe("");
    }
    const template = rows.find((row) => row.kind === "template")!;
    const detail = await api.getLetterRecord(access, template.id, "template");
    expect(detail.record.id).toBe(template.id);
  });

  it("SCR-062 returns published policy versions with acknowledgement counts", async () => {
    const rows = await api.listPolicyAcknowledgements(access, "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.policy).not.toBe("");
      // This access is administrative, so tenant coverage is served to it rather
      // than withheld — a null here would mean the roll was narrowed wrongly.
      expect(row.audience_count).not.toBeNull();
      expect(row.acknowledged_count).not.toBeNull();
      expect(row.audience_count!).toBeGreaterThan(0);
      expect(row.acknowledged_count!).toBeLessThanOrEqual(row.audience_count!);
      expect(["published", "pending_acknowledgement", "acknowledged", "overdue"]).toContain(row.status);
    }
    const detail = await api.getPolicyAcknowledgementRecord(access, rows[0].id);
    expect(Array.isArray(detail.acknowledgements)).toBe(true);
  });

  it("SCR-042 returns a scoped action queue, or an empty one when no employee is linked", async () => {
    const result = await api.listEmployeeHomeActions(access);
    if (result.employee === null) {
      expect(result.rows).toEqual([]);
      return;
    }
    for (const row of result.rows) {
      expect(row.action).not.toBe("");
      expect(row.href.startsWith("/")).toBe(true);
      expect(["available", "queued_offline", "completed", "needs_attention"]).toContain(row.status);
    }
    // Sorted so anything needing attention is at the top of the queue.
    const order = { needs_attention: 0, available: 1, queued_offline: 2, completed: 3 } as const;
    const ranks = result.rows.map((row) => order[row.status]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});
