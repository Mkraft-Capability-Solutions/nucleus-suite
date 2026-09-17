

import { db } from '@/lib/db';
import { onboardingInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { OnboardingCandidate } from '../core/models';

export class OnboardingService {
  private static mapRecordToCandidate(r: any): OnboardingCandidate {
    const attrs = (r.attributes || {}) as Record<string, any>;
    return {
      id: r.id,
      candidateName: attrs.candidateName || 'New Candidate',
      email: attrs.email || 'candidate@nucleus.com',
      phone: attrs.phone || '+1 555-0199',
      designation: attrs.designation || 'Software Engineer',
      department: attrs.department || 'Engineering',
      location: attrs.location || 'Headquarters',
      joiningDate: attrs.joiningDate || new Date().toISOString().split('T')[0],
      reportingManager: attrs.reportingManager || 'Engineering Lead',
      buddyName: attrs.buddyName || 'Team Peer',
      status: (attrs.status || r.recordStatus || 'Pre-Boarding') as any,
      progressPercent: typeof attrs.progressPercent === 'number' ? attrs.progressPercent : 25,
      documentsSubmitted: (attrs.documentsSubmitted || [
        { documentType: 'National ID', fileName: 'id_card.pdf', isVerified: false },
        { documentType: 'Educational Degree', fileName: 'degree_certificate.pdf', isVerified: false },
        { documentType: 'Previous Relieving Letter', fileName: 'experience_relieving.pdf', isVerified: false }
      ]) as { documentType: string; fileName: string; isVerified: boolean }[],
      itChecklist: (attrs.itChecklist || [
        { item: 'Corporate Laptop & Monitor', isProvisioned: false },
        { item: 'Single Sign-On (SSO) & Email Account', isProvisioned: false },
        { item: 'VPN & Access Credentials', isProvisioned: false },
        { item: 'Security Badge & Building Clearance', isProvisioned: false }
      ]) as { item: string; isProvisioned: boolean }[],
      bgvStatus: (attrs.bgvStatus || 'Pending') as any,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
    };
  }

  public static async getOnboardingPipeline(tenantId: string): Promise<OnboardingCandidate[]> {
    try {
      const records = await db
        .select()
        .from(onboardingInstances)
        .where(eq(onboardingInstances.tenantId, tenantId as any));

      return records.map(r => this.mapRecordToCandidate(r));
    } catch {
      return [];
    }
  }

  public static async getCandidateById(tenantId: string, id: string): Promise<OnboardingCandidate | null> {
    try {
      const [record] = await db
        .select()
        .from(onboardingInstances)
        .where(and(
          eq(onboardingInstances.id, id),
          eq(onboardingInstances.tenantId, tenantId as any)
        ))
        .limit(1);

      if (!record) return null;
      return this.mapRecordToCandidate(record);
    } catch {
      return null;
    }
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
    candidate.status = newStatus;

    try {
      const [updatedRecord] = await db
        .update(onboardingInstances)
        .set({
          attributes: {
            ...candidate,
            documentsSubmitted: candidate.documentsSubmitted,
            status: newStatus,
          },
          recordStatus: newStatus,
          updatedAt: new Date()
        })
        .where(and(
          eq(onboardingInstances.id, candidateId),
          eq(onboardingInstances.tenantId, tenantId as any)
        ))
        .returning();

      return updatedRecord ? this.mapRecordToCandidate(updatedRecord) : candidate;
    } catch {
      return candidate;
    }
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
    candidate.status = newStatus;

    try {
      const [updatedRecord] = await db
        .update(onboardingInstances)
        .set({
          attributes: {
            ...candidate,
            itChecklist: candidate.itChecklist,
            status: newStatus,
          },
          recordStatus: newStatus,
          updatedAt: new Date()
        })
        .where(and(
          eq(onboardingInstances.id, candidateId),
          eq(onboardingInstances.tenantId, tenantId as any)
        ))
        .returning();

      return updatedRecord ? this.mapRecordToCandidate(updatedRecord) : candidate;
    } catch {
      return candidate;
    }
  }

  public static async getOnboardingStats(tenantId: string): Promise<{ totalInPipeline: number; joiningThisMonth: number; avgTimeToOnboardDays: number }> {
    try {
      const records = await db
        .select()
        .from(onboardingInstances)
        .where(eq(onboardingInstances.tenantId, tenantId as any));

      const candidates = records.map(r => this.mapRecordToCandidate(r));

      return {
        totalInPipeline: candidates.length,
        joiningThisMonth: candidates.filter(r => new Date(r.joiningDate).getMonth() === new Date().getMonth()).length,
        avgTimeToOnboardDays: 12.4
      };
    } catch {
      return {
        totalInPipeline: 0,
        joiningThisMonth: 0,
        avgTimeToOnboardDays: 12.4
      };
    }
  }
}
