import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import {
  executeRecognitionCommand,
  loadRecognitionRegister,
  recognitionCommandSchema,
  recognitionRegisterQuery,
} from "@/server/engagement/recognition-register";

/**
 * SCR-065 — Recognition register (FRM-EXP-02, process EXP-01).
 *
 * GET  reads the register: nominee, programme, award value and state across
 *      Nominated → Approved → Published → Paid, with the citation, the
 *      programme's configured ceiling (or the fact that none is configured),
 *      the committee decision and its reason, the linked announcement, the
 *      reward transaction, the state timeline and the audit trail. Per row it
 *      also carries what the caller may do and, when they may not, why.
 * POST is the single command endpoint: nominate, approve, reject, publish and
 *      mark_paid. Every command is gated by the same pure rules the register
 *      renders, so a refusal never surprises the caller.
 *
 * Why not `POST /api/v1/recognition-events`: that endpoint's contract
 * (`recognizeSchema`) accepts a recipient, a free-text message and a points
 * figure only. It cannot carry a citation, a programme, an award value or a
 * period, it hard-codes the `STAR-MONTHLY` programme, and it stores no state,
 * so it cannot express a nomination this register can decide. Rows it wrote
 * still appear here, flagged as legacy kudos.
 *
 * This route never moves money. `mark_paid` writes a reward transaction that
 * records a payment somebody already completed outside this system; it raises
 * no payroll input and produces no bank instruction.
 */
export const dynamic = "force-dynamic";

/** Top-level so the contract is readable without opening the service. */
export const querySchema = recognitionRegisterQuery;
export const commandSchema = recognitionCommandSchema;

const SELF = "/api/v1/recognition-register";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const raw: Record<string, string> = {};
    for (const key of ["state", "programmeId", "employeeId", "search", "page", "pageSize"]) {
      const value = params.get(key);
      if (value !== null && value !== "") raw[key] = value;
    }
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the recognition register filters.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const register = await loadRecognitionRegister(access, parsed.data);
    // A composed read model, like `GET /api/v1/statutory-register`: the award
    // rows only mean something beside the programme catalogue, the configured
    // ceilings and the note about what marking an award paid does and does not
    // do. The cursor travels inside the envelope.
    return ok({
      type: "recognition-register",
      id: "recognition-register",
      version: 1,
      attributes: { ...register },
      requestId,
      self: SELF,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = commandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the recognition command fields.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const operation = `engagement.recognition.${parsed.data.action}`;
    const prior = await checkIdempotency(access, operation, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({
        status: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "This Idempotency-Key was already used with a different payload.",
      });
    }
    const result = await executeRecognitionCommand(access, parsed.data, requestId);
    await storeIdempotency(access, operation, key, fingerprint, 200, result.id);
    return ok({
      type: "recognition-award",
      id: result.id,
      version: 1,
      attributes: { ...result, action: parsed.data.action },
      requestId,
      self: SELF,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
