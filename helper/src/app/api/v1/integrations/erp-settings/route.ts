import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { erpSettingsSchema } from "@/lib/erp-field-ownership";
import { listErpSettings, saveErpSettings } from "@/server/integrations/erp-settings";

export const dynamic = "force-dynamic";

/** FRM-FIN-02: every connection with its ERP field-ownership settings (null until saved) and derived coverage. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listErpSettings(access);
    return collection({
      type: "erp-settings",
      items: items.map((item) => ({ ...item, id: item.connectionId })),
      requestId,
      self: "/api/v1/integrations/erp-settings",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Save the nine fields for one connection. An incomplete mandatory-field map is refused by the schema. */
export async function PUT(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = erpSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The ERP settings payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const saved = await saveErpSettings(access, parsed.data, requestId);
    return ok({
      type: "erp-settings",
      id: saved.connectionId,
      version: saved.version,
      attributes: saved,
      requestId,
      self: "/api/v1/integrations/erp-settings",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
