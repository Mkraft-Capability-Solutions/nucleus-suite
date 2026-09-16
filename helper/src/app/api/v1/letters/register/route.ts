import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { issueLetter, issueLetterSchema, listLettersRegister } from "@/server/letters/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listLettersRegister(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "letter",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/letters/register",
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
    const parsed = issueLetterSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A template, an employee, an effective date (YYYY-MM-DD), an approver and a reason (min 3 characters) are required to issue a letter.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await issueLetter(access, parsed.data, requestId);
    return ok({
      type: "letter",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: "/api/v1/letters/register",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
