"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Palmtree } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, IconButton, Panel, SkeletonRows, ui } from "@/design/redesign/ui";
import { monthLabel, monthOf, monthRange, shiftMonth, type Month } from "@/modules/attendance/format";
import { PersonCell, StatStrip, Stacked } from "@/modules/attendance/shared";
import { useRegister } from "./data";
import { daysLabel, isPending, leaveName, overlaps, rangeLabel, requestState } from "./format";
import styles from "./Leave.module.css";

/** Approved and requested leave in a month, for planning cover. Managers see their reporting line. */
export default function WhosAway({ scope }: { scope: Set<string> | null }) {
  const current = monthOf(new Date());
  const [month, setMonth] = useState<Month>(current);
  const register = useRegister();
  const range = monthRange(month);
  const today = new Date().toISOString().slice(0, 10);
  const rows = (register.data ?? [])
    .filter((row) => !scope || scope.has(row.employee_id))
    .filter((row) => row.raw_status === "approved" || isPending(row.raw_status))
    .filter((row) => overlaps(row.starts_on, row.actual_return_date ?? row.ends_on, range.from, range.to))
    .sort((a, b) => (a.starts_on ?? "").localeCompare(b.starts_on ?? ""));
  const awayToday = rows.filter((row) => row.raw_status === "approved" && overlaps(row.starts_on, row.actual_return_date ?? row.ends_on, today, today));
  const isCurrent = month.year === current.year && month.month === current.month;

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <IconButton label="Previous month" icon={ChevronLeft} variant="ghost" onClick={() => setMonth((value) => shiftMonth(value, -1))} />
          <h3 className={styles.monthTitle} aria-live="polite">{monthLabel(month)}</h3>
          <IconButton label="Next month" icon={ChevronRight} variant="ghost" onClick={() => setMonth((value) => shiftMonth(value, 1))} />
          {!isCurrent && <Button size="sm" variant="ghost" onClick={() => setMonth(current)}>This month</Button>}
        </div>
      </div>
      <StatStrip label="Leave this month" items={[
        { label: "Away today", value: awayToday.length, note: awayToday.slice(0, 3).map((row) => row.employee_name).filter(Boolean).join(", ") || undefined },
        { label: `Approved in ${monthLabel(month).split(" ")[0]}`, value: rows.filter((row) => row.raw_status === "approved").length },
        { label: "Awaiting approval", value: rows.filter((row) => isPending(row.raw_status)).length },
      ]} />
      <Panel flush fill>
        {register.error ? <div className={styles.pad}><ErrorState message={register.error.message} onRetry={() => void register.mutate()} /></div>
          : !register.data ? <SkeletonRows rows={5} columns={5} />
            : rows.length === 0 ? <EmptyState icon={Palmtree} title={`Nobody is on leave in ${monthLabel(month)}`} />
              : (
                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <thead><tr><th>Employee</th><th>Leave</th><th>Dates</th><th className={ui.numeric}>Days</th><th>Status</th></tr></thead>
                    <tbody>
                      {rows.map((row) => {
                        const state = requestState(row.raw_status, row.ends_on);
                        return (
                          <tr key={row.id}>
                            <td><Stacked main={<PersonCell name={row.employee_name} code={row.employee_code} />} sub={row.department ?? undefined} /></td>
                            <td>{leaveName(row.leave_type, row.leave_type_name)}</td>
                            <td className={ui.nowrap}><Stacked main={rangeLabel(row.starts_on, row.ends_on)} sub={row.actual_return_date ? `Back early on ${rangeLabel(row.actual_return_date, row.actual_return_date)}` : undefined} /></td>
                            <td className={ui.numeric}>{daysLabel(row.requested_days)}</td>
                            <td><Badge tone={state.tone}>{state.label}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
      </Panel>
    </div>
  );
}
