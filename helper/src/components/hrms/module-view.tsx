import { notFound } from "next/navigation";
import {
  CompensationPage,
  InsightsPage,
  PerformancePage,
  TalentPage,
} from "./capability-pages";
import { Dashboard } from "./dashboard";
import {
  EngagementPage,
  OnboardingPage,
  OrganizationPage,
  PeoplePage,
} from "./people-pages";
import {
  AssistantPage,
  CompliancePage,
  InboxPage,
  IntegrationsPage,
  SettingsPage,
} from "./platform-pages";
import { AttendancePage, LeavePage, LoansPage, PayrollPage } from "./work-pages";
import { HelpdeskPage } from "./helpdesk-page";
import { NucleusAiPage } from "./nucleus-ai-page";
import {
  AssetRegisterPage,
  ClearanceBoardPage,
  DocumentVaultPage,
  EmployeeHomeActionsPage,
  EmployeeRecordPage,
  JoiningChainConsolePage,
  LettersIssueRegisterPage,
  PolicyAcknowledgementsPage,
} from "./people-lifecycle-registers";
import {
  AttendanceDayDetailPage,
  CheckInOutPage,
  GatePassRegisterPage,
  MyAttendanceHistoryPage,
} from "./attendance-punch-registers";
import { BreakRegisterPage } from "./attendance-break-register";
import {
  AttendanceExceptionQueuePage,
  AttendanceRecomputeMonitorPage,
  OvertimeRegisterPage,
  TeamHistoryPage,
} from "./attendance-ops-registers";
import {
  LeaveBalanceLedgerPage,
  LeavePolicyConfigurationPage,
  LeaveRequestsPage,
} from "./attendance-leave-registers";
import {
  AccessScopeAdministrationPage,
  AssignmentPolicyAttributesPage,
  PositionRegisterPage,
  SanctionedStrengthBoardPage,
  StatutoryCompliancePage,
} from "./org-registers";
import { PayrollRunCockpitPage } from "./payroll-run-cockpit-page";
import { PrePayrollAuditPage } from "./pre-payroll-audit-page";
import { PayslipsPage } from "./payslips-page";
import { LoansAdvancesPage } from "./loans-advances-page";
import { GlMappingPage } from "./gl-mapping-page";
import { InternalMobilityPage } from "./internal-mobility-page";
import { PayrollAccountingPage } from "./payroll-accounting-page";
import { SettlementProposalsPage } from "./settlement-proposals-page";
import { ReimbursementClaimsPage } from "./reimbursement-claims-page";
import { RequisitionsPage } from "./requisitions-page";
import { ReferralTrackingPage } from "./referral-tracking-page";
import { MyLearningPage } from "./my-learning-page";
import { AnnouncementsPage } from "./announcements-page";
import { RecognitionRegisterPage } from "./recognition-register-page";
import { StatutoryPage } from "./statutory-page";
import { LearningDevelopmentPage } from "./learning-development-page";
import { TalentAcquisitionPage } from "./talent-acquisition-page";
import { PerformanceOkrPage } from "./performance-okr-page";
import { EmployeeExperiencePage } from "./employee-experience-page";
import { TaxDeclarationPage } from "./tax-declaration-page";
import { BankDisbursementPage } from "./bank-disbursement-page";
import { FullFinalPage } from "./full-final-page";
import { SalarySimulatorPage } from "./salary-simulator-page";
import { PayrollReconciliationPage } from "./payroll-reconciliation-page";
import { VpReadinessPage } from "./vp-readiness-page";
import { ContractorsOverview, WorkflowWorkspace } from "./workflow-workspace";
import { ModuleAccessGuard } from "./module-access-guard";
import { PeopleCommandCentreCockpit } from "./cockpits/people-command-centre-cockpit";
import { HrOperationsConsoleCockpit } from "./cockpits/hr-operations-console-cockpit";
import { AttendanceIntelligenceCockpit } from "./cockpits/attendance-intelligence-cockpit";
import { TalentAcquisitionCommandCockpit } from "./cockpits/talent-acquisition-command-cockpit";
import { PayrollControlRoomCockpit } from "./cockpits/payroll-control-room-cockpit";
import { PerformanceCalibrationCockpit } from "./cockpits/performance-calibration-cockpit";
import { ManagerCockpitCockpit } from "./cockpits/manager-cockpit-cockpit";
import { EmployeeHomeCockpit } from "./cockpits/employee-home-cockpit";
import { CapabilityIntelligenceCockpit } from "./cockpits/capability-intelligence-cockpit";
import { NucleusIntelligenceCockpit } from "./cockpits/nucleus-intelligence-cockpit";
import { RostersPage } from "./workforce/rosters-page";
import { ProjectsPage } from "./workforce/projects-page";
import { FieldWorkforcePage } from "./workforce/field-workforce-page";
import { AssetsPage } from "./workforce/assets-page";
import { TravelPage } from "./workforce/travel-page";
import { TimesheetsPage } from "./workforce/timesheets-page";
import { UnifiedApprovalInboxPage } from "./workforce/approval-inbox-page";

