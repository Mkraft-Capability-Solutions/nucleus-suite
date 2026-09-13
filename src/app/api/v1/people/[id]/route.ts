import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getEmployee } from "@/server/organization/service";

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
      },
      requestId,
      self: `/api/v1/people/${item.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
