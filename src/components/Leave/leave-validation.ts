/**
 * Client-side mirror of the leave submit rules enforced by POST
 * /api/v1/leave-requests (requestLeaveSchema + request-guards). The server
 * stays authoritative; this only gives inline feedback before submit.
 */

/** Leave types the submit API accepts. */
export const REQUESTABLE_TYPES = new Set(["EL", "CL", "SL", "COFF", "BIRTHDAY"]);

/** Types whose ledger balance must cover the request (INV-LEV-01). */
export const BALANCE_CHECKED_TYPES = new Set(["EL", "CL", "SL", "COFF"]);

export type LeaveField = "employee" | "leaveType" | "startsOn" | "endsOn" | "days" | "reason" | "contact";

export type LeaveDraft = {
  leaveType: string;
  startsOn: string;
  endsOn: string;
  duration: "full" | "first_half" | "second_half";
  days: string;
  reason: string;
  contact: string;
};

type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string;

const NS = "components.Leave.leaveValidation";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function spanDays(startsOn: string, endsOn: string): number | null {
  if (!ISO.test(startsOn) || !ISO.test(endsOn)) return null;
  const span = Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1;
  return Number.isFinite(span) ? span : null;
}

export function validateLeaveApplication(
  draft: LeaveDraft,
  facts: { available: number | null; hasEmployee: boolean },
  t: Translate,
): Partial<Record<LeaveField, string>> {
  const errors: Partial<Record<LeaveField, string>> = {};
  if (!facts.hasEmployee) errors.employee = t(`${NS}.employee_required`, "Choose the employee taking leave.");
  if (!draft.leaveType) errors.leaveType = t(`${NS}.type_required`, "Choose a leave type.");
  else if (!REQUESTABLE_TYPES.has(draft.leaveType)) errors.leaveType = t(`${NS}.type_not_requestable`, "This leave type is applied for through HR.");
  if (!ISO.test(draft.startsOn)) errors.startsOn = t(`${NS}.from_required`, "Enter the first day of leave.");
  if (!ISO.test(draft.endsOn)) errors.endsOn = t(`${NS}.to_required`, "Enter the last day of leave.");
  const span = spanDays(draft.startsOn, draft.endsOn);
  if (span !== null && span < 1) errors.endsOn = t(`${NS}.to_before_from`, "The last day cannot be before the first day.");
  const days = Number(draft.days);
  if (draft.days.trim() === "" || !Number.isFinite(days) || days <= 0) {
    errors.days = t(`${NS}.days_required`, "Enter the number of days.");
  } else if (days > 60) {
    errors.days = t(`${NS}.days_max`, "A single request can cover at most 60 days.");
  } else if (Math.round(days * 2) !== days * 2) {
    errors.days = t(`${NS}.days_step`, "Leave is taken in steps of half a day.");
  } else if (span !== null && span >= 1 && days > span) {
    errors.days = t(`${NS}.days_exceed_span`, "More days than the period contains.");
  } else if (draft.duration !== "full" && days !== 0.5) {
    errors.days = t(`${NS}.days_half`, "A half day is 0.5 days.");
  } else if (BALANCE_CHECKED_TYPES.has(draft.leaveType) && facts.available !== null && days > facts.available) {
    errors.days = t(`${NS}.days_balance`, "Only {available} day(s) are available.", { available: Math.max(facts.available, 0) });
  }
  if (draft.reason.length > 500) errors.reason = t(`${NS}.reason_max`, "Keep the reason under 500 characters.");
  if (draft.contact.length > 200) errors.contact = t(`${NS}.contact_max`, "Keep the contact under 200 characters.");
  return errors;
}
