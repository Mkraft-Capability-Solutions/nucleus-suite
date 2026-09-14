import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom, requireIdempotencyKey, requireVersion } from "@/server/platform/http";
import { listOperationalRecords, mutateOperationalRecord } from "./operational-service";
export async function operationalList(request: Request, resource: string) {
 const requestId=requestIdFrom(request.headers);
 try { const access=await requireAccess(request); const result=await listOperationalRecords(access,resource,new URL(request.url).searchParams); return collection({type:resource,...result,requestId,self:new URL(request.url).pathname}); } catch(error) { return fail(error,requestId); }
}
export async function operationalMutation(request: Request, resource: string, action: string, id?: string) {
 const requestId=requestIdFrom(request.headers);
 try {
  const access=await requireAccess(request);
  if(id && !z.string().uuid().safeParse(id).success) throw new HttpError({status:400,code:"BAD_REQUEST",message:"Invalid record reference."});
  const result=await mutateOperationalRecord(access,resource,{id,action,key:requireIdempotencyKey(request.headers),version:id?requireVersion(request.headers):undefined,input:await request.json().catch(()=>null)});
  return ok({type:resource,id:String(result.id),version:Number(result.version),attributes:result,requestId,self:new URL(request.url).pathname});
 } catch(error) { return fail(error,requestId); }
}
