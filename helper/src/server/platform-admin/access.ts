import "server-only";

import { auth } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import { HttpError } from "@/server/platform/http";

function configuredAdmins() {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  return Boolean(email && configuredAdmins().has(email.trim().toLowerCase()));
}

export type PlatformAdmin = { userId: string; email: string; name: string };

/** Platform administration is deliberately separate from tenant role permissions. */
export async function requirePlatformAdmin(request: Request): Promise<PlatformAdmin> {
  if (!databaseConfigured) {
    throw new HttpError({ status: 503, code: "SERVICE_UNAVAILABLE", message: "Identity storage is not configured." });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    throw new HttpError({ status: 401, code: "UNAUTHORIZED", message: "Authentication required." });
  }
  if (!isPlatformAdminEmail(session.user.email)) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Platform administrator access is required." });
  }
  return { userId: session.user.id, email: session.user.email, name: session.user.name };
}
