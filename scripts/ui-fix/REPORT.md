# UI fix report

Mode: APPLIED · transforms: avatar, hex, clickable, dialog, breakpoint

## 1. Transforms applied

| Transform | Edits |
|---|---|
| avatar | 12 |
| hex | 416 |
| clickable | 7 |
| dialog | 33 |
| breakpoint | 1 |

Files changed: 64

- src/app/(suite)/api-docs/page.tsx — hex:2
- src/app/(suite)/globals.css — hex:1
- src/components/AI/QuantumCopilot.module.css — hex:5
- src/components/Dashboard/Modals/AccessControlModal.js — dialog:1
- src/components/Dashboard/Modals/ApprovalActionModal.js — dialog:1
- src/components/Dashboard/Modals/CtcExceptionModal.js — hex:1, dialog:1
- src/components/Dashboard/Personalization/PersonalDashboard.module.css — hex:3
- src/components/Dashboard/Personalization/PersonalDashboard.tsx — dialog:4
- src/components/Dashboard/Views/AttendanceIntelligence.js — hex:1
- src/components/Dashboard/Views/ManagerCockpit.js — clickable:1
- src/components/LanguageSelector.module.css — hex:17
- src/components/Policies/PolicyHandbookModal.js — hex:2
- src/components/Workspace/ActionFormModal.js — dialog:1
- src/components/Workspace/AnalyticsView.js — hex:2
- src/components/Workspace/AttendanceFAB.module.css — hex:10
- src/components/Workspace/AttendanceView.js — dialog:6
- src/components/Workspace/BulkOnboardingModal.js — hex:3, dialog:1
- src/components/Workspace/BulkOnboardingModal.module.css — hex:4
- src/components/Workspace/CMSModal.js — hex:2, dialog:1
- src/components/Workspace/CMSModal.module.css — hex:25
- src/components/Workspace/ChatPanel.module.css — hex:12
- src/components/Workspace/CompensationView.js — hex:2
- src/components/Workspace/CompensationView.module.css — hex:6
- src/components/Workspace/ComplianceView.js — hex:1, dialog:4
- src/components/Workspace/ContractWorkforceView.module.css — hex:40
- src/components/Workspace/DataImportModal.js — hex:1, dialog:1
- src/components/Workspace/DataImportModal.module.css — hex:23
- src/components/Workspace/EmployeeCreationWizard.js — dialog:1
- src/components/Workspace/EmployeeDossierModal.js — dialog:1
- src/components/Workspace/ExperienceView.module.css — hex:3
- src/components/Workspace/HelpdeskView.js — dialog:1
- src/components/Workspace/HelpdeskView.module.css — hex:44
- src/components/Workspace/IntegrationsView.module.css — hex:4
- src/components/Workspace/LearningView.js — hex:3
- src/components/Workspace/LearningView.module.css — hex:3
- src/components/Workspace/LeaveView.js — hex:8, dialog:1
- src/components/Workspace/LeaveView.module.css — hex:1
- src/components/Workspace/LegalEntityModal.js — dialog:1
- src/components/Workspace/LegalEntityModal.module.css — hex:2
- src/components/Workspace/LocationMasterModal.js — dialog:1
- src/components/Workspace/LocationMasterModal.module.css — hex:2
- src/components/Workspace/MainWorkspace.js — avatar:1
- src/components/Workspace/MainWorkspace.module.css — breakpoint:1
- src/components/Workspace/MisReportingHub.module.css — hex:1
- src/components/Workspace/NucleusAiPage.tsx — hex:28
- src/components/Workspace/NucleusDock.tsx — hex:15
- src/components/Workspace/OnboardingView.js — hex:9, dialog:2
- src/components/Workspace/OnboardingView.module.css — hex:7
- src/components/Workspace/PayrollView.js — hex:1, dialog:1
- src/components/Workspace/PeopleCoreView.js — avatar:1, hex:2, clickable:6
- src/components/Workspace/PerformanceView.module.css — hex:7
- src/components/Workspace/ProjectView.js — avatar:5, hex:7
- src/components/Workspace/ProjectView.module.css — hex:20
- src/components/Workspace/RecruitmentView.js — dialog:2
- src/components/Workspace/RecruitmentView.module.css — hex:10
- src/components/Workspace/SettingsView.module.css — hex:22
- src/components/Workspace/SideNav.js — hex:1
- src/components/Workspace/SideNav.module.css — hex:9
- src/components/Workspace/TeamView.js — avatar:1, hex:1
- src/components/Workspace/TeamView.module.css — hex:15
- src/components/Workspace/Toast.module.css — hex:5
- src/components/Workspace/TopNav.js — avatar:4
- src/components/Workspace/WorkflowBuilderModal.js — hex:2, dialog:1
- src/components/Workspace/WorkflowBuilderModal.module.css — hex:21

