import { readData } from "./workspace-data.mjs";
import { DEFAULT_ROLE_PROFILES } from "./auth-defaults";
export type LeaveEmployee = {
  employeeId: string;
  name: string;
  location?: string;
  birthDate?: string;
  joinedOn?: string;
  band?: string;
  leaveEligible?: boolean;
  active?: boolean;
  weekendDays?: number[];
};
/** Explicit source IDs are preserved. This does not link an E-prefixed employee to an MK persona. */
export function getLeaveEmployees(): LeaveEmployee[] {
  const workbook = readData("workbook").sheets;
  const profiles = (
    Object.values(DEFAULT_ROLE_PROFILES) as LeaveEmployee[]
  )
    .filter((profile) => profile.employeeId)
    .map((profile) => ({ employeeId: profile.employeeId, name: profile.name }));
  const employees = workbook["12_Employees"]
    .filter((row: Record<string, string>) =>
      /^E\d+$/.test(row["Employee code"]),
    )
    .map((row: Record<string, string>) => {
      const designation = workbook["05_Designations"].find(
        (item: Record<string, string>) =>
          item["Designation code"] === row.Designation,
      );
      const worker = workbook["06_Worker_Classes"].find(
        (item: Record<string, string>) =>
          item["Class code"] === row["Worker class"],
      );
      return {
        employeeId: row["Employee code"],
        name: row["Full name"],
        location: row.Location,
        birthDate: row["Date of birth"],
        joinedOn: row["Date of joining"],
        band: designation?.["Leave band"],
        leaveEligible: worker?.["Leave eligible"]?.startsWith("Y") ?? false,
        active: row.Status === "Active",
        weekendDays:
          worker?.["Rest day pattern"] === "Sunday weekly off" ? [0] : [],
      };
    });
  return [...profiles, ...employees];
}
export function leaveCalendarPolicy(employeeId?: string) {
  const policy = readData("leave.workflow", "policy");
  const employee = getLeaveEmployees().find(
    (item) => item.employeeId === employeeId,
  );
  const holidays = readData("workbook")
    .sheets["09_Holiday_Calendar"].filter(
      (row: Record<string, string>) =>
        /^\d{4}-\d{2}-\d{2}$/.test(row.Date) &&
        (row["Applicable locations"] === "ALL" ||
          (employee?.location &&
            row["Applicable locations"]
              ?.split(",")
              .includes(employee.location))),
    )
    .map((row: Record<string, string>) => row.Date);
  return {
    ...policy,
    holidays: [...new Set([...policy.holidays, ...holidays])],
    weekendDays: employee?.weekendDays ?? policy.weekendDays,
  };
}
export function workbookLeaveReferences() {
  const types = readData("services.leaveEngine", "LEAVE_TYPES_1");
  const aliases = readData("leave.workflow", "typeAliases");
  const statuses = readData("leave.workflow", "statusAliases");
  return readData("workbook")
    .sheets["18_Leave_Requests"].filter((row: Record<string, string>) =>
      /^LV-/.test(row["Request ID"]),
    )
    .map((row: Record<string, string>) => ({
      id: row["Request ID"],
      employee_id: row["Employee code"],
      employee_name: row.Name,
      leave_type_code: aliases[row["Leave type"]] ?? row["Leave type"],
      leave_type_label:
        types[aliases[row["Leave type"]]]?.label ?? row["Leave type"],
      start_date: row.From,
      end_date: row.To,
      duration_days: Number(row["Days applied"]),
      chargeable_days: Number(row["Days availed"] ?? row["Days applied"]),
      status: statuses[row.Status] ?? row.Status,
      current_approval_tier:
        row.Status === "Pending" ? "SUPERVISOR" : "COMPLETED",
      reason: row["HR edit"] ?? "",
      contact: "",
      applied_at: "",
      version: 1,
      approval_history: [],
      reference_only: true,
      source_status: row.Status,
    }));
}

export function workbookCompOffCredits() {
  return readData("workbook")
    .sheets["19_CompOff_Ledger"].filter((row: Record<string, string>) =>
      /^CO-/.test(row["Credit ID"]),
    )
    .map((row: Record<string, string>) => ({
      id: row["Credit ID"],
      employee_id: row["Employee code"],
      credited_at: row["Earned on"],
      days: Number(row.Days),
      remaining_days: Number(row["Days remaining"]),
      status:
        row.Status === "Consumed"
          ? "USED"
          : row.Status === "Lapsed"
            ? "LAPSED_60_DAYS"
            : "ACTIVE",
      source: row.Reason,
    }));
}
