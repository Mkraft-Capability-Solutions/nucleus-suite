import { z } from 'zod';

export const projectWorkforceSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  projectId: z.string().min(1),
  projectName: z.string().min(3),
  status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD']),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type ProjectWorkforce = z.infer<typeof projectWorkforceSchema>;
