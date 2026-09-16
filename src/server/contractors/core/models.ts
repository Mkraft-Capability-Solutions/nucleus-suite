import { z } from 'zod';

export const contractorSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  contractorName: z.string().min(2),
  agencyId: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Contractor = z.infer<typeof contractorSchema>;
