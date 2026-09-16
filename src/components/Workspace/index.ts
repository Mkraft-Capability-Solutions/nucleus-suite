/**
 * Clean Enterprise Workspace Component Architecture
 * Provides standardized domain-grouped exports while preserving backward compatibility.
 */

// Domain Views
export { default as PeopleCoreView } from './PeopleCoreView';
export { default as AttendanceView } from './AttendanceView';
export { default as PayrollView } from './PayrollView';
export { default as LeaveView } from './LeaveView';
export { default as ComplianceView } from './ComplianceView';
export { default as RecruitmentView } from './RecruitmentView';
export { default as OnboardingView } from './OnboardingView';
export { default as SettingsView } from './SettingsView';
export { default as OperationalModuleView } from './OperationalModuleView';
export { default as CatalogGridView } from './CatalogGridView';

// Workspace Navigation
export { default as TopNav } from './TopNav';
export { default as LeftDock } from './LeftDock';
export { default as RightSubNav } from './RightSubNav';

// Modals & Entity Creation Wizards
export { default as EmployeeCreationWizard } from './EmployeeCreationWizard';
export { default as EmployeeDossierModal } from './EmployeeDossierModal';
export { default as AccessControlModal } from '../Dashboard/Modals/AccessControlModal';
export { default as ActionFormModal } from './ActionFormModal';
export { default as BulkOnboardingModal } from './BulkOnboardingModal';

// Intelligence & Productivity Panels
export { default as AIPanel } from './AIPanel';
export { default as ChatPanel } from './ChatPanel';
export { default as VoiceNavigator } from '../VoiceNavigator';
