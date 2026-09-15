import { loadWorkspaceData } from './workspace-data.mjs';

export async function listModuleRecords(moduleId) {
    await loadWorkspaceData();
    const { getWorkbookRowsForModule } = await import('../lib/demo-workbook-adapter.mjs');
    const workbookRows = getWorkbookRowsForModule(moduleId) || [];

    if (typeof window !== 'undefined') {
        try {
            const res = await fetch(`/api/v1/ops/modules/${moduleId}/records?pageSize=50`);
            if (res.ok) {
                const data = await res.json().catch(() => null);
                const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.items) ? data.items : []);
                if (items.length > 0) {
                    const serverRows = items.map(item => ({
                        id: item.id,
                        _cells: item.attributes || {},
                        values: item.attributes || {},
                        attributes: item.attributes || {},
                        createdAt: item.createdAt || new Date().toISOString()
                    }));
                    return [...serverRows, ...workbookRows];
                }
            }
        } catch {
            // Gracefully fall back to workbook rows
        }
    }

    return workbookRows;
}

export async function updateModuleRecord(moduleId, recordId, payload) {
    if (typeof window !== 'undefined') {
        const res = await fetch(`/api/v1/ops/modules/${moduleId}/records/${recordId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            const data = await res.json().catch(() => null);
            return data?.data || data;
        }
    }
    return null;
}

