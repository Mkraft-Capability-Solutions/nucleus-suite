import { db } from '@/lib/db';
import { leaveRequestsTable } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { LeaveActor, LeaveInput, LeaveRequest } from '../core/models';
import { canReviewLeave, processApproval, validateLeaveRequest } from '../core/leaveEngine';

export class LeaveService {
  
  public static async getLeaveRequests(tenantId: string, employeeId: string) {
    const records = await db
      .select()
      .from(leaveRequestsTable)
      .where(and(
        eq(leaveRequestsTable.tenantId, tenantId),
        eq(leaveRequestsTable.employeeId, employeeId)
      ));
      
    return records;
  }

  public static async submitLeaveRequest(tenantId: string, input: LeaveInput) {
    // 1. Fetch Balances (Mocking DB fetch for now, assuming schema exists)
    const balances = {
      privilege: { available: 15, total: 20 },
      sick: { available: 5, total: 10 },
      casual: { available: 7, total: 7 }
    };

    // 2. Validate using Core Engine
    validateLeaveRequest(input, balances);

    // 3. Insert into Database
    const [savedRecord] = await db.insert(leaveRequestsTable).values({
      tenantId,
      employeeId: input.employee.id,
      leaveTypeCode: input.leaveTypeCode,
      startsOn: input.startDateStr,
      endsOn: input.endDateStr,
      durationDays: input.numberOfDays,
      chargeableDays: input.numberOfDays,
      status: 'PENDING',
      reason: input.reason || '',
      metadata: { contact: input.contact }
    } as any).returning();

    return savedRecord;
  }

  public static async reviewLeaveRequest(tenantId: string, requestId: string, actor: LeaveActor, action: 'APPROVE' | 'REJECT', remarks: string) {
    const [record] = await db
      .select()
      .from(leaveRequestsTable)
      .where(and(
        eq(leaveRequestsTable.id, requestId),
        eq(leaveRequestsTable.tenantId, tenantId)
      ))
      .limit(1);

    if (!record) throw new Error("Leave request not found");
    const anyRecord = record as any;

    // Transform DB record to Domain Model
    const req: LeaveRequest = {
      id: anyRecord.id,
      employee_id: anyRecord.employeeId,
      employee_name: "Unknown", // Would require JOIN in real app
      leave_type_code: anyRecord.leaveTypeCode,
      leave_type_label: anyRecord.leaveTypeCode,
      start_date: anyRecord.startsOn,
      end_date: anyRecord.endsOn,
      duration_days: anyRecord.durationDays || 0,
      chargeable_days: anyRecord.chargeableDays || 0,
      status: anyRecord.status,
      current_approval_tier: 'MANAGER', // Mocking current tier
      reason: anyRecord.reason || '',
      contact: anyRecord.metadata?.contact || '',
      applied_at: anyRecord.createdAt?.toISOString() || new Date().toISOString(),
      version: 1,
      approval_history: anyRecord.metadata?.approval_history || []
    };

    // Validate Actor Permission
    if (!canReviewLeave(actor, req, "MANAGER_ID_MOCK")) {
      throw new Error("Unauthorized to review this leave");
    }

    // Process
    const processed = processApproval(actor, req, action, remarks);

    // Update DB
    const [updatedRecord] = await db
      .update(leaveRequestsTable)
      .set({
        status: processed.status,
        metadata: {
          ...(anyRecord.metadata || {}),
          approval_history: processed.approval_history
        },
        updatedAt: new Date()
      } as any)
      .where(eq(leaveRequestsTable.id, requestId))
      .returning();

    return updatedRecord;
  }
}
