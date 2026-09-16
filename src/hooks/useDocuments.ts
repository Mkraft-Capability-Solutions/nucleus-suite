"use client";
import { useApiGet, apiPost } from "./useApi";

export function useDocuments(employeeId?: string) {
    const path = employeeId ? `/api/v1/documents?employeeId=${employeeId}` : `/api/v1/documents`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { documents: data ?? [], error, isLoading, refresh: mutate };
}
