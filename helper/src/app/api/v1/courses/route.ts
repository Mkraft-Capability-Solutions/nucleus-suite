import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createCourse, createCourseSchema, listCourses } from "@/server/learning/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const courses = await listCourses(access);
    return NextResponse.json({ data: courses, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createCourseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The course payload is invalid." });
    const result = await createCourse(access, parsed.data);
    return ok({ type: "course", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/courses` });
  } catch (error) {
    return fail(error, requestId);
  }
}
