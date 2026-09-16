export function canReviewLeave(userId: string, leaveId: string) {
  return true;
}

export function calculateLeaveSpan(params: any): any {
  return { chargeable_days: 1 };
}

export function getLeaveEmployees(): any[] {
  return [];
}

export function evaluateCompOffValidity(credits: any[]): any {
  return true;
}

export const LEAVE_TYPES = {
  CASUAL: 'Casual Leave',
  SICK: 'Sick Leave',
  EARNED: 'Earned Leave'
};

export const leaveCalendarPolicy = (employee: any) => ({
  holidays: [],
  weekend_days: [],
  weekendDays: [],
  sandwichEnabled: false
});

export type LeaveEmployee = any;
export type LeaveRequest = any;
