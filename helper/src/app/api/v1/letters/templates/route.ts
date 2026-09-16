import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { letterMergeFieldCatalogue, saveLetterTemplate, saveLetterTemplateSchema } from "@/server/letters/service";

export const dynamic = "force-dynamic";

const SELF = "/api/v1/letters/templates";

/**
 * GET /api/v1/letters/templates — the merge-field catalogue a template may use.
 *
 * The workbook's "Merge fields available" is read-only and sourced "from the employee
 * record", so the template editor needs the vocabulary before it can be checked
 * against. The list separates the fields the employee record fills automatically from
 * the ones that must be supplied when the letter is issued.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    await requireAccess(request);
    return NextResponse.json(
      { data: letterMergeFieldCatalogue(), meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * POST /api/v1/letters/templates — create or replace a template by its code.
 *
 * A template referencing a merge field that does not exist is refused HERE, with 422
 * and the offending field named. That is the point of the endpoint: the failure has
 * to land on the template author, not on the person issuing the letter.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = saveLetterTemplateSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A template code, name, letter type, version, subject, body and reason are required to save a template.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await saveLetterTemplate(access, parsed.data, requestId);
    return ok({ type: "letter-template", id: result.id, version: 1, attributes: result, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}
