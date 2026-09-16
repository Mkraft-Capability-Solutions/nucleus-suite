"use client";
import { useApiGet, apiPost } from "./useApi";

export function useClaims(employeeId?: string) {
    const path = employeeId ? `/api/v1/benefits/claims?employeeId=${employeeId}` : `/api/v1/benefits/claims`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { claims: data ?? [], error, isLoading, refresh: mutate };
}

export function useLoans(employeeId?: string) {
    const path = employeeId ? `/api/v1/loans?employeeId=${employeeId}` : `/api/v1/loans`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { loans: data ?? [], error, isLoading, refresh: mutate };
}

export function useAdvances(employeeId?: string) {
    const path = employeeId ? `/api/v1/advances?employeeId=${employeeId}` : `/api/v1/advances`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { advances: data ?? [], error, isLoading, refresh: mutate };
}
