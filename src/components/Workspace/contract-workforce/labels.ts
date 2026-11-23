import { NS, type ComplianceState, type Translate, type Verdict, type WorkerCategory } from "./api";

/** Localized labels for the enum values the contractor routes return. Keys stay untranslated. */

export function categoryLabel(t: Translate, category: string | null): string {
  switch (category as WorkerCategory | null) {
    case "contract": return t(`${NS}.text_contractual_worker_daily_wages_no_rest_d`, "Contractual Worker (Daily Wages · No Rest Days)");
    case "third-party-employee": return t(`${NS}.text_3rd_party_employee_eligible_for_rest_day`, "3rd Party Employee (Eligible for Rest Days)");
    case "third-party-helper": return t(`${NS}.text_3rd_party_helper_no_rest_days_daily_wage`, "3rd Party Helper (No Rest Days · Daily Wage)");
    default: return category ?? t(`${NS}.text_not_recorded`, "Not recorded");
  }
}

export function categoryRule(t: Translate, category: WorkerCategory): string {
  switch (category) {
    case "contract": return t(`${NS}.text_rule_contract`, "Statutory rule: contractual employees receive daily wages and have no weekly rest days.");
    case "third-party-employee": return t(`${NS}.text_rule_third_party_employee`, "Statutory rule: 3rd party skilled employees are eligible for weekly paid rest days.");
    case "third-party-helper": return t(`${NS}.text_rule_third_party_helper`, "Statutory rule: 3rd party helpers earn daily wage overtime on working hours.");
    default: {
      const unreachable: never = category;
      return unreachable;
    }
  }
}

export function complianceLabel(t: Translate, state: ComplianceState): string {
  switch (state) {
    case "verified": return t(`${NS}.text_compliance_verified`, "Verified");
    case "pending_verification": return t(`${NS}.text_compliance_pending`, "Pending verification");
    case "kyc_incomplete": return t(`${NS}.text_compliance_kyc_incomplete`, "KYC incomplete");
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

export function verdictLabel(t: Translate, verdict: Verdict): string {
  switch (verdict) {
    case "within_tolerance": return t(`${NS}.text_verdict_within_tolerance`, "Within tolerance");
    case "action_required": return t(`${NS}.text_verdict_action_required`, "Action required");
    case "disputed": return t(`${NS}.text_verdict_disputed`, "Disputed");
    case "approved": return t(`${NS}.text_verdict_approved`, "Approved");
    default: {
      const unreachable: never = verdict;
      return unreachable;
    }
  }
}

export function evidenceLabel(t: Translate, evidence: { status: string | null; period: string | null }): string {
  if (!evidence.status) return t(`${NS}.text_evidence_none`, "No filing evidence on record");
  return evidence.period
    ? t(`${NS}.text_evidence_value`, "{status} · {period}", { status: evidence.status, period: evidence.period })
    : evidence.status;
}
