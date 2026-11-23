import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createMovementSchema } from "@/lib/employment-movements";
import { createMovement, listMovements } from "@/server/organization/employment-movements";
import { checkIdempotency, requireAccess } from "@/server/platform/access";
import { fail, HttpError, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const headers = (requestId: string) => ({ "cache-control": "no-store", "x-request-id": requestId });
const OPERATION = "people.movement_create";

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(["effective_date", "-effective_date"]).default("effective_date"),
});

function validation(error: z.ZodError): HttpError {
  return new HttpError({
    status: 400, code: "VALIDATION_FAILED", message: error.issues[0]?.message ?? "Check the highlighted fields.",
    details: error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
  });
}

/** The employee's movements, oldest first by default, with company names, industry and tenure (employee.read). */
export async function GET(request: Request, { params }: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = listQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw validation(parsed.error);
    const data = await listMovements(access, decodeURIComponent(id), { page: parsed.data.page, pageSize: parsed.data.pageSize, order: parsed.data.sort === "effective_date" ? "asc" : "desc" });
    return NextResponse.json({ data, meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Records a hire, inter-company transfer, promotion, role change or deputation (employee.write, Idempotency-Key required). */
export async function POST(request: Request, { params }: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const { id } = await params;
    const parsed = createMovementSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw validation(parsed.error);
    const employeeRef = decodeURIComponent(id);
    const fingerprint = createHash("sha256").update(JSON.stringify({ employeeRef, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, OPERATION, key, fingerprint);
    if (prior.outcome === "conflict") throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    if (prior.outcome === "replay" && prior.responseLocator) {
      return NextResponse.json({ data: { id: prior.responseLocator, replayed: true }, meta: { requestId } }, { status: 200, headers: headers(requestId) });
    }
    const result = await createMovement(access, employeeRef, parsed.data, requestId, { operation: OPERATION, key, fingerprint });
    return NextResponse.json({ data: result, meta: { requestId } }, { status: 201, headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
