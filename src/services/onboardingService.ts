/**
 * Employee Onboarding & New Hire Orchestration Domain Service (ONB)
 * Supports:
 * - Candidate Pre-Boarding & Form Submissions (FRM-ONB-01)
 * - Background Verification (BGV) Pipeline (FRM-ONB-02)
 * - IT Asset & Security Provisioning Checklist (FRM-ONB-03)
 * - Day 1 Orientation & Buddy Assignments
 */

export interface OnboardingCandidate {
  id: string;
  candidateName: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  location: string;
  joiningDate: string;
  reportingManager: string;
  buddyName: string;
  status: 'Pre-Boarding' | 'Documents Under Review' | 'BGV Initiated' | 'IT Provisioned' | 'Orientation Ready' | 'Joined' | 'Deferred';
  progressPercent: number; // 0-100
  documentsSubmitted: { documentType: string; fileName: string; isVerified: boolean }[];
  itChecklist: { item: string; isProvisioned: boolean }[];
  bgvStatus: 'Pending' | 'Clear' | 'Discrepancy' | 'Major Flag';
  createdAt: string;
}

const mockOnboardings: OnboardingCandidate[] = [
  {
    id: 'ONB-2026-01',
    candidateName: 'Tanvi Agarwal',
    email: 'tanvi.agarwal@example.com',
    phone: '+91 99887 66554',
    designation: 'Senior Avionics UI Architect',
    department: 'Engineering & Architecture',
    location: 'Bengaluru Campus (HQ)',
    joiningDate: '2026-10-01',
    reportingManager: 'Dr. Priya Sundaram',
    buddyName: 'Rohan Mehra',
    status: 'Documents Under Review',
    progressPercent: 65,
    documentsSubmitted: [
      { documentType: 'PAN Card', fileName: 'pan_card_tanvi.pdf', isVerified: true },
      { documentType: 'Aadhaar Card', fileName: 'aadhaar_tanvi.pdf', isVerified: true },
      { documentType: 'Degree Certificate', fileName: 'degree_btech.pdf', isVerified: false },
      { documentType: 'Relieving Letter', fileName: 'prev_relieving.pdf', isVerified: false }
    ],
    itChecklist: [
      { item: 'MacBook Pro M3 Max (36GB RAM)', isProvisioned: true },
      { item: 'YubiKey Security Key', isProvisioned: true },
      { item: 'GitHub Enterprise & Cloud SSO', isProvisioned: false },
      { item: 'Workspace Access Card', isProvisioned: false }
    ],
    bgvStatus: 'Clear',
    createdAt: '2026-09-01T10:00:00Z'
  },
  {
    id: 'ONB-2026-02',
    candidateName: 'Rahul Varma',
    email: 'rahul.varma@example.com',
    phone: '+91 91234 56789',
    designation: 'DevOps & Kubernetes Engineer',
    department: 'DevOps & Cloud Infra',
    location: 'Pune Tech Park',
    joiningDate: '2026-09-25',
    reportingManager: 'Vikramaditya Rao',
    buddyName: 'Sneha Roy',
    status: 'Orientation Ready',
    progressPercent: 95,
    documentsSubmitted: [
      { documentType: 'PAN Card', fileName: 'pan_rahul.pdf', isVerified: true },
      { documentType: 'Aadhaar Card', fileName: 'aadhaar_rahul.pdf', isVerified: true },
      { documentType: 'Degree Certificate', fileName: 'degree_rahul.pdf', isVerified: true },
      { documentType: 'Relieving Letter', fileName: 'relieving_rahul.pdf', isVerified: true }
    ],
    itChecklist: [
      { item: 'Dell Precision Workstation', isProvisioned: true },
      { item: 'YubiKey Security Key', isProvisioned: true },
      { item: 'GitHub Enterprise & Cloud SSO', isProvisioned: true },
      { item: 'Workspace Access Card', isProvisioned: true }
    ],
    bgvStatus: 'Clear',
    createdAt: '2026-08-20T09:30:00Z'
  }
];

export class OnboardingService {
  private static candidates: OnboardingCandidate[] = [...mockOnboardings];

  public static async getOnboardingPipeline(): Promise<OnboardingCandidate[]> {
    return [...this.candidates];
  }

  public static async getCandidateById(id: string): Promise<OnboardingCandidate | null> {
    return this.candidates.find(c => c.id === id) || null;
  }

  public static async verifyDocument(candidateId: string, documentType: string, isVerified: boolean): Promise<OnboardingCandidate | null> {
    const candidate = this.candidates.find(c => c.id === candidateId);
    if (!candidate) return null;
    const doc = candidate.documentsSubmitted.find(d => d.documentType === documentType);
    if (doc) doc.isVerified = isVerified;

    const totalDocs = candidate.documentsSubmitted.length;
    const verifiedDocs = candidate.documentsSubmitted.filter(d => d.isVerified).length;
    if (verifiedDocs === totalDocs && candidate.status === 'Documents Under Review') {
      candidate.status = 'BGV Initiated';
    }
    return candidate;
  }

  public static async toggleITProvisionItem(candidateId: string, item: string, isProvisioned: boolean): Promise<OnboardingCandidate | null> {
    const candidate = this.candidates.find(c => c.id === candidateId);
    if (!candidate) return null;
    const checklistItem = candidate.itChecklist.find(i => i.item === item);
    if (checklistItem) checklistItem.isProvisioned = isProvisioned;

    const allIT = candidate.itChecklist.every(i => i.isProvisioned);
    if (allIT && candidate.bgvStatus === 'Clear') {
      candidate.status = 'Orientation Ready';
    }
    return candidate;
  }

  public static async getOnboardingStats(): Promise<{ totalInPipeline: number; joiningThisMonth: number; avgTimeToOnboardDays: number }> {
    return {
      totalInPipeline: this.candidates.length,
      joiningThisMonth: 14,
      avgTimeToOnboardDays: 12.4
    };
  }
}

export default OnboardingService;
