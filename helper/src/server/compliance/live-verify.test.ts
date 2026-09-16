import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { attachEvidence, createObligation, listForms } from "@/server/compliance/service";
import { computeMci, defineMetric, getMciRun, snapshotMetric } from "@/server/analytics/service";
import { assignWorker, createAgency, createContract, listInvoices, submitInvoice } from "@/server/contractors/service";
import { connectIntegration, createWebhookEndpoint, listConnections, listDeliveries, subscribeWebhook } from "@/server/integrations/service";
import { createDocument, markDocumentScan } from "@/server/organization/service";
import { closeRightsCase, createLegalHold, openRightsCase, releaseLegalHold } from "@/server/privacy/service";

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

describe.skipIf(!LIVE)("live P7 verification (opt-in)", () => {
  it("proves compliance, analytics, contractors, privacy and integrations flows", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const admin = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    let assignmentId = "";
    let contractorPersonId = "";
    try {
      await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
      await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${`HO-TDD-P7-${suffix}`}, 'Metric', 'Subj', 'Operator', 'Weaving', 'Plant North', '2021-01-15', 6000000)`;
      // Compliance: scheduled obligation, form gating, versioned evidence.
      const obligation = await createObligation(admin, {
        title: "PF monthly return", dueDate: "2026-09-15",
        act: "Employees' Provident Funds Act, 1952", authority: "EPFO",
        entityCode: "MKR-01", locationCode: "Plant North", frequency: "monthly",
        ownerEmployeeId: employeeId, formCode: "PF-ECR", status: "open",
      }, crypto.randomUUID());
      expect(obligation.status).toBe("scheduled");
      await expect(createObligation(admin, {
        title: "State filing", formCode: `NOPE-${suffix}`, dueDate: "2026-09-15",
        act: "Shops & Establishments Act", authority: "Labour Department",
        entityCode: "MKR-01", locationCode: "Plant North", frequency: "annual",
        ownerEmployeeId: employeeId, status: "open",
      }, crypto.randomUUID())).rejects.toMatchObject({ code: "RULE_PACK_NOT_APPROVED" });
      const [docTypeRows] = (await db`select id from document_types where tenant_id = ${tenantId} limit 1`) as unknown as [Array<{ id: string }>];
      const docTypes = docTypeRows as unknown as Array<{ id: string }>;
      let docTypeId = docTypes[0]?.id ?? "";
      if (!docTypeId) {
        docTypeId = crypto.randomUUID();
        await db`insert into document_types (id, tenant_id, attributes) values (${docTypeId}, ${tenantId}, '{"code":"GENERAL","name":"General"}'::jsonb)`;
      }
      const document = await createDocument(admin, { documentTypeId: docTypeId, documentClass: "other", title: "PF challan", mimeType: "application/pdf", contentBase64: Buffer.from("challan-bytes", "utf8").toString("base64") }, crypto.randomUUID());
      await markDocumentScan(admin, document.id, true, crypto.randomUUID());
      const evidence = await attachEvidence(admin, { calendarItemId: obligation.id, documentId: document.id }, crypto.randomUUID());
      expect(evidence.id).toBeTruthy();
      const forms = await listForms(admin);
      expect(Array.isArray(forms)).toBe(true);
      // Analytics: governed metrics with suppression + versioned MCI.
      const metric = await defineMetric(admin, { code: `ATTR-TDD-${suffix}`, name: "Attrition", definition: "90-day attrition", privacyThreshold: 5 });
      expect(metric.duplicate).toBe(false);
      const suppressed = await snapshotMetric(admin, { definitionCode: `ATTR-TDD-${suffix}`, value: 6.8, cohortSize: 3, drillThrough: [] });
      expect(suppressed.suppressed).toBe(true);
      const published = await snapshotMetric(admin, { definitionCode: `ATTR-TDD-${suffix}`, value: 6.8, cohortSize: 120, drillThrough: ["weaving"] });
      expect(published.suppressed).toBe(false);
      const mci = await computeMci(admin, { employeeId, inputs: { performance: 80, skills: 70, learning: 90, engagement: 60, tenure: 50 } }, crypto.randomUUID());
      expect(mci.index).toBe(72);
      const fetched = await getMciRun(admin, mci.id);
      expect(fetched.id).toBe(mci.id);
      // Contractors: agency -> contract -> variance-held invoice -> worker.
      const agency = await createAgency(admin, { name: `Shakti-TDD-${suffix}`, code: `AG-${suffix}`, licenceNo: `LIC-${suffix}`, licenceValidTill: "2027-03-31", vendorPfCode: "KN/BNG/0012345", vendorEsiCode: "53000123450001099" });
      const contract = await createContract(admin, { agencyId: agency.id, code: `CTR-TDD-${suffix}`, startsOn: "2026-04-01", endsOn: "2027-03-31", locationCode: "PEENYA", orgUnit: "Weaving", scopeOfWork: "Housekeeping and material movement across the weaving shed for the contract period.", workerClass: "contract_labour", sanctionedCount: 25, rateCard: [{ skill: "unskilled", dailyRateMinor: 60_000, overtimeRateMinor: 11_250 }], attendanceRequired: true, status: "active", monthlyMinor: 10_000_000, varianceThresholdPct: 2 }, crypto.randomUUID());
      const held = await submitInvoice(admin, { contractId: contract.id, invoiceNumber: `INV-H-${suffix}`, invoiceDate: "2026-09-30", contractedMinor: 10_000_000, billedMinor: 10_500_000, claimedDays: [{ skill: "unskilled", days: 175, dailyRateMinor: 60_000, amountMinor: 10_500_000 }], claimedOtHours: 0, vendorRemittanceRef: `RM-H-${suffix}`, period: "2026-09" });
      expect(held.status).toBe("held");
      const approvedInvoice = await submitInvoice(admin, { contractId: contract.id, invoiceNumber: `INV-A-${suffix}`, invoiceDate: "2026-09-30", contractedMinor: 10_000_000, billedMinor: 10_000_000, claimedDays: [{ skill: "unskilled", days: 166, dailyRateMinor: 60_000, amountMinor: 10_000_000 }], claimedOtHours: 0, vendorRemittanceRef: `RM-A-${suffix}`, period: "2026-09" });
      expect(approvedInvoice.status).toBe("approved");
      const invoices = await listInvoices(admin, contract.id);
      expect((invoices as unknown[])).toHaveLength(2);
      const assignment = await assignWorker(admin, { contractId: contract.id, personName: "Raju TDD", category: "contract", startsOn: "2026-09-01" });
      expect(assignment.status).toBe("active");
      assignmentId = assignment.id;
      contractorPersonId = assignment.personId;      // Privacy: erase case closes; active hold blocks; release unblocks.
      const erasure = await openRightsCase(admin, { kind: "erase", details: "Delete my data", identityProofRef: "kyc-9" }, crypto.randomUUID());
      const hold = await createLegalHold(admin, { reason: `Tribunal-TDD-${suffix}`, scope: "tenant" });
      await expect(closeRightsCase(admin, erasure.id, "Erased", crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      await releaseLegalHold(admin, hold.id, crypto.randomUUID());
      const closed = await closeRightsCase(admin, erasure.id, "Erased after hold release", crypto.randomUUID());
      expect(closed.status).toBe("closed");
      // Integrations: sandbox connects, live demands proof, secrets stay referenced.
      const connection = await connectIntegration(admin, { catalogCode: `ERP-TDD-${suffix}`, environment: "Sandbox", config: { baseUrl: "https://erp.example.test" }, secretRef: "vault:erp/oauth", verifiedRoundTrip: false }, crypto.randomUUID());
      expect(connection.environment).toBe("Sandbox");
      await expect(connectIntegration(admin, { catalogCode: `ERP-TDD-${suffix}`, environment: "Live", config: {}, verifiedRoundTrip: false }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      await expect(connectIntegration(admin, { catalogCode: `ERP-TDD-${suffix}`, environment: "Sandbox", config: { api_token: "hardcoded-secret" }, verifiedRoundTrip: false }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      const connections = await listConnections(admin);
      expect(JSON.stringify(connections)).not.toContain("hardcoded-secret");
      const endpoint = await createWebhookEndpoint(admin, { url: "https://erp.example.test/hook", events: ["payroll.finalized"], secret: "sixteen-chars-minimum" });
      const subscription = await subscribeWebhook(admin, endpoint.id, ["payroll.finalized"]);
      const deliveries = await listDeliveries(admin, subscription.id);
      expect(deliveries).toEqual([]);
    } finally {
      await db`delete from webhook_subscriptions where tenant_id = ${tenantId}`;
      await db`delete from webhook_endpoints where tenant_id = ${tenantId}`;
      await db`delete from integration_connections where tenant_id = ${tenantId} and attributes->>'environment' = 'Sandbox'`;
      await db`delete from legal_holds where tenant_id = ${tenantId} and attributes->>'reason' like 'Tribunal-TDD-%'`;
      await db`delete from privacy_requests where tenant_id = ${tenantId}`;
      await db`delete from contract_worker_assignments where tenant_id = ${tenantId} and id = ${assignmentId}`;
      await db`delete from people where id = ${contractorPersonId}`;
      await db`delete from contractor_invoices where tenant_id = ${tenantId} and attributes->>'period' = '2026-09'`;
      await db`delete from contractor_contracts where tenant_id = ${tenantId} and attributes->>'code' like 'CTR-TDD-%'`;
      await db`delete from contractor_organizations where tenant_id = ${tenantId} and attributes->>'name' like 'Shakti-TDD-%'`;
      await db`delete from capability_index_runs where tenant_id = ${tenantId}`;
      await db`delete from metric_snapshots where tenant_id = ${tenantId}`;
      await db`delete from metric_definitions where tenant_id = ${tenantId} and attributes->>'code' like 'ATTR-TDD-%'`;
      await db`delete from compliance_evidence where tenant_id = ${tenantId}`;
      await db`delete from compliance_calendar_items where tenant_id = ${tenantId} and attributes->>'title' = 'PF monthly return'`;
      await db`delete from document_versions where tenant_id = ${tenantId} and document_id in (select id from documents where tenant_id = ${tenantId} and attributes->>'title' = 'PF challan')`;
      await db`delete from documents where tenant_id = ${tenantId} and attributes->>'title' = 'PF challan'`;
      await db`delete from employees where tenant_id = ${tenantId} and employee_code like 'HO-TDD-P7-%'`;
      await db`delete from people where tenant_id = ${tenantId} and id = ${personId}`;
    }
  });
});
