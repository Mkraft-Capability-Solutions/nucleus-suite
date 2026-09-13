import { describe, expect, it } from 'vitest';
import catalog from '@/data/ui/dashboard.widgets.json';
import { makeLayout, parseLayoutImport, permittedWidgets, sanitizeLayout, sanitizePreferences, type WidgetDefinition } from './dashboard-layout';
import { dashboardStorageKey } from '@/services/dashboard-preferences';
const widgets = catalog.widgets as WidgetDefinition[];
const employee = permittedWidgets(widgets, 'EMPLOYEE', () => true);
const fallback = makeLayout(employee, catalog.defaults.EMPLOYEE, 'My working day');

describe('dashboard layout boundary', () => {
    it('requires both role membership and a module grant', () => {
        const allowed = permittedWidgets(widgets, 'EMPLOYEE', module => module !== 'payroll');
        expect(allowed.some(widget => widget.id === 'my-documents')).toBe(false);
        expect(allowed.some(widget => widget.id === 'governance')).toBe(false);
        expect(allowed.some(widget => widget.id === 'my-day')).toBe(true);
        expect(permittedWidgets(widgets, 'UNKNOWN', () => true)).toEqual([]);
    });
    it('rejects forged, duplicate and revoked widget IDs when restoring preferences', () => {
        const raw = { ...fallback, widgets: [{ id: 'governance' }, { id: 'my-day', size: 99, limit: -3, title: '  My focus  ', data: { confidential: true } }, { id: 'my-day' }] };
        const restored = sanitizeLayout(raw, employee, fallback);
        expect(restored.widgets).toEqual([{ id: 'my-day', size: 2, limit: 5, title: 'My focus' }]);
        const revoked = employee.filter(widget => widget.id !== 'my-day');
        expect(sanitizeLayout(raw, revoked, fallback).widgets).toEqual([]);
        expect(raw.widgets).toHaveLength(3);
    });
    it('validates import format and size and never adopts imported owner or role', () => {
        expect(() => parseLayoutImport('{', employee, fallback)).toThrow('valid Nucleus');
        expect(() => parseLayoutImport(JSON.stringify({ version: 2, layout: fallback }), employee, fallback)).toThrow('supported');
        expect(() => parseLayoutImport('x'.repeat(65537), employee, fallback)).toThrow('64 KB');
        const imported = parseLayoutImport(JSON.stringify({ version: 1, owner: 'someone-else', role: 'SUPER_ADMIN', layout: { ...fallback, id: 'foreign', widgets: [{ id: 'governance' }, { id: 'my-day', title: 'x'.repeat(100) }] } }), employee, fallback);
        expect(imported.id).toBe(fallback.id);
        expect(imported.widgets).toHaveLength(1);
        expect(imported.widgets[0].title).toHaveLength(64);
        expect(imported).not.toHaveProperty('role');
    });
    it('recovers unsupported or empty collections and bounds named layouts', () => {
        expect(sanitizePreferences({ version: 2 }, employee, fallback).layouts).toEqual([fallback]);
        const restored = sanitizePreferences({ version: 1, activeId: 'missing', layouts: Array.from({ length: 20 }, (_, i) => ({ ...fallback, id: String(i) })) }, employee, fallback);
        expect(restored.layouts).toHaveLength(6);
        expect(restored.activeId).toBe('0');
        expect(sanitizePreferences({ version: 1, layouts: [] }, employee, fallback).layouts).toHaveLength(1);
    });
    it('separates identities, roles and consoles in browser storage', () => {
        const identity = { email: 'employee@nucleus.com', role: 'EMPLOYEE', console: 'S8' };
        const key = dashboardStorageKey(identity);
        expect(dashboardStorageKey({ ...identity, email: 'EMPLOYEE@nucleus.com' })).toBe(key);
        expect(dashboardStorageKey({ ...identity, email: 'hr@nucleus.com' })).not.toBe(key);
        expect(dashboardStorageKey({ ...identity, role: 'SUPER_ADMIN' })).not.toBe(key);
        expect(dashboardStorageKey({ ...identity, console: 'S2' })).not.toBe(key);
    });
});
