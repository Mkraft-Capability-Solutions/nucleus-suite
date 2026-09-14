import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** SCR-064 Asset register: allocation and return of catalogued assets. */
export type AssetRegisterState = "available" | "allocated" | "returned" | "written_off";

/**
 * Pure asset-state derivation mirrored by ASSET_STATUS_CASE below (unit-tested).
 * A written-off condition always wins; a live holder implies allocation unless
 * the catalogue has already been marked returned.
 */
export function deriveAssetState(
  catalogStatus: string | null | undefined,
  condition: string | null | undefined,
  hasHolder: boolean,
): AssetRegisterState {
  const normalizedCondition = (condition ?? "").trim().toLowerCase();
  if (normalizedCondition.includes("written off")) return "written_off";
  const normalizedStatus = (catalogStatus ?? "").trim().toLowerCase();
  if (normalizedStatus === "allocated") return "allocated";
  if (hasHolder && normalizedStatus !== "returned") return "allocated";
  if (normalizedStatus === "returned") return "returned";
  return "available";
}

/** SQL mirror of deriveAssetState. Requires the ac and holder aliases. */
const ASSET_STATUS_CASE = `case
  when lower(trim(coalesce(ac.attributes->>'condition', ''))) like '%written off%' then 'written_off'
  when lower(trim(coalesce(ac.attributes->>'status', ''))) = 'allocated' then 'allocated'
  when holder.employee_code is not null and lower(trim(coalesce(ac.attributes->>'status', ''))) <> 'returned' then 'allocated'
  when lower(trim(coalesce(ac.attributes->>'status', ''))) = 'returned' then 'returned'
  else 'available' end`;

/** Latest custody row for the asset, with the employee it sits with. */
const HOLDER_LATERAL = `left join lateral (
  select e.employee_code, e.first_name, e.last_name,
    aa.attributes->>'issued_on' as issued_on,
    aa.attributes->>'returned_on' as returned_on,
    aa.attributes->>'condition_at_issue' as condition_at_issue,
    aa.attributes->>'expected_return' as expected_return,
    coalesce((aa.attributes->>'acknowledged_by_employee')::boolean, false) as acknowledged_by_employee,
    aa.attributes->>'condition_at_return' as condition_at_return,
    (aa.attributes->>'recovery_amount_minor')::bigint as recovery_amount_minor,
    aa.attributes->>'return_remarks' as return_remarks
  from asset_assignments aa
  left join employees e on e.tenant_id = aa.tenant_id and e.id = aa.employee_id
  where aa.tenant_id = ac.tenant_id and aa.asset_id = ac.id
  order by coalesce(aa.attributes->>'issued_on', '') desc, aa.created_at desc limit 1
) holder on true`;

const ASSET_PROJECTION = `ac.id,
  coalesce(ac.attributes->>'asset_code', ac.id::text) as asset_code,
  coalesce(ac.attributes->>'type', 'Unclassified') as asset_type,
  coalesce(ac.attributes->>'description', '') as description,
  coalesce(ac.attributes->>'serial', '') as serial,
  holder.employee_code as holder_code,
  case when holder.employee_code is null then null else holder.first_name || ' ' || holder.last_name end as holder_name,
  ac.attributes->>'condition' as condition,
  holder.issued_on as issued_on,
  holder.returned_on as returned_on,
  holder.condition_at_issue as condition_at_issue,
  holder.expected_return as expected_return,
  holder.acknowledged_by_employee as acknowledged_by_employee,
  holder.condition_at_return as condition_at_return,
  holder.recovery_amount_minor as recovery_amount_minor,
  holder.return_remarks as return_remarks,
  coalesce((ac.attributes->>'clearance_item')::boolean, false) as clearance_item,
  (${ASSET_STATUS_CASE}) as status`;

