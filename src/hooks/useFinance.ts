"use client";
import { useApiGet, apiPost } from "./useApi";

export function useGLMappings() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/finance/gl-mappings");
    return { mappings: data ?? [], error, isLoading, refresh: mutate };
}

export function useIntegrations() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/integrations");
    return { integrations: data ?? [], error, isLoading, refresh: mutate };
}