export const modules = [
  "accounting", "statutory", "settlements", "helpdesk", "projects", "travel", "timesheets", "assets", "rosters", "mobility", "field-workforce", "approval-inbox",
  "people-command-centre", "hr-operations-console", "attendance-intelligence", "talent-acquisition-command", "payroll-control-room", "performance-calibration", "manager-cockpit", "employee-home", "capability-intelligence", "nucleus-intelligence",
  "inbox", "assistant", "nucleus-ai", "people", "organization", "onboarding", "engagement",
  "attendance", "leave", "payroll", "reimbursement-claims", "loans", "performance", "talent",
  "learning", "compensation", "insights", "compliance", "integrations", "readiness", "settings", "contractors",
  "statutory-compliance", "access-scope-administration", "employee-record", "assignment-policy-attributes", "position-register", "sanctioned-strength-board", "document-vault", "joining-chain-console", "clearance-board", "asset-register", "letters-issue-register", "policy-acknowledgements", "employee-home-actions",
  "check-in-out", "my-attendance-history", "attendance-day-detail", "gate-pass-register", "overtime-register", "attendance-exception-queue", "attendance-recompute-monitor", "team-history", "break-register",
  "leave-requests", "leave-balance-ledger", "leave-policy-configuration",
  "payroll-run-cockpit", "pre-payroll-audit", "salary-structure-simulator", "payslips", "tax-declaration-projection", "bank-disbursement-control", "full-final-settlement", "gl-mapping-journal", "payroll-reconciliation", "loans-advances",
  "talent-acquisition", "performance-capability", "employee-experience",
  "recruitment-requisitions", "referral-tracking", "my-learning", "announcements", "recognition-register",
] as const;

