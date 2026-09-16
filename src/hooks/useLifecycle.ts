"use client";
import { useApiGet, apiPost } from "./useApi";

export function useOnboarding() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/lifecycle/onboarding");
    return { onboardingInstances: data ?? [], error, isLoading, refresh: mutate };
}

export function useConfirmations() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/lifecycle/confirmations");
    return { confirmations: data ?? [], error, isLoading, refresh: mutate };
}

export function useOffboarding() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/lifecycle/offboarding");
    return { offboardingCases: data ?? [], error, isLoading, refresh: mutate };
}

export function useClearances(employeeId?: string) {
    const path = employeeId ? `/api/v1/lifecycle/clearance?employeeId=${employeeId}` : `/api/v1/lifecycle/clearance`;
    const { data, error, isLoading, mutate } = useApiGet<any[]>(path);
    return { clearances: data ?? [], error, isLoading, refresh: mutate };
}
