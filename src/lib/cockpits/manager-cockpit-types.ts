/** Manager Cockpit payload, shared by the cockpit service and its screen. */
import type { Source } from "@/lib/cockpits/source-types";

export type CapacityWindow = { label: string; start: string; end: string };

export type CapacityBar = { label: string; delivering: number; onLeave: number; inTraining: number };

export type TeamSkillRow = { employeeId: string; skill: string; verified: boolean };

export type SkillAxis = { axis: string; current: number; comparison: number };

export type TriageKind = "leave" | "comp-off" | "expense" | "timesheet";

export type TriageItem = {
  id: string;
  kind: TriageKind;
  kindLabel: string;
  /**
   * Operational resource for `/api/v1/operations/<resource>/<id>/<action>`.
   * Null for leave, which decides through `/api/v1/leave-requests/<id>/decide`.
   */
  resource: string | null;
  version: number;
  employeeId: string;
  employeeName: string;
  title: string;
  detail: string;
  status: string;
  amountMinor: number | null;
  currency: string | null;
  /** The operational engine rejects a transition without a reason of 3+ chars. */
  reasonRequired: boolean;
};

export type TeamMember = {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  presentToday: boolean;
  attendanceRecordedToday: boolean;
};

export type ManagerCockpitData = {
  manager: { employeeId: string | null; linked: boolean };
  today: string;
  team: Source<TeamMember[]>;
  kpis: {
    teamSize: Source<number>;
    presentToday: Source<number>;
    onLeaveToday: Source<number>;
    pendingApprovals: Source<number>;
  };
  capacity: Source<CapacityBar[]>;
  skills: Source<{ axes: SkillAxis[]; teamSize: number; sampled: number }>;
  triage: Source<TriageItem[]>;
  triageByKind: Array<{ label: string; value: number }>;
  unavailableSources: Array<{ name: string; message: string }>;
};