export type AssetRegisterRow = {
  id: string;
  asset_code: string;
  asset_type: string;
  description: string;
  serial: string;
  holder_code: string | null;
  holder_name: string | null;
  condition: string | null;
  issued_on: string | null;
  returned_on: string | null;
  condition_at_issue: string | null;
  expected_return: string | null;
  acknowledged_by_employee: boolean;
  condition_at_return: string | null;
  recovery_amount_minor: number | string | null;
  return_remarks: string | null;
  clearance_item: boolean;
  status: AssetRegisterState;
};

export type AssetCustodyRow = {
  id: string;
  employee_code: string | null;
  employee_name: string | null;
  issued_on: string | null;
  returned_on: string | null;
  status: string | null;
};

/** Asset register queue with live custody and derived allocation state. */
export async function listAssetRegister(access: Access, search: string): Promise<AssetRegisterRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select ${ASSET_PROJECTION}
       from asset_catalog ac
       ${HOLDER_LATERAL}
       where ac.tenant_id = $1
         and ac.attributes->>'type' is not null
         and (coalesce(ac.attributes->>'asset_code', '') || ' ' || coalesce(ac.attributes->>'type', '') || ' '
           || coalesce(ac.attributes->>'description', '') || ' ' || coalesce(ac.attributes->>'serial', '') || ' '
           || coalesce(holder.employee_code, '') || ' ' || coalesce(holder.first_name, '') || ' '
           || coalesce(holder.last_name, '')) ilike $2
       order by coalesce(ac.attributes->>'asset_code', ac.id::text) asc limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return rows as AssetRegisterRow[];
}

async function loadAsset(access: Access, id: string): Promise<AssetRegisterRow> {
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select ${ASSET_PROJECTION}
       from asset_catalog ac
       ${HOLDER_LATERAL}
       where ac.tenant_id = $1 and ac.id = $2::uuid limit 1`,
      [access.tenantId, id],
    ),
  ]);
  const record = (rows as AssetRegisterRow[])[0];
  if (!record) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return record;
}

/** Single asset with its custody chain and an isolated audit trail. */
export async function getAssetRecord(access: Access, id: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const record = await loadAsset(access, id);
  const [custodyRows] = await tenantTx(access, [
    sqlClient.query(
      `select aa.id, e.employee_code,
         case when e.id is null then null else e.first_name || ' ' || e.last_name end as employee_name,
         aa.attributes->>'issued_on' as issued_on,
         aa.attributes->>'returned_on' as returned_on,
         aa.attributes->>'status' as status
       from asset_assignments aa
       left join employees e on e.tenant_id = aa.tenant_id and e.id = aa.employee_id
       where aa.tenant_id = $1 and aa.asset_id = $2::uuid
       order by coalesce(aa.attributes->>'issued_on', '') desc, aa.created_at desc limit 20`,
      [access.tenantId, id],
    ),
  ]);
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'asset' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record, custody: custodyRows as AssetCustodyRow[], auditTrail };
}

async function requireEmployee(access: Access, employeeId: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
}

/** The workbook forbids issuing an asset before the holder joined. */
async function requireIssuedOnOrAfterJoining(access: Access, employeeId: string, issuedOn: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select joining_date::text as joining_date from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  const joining = (rows as Array<{ joining_date: string | null }>)[0]?.joining_date;
  if (joining && issuedOn < joining) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: `This asset cannot be issued before the joining date (${joining}).` });
  }
}

/** Audit actions are bound as parameters so the SQL text stays free of dotted identifiers. */
const ALLOCATE_ACTION = "asset.allocate";
const RETURN_ACTION = "asset.return";

export const allocateAssetSchema = z.object({
  employeeId: z.string().uuid(),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  conditionAtIssue: z.enum(picklistValues("PL_ASSET_CONDITION")).default("new"),
  /**
   * Acknowledgement is the employee's own act on self-service, so allocation opens with it
   * off; an asset that stays unacknowledged is what puts the person on the HR chase list.
   */
  acknowledgedByEmployee: z.boolean().default(false),
  expectedReturn: z.iso.date().optional(),
  reason: z.string().trim().min(3).max(500),
});

export type AllocateAssetInput = z.infer<typeof allocateAssetSchema>;

/** Allocate an available asset to an employee and open a custody row. */
export async function allocateAsset(
  access: Access,
  id: string,
  input: AllocateAssetInput,
  requestId: string,
): Promise<{ id: string; from: AssetRegisterState; to: "allocated" }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const asset = await loadAsset(access, id);
  await requireEmployee(access, input.employeeId);
  if (asset.status === "allocated") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "This asset is already allocated. Record its return first.",
    });
  }
  await requireIssuedOnOrAfterJoining(access, input.employeeId, input.issuedOn);
  if (input.expectedReturn && input.expectedReturn < input.issuedOn) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The expected return date cannot precede the issue date." });
  }
  const assignmentId = randomUUID();
  const before = { status: asset.status, holder_code: asset.holder_code };
  const after = {
    status: "allocated",
    employee_id: input.employeeId,
    issued_on: input.issuedOn,
    condition_at_issue: input.conditionAtIssue,
    acknowledged_by_employee: input.acknowledgedByEmployee,
    expected_return: input.expectedReturn ?? null,
  };
  await tenantTx(access, [
    sqlClient`insert into asset_assignments (id, tenant_id, asset_id, employee_id, attributes)
      values (${assignmentId}, ${access.tenantId}, ${id}, ${input.employeeId},
        ${JSON.stringify({
          status: "Allocated",
          issued_on: input.issuedOn,
          condition_at_issue: input.conditionAtIssue,
          acknowledged_by_employee: input.acknowledgedByEmployee,
          expected_return: input.expectedReturn ?? null,
        })}::jsonb)`,
    sqlClient`update asset_catalog
      set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({ status: "Allocated" })}::jsonb,
        updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${ALLOCATE_ACTION}, 'asset', ${id}, ${input.reason},
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: asset.status, to: "allocated" };
}

