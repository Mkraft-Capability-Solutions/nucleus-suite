export async function listModuleRecords(moduleId) {
    if (typeof window !== 'undefined') {
        try {
            const res = await fetch(`/api/v1/ops/modules/${moduleId}/records?pageSize=50`);
            if (!res.ok) return [];
            const data = await res.json().catch(() => null);
            const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.items) ? data.items : []);
            
            const serverRows = items.map(item => {
                const rawAttrs = item.attributes || {};
                const startTime = item.startTime || item.start_time || rawAttrs.startTime;
                const endTime = item.endTime || item.end_time || rawAttrs.endTime;
                const periodFromPeriodTo = rawAttrs.periodFromPeriodTo || (startTime && endTime ? `${startTime} - ${endTime}` : (startTime || endTime));
                const merged = {
                    ...rawAttrs,
                    startTime,
                    endTime,
                    periodFromPeriodTo
                };
                return {
                    id: item.id,
                    _cells: merged,
                    values: merged,
                    attributes: merged,
                    status: item.status || rawAttrs.status || 'Active',
                    createdAt: item.createdAt || item.created_at || new Date().toISOString()
                };
            });
            return serverRows;
        } catch {
            return [];
        }
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

