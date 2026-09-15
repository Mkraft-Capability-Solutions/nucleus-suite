export async function listModuleRecords(moduleId) {
    if (typeof window !== 'undefined') {
        const res = await fetch(`/api/v1/ops/modules/${moduleId}/records?pageSize=50`);
        if (!res.ok) {
            throw new Error(`Failed to fetch records from database for module ${moduleId}`);
        }
        const data = await res.json().catch(() => null);
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.items) ? data.items : []);
        
        const serverRows = items.map(item => ({
            id: item.id,
            _cells: item.attributes || {},
            values: item.attributes || {},
            attributes: item.attributes || {},
            createdAt: item.createdAt || new Date().toISOString()
        }));
        return serverRows;
    }
    return [];
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

