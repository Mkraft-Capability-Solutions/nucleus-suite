import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { enforce, requireAccess, tenantTx } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const MAX_PHOTO_LENGTH = 2_000_000; // data URL characters (~1.5 MB image)

/**
 * Profile photos, inside the active organisation only. GET reads the caller's own employee photo,
 * or another employee's with employee.read; POST changes only the caller's own photo.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const employeeId = new URL(request.url).searchParams.get("employeeId")?.trim() || access.context.employeeId || null;
    if (!employeeId) return NextResponse.json({ success: true, data: null, requestId });
    if (employeeId !== access.context.employeeId) enforce(access.context, "employee.read", { tenantId: access.tenantId });
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, employee_code as "employeeCode", first_name as "firstName", last_name as "lastName",
               metadata->>'photo' as "photo", metadata->>'avatar' as "avatar"
        from employees
        where tenant_id = ${access.tenantId} and (id::text = ${employeeId} or employee_code = ${employeeId})
        limit 1
      `,
    ]);
    return NextResponse.json({ success: true, data: (rows as unknown[])[0] ?? null, requestId });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const body = (await request.json().catch(() => ({}))) as { photoDataUrl?: unknown; photo?: unknown; photoName?: unknown };
    const candidate = typeof body.photoDataUrl === "string" ? body.photoDataUrl : typeof body.photo === "string" ? body.photo : "";
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(candidate) && !/^https:\/\//i.test(candidate)) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Send the photo as an image data URL or an https URL." });
    }
    if (candidate.length > MAX_PHOTO_LENGTH) {
      throw new HttpError({ status: 413, code: "PAYLOAD_TOO_LARGE", message: "The photo is too large." });
    }
    await tenantTx(access, [
      ...(access.context.employeeId
        ? [sqlClient`
            update employees
            set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{photo}', to_jsonb(${candidate}::text), true), updated_at = now()
            where tenant_id = ${access.tenantId} and id = ${access.context.employeeId}
          `]
        : []),
      sqlClient`update "user" set image = ${candidate}, updated_at = now() where id = ${access.context.actorUserId}`,
    ]);
    return NextResponse.json({
      success: true,
      message: "Profile photo saved.",
      data: { photo: typeof body.photoName === "string" ? body.photoName : "photo", photoUrl: candidate, updatedAt: new Date().toISOString() },
      requestId,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
