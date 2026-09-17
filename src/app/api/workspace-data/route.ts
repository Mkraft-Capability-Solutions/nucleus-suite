import { NextResponse } from 'next/server';
import { getWorkspaceData } from '@/server/workspace/repository';
import { workspaceResources } from '@/server/workspace/manifest';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (process.env.DEMO_AUTH_ENABLED === 'false') {
        return NextResponse.json({ error: { code: 'WORKSPACE_DISABLED', message: 'This workspace is not enabled. Contact the application administrator.' } }, {
            status: 503, headers: { 'Cache-Control': 'private, no-store' },
        });
    }
    try {
        const payload = await getWorkspaceData();
        return NextResponse.json(payload, {
            headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
        });
    } catch (err) {
        console.warn('Workspace data fetch failed, using fallback manifest:', err);
        return NextResponse.json({ version: 1, resources: workspaceResources }, {
            headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
        });
    }
}
