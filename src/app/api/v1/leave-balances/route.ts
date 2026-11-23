import { NextResponse } from "next/server";
import { z } from "zod";
import { enforce, requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { issueDetails, runIdempotent } from "@/server/leave/idempotent-write";
import { resolveEmployee } from "@/server/leave/workspace";
import { getBalances, accrualCreditSchema, recordAccrualCredit } from "@/server/leave/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const employeeId = new URL(request.url).searchParams.get("employeeId");
    if (!z.string().uuid().safeParse(employeeId).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid employeeId is required." });
    }
    const balances = await getBalances(access, employeeId as string);
    return NextResponse.json({ data: { type: "leave-balances", ...balances }, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * Accrual credit for one employee (HR, permission leave.maintain). The employee
 * must be named and exist in the tenant; Idempotency-Key is required so a
 * retried credit cannot post twice.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "leave.maintain", { tenantId: access.tenantId });
    const key = requireIdempotencyKey(request.headers);
    const parsed = accrualCreditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !parsed.data.employeeId) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: "An employee and a positive number of days are required.", details: parsed.success ? [{ field: "employeeId", issue: "required" }] : issueDetails(parsed.error.issues) });
    }
    const employee = await resolveEmployee(access, parsed.data.employeeId);
    const input = { ...parsed.data, employeeId: employee.id };
    const outcome = await runIdempotent(access, "leave.accrual_credit", key, input, () => recordAccrualCredit(access, input, requestId));
    const attributes = outcome.attributes;
    return NextResponse.json(
      { data: { type: "leave-accrual", ...attributes }, meta: { requestId } },
      { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } }
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
