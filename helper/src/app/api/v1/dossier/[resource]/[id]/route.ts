import { dossierMutation } from "@/server/workflows/dossier-route";
export const dynamic="force-dynamic";
export async function PATCH(request:Request,context:{params:Promise<{resource:string;id:string}>}){const {resource,id}=await context.params;return dossierMutation(request,resource,id);}
