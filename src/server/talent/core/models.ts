import { z } from 'zod';

export const jobRequisitionSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  title: z.string().min(3),
  department: z.string(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'CANCELLED']),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type JobRequisition = z.infer<typeof jobRequisitionSchema>;
