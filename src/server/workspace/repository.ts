import 'server-only';
import { workspaceResources } from './manifest';
import { pool } from '@/lib/db';

let cachedWorkspaceData: { data: any; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds cache

/**
 * Serves workspace data dynamically.
 * In JSON mode: returns canonical UI manifest.
 * In Database mode: overlays UI configuration stored in system_configuration_values (global, not tenant data).
 */
export async function getWorkspaceData() {
    if (cachedWorkspaceData && Date.now() < cachedWorkspaceData.expiresAt) {
        return cachedWorkspaceData.data;
    }

    const mode = process.env.APP_DATA_MODE || 'database';
    const liveResources = { ...workspaceResources };

    if (mode === 'json') {
        const result = { version: 1, resources: liveResources };
        cachedWorkspaceData = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
        return result;
    }

    // Only global UI configuration is served here. Tenant records are never part of this payload:
    // it is cached across requests and readable before sign-in. Screens load tenant data from the
    // tenant-scoped /api/v1 routes.
    try {
        const configRows = await pool.query('SELECT key, value FROM system_configuration_values');
        for (const row of configRows.rows) {
            try {
                liveResources[row.key] = JSON.parse(row.value);
            } catch {
                liveResources[row.key] = row.value;
            }
        }
    } catch (error) {
        console.warn('Workspace configuration fallback to canonical manifest:', (error as { code?: string })?.code ?? 'UNKNOWN');
    }

    const payload = { version: 1, resources: liveResources };
    cachedWorkspaceData = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return payload;
}
