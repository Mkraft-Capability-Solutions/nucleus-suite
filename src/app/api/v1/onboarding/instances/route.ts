import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { listOnboardingInstances, startOnboarding, startOnboardingSchema } from "@/server/lifecycle/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listOnboardingInstances(access);
    return collection({
      type: "onboarding-instance",
      items: rows.map((row) => ({
        id: row.id,
        version: 1,
        employeeId: row.employee_id,
        status: row.status,
        createdAt: row.created_at,
        templateName: row.template_name,
        employee: {
          code: row.employee_code,
          firstName: row.first_name,
          lastName: row.last_name,
          department: row.department,
          designation: row.designation,
          joiningDate: row.joining_date,
        },
        tasks: row.tasks,
        total: row.total,
        done: row.done,
        day1Ready: row.tasks.filter((task) => task.required).every((task) => task.status === "done"),
      })),
      requestId,
      self: "/api/v1/onboarding/instances",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = startOnboardingSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The onboarding payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await startOnboarding(access, parsed.data, requestId);
    return ok({ type: "onboarding-instance", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/onboarding/instances/${result.id}/readiness` });
  } catch (error) {
    return fail(error, requestId);
  }
}
