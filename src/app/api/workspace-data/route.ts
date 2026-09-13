import { NextResponse } from 'next/server';
import { getWorkspaceData } from '@/server/workspace/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (process.env.DEMO_AUTH_ENABLED !== 'true') {
        return NextResponse.json({ error: { code: 'WORKSPACE_DISABLED', message: 'This workspace is not enabled. Contact the application administrator.' } }, {
            status: 503, headers: { 'Cache-Control': 'private, no-store' },
        });
    }
    try {
        return NextResponse.json(await getWorkspaceData(), {
            headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
        });
    } catch {
        return NextResponse.json({ error: { code: 'DATA_PROVIDER_UNAVAILABLE', message: 'Workspace data is unavailable.' } }, { status: 503 });
    }
}
