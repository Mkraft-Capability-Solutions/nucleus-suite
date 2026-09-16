import { sqlClient } from '@/lib/db';
import { projectWorkforce } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { ProjectWorkforce, projectWorkforceSchema } from '../core/models';

export class OpsService {
  
  public static async getActiveProjects(tenantId: string) {
    const records = await sqlClient
      .select()
      .from(projectWorkforce)
      .where(and(
        eq(projectWorkforce.tenantId, tenantId),
        eq(projectWorkforce.status, 'ACTIVE')
      ));
      
    return records;
  }

  public static async createProject(tenantId: string, input: Omit<ProjectWorkforce, 'tenantId'>) {
    const payload = projectWorkforceSchema.parse({ ...input, tenantId });

    const [savedRecord] = await sqlClient.insert(projectWorkforce).values({
      tenantId: payload.tenantId,
      projectId: payload.projectId,
      projectName: payload.projectName,
      status: payload.status,
    } as any).returning();

    return savedRecord;
  }
}
