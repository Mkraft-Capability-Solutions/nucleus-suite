import { sqlClient } from '@/lib/db';
import { attendanceDays } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { computeAttendanceDay } from '../core/timeOfficeEngine';
import { resolveDayType } from '../core/workCalendarService';

export class AttendanceService {
  
  public static async getAttendanceForEmployee(tenantId: string, employeeId: string, month: string) {
    const records = await sqlClient
      .select()
      .from(attendanceDays)
      .where(and(
        eq(attendanceDays.tenantId, tenantId),
        eq(attendanceDays.employeeId, employeeId)
      ));
      
    return records;
  }

  public static async processDailyAttendance(tenantId: string, employeeId: string, date: string, rawPunches: any[]) {
    // 1. Fetch employee details from DB (mocking here since employeesTable fetch is required)
    const employee = {
      location_id: 'LOC-BLR-01',
      worker_category_code: 'PERM',
      designation: 'Software Engineer',
      overrides: {}
    };

    // 2. Resolve Calendar
    const dayContext = resolveDayType({
        calendarId: employee.location_id,
        dateStr: date,
        workerCategoryCode: employee.worker_category_code,
        employeeOverrides: employee.overrides,
        holidays: [],
        workerCategory: { has_rest_days: true, wage_type: 'monthly', ot_eligibility: 'restday_holiday_only' }
    });

    // 3. Compute Attendance Day using Core Engine
    const computed = computeAttendanceDay({
        employee,
        attendanceDate: date,
        rawPunches,
        assignedShiftId: 'SHIFT-8H',
        priorAttendanceDay: null,
        approvedGatePasses: [],
        monthlyLateCount: 0
    });

    // 4. Save to Database
    const [savedRecord] = await sqlClient.insert(attendanceDays).values({
        tenantId,
        employeeId,
        attendanceDate: date,
        assignedShift: computed.shift_id_assigned,
        detectedShift: computed.shift_id_inferred,
        grossSpanMinutes: computed.gross_minutes,
        productiveMinutes: computed.net_minutes,
        breakMinutes: computed.break_minutes,
        creditedGatePassMinutes: computed.gate_pass_minutes,
        payableOtMinutes: computed.ot_minutes,
        status: computed.status,
        exceptionReason: computed.status_reason
    }).returning();

    return savedRecord;
  }
}