/**
 * The condition asked for at return is not the condition asked for at issue: the workbook
 * keeps PL_ASSET_CONDITION (New / Good / Fair) and PL_ASSET_RETURN_CONDITION
 * (Good / Damaged / Lost / Not returned) apart, because they are different questions.
 *
 * A damaged or lost asset raises a recovery line on full and final, so the workbook makes
 * both the amount and the remarks mandatory in exactly that case. `reason` carries the
 * remarks - the audited reason for the return is what the workbook calls return_remarks.
 */
export const RECOVERABLE_RETURN_CONDITIONS = ["damaged", "lost"] as const;
export const RETURN_REMARKS_MIN_LENGTH = 10;

export const returnAssetSchema = z.object({
  condition: z.enum(picklistValues("PL_ASSET_RETURN_CONDITION")),
  returnedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recoveryAmountMinor: z.number().int().min(0).max(1_000_000_000_000).optional(),
  reason: z.string().trim().min(3).max(500),
}).superRefine((input, ctx) => {
  if (!(RECOVERABLE_RETURN_CONDITIONS as readonly string[]).includes(input.condition)) return;
  if (input.recoveryAmountMinor === undefined) {
    ctx.addIssue({ code: "custom", path: ["recoveryAmountMinor"], message: "A damaged or lost asset needs a recovery amount; enter 0 if nothing is recovered." });
  }
  if (input.reason.trim().length < RETURN_REMARKS_MIN_LENGTH) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: `Remarks on a damaged or lost asset must be at least ${RETURN_REMARKS_MIN_LENGTH} characters.` });
  }
});

export type ReturnAssetInput = z.infer<typeof returnAssetSchema>;

