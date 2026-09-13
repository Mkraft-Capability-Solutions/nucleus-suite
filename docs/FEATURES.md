# Nucleus HRMS Feature List

## 1. 🤖 Nucleus AI Features (The Core Differentiator)
These features are powered by the AI engine (`src/lib/ai`) and the `AIPanel` interface.
*   **Conversational AI Assistant**: A chat interface (`AIPanel.js`) for natural language interactions.
*   **Instant Policy Search (RAG)**: Ask questions like "What is the maternity leave policy?" and get instant answers from documents.
*   **Smart Data Retrieval**:
    *   Check Leave Balance ("How many sick leaves do I have left?")
    *   Check Attendance Status ("Did I punch in on time today?")
    *   View Payroll Summaries ("Show my last month's net pay")
*   **Voice Login & Authentication**: (Planned) Secure access using voice biometrics.

## 2. 🏢 Core HR Modules
Standard HR functionalities implemented in the `Clerio` component system.

### 📅 Attendance & Time Tracking
*   **Smart Punch In/Out**: Floating Action Button (`AttendanceFAB.js`) for quick attendance marking.
*   **Attendance Dashboard** (`AttendanceView.js`): View monthly logs, late arrivals, and working hours.
*   **Biometric/Geo-tagging Support**: (Implied by standard requirements).

### 🌴 Leave Management
*   **One-Click Apply** (`LeaveView.js`): Simple interface to request leaves.
*   **Balance Tracking**: Real-time view of Privilege, Casual, and Sick leave balances.
*   **Approval Workflow**: Managers can approve/reject requests directly.

### 💰 Payroll & Compensation
*   **Salary Slips** (`PayrollView.js`): View and download monthly payslips.
*   **Tax Breakdown**: Detailed view of deductions and tax computations.
*   **Payout Status**: Track when salaries are processed and credited.

### 👥 Team & Performance
*   **Team Directory** (`TeamView.js`): View team members, roles, and hierarchies.
*   **Performance Reviews** (`PerformanceView.js`): Set goals, track achievements, and conduct appraisals.
*   **Project Management** (`ProjectView.js`): Assign employees to projects and track billable hours.

## 3. 🔐 Security & Platform
*   **Role-Based Access Control (RBAC)**: Distinct views and permissions for Employees, Managers, and Admins.
*   **Secure Authentication**: Login system (`LoginView.js`) with modern security practices.
*   **Interactive UI/UX**:
    *   **Toast Notifications**: Real-time feedback for actions.
    *   **Responsive Design**: Optimized for Desktop and Tablet (`MainWorkspace.js`).
    *   **Dark/Light Mode**: Styled with CSS modules.

---

## Feature Summary by Role

| Feature | Employee | Manager | Admin |
| :--- | :---: | :---: | :---: |
| **Nucleus AI Chat** | ✅ | ✅ | ✅ |
| **Apply for Leave** | ✅ | ✅ | ❌ |
| **Approve Leaves** | ❌ | ✅ | ✅ |
| **View Own Payslips** | ✅ | ✅ | ✅ |
| **View Team Stats** | ❌ | ✅ | ✅ |
| **Performance Reviews** | Self | Team | All |
| **System Settings** | ❌ | ❌ | ✅ |
