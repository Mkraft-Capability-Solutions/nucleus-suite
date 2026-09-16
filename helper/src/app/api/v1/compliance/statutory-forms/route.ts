import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import {
  allocateFormSerial,
  confirmFormSerial,
  deriveStatutoryFormSchema,
  deriveStatutoryFormValues,
  describeStatutoryTemplates,
  loadFormSerialRegister,
  SERIALISED_FORM_CODES,
  SERIAL_MERGE_FIELD,
  voidFormSerial,
  type StatutoryFormCode,
} from "@/server/compliance/statutory-forms";
import { z } from "zod";

/**
 * R-18 / R-27 — the data behind a statutory form, and the Form F serial register.
 *
 * `POST /api/v1/commands/generate_statutory_form` renders an approved per-state
 * template against a `values` map. This route is where that map comes from, so
 * no figure on a statutory return is ever typed:
 *
 *   GET  ?view=derivation&formCode=FORM_F&locationId=…&employeeId=…&period=…
 *          -> the merge values derived from live records, each with its source,
 *             plus anything the records cannot supply. `allocateSerial=true`
 *             additionally takes the next register number for a serialised form.
 *   GET  ?view=register&formCode=FORM_F[&establishmentKey=&joinedFrom=&joinedTo=]
 *          -> RP-13, with its own gap check.
 *   GET  ?view=templates[&stateCode=&formCode=]
 *          -> which state variants are approved, which are not, and how to supply
 *             one. Layouts are client configuration (Q-13); this never authors one.
 *   POST { action: "confirm_serial" | "void_serial" }
 *          -> bind an allocated serial to the form that was written, or void it
 *             with a reason when the generation did not happen. A serial is never
 *             deleted, so the register stays gapless.
 *
 * The form instance itself is still written by the command, which owns
 * `vp_statutory_instances`. This route never writes one.
 */
export const dynamic = "force-dynamic";

const confirmSerialSchema = z.object({
  action: z.literal("confirm_serial"),
  serialId: z.string().uuid(),
  statutoryInstanceId: z.string().uuid(),
});

const voidSerialSchema = z.object({
  action: z.literal("void_serial"),
  serialId: z.string().uuid(),
  reason: z.string().trim().min(10).max(300),
});

export const statutoryFormSerialCommandSchema = z.discriminatedUnion("action", [confirmSerialSchema, voidSerialSchema]);

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const view = params.get("view") ?? "templates";
    const self = new URL(request.url).pathname;

    if (view === "register") {
      const register = await loadFormSerialRegister(access, {
        formCode: params.get("formCode") ?? "FORM_F",
        establishmentKey: params.get("establishmentKey"),
        joinedFrom: params.get("joinedFrom"),
        joinedTo: params.get("joinedTo"),
      });
      return ok({ type: "statutory-form-register", id: register.formCode, version: 1, attributes: register, requestId, self });
    }

    if (view === "derivation") {
      const parsed = deriveStatutoryFormSchema.safeParse({
        formCode: params.get("formCode") ?? "",
        stateCode: params.get("stateCode") ?? undefined,
        locationId: params.get("locationId") ?? "",
        employeeId: params.get("employeeId") ?? undefined,
        period: params.get("period") ?? "",
      });
      if (!parsed.success) {
        throw new HttpError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Name the form, the establishment and the period the form covers.",
          details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
        });
      }
      const derivation = await deriveStatutoryFormValues(access, parsed.data);
      const serialised = (SERIALISED_FORM_CODES as readonly string[]).includes(derivation.formCode);
      // The serial is taken only when the caller is about to generate: a preview
      // must not consume a register number.
      const takeSerial = serialised && params.get("allocateSerial") === "true";
      const serial = takeSerial
        ? await allocateFormSerial(access, {
            establishmentKey: derivation.establishmentKey,
            formCode: derivation.formCode as StatutoryFormCode,
            employeeId: derivation.employeeId,
          })
        : null;
      return ok({
        type: "statutory-form-derivation",
        id: `${derivation.stateCode}:${derivation.formCode}`,
        version: 1,
        attributes: {
          ...derivation,
          serialised,
          serial,
          values: serial === null ? derivation.values : { ...derivation.values, [SERIAL_MERGE_FIELD]: serial.serialNumber },
        },
        requestId,
        self,
      });
    }

    const templates = await describeStatutoryTemplates(access, {
      stateCode: params.get("stateCode"),
      formCode: params.get("formCode"),
    });
    return ok({ type: "statutory-form-templates", id: "statutory-form-templates", version: 1, attributes: templates, requestId, self });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    // Both actions are single-shot state changes on one serial, so they carry the
    // same idempotency contract as every other write in this family.
    requireIdempotencyKey(request.headers);
    const parsed = statutoryFormSerialCommandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the serial action and its fields.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const self = new URL(request.url).pathname;
    if (parsed.data.action === "confirm_serial") {
      await confirmFormSerial(access, parsed.data.serialId, parsed.data.statutoryInstanceId);
      return ok({
        type: "statutory-form-serial",
        id: parsed.data.serialId,
        version: 1,
        attributes: { id: parsed.data.serialId, statutoryInstanceId: parsed.data.statutoryInstanceId, status: "issued" },
        requestId,
        self,
      });
    }
    const voided = await voidFormSerial(access, parsed.data.serialId, parsed.data.reason, requestId);
    return ok({ type: "statutory-form-serial", id: voided.id, version: 1, attributes: voided, requestId, self });
  } catch (error) {
    return fail(error, requestId);
  }
}
