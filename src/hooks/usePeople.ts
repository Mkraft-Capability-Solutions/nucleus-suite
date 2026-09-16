"use client";
import { useApiGet, apiPost } from "./useApi";
import { invalidateGetRequest } from "@/lib/client-api";

export function useEmployees(search = "", page = 1) {
    const path = `/api/v1/people?search=${encodeURIComponent(search)}&page=${page}&pageSize=100`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    
    const createEmployee = async (payload: any) => {
        const key = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `emp-${Date.now()}`;
        const result = await apiPost("/api/v1/people", payload, key);
        invalidateGetRequest("/api/v1/people");
        await mutate();
        return result;
    };

    return { employees: data ?? [], error, isLoading, createEmployee, refresh: mutate };
}

export function useEmployeeAssignments(employeeId: string) {
    const { data, error, isLoading, mutate } = useApiGet<any[]>(employeeId ? `/api/v1/people/${employeeId}/assignments` : null);
    return { assignments: data ?? [], error, isLoading, refresh: mutate };
}

export function usePositions() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/organization/positions");
    return { positions: data ?? [], error, isLoading, refresh: mutate };
}

export function useManpower() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/organization/manpower");
    return { manpowerPlans: data ?? [], error, isLoading, refresh: mutate };
}
