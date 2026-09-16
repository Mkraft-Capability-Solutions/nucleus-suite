import { LeaveActor, LeaveInput, LeaveRequest } from './models';

export function canReviewLeave(actor: LeaveActor, app: LeaveRequest, managerId: string) {
  if (actor.employeeId === app.employee_id) return false;
  if (["HR_MANAGER", "SUPER_ADMIN"].includes(actor.role)) return true;
  return (
    app.current_approval_tier === "MANAGER" &&
    managerId === actor.employeeId
  );
}

export function validateLeaveRequest(input: LeaveInput, balances: Record<string, any>) {
  if (input.numberOfDays <= 0) {
    throw new Error('Leave duration must be greater than zero.');
  }

  const balanceKeys: Record<string, string> = {
    PRIVILEGE: "privilege",
    SICK: "sick",
    CASUAL: "casual",
    WELLNESS: "wellness",
    COMP_OFF: "comp_off",
    BIRTHDAY: "birthday",
  };

  const bKey = balanceKeys[input.leaveTypeCode];
  if (!bKey) throw new Error('Invalid leave type');

  const avail = balances[bKey]?.available || 0;
  if (avail < input.numberOfDays) {
    throw new Error(`Insufficient ${input.leaveTypeCode} balance. Available: ${avail}, Requested: ${input.numberOfDays}`);
  }

  return true;
}

export function processApproval(actor: LeaveActor, req: LeaveRequest, action: 'APPROVE' | 'REJECT', remarks: string) {
  req.approval_history.push({
    action,
    reviewer: actor.name,
    timestamp: new Date().toISOString(),
    remarks
  });

  if (action === 'REJECT') {
    req.status = 'REJECTED';
    req.current_approval_tier = 'NONE';
  } else if (action === 'APPROVE') {
    if (req.current_approval_tier === 'MANAGER') {
      // In this setup, Manager is final approver for simplicity, or it goes to HR
      req.status = 'APPROVED';
      req.current_approval_tier = 'NONE';
    } else {
      req.status = 'APPROVED';
      req.current_approval_tier = 'NONE';
    }
  }

  return req;
}
