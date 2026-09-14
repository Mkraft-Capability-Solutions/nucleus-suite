import "server-only";
import { operationalScope } from "./operational-access";
import { workflowDatabaseError } from "./database-error";
import { createHash, randomUUID } from "node:crypto";
import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError, parsePagination } from "@/server/platform/http";
import { assertBillNumberUnusedInTenant } from "@/server/payroll/reimbursements";
import { assertPassedAmount, parseOperationalInput, transitionDefinition, transitionInput } from "./operational-validation";

function definitionFor(resource: string) {
  if (!Object.hasOwn(operationalResources, resource)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Unknown operational workflow." });
  return operationalResources[resource];
}

export async function listOperationalRecords(access: Access, resource: string, params: URLSearchParams) {
  const definition = definitionFor(resource);
  const scope = operationalScope(access, definition.permission, "read");
  const { page, pageSize } = parsePagination(params);
  const employee = params.get("employeeId");
  if (employee && !/^[a-f\d-]{36}$/i.test(employee)) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid employee reference." });
  const [rows] = await tenantTx(access, [sqlClient`
    select data || jsonb_build_object('id', id, 'status', status, 'version', version, 'createdAt', created_at, 'createdByMembershipId', created_by_membership_id) as record
    from hrms_operation_records where tenant_id = ${access.tenantId} and resource = ${resource}
      and (${scope} = 'all' or employee_id = ${access.context.employeeId ?? null}::uuid or (${scope} = 'team' and employee_id in(select id from employees where tenant_id=${access.tenantId} and manager_employee_id=${access.context.employeeId ?? null}::uuid)))
      and (${resource} <> 'tickets' or ${scope} <> 'team' or employee_id=${access.context.employeeId ?? null}::uuid or data->>'category' <> 'grievance')
      and (${employee}::uuid is null or employee_id = ${employee}::uuid)
      and (${params.get("status")}::text is null or status = ${params.get("status")})
      and data::text ilike ${"%" + (params.get("search") ?? "").slice(0, 100) + "%"}
    order by created_at desc, id desc limit ${pageSize + 1} offset ${(page - 1) * pageSize}
  `]);
  const records = (rows as Array<{ record: { id: string; version: number } }>).map(row => row.record);
  return { items: records.slice(0, pageSize), nextCursor: records.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 })).toString("base64url") : null };
}

