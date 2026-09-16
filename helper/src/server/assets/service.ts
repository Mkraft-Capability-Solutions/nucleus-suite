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

/**
 * Is this custody row still open — the asset still out with its holder?
 *
 * One definition, because the two writers spell the same fact differently: the Asset
 * Register writes `"Allocated"` and the operational asset workflow writes `allocated`,
 * so an asset issued from the register and returned through the workflow used to leave
 * its custody row open for ever. Compared in lower case, exactly as
 * `clearanceBlockingSql` does for the same reason, rather than adding a second literal.
 */
export function isCustodyOpen(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "allocated";
}

/**
 * The SQL twin of `isCustodyOpen`, for the hand-written statements that cannot hold a
 * row. `alias` is the `asset_assignments` alias in the surrounding statement.
 */
export function openCustodySql(alias: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error(`Unsafe SQL alias "${alias}".`);
  return `lower(trim(coalesce(${alias}.attributes->>'status', ''))) = 'allocated'`;
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

/**
 * The asset catalogue is written from two screens that spell the same facts differently:
 * the Asset Register uses `asset_code` / `type` / `serial`, the operational asset workflow
 * uses `assetTag` / `category` / `serialNumber`. Both are read here so one register shows
 * every asset the tenant holds, however it was created.
 */
const ASSET_PROJECTION = `ac.id,
  coalesce(ac.attributes->>'asset_code', ac.attributes->>'assetTag', ac.id::text) as asset_code,
  coalesce(ac.attributes->>'type', ac.attributes->>'category', 'Unclassified') as asset_type,
  coalesce(ac.attributes->>'description', ac.attributes->>'name', '') as description,
  coalesce(ac.attributes->>'serial', ac.attributes->>'serialNumber', '') as serial,
  (ac.attributes->>'recoveryAmountMinor')::bigint as catalog_recovery_minor,
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
  catalog_recovery_minor: number | string | null;
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
         and coalesce(ac.attributes->>'type', ac.attributes->>'category') is not null
         and (coalesce(ac.attributes->>'asset_code', ac.attributes->>'assetTag', '') || ' '
           || coalesce(ac.attributes->>'type', ac.attributes->>'category', '') || ' '
           || coalesce(ac.attributes->>'description', ac.attributes->>'name', '') || ' '
           || coalesce(ac.attributes->>'serial', ac.attributes->>'serialNumber', '') || ' '
           || coalesce(holder.employee_code, '') || ' ' || coalesce(holder.first_name, '') || ' '
           || coalesce(holder.last_name, '')) ilike $2
       order by coalesce(ac.attributes->>'asset_code', ac.attributes->>'assetTag', ac.id::text) asc limit 100`,
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

/**
 * R-24. Full and final reads custody from the operational asset register
 * (`hrms_operation_records` with resource 'assets'), and the settlement gate refuses to
 * finalise while a row there is still `allocated`. An asset issued from this screen wrote
 * only `asset_assignments`, so it was invisible at settlement and blocked nothing.
 *
 * This mirrors the custody change into that register under the SAME id the catalogue uses —
 * which is the id the operational workflow already writes — so the two registers describe
 * one asset rather than two. The recovery value travels with it, because that is the figure
 * full and final prices an unreturned asset at.
 */
function mirrorCustody(
  access: Access,
  args: {
    assetId: string;
    assetCode: string;
    assetType: string;
    serial: string;
    employeeId: string | null;
    status: "allocated" | "returned";
    recoveryMinor: number | null;
    extra: Record<string, unknown>;
  },
) {
  const data = {
    assetTag: args.assetCode,
    category: args.assetType,
    serialNumber: args.serial,
    source: "asset-register",
    ...(args.recoveryMinor === null ? {} : { recoveryAmountMinor: args.recoveryMinor }),
    ...args.extra,
  };
  return sqlClient`
    insert into hrms_operation_records (id, tenant_id, resource, employee_id, status, data, created_by_membership_id)
    values (${args.assetId}, ${access.tenantId}, 'assets', ${args.employeeId}, ${args.status},
      ${JSON.stringify(data)}::jsonb, ${access.context.membershipId})
    on conflict (id) do update
      set employee_id = coalesce(excluded.employee_id, hrms_operation_records.employee_id),
          status = excluded.status,
          data = hrms_operation_records.data || excluded.data,
          version = hrms_operation_records.version + 1,
          updated_at = now()
    where hrms_operation_records.tenant_id = excluded.tenant_id
  `;
}

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
  /**
   * What the asset would be recovered at if it never came back (R-24). It defaults to the
   * value already on the catalogue record; where neither states one the asset is issued
   * unpriced, and full and final reports it as unpriced rather than as nil.
   */
  recoveryAmountMinor: z.number().int().min(0).max(1_000_000_000_000).optional(),
  reason: z.string().trim().min(3).max(500),
});

export type AllocateAssetInput = z.infer<typeof allocateAssetSchema>;

/** Allocate an available asset to an employee and open a custody row. */
export async function allocateAsset(
  access: Access,
  id: string,
  input: AllocateAssetInput,
  requestId: string,
): Promise<{ id: string; from: AssetRegisterState; to: "allocated"; recoveryAmountMinor: number | null }> {
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
  const catalogRecovery = asset.catalog_recovery_minor === null || asset.catalog_recovery_minor === undefined
    ? null
    : Number(asset.catalog_recovery_minor);
  const recoveryMinor = input.recoveryAmountMinor ?? catalogRecovery;
  const before = { status: asset.status, holder_code: asset.holder_code };
  const after = {
    status: "allocated",
    employee_id: input.employeeId,
    issued_on: input.issuedOn,
    condition_at_issue: input.conditionAtIssue,
    acknowledged_by_employee: input.acknowledgedByEmployee,
    expected_return: input.expectedReturn ?? null,
    recovery_amount_minor: recoveryMinor,
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
      set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
        status: "Allocated",
        ...(recoveryMinor === null ? {} : { recoveryAmountMinor: recoveryMinor }),
      })}::jsonb,
        updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    mirrorCustody(access, {
      assetId: id,
      assetCode: asset.asset_code,
      assetType: asset.asset_type,
      serial: asset.serial,
      employeeId: input.employeeId,
      status: "allocated",
      recoveryMinor,
      extra: { issuedOn: input.issuedOn, conditionAtIssue: input.conditionAtIssue },
    }),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${ALLOCATE_ACTION}, 'asset', ${id}, ${input.reason},
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: asset.status, to: "allocated", recoveryAmountMinor: recoveryMinor };
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

/** Close the open custody row and return an allocated asset to the pool. */
export async function returnAsset(
  access: Access,
  id: string,
  input: ReturnAssetInput,
  requestId: string,
): Promise<{ id: string; from: AssetRegisterState; to: "returned" }> {
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
    // The settlement gate keys on this row's status, so the return has to clear it here too.
    mirrorCustody(access, {
      assetId: id,
      assetCode: asset.asset_code,
      assetType: asset.asset_type,
      serial: asset.serial,
      employeeId: null,
      status: "returned",
      recoveryMinor: input.recoveryAmountMinor ?? null,
      extra: { returnedOn: input.returnedOn, condition: input.condition },
    }),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${RETURN_ACTION}, 'asset', ${id}, ${input.reason},
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: asset.status, to: "returned" };
}
