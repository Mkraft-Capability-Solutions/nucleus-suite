"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ScrollText, Users } from "lucide-react";
import { Details, EmptyState, ErrorState, IconButton, Panel, SkeletonRows, ui } from "@/design/redesign/ui";
import { useEngine } from "./data";
import { dayLabel, humanise } from "./format";
import styles from "./Attendance.module.css";

/** The organisation's attendance rules: rule pack, worker categories and holiday calendars per site. Read-only. */
export default function Rules() {
  const [year, setYear] = useState(new Date().getFullYear());
  const engine = useEngine(year);
  const data = engine.data;

  if (engine.error) return <ErrorState message={engine.error.message} onRetry={() => void engine.mutate()} />;
  if (!data) return <Panel><SkeletonRows rows={6} columns={3} /></Panel>;

  return (
    <div className={styles.section}>
      <div className={ui.grid2}>
        <Panel title="Rule pack" subtitle="The statutory rule set the attendance engine applies">
          {data.engine.rulePackCode || data.engine.rules.length ? (
            <>
              <Details items={[
                { label: "Rule pack", value: data.engine.rulePackCode },
                { label: "Version", value: data.engine.rulePackVersion },
                { label: "In force from", value: data.engine.effectiveFrom ? dayLabel(data.engine.effectiveFrom, true) : null },
              ]} />
              {data.engine.rules.length > 0 && (
                <ul className={styles.ruleList} aria-label="Rules">
                  {data.engine.rules.map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
              )}
            </>
          ) : <EmptyState icon={ScrollText} title="No rule pack assigned">Assign one under Compliance › Rule packs.</EmptyState>}
        </Panel>

        <Panel title="Worker categories" subtitle="How each category is paid, rested and given overtime" flush>
          {data.workerCategories.length === 0 ? <EmptyState icon={Users} title="No worker categories" /> : (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead><tr><th>Category</th><th>Wage</th><th>Rest day</th><th>Overtime</th><th className={styles.hideSm}>Leave</th></tr></thead>
                <tbody>
                  {data.workerCategories.map((category) => (
                    <tr key={category.code}>
                      <td><span className={styles.person}><span className={styles.personName}>{category.name}</span><span className={styles.personCode}>{category.code}</span></span></td>
                      <td>{humanise(category.wageType)}</td>
                      <td>{category.restDayPattern ?? "—"}</td>
                      <td>{category.otEligibility ?? "—"}</td>
                      <td className={styles.hideSm}>{category.leaveEligible ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Holiday calendars" subtitle="Holidays that apply at each site"
        actions={
          <div className={styles.monthNav}>
            <IconButton label="Previous year" icon={ChevronLeft} variant="ghost" onClick={() => setYear((value) => value - 1)} />
            <span className={styles.monthTitle} aria-live="polite">{year}</span>
            <IconButton label="Next year" icon={ChevronRight} variant="ghost" onClick={() => setYear((value) => value + 1)} />
          </div>
        } flush>
        {data.plantCalendars.length === 0 ? <EmptyState icon={CalendarDays} title="No sites recorded">Add locations in Core HR › Organisation.</EmptyState> : (
          <ul className={styles.sites}>
            {data.plantCalendars.map((site) => (
              <li key={site.locationCode ?? site.locationName}>
                <details className={styles.site}>
                  <summary>
                    <span className={styles.personName}>{site.locationName ?? site.locationCode ?? "Site"}</span>
                    <span className={styles.personCode}>{site.locationCode}</span>
                    <span className={styles.siteCount}>{site.holidayCount} {site.holidayCount === 1 ? "holiday" : "holidays"}</span>
                  </summary>
                  {site.holidays.length === 0 ? <p className={styles.formNote}>No holidays recorded for {year}.</p> : (
                    <ul className={styles.holidays}>
                      {site.holidays.map((holiday) => <li key={`${holiday.date}-${holiday.name}`}><span className={ui.mono}>{dayLabel(holiday.date)}</span><span>{holiday.name}</span></li>)}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
