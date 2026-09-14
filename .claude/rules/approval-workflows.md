# Multi-Tier Approval Workflows & State Machines

> **Scope:** Workflow Engines, Delegation & SLA Management  
> **Source:** `Nucleus_HR_Demo_Points_Build_Sheet_v1_0.xlsx` (9 Workflows) & `Nucleus_Process_Flows_and_Process_Maps_v1.0.xlsx` (63 State Machines)

---

## 1. The 9 Master Approval Workflows

1. **Leave Application**: Employee → Reporting Manager (L1) → HRBP (L2)
2. **Attendance Regularization**: Employee → Shift Supervisor → Time Office Admin
3. **Overtime Pre-Approval**: Supervisor → Plant HOD → Plant HR
4. **Company Loan Application**: Employee → 2 Guarantors (Sign-off) → HRBP → Finance Head → Director (if limit exceeded)
5. **Expense Claim Reimbursement**: Employee → Department Manager → Finance Auditor
6. **Promotion & Compensation Revision**: Manager → HOD → Compensation Committee → CXO
7. **Resignation & Exit Clearance**: Employee → Manager → HRBP → 4 No-Dues Leads (IT, Admin, Finance, Stores)
8. **Job Requisition Approval**: Hiring Manager → Department Head → Finance Controller → Talent Head
9. **Full & Final Settlement (F&F)**: HR Ops → Finance Payroll → CFO / Disbursement Signer

---

## 2. Delegation & SLA Rules

- **Auto-Delegation**: When an approving manager is on approved leave, pending requests auto-route to their designated deputy or next solid-line manager.
- **SLA Expiration**: If a request remains pending beyond 48 hours, an automated reminder alert triggers, followed by auto-escalation to the skip-level manager at 72 hours.
- **Audit Requirement**: Every workflow state transition must log:
  - `actor_id`, `actor_role`, `previous_state`, `new_state`, `timestamp`, `comments`.
