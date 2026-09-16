# Sidebar and Navigation Architecture Map

This document outlines the strict mapping between the Left Sidebar navigation hierarchy, the Right Sidebar contextual sub-menus, and how they synchronize with the Middle Pane Tabs.

## 1. Left Sidebar (Domain Navigation)

The Left Sidebar is the primary application router. Selecting an item here changes the fundamental `activeDomain` or `activeModule` of the application.

| Left Sidebar Menu | Internal ID | Sub-Menus (Right Pane context) | Middle Pane Component Route |
|-------------------|-------------|--------------------------------|-----------------------------|
| **Home** | `employee_home` | None | `AppWorkspace` |
| **People Core** | `person_record` | Employee Records, Document Vault, Probation | `PeopleCoreView` |
| **Organization** | `legal_entity` | Legal Entities, Org Units, Sanctioned Strength | `OrganizationView` |
| **Attendance** | `attendance_detail` | Daily Attendance, Overtime, Gate Passes, Shifts | `AttendanceView` |
| **Leaves** | `leave_requests` | Leave Admin, Compensatory Off, Encashments | `LeaveView` |
| **Payroll** | `payroll_runs` | Payroll Processing, Retro Arrears, Bank Files | `PayrollView` |
| **Onboarding** | `onboarding_cases` | Welcome Board, Clearance Board, Golden Cases | `ComplianceView` |

## 2. Right Sidebar (Contextual Deep-Linking)

The Right Sidebar (`RightSubNav.js`) renders options based on the active Left Sidebar selection. When a user clicks a sub-menu here, the Middle Pane MUST transition to the exact matching Tab without a full page reload.

### Implementation Strategy for Tab Sync

In `RightSubNav.js`:
- Each item click dispatches `setActiveSubFeature(itemId)`.

In the Middle Pane Views (e.g., `PeopleCoreView.tsx`):
- A `useEffect` listens for changes to `activeSubFeature`.
- A mapping object correlates `itemId` to the MUI `Tab` index.

```typescript
// Example inside PeopleCoreView.tsx
useEffect(() => {
  const tabMap = {
    'employee_records': 0,
    'document_vault': 1,
    'probation_confirmation': 2
  };
  
  if (activeSubFeature && tabMap[activeSubFeature] !== undefined) {
    setTabValue(tabMap[activeSubFeature]);
  }
}, [activeSubFeature]);
```

## 3. Left-to-Right-to-Middle Mapping Matrix

### Domain: People Core
- **Right Sub-Menu Click:** `Employee Records` (`employee_records`) → **Action:** Sets `PeopleCoreView` to Tab 0
- **Right Sub-Menu Click:** `Document Vault` (`document_vault`) → **Action:** Sets `PeopleCoreView` to Tab 1
- **Right Sub-Menu Click:** `Probation & Exits` (`probation_confirmation`) → **Action:** Sets `PeopleCoreView` to Tab 2

### Domain: Leaves
- **Right Sub-Menu Click:** `Leave Administration` (`leave_requests`) → **Action:** Sets `LeaveView` to Tab 0
- **Right Sub-Menu Click:** `Comp-Off Grants` (`compensatory_off`) → **Action:** Sets `LeaveView` to Tab 1

### Domain: Payroll
- **Right Sub-Menu Click:** `Payroll Processing` (`payroll_runs`) → **Action:** Sets `PayrollView` to Tab 0
- **Right Sub-Menu Click:** `Retro & Arrears` (`retro_arrears`) → **Action:** Sets `PayrollView` to Tab 1
- **Right Sub-Menu Click:** `Bank Disbursements` (`bank_disbursement`) → **Action:** Sets `PayrollView` to Tab 2