export async function mutateOperationalRecord(access: Access, resource: string, args: { id?: string; action: string; version?: number; input: unknown; key: string }) {
  const definition = definitionFor(resource);
  const creating = args.action === "create";
  const editing = args.action === "edit";
  const transition = creating || editing ? undefined : transitionDefinition(resource, args.action);
  const scope = operationalScope(access, definition.permission, transition?.approval ? "approve" : "write");
  if(resource === "expenses" && args.action === "reimburse") enforce(access.context,"payroll.accounting.write",{tenantId:access.tenantId});
  const parsed = creating || editing ? parseOperationalInput(resource, args.input) : transitionInput.safeParse(args.input);
  if (!creating && !editing && !(parsed as ReturnType<typeof transitionInput.safeParse>).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reason and valid action details are required." });
  const data = (creating || editing ? parsed : (parsed as { data: unknown }).data) as Record<string, unknown>;
  if (!creating && !editing) {
    const allowed = new Set(["reason", ...(args.action === "allocate" ? ["employeeId"] : []), ...(args.action === "assign" ? ["ownerEmployeeId"] : []), ...(resource === "assets" && args.action === "return" ? ["condition", "returnedOn"] : []), ...(["reimburse", "finalize"].includes(args.action) ? ["paymentReference"] : []), ...(["file", "accept"].includes(args.action) ? ["acknowledgementReference"] : []), ...(resource === "taxDeclarations" && ["verify", "partiallyVerify", "reject", "return", "requestProof"].includes(args.action) ? ["verifierRemarks"] : []), ...(resource === "expenses" && args.action === "approve" ? ["approvedAmountMinor"] : [])]);
    if (Object.keys(data).some(field => !allowed.has(field))) throw new HttpError({status:400,code:"BAD_REQUEST",message:"This action cannot modify the requested fields."});
  }
  if (args.action === "allocate" && !data.employeeId) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Choose the employee receiving the asset." });
  if (args.action === "assign" && !data.ownerEmployeeId) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Choose a ticket owner." });
  if (["reimburse", "finalize"].includes(args.action) && !data.paymentReference) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Enter the completed payment reference." });
  if (["file", "accept"].includes(args.action) && !data.acknowledgementReference) throw new HttpError({status:400,code:"BAD_REQUEST",message:"Enter the external filing acknowledgement reference."});
  if (resource === "assets" && args.action === "return" && (!data.condition || !data.returnedOn)) throw new HttpError({status:400,code:"BAD_REQUEST",message:"Record the return date and condition."});
  // FRM-PAY-06: a bill can be claimed once per claim type per financial year.
  if (resource === "expenses" && (creating || editing)) {
    await assertBillNumberUnusedInTenant(access, {
      id: args.id,
      billNumber: data.billNumber === undefined ? null : String(data.billNumber),
      category: String(data.category ?? ""),
      expenseDate: data.expenseDate === undefined ? null : String(data.expenseDate),
    });
  }
  if (resource === "expenses" && args.action === "approve" && data.approvedAmountMinor !== undefined) {
    const [claimRows] = await tenantTx(access, [
      sqlClient`select (data->>'amountMinor')::bigint as claimed from hrms_operation_records where tenant_id = ${access.tenantId} and resource = 'expenses' and id = ${args.id ?? null} limit 1`,
    ]);
    assertPassedAmount(Number((claimRows as Array<{ claimed: number | string | null }>)[0]?.claimed ?? 0), data.approvedAmountMinor);
  }
  if (resource === "taxDeclarations" && ["reject", "partiallyVerify", "return"].includes(args.action) && String(data.verifierRemarks ?? data.reason ?? "").trim().length < 10) {
    throw new HttpError({ status: 422, code: "REMARKS_REQUIRED", message: "Verifier remarks of at least 10 characters are required when a declaration is rejected, returned or only partly verified.", details: [{ field: "verifierRemarks", issue: "Enter at least 10 characters explaining the decision." }] });
  }
  const id = args.id ?? randomUUID();
  const fingerprint = createHash("sha256").update(JSON.stringify({ resource, id: args.id, action: args.action, version: args.version, data })).digest("hex");
  const status = creating ? definition.initial : transition?.to === "same" ? null : transition?.to ?? null;
  const employeeId = data.employeeId ?? null;
  const parentId = data.projectId ?? data.travelId ?? null;
  // One tenant-local lock serializes capacity checks with writes. It also makes
  // idempotency reservation, record change, history and audit one transaction.
  const statements = [sqlClient`select pg_advisory_xact_lock(hashtextextended(${"hrms.operations:" + access.tenantId}, 0))`];
  const source = creating
    ? "select $4::uuid id, $5::jsonb data, $6::text status, 1 version, $15::uuid employee_id, $16::uuid parent_id, $2::uuid created_by_membership_id"
    : `select id, ${editing ? "$5::jsonb" : "r.data || $5::jsonb"} data, coalesce($6::text, status) status, version + 1 version,
        coalesce($15::uuid, employee_id) employee_id, ${editing ? "$16::uuid" : "parent_id"} parent_id, created_by_membership_id
       from hrms_operation_records r where tenant_id = $1::uuid and resource = $3 and id = $4::uuid and version = $7::int
         and ($17='all' or r.employee_id=$13::uuid or ($17='team' and r.employee_id in(select id from employees where tenant_id=$1::uuid and manager_employee_id=$13::uuid)))
         and status in (select jsonb_array_elements_text($14::jsonb))
         and (not $12::boolean or (created_by_membership_id <> $2::uuid and (employee_id is null or employee_id is distinct from $13::uuid)))`;
  const write = creating
    ? "insert into hrms_operation_records(id,tenant_id,resource,data,status,version,employee_id,parent_id,created_by_membership_id) select id,$1::uuid,$3,data,status,version,employee_id,parent_id,created_by_membership_id from valid returning *"
    : "update hrms_operation_records r set data=c.data,status=c.status,version=c.version,employee_id=c.employee_id,parent_id=c.parent_id,updated_at=now() from valid c where r.tenant_id=$1::uuid and r.id=c.id returning r.*";
  statements.push(sqlClient.query(`
    with typed as (select $7::int, $12::boolean, $13::uuid, $14::jsonb, $15::uuid, $16::uuid), prior as (select fingerprint, response, actor_membership_id from hrms_operation_events where tenant_id=$1::uuid and idempotency_key=$9),
    candidate as (${source}),
    valid as (select c.* from candidate c where not exists (select 1 from prior)
      and ($17='all' or c.employee_id=$13::uuid or ($17='team' and c.employee_id in(select id from employees where tenant_id=$1::uuid and manager_employee_id=$13::uuid)))
      and ($3 <> 'tickets' or $17 <> 'team' or c.employee_id=$13::uuid or c.data->>'category' <> 'grievance')
      and (c.employee_id is null or exists(select 1 from employees e where e.tenant_id=$1::uuid and e.id=c.employee_id))
      and (not (c.data ? 'ownerEmployeeId') or exists(select 1 from employees e where e.tenant_id=$1::uuid and e.id=(c.data->>'ownerEmployeeId')::uuid))
      and ($3 not in ('allocations','timesheets') or exists(select 1 from hrms_operation_records p where p.tenant_id=$1::uuid and p.id=c.parent_id and p.resource='projects' and p.status='active'
        and coalesce(c.data->>'startDate',c.data->>'workDate') >= p.data->>'startDate' and coalesce(c.data->>'endDate',c.data->>'workDate') <= p.data->>'endDate'))
      and ($3 <> 'expenses' or c.parent_id is null or exists(select 1 from hrms_operation_records p where p.tenant_id=$1::uuid and p.id=c.parent_id and p.resource='travel' and p.employee_id=c.employee_id and p.status in ('approved','completed')))
      and ($3 <> 'timesheets' or c.status in ('cancelled','rejected') or (select coalesce(sum((t.data->>'minutes')::int),0) from hrms_operation_records t where t.tenant_id=$1::uuid and t.resource='timesheets' and t.employee_id=c.employee_id and t.id<>c.id and t.data->>'workDate'=c.data->>'workDate' and t.status not in ('cancelled','rejected')) + (c.data->>'minutes')::int <= 1440)
      and ($3 <> 'allocations' or c.status <> 'approved' or (select coalesce(sum((t.data->>'allocationPercent')::int),0) from hrms_operation_records t where t.tenant_id=$1::uuid and t.resource='allocations' and t.employee_id=c.employee_id and t.id<>c.id and t.status='approved' and t.data->>'startDate' <= c.data->>'endDate' and t.data->>'endDate' >= c.data->>'startDate') + (c.data->>'allocationPercent')::int <= 100)
      and ($3 <> 'rosters' or c.status not in ('approved','published') or not exists(select 1 from hrms_operation_records t where t.tenant_id=$1::uuid and t.resource='rosters' and t.employee_id=c.employee_id and t.id<>c.id and t.status in ('approved','published') and t.data->>'startDate' <= c.data->>'endDate' and t.data->>'endDate' >= c.data->>'startDate'))
      and ($3 <> 'projects' or c.status <> 'closed' or not exists(select 1 from hrms_operation_records t where t.tenant_id=$1::uuid and t.parent_id=c.id and t.resource='allocations' and t.status='approved'))

      and ($3 <> 'ledger' or c.status <> 'approved' or not exists(select 1 from hrms_operation_records t where t.tenant_id=$1::uuid and t.resource='ledger' and t.id<>c.id and t.status='approved' and t.data->>'componentCode'=c.data->>'componentCode' and t.data->>'startDate' <= c.data->>'endDate' and t.data->>'endDate' >= c.data->>'startDate'))
      and ($3 <> 'filings' or exists(select 1 from vp_statutory_instances f where f.tenant_id=$1::uuid and f.id=(c.data->>'generatedFormId')::uuid))
      and ($3 <> 'settlements' or exists(select 1 from offboarding_cases o join employments e on e.tenant_id=o.tenant_id and e.id=o.employment_id where o.tenant_id=$1::uuid and o.id=(c.data->>'offboardingCaseId')::uuid and e.employee_id=c.employee_id and o.attributes->>'status' <> 'settled'))
      and ($3 <> 'settlements' or exists(select 1 from payroll_runs p where p.tenant_id=$1::uuid and p.id=(c.data->>'payrollRunId')::uuid and p.status='finalized'))
      and ($3 <> 'settlements' or c.status <> 'finalized' or (
        exists(select 1 from clearance_items i where i.tenant_id=$1::uuid and i.offboarding_case_id=(c.data->>'offboardingCaseId')::uuid)
        and not exists(select 1 from clearance_items i where i.tenant_id=$1::uuid and i.offboarding_case_id=(c.data->>'offboardingCaseId')::uuid and coalesce(i.attributes->>'status','pending') <> 'cleared')
        and not exists(select 1 from hrms_operation_records a where a.tenant_id=$1::uuid and a.resource='assets' and a.employee_id=c.employee_id and a.status='allocated')
        and (select coalesce(sum((l.attributes->>'outstanding_minor')::bigint),0) from employee_loans l where l.tenant_id=$1::uuid and l.employee_id=c.employee_id and l.attributes->>'status'='disbursed') <= (c.data->>'loanRecoveryMinor')::bigint
      ))
    ), changed as (${write}),
    asset_master as (insert into asset_catalog(id,tenant_id,legal_entity_id,attributes)
      select id,$1::uuid,(data->>'legalEntityId')::uuid,data || jsonb_build_object('status',status) from changed where $3='assets'
      on conflict(id) do update set attributes=excluded.attributes,version=asset_catalog.version+1,updated_at=now() where asset_catalog.tenant_id=excluded.tenant_id returning id),
    assigned_asset as (insert into asset_assignments(tenant_id,asset_id,employee_id,attributes)
      select $1::uuid,c.id,c.employee_id,jsonb_build_object('status','allocated','allocatedAt',now()) from changed c where $3='assets' and $8='allocate' and exists(select 1 from asset_master m where m.id=c.id)),
    returned_asset as (update asset_assignments a set attributes=a.attributes || jsonb_build_object('status','returned','condition',c.data->>'condition','returnedOn',c.data->>'returnedOn'),version=a.version+1,updated_at=now()
      from changed c where $3='assets' and $8='return' and a.tenant_id=$1::uuid and a.asset_id=c.id and a.employee_id=c.employee_id and a.attributes->>'status'='allocated'),
    settled as (insert into full_final_settlements(id,tenant_id,employment_id,offboarding_case_id,payroll_run_id,attributes)
      select c.id,$1::uuid,o.employment_id,o.id,(c.data->>'payrollRunId')::uuid,c.data || jsonb_build_object('status','settled','net_minor',c.data->'netPayableMinor') from changed c join offboarding_cases o on o.tenant_id=$1::uuid and o.id=(c.data->>'offboardingCaseId')::uuid where $3='settlements' and c.status='finalized' returning offboarding_case_id),
    closed_exit as (update offboarding_cases o set attributes=attributes || '{"status":"settled"}'::jsonb,version=version+1,updated_at=now() where o.tenant_id=$1::uuid and o.id in(select offboarding_case_id from settled)),
    logged as (insert into hrms_operation_events(tenant_id,record_id,actor_membership_id,action,reason,idempotency_key,fingerprint,response)
      select $1::uuid,id,$2::uuid,$8,$11,$9,$10,data || jsonb_build_object('id',id,'status',status,'version',version,'createdByMembershipId',created_by_membership_id) from changed returning response),
    audited as (insert into audit_events(tenant_id,membership_id,action,entity_type,entity_id,reason,after)
      select $1::uuid,$2::uuid,'operations.' || $3 || '.' || $8,'hrms_operation',id,$11,jsonb_build_object('status',status,'version',version) from changed)
    select response, false conflict from logged union all select response, (fingerprint <> $10 or actor_membership_id <> $2::uuid) conflict from prior
  `, [access.tenantId, access.context.membershipId, resource, id, JSON.stringify(data), status, args.version ?? 0, args.action, args.key, fingerprint, String(data.reason ?? args.action), transition?.approval ?? false, access.context.employeeId ?? null, JSON.stringify(editing ? definition.editable : transition?.from ?? []), employeeId, parentId, scope]));
  const results = await tenantTx(access, statements).catch(workflowDatabaseError);
  const result = (results[1] as Array<{ response: Record<string, unknown>; conflict: boolean }>)[0];
  if (result?.conflict) throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This request key was used for a different request." });
  if (!result) {
    if (transition?.approval) {
      const [ownRows] = await tenantTx(access, [
        sqlClient`
          select created_by_membership_id = ${access.context.membershipId} as own_request,
                 employee_id is not distinct from ${uuidOrNull(access.context.employeeId ?? "")}::uuid as own_record
          from hrms_operation_records
          where tenant_id = ${access.tenantId} and resource = ${resource} and id = ${args.id ?? null} limit 1
        `,
      ]);
      const own = (ownRows as Array<{ own_request: boolean; own_record: boolean }>)[0];
      if (own?.own_request || own?.own_record) {
        throw new HttpError({
          status: 409, code: "SEPARATION_OF_DUTIES",
          message: own.own_request
            ? "You raised this record, so you cannot also approve it. A different approver is required."
            : "This record is about you, so you cannot approve it. A different approver is required.",
          details: [{ field: "action", issue: "Approval requires a different requester and approver." }],
        });
      }
    }
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "The record changed, the action is not allowed in its current state, or a linked record/capacity check failed. Approvals require a different requester and approver. Refresh and review the records." });
  }
  return result.response;
}
