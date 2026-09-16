import { sqlClient } from '@/lib/db';
import { performanceReviews } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { PerformanceReview, performanceReviewSchema } from '../core/models';

export class PerformanceService {
  
  public static async getReviewsForEmployee(tenantId: string, employeeId: string) {
    const records = await sqlClient
      .select()
      .from(performanceReviews)
      .where(and(
        eq(performanceReviews.tenantId, tenantId),
        eq(performanceReviews.employeeId, employeeId as any) // Assuming UUID typing issues bypass
      ));
      
    return records;
  }

  public static async submitReview(tenantId: string, input: Omit<PerformanceReview, 'tenantId'>) {
    const payload = performanceReviewSchema.parse({ ...input, tenantId });

    const [savedRecord] = await sqlClient.insert(performanceReviews).values({
      tenantId: payload.tenantId,
      employeeId: payload.employeeId,
      cycle: payload.cycle,
      rating: payload.rating,
    } as any).returning();

    return savedRecord;
  }
}
