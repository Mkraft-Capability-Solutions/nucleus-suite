import { operationalMutation } from "@/server/workflows/operational-route";
export const dynamic="force-dynamic";
export async function PATCH(request:Request,context:{params:Promise<{resource:string;id:string}>}){const {resource,id}=await context.params;return operationalMutation(request,resource,"edit",id);}
export const PUT = PATCH;
