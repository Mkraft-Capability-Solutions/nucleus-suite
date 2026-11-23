import type { Translate } from "./payroll-client";

/**
 * Localised labels for server enum values. Each key is written out literally so
 * the locale sync script can find it; an unknown value falls back to the raw code
 * (status codes are not translated data, so showing the code is honest).
 */

const NS = "components.Workspace.PayrollView";

export function advanceBlockedReason(t: Translate, reason: string | undefined): string {
  switch (reason) {
    case "no_basic_salary": return t(`${NS}.text_blocked_no_basic`, "No basic salary is on record, so no advance can be offered.");
    case "open_loan": return t(`${NS}.text_blocked_open_loan`, "An open company loan blocks a salary advance.");
    case "open_advance": return t(`${NS}.text_blocked_open_advance`, "An earlier advance must be recovered before another can be requested.");
    default: return t(`${NS}.text_blocked_unknown`, "An advance cannot be requested right now.");
  }
}

export function payslipStateLabel(t: Translate, state: string): string {
  switch (state) {
    case "generated": return t(`${NS}.text_payslip_generated`, "Generated");
    case "published": return t(`${NS}.text_payslip_published`, "Published");
    case "viewed": return t(`${NS}.text_payslip_viewed`, "Viewed");
    case "archived": return t(`${NS}.text_payslip_archived`, "Archived");
    default: return state;
  }
}

export function advanceStatusLabel(t: Translate, status: string): string {
  switch (status) {
    case "requested": return t(`${NS}.text_advance_requested`, "Requested");
    case "approved": return t(`${NS}.text_advance_approved`, "Approved");
    case "paid": return t(`${NS}.text_advance_paid`, "Paid");
    case "recovered": return t(`${NS}.text_advance_recovered`, "Recovered");
    case "rejected": return t(`${NS}.text_advance_rejected`, "Rejected");
    default: return status;
  }
}

export function obligationStatusLabel(t: Translate, status: string): string {
  switch (status) {
    case "scheduled": return t(`${NS}.text_obligation_scheduled`, "Scheduled");
    case "filed": return t(`${NS}.text_obligation_filed`, "Filed");
    case "overdue": return t(`${NS}.text_obligation_overdue`, "Overdue");
    case "completed": return t(`${NS}.text_obligation_completed`, "Completed");
    default: return status;
  }
}

export function runStatusLabel(t: Translate, status: string): string {
  switch (status) {
    case "draft": return t(`${NS}.text_run_draft`, "Draft");
    case "calculated": return t(`${NS}.text_run_calculated`, "Calculated");
    case "approved": return t(`${NS}.text_run_approved`, "Approved");
    case "finalized": return t(`${NS}.text_run_finalized`, "Finalised");
    case "paid": return t(`${NS}.text_run_paid`, "Disbursed");
    default: return status;
  }
}

export function runTypeLabel(t: Translate, scope: string): string {
  switch (scope) {
    case "regular": return t(`${NS}.text_scope_regular`, "Regular");
    case "ot": return t(`${NS}.text_scope_ot`, "Off-cycle overtime");
    case "arrears": return t(`${NS}.text_scope_arrears`, "Arrears");
    case "full_final": return t(`${NS}.text_scope_full_final`, "Full and final");
    case "bonus": return t(`${NS}.text_scope_bonus`, "Bonus");
    case "reimbursement": return t(`${NS}.text_scope_reimbursement`, "Reimbursement");
    case "correction": return t(`${NS}.text_scope_correction`, "Correction");
    default: return scope;
  }
}

export function runTypeDescription(t: Translate, scope: string): string {
  switch (scope) {
    case "regular": return t(`${NS}.text_scope_regular_desc`, "The monthly salary cycle for the pay group.");
    case "ot": return t(`${NS}.text_scope_ot_desc`, "Overtime paid separately after the regular salary, inside the period.");
    case "arrears": return t(`${NS}.text_scope_arrears_desc`, "Retro adjustments paid on or after the period closes.");
    case "full_final": return t(`${NS}.text_scope_full_final_desc`, "Exit settlements paid in their own bank batch.");
    case "bonus": return t(`${NS}.text_scope_bonus_desc`, "Bonus payouts kept apart from the regular cycle.");
    case "reimbursement": return t(`${NS}.text_scope_reimbursement_desc`, "Approved claims reimbursed outside the salary cycle.");
    default: return "";
  }
}

export function loanStatusLabel(t: Translate, status: string): string {
  switch (status) {
    case "submitted": return t(`${NS}.text_loan_submitted`, "Submitted");
    case "approved": return t(`${NS}.text_loan_approved`, "Approved");
    case "disbursed": return t(`${NS}.text_loan_disbursed`, "Active");
    case "repaid": return t(`${NS}.text_loan_repaid`, "Repaid");
    case "rejected": return t(`${NS}.text_loan_rejected`, "Rejected");
    case "closed": return t(`${NS}.text_loan_closed`, "Closed");
    default: return status;
  }
}

export function guarantorStatusLabel(t: Translate, status: string): string {
  switch (status) {
    case "pending": return t(`${NS}.text_guarantor_pending`, "Consent pending");
    case "approved": return t(`${NS}.text_guarantor_approved`, "Guaranteeing");
    case "rejected": return t(`${NS}.text_guarantor_rejected`, "Declined");
    default: return status;
  }
}

export function fnfStatusLabel(t: Translate, status: string): string {
  switch (status) {
    case "pending": return t(`${NS}.text_fnf_pending`, "Pending clearances");
    case "clearance_in_progress": return t(`${NS}.text_fnf_in_progress`, "Clearances in progress");
    case "cleared_for_disbursement": return t(`${NS}.text_fnf_cleared`, "Cleared for disbursement");
    case "disbursed": return t(`${NS}.text_fnf_disbursed`, "Disbursed");
    case "cancelled": return t(`${NS}.text_fnf_cancelled`, "Cancelled");
    default: return status;
  }
}

export function departmentLabel(t: Translate, department: string): string {
  switch (department) {
    case "hr": return t(`${NS}.text_dept_hr`, "Human resources");
    case "it": return t(`${NS}.text_dept_it`, "IT assets");
    case "finance": return t(`${NS}.text_dept_finance`, "Finance");
    case "admin": return t(`${NS}.text_dept_admin`, "Administration");
    default: return department;
  }
}

export function loanPurposeLabel(t: Translate, purpose: string): string {
  switch (purpose) {
    case "medical": return t(`${NS}.text_purpose_medical`, "Medical");
    case "education": return t(`${NS}.text_purpose_education`, "Education");
    case "housing": return t(`${NS}.text_purpose_housing`, "Housing");
    case "marriage": return t(`${NS}.text_purpose_marriage`, "Marriage");
    case "vehicle": return t(`${NS}.text_purpose_vehicle`, "Vehicle");
    case "festival": return t(`${NS}.text_purpose_festival`, "Festival");
    case "personal": return t(`${NS}.text_purpose_personal`, "Personal");
    case "emergency": return t(`${NS}.text_purpose_emergency`, "Emergency");
    default: return purpose;
  }
}

export function interestMethodLabel(t: Translate, method: string): string {
  switch (method) {
    case "reducing_balance": return t(`${NS}.text_interest_reducing`, "Reducing balance");
    case "flat": return t(`${NS}.text_interest_flat`, "Flat rate");
    default: return method;
  }
}
