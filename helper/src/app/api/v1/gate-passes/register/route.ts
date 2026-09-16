import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listGatePassRegister } from "@/server/attendance/gate-pass-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listGatePassRegister(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "gate-pass",
      // The envelope owns `type`, so the pass's own kind travels as `pass_type`.
      items: rows.map(({ type, ...row }) => ({ ...row, pass_type: type, version: 1 })),
      requestId,
      self: "/api/v1/gate-passes/register",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
