import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { celebrationsQuerySchema, listCelebrations } from "@/server/onboarding/celebrations";

export const dynamic = "force-dynamic";

/** GET upcoming birthdays, work anniversaries and new joiners (employee.read; birthdays also employee.birthdate.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const days = new URL(request.url).searchParams.get("days");
    const parsed = celebrationsQuerySchema.safeParse(days === null || days === "" ? {} : { days });
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The window must be between 1 and 60 days.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await listCelebrations(access, parsed.data);
    return ok({ type: "celebrations", id: "celebrations", version: 1, attributes: result, requestId, self: "/api/v1/onboarding/celebrations" });
  } catch (error) {
    return fail(error, requestId);
  }
}
