import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { personaForRoles } from "@/lib/personas";
import { requireAccess, tenantTx, type Access } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

type ProfileRow = {
  user_id: string;
  name: string;
  email: string;
  image: string | null;
  employee_id: string | null;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  designation: string | null;
  department: string | null;
  location: string | null;
  photo: string | null;
  phone: string | null;
};

/**
 * The signed-in user's own profile in the active organisation. There is no way to read or change
 * anyone else's profile here: the user comes from the session, the employee record from the
 * user's membership (or their work email) inside the active tenant.
 */
async function loadOwnProfile(access: Access): Promise<ProfileRow | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select u.id as user_id, u.name, u.email, u.image,
        e.id as employee_id, e.employee_code, e.first_name, e.last_name, e.designation, e.department, e.location,
        coalesce(e.metadata->>'photo', e.metadata->>'avatar') as photo, e.metadata->>'phone' as phone
      from "user" u
      join memberships m on m.user_id = u.id and m.id = ${access.context.membershipId} and m.tenant_id = ${access.tenantId}
      left join lateral (
        select * from employees e
        where e.tenant_id = ${access.tenantId}
          and (e.id = m.employee_id or (m.employee_id is null and lower(e.work_email) = lower(u.email)))
        order by (e.id = m.employee_id) desc nulls last, e.updated_at desc
        limit 1
      ) e on true
      where u.id = ${access.context.actorUserId}
    `,
  ]);
  return (rows as ProfileRow[])[0] ?? null;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const profile = await loadOwnProfile(access);
    if (!profile) return NextResponse.json({ success: false, message: "Profile not found.", requestId }, { status: 404 });
    const name = profile.name || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    const parts = name.split(/\s+/);
    const photoUrl = profile.photo || profile.image || "/images/favicon_io/android-chrome-192x192.png";
    return NextResponse.json(
      {
        success: true,
        data: {
          id: profile.user_id,
          employeeId: profile.employee_id,
          employeeCode: profile.employee_code,
          name,
          firstName: profile.first_name || parts[0] || "",
          lastName: profile.last_name || parts.slice(1).join(" "),
          email: profile.email,
          phone: profile.phone,
          jobTitle: profile.designation,
          dept: profile.department,
          location: profile.location,
          photo: photoUrl,
          photoUrl,
          role: personaForRoles(access.context.roles),
        },
        requestId,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

const text = (value: unknown, max = 160) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined);

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fullName = text(body.name, 120);
    const [firstName, ...rest] = fullName ? fullName.split(/\s+/) : [];
    const lastName = rest.join(" ");
    const phone = text(body.phone, 40);
    const jobTitle = text(body.jobTitle);
    const dept = text(body.dept);
    const location = text(body.location);
    const profile = await loadOwnProfile(access);
    if (!profile) return NextResponse.json({ success: false, message: "Profile not found.", requestId }, { status: 404 });

    await tenantTx(access, [
      ...(fullName ? [sqlClient`update "user" set name = ${fullName}, updated_at = now() where id = ${access.context.actorUserId}`] : []),
      ...(profile.employee_id
        ? [
            sqlClient`
              update employees
              set first_name = coalesce(${firstName ?? null}, first_name),
                  last_name = coalesce(${fullName ? lastName || "-" : null}, last_name),
                  designation = coalesce(${jobTitle ?? null}, designation),
                  department = coalesce(${dept ?? null}, department),
                  location = coalesce(${location ?? null}, location),
                  metadata = coalesce(metadata, '{}'::jsonb)
                    || jsonb_strip_nulls(jsonb_build_object('name', ${fullName ?? null}::text, 'phone', ${phone ?? null}::text, 'jobTitle', ${jobTitle ?? null}::text)),
                  updated_at = now()
              where id = ${profile.employee_id} and tenant_id = ${access.tenantId}
            `,
          ]
        : []),
    ]);

    return NextResponse.json({
      success: true,
      message: "Profile updated.",
      data: { name: fullName ?? profile.name, firstName, lastName, email: profile.email, phone, jobTitle, dept, location, updatedAt: new Date().toISOString() },
      requestId,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}
