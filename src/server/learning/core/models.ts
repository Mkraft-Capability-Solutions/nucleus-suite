import { z } from 'zod';

export const learningPathSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  courseId: z.string().min(1),
  title: z.string().min(3),
  mandatory: z.boolean().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type LearningPath = z.infer<typeof learningPathSchema>;
