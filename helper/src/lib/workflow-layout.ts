import { workflowOperations, permitted } from "./workflow-catalog";

export type WorkflowGroup = { id: string; label: string; sections: string[] };
// Deliberate business order: discovering an API endpoint must not create a tab.
const definitions: Record<string, [string, string, string[]][]> = {
  accounting: [["ledger", "Ledger & reconciliation", ["operations/ledger", "commands/create_gl_posting", "commands/ack_gl_posting", "gl-accounts", "gl-mappings", "payroll-accounting"]]],
  statutory: [["returns", "Forms & filing", ["commands/generate_statutory_form", "operations/filings", "statutory-register"]]],
  settlements: [["final", "Proposals & payment", ["operations/settlements", "settlement-proposals", "settlement-workings"]]],
  "tax-declaration-projection": [["declarations", "Declarations & proofs", ["operations/taxDeclarations"]]],
  helpdesk: [["support", "Requests & resolution", ["operations/tickets"]]],
  projects: [["delivery", "Projects & allocations", ["operations/projects", "operations/allocations"]], ["board", "Task board", ["operations/tasks"]]],
  travel: [["journeys", "Travel & expenses", ["operations/travel", "operations/expenses"]]],
  timesheets: [["work", "Time & approvals", ["operations/timesheets"]]],
  assets: [["inventory", "Inventory & custody", ["operations/assets", "assets/register"]]],
  rosters: [["planning", "Planning & publication", ["operations/rosters"]], ["shift-master", "Shift master", ["operations/shifts"]], ["policies", "Night extension & late policies", ["operations/night-extension-rules", "operations/grace-late-policies"]]],
  "field-workforce": [["categories", "Worker categories", ["operations/worker-categories"]], ["calendars", "Plant calendars & holidays", ["operations/plant-calendars", "operations/holidays"]]],
  mobility: [["career", "Career moves", ["operations/mobility"]]],
  people: [["directory", "Employee directory", ["people", "documents", "letters/register", "letters/templates", "letters/studio", "employee-assignments"]], ["personal", "Personal & family", ["dossier/contacts", "dossier/emergency", "dossier/dependants"]], ["employment", "Employment & financial details", ["dossier/employments", "dossier/assignments", "dossier/bank", "dossier/tax"]]],
  organization: [["structure", "Organization structure", ["organization/tree", "organization/departments", "organization/positions", "organization/legal-entities", "organization/locations", "organization/sanctioned-strength", "establishment", "mobility-register", "organization/reporting-chart", "organization/data-scopes", "commands/approve_manpower"]]],
  onboarding: [["joining", "Joining & onboarding", ["onboarding/instances", "onboarding/tasks", "onboarding/templates", "onboarding/confirmation-reviews", "lifecycle/pipelines", "onboarding/joining-chain", "onboarding/confirmations", "commands/record_feature"]], ["exits", "Exits & clearance", ["offboarding/cases", "offboarding/items", "offboarding/clearance-board"]]],
  attendance: [["time", "Attendance & exceptions", ["attendance/days", "attendance/punches", "regularizations", "attendance/anomalies", "attendance/exceptions", "attendance/recompute", "attendance/engine", "attendance/session", "overtime/register", "commands/evaluate_attendance"]], ["team", "Team & scheduling", ["attendance/team-summary", "attendance/timesheet", "shift-swaps", "gate-passes"]]],
  leave: [["requests", "Requests & balances", ["leave-requests", "leave-balances", "coff-grants", "leave/early-returns", "leave/comp-off-clock", "commands/run_leave_maintenance"]], ["policies", "Scheme & entitlement", ["leave-policies/register", "leave/scheme-settings", "leave/balance-cards", "leave/encashments"]], ["cycles", "Accrual, lapse & year end", ["leave/accrual-runs", "leave/coff-lapse-runs", "leave/year-end-runs", "leave/engine"]]],
  talent: [["planning", "Hiring plan", ["requisitions", "job-descriptions", "job-postings", "requisition-register", "commands/controlled_requisition"]], ["pipeline", "Candidate pipeline", ["candidates", "applications", "referrals", "talent-pipeline", "talent-placements", "referral-tracking"]], ["interviews", "Interviews & offers", ["interview-plans", "interview-sessions", "interview-scores", "offers"]]],
  performance: [["goals", "Goals & check-ins", ["objectives", "key-results", "checkins", "okr-tree"]], ["reviews", "Reviews & calibration", ["review-cycles", "review-participants", "review-responses", "calibration-sessions"]], ["growth", "Feedback & succession", ["manager-coaching-notes", "feedback", "feedback/entries", "succession-plans"]]],
  learning: [["catalogue", "Learning catalogue", ["courses", "learning-paths"]], ["development", "Assignments & capability", ["enrollments", "employee-skills", "skill-evidence", "learning-progress", "my-learning"]]],
  engagement: [["communications", "Announcements & recognition", ["announcements", "recognition-events", "announcement-register", "recognition-register", "social-feed", "engagement/milestones"]], ["listening", "Surveys & feedback", ["surveys", "survey-runs", "survey-responses"]]],
  payroll: [["processing", "Run & validate payroll", ["payroll-runs", "payroll-inputs", "payroll-anomalies", "payroll/components", "reconciliations"]], ["statements", "Payslips & simulations", ["payslips", "wage-simulations", "disbursements", "tax-projections", "earned-wage-access"]]],
  compensation: [["planning", "Compensation planning", ["compensation/cycles", "compensation/bands", "compensation/budgets", "compensation/proposals"]], ["benefits", "Benefits & claims", ["benefits/plans", "benefits/options", "benefits/enrollments", "benefits/claims", "reimbursement-claims"]]],
  loans: [["credit", "Loans & salary advances", ["loans", "salary-advances"]]],
  contractors: [["engagements", "Agencies & engagements", ["contractors/agencies", "contractors/contracts", "contractors/assignments", "contractors/invoices", "contractors/reconciliation"]]],
  compliance: [["statutory", "Obligations & filings", ["compliance/obligations", "compliance/forms", "compliance/statutory-forms", "compliance/evidence", "compliance/wage-floor", "policy-acknowledgements"]], ["privacy", "Privacy & legal holds", ["privacy/requests", "privacy/holds"]]],
  insights: [["intelligence", "Metrics & capability", ["cockpits/people-command-centre", "cockpits/manager-cockpit", "cockpits/employee-home", "cockpits/hr-operations-console", "cockpits/attendance-intelligence", "cockpits/payroll-control-room", "cockpits/talent-acquisition-command", "cockpits/performance-calibration", "cockpits/capability-intelligence", "cockpits/nucleus-intelligence", "analytics/metrics", "analytics/metric-snapshots", "analytics/capability-index"]], ["reporting", "Reports & exports", ["reports", "exports"]]],
  assistant: [["knowledge", "Knowledge & feedback", ["ai/knowledge", "ai/feedback"]], ["agents", "Agent execution & review", ["ai/runs", "ai/actions", "ai/reviews", "ai/evals"]]],
  integrations: [["connections", "Connections & reference data", ["integrations/catalog", "integrations/connections", "integrations/erp-settings", "integrations/erp-queue", "fx", "commands/sync_erp_employee", "commands/retry_erp_record", "commands/abandon_erp_record"]], ["events", "Webhooks & delivery", ["webhooks/endpoints", "webhooks/subscriptions", "webhooks/deliveries", "webhooks/secrets"]]],
  settings: [["access", "People & access", ["invitations", "memberships", "roles", "delegations", "commands/grant_location"]], ["configuration", "Configuration & automation", ["tenant/settings", "ops/scheduled-tasks", "ops/outbox", "commands/save_rule_set"]], ["security", "Security & audit", ["access-scopes", "access-scopes/principals", "plant-scope", "ops/access-events", "ops/audit-events"]]],
  inbox: [["inbox", "Notifications & preferences", ["notifications", "notifications/preferences"]]],
};

export const workflowLayouts: Record<string, WorkflowGroup[]> = Object.fromEntries(
  Object.entries(definitions).map(([module, groups]) => [module, groups.map(([id, label, sections]) => ({ id, label, sections }))]),
);

export function authorizedWorkflowGroups(module: string, permissions: string[]) {
  const available = new Set(workflowOperations.filter(op => op.module === module && permitted(op, permissions)).map(op => op.section));
  return (workflowLayouts[module] ?? []).map(group => ({ ...group, sections: group.sections.filter(section => available.has(section)) })).filter(group => group.sections.length);
}
