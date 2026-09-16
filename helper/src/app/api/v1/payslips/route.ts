import { requireAccess } from "@/server/platform/access";
import { collection, fail, parsePagination, requestIdFrom } from "@/server/platform/http";
import { listPayslips } from "@/server/payroll/payslips";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    // RL-350: period and run are independent selectors; one period can hold
    // several runs (regular, arrears, off-cycle, bonus).
    const { items, total } = await listPayslips(access, {
      employeeId: params.get("employeeId"),
      period: params.get("period"),
      runId: params.get("runId"),
      state: params.get("state"),
      page,
      pageSize,
    });
    return collection({
      type: "payslip",
      items: items.map((item) => {
        const { id, version, ...rest } = item;
        return { id, version, ...rest };
      }),
      requestId,
      self: "/api/v1/payslips",
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
      total,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
