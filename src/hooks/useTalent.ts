"use client";
import { useApiGet, apiPost } from "./useApi";

export function useRequisitions() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/requisitions");
    return { requisitions: data ?? [], error, isLoading, refresh: mutate };
}

export function useCandidates() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/candidates");
    return { candidates: data ?? [], error, isLoading, refresh: mutate };
}

export function useInterviews() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/interviews");
    return { interviews: data ?? [], error, isLoading, refresh: mutate };
}

export function useOffers() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/offers");
    return { offers: data ?? [], error, isLoading, refresh: mutate };
}

export function useReferrals() {
    const { data, error, isLoading, mutate } = useApiGet<any[]>("/api/v1/referrals");
    return { referrals: data ?? [], error, isLoading, refresh: mutate };
}
