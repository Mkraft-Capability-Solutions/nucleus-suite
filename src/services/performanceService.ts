/**
 * Performance Calibration & Talent Matrix Domain Service (PRF)
 * Supports:
 * - OKRs & Goal Setting (FRM-PRF-01)
 * - 360-Degree Feedback & Appraisals (FRM-PRF-02)
 * - 9-Box Talent Calibration Matrix (FRM-PRF-03)
 * - Performance Improvement Plans (PIP)
 */

export interface GoalOKR {
  id: string;
  employeeId: string;
  cycle: string; // e.g., '2026-H1' | '2026-Q3'
  title: string;
  category: 'Strategic' | 'Operational' | 'Innovation' | 'Personal Development';
  targetMetric: string;
  currentProgress: number; // 0-100%
  weightage: number; // Percentage, sum to 100
  status: 'Draft' | 'Active' | 'Under Review' | 'Completed' | 'Deferred';
  dueDate: string;
}

export interface AppraisalReview {
  id: string;
  employeeId: string;
  employeeName: string;
  cycle: string;
  selfScore: number; // 1-5
  managerScore: number; // 1-5
  peerScore: number; // 1-5
  finalCalibratedScore: number; // 1-5
  potentialRating: 'Low' | 'Medium' | 'High';
  performanceRating: 'Needs Improvement' | 'Meets Expectations' | 'Exceeds Expectations' | 'Outstanding';
  nineBoxPosition: 'Enigma' | 'Future Leader' | 'Star' | 'Dilemma' | 'Core Player' | 'High Performer' | 'Underperformer' | 'Effective' | 'Solid Professional';
  status: 'Self Submitted' | 'Manager Reviewed' | 'HR Calibrated' | 'Published';
  completedAt?: string;
}

export interface PIPRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  managerId: string;
  reason: string;
  milestones: { title: string; targetDate: string; isCompleted: boolean }[];
  durationDays: number;
  startDate: string;
  reviewDate: string;
  outcome: 'Pending' | 'Successfully Exited' | 'Extended' | 'Separation Initiated';
}

const mockReviews: AppraisalReview[] = [
  {
    id: 'APR-2026-001',
    employeeId: 'AST-1042',
    employeeName: 'Dr. Priya Sundaram',
    cycle: '2026-H1',
    selfScore: 4.8,
    managerScore: 4.9,
    peerScore: 4.7,
    finalCalibratedScore: 4.85,
    potentialRating: 'High',
    performanceRating: 'Outstanding',
    nineBoxPosition: 'Star',
    status: 'HR Calibrated',
    completedAt: '2026-08-30T10:00:00Z'
  },
  {
    id: 'APR-2026-002',
    employeeId: 'AST-1108',
    employeeName: 'Vikramaditya Rao',
    cycle: '2026-H1',
    selfScore: 4.5,
    managerScore: 4.6,
    peerScore: 4.4,
    finalCalibratedScore: 4.55,
    potentialRating: 'High',
    performanceRating: 'Exceeds Expectations',
    nineBoxPosition: 'Future Leader',
    status: 'HR Calibrated',
    completedAt: '2026-08-28T14:20:00Z'
  },
  {
    id: 'APR-2026-003',
    employeeId: 'AST-1249',
    employeeName: 'Aarav Patel',
    cycle: '2026-H1',
    selfScore: 3.8,
    managerScore: 3.9,
    peerScore: 3.7,
    finalCalibratedScore: 3.8,
    potentialRating: 'Medium',
    performanceRating: 'Meets Expectations',
    nineBoxPosition: 'Core Player',
    status: 'Published',
    completedAt: '2026-08-25T16:00:00Z'
  }
];

export class PerformanceService {
  private static goals: GoalOKR[] = [];
  private static reviews: AppraisalReview[] = [...mockReviews];
  private static pips: PIPRecord[] = [];

  public static async getGoals(employeeId?: string): Promise<GoalOKR[]> {
    if (employeeId) {
      return this.goals.filter(g => g.employeeId === employeeId);
    }
    return [...this.goals];
  }

  public static async createGoal(goal: Omit<GoalOKR, 'id'>): Promise<GoalOKR> {
    const newGoal: GoalOKR = {
      ...goal,
      id: `GOL-${Date.now()}`
    };
    this.goals.push(newGoal);
    return newGoal;
  }

  public static async updateGoalProgress(goalId: string, progress: number): Promise<GoalOKR | null> {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return null;
    goal.currentProgress = Math.min(100, Math.max(0, progress));
    if (goal.currentProgress === 100) goal.status = 'Completed';
    return goal;
  }

  public static async getAppraisalReviews(cycle = '2026-H1'): Promise<AppraisalReview[]> {
    return this.reviews.filter(r => r.cycle === cycle);
  }

  public static async updateCalibration(
    reviewId: string,
    updates: Partial<Pick<AppraisalReview, 'finalCalibratedScore' | 'nineBoxPosition' | 'potentialRating' | 'performanceRating' | 'status'>>
  ): Promise<AppraisalReview | null> {
    const review = this.reviews.find(r => r.id === reviewId);
    if (!review) return null;
    Object.assign(review, updates);
    return review;
  }

  public static async initiatePIP(pip: Omit<PIPRecord, 'id' | 'outcome'>): Promise<PIPRecord> {
    const newPip: PIPRecord = {
      ...pip,
      id: `PIP-${Date.now()}`,
      outcome: 'Pending'
    };
    this.pips.push(newPip);
    return newPip;
  }

  public static async getActivePIPs(): Promise<PIPRecord[]> {
    return this.pips.filter(p => p.outcome === 'Pending');
  }
}

export default PerformanceService;
