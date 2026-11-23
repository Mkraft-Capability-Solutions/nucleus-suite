"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { downloadCSV } from "@/utils/exportUtils";
import styles from "../ComplianceView.module.css";
import { NS, formatNumber, useResource, useT } from "./api";
import type { MusterMark, MusterRoll } from "./types";

/** Form 28 muster roll for a month, derived on the server from attendance_days (GET /api/v1/compliance/muster-roll). */

const MARK_CLASS: Record<MusterMark, string> = {
  P: styles.pillPresent, H: styles.pillPresent, WO: styles.pillOff, HOL: styles.pillOff, L: styles.pillLeave, A: styles.pillEL, PEN: styles.pillEL,
};
type LocationOption = { id: string; code: string; name: string };

export default function MusterRollPanel({ notify }: { notify: (title: string, message: string, tone: "success" | "error") => void }) {
  const { t, locale } = useT();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [location, setLocation] = useState("");
  const locations = useResource<{ items: LocationOption[] }>("/api/v1/organization/locations", t(`${NS}.loc_failed`, "Locations could not be loaded."));
  const query = `/api/v1/compliance/muster-roll?month=${encodeURIComponent(month)}${location ? `&location=${encodeURIComponent(location)}` : ""}`;
  const muster = useResource<MusterRoll>(/^\d{4}-\d{2}$/.test(month) ? query : null, t(`${NS}.mr_failed`, "The muster roll could not be loaded."));
  const hours = (minutes: number) => formatNumber(minutes / 60, locale, 1);
  const markLabel = (mark: MusterMark) => t(`${NS}.mark_${mark}`, mark);

  const exportCsv = (roll: MusterRoll) => {
    const headers = [t(`${NS}.mr_col_token`, "Token no"), t(`${NS}.mr_col_name`, "Worker name"), t(`${NS}.mr_col_sex`, "Sex"), t(`${NS}.mr_col_relay`, "Relay / shift"), t(`${NS}.mr_col_work`, "Nature of work"),
      ...Array.from({ length: roll.daysInMonth }, (_, i) => String(i + 1)), t(`${NS}.mr_col_days`, "Days present"), t(`${NS}.mr_col_normal`, "Normal hours"), t(`${NS}.mr_col_ot`, "OT hours")];
    const rows = roll.workers.map((w) => {
      const byDay = new Map(w.days.map((d) => [d.day, d.mark]));
      return [w.tokenNo, w.name, w.sex ?? "", w.relay ?? "", w.natureOfWork, ...Array.from({ length: roll.daysInMonth }, (_, i) => byDay.get(i + 1) ?? ""), w.daysPresent, (w.normalMinutes / 60).toFixed(1), (w.otMinutes / 60).toFixed(1)];
    });
    const result = downloadCSV(`form-28-muster-roll-${roll.month}${roll.location ? `-${roll.location}` : ""}.csv`, headers, rows) as { success: boolean; message?: string };
    notify(t(`${NS}.mr_export_title`, "Form 28 export"), result.success ? t(`${NS}.mr_exported`, "Form 28 muster roll downloaded.") : t(`${NS}.mr_export_empty`, "There are no workers to export for this period."), result.success ? "success" : "error");
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t(`${NS}.mr_month`, "Wage month")}</span>
          <input type="month" className={styles.input} value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t(`${NS}.mr_location`, "Factory / location")}</span>
          <select className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} disabled={locations.state.status !== "ready"}>
            <option value="">{t(`${NS}.mr_all_locations`, "All locations")}</option>
            {locations.state.status === "ready" && locations.state.data.items.map((l) => <option key={l.id} value={l.code}>{l.name} ({l.code})</option>)}
          </select>
        </label>
      </div>

      {muster.state.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.mr_loading`, "Building the muster roll from attendance…")}</p>}
      {muster.state.status === "error" && (
        <div className={styles.errorNote} role="alert"><span>{muster.state.message}</span><button type="button" className={styles.btnSecondary} onClick={() => void muster.reload()}>{t(`${NS}.retry`, "Retry")}</button></div>
      )}
      {muster.state.status === "ready" && (() => {
        const roll = muster.state.data;
        return (
          <>
            <div className={styles.statGrid4}>
              <div className={styles.statCard}>
                <span className={styles.statCardTitle}>{t(`${NS}.mr_kpi_workers`, "Workers on the roll")}</span>
                <span className={styles.statCardValue}>{formatNumber(roll.totals.workers, locale)}</span>
                <span className={styles.statCardSub}>{roll.establishment.factoryLicenceNo ? t(`${NS}.mr_licence`, "Licence: {no}", { no: roll.establishment.factoryLicenceNo }) : t(`${NS}.mr_no_licence`, "Factory licence not recorded")}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statCardTitle}>{t(`${NS}.mr_kpi_normal`, "Normal hours worked")}</span>
                <span className={styles.statCardValue}>{t(`${NS}.hours_value`, "{value} h", { value: hours(roll.totals.normalMinutes) })}</span>
                <span className={styles.statCardSub}>{t(`${NS}.mr_kpi_normal_sub`, "Weekly limit: 48 hours (Section 51)")}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statCardTitle}>{t(`${NS}.mr_kpi_ot`, "Overtime logged (Section 59)")}</span>
                <span className={`${styles.statCardValue} ${roll.totals.otMinutes > 0 ? styles.textWarn : ""}`}>{t(`${NS}.hours_value`, "{value} h", { value: hours(roll.totals.otMinutes) })}</span>
                <span className={styles.statCardSub}>{t(`${NS}.mr_kpi_ot_sub`, "Payable OT from attendance")}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statCardTitle}>{t(`${NS}.mr_kpi_spread`, "Spread-over (≤ 10.5 h/day)")}</span>
                {roll.totals.daysRecorded === 0 ? (
                  <span className={styles.unavailable}>{t(`${NS}.not_available`, "Not available")}</span>
                ) : (
                  <span className={`${styles.statCardValue} ${roll.totals.spreadoverBreaches === 0 ? styles.textOk : styles.textWarn}`}>
                    {roll.totals.spreadoverBreaches === 0 ? t(`${NS}.mr_spread_ok`, "No breaches") : t(`${NS}.mr_spread_breaches`, "{count} day(s) over", { count: roll.totals.spreadoverBreaches })}
                  </span>
                )}
                <span className={styles.statCardSub}>{t(`${NS}.mr_days_recorded`, "{count} attendance day(s) recorded", { count: roll.totals.daysRecorded })}</span>
              </div>
            </div>

            <div className={styles.cardPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h3><FileSpreadsheet size={18} aria-hidden="true" /> {t(`${NS}.mr_title`, "Form 28: Muster roll / adult worker register")}</h3>
                  <p>{roll.establishment.name ?? t(`${NS}.mr_no_entity`, "No legal entity recorded")}{roll.location ? ` · ${roll.location}` : ""}</p>
                </div>
                <button type="button" className={styles.btnSecondary} onClick={() => exportCsv(roll)} disabled={roll.workers.length === 0}>
                  <Download size={14} aria-hidden="true" />{t(`${NS}.mr_export`, "Export Form 28 CSV")}
                </button>
              </div>
              {roll.workers.length === 0 ? (
                <p className={styles.stateNote}>{t(`${NS}.mr_empty`, "No workers were employed in this period for the selected location.")}</p>
              ) : (
                <div className={styles.musterTableWrap}>
                  <table className={styles.musterTable}>
                    <thead>
                      <tr>
                        <th scope="col">{t(`${NS}.mr_col_token_name`, "Token no & name")}</th>
                        <th scope="col">{t(`${NS}.mr_col_relay`, "Relay / shift")}</th>
                        <th scope="col">{t(`${NS}.mr_col_work`, "Nature of work")}</th>
                        <th scope="col">{t(`${NS}.mr_col_daily`, "Daily record")}</th>
                        <th scope="col">{t(`${NS}.mr_col_days`, "Days present")}</th>
                        <th scope="col">{t(`${NS}.mr_col_normal`, "Normal hours")}</th>
                        <th scope="col">{t(`${NS}.mr_col_ot`, "OT hours")}</th>
                        <th scope="col">{t(`${NS}.mr_col_spread`, "Spread-over breaches")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roll.workers.map((w) => (
                        <tr key={w.employeeId}>
                          <td><strong>{w.name}</strong><div className={styles.metaLine}>{w.tokenNo}{w.sex ? ` · ${w.sex}` : ""}</div></td>
                          <td>{w.relay ? <span className={styles.tagBlue}>{w.relay}</span> : <span className={styles.unavailable}>{t(`${NS}.not_recorded`, "Not recorded")}</span>}</td>
                          <td>{w.natureOfWork}</td>
                          <td>
                            {w.days.length === 0 ? <span className={styles.unavailable}>{t(`${NS}.mr_no_days`, "No attendance recorded")}</span> : (
                              <div className={styles.dayPillsScroll}>
                                {w.days.map((d) => (
                                  <span key={d.day} className={`${styles.dayPill} ${MARK_CLASS[d.mark]}`}
                                    title={t(`${NS}.mr_day_title`, "Day {day}: {mark} · {hours} h · OT {ot} h", { day: d.day, mark: markLabel(d.mark), hours: hours(d.normalMinutes), ot: hours(d.otMinutes) })}>
                                    {d.mark === "P" && d.otMinutes > 0 ? t(`${NS}.mark_OT`, "OT") : d.mark}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={styles.boldCell}>{formatNumber(w.daysPresent, locale, 1)}</td>
                          <td>{t(`${NS}.hours_value`, "{value} h", { value: hours(w.normalMinutes) })}</td>
                          <td className={w.otMinutes > 0 ? styles.textWarn : undefined}>{t(`${NS}.hours_value`, "{value} h", { value: hours(w.otMinutes) })}</td>
                          <td className={w.spreadoverBreaches > 0 ? styles.textWarn : undefined}>{formatNumber(w.spreadoverBreaches, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
