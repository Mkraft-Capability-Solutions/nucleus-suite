import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import { ACTIVE_TENANT_COOKIE } from "@/server/identity/active-tenant";

export const dynamic = "force-dynamic";

/** Revokes the Better Auth session and clears the workspace cookies. */
export async function POST(request: Request) {
  if (databaseConfigured) await auth.api.signOut({ headers: request.headers }).catch(() => undefined);
  const res = NextResponse.json({ success: true, message: "Logged out successfully" }, { headers: { "Cache-Control": "private, no-store" } });
  for (const name of ["nucleus_session", "nucleus_token", ACTIVE_TENANT_COOKIE, "mkraft.session_token", "mkraft.session_data", "__Secure-mkraft.session_token", "__Secure-mkraft.session_data"]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}
