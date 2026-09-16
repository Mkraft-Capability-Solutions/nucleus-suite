"use client";
import { useApiGet, apiPost } from "./useApi";
import { invalidateGetRequest } from "@/lib/client-api";

export function useLegalEntities() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/organization/entities");
    return { entities: data ?? [], error, isLoading, refresh: mutate };
}

export function useLocations() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/organization/locations");
    return { locations: data ?? [], error, isLoading, refresh: mutate };
}
