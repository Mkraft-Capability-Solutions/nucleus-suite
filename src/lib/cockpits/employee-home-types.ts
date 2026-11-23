/** Employee Home (S8) payload, shared by the cockpit service and its screen. */
import type { Source } from "@/lib/cockpits/source-types";

export type AttendanceMatrix = { rows: string[]; columns: string[]; values: Array<Array<number | null>> };

export type ShiftPanel = {
  shiftCode: string | null;
  shiftName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  targetMinutes: number | null;
  workedMinutes: number | null;
  breakMinutes: number | null;
  punchedInAt: string | null;
  sessionOpen: boolean;
};

export type LeaveRing = { label: string; value: number; max?: number };

export type PayPanel = {
  period: string;
  periodLabel: string;
  isCurrentPeriod: boolean;
  displayCode: string;
  currency: string;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
  state: string;
};

export type WeekPanel = {
  weekStart: string;
  days: Array<{ date: string; weekday: string; minutes: number | null }>;
  totalMinutes: number;
  targetMinutes: number | null;
  targetBasis: string | null;
  projects: Array<{ label: string; minutes: number }>;
};

export type GoalRow = {
  id: string;
  title: string;
  progressPct: number | null;
  health: string;
  keyResultCount: number;
};

export type LearningRow = {
  id: string;
  courseTitle: string;
  stateLabel: string;
  dueDate: string | null;
  overdue: boolean;
  daysOverdue: number | null;
  pathLabel: string;
};

export type PodMember = {
  employeeId: string;
  name: string;
  designation: string;
  /**
   * null when this account may not see that colleague's attendance, or when
   * attendance has recorded nothing for them today. Never false by default:
   * an unknown reading must not render as "not present".
   */
  presentToday: boolean | null;
};

export type EmployeeProfile = { name: string; employeeCode: string; designation: string; department: string; location: string };

export type ReportingLine = { manager: { employeeId: string | null; name: string } | null; pod: PodMember[] };

export type EmployeeHomeData = {
  linked: boolean;
  message: string | null;
  employeeId: string | null;
  today: string;
  period: string;
  profile: Source<EmployeeProfile | null>;
  shift: Source<ShiftPanel>;
  leave: Source<{ rings: LeaveRing[]; totalAvailable: number }>;
  pay: Source<PayPanel | null>;
  week: Source<WeekPanel>;
  attendance: Source<AttendanceMatrix>;
  goals: Source<GoalRow[]>;
  learning: Source<LearningRow[]>;
  reportingLine: Source<ReportingLine>;
  unavailableSources: Array<{ name: string; message: string }>;
};
