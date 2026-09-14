import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listPositionRegister } from "@/server/organization/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listPositionRegister(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "position",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/organization/positions/register",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
