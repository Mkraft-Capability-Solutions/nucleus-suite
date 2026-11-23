"use client";

import { useMemo, useState } from "react";
import { LeaveStatusBadge, ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import { useLeaveResource, useLeaveT, type LeaveHoliday, type LeaveRequestRow } from "./leave-client";

const NS = "components.Leave.LeaveCalendar";
const CLOSED = new Set(["rejected", "cancelled", "canceled", "withdrawn"]);

/**
 * Month view of the given leave requests (from the leave register) with the
 * tenant's holidays from GET /api/v1/leave/holidays. Weekly offs are not drawn:
 * they are set per shift roster, not stored as a tenant leave calendar.
 */
export default function LeaveCalendar({ requests }: { requests: LeaveRequestRow[] }) {
  const { t, locale } = useLeaveT();
  const [employee, setEmployee] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1900;
  const year = Number(month.slice(0, 4));
  const holidays = useLeaveResource<LeaveHoliday[]>(valid ? `/api/v1/leave/holidays?year=${year}` : null, t(`${NS}.text_holidays_failed`, "Holidays could not be loaded."));
  const people = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of requests) byId.set(row.employee_id, row.employee_name ?? row.employee_code ?? row.employee_id);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);
  const count = valid ? new Date(Date.UTC(year, Number(month.slice(5, 7)), 0)).getUTCDate() : 0;
  const holidayByDate = new Map((holidays.state.status === "ready" ? holidays.state.data : []).map((holiday) => [holiday.date, holiday.name]));
  const weekday = new Intl.DateTimeFormat(locale || undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <div className={styles.f}>
          <label htmlFor="leave-calendar-employee">{t(`${NS}.label_scope`, "Employee")}</label>
          <select id="leave-calendar-employee" value={employee} onChange={(event) => setEmployee(event.target.value)}>
            <option value="">{t(`${NS}.option_all`, "Everyone in this list")}</option>
            {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className={`${styles.f} ${valid ? "" : styles.bad}`}>
          <label htmlFor="leave-calendar-month">{t(`${NS}.label_month`, "Month")} <span className={styles.req} aria-hidden="true">*</span></label>
          <input id="leave-calendar-month" type="month" required min="1900-01" max="9999-12" value={month} aria-invalid={!valid} onChange={(event) => setMonth(event.target.value)} />
          {!valid && <span className={styles.msg}>{t(`${NS}.text_select_month`, "Choose a valid month.")}</span>}
        </div>
      </div>
      {holidays.state.status === "error" && <ResourceView resource={holidays.state} onRetry={holidays.reload}>{() => null}</ResourceView>}
      <div className={styles.calendar}>
        {Array.from({ length: count }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, "0")}`;
          const holiday = holidayByDate.get(date);
          const matching = requests.filter(
            (row) =>
              (!employee || row.employee_id === employee) &&
              !CLOSED.has(row.raw_status.toLowerCase()) &&
              (row.starts_on ?? "") <= date &&
              (row.actual_return_date && row.actual_return_date <= (row.ends_on ?? "") ? row.actual_return_date > date : (row.ends_on ?? "") >= date),
          );
          return (
            <div key={date} className={`${styles.day} ${holiday ? styles.dayHoliday : ""}`}>
              <h4 className={styles.dayTitle}>{weekday.format(new Date(`${date}T00:00:00Z`))}</h4>
              {holiday && <span className={`${styles.badge} ${styles.tone_pending}`}>{holiday || t(`${NS}.text_holiday`, "Holiday")}</span>}
              {matching.map((row) => (
                <div key={row.id}>
                  <div className={styles.itemMeta}>{row.employee_name ?? row.employee_code}</div>
                  <LeaveStatusBadge rawStatus={row.raw_status} actualReturnDate={row.actual_return_date} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
