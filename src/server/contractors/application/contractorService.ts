import { sqlClient } from '@/lib/db';
import { contractorWorkforce } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Contractor, contractorSchema } from '../core/models';

export class ContractorService {
  
  public static async getActiveContractors(tenantId: string) {
    const records = await sqlClient
      .select()
      .from(contractorWorkforce)
      .where(and(
        eq(contractorWorkforce.tenantId, tenantId),
        eq(contractorWorkforce.status, 'ACTIVE')
      ));
      
    return records;
  }

  public static async onboardContractor(tenantId: string, input: Omit<Contractor, 'tenantId'>) {
    const payload = contractorSchema.parse({ ...input, tenantId });

    const [savedRecord] = await sqlClient.insert(contractorWorkforce).values({
      tenantId: payload.tenantId,
      contractorName: payload.contractorName,
      agencyId: payload.agencyId,
      status: payload.status,
    } as any).returning();

    return savedRecord;
  }
}
