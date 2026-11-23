import { loadRulePacks } from "@/server/compliance/rule-packs";
import { readRoute } from "@/server/compliance/route-support";

export const dynamic = "force-dynamic";

/** Stored rule-pack versions, the tenant's active assignment and the state rule matrix (compliance.filing.read). */
export function GET(request: Request) {
  return readRoute(request, "rule-packs", (access) => loadRulePacks(access));
}
