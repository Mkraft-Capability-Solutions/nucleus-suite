import { operationalResources } from "@/lib/operational-catalog";
import { recordLabel } from "@/lib/workflow-catalog";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { operationalApprovals } from "@/server/workflows/approval-inbox";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const rows = await operationalApprovals(await requireAccess(request));
    const items = rows.slice(0,100).map(row => ({id:row.id,version:row.version,title:recordLabel(row.data),status:row.status,feature:operationalResources[row.resource].label,href:"/" + operationalResources[row.resource].module + "?section=" + encodeURIComponent("operations/" + row.resource)}));
    return collection({type:"approval",items,requestId,self:"/api/v1/workspace/approvals",nextCursor:null});
  } catch (error) { return fail(error,requestId); }
}