## 2. Needs a human decision (not changed)

- Inline style objects: 2617 (fix per component with shared primitives; no safe automatic conversion)
- readData() calls: 4279 (must move to API hooks; behaviour depends on each endpoint)
- Inputs/selects/textareas without id or aria-label: 310 (needs visible label text, which must come from locale files)
- Native alert()/confirm(): 3 (replace with Modal and Toast; wording needs review)
- Fixed pixel sizes (width/height ≥100px): 209 lines (layout decision per view)
- Old breakpoints 800/900/1023px still present in: 14 files (consolidate per view)
- Hex values with no token match: 1764 occurrences across 148 colours (add tokens or map by design)
- Files still referencing ui-avatars.com after transform: 5 — src/components/Workspace/MainWorkspace.js, src/components/Workspace/PeopleCoreView.js, src/components/Workspace/ProjectView.js, src/components/Workspace/TeamView.js, src/components/Workspace/TopNav.js

### Top files: inline styles
- 226 · src/components/Workspace/PayrollView.js
- 197 · src/components/Workspace/AttendanceView.js
- 162 · src/components/Dashboard/Views/EmployeeHome.js
- 134 · src/components/Workspace/PeopleCoreView.js
- 127 · src/components/Workspace/MainWorkspace.js
- 124 · src/components/Workspace/RecruitmentView.js
- 120 · src/components/Workspace/OnboardingView.js
- 116 · src/components/Workspace/ProjectView.js
- 101 · src/components/Workspace/AnalyticsView.js
- 101 · src/components/Workspace/ComplianceView.js
- 89 · src/components/Workspace/LeaveView.js
- 73 · src/components/Workspace/NucleusAiPage.tsx
- 63 · src/components/Workspace/SettingsView.js
- 60 · src/components/Dashboard/Views/MagnetixCapability.js
- 60 · src/components/Workspace/ExperienceView.js

### Top files: readData() (static data)
- 391 · src/components/Workspace/ComplianceView.js
- 314 · src/components/Workspace/PayrollView.js
- 196 · src/components/Dashboard/Views/EmployeeHome.js
- 162 · src/components/Workspace/OnboardingView.js
- 156 · src/components/Workspace/AttendanceView.js
- 154 · src/components/Dashboard/Views/AttendanceIntelligence.js
- 153 · src/components/Dashboard/Views/HROpsConsole.js
- 150 · src/components/Dashboard/Views/PayrollControlRoom.js
- 143 · src/components/Dashboard/Views/TalentAcquisition.js
- 138 · src/components/Workspace/SettingsView.js
- 136 · src/components/Workspace/MainWorkspace.js
- 135 · src/components/Workspace/RecruitmentView.js
- 134 · src/components/Dashboard/Views/MagnetixCapability.js
- 131 · src/components/Workspace/MisReportingHub.js
- 121 · src/components/Workspace/ProjectView.js

### Native dialogs
- 1 · src/components/Dashboard/Modals/AccessControlModal.js
- 1 · src/components/Workspace/AccessControlView.js
- 1 · src/context/NucleusSessionProvider.tsx

### Top unmapped hex colours
- #FFFFFF · 199
- #D8DEDA · 158
- #05CD99 · 88
- #0F6E5C · 86
- #F6F8F6 · 72
- #94A3B8 · 70
- #0A5546 · 64
- #EF4444 · 60
- #0F172A · 58
- #64748B · 51
