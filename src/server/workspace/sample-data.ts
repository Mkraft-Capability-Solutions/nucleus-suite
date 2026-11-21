import "server-only";

import { isEntitled } from "@/server/entitlements/service";
import { requireAccess } from "@/server/platform/access";

type Workbook = { source?: unknown; sheets?: Record<string, unknown[]> };
type Payload = { version: number; resources: Record<string, unknown> };

export const SAMPLE_DATA_KEY = "administration.sample_data";

/** Same shape as the demo workbook (every sheet present), with no rows. */
export function emptyWorkbook(workbook: Workbook | undefined): Workbook {
  return { source: null, sheets: Object.fromEntries(Object.keys(workbook?.sheets ?? {}).map((sheet) => [sheet, []])) };
}

/**
 * Replaces the demo workbook with an empty one unless the caller is signed in and the active
 * organisation has sample data switched on. A signed-out caller, a real organisation, or any
 * failure gets the empty workbook: the demo company never appears in an organisation by accident.
 */
export async function withSampleDataFor(request: Request, payload: Payload): Promise<Payload> {
  let showSample = false;
  try {
    const access = await requireAccess(request);
    showSample = await isEntitled(access, SAMPLE_DATA_KEY);
  } catch {
    showSample = false;
  }
  if (showSample) return payload;
  return { ...payload, resources: { ...payload.resources, workbook: emptyWorkbook(payload.resources.workbook as Workbook | undefined) } };
}
