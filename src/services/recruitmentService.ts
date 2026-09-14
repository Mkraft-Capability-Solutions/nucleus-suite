/**
 * Talent Acquisition & Recruitment Domain Service (REC)
 * Provides business logic, validation, and data persistence interfaces for:
 * - Job Requisitions (FRM-REC-01)
 * - Candidate Pipeline & Stages (FRM-REC-02)
 * - Interview Scorecards & Evaluation (FRM-REC-03)
 * - Offer Letter Generation & Approvals
 */

export interface JobRequisition {
  id: string;
  reqCode: string;
  title: string;
  department: string;
  location: string;
  hiringManager: string;
  openPositions: number;
  filledPositions: number;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  employmentType: 'Full-time' | 'Contract' | 'Intern' | 'Part-time';
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  status: 'Draft' | 'Pending Approval' | 'Open' | 'On Hold' | 'Closed';
  targetDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateApplicant {
  id: string;
  reqId: string;
  fullName: string;
  email: string;
  phone: string;
  currentCompany: string;
  currentDesignation: string;
  experienceYears: number;
  stage: 'Applied' | 'Screening' | 'Technical Round 1' | 'Technical Round 2' | 'HR Round' | 'Offer Extended' | 'Hired' | 'Rejected';
  rating: number; // 1-5
  aiMatchScore: number; // 0-100%
  skills: string[];
  resumeUrl?: string;
  appliedDate: string;
  lastUpdated: string;
}

export interface InterviewScorecard {
  id: string;
  candidateId: string;
  interviewerName: string;
  roundName: string;
  technicalCompetency: number; // 1-5
  cultureFit: number; // 1-5
  problemSolving: number; // 1-5
  communication: number; // 1-5
  overallRecommendation: 'Strong Hire' | 'Hire' | 'Hold' | 'Reject';
  strengths: string[];
  growthAreas: string[];
  detailedFeedback: string;
  completedAt: string;
}

export interface JobOffer {
  id: string;
  candidateId: string;
  reqId: string;
  baseSalary: number;
  variablePay: number;
  joiningBonus: number;
  equityUnits?: number;
  offeredDesignation: string;
  proposedJoiningDate: string;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  candidateAcceptance: 'Pending' | 'Accepted' | 'Declined';
  offerLetterUrl?: string;
  createdAt: string;
}

// Initial Mock Records
const mockRequisitions: JobRequisition[] = [
  {
    id: 'REQ-001',
    reqCode: 'REQ-ENG-2026-08',
    title: 'Senior Flight Software Engineer',
    department: 'Engineering & Architecture',
    location: 'Bengaluru Campus (HQ)',
    hiringManager: 'Dr. Priya Sundaram',
    openPositions: 3,
    filledPositions: 1,
    salaryMin: 2800000,
    salaryMax: 4200000,
    currency: 'INR',
    employmentType: 'Full-time',
    experienceLevel: 'Senior',
    status: 'Open',
    targetDate: '2026-10-31',
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-09-10T14:30:00Z',
  },
  {
    id: 'REQ-002',
    reqCode: 'REQ-DS-2026-12',
    title: 'Principal Telemetry AI Specialist',
    department: 'Analytics & AI',
    location: 'Pune Tech Park',
    hiringManager: 'Vikramaditya Rao',
    openPositions: 2,
    filledPositions: 0,
    salaryMin: 3500000,
    salaryMax: 5500000,
    currency: 'INR',
    employmentType: 'Full-time',
    experienceLevel: 'Lead',
    status: 'Open',
    targetDate: '2026-11-15',
    createdAt: '2026-08-15T11:00:00Z',
    updatedAt: '2026-09-08T16:00:00Z',
  },
  {
    id: 'REQ-003',
    reqCode: 'REQ-OPS-2026-03',
    title: 'Enterprise Payroll Compliance Lead',
    department: 'Finance, Tax & Legal',
    location: 'Hyderabad R&D Hub',
    hiringManager: 'Meera Nambiar',
    openPositions: 1,
    filledPositions: 1,
    salaryMin: 2200000,
    salaryMax: 3000000,
    currency: 'INR',
    employmentType: 'Full-time',
    experienceLevel: 'Senior',
    status: 'Closed',
    targetDate: '2026-09-01',
    createdAt: '2026-07-10T10:00:00Z',
    updatedAt: '2026-09-01T17:00:00Z',
  }
];

const mockCandidates: CandidateApplicant[] = [
  {
    id: 'CAN-101',
    reqId: 'REQ-001',
    fullName: 'Ananya Deshmukh',
    email: 'ananya.deshmukh@example.com',
    phone: '+91 98765 43210',
    currentCompany: 'SkyOrbit Systems',
    currentDesignation: 'Lead Embedded C++ Engineer',
    experienceYears: 7.5,
    stage: 'Technical Round 2',
    rating: 4.8,
    aiMatchScore: 94,
    skills: ['C++', 'Rust', 'Real-Time OS (RTOS)', 'Telemetry Architecture'],
    appliedDate: '2026-08-20',
    lastUpdated: '2026-09-12'
  },
  {
    id: 'CAN-102',
    reqId: 'REQ-001',
    fullName: 'Rohan Mehra',
    email: 'rohan.mehra@example.com',
    phone: '+91 98111 22334',
    currentCompany: 'AeroDynamics Global',
    currentDesignation: 'Senior Firmware Developer',
    experienceYears: 6.0,
    stage: 'Offer Extended',
    rating: 4.9,
    aiMatchScore: 96,
    skills: ['Embedded C', 'FPGA', 'Fault-Tolerant Systems', 'CAN Bus'],
    appliedDate: '2026-08-12',
    lastUpdated: '2026-09-14'
  }
];

export class RecruitmentService {
  private static requisitions: JobRequisition[] = [...mockRequisitions];
  private static candidates: CandidateApplicant[] = [...mockCandidates];
  private static scorecards: InterviewScorecard[] = [];
  private static offers: JobOffer[] = [];

