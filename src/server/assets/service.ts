import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

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

  // Check for duplicate asset code
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

export const allocateAssetSchema = z.object({
  employeeId: z.string().uuid(),
});

export async function allocateAsset(access: Access, id: string, input: z.infer<typeof allocateAssetSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const [assetRows] = await tenantTx(access, [
    sqlClient`select id, asset_code, asset_type, status from hardware_assets where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const asset = (assetRows as Array<{ id: string; asset_code: string; asset_type: string; status: string }>)[0];
  if (!asset) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Asset not found." });
  if (asset.status !== "available") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Asset is currently '${asset.status}' and cannot be allocated.` });
  }

  // Verify employee exists
  const [empRows] = await tenantTx(access, [
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${input.employeeId} and status = 'active' limit 1`,
  ]);
  if ((empRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Active employee not found." });
  }

  await tenantTx(access, [
    sqlClient`
      update hardware_assets
      set assigned_to = ${input.employeeId}, assigned_at = now(), status = 'assigned', updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'asset.allocate', 'hardware_asset', ${id},
        'Asset allocated to employee',
        ${JSON.stringify({ assetCode: asset.asset_code, employeeId: input.employeeId })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, status: "assigned", assignedTo: input.employeeId };
}

export async function returnAsset(access: Access, id: string, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const [rows] = await tenantTx(access, [
    sqlClient`select id, asset_code, status, assigned_to from hardware_assets where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const asset = (rows as Array<{ id: string; asset_code: string; status: string; assigned_to: string | null }>)[0];
  if (!asset) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Asset not found." });
  if (asset.status !== "assigned") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Asset is not currently assigned." });
  }

  await tenantTx(access, [
    sqlClient`
      update hardware_assets
      set assigned_to = null, returned_at = now(), status = 'returned', updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'asset.return', 'hardware_asset', ${id},
        'Asset returned',
        ${JSON.stringify({ assetCode: asset.asset_code, returnedFrom: asset.assigned_to })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, status: "returned" };
}
