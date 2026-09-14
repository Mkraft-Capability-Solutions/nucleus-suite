/**
 * Project Pods & Billable Workforce Utilization Domain Service (PRJ)
 * Supports:
 * - Project Pod Allocation & Staffing (FRM-PRJ-01)
 * - Billable vs Non-Billable Headcount Tracking
 * - Client Deliverable Milestones & Capacity Planning
 */

export interface ProjectPod {
  id: string;
  projectCode: string;
  name: string;
  clientName: string;
  podLeadId: string;
  podLeadName: string;
  department: string;
  totalHeadcount: number;
  permanentCount: number;
  contractorCount: number;
  billableUtilizationPercent: number; // 0-100%
  startDate: string;
  endDate: string;
  healthStatus: 'On Track' | 'At Risk' | 'Delayed' | 'Completed';
}

export interface PodMemberAllocation {
  id: string;
  podId: string;
  employeeId: string;
  employeeName: string;
  roleInPod: string;
  allocationPercent: number; // e.g. 100% or 50%
  isBillable: boolean;
  startDate: string;
  endDate: string;
}

const mockPods: ProjectPod[] = [
  {
    id: 'POD-01',
    projectCode: 'PRJ-AVIONICS-V4',
    name: 'Asteria Flight Core NextGen',
    clientName: 'Global AeroSpace Dynamics',
    podLeadId: 'AST-1042',
    podLeadName: 'Dr. Priya Sundaram',
    department: 'Engineering & Architecture',
    totalHeadcount: 28,
    permanentCount: 22,
    contractorCount: 6,
    billableUtilizationPercent: 92.5,
    startDate: '2026-01-15',
    endDate: '2026-12-31',
    healthStatus: 'On Track'
  },
  {
    id: 'POD-02',
    projectCode: 'PRJ-ORBIT-AI',
    name: 'Orbital Telemetry Stream ML Engine',
    clientName: 'SpaceGov Defense Systems',
    podLeadId: 'AST-1108',
    podLeadName: 'Vikramaditya Rao',
    department: 'Analytics & AI',
    totalHeadcount: 14,
    permanentCount: 10,
    contractorCount: 4,
    billableUtilizationPercent: 96.0,
    startDate: '2026-03-01',
    endDate: '2026-11-30',
    healthStatus: 'On Track'
  }
];

export class ProjectWorkforceService {
  private static pods: ProjectPod[] = [...mockPods];
  private static allocations: PodMemberAllocation[] = [];

  public static async getPods(): Promise<ProjectPod[]> {
    return [...this.pods];
  }

  public static async getPodById(id: string): Promise<ProjectPod | null> {
    return this.pods.find(p => p.id === id) || null;
  }

  public static async getPodAllocations(podId: string): Promise<PodMemberAllocation[]> {
    return this.allocations.filter(a => a.podId === podId);
  }

  public static async allocateMemberToPod(allocation: Omit<PodMemberAllocation, 'id'>): Promise<PodMemberAllocation> {
    const newAllocation: PodMemberAllocation = {
      ...allocation,
      id: `ALC-${Date.now()}`
    };
    this.allocations.push(newAllocation);
    return newAllocation;
  }

  public static async getUtilizationSummary(): Promise<{ overallUtilizationPercent: number; totalBillableHeadcount: number; totalBenchHeadcount: number }> {
    return {
      overallUtilizationPercent: 91.8,
      totalBillableHeadcount: 842,
      totalBenchHeadcount: 48
    };
  }
}

export default ProjectWorkforceService;
