import { NextResponse } from 'next/server';
import { getWorkspaceData } from '@/server/workspace/repository';
import { workspaceResources } from '@/server/workspace/manifest';
import { withSampleDataFor } from '@/server/workspace/sample-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (process.env.DEMO_AUTH_ENABLED === 'false') {
        return NextResponse.json({ error: { code: 'WORKSPACE_DISABLED', message: 'This workspace is not enabled. Contact the application administrator.' } }, {
            status: 503, headers: { 'Cache-Control': 'private, no-store' },
        });
    }
    let payload;
    try {
        payload = await getWorkspaceData();
    } catch (err) {
        console.warn('Workspace data fetch failed, using fallback manifest:', err);
        payload = { version: 1, resources: workspaceResources };
    }
    // The built-in demo company (scripts/seeds/workbook.json) is only shown to organisations that
    // have Administration › Sample data switched on; everyone else gets the same shape, empty.
    return NextResponse.json(await withSampleDataFor(request, payload), {
        headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
}
