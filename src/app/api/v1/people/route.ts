import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createPerson, createPersonSchema, listEmployees } from "@/server/organization/service";

export const dynamic = "force-dynamic";

/** Permission-filtered people directory with Plant/HO field masking. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const search = (params.get("search") ?? "").slice(0, 80);
    const { items, total } = await listEmployees(access, { search, page, pageSize });
    const self = `/api/v1/people?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}`;
    const hasMore = page * pageSize < total;
    return collection({
      type: "employee",
      items: items.map((item) => ({
        id: item.id,
        version: item.version,
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
      })),
      requestId,
      self,
      nextCursor: hasMore ? Buffer.from(JSON.stringify({ page: page + 1, search }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Single-person creation (Add Person form). Consequential write: Idempotency-Key required. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const rawJson = await request.json().catch(() => null);
    const sanitized = rawJson && typeof rawJson === "object"
      ? Object.fromEntries(
          Object.entries(rawJson).map(([k, v]) => [
            k,
            typeof v === "string" && v.trim() === "" ? undefined : v,
          ])
        )
      : rawJson;
    const parsed = createPersonSchema.safeParse(sanitized);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The person payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "people.create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await createPerson(access, parsed.data, requestId);
    await storeIdempotency(access, "people.create", key, fingerprint, 201, result.id);
    return ok({ type: "employee", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/people/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
