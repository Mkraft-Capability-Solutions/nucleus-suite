/** Attendance Intelligence (S3) payload, shared by the cockpit service and its screen. */

export type OvertimeBand = "within" | "watch" | "breach";

export type TrendPoint = { label: string; left: number; right: number };
export type RadarPoint = { axis: string; current: number; comparison: number };
export type OvertimeBurnRow = { label: string; hours: number; band: OvertimeBand; entries: number };
export type CoverageRow = {
  key: string;
  band: string;
  shiftCode: string;
  site: string;
  rostered: number;
  required: number | null;
  deficit: number | null;
};

export type AttendanceIntelligenceData = {
  period: { today: string; from: string; to: string; label: string; previousLabel: string };
  kpis: {
    presentToday: number | null;
    absentToday: number | null;
    notRecordedToday: number | null;
    headcount: number | null;
    lateToday: number | null;
    lateNote: string;
    overtimeHours: number | null;
    overtimeEntries: number;
    available: boolean;
    message?: string;
    origin: string;
  };
  trend: { points: TrendPoint[]; available: boolean; message?: string; origin: string; note: string };
  punctuality: {
    axes: RadarPoint[];
    groupedBy: "location" | "department";
    currentLabel: string;
    comparisonLabel: string;
    available: boolean;
    message?: string;
    origin: string;
    note: string;
  };
  overtime: { rows: OvertimeBurnRow[]; available: boolean; message?: string; origin: string; note: string };
  coverage: {
    rows: CoverageRow[];
    available: boolean;
    message?: string;
    origin: string;
    note: string;
    requirementNote: string;
  };
  unavailableSources: Array<{ name: string; message: string }>;
};
