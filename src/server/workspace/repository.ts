import 'server-only';
import { workspaceResources } from '@/data/workspace-manifest';

/** Replace this repository with domain-service aggregation when the backend is ready. */
export async function getWorkspaceData() {
    if ((process.env.APP_DATA_MODE || 'json') !== 'json') {
        throw new Error('No workspace data provider is configured for this mode.');
    }
    return { version: 1, resources: workspaceResources };
}
