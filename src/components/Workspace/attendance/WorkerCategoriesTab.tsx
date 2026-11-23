"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import styles from "../AttendanceView.module.css";
import type { EngineConsole } from "./attendanceApi";
import type { Resource } from "./useResource";
import { formatDate, type Tr } from "./useAttendanceText";
import StateNote from "./StateNote";

function categoryClass(code: string): string {
  const value = code.toUpperCase();
  if (value === "CONTRACT") return styles.badgeAmber;
  if (value.startsWith("THIRD_PARTY")) return styles.badgePurple;
  return styles.badgeBlue;
}

/** Worker-category rules and per-plant holiday calendars from GET /api/v1/attendance/engine. */
export default function WorkerCategoriesTab({ tr, locale, year, engine, onReload }: { tr: Tr; locale: string; year: number; engine: Resource<EngineConsole>; onReload: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (engine.status !== "ready") return <StateNote tr={tr} state={engine} onRetry={onReload} />;
  const { workerCategories, plantCalendars } = engine.data;
  const keyOf = (calendar: EngineConsole["plantCalendars"][number]) => calendar.locationCode ?? calendar.locationName ?? "";
  const plant = plantCalendars.find((calendar) => keyOf(calendar) === selected) ?? plantCalendars[0] ?? null;
  const fact = (value: string | null) => value ?? tr("text_not_configured", "Not configured");

  return (
    <div className={styles.stack}>
      <div className={styles.plantBar}>
        <div>
          <strong>{tr("AttendanceView_text_97", "Active Work Calendar Plant:")}</strong>
          <span className={styles.tiny}> {tr("AttendanceView_text_98", "Rest-day & holiday resolution runs BEFORE shift thresholds.")}</span>
        </div>
        {plantCalendars.length === 0 ? <span className={styles.tiny}>{tr("text_no_plants", "No active locations are configured.")}</span> : (
          <div className={styles.inline} role="group" aria-label={tr("text_choose_plant", "Choose a plant")}>
            {plantCalendars.map((calendar) => (
              <button key={keyOf(calendar)} type="button" aria-pressed={plant !== null && keyOf(plant) === keyOf(calendar)}
                className={`${styles.tabBtn} ${plant !== null && keyOf(plant) === keyOf(calendar) ? styles.tabBtnActive : ""}`} onClick={() => setSelected(keyOf(calendar))}>
                <MapPin size={13} aria-hidden="true" /> {calendar.locationName ?? calendar.locationCode ?? "—"}
              </button>
            ))}
          </div>
        )}
      </div>

      {workerCategories.length === 0 ? <p className={styles.note}>{tr("text_no_categories", "No worker categories are configured for this tenant.")}</p> : (
        <div className={styles.categoryGrid}>
          {workerCategories.map((category) => (
            <div key={category.code} className={styles.categoryCard}>
              <div className={styles.spaceBetween}>
                <span className={`${styles.badge} ${categoryClass(category.code)}`}>{category.code}</span>
                <span className={styles.tiny}>{tr("text_wage_type", "Wage: {type}", { type: fact(category.wageType) })}</span>
              </div>
              <strong>{category.name}</strong>
              <dl className={styles.categoryFacts}>
                <div><dt>{tr("AttendanceView_text_101", "Rest Days:")}</dt><dd>{fact(category.restDayPattern)}</dd></div>
                <div><dt>{tr("AttendanceView_text_103", "OT Eligibility:")}</dt><dd>{fact(category.otEligibility)}</dd></div>
                <div><dt>{tr("AttendanceView_text_105", "Statutory:")}</dt><dd>{fact(category.statutorySet)}</dd></div>
                <div><dt>{tr("text_leave_eligible", "Leave eligible:")}</dt><dd>{fact(category.leaveEligible)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h4>{tr("text_holidays_for", "Holidays for {plant} ({year})", { plant: plant?.locationName ?? plant?.locationCode ?? "—", year })}</h4>
        </div>
        {!plant || plant.holidays.length === 0 ? <p className={styles.note}>{tr("text_no_holidays", "No holidays are recorded for this plant in {year}.", { year })}</p> : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th scope="col">{tr("AttendanceView_text_108", "Date")}</th><th scope="col">{tr("AttendanceView_text_109", "Holiday Name")}</th></tr></thead>
              <tbody>
                {plant.holidays.map((holiday) => (
                  <tr key={`${holiday.date}-${holiday.name}`}><td><strong>{formatDate(locale, holiday.date) ?? holiday.date}</strong></td><td>{holiday.name}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
