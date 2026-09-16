import { z } from 'zod';

export const leaveActorSchema = z.object({
  id: z.string(),
  employeeId: z.string().nullable().optional(),
  role: z.string(),
  name: z.string(),
});

export type LeaveActor = z.infer<typeof leaveActorSchema>;

export const leaveRequestSchema = z.object({
  id: z.string(),
  employee_id: z.string(),
  employee_name: z.string(),
  leave_type_code: z.string(),
  leave_type_label: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  duration_days: z.number(),
  chargeable_days: z.number(),
  status: z.string(),
  current_approval_tier: z.string(),
  reason: z.string(),
  contact: z.string(),
  applied_at: z.string(),
  version: z.number(),
  approval_history: z.array(z.object({
    action: z.string(),
    reviewer: z.string(),
    timestamp: z.string(),
    remarks: z.string(),
  })),
  comp_allocations: z.array(z.object({
    credit_id: z.string(),
    days: z.number(),
  })).optional(),
});

export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

export const leaveInputSchema = z.object({
  employee: z.object({ id: z.string(), name: z.string() }),
  leaveTypeCode: z.string(),
  startDateStr: z.string(),
  endDateStr: z.string(),
  numberOfDays: z.number(),
  reason: z.string().optional(),
  contact: z.string().optional(),
});

export type LeaveInput = z.infer<typeof leaveInputSchema>;
