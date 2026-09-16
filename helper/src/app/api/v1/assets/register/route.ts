import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listAssetRegister } from "@/server/assets/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listAssetRegister(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "asset",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/assets/register",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
