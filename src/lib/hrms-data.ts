export type Persona = {
  id: string;
  name: string;
  role: string;
  initials: string;
  accent: string;
};

export type EmployeeItem = {
  id: string;
  name: string;
  initials: string;
  role: string;
  department: string;
  location: string;
  manager: string;
  status: string;
  capability: number;
  tenure: string;
  email: string;
  accent: string;
};

export type HeadcountTrendItem = {
  month: string;
  headcount: number;
  capability: number;
};

export type DepartmentCapabilityItem = {
  name: string;
  value: number;
  fill: string;
};

export type ActivityItem = {
  title: string;
  meta: string;
  time: string;
  tone: string;
};

export type LeaveRequestItem = {
  id: string;
  name: string;
  initials: string;
  type: string;
  dates: string;
  days: number;
  coverage: string;
  risk: string;
  accent: string;
};

export type PayrollAnomalyItem = {
  id: string;
  employee: string;
  initials: string;
  issue: string;
  evidence: string;
  amount: string;
  severity: string;
};

export type CandidateItem = {
  name: string;
  role: string;
  match: number;
  stage: string;
  skills: string[];
  note: string;
};

export type OnboardingTaskItem = {
  team: string;
  task: string;
  owner: string;
  status: string;
};

export type GoalItem = {
  title: string;
  owner: string;
  progress: number;
  health: string;
};

export type AnnouncementItem = {
  label: string;
  title: string;
  copy: string;
  tone: string;
};

export { navigation } from "./navigation-catalog";

export const personas: Persona[] = [];
export const employees: EmployeeItem[] = [];
export const headcountTrend: HeadcountTrendItem[] = [];
export const departmentCapability: DepartmentCapabilityItem[] = [];
export const activities: ActivityItem[] = [];
export const leaveRequests: LeaveRequestItem[] = [];
export const payrollAnomalies: PayrollAnomalyItem[] = [];
export const candidates: CandidateItem[] = [];
export const onboardingTasks: OnboardingTaskItem[] = [];
export const goals: GoalItem[] = [];
export const announcements: AnnouncementItem[] = [];
