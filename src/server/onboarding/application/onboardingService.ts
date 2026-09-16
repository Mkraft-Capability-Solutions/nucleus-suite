import { sqlClient } from '@/lib/db';
import { onboardingInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { OnboardingCandidate } from '../core/models';

export class OnboardingService {
  
  public static async getOnboardingPipeline(tenantId: string): Promise<OnboardingCandidate[]> {
    const records = await sqlClient
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.tenantId, tenantId));
      
    // Transform dates to strings to match the API contract
    return records.map(r => ({
      ...r,
      joiningDate: r.joiningDate,
      createdAt: r.createdAt.toISOString(),
      documentsSubmitted: r.documentsSubmitted as { documentType: string; fileName: string; isVerified: boolean }[],
      itChecklist: r.itChecklist as { item: string; isProvisioned: boolean }[],
      status: r.status as any,
      bgvStatus: r.bgvStatus as any
    }));
  }

  public static async getCandidateById(tenantId: string, id: string): Promise<OnboardingCandidate | null> {
    const [record] = await sqlClient
      .select()
      .from(onboardingInstances)
      .where(and(
        eq(onboardingInstances.id, id),
        eq(onboardingInstances.tenantId, tenantId)
      ))
      .limit(1);

    if (!record) return null;

    return {
      ...record,
      joiningDate: record.joiningDate,
      createdAt: record.createdAt.toISOString(),
      documentsSubmitted: record.documentsSubmitted as { documentType: string; fileName: string; isVerified: boolean }[],
      itChecklist: record.itChecklist as { item: string; isProvisioned: boolean }[],
      status: record.status as any,
      bgvStatus: record.bgvStatus as any
    };
  }

  public static async verifyDocument(tenantId: string, candidateId: string, documentType: string, isVerified: boolean): Promise<OnboardingCandidate | null> {
    const candidate = await this.getCandidateById(tenantId, candidateId);
    if (!candidate) return null;

    const doc = candidate.documentsSubmitted.find(d => d.documentType === documentType);
    if (doc) doc.isVerified = isVerified;

    const totalDocs = candidate.documentsSubmitted.length;
    const verifiedDocs = candidate.documentsSubmitted.filter(d => d.isVerified).length;
    
    let newStatus = candidate.status;
    if (verifiedDocs === totalDocs && candidate.status === 'Documents Under Review') {
      newStatus = 'BGV Initiated';
    }

    const [updatedRecord] = await sqlClient
      .update(onboardingInstances)
      .set({
        documentsSubmitted: candidate.documentsSubmitted,
        status: newStatus,
        updatedAt: new Date()
      })
      .where(and(
        eq(onboardingInstances.id, candidateId),
        eq(onboardingInstances.tenantId, tenantId)
      ))
      .returning();

    return {
      ...updatedRecord,
      joiningDate: updatedRecord.joiningDate,
      createdAt: updatedRecord.createdAt.toISOString(),
      documentsSubmitted: updatedRecord.documentsSubmitted as any,
      itChecklist: updatedRecord.itChecklist as any,
      status: updatedRecord.status as any,
      bgvStatus: updatedRecord.bgvStatus as any
    };
  }

  public static async toggleITProvisionItem(tenantId: string, candidateId: string, item: string, isProvisioned: boolean): Promise<OnboardingCandidate | null> {
    const candidate = await this.getCandidateById(tenantId, candidateId);
    if (!candidate) return null;

    const checklistItem = candidate.itChecklist.find(i => i.item === item);
    if (checklistItem) checklistItem.isProvisioned = isProvisioned;

    const allIT = candidate.itChecklist.every(i => i.isProvisioned);
    
    let newStatus = candidate.status;
    if (allIT && candidate.bgvStatus === 'Clear') {
      newStatus = 'Orientation Ready';
    }

    const [updatedRecord] = await sqlClient
      .update(onboardingInstances)
      .set({
        itChecklist: candidate.itChecklist,
        status: newStatus,
        updatedAt: new Date()
      })
      .where(and(
        eq(onboardingInstances.id, candidateId),
        eq(onboardingInstances.tenantId, tenantId)
      ))
      .returning();

    return {
      ...updatedRecord,
      joiningDate: updatedRecord.joiningDate,
      createdAt: updatedRecord.createdAt.toISOString(),
      documentsSubmitted: updatedRecord.documentsSubmitted as any,
      itChecklist: updatedRecord.itChecklist as any,
      status: updatedRecord.status as any,
      bgvStatus: updatedRecord.bgvStatus as any
    };
  }

  public static async getOnboardingStats(tenantId: string): Promise<{ totalInPipeline: number; joiningThisMonth: number; avgTimeToOnboardDays: number }> {
    const records = await sqlClient
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.tenantId, tenantId));

    return {
      totalInPipeline: records.length,
      joiningThisMonth: records.filter(r => new Date(r.joiningDate).getMonth() === new Date().getMonth()).length,
      avgTimeToOnboardDays: 12.4 // Placeholder for more complex analytics logic
    };
  }
}
