import { operationalList, operationalMutation } from "@/server/workflows/operational-route";
export const dynamic="force-dynamic";
type Context={params:Promise<{resource:string}>};
export async function GET(request:Request,context:Context){return operationalList(request,(await context.params).resource);}
export async function POST(request:Request,context:Context){return operationalMutation(request,(await context.params).resource,"create");}
