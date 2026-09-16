import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import type { Access } from "@/server/platform/access";

const LIVE = process.env.MKRAFT_WORKFLOW_LIVE_VERIFY === "1";

describe.skipIf(!LIVE)("isolated operational database verification", () => {
  it("persists workflows, prevents duplicate writes and self-approval, and protects dossier data", { timeout: 240000 }, async () => {
    config({ path: [".env.local", ".env"], quiet: true });
    const sql = neon(process.env.DATABASE_URL!);
    const { mutateOperationalRecord, listOperationalRecords } = await import("./operational-service");
    const { operationalApprovals } = await import("./approval-inbox");
    const { saveDossier, listDossier } = await import("./dossier-service");
    const tenantId = randomUUID(), user1 = randomUUID(), user2 = randomUUID(), member1 = randomUUID(), member2 = randomUUID(), personId = randomUUID(), employeeId = randomUUID();
    const managerEmployeeId=randomUUID(), outsiderEmployeeId=randomUUID(), managerPersonId=randomUUID(), outsiderPersonId=randomUUID();
    const legalEntityId = randomUUID();
    const jurisdictions = await sql`select id from jurisdictions limit 1`;
    const jurisdictionId = jurisdictions[0]?.id;
    if(!jurisdictionId) throw new Error("A jurisdiction reference is required for the fixture.");
    const admin = () => sql`select set_config('app.platform_admin','true',true)`;
    const permissionRows = await sql`select permission_key from permissions where status='active'`;
    const permissions = permissionRows.map(row => String(row.permission_key));
    const access = (second = false): Access => ({ tenantId, context: { tenantId, actorUserId: second ? user2 : user1, membershipId: second ? member2 : member1, permissions, roles: ["test-owner"] } });
    const write = (resource: string, action: string, input: unknown, id?: string, version?: number, second = false, key = randomUUID()) => mutateOperationalRecord(access(second), resource, { action, input, id, version, key });
    try {
      await sql.transaction([
        admin(),
        sql`insert into tenants(id,name,slug) values(${tenantId},'Isolated workflow verification',${"verify-" + tenantId})`,
        sql`insert into "user"(id,name,email) values(${user1},'Workflow requester',${user1 + "@example.invalid"}),(${user2},'Workflow approver',${user2 + "@example.invalid"})`,
        sql`insert into memberships(id,tenant_id,user_id,role,status) values(${member1},${tenantId},${user1},'owner','active'),(${member2},${tenantId},${user2},'owner','active')`,
        sql`insert into legal_entities(id,tenant_id,jurisdiction_id,code,legal_name,currency_code) values(${legalEntityId},${tenantId},${jurisdictionId},'VERIFY','Workflow test entity','INR')`,
        sql`insert into people(id,tenant_id) values(${personId},${tenantId}),(${managerPersonId},${tenantId}),(${outsiderPersonId},${tenantId})`,
        sql`insert into employees(id,tenant_id,person_id,employee_code,first_name,last_name,designation,department,location,joining_date) values(${employeeId},${tenantId},${personId},'TEST-001','Workflow','Subject','Tester','Verification','Test site','2026-01-01')`,
      ]);
      await sql.transaction([admin(),
        sql`insert into employees(id,tenant_id,person_id,employee_code,first_name,last_name,designation,department,location,joining_date) values(${managerEmployeeId},${tenantId},${managerPersonId},'TEST-MGR','Test','Manager','Manager','Verification','Test site','2026-01-01'),(${outsiderEmployeeId},${tenantId},${outsiderPersonId},'TEST-OTHER','Test','Other','Tester','Other','Test site','2026-01-01')`,
        sql`update employees set manager_employee_id=${managerEmployeeId} where tenant_id=${tenantId} and id=${employeeId}`,
      ]);
      const travel = { employeeId, requestType: "business_travel", purpose: "Site inspection", origin: "Pune", destination: "Mumbai", startDate: "2026-09-20", endDate: "2026-09-21", transport: "rail", estimatedCostMinor: 50000, advanceMinor: 10000, contactPhone: "+911234567890" };
      const key = randomUUID();
      const [first, replay] = await Promise.all([write("travel", "create", travel, undefined, undefined, false, key), write("travel", "create", travel, undefined, undefined, false, key)]);
      expect(first.id).toBe(replay.id);
      await expect(write("travel", "create", { ...travel, purpose: "Different request" }, undefined, undefined, false, key)).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
      const submitted = await write("travel", "submit", { reason: "Ready for review" }, String(first.id), 1);
      expect(submitted.status).toBe("submitted");
      expect((await operationalApprovals(access())).some(row => row.id===first.id)).toBe(false);
      expect((await operationalApprovals(access(true))).some(row => row.id===first.id)).toBe(true);
      await expect(write("travel", "approve", { reason: "Self approval" }, String(first.id), 2)).rejects.toMatchObject({ code: "WORKFLOW_CONFLICT" });
      await expect(write("travel", "approve", { reason: "Changed requester", employeeId }, String(first.id), 2, true)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const approved = await write("travel", "approve", { reason: "Budget approved" }, String(first.id), 2, true);
      expect(approved.status).toBe("approved");
      await expect(write("travel", "edit", travel, String(first.id), 1)).rejects.toMatchObject({ code: "WORKFLOW_CONFLICT" });
      expect((await write("travel", "complete", { reason: "Visit completed" }, String(first.id), 3)).status).toBe("completed");
      const worklist = await listOperationalRecords(access(), "travel", new URLSearchParams({ employeeId }));
      expect(worklist.items).toHaveLength(1);
      const forged = { ...access(), tenantId: randomUUID() };
      await expect(listOperationalRecords(forged, "travel", new URLSearchParams())).rejects.toMatchObject({ code: "NOT_FOUND" });

      const selfAccess:Access={...access(),context:{...access().context,employeeId,permissions:["workforce.travel.self.read","workforce.travel.self.write"]}};
      const managerAccess:Access={...access(true),context:{...access(true).context,employeeId:managerEmployeeId,permissions:["workforce.travel.team.read","workforce.travel.team.approve"]}};
      const own=await mutateOperationalRecord(selfAccess,"travel",{action:"create",input:travel,key:randomUUID()});
      await expect(mutateOperationalRecord(selfAccess,"travel",{action:"create",input:{...travel,employeeId:outsiderEmployeeId},key:randomUUID()})).rejects.toMatchObject({code:"WORKFLOW_CONFLICT"});
      await mutateOperationalRecord(selfAccess,"travel",{id:String(own.id),version:1,action:"submit",input:{reason:"Manager review"},key:randomUUID()});
      expect((await operationalApprovals(managerAccess)).some(row => row.id===own.id)).toBe(true);
      await mutateOperationalRecord(managerAccess,"travel",{id:String(own.id),version:2,action:"approve",input:{reason:"Team request approved"},key:randomUUID()});
      const outside=await write("travel","create",{...travel,employeeId:outsiderEmployeeId});
      await write("travel","submit",{reason:"Outside reporting team"},String(outside.id),1);
      expect((await operationalApprovals(managerAccess)).some(row => row.id===outside.id)).toBe(false);
      await expect(mutateOperationalRecord(managerAccess,"travel",{id:String(outside.id),version:2,action:"approve",input:{reason:"Outside team"},key:randomUUID()})).rejects.toMatchObject({code:"WORKFLOW_CONFLICT"});
      expect((await listOperationalRecords(selfAccess,"travel",new URLSearchParams())).items).toHaveLength(2);
      expect((await listOperationalRecords(managerAccess,"travel",new URLSearchParams())).items).toHaveLength(2);

      const project = await write("projects", "create", { employeeId, code: "VERIFY", name: "Verification project", startDate: "2026-09-01", endDate: "2026-10-01", budgetMinor: 100000, costCenter: "TEST", description: "Capacity verification" });
      await write("projects", "activate", { reason: "Project approved" }, String(project.id), 1, true);
      const time = { employeeId, projectId: project.id, workDate: "2026-09-20", minutes: 1000, task: "Site work", billing: "billable" };
      await write("timesheets", "create", time);
      await expect(write("timesheets", "create", { ...time, minutes: 500 })).rejects.toMatchObject({ code: "WORKFLOW_CONFLICT" });

      const allocation = {employeeId,projectId:project.id,role:"Tester",allocationPercent:60,startDate:"2026-09-01",endDate:"2026-09-30",costCenter:"TEST"};
      const allocationA=await write("allocations","create",allocation);
      await write("allocations","submit",{reason:"Ready for planning"},String(allocationA.id),1);
      await write("allocations","approve",{reason:"Capacity approved"},String(allocationA.id),2,true);
      const allocationB=await write("allocations","create",allocation);
      await write("allocations","submit",{reason:"Another assignment"},String(allocationB.id),1);
      await expect(write("allocations","approve",{reason:"Over capacity"},String(allocationB.id),2,true)).rejects.toMatchObject({code:"WORKFLOW_CONFLICT"});
      await expect(write("projects","close",{reason:"Assignments still open"},String(project.id),2,true)).rejects.toMatchObject({code:"WORKFLOW_CONFLICT"});
      const asset=await write("assets","create",{legalEntityId,assetTag:"VERIFY-LAPTOP",name:"Test laptop",category:"laptop",serialNumber:"VERIFY-001",purchaseDate:"2026-09-01",purchaseCostMinor:100000,location:"Test site",condition:"new"});
      await write("assets","allocate",{reason:"Issue for test",employeeId,conditionAtIssue:"good",acknowledgedByEmployee:true},String(asset.id),1,true);
      await expect(write("assets","allocate",{reason:"Duplicate allocation",employeeId,conditionAtIssue:"good",acknowledgedByEmployee:true},String(asset.id),2,true)).rejects.toMatchObject({code:"WORKFLOW_CONFLICT"});
      await write("assets","return",{reason:"Returned after test",condition:"good",returnedOn:"2026-09-13"},String(asset.id),2,true);
      const custody=await sql.transaction([admin(),sql`select attributes->>'status' as status from asset_assignments where tenant_id=${tenantId} and asset_id=${asset.id}`]);
      expect(custody[1][0].status).toBe("returned");

      const contact = { employeeId, contactType: "mobile", value: "+911234567890", effectiveFrom: "2026-09-01" };
      const contactKey = randomUUID();
      const saved = await saveDossier(access(), "contacts", { input: contact, key: contactKey });
      expect((await saveDossier(access(), "contacts", { input: contact, key: contactKey })).id).toBe(saved.id);
      await saveDossier(access(), "contacts", { id: saved.id, version: 1, input: { ...contact, value: "+919876543210" }, key: randomUUID() });
      await expect(saveDossier(access(), "contacts", { id: saved.id, version: 1, input: contact, key: randomUUID() })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      const bank = { employeeId, accountHolder: "Workflow Subject", bankName: "Test Bank", branch: "Test", accountNumber: "TEST123456", routingCode: "TEST0001234", accountType: "salary", currency: "INR", effectiveFrom: "2026-09-01" };
      const savedBank = await saveDossier(access(), "bank", { input: bank, key: randomUUID() });
      const stored = await sql.transaction([admin(), sql`select attributes from bank_accounts where tenant_id=${tenantId} and id=${savedBank.id}`]);
      expect(JSON.stringify(stored[1])).not.toContain(bank.accountNumber);
      expect((await listDossier(access(), "bank", new URLSearchParams({ employeeId }))).items[0]).toMatchObject(bank);
      const eventRows = await sql.transaction([admin(), sql`select count(*)::int as count from hrms_operation_events where tenant_id=${tenantId} and record_id=${first.id}`]);
      expect(eventRows[1][0].count).toBe(4);
    } finally {
      // Every predicate is the random test tenant/user ID created above.
      const tables = ["audit_events", "hrms_operation_events", "hrms_command_requests", "hrms_dossier_receipts", "hrms_operation_records", "bank_accounts", "employee_contacts", "asset_assignments", "asset_catalog", "employees", "people", "legal_entities", "memberships", "tenants"];
      await sql.transaction([admin(), ...tables.map(table => sql.query('delete from "' + table + '" where "' + (table === "tenants" ? "id" : "tenant_id") + '"=$1', [tenantId])), sql`delete from "user" where id in (${user1},${user2})`]);
    }
  });
});