const moduleComponents: Record<(typeof modules)[number], React.ComponentType<{ module: string }>> = {
  accounting: PayrollAccountingPage, statutory: StatutoryPage, settlements: SettlementProposalsPage, mobility: InternalMobilityPage, "reimbursement-claims": ReimbursementClaimsPage,
  "people-command-centre": PeopleCommandCentreCockpit, "hr-operations-console": HrOperationsConsoleCockpit, "attendance-intelligence": AttendanceIntelligenceCockpit, "talent-acquisition-command": TalentAcquisitionCommandCockpit, "payroll-control-room": PayrollControlRoomCockpit, "performance-calibration": PerformanceCalibrationCockpit, "manager-cockpit": ManagerCockpitCockpit, "employee-home": EmployeeHomeCockpit, "capability-intelligence": CapabilityIntelligenceCockpit, "nucleus-intelligence": NucleusIntelligenceCockpit,
  projects: ProjectsPage, travel: TravelPage, timesheets: TimesheetsPage, assets: AssetsPage, rosters: RostersPage, "field-workforce": FieldWorkforcePage, "approval-inbox": UnifiedApprovalInboxPage,
  "payroll-run-cockpit": PayrollRunCockpitPage, "pre-payroll-audit": PrePayrollAuditPage, "salary-structure-simulator": SalarySimulatorPage, "payslips": PayslipsPage, "tax-declaration-projection": TaxDeclarationPage, "bank-disbursement-control": BankDisbursementPage, "full-final-settlement": FullFinalPage, "gl-mapping-journal": GlMappingPage, "payroll-reconciliation": PayrollReconciliationPage, "loans-advances": LoansAdvancesPage,
  "talent-acquisition": TalentAcquisitionPage, "performance-capability": PerformanceOkrPage, "employee-experience": EmployeeExperiencePage,
  "recruitment-requisitions": RequisitionsPage, "referral-tracking": ReferralTrackingPage, "my-learning": MyLearningPage, "announcements": AnnouncementsPage, "recognition-register": RecognitionRegisterPage,
  helpdesk: HelpdeskPage,
  "statutory-compliance": StatutoryCompliancePage,
  "access-scope-administration": AccessScopeAdministrationPage, "assignment-policy-attributes": AssignmentPolicyAttributesPage, "position-register": PositionRegisterPage, "sanctioned-strength-board": SanctionedStrengthBoardPage,
  "employee-record": EmployeeRecordPage, "document-vault": DocumentVaultPage, "joining-chain-console": JoiningChainConsolePage, "clearance-board": ClearanceBoardPage, "asset-register": AssetRegisterPage, "letters-issue-register": LettersIssueRegisterPage, "policy-acknowledgements": PolicyAcknowledgementsPage, "employee-home-actions": EmployeeHomeActionsPage,
  "check-in-out": CheckInOutPage, "my-attendance-history": MyAttendanceHistoryPage, "attendance-day-detail": AttendanceDayDetailPage, "gate-pass-register": GatePassRegisterPage, "overtime-register": OvertimeRegisterPage, "attendance-exception-queue": AttendanceExceptionQueuePage, "attendance-recompute-monitor": AttendanceRecomputeMonitorPage, "team-history": TeamHistoryPage, "break-register": BreakRegisterPage,
  "leave-requests": LeaveRequestsPage, "leave-balance-ledger": LeaveBalanceLedgerPage, "leave-policy-configuration": LeavePolicyConfigurationPage,
  contractors: ContractorsOverview,
  inbox: InboxPage,
  assistant: AssistantPage,
  "nucleus-ai": NucleusAiPage,
  people: PeoplePage,
  organization: OrganizationPage,
  onboarding: OnboardingPage,
  engagement: EngagementPage,
  attendance: AttendancePage,
  leave: LeavePage,
  payroll: PayrollPage,
  loans: LoansPage,
  performance: PerformancePage,
  talent: TalentPage,
  learning: LearningDevelopmentPage,
  compensation: CompensationPage,
  insights: InsightsPage,
  compliance: CompliancePage,
  integrations: IntegrationsPage,
  readiness: VpReadinessPage,
  settings: SettingsPage,
};

export function ModuleView({ module, section, record }: { module: string; section?: string; record?: string }) {
  const Page = moduleComponents[module as keyof typeof moduleComponents];
  if (!Page) notFound();
  // Every module route passes through the navigation guard. It sits outside
  // WorkflowWorkspace so a blocked principal never fires the module's section
  // queries, and inside the workspace layout so the app shell stays around the
  // refusal. See module-access-guard.tsx for what it does and does not protect.
  return (
    <ModuleAccessGuard module={module}>
      <WorkflowWorkspace module={module} section={section} record={record}><Page module={module} /></WorkflowWorkspace>
    </ModuleAccessGuard>
  );
}

export { Dashboard };
