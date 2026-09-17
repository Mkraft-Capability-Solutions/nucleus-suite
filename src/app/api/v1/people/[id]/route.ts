import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { getEmployee, updatePerson, updatePersonSchema } from "@/server/organization/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const item = await getEmployee(access, id);
    return ok({
      type: "employee",
      id: item.id,
      version: item.version,
      attributes: {
        employeeCode: item.employee_code,
        firstName: item.first_name,
        lastName: item.last_name,
        workEmail: item.work_email,
        designation: item.designation,
        department: item.department,
        location: item.location,
        category: item.category,
        status: item.status,
        joiningDate: item.joining_date,
        basicSalary: item.basic_salary_minor === null ? null : { amount: (item.basic_salary_minor / 100).toFixed(2), currency: item.currency },
        salaryMasked: item.salaryMasked,
        metadata: item.metadata || {},
        details: item.metadata || {},
      },
      requestId,
      self: `/api/v1/people/${item.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const rawJson = await request.json().catch(() => null);
    const sanitized = rawJson && typeof rawJson === "object"
      ? Object.fromEntries(
          Object.entries(rawJson).map(([k, v]) => [
            k,
            typeof v === "string" && v.trim() === "" ? undefined : v,
          ])
        )
      : rawJson;
    const parsed = updatePersonSchema.safeParse(sanitized);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The employee update payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const updated = await updatePerson(access, id, parsed.data, requestId);
    return ok({
      type: "employee",
      id: updated.id,
      version: 1,
      attributes: updated,
      requestId,
      self: `/api/v1/people/${updated.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

