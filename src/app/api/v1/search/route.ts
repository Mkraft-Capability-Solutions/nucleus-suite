import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { listEmployees } from "@/server/organization/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    if (query.length < 2) {
      return Response.json({ data: [], meta: { requestId, query } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }
    const employees = await listEmployees(access, { search: query, page: 1, pageSize: 8 });
    return Response.json({
      data: employees.items.map((employee) => ({
        id: employee.id,
        type: "employee",
        title: `${employee.first_name} ${employee.last_name}`.trim(),
        subtitle: [employee.employee_code, employee.designation, employee.department].filter(Boolean).join(" · "),
        href: `/people?employee=${encodeURIComponent(employee.id)}`,
      })),
      meta: { requestId, query, total: employees.total },
    }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

