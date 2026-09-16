import commandCatalog from "./command-catalog.generated.json";
import { type PicklistCode } from "./picklists";
import { dossierWorkflowOperations, dossierResources } from "./dossier-catalog";
import { operationalWorkflowOperations, operationalResources } from "./operational-catalog";
import generated from "./workflow-catalog.generated.json";

export type Field = {
  name?: string; kind: string; optional?: boolean; default?: unknown;
  min?: number; max?: number; integer?: boolean; format?: string;
  /** Set when the options come from the picklist registry, so the workbook's labels can be shown. */
  picklist?: PicklistCode;
  /**
   * Computed by the server, shown but never typed. A derived field is on the form because
   * the workbook lists it and the user needs to see it; accepting it as input would let a
   * value be entered that the service then overwrites, which is worse than not showing it.
   */
  derived?: boolean;
  options?: (string | number | boolean)[]; fields?: Field[]; item?: Field; variants?: Field[];
};
export type WorkflowOperation = {
  id: string; module: string; section: string; path: string; method: string;
  body: Field; label?: string; permissionAlternatives?: string[][]; permissions: string[]; query: string[]; version: boolean; source: string;
};
export const workflowOperations: WorkflowOperation[] = [...generated as WorkflowOperation[], ...operationalWorkflowOperations(), ...dossierWorkflowOperations(), ...commandCatalog as WorkflowOperation[], ...commandCatalog.map(op => ({...op,id:"GET " + op.path,method:"GET",label:"Command history",body:{kind:"object",fields:[]}})) as WorkflowOperation[]];
export function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_/-]/g, " ").replace(/\bId\b/g, "reference").replace(/\bMinor\b/g, "(paise)").replace(/^./, c => c.toUpperCase());
}
const labels: Record<string, string> = {
  people: "Employee records", "organization/tree": "Organisation structure", "organization/departments": "Departments", "organization/positions": "Positions",
  "onboarding/instances": "Joining cases", "onboarding/templates": "Joining templates", "onboarding/tasks": "Joining tasks", "offboarding/cases": "Exit cases & settlement", "offboarding/items": "Exit clearances",
  "attendance/days": "Attendance register", "attendance/punches": "Punch in / out", "attendance/team-summary": "Team attendance", regularizations: "Attendance corrections", "shift-swaps": "Shift swaps", "gate-passes": "Gate passes",
  "leave-requests": "Pick a request from the queue → check the applicant, dates and the ledger movements it caused → approve, reject or record an early return.", "leave-balances": "Leave balances", "coff-grants": "Compensatory off", "payroll-runs": "Payroll processing", "payroll-inputs": "Salary inputs", "payroll-anomalies": "Payroll exceptions",
  "review-cycles": "Review cycles", "review-participants": "Review assignments", "review-responses": "Review submissions", "calibration-sessions": "Calibration", "succession-plans": "Succession planning",
  "contractors/agencies": "Contract agencies", "contractors/contracts": "Agency contracts", "contractors/assignments": "Worker assignments", "contractors/invoices": "Contractor invoices",
  "ops/audit-events": "Audit trail", "ops/access-events": "Access history", "ops/scheduled-tasks": "Scheduled work", "ops/outbox": "Delivery queue",
};
export function sectionLabel(section: string) { return operationalResources[section.replace(/^operations\//, "")]?.label ?? dossierResources[section.replace(/^dossier\//, "")]?.label ?? labels[section] ?? humanize(section.replace(/^commands\//,"")); }
export function operationLabel(op: WorkflowOperation) {
  if (op.method === "GET") { const tail = op.path.split("/").at(-1)!; return op.path.includes("[") ? tail.startsWith("[") ? "View details" : humanize(tail) : "View records"; }
  if (op.label) return humanize(op.label);
  const last = op.path.split("/").at(-1)!;
  if (op.path.includes("[") && !last.startsWith("[")) return humanize(last);
  if (op.method === "DELETE") return "Remove";
  if (op.method === "PATCH" || op.method === "PUT") return "Update";
  if (last === "import-preview") return "Preview employee import";
  if (last === "import-apply") return "Apply employee import";
  return "Create / submit";
}
export function permitted(op: WorkflowOperation, permissions: string[]) {
  return op.permissions.every(p => permissions.includes(p)) || (op.permissionAlternatives ?? []).some(group => group.every(p => permissions.includes(p)));
}
export function workflowSections(module: string, permissions: string[]) {
  return [...new Set(workflowOperations.filter(o => o.module === module && permitted(o, permissions)).map(o => o.section))];
}
export const workflowGuides: Record<string, string> = {
  helpdesk: "Raise a ticket with category and priority → assign an owner → record replies → resolve → requester closes or reopens. Grievances are restricted.",
  projects: "Create and activate a project → request dated employee allocations → approve within capacity → release allocations before closing the project.",
  travel: "Draft a travel or duty request → submit → independent approval → complete the trip. Link receipts to expense claims, approve them, and record the reimbursement reference.",
  timesheets: "Choose an active project and work date → enter task and minutes → submit → manager reviews. Returned entries can be corrected and resubmitted.",
  assets: "Register the asset and legal entity → allocate custody → record return date and condition → restore, repair or retire. Outstanding assets block exit settlement.",
  rosters: "Plan employee dates, site and shift hours → submit → independent approval → publish. Overlapping approved plans are rejected; withdraw a published plan before replacing it.",
  mobility: "Request a career move and effective date → submit → review and approve → record completion. Apply the corresponding employment assignment through People Core.",
  accounting: "Create effective GL mappings → submit and approve → generate a posting for a finalized payroll run → review the batch → record the ERP acknowledgement.",
  statutory: "Generate a statutory form → create a filing record linked to it → review and approve → record filing and acceptance acknowledgements from the authority.",
  settlements: "Use a finalized payroll run to prepare a reviewed settlement → submit and approve → clear no-dues, assets and loan recovery → record payment and finalize the exit.",
  people: "Create employee → assign department and position → add and verify documents → start onboarding.",
  organization: "Create departments → establish positions → assign employees and reporting lines.",
  onboarding: "Define template → start joining case → complete assigned tasks → check readiness. For exits: open case → clear items → settle.",
  attendance: "Record punches → review attendance days → submit corrections or shift swaps → decide requests → recompute and review the trace.",
  leave: "Review balance → submit dates and leave type → manager decides → record an early return when applicable.",
  payroll: "Create run → enter salary inputs → calculate → resolve exceptions → approve → finalize → review journals and payslips. Corrections use the correction action.",
  "payroll-run-cockpit": "Review the scoped run queue → open a run for its state timeline and audit trail → draft new runs → complete calculation, approval and finalization in Payroll.",
  "pre-payroll-audit": "Triage open findings → assign an owner → resolve with evidence or waive with a recorded reason → approve the run only when the queue is clear.",
  loans: "Apply → collect guarantor consent → approve → disburse → record repayments. Advances follow application → approval → payment.",
  talent: "Create requisition → approve → approve job description → publish → add candidate and application → interview and score → issue and transition offer.",
  performance: "Set objectives and key results → check in → create review cycle and participants → submit reviews → calibrate → plan succession.",
  learning: "Create courses and learning paths → enroll employees → complete learning → record and verify skill evidence.",
  compensation: "Define bands and budgets → open cycle → submit and approve proposals. For benefits: create plan and options → enroll employee.",
  contractors: "Register agency → create contract → assign workers → submit and reconcile invoices.",
  compliance: "Register obligations → attach evidence → generate forms. Track privacy requests and legal holds separately.",
  integrations: "Register connection → configure subscriptions → inspect deliveries → retry failed work after correcting the cause.",
  engagement: "Publish announcements → create and run surveys → collect responses → review results and recognition.",
  settings: "Configure tenant → define roles and permissions → invite members → assign roles → inspect audit and scheduled work.",
  "employee-record": "Search the governed directory → select a record → inspect its lifecycle timeline and audit trail.",
  "document-vault": "Pick a document from the queue → inspect its versions, expiry and audit trail → record a verification decision with a reason.",
  "joining-chain-console": "Pick a joiner from the queue → work the required Day-1 steps with their owners → readiness turns ready only when every required step is complete.",
  "clearance-board": "Pick a no-dues item from the queue → clear or waive it against a reason → settlement stays held while any blocking item is open.",
  "asset-register": "Pick an asset from the queue → inspect its custody history → allocate it to an employee or record its return with a condition.",
  "letters-issue-register": "Pick a template or issued letter from the queue → inspect its version and issue history → issue the active template version against an approver.",
  "policy-acknowledgements": "Pick a published policy version from the queue → review who has acknowledged it → record an acknowledgement with an optional comment.",
  "employee-home-actions": "Review every outstanding self-service action for the signed-in employee, gathered from governed onboarding, clearance, policy, document and leave records.",
  "position-register": "Pick a sanctioned post from the queue → inspect its incumbent, vacancy and audit trail → freeze or reopen it.",
  "sanctioned-strength-board": "Pick a sanctioned line from the queue → compare approved strength against filled posts and open requisitions → revise it against an approval reference.",
  "assignment-policy-attributes": "Pick the current assignment from the queue → inspect its effective-dated history and audit trail → record a new assignment.",
  "access-scope-administration": "Review the current tenant scope and permissions in force.",
  "check-in-out": "Pick a punch from the queue → see its direction, device and source reader → trace it through to the attendance day it was computed into.",
  "my-attendance-history": "Pick a day from your own history → net hours, overtime and the punches behind them → raise a regularisation where a day is wrong.",
  "attendance-day-detail": "Pick a day from the scope → segments, shift assigned versus applied, and the punch provenance → regularise or recompute it.",
  "gate-pass-register": "Pick a gate pass from the queue → minutes, window and reason → approve or reject it against the stored monthly ceiling and instance limit.",
  "overtime-register": "Pick an overtime entry → eligibility basis, multiplier and the day behind it → approve it, then tag it to a payroll run.",
  "attendance-exception-queue": "Pick an exception → unpaired punches, missing days or device failures with the day and punches behind them → accept the proposal or resolve it with a reason.",
  "attendance-recompute-monitor": "Queue a recompute over an employee and date range, and watch real recompute activity with the delta each job produced.",
  "team-history": "Pick a date range → attendance, leave, overtime and gate-pass minutes per team member, each counted from its own governed record.",
  "leave-requests": "Review submitted leave requests and record chain decisions.",
  "leave-balance-ledger": "Every credit and debit in the order it takes effect, with the balance it left behind and the account it belongs to.",
  "leave-policy-configuration": "Pick an accrual rule → review its band, accrual and the leave-type rules it credits against → move it through simulate, activate and supersede with a reason.",
  "statutory-compliance": "Track obligations, attach evidence, and file through approved rule packs only.",
};

export function initialValue(field: Field): unknown {
  if (field.default !== undefined) return field.default;
  if (field.kind === "null") return null;
  if (field.optional) return undefined;
  if (field.kind === "object") return Object.fromEntries((field.fields ?? []).map(f => [f.name!, initialValue(f)]));
  if (field.kind === "array") return Array.from({ length: Math.min(field.min ?? 0, 10) }, () => initialValue(field.item!));
  if (field.kind === "boolean") return false;
  if (field.kind === "record") return {};
  if (field.kind === "union") return initialValue(field.variants?.[0] ?? { kind: "text" });
  return "";
}
export function normalizeValue(field: Field, value: unknown): unknown {
  if ((value === "" || value === undefined) && field.optional) return undefined;
  if (field.kind === "null") return null;
  if (field.kind === "record") return Object.fromEntries(Object.entries((value ?? {}) as Record<string, unknown>).map(([key, v]) => [key, normalizeValue(field.item ?? { kind: "text" }, v)]));
  if (field.kind === "object") return Object.fromEntries((field.fields ?? []).map(f => [f.name!, normalizeValue(f, (value as Record<string, unknown> | undefined)?.[f.name!])]).filter(([, v]) => v !== undefined));
  if (field.kind === "array") return (Array.isArray(value) ? value : []).map(v => normalizeValue(field.item!, v));
  if (field.kind === "number") {
    if (value === "" || value === undefined) throw new Error(`${humanize(field.name ?? "Number")} is required.`);
    const n = Number(value);
    if (!Number.isFinite(n) || (field.integer && !Number.isSafeInteger(n))) throw new Error(`${humanize(field.name ?? "Number")} must be a valid ${field.integer ? "whole number" : "number"}.`);
    return n;
  }
  if (field.format === "datetime" && typeof value === "string" && value) return new Date(value).toISOString();
  return value;
}

export function unwrapRecords(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const data = obj.data ?? payload;
  if (Array.isArray(data)) return data.filter(v => v && typeof v === "object").map(v => ({ ...v, ...(v.attributes && typeof v.attributes === "object" ? v.attributes : {}), id: v.id, version: v.version ?? v.attributes?.version }));
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const lists = Object.values(record).filter(Array.isArray);
    if (lists.length) return lists.flatMap(v => unwrapRecords(v));
    return [record];
  }
  return [];
}
export function recordLabel(record: Record<string, unknown>) {
  const name = record.name ?? record.title ?? [record.firstName ?? record.first_name, record.lastName ?? record.last_name].filter(Boolean).join(" ");
  const operational = record.shiftCode ? `${String(record.shiftCode)} shift · ${String(record.startDate ?? "Dates pending")}`
    : record.role && record.allocationPercent ? `${String(record.role)} allocation · ${String(record.startDate ?? "Dates pending")}`
      : record.category && record.expenseDate ? `${humanize(String(record.category))} · ${String(record.expenseDate)}`
        : record.targetRole ? `${String(record.targetRole)} · ${String(record.effectiveDate ?? "Date pending")}`
          : record.lastWorkingDate && record.netPayableMinor !== undefined ? `Settlement · ${String(record.lastWorkingDate)}`
            : undefined;
  return String(name || record.employeeCode || record.code || record.subject || record.assetTag || record.purpose || record.task || record.componentCode || record.bankName || record.accountHolder || record.formCode || record.owner || operational || record.id || "Record");
}