export async function returnAsset(
  access: Access,
  id: string,
  inputOrRequestId: ReturnAssetInput | string,
  requestIdArg?: string,
): Promise<{ id: string; from?: AssetRegisterState; to: "returned"; status?: "returned" }> {
  const isDirect = typeof inputOrRequestId === "string";
  const requestId = isDirect ? inputOrRequestId : (requestIdArg ?? "");
  const input: ReturnAssetInput = isDirect
    ? { condition: "good", returnedOn: new Date().toISOString().slice(0, 10), reason: "Returned asset in good condition" }
    : inputOrRequestId;
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const asset = await loadAsset(access, id);
  if (asset.status !== "allocated") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "This asset is not currently allocated.",
    });
  }
  if (asset.issued_on && input.returnedOn < asset.issued_on) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: `This asset cannot be returned before it was issued (${asset.issued_on}).` });
  }
  const before = { status: asset.status, holder_code: asset.holder_code };
  const after = {
    status: "returned",
    condition: input.condition,
    returned_on: input.returnedOn,
    recovery_amount_minor: input.recoveryAmountMinor ?? null,
  };
  await tenantTx(access, [
    sqlClient`update asset_assignments
      set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
        status: "Returned",
        returned_on: input.returnedOn,
        condition_at_return: input.condition,
        recovery_amount_minor: input.recoveryAmountMinor ?? null,
        return_remarks: input.reason,
      })}::jsonb,
        updated_at = now()
      where tenant_id = ${access.tenantId} and asset_id = ${id} and attributes->>'returned_on' is null`,
    sqlClient`update asset_catalog
      set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({ status: "Returned", condition: input.condition })}::jsonb,
        updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${RETURN_ACTION}, 'asset', ${id}, ${input.reason},
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: asset.status, to: "returned" };
}


export const createAssetSchema = z.object({
  assetCode: z.string().trim().min(1).max(30),
  assetType: z.enum(["laptop", "phone", "id_card", "access_card", "locker", "sim", "tablet", "monitor", "headset", "other"]),
  brand: z.string().trim().max(50).optional(),
  model: z.string().trim().max(80).optional(),
  serialNumber: z.string().trim().max(50).optional(),
  attributes: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function createAsset(access: Access, input: z.infer<typeof createAssetSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [existing] = await tenantTx(access, [
    sqlClient`select id from hardware_assets where tenant_id = ${access.tenantId} and asset_code = ${input.assetCode} limit 1`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "An asset with this code already exists." });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into hardware_assets (id, tenant_id, asset_code, asset_type, brand, model, serial_number, status, attributes)
      values (${id}, ${access.tenantId}, ${input.assetCode}, ${input.assetType},
        ${input.brand ?? null}, ${input.model ?? null}, ${input.serialNumber ?? null},
        'available', ${JSON.stringify(input.attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'asset.create', 'hardware_asset', ${id},
        'Asset registered',
        ${JSON.stringify({ assetCode: input.assetCode, assetType: input.assetType })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, assetCode: input.assetCode, assetType: input.assetType, status: "available" };
}

export async function listAssets(access: Access, args: { assetType?: string | null; status?: string | null; employeeId?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from hardware_assets
      where tenant_id = ${access.tenantId}
        and (${args.assetType ?? null}::text is null or asset_type = ${args.assetType ?? null}::text)
        and (${args.status ?? null}::text is null or status = ${args.status ?? null}::text)
        and (${args.employeeId ?? null}::uuid is null or assigned_to = ${args.employeeId ?? null}::uuid)
    `,
    sqlClient`
      select a.id, a.asset_code, a.asset_type, a.brand, a.model, a.serial_number, a.status,
             a.assigned_to, a.assigned_at, a.returned_at, a.attributes, a.created_at,
             e.first_name, e.last_name, e.employee_code
      from hardware_assets a
      left join employees e on e.id = a.assigned_to and e.tenant_id = a.tenant_id
      where a.tenant_id = ${access.tenantId}
        and (${args.assetType ?? null}::text is null or a.asset_type = ${args.assetType ?? null}::text)
        and (${args.status ?? null}::text is null or a.status = ${args.status ?? null}::text)
        and (${args.employeeId ?? null}::uuid is null or a.assigned_to = ${args.employeeId ?? null}::uuid)
      order by a.asset_code asc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const total = ((countRows as Array<{ total: number }>)[0]?.total ?? 0);
  return { items: rows, total };
}