  // --- REQUISITIONS ---
  public static async getRequisitions(filters?: { department?: string; status?: string }): Promise<JobRequisition[]> {
    let list = [...this.requisitions];
    if (filters?.department && filters.department !== 'All') {
      list = list.filter(r => r.department === filters.department);
    }
    if (filters?.status && filters.status !== 'All') {
      list = list.filter(r => r.status === filters.status);
    }
    return list;
  }

  public static async createRequisition(data: Omit<JobRequisition, 'id' | 'reqCode' | 'filledPositions' | 'createdAt' | 'updatedAt'>): Promise<JobRequisition> {
    const nextNum = this.requisitions.length + 1;
    const newReq: JobRequisition = {
      ...data,
      id: `REQ-${String(nextNum).padStart(3, '0')}`,
      reqCode: `REQ-${data.department.substring(0, 3).toUpperCase()}-2026-${String(nextNum).padStart(2, '0')}`,
      filledPositions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.requisitions.unshift(newReq);
    return newReq;
  }

  // --- CANDIDATES ---
  public static async getCandidates(reqId?: string): Promise<CandidateApplicant[]> {
    if (reqId) {
      return this.candidates.filter(c => c.reqId === reqId);
    }
    return [...this.candidates];
  }

  public static async updateCandidateStage(candidateId: string, stage: CandidateApplicant['stage']): Promise<CandidateApplicant | null> {
    const candidate = this.candidates.find(c => c.id === candidateId);
    if (!candidate) return null;
    candidate.stage = stage;
    candidate.lastUpdated = new Date().toISOString().split('T')[0];
    return candidate;
  }

  // --- SCORECARDS ---
  public static async submitScorecard(scorecard: Omit<InterviewScorecard, 'id' | 'completedAt'>): Promise<InterviewScorecard> {
    const newScorecard: InterviewScorecard = {
      ...scorecard,
      id: `SCR-${Date.now()}`,
      completedAt: new Date().toISOString()
    };
    this.scorecards.push(newScorecard);
    return newScorecard;
  }

  public static async getScorecardsForCandidate(candidateId: string): Promise<InterviewScorecard[]> {
    return this.scorecards.filter(s => s.candidateId === candidateId);
  }

  // --- OFFERS ---
  public static async generateOffer(offer: Omit<JobOffer, 'id' | 'approvalStatus' | 'candidateAcceptance' | 'createdAt'>): Promise<JobOffer> {
    const newOffer: JobOffer = {
      ...offer,
      id: `OFF-${Date.now()}`,
      approvalStatus: 'Pending',
      candidateAcceptance: 'Pending',
      createdAt: new Date().toISOString()
    };
    this.offers.push(newOffer);
    return newOffer;
  }

  public static async updateOfferStatus(offerId: string, status: JobOffer['approvalStatus']): Promise<JobOffer | null> {
    const offer = this.offers.find(o => o.id === offerId);
    if (!offer) return null;
    offer.approvalStatus = status;
    return offer;
  }
}

export default RecruitmentService;
