import useSWR from 'swr';
import { OnboardingCandidate } from '@/server/onboarding/core/models';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useOnboarding() {
  const { data, error, mutate } = useSWR('/api/v1/onboarding', fetcher);

  const verifyDocument = async (candidateId: string, documentType: string, isVerified: boolean) => {
    await fetch(`/api/v1/onboarding/${candidateId}/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentType, isVerified })
    });
    mutate(); // Refetch data
  };

  const toggleITProvisionItem = async (candidateId: string, item: string, isProvisioned: boolean) => {
    await fetch(`/api/v1/onboarding/${candidateId}/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, isProvisioned })
    });
    mutate(); // Refetch data
  };

  return {
    candidates: (data?.candidates || []) as OnboardingCandidate[],
    stats: data?.stats || { totalInPipeline: 0, joiningThisMonth: 0, avgTimeToOnboardDays: 0 },
    isLoading: !error && !data,
    isError: error,
    verifyDocument,
    toggleITProvisionItem
  };
}
