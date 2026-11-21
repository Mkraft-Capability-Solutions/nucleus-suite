import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { databaseConfigured, sqlClient } from "@/lib/db";
import { DEFAULT_CONSOLE, personaForRoles } from "@/lib/personas";
import { readRuntimeConfiguration } from "@/lib/runtime-config";
import { ACTIVE_TENANT_COOKIE } from "@/server/identity/active-tenant";
import { isPlatformAdminEmail } from "@/server/platform-admin/access";

export const dynamic = "force-dynamic";

type MembershipRow = {
  membership_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  employee_id: string | null;
  employee_code: string | null;
  designation: string | null;
  department: string | null;
  role_codes: string[] | null;
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * Password sign-in for the workspace.
 *
 * Creates a real Better Auth session (httpOnly cookie), picks the active organisation (the one in
 * the active-tenant cookie if the user belongs to it, otherwise their first membership) and returns
 * the profile the workspace UI needs. The persona comes from the member's roles in that
 * organisation, never from the email address.
 */
export async function POST(request: Request) {
  if (process.env.DEMO_AUTH_ENABLED === "false") {
    return json({ error: "Sign-in is disabled." }, 403);
  }
  const trustedOrigins = [
    new URL(request.url).origin,
    readRuntimeConfiguration().appUrl,
    ...(process.env.ADDITIONAL_TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()) ?? []),
  ];
  const origin = request.headers.get("origin");
  if (origin && !trustedOrigins.includes(origin)) {
    return json({ error: "Cross-origin sign-in is not allowed." }, 403);
  }
  const raw = await request.text();
  if (raw.length > 4096) return json({ error: "Payload too large." }, 413);
  let body: { email?: unknown; password?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON request." }, 400);
  }
  if (typeof body?.email !== "string" || typeof body?.password !== "string" || body.password.length > 128 || body.email.length > 254) {
    return json({ error: "Email and password are required." }, 400);
  }
  if (!databaseConfigured) return json({ error: "Database service unavailable." }, 503);

  const email = body.email.trim().toLowerCase();
  let signIn: { headers: Headers; response: { user: { id: string; name: string; email: string; image?: string | null } } };
  try {
    signIn = (await auth.api.signInEmail({
      body: { email, password: body.password, rememberMe: true },
      headers: request.headers,
      returnHeaders: true,
    })) as typeof signIn;
  } catch {
    return json({ error: "Invalid credentials." }, 401);
  }
  const user = signIn.response.user;

  try {
    // Memberships are visible to their own user; roles and employee details only inside the tenant.
    const [, statusRows, membershipRows] = (await sqlClient.transaction([
      sqlClient`select set_config('app.user_id', ${user.id}, true)`,
      sqlClient`select status from "user" where id = ${user.id}`,
      sqlClient`
        select m.id as membership_id, t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug, m.employee_id
        from memberships m
        join tenants t on t.id = m.tenant_id and t.status = 'active'
        where m.user_id = ${user.id} and m.status = 'active'
        order by t.name asc
      `,
    ])) as [unknown, Array<{ status: string | null }>, MembershipRow[]];

    const status = statusRows[0]?.status ?? "active";
    const platformAdmin = isPlatformAdminEmail(user.email);
    if (status !== "active" || (membershipRows.length === 0 && !platformAdmin)) {
      await auth.api.signOut({ headers: sessionHeaders(signIn.headers) }).catch(() => undefined);
      return json({ error: status !== "active" ? "This account is not active." : "This account is not a member of any active organisation." }, 403);
    }

    const cookieTenant = readCookie(request.headers.get("cookie"), ACTIVE_TENANT_COOKIE);
    let membership = membershipRows.find((row) => row.tenant_id === cookieTenant) ?? membershipRows[0] ?? null;
    if (membership) {
      const [, , , detailRows] = (await sqlClient.transaction([
        sqlClient`select set_config('app.user_id', ${user.id}, true)`,
        sqlClient`select set_config('app.tenant_id', ${membership.tenant_id}, true)`,
        sqlClient`select set_config('app.membership_id', ${membership.membership_id}, true)`,
        sqlClient`
          select e.employee_code, e.designation, e.department,
            coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') as role_codes
          from memberships m
          left join employees e on e.id = m.employee_id and e.tenant_id = m.tenant_id
          left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
            and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
          left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
          where m.id = ${membership.membership_id}
          group by m.id, e.id
        `,
      ])) as [unknown, unknown, unknown, Array<Partial<MembershipRow>>];
      membership = { ...membership, ...(detailRows[0] ?? {}) };
    }
    const persona = personaForRoles(membership?.role_codes ?? [], { platformAdmin });

    const response = json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: persona,
        roleCodes: membership?.role_codes ?? [],
        platformAdmin,
        employeeId: membership?.employee_code || membership?.employee_id || null,
        designation: membership?.designation || null,
        dept: membership?.department || null,
        tenantId: membership?.tenant_id ?? null,
        tenantName: membership?.tenant_name ?? null,
        tenantSlug: membership?.tenant_slug ?? null,
        defaultConsole: DEFAULT_CONSOLE[persona],
        avatar: user.image || "/images/favicon_io/android-chrome-192x192.png",
      },
    });
    for (const cookie of signIn.headers.getSetCookie?.() ?? []) response.headers.append("set-cookie", cookie);
    if (membership) {
      response.cookies.set(ACTIVE_TENANT_COOKIE, membership.tenant_id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
    }
    // UI hint only (the workspace restores its cached profile when present). Never an identity.
    response.cookies.set("nucleus_session", "1", { path: "/", httpOnly: false, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 });
    return response;
  } catch (error) {
    console.error("Sign-in profile lookup failed:", (error as { code?: string })?.code ?? "UNKNOWN");
    return json({ error: "Database service unavailable." }, 503);
  }
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Request headers carrying the just-issued session cookie, to revoke it. */
function sessionHeaders(responseHeaders: Headers) {
  const cookies = (responseHeaders.getSetCookie?.() ?? []).map((cookie) => cookie.split(";")[0]).join("; ");
  return new Headers({ cookie: cookies });
}
