/** Response shapes of the compliance routes, mirrored from src/server/compliance/** (client code cannot import server modules). */

export type DueBand = "overdue" | "due_soon" | "scheduled" | "filed" | "closed" | "unknown";

export type FilingAction = { action: string; label: string; to: string; approval: boolean; allowed: boolean; reason: string | null };

export type FilingOutcome = {
  id: string; filedOn: string | null; lateByDays: number | null; late: boolean; acknowledgementNumber: string | null;
  amountRemittedMinor: number | null; currency: string; challanReference: string | null; authority: string | null;
  evidenceDocumentId: string | null; lateFilingReason: string | null; recordedAt: string | null;
};

export type FilingRow = {
  id: string; version: number; status: string; formCode: string; stateCode: string; period: string; dueDate: string | null;
  owner: string; notes: string | null; outcome: FilingOutcome | null; band: DueBand; daysUntilDue: number | null;
  lateByDays: number | null; actions: FilingAction[];
};

export type StatutoryRegister = {
  asOf: string; scope: string; scopeNote: string | null; items: FilingRow[]; bandCounts: Record<DueBand, number>;
  remittance: { totalMinor: number | null; currency: string | null; recordedCount: number; missingCount: number; mixedCurrency: boolean; reason: string | null };
  disclaimer: string;
};

export type AccidentNotice = {
  id: string; injuredPersonName: string; tokenNo: string; employeeId: string | null; age: number | null; sex: string | null;
  occupation: string; exactPlace: string; dateOfOccurrence: string | null; timeOfOccurrence: string | null; natureOfInjury: string;
  causeOfAccident: string | null; lostWorkdays: number | null; notifiable: boolean; investigatingOfficer: string | null;
  remedialActions: string; inspectorateNotifiedOn: string | null; recordedAt: string | null;
};

export type InspectionEntry = {
  id: string; inspector: string; authority: string; visitDate: string | null; purpose: string; observations: string | null;
  remedialDirections: string | null; status: "open" | "closed"; certifyingManager: string | null; closureDate: string | null; recordedAt: string | null;
};

export type FactoryRegisters = { accidents: AccidentNotice[]; inspections: InspectionEntry[] };

export type MusterMark = "P" | "H" | "A" | "L" | "HOL" | "WO" | "PEN";
export type MusterWorker = {
  employeeId: string; tokenNo: string; name: string; sex: string | null; relay: string | null; natureOfWork: string;
  days: Array<{ day: number; mark: MusterMark; normalMinutes: number; otMinutes: number }>;
  daysPresent: number; normalMinutes: number; otMinutes: number; spreadoverBreaches: number;
};
export type MusterRoll = {
  month: string; daysInMonth: number; location: string | null;
  establishment: { name: string | null; factoryLicenceNo: string | null };
  workers: MusterWorker[];
  totals: { workers: number; normalMinutes: number; otMinutes: number; spreadoverBreaches: number; daysRecorded: number };
};

export type Nominee = { name: string; relationship: string; age: number; address?: string; sharePercent: number; contingency?: string };
export type FormFView = {
  employee: { id: string; employeeCode: string; name: string; department: string; designation: string; joiningDate: string | null; sex: string | null; maritalStatus: string | null; fatherOrSpouseName: string | null; permanentAddress: string | null };
  establishment: { name: string | null; registeredAddress: string | null; registrationNumber: string | null };
  nomineesOnRecord: Array<{ name: string; relationship: string; age: number | null; address: string | null; sharePercent: number | null }>;
  registration: null | { id: string; serial: string; version: number; registeredAt: string | null; declarationDate: string | null; nominees: Nominee[]; witnesses: Array<{ name: string }> };
};

export type ErpConnector = { id: string; code: string; environment: string | null; status: string | null; verifiedRoundTrip: boolean };
export type ErpSyncBatch = { key: string; day: string; connectionId: string | null; connector: string | null; received: number; applied: number; blocked: number; lastAt: string | null; status: "applied" | "partial" | "failed" | "pending" };
export type ErpOverview = { connectors: ErpConnector[]; syncLog: ErpSyncBatch[] };

export type GlLine = { id: string; accountCode: string; costCentre: string | null; componentCode: string; debitMinor: number; creditMinor: number; narration: string };
export type GlBatch = {
  id: string; payrollRunId: string; period: string | null; currency: string; status: string; connector: string | null;
  debitMinor: number; creditMinor: number; lineDebitMinor: number; lineCreditMinor: number; varianceMinor: number; balanced: boolean;
  acknowledgementRef: string | null; postedAt: string | null; createdAt: string | null; lines: GlLine[];
};

export type RulePackVersion = {
  versionId: string; packCode: string | null; packName: string | null; jurisdiction: string | null; stateCode: string | null;
  versionCode: string | null; effectiveFrom: string | null; supersedes: string | null; assigned: boolean; assignedFrom: string | null;
  wageFloorPercent: number | null; rateCount: number; goldenTests: { passed: number; total: number } | null; createdAt: string | null;
  attributes: Record<string, unknown>;
};
export type StateRuleRow = {
  stateCode: string; stateName: string | null; packCode: string | null; versionCode: string | null; codeOnWages: string | null;
  socialSecurityCode: string | null; minimumWageMonthlyMinor: number | null; currency: string; overtimeRule: string | null; womenNightShiftRule: string | null;
};
export type RulePacks = { versions: RulePackVersion[]; active: RulePackVersion | null; states: StateRuleRow[] };
