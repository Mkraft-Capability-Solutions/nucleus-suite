import { loadMusterRoll, musterQuerySchema } from "@/server/compliance/factory-registers";
import { parseOrThrow, readRoute } from "@/server/compliance/route-support";

export const dynamic = "force-dynamic";

/** Form 28 muster roll for one month, derived from attendance_days (compliance.filing.read + attendance.read). */
export function GET(request: Request) {
  return readRoute(request, "muster-roll", (access, params) =>
    loadMusterRoll(access, parseOrThrow(musterQuerySchema, { month: params.get("month") ?? "", location: params.get("location") || undefined }, "Check the muster roll period.")),
  );
}
