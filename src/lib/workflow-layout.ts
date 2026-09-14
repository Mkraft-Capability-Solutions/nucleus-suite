import { workflowOperations, permitted } from "./workflow-catalog";

export type WorkflowGroup = { id: string; label: string; sections: string[] };
// Deliberate business order: discovering an API endpoint must not create a tab.
const definitions: Record<string, [string, string, string[]][]> = {
  accounting: [["ledger", "Ledger & reconciliation", ["operations/ledger", "commands/create_gl_posting", "commands/ack_gl_posting"]]],
  statutory: [["returns", "Forms & filing", ["commands/generate_statutory_form", "operations/filings"]]],
  settlements: [["final", "Proposals & payment", ["operations/settlements"]]],
  "tax-declaration-projection": [["declarations", "Declarations & proofs", ["operations/taxDeclarations"]]],
  helpdesk: [["support", "Requests & resolution", ["operations/tickets"]]],
  projects: [["delivery", "Projects & allocations", ["operations/projects", "operations/allocations"]], ["board", "Task board", ["operations/tasks"]]],
  travel: [["journeys", "Travel & expenses", ["operations/travel", "operations/expenses"]]],
  timesheets: [["work", "Time & approvals", ["operations/timesheets"]]],
  assets: [["inventory", "Inventory & custody", ["operations/assets"]]],
  rosters: [["planning", "Planning & publication", ["operations/rosters"]], ["shift-master", "Shift master", ["operations/shifts"]]],
  "field-workforce": [["categories", "Worker categories", ["operations/worker-categories"]], ["calendars", "Plant calendars & holidays", ["operations/plant-calendars", "operations/holidays"]]],
  mobility: [["career", "Career moves", ["operations/mobility"]]],
  people: [["directory", "Employee directory", ["people", "documents"]], ["personal", "Personal & family", ["dossier/contacts", "dossier/emergency", "dossier/dependants"]], ["employment", "Employment & financial details", ["dossier/employments", "dossier/assignments", "dossier/bank", "dossier/tax"]]],
  organization: [["structure", "Organization structure", ["organization/tree", "organization/departments", "organization/positions", "organization/sanctioned-strength", "commands/approve_manpower"]]],
  onboarding: [["joining", "Joining & onboarding", ["onboarding/instances", "onboarding/tasks", "onboarding/templates", "onboarding/joining-chain", "commands/record_feature"]], ["exits", "Exits & clearance", ["offboarding/cases", "offboarding/items", "offboarding/clearance-board"]]],
  attendance: [["time", "Attendance & exceptions", ["attendance/days", "attendance/punches", "regularizations", "attendance/anomalies", "attendance/exceptions", "attendance/recompute", "attendance/engine", "attendance/session", "commands/evaluate_attendance"]], ["team", "Team & scheduling", ["attendance/team-summary", "attendance/timesheet", "shift-swaps", "gate-passes"]]],
  leave: [["requests", "Requests & balances", ["leave-requests", "leave-balances", "coff-grants", "commands/run_leave_maintenance"]]],
  talent: [["planning", "Hiring plan", ["requisitions", "job-descriptions", "job-postings", "commands/controlled_requisition"]], ["pipeline", "Candidate pipeline", ["candidates", "applications", "referrals"]], ["interviews", "Interviews & offers", ["interview-plans", "interview-sessions", "interview-scores", "offers"]]],
  performance: [["goals", "Goals & check-ins", ["objectives", "key-results", "checkins"]], ["reviews", "Reviews & calibration", ["review-cycles", "review-participants", "review-responses", "calibration-sessions"]], ["growth", "Feedback & succession", ["feedback", "feedback/entries", "succession-plans"]]],
  learning: [["catalogue", "Learning catalogue", ["courses", "learning-paths"]], ["development", "Assignments & capability", ["enrollments", "employee-skills", "skill-evidence"]]],
  engagement: [["communications", "Announcements & recognition", ["announcements", "recognition-events"]], ["listening", "Surveys & feedback", ["surveys", "survey-runs", "survey-responses"]]],
  payroll: [["processing", "Run & validate payroll", ["payroll-runs", "payroll-inputs", "payroll-anomalies"]], ["statements", "Payslips & simulations", ["payslips", "wage-simulations"]]],
  compensation: [["planning", "Compensation planning", ["compensation/cycles", "compensation/bands", "compensation/budgets", "compensation/proposals"]], ["benefits", "Benefits & claims", ["benefits/plans", "benefits/options", "benefits/enrollments", "benefits/claims"]]],
  loans: [["credit", "Loans & salary advances", ["loans", "salary-advances"]]],
  contractors: [["engagements", "Agencies & engagements", ["contractors/agencies", "contractors/contracts", "contractors/assignments", "contractors/invoices", "contractors/reconciliation"]]],
  compliance: [["statutory", "Obligations & filings", ["compliance/obligations", "compliance/forms", "compliance/evidence", "compliance/wage-floor"]], ["privacy", "Privacy & legal holds", ["privacy/requests", "privacy/holds"]]],
  insights: [["intelligence", "Metrics & capability", ["analytics/metrics", "analytics/metric-snapshots", "analytics/capability-index"]], ["reporting", "Reports & exports", ["reports", "exports"]]],
  assistant: [["knowledge", "Knowledge & feedback", ["ai/knowledge", "ai/feedback"]], ["agents", "Agent execution & review", ["ai/runs", "ai/actions", "ai/reviews", "ai/evals"]]],
  integrations: [["connections", "Connections & reference data", ["integrations/catalog", "integrations/connections", "fx", "commands/sync_erp_employee"]], ["events", "Webhooks & delivery", ["webhooks/endpoints", "webhooks/subscriptions", "webhooks/deliveries", "webhooks/secrets"]]],
  settings: [["access", "People & access", ["invitations", "memberships", "roles", "delegations", "commands/grant_location"]], ["configuration", "Configuration & automation", ["tenant/settings", "ops/scheduled-tasks", "ops/outbox", "commands/save_rule_set"]], ["security", "Security & audit", ["ops/access-events", "ops/audit-events"]]],
  inbox: [["inbox", "Notifications & preferences", ["notifications", "notifications/preferences"]]],
};

export const workflowLayouts: Record<string, WorkflowGroup[]> = Object.fromEntries(
  Object.entries(definitions).map(([module, groups]) => [module, groups.map(([id, label, sections]) => ({ id, label, sections }))]),
);

export function authorizedWorkflowGroups(module: string, permissions: string[]) {
  const available = new Set(workflowOperations.filter(op => op.module === module && permitted(op, permissions)).map(op => op.section));
  return (workflowLayouts[module] ?? []).map(group => ({ ...group, sections: group.sections.filter(section => available.has(section)) })).filter(group => group.sections.length);
}
