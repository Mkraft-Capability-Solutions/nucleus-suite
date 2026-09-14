import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { historyRange, listTeamHistory } from "@/server/attendance/team-history-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const search = new URL(request.url).searchParams;
    const range = historyRange(search.get("from"), search.get("to"));
    const rows = await listTeamHistory(access, { from: range.from, to: range.to, search: search.get("search") ?? "" });
    return collection({
      type: "team-history",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: `/api/v1/reports/team-history/register?from=${range.from}&to=${range.to}`,
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
