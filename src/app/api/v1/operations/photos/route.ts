import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, requireAccess, tenantTx, type Access } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/**
 * Employee profile photos, tenant scoped.
 * GET  ?employeeId=<uuid|code>  — the caller's own photo when omitted; another employee's needs employee.read.
 * POST { photoDataUrl | photoUrl, employeeId? } — own photo, or another employee's with employee.write.
 * Accepted images: PNG, JPEG or WebP data URLs up to 512 KB, or an https URL.
 */

const MAX_DATA_URL_BYTES = 512 * 1024;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const postSchema = z.object({
  employeeId: z.string().trim().min(1).max(64).optional(),
  photoDataUrl: z.string().max(MAX_DATA_URL_BYTES * 1.4).regex(DATA_URL, "Use a PNG, JPEG or WebP image.").optional(),
  photoUrl: z.string().url().startsWith("https://", "Photo links must use https.").max(2048).optional(),
}).refine((v) => Boolean(v.photoDataUrl || v.photoUrl), { message: "Choose a photo to upload." });

type PhotoRow = { id: string; employeeCode: string | null; firstName: string | null; lastName: string | null; photo: string | null };

async function findEmployee(access: Access, ref: string): Promise<PhotoRow | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_code as "employeeCode", first_name as "firstName", last_name as "lastName",
             coalesce(metadata->>'photo', metadata->>'avatar') as photo
      from employees
      where tenant_id = ${access.tenantId} and (id::text = ${ref} or employee_code = ${ref})
      limit 1
    `,
  ]);
  return (rows as PhotoRow[])[0] ?? null;
}

function targetFor(access: Access, requested: string | undefined, permission: "employee.read" | "employee.write"): string {
  const own = access.context.employeeId ?? null;
  if (!requested || requested === own) {
    if (!own) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Your account has no employee record." });
    return own;
  }
  enforce(access.context, permission, { tenantId: access.tenantId });
  return requested;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const ref = targetFor(access, new URL(request.url).searchParams.get("employeeId")?.trim() || undefined, "employee.read");
    const employee = await findEmployee(access, ref);
    if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
    return ok({ type: "employee-photo", id: employee.id, version: 1, attributes: employee, requestId, self: "/api/v1/operations/photos" });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The photo is not valid." });
    }
    const photo = parsed.data.photoDataUrl ?? parsed.data.photoUrl ?? "";
    const employee = await findEmployee(access, targetFor(access, parsed.data.employeeId, "employee.write"));
    if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

    await tenantTx(access, [
      sqlClient`
        update employees
        set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{photo}', to_jsonb(${photo}::text), true), updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${employee.id}
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'employee.photo_updated', 'employee',
                ${employee.id}, 'Profile photo changed', '{}'::jsonb, '{}'::jsonb, ${requestId})
      `,
    ]);
    if (employee.id === access.context.employeeId) {
      await sqlClient`update "user" set image = ${photo}, updated_at = now() where id = ${access.context.actorUserId}`;
    }
    return ok({
      type: "employee-photo", id: employee.id, version: 1,
      attributes: { employeeId: employee.id, photoUrl: photo, updatedAt: new Date().toISOString() },
      requestId, self: "/api/v1/operations/photos",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
