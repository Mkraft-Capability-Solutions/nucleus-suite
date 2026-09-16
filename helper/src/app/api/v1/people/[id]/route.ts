import { updateEmployee, updateEmployeeSchema } from "@/server/organization/employee-update";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireVersion } from "@/server/platform/http";
import { getEmployee } from "@/server/organization/service";
import { getEmployeeWorkRules } from "@/server/organization/work-rules";

export const dynamic = "force-dynamic";

/** Age is read-only everywhere in the workbook, so it is computed rather than stored. */
function ageFromDateOfBirth(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const today = new Date();
  const birth = new Date(`${value}T00:00:00Z`);
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const month = today.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const item = await getEmployee(access, id);
    // RL-05/RL-26: the resolved rest-day and wage rules travel with the record, so the
    // employee screen shows what the category actually decides rather than a stored label.
    const workRules = await getEmployeeWorkRules(access, id);
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
        payrollOwner: item.payroll_owner ?? item.location,
        managerEmployeeId: item.manager_employee_id ?? null,
        category: item.category,
        workRules,
        status: item.status,
        joiningDate: item.joining_date,
        basicSalary: item.basic_salary_minor === null ? null : { amount: (item.basic_salary_minor / 100).toFixed(2), currency: item.currency },
        salaryMasked: item.salaryMasked,
        // The identity, family, medical and site blocks of FRM-PPL-01 live on the row's
        // metadata envelope; `ageYears` is derived on read and never stored.
        ...(item.metadata ?? {}),
        ageYears: ageFromDateOfBirth(item.metadata?.dateOfBirth),
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
    const version = requireVersion(request.headers);
    const parsed = updateEmployeeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The employee changes are invalid.", details: parsed.error.issues.map(issue => ({ field: issue.path.join("."), issue: issue.message })) });
    const result = await updateEmployee(access, id, version, parsed.data, requestId);
    return ok({ type: "employee", id, version: result.version, attributes: result, requestId, self: "/api/v1/people/" + id });
  } catch (error) { return fail(error, requestId); }
}
