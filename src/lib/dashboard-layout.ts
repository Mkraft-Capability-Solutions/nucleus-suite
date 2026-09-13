export type WidgetDefinition = { id: string; title: string; description: string; roles: string[]; module: string; kind: 'links' | 'list' | 'metrics' | 'bars'; dataKey: string; size: number; icon: string; target?: string };
export type WidgetInstance = { id: string; title: string; size: number; limit: number };
export type DashboardLayout = { id: string; name: string; widgets: WidgetInstance[]; density: 'comfortable' | 'compact'; columns: 2 | 3; accent: 'violet' | 'blue' | 'teal' };
export type DashboardPreferences = { version: 1; activeId: string; layouts: DashboardLayout[] };
export type AccessCheck = (module: string) => boolean;
export function permittedWidgets(widgets: WidgetDefinition[], role: string, allowed: AccessCheck) {
    return widgets.filter(widget => widget.roles.includes(role) && allowed(widget.module));
}
export function makeLayout(definitions: WidgetDefinition[], ids: string[], name: string, id = 'default'): DashboardLayout {
    return { id, name, density: 'comfortable', columns: 3, accent: 'violet', widgets: ids.flatMap(widgetId => {
        const definition = definitions.find(widget => widget.id === widgetId);
        return definition ? [{ id: definition.id, title: definition.title, size: definition.size, limit: 5 }] : [];
    }) };
}
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function sanitizeLayout(raw: unknown, definitions: WidgetDefinition[], fallback: DashboardLayout): DashboardLayout {
    if (!isRecord(raw) || !Array.isArray(raw.widgets)) return structuredClone(fallback);
    const seen = new Set<string>();
    const widgets: WidgetInstance[] = raw.widgets.slice(0, 30).flatMap(value => {
        if (!isRecord(value) || typeof value.id !== 'string' || seen.has(value.id)) return [];
        const definition = definitions.find(widget => widget.id === value.id);
        if (!definition) return [];
        seen.add(value.id);
        return [{ id: definition.id, title: typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 64) : definition.title, size: [1, 2, 3].includes(Number(value.size)) ? Number(value.size) : definition.size, limit: [3, 5, 8].includes(Number(value.limit)) ? Number(value.limit) : 5 }];
    });
    return { id: typeof raw.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(raw.id) ? raw.id : fallback.id, name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 50) : fallback.name, widgets, density: raw.density === 'compact' ? 'compact' : 'comfortable', columns: raw.columns === 2 ? 2 : 3, accent: raw.accent === 'blue' || raw.accent === 'teal' ? raw.accent : 'violet' };
}
export function sanitizePreferences(raw: unknown, definitions: WidgetDefinition[], fallback: DashboardLayout): DashboardPreferences {
    if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.layouts)) return { version: 1, activeId: fallback.id, layouts: [structuredClone(fallback)] };
    const layouts = raw.layouts.slice(0, 6).map(layout => sanitizeLayout(layout, definitions, fallback)).filter((layout, index, list) => list.findIndex(item => item.id === layout.id) === index);
    if (!layouts.length) layouts.push(structuredClone(fallback));
    return { version: 1, layouts, activeId: layouts.some(layout => layout.id === raw.activeId) ? String(raw.activeId) : layouts[0].id };
}
export function parseLayoutImport(text: string, definitions: WidgetDefinition[], fallback: DashboardLayout): DashboardLayout {
    if (text.length > 65536) throw new Error('Layout files must be smaller than 64 KB.');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error('Choose a valid Nucleus layout JSON file.'); }
    if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.layout) || !Array.isArray(raw.layout.widgets)) throw new Error('This file is not a supported Nucleus layout.');
    return { ...sanitizeLayout(raw.layout, definitions, fallback), id: fallback.id };
}
