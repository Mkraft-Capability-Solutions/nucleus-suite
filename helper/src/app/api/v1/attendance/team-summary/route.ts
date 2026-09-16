import { NextResponse } from "next/server";
import { z } from "zod";
import { summarizeAttendanceTeam } from "@/server/attendance/service";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({ from: params.get("from"), to: params.get("to") });
    if (!parsed.success || parsed.data.from > parsed.data.to) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid from/to date range is required." });
    }
    const start = new Date(`${parsed.data.from}T00:00:00Z`);
    const end = new Date(`${parsed.data.to}T00:00:00Z`);
    if ((end.getTime() - start.getTime()) / 86_400_000 > 366) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The attendance range cannot exceed 366 days." });
    }
    const data = await summarizeAttendanceTeam(access, parsed.data);
    return NextResponse.json(
      { data, meta: { requestId }, links: { self: `/api/v1/attendance/team-summary?from=${parsed.data.from}&to=${parsed.data.to}` } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
