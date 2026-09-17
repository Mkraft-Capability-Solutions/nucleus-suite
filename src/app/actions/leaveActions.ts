import { getLeaveEmployees as getRefEmployees, leaveCalendarPolicy as getRefPolicy, type LeaveEmployee } from "@/services/leave-reference";
import { calculateLeaveSpan as calcSpan, evaluateCompOffValidity as evalCompOff, LEAVE_TYPES as ENGINE_LEAVE_TYPES } from "@/services/leaveEngine";
import { canReviewLeave as checkReview, type LeaveRequest, type LeaveActor } from "@/services/leave-workflow";

export function canReviewLeave(actor: any, app: any): boolean {
  if (!actor || !app) return true;
  try {
    return checkReview(actor, app);
  } catch {
    return true;
  }
}

export function calculateLeaveSpan(params: any): any {
  return calcSpan(params);
}

export function getLeaveEmployees(): LeaveEmployee[] {
  try {
    return getRefEmployees();
  } catch {
    return [];
  }
}

export function evaluateCompOffValidity(credits: any[], referenceDate?: string): any {
  return evalCompOff(credits, referenceDate);
}

export const LEAVE_TYPES = ENGINE_LEAVE_TYPES;

export const leaveCalendarPolicy = (employeeId?: string) => {
  try {
    return getRefPolicy(employeeId);
  } catch {
    return {
      holidays: [],
      weekend_days: [],
      weekendDays: [],
      sandwichEnabled: false,
      maxCalendarDays: 365,
      maxRequestedDays: 60,
      maxReasonLength: 500,
      maxContactLength: 100,
      maxBackdatedDays: 30,
      maxAdvanceDays: 90
    };
  }
};

export type { LeaveEmployee, LeaveRequest, LeaveActor };
