import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listClearanceBoard } from "@/server/lifecycle/clearance-board";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listClearanceBoard(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "clearance-board",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/offboarding/clearance-board",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
