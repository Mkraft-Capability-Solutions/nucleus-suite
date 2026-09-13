import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, parsePagination, requestIdFrom } from "@/server/platform/http";
import { listDays } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  employeeId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({ employeeId: params.get("employeeId"), from: params.get("from"), to: params.get("to") });
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "employeeId, from and to (YYYY-MM-DD) are required." });
    const { page, pageSize } = parsePagination(params);
    const { items, total } = await listDays(access, { ...parsed.data, page, pageSize });
    return collection({
      type: "attendance-day",
      items: (items as Array<Record<string, unknown>>).map((item) => {
        const { id, ...rest } = item as { id: string } & Record<string, unknown>;
        return { id, version: 1, ...rest };
      }),
      requestId,
      self: `/api/v1/attendance/days?employeeId=${parsed.data.employeeId}`,
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
