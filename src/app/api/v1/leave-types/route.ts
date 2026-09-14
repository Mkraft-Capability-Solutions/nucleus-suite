import { requireAccess, enforce, tenantTx } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { ensureLeaveType } from "@/server/leave/service";
import { sqlClient } from "@/lib/db";
import { z } from "zod";


export const dynamic = "force-dynamic";



const STANDARD_LEAVE_TYPES = [
  { code: "EL", name: "Earned Leave", unit: "day", max_per_month: null, carry_forward_days: 30, auto_credit: true },
  { code: "CL", name: "Casual Leave", unit: "day", max_per_month: 3, carry_forward_days: 0, auto_credit: false },
  { code: "SL", name: "Sick Leave", unit: "day", max_per_month: null, carry_forward_days: 0, auto_credit: false },
  { code: "COFF", name: "Compensatory Off", unit: "day", max_per_month: null, carry_forward_days: 0, validity_days: 60, auto_credit: false },
  { code: "BIRTHDAY", name: "Birthday Leave", unit: "day", max_per_month: 1, carry_forward_days: 0, auto_credit: false },
  { code: "WFH", name: "Work From Home", unit: "day", max_per_month: 8, carry_forward_days: 0, auto_credit: false },
  { code: "ML", name: "Maternity Leave", unit: "day", max_per_month: null, carry_forward_days: 0, auto_credit: false },
  { code: "PL", name: "Paternity Leave", unit: "day", max_per_month: null, carry_forward_days: 0, auto_credit: false },
  { code: "LOP", name: "Loss of Pay", unit: "day", max_per_month: null, carry_forward_days: 0, auto_credit: false },
] as const;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
    const [rows] = await tenantTx(access, [
      sqlClient`select id, tenant_id, attributes, created_at from leave_types where tenant_id = ${access.tenantId} order by attributes->>'code' asc`,
    ]);
    return collection({
      type: "leave-type",
      items: (rows as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        version: 1,
        ...row,
      })),
      requestId,
      self: "/api/v1/leave-types",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

const createLeaveTypeSchema = z.object({
  code: z.string().trim().min(1).max(20).toUpperCase(),
  name: z.string().trim().min(1).max(80),
  unit: z.enum(["day", "half-day", "hour"]).default("day"),
  maxPerMonth: z.number().int().min(0).optional(),
  carryForwardDays: z.number().int().min(0).default(0),
  validityDays: z.number().int().min(1).optional(),
  autoCredit: z.boolean().default(false),
  annualCreditDays: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "employee.write", { tenantId: access.tenantId });
    const parsed = createLeaveTypeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The leave type payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const id = await ensureLeaveType(access, parsed.data.code);
    return ok({ type: "leave-type", id, version: 1, attributes: { code: parsed.data.code, name: parsed.data.name }, requestId, self: `/api/v1/leave-types/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
