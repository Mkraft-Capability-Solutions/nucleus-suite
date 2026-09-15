/**
 * Clean Enterprise Workspace Component Architecture
 * Provides standardized domain-grouped exports while preserving backward compatibility.
 */

// Domain Views
export { default as PeopleCoreView } from '../Clerio/PeopleCoreView';
export { default as AttendanceView } from '../Clerio/AttendanceView';
export { default as PayrollView } from '../Clerio/PayrollView';
export { default as LeaveView } from '../Clerio/LeaveView';
export { default as ComplianceView } from '../Clerio/ComplianceView';
export { default as RecruitmentView } from '../Clerio/RecruitmentView';
export { default as OnboardingView } from '../Clerio/OnboardingView';
export { default as SettingsView } from '../Clerio/SettingsView';
export { default as OperationalModuleView } from '../Clerio/OperationalModuleView';
export { default as CatalogGridView } from '../Clerio/CatalogGridView';

// Workspace Navigation
export { default as TopNav } from '../Clerio/TopNav';
export { default as LeftDock } from '../Clerio/LeftDock';
export { default as RightSubNav } from '../Clerio/RightSubNav';

// Modals & Entity Creation Wizards
export { default as EmployeeCreationWizard } from '../Clerio/EmployeeCreationWizard';
export { default as EmployeeDossierModal } from '../Clerio/EmployeeDossierModal';
export { default as AccessControlModal } from '../Dashboard/Modals/AccessControlModal';
export { default as ActionFormModal } from '../Clerio/ActionFormModal';
export { default as BulkOnboardingModal } from '../Clerio/BulkOnboardingModal';

// Intelligence & Productivity Panels
export { default as AIPanel } from '../Clerio/AIPanel';
export { default as ChatPanel } from '../Clerio/ChatPanel';
export { default as VoiceNavigator } from '../VoiceNavigator';
