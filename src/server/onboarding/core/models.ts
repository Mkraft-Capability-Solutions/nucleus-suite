import { z } from 'zod';

export const onboardingCandidateSchema = z.object({
  id: z.string(),
  candidateName: z.string(),
  email: z.string().email(),
  phone: z.string(),
  designation: z.string(),
  department: z.string(),
  location: z.string(),
  joiningDate: z.string(),
  reportingManager: z.string(),
  buddyName: z.string(),
  status: z.enum(['Pre-Boarding', 'Documents Under Review', 'BGV Initiated', 'IT Provisioned', 'Orientation Ready', 'Joined', 'Deferred']),
  progressPercent: z.number().min(0).max(100),
  documentsSubmitted: z.array(z.object({
    documentType: z.string(),
    fileName: z.string(),
    isVerified: z.boolean()
  })),
  itChecklist: z.array(z.object({
    item: z.string(),
    isProvisioned: z.boolean()
  })),
  bgvStatus: z.enum(['Pending', 'Clear', 'Discrepancy', 'Major Flag']),
  createdAt: z.string()
});

export type OnboardingCandidate = z.infer<typeof onboardingCandidateSchema>;
