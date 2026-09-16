"use client";
import { useApiGet, apiPost } from "./useApi";

export function useAssets(employeeId?: string) {
    const path = employeeId ? `/api/v1/assets?employeeId=${employeeId}` : `/api/v1/assets`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { assets: data ?? [], error, isLoading, refresh: mutate };
}
