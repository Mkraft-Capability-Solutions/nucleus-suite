"use client";
import { useApiGet, apiPost } from "./useApi";

export function useShifts() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/attendance/shifts");
    return { shifts: data ?? [], error, isLoading, refresh: mutate };
}

export function useRoster(employeeId?: string) {
    const path = employeeId ? `/api/v1/attendance/roster?employeeId=${employeeId}` : `/api/v1/attendance/roster`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { roster: data ?? [], error, isLoading, refresh: mutate };
}

export function useAttendance(employeeId?: string) {
    const path = employeeId ? `/api/v1/attendance/days?employeeId=${employeeId}` : `/api/v1/attendance/days`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    
    const punch = async (payload: any) => {
        const result = await apiPost("/api/v1/attendance/punches", payload);
        await mutate();
        return result;
    };

    return { attendanceDays: data ?? [], error, isLoading, punch, refresh: mutate };
}

export function useRegularizations(employeeId?: string) {
    const path = employeeId ? `/api/v1/attendance/regularizations?employeeId=${employeeId}` : `/api/v1/attendance/regularizations`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { regularizations: data ?? [], error, isLoading, refresh: mutate };
}

export function useGatePasses(employeeId?: string) {
    const path = employeeId ? `/api/v1/attendance/gate-passes?employeeId=${employeeId}` : `/api/v1/attendance/gate-passes`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { gatePasses: data ?? [], error, isLoading, refresh: mutate };
}

export function useOvertime(employeeId?: string) {
    const path = employeeId ? `/api/v1/ot?employeeId=${employeeId}` : `/api/v1/ot`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { overtimeRecords: data ?? [], error, isLoading, refresh: mutate };
}

export function useExceptions() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/attendance/exceptions");
    return { exceptions: data ?? [], error, isLoading, refresh: mutate };
}
