import "server-only";

import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";

/**
 * For route handlers that do not otherwise use the tenant context: checks the session, the active
 * organisation membership and the organisation's plan for this path. Returns the error response to
 * send, or null when the caller may proceed.
 */
export async function denyWithoutAccess(request: Request): Promise<Response | null> {
  try {
    await requireAccess(request);
    return null;
  } catch (error) {
    return fail(error, requestIdFrom(request.headers));
  }
}
