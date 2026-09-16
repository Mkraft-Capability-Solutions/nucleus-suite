import { sqlClient } from '@/lib/db';
import { jobRequisitions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { JobRequisition, jobRequisitionSchema } from '../core/models';

export class RecruitmentService {
  
  public static async getOpenRequisitions(tenantId: string) {
    const records = await sqlClient
      .select()
      .from(jobRequisitions)
      .where(and(
        eq(jobRequisitions.tenantId, tenantId),
        eq(jobRequisitions.status, 'OPEN')
      ));
      
    return records;
  }

  public static async createRequisition(tenantId: string, input: Omit<JobRequisition, 'tenantId'>) {
    const payload = jobRequisitionSchema.parse({ ...input, tenantId });

    const [savedRecord] = await sqlClient.insert(jobRequisitions).values({
      tenantId: payload.tenantId,
      title: payload.title,
      department: payload.department,
      status: payload.status,
    } as any).returning();

    return savedRecord;
  }
}
