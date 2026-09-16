import { sqlClient } from '@/lib/db';
import { learningPaths } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { LearningPath, learningPathSchema } from '../core/models';

export class LearningService {
  
  public static async getMandatoryPaths(tenantId: string) {
    const records = await sqlClient
      .select()
      .from(learningPaths)
      .where(and(
        eq(learningPaths.tenantId, tenantId),
        eq((learningPaths as any).mandatory, true)
      ));
      
    return records;
  }

  public static async assignLearningPath(tenantId: string, input: Omit<LearningPath, 'tenantId'>) {
    const payload = learningPathSchema.parse({ ...input, tenantId });

    const [savedRecord] = await sqlClient.insert(learningPaths).values({
      tenantId: payload.tenantId,
      courseId: payload.courseId,
      title: payload.title,
      mandatory: payload.mandatory,
    } as any).returning();

    return savedRecord;
  }
}
