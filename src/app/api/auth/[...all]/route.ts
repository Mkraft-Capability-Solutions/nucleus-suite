import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';
import { readRuntimeConfiguration, runtimeConfigurationProblems, environmentProblems } from '@/lib/runtime-config';

export const dynamic = 'force-dynamic';
const handlers = toNextJsHandler(auth);
function unavailable() {
    return runtimeConfigurationProblems(readRuntimeConfiguration()).length > 0 || environmentProblems().length > 0;
}
function disabled() {
    return Response.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Session authentication is not configured.' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
export async function GET(request: Request) {
    return unavailable() ? disabled() : handlers.GET(request);
}
export async function POST(request: Request) {
    return unavailable() ? disabled() : handlers.POST(request);
}
