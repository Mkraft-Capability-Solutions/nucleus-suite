import { dossierList,dossierMutation } from "@/server/workflows/dossier-route";
export const dynamic="force-dynamic";
type Context={params:Promise<{resource:string}>};
export async function GET(request:Request,context:Context){return dossierList(request,(await context.params).resource);}
export async function POST(request:Request,context:Context){return dossierMutation(request,(await context.params).resource);}
