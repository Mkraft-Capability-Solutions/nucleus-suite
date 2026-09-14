import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listSanctionedStrength } from "@/server/organization/sanctioned-strength";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listSanctionedStrength(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "sanctioned-strength",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/organization/sanctioned-strength",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
