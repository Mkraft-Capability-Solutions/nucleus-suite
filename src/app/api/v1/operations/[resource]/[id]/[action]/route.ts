import { operationalScope } from "@/server/workflows/operational-access";
import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { requireAccess, tenantTx } from "@/server/platform/access";
import { collection, fail, HttpError, parsePagination, requestIdFrom } from "@/server/platform/http";
import { z } from "zod";
import { operationalMutation } from "@/server/workflows/operational-route";
export const dynamic="force-dynamic";
export async function POST(request:Request,context:{params:Promise<{resource:string;id:string;action:string}>}){const {resource,id,action}=await context.params;return operationalMutation(request,resource,action,id);}

export async function GET(request:Request,context:{params:Promise<{resource:string;id:string;action:string}>}){
 const requestId=requestIdFrom(request.headers);
 try {
  const access=await requireAccess(request);const {resource,id,action}=await context.params;
  if(action!=="history" || !Object.hasOwn(operationalResources,resource) || !z.string().uuid().safeParse(id).success)throw new HttpError({status:404,code:"NOT_FOUND",message:"History was not found."});
  const scope=operationalScope(access,operationalResources[resource].permission,"read");
  const {page,pageSize}=parsePagination(new URL(request.url).searchParams);
  const [rows]=await tenantTx(access,[sqlClient`select e.id,1 as version,e.action,e.reason,e.created_at,e.response->>'status' as status from hrms_operation_events e join hrms_operation_records r on r.tenant_id=e.tenant_id and r.id=e.record_id where e.tenant_id=${access.tenantId} and r.resource=${resource} and r.id=${id} and (${scope}='all' or r.employee_id=${access.context.employeeId ?? null}::uuid or (${scope}='team' and r.employee_id in(select id from employees where tenant_id=${access.tenantId} and manager_employee_id=${access.context.employeeId ?? null}::uuid))) and (${resource} <> 'tickets' or ${scope} <> 'team' or r.employee_id=${access.context.employeeId ?? null}::uuid or r.data->>'category' <> 'grievance') order by e.created_at,e.id limit ${pageSize+1} offset ${(page-1)*pageSize}`]);
  const items=rows as Array<{id:string;version:number}>;
  return collection({type:"workflow-history",items:items.slice(0,pageSize),requestId,self:new URL(request.url).pathname,nextCursor:items.length>pageSize?Buffer.from(JSON.stringify({page:page+1})).toString("base64url"):null});
 }catch(error){return fail(error,requestId);}
}
