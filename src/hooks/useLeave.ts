"use client";
import { useApiGet, apiPost } from "./useApi";

export function useLeaveTypes() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/leave-types");
    return { leaveTypes: data ?? [], error, isLoading, refresh: mutate };
}

export function useLeaveRequests(employeeId?: string, status?: string) {
    const params = new URLSearchParams({ pageSize: "100" });
    if (employeeId) params.set("employeeId", employeeId);
    if (status) params.set("status", status);
    
    const { data, error, isLoading, mutate } = useApiGet<any[]>(`/api/v1/leave-requests?${params}`);

    const submitLeave = async (payload: any) => {
        const result = await apiPost("/api/v1/leave-requests", payload, crypto.randomUUID());
        await mutate();
        return result;
    };

    const decideLeave = async (id: string, approve: boolean, comment?: string) => {
        const result = await apiPost(`/api/v1/leave-requests/${id}/decide`, { approve, comment }, crypto.randomUUID());
        await mutate();
        return result;
    };

    return { requests: data ?? [], error, isLoading, submitLeave, decideLeave, refresh: mutate };
}

export function useCompOff(employeeId?: string) {
    const path = employeeId ? `/api/v1/leave/coff?employeeId=${employeeId}` : `/api/v1/leave/coff`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { compOffGrants: data ?? [], error, isLoading, refresh: mutate };
}

export function useEncashments(employeeId?: string) {
    const path = employeeId ? `/api/v1/leave/encashments?employeeId=${employeeId}` : `/api/v1/leave/encashments`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { encashments: data ?? [], error, isLoading, refresh: mutate };
}
