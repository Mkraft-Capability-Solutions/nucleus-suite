import { z } from 'zod';

export const performanceReviewSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  cycle: z.string().min(1),
  rating: z.number().min(1).max(5),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type PerformanceReview = z.infer<typeof performanceReviewSchema>;
