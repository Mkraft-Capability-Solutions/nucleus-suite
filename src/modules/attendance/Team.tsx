"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search, Users } from "lucide-react";
import { Avatar, Button, Drawer, EmptyState, ErrorState, IconButton, Input, Panel, Select, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import { downloadCSV } from "@/utils/exportUtils";
import { useTeam, type TeamMember } from "./data";
import { attendanceRate, hoursLabel, monthLabel, monthOf, monthRange, shiftMonth, type Month } from "./format";
import { MonthView } from "./month";
import { StatStrip } from "./shared";
import styles from "./Attendance.module.css";

type SortKey = "name" | "department" | "present" | "absent" | "rate" | "hours" | "overtime";

const name = (member: TeamMember) => `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() || member.employeeCode;
const rateOf = (member: TeamMember) => attendanceRate({ present: member.present, half_day: member.halfDay, absent: member.absent });

export default function Team({ canDecide, canRequest, onRequestRegularisation }: { canDecide: boolean; canRequest: boolean; onRequestRegularisation: (date: string, employeeId: string) => void }) {
  const current = monthOf(new Date());
  const [month, setMonth] = useState<Month>(current);
  const range = monthRange(month);
  const team = useTeam(range.from, range.to, true);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "name", desc: false });
  const [open, setOpen] = useState<TeamMember | null>(null);
  const isCurrent = month.year === current.year && month.month === current.month;

  const members = useMemo<TeamMember[]>(() => team.data?.employees ?? [], [team.data]);
  const departments = useMemo<string[]>(() => Array.from(new Set(members.map((member) => member.department).filter((value): value is string => Boolean(value)))).sort(), [members]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const value = (member: TeamMember): string | number => ({
      name: name(member).toLowerCase(), department: (member.department ?? "").toLowerCase(), present: member.present + member.halfDay * 0.5,
      absent: member.absent, rate: rateOf(member) ?? -1, hours: member.productiveMinutes, overtime: member.payableOtMinutes,
    })[sort.key];
    return members
      .filter((member) => (!department || member.department === department) && (!needle || `${name(member)} ${member.employeeCode} ${member.designation}`.toLowerCase().includes(needle)))
      .sort((a, b) => {
        const left = value(a);
        const right = value(b);
        const order = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
        return sort.desc ? -order : order;
      });
  }, [members, query, department, sort]);

  const summary = team.data?.summary;
  const overallRate = summary ? attendanceRate({ present: summary.present, half_day: summary.halfDay, absent: summary.absent }) : null;
  const sortHeader = (key: SortKey, label: string, numeric = false) => (
    <th className={cx(numeric && ui.numeric)} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" className={ui.sortButton} onClick={() => setSort((value) => ({ key, desc: value.key === key ? !value.desc : numeric }))}>
        {label}{sort.key === key && (sort.desc ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />)}
      </button>
    </th>
  );

  function exportCsv() {
    downloadCSV(`attendance-${range.from.slice(0, 7)}.csv`,
      ["Employee code", "Name", "Designation", "Department", "Location", "Recorded days", "Present", "Half days", "Absent", "Other", "Attendance %", "Hours worked", "Payable overtime (h)"],
      rows.map((member) => [member.employeeCode, name(member), member.designation, member.department, member.location, member.recordedDays, member.present, member.halfDay, member.absent, member.other,
        rateOf(member) ?? "", (member.productiveMinutes / 60).toFixed(1), (member.payableOtMinutes / 60).toFixed(1)]));
  }

  return (
    <div className={styles.section}>
      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <IconButton label="Previous month" icon={ChevronLeft} variant="ghost" onClick={() => setMonth((value) => shiftMonth(value, -1))} />
          <h3 className={styles.monthTitle} aria-live="polite">{monthLabel(month)}</h3>
          <IconButton label="Next month" icon={ChevronRight} variant="ghost" onClick={() => setMonth((value) => shiftMonth(value, 1))} disabled={isCurrent} />
          {!isCurrent && <Button size="sm" variant="ghost" onClick={() => setMonth(current)}>This month</Button>}
        </div>
        <div className={styles.toolbarEnd}>
          <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search people" placeholder="Search name or code" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          {departments.length > 1 && (
            <Select aria-label="Department" value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="">All departments</option>
              {departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </Select>
          )}
          <Button icon={Download} onClick={exportCsv} disabled={rows.length === 0}>Export</Button>
        </div>
      </div>

      {summary && (
        <StatStrip label={`Team summary for ${monthLabel(month)}`} items={[
          { label: team.data?.scope.kind === "tenant" ? "Employees" : "In your team", value: summary.visibleEmployees },
          { label: "Attendance", value: overallRate === null ? "—" : `${overallRate}%`, note: "of working days" },
          { label: "Absent days", value: summary.absent, tone: summary.absent ? "danger" : undefined },
          { label: "Half days", value: summary.halfDay },
          { label: "Hours worked", value: hoursLabel(summary.productiveMinutes) },
          { label: "Payable overtime", value: hoursLabel(summary.payableOtMinutes) },
        ]} />
      )}

      <Panel flush fill>
        {team.error ? <div className={styles.pad}><ErrorState message={team.error.message} onRetry={() => void team.mutate()} /></div>
          : !team.data ? <SkeletonRows rows={8} columns={7} />
            : rows.length === 0 ? <EmptyState icon={Users} title={members.length ? "Nobody matches" : "No attendance recorded"}>{members.length ? "Try another search or department." : `Nobody in your scope has attendance recorded for ${monthLabel(month)}.`}</EmptyState>
              : (
                <div className={ui.tableWrap}>
                  <table className={ui.table}>
                    <thead>
                      <tr>
                        {sortHeader("name", "Employee")}
                        {sortHeader("department", "Department")}
                        {sortHeader("present", "Present", true)}
                        {sortHeader("absent", "Absent", true)}
                        {sortHeader("rate", "Attendance", true)}
                        {sortHeader("hours", "Hours worked", true)}
                        {sortHeader("overtime", "Overtime", true)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((member) => {
                        const rate = rateOf(member);
                        return (
                          <tr key={member.id} className={ui.rowClickable} onClick={() => setOpen(member)}>
                            <td>
                              <button type="button" className={styles.personButton} onClick={(event) => { event.stopPropagation(); setOpen(member); }}>
                                <Avatar name={name(member)} size={28} />
                                <span className={styles.person}><span className={styles.personName}>{name(member)}</span><span className={styles.personCode}>{member.employeeCode}{member.designation ? ` · ${member.designation}` : ""}</span></span>
                              </button>
                            </td>
                            <td><span className={styles.cellTruncate}>{member.department || "—"}</span></td>
                            <td className={ui.numeric}>{member.present}{member.halfDay ? <span className={ui.muted}> + {member.halfDay}½</span> : null}</td>
                            <td className={cx(ui.numeric, member.absent > 0 && styles["text-danger"])}>{member.absent}</td>
                            <td className={ui.numeric}>
                              <span className={styles.rate}>
                                <span className={styles.rateBar} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, rate ?? 0))}%` }} className={cx(rate !== null && rate < 85 && styles.rateLow)} /></span>
                                {rate === null ? "—" : `${rate}%`}
                              </span>
                            </td>
                            <td className={ui.numeric}>{hoursLabel(member.productiveMinutes)}</td>
                            <td className={ui.numeric}>{member.payableOtMinutes ? hoursLabel(member.payableOtMinutes) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
      </Panel>

      {open && (
        <Drawer open onOpenChange={(next) => { if (!next) setOpen(null); }} title={name(open)}
          description={[open.employeeCode, open.designation, open.department, open.location].filter(Boolean).join(" · ")}>
          <div className={styles.drawerStack}>
            <MonthView key={open.id} employeeId={open.id} canDecide={canDecide} canRequest={canRequest} initialMonth={month} compact
              onRequestRegularisation={(date) => { const id = open.id; setOpen(null); onRequestRegularisation(date, id); }} />
          </div>
        </Drawer>
      )}
    </div>
  );
}
