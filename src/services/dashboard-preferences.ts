import { sanitizePreferences, type DashboardLayout, type DashboardPreferences, type WidgetDefinition } from '@/lib/dashboard-layout';
export type DashboardIdentity = { email: string; role: string; console: string };
export const dashboardStorageKey = (identity: DashboardIdentity) => `nucleus:dashboard:v1:${encodeURIComponent(identity.email.toLowerCase())}:${identity.role}:${identity.console}`;
/** Local adapter only. Persist presentation metadata, never workspace records or identity grants. */
export async function loadDashboardPreferences(identity: DashboardIdentity, definitions: WidgetDefinition[], fallback: DashboardLayout): Promise<{ preferences: DashboardPreferences; warning?: string }> {
    try {
        const value = localStorage.getItem(dashboardStorageKey(identity));
        if (value && value.length > 131072) throw new Error('Oversized preferences');
        return { preferences: sanitizePreferences(value ? JSON.parse(value) : null, definitions, fallback) };
    } catch {
        return { preferences: sanitizePreferences(null, definitions, fallback), warning: 'Saved preferences could not be read. Defaults are available; you can still customize this session.' };
    }
}
export async function saveDashboardPreferences(identity: DashboardIdentity, preferences: DashboardPreferences): Promise<void> {
    try { localStorage.setItem(dashboardStorageKey(identity), JSON.stringify(preferences)); }
    catch { throw new Error('This browser could not save your layout. Your draft is still available. Export it or enable local storage and try again.'); }
}
