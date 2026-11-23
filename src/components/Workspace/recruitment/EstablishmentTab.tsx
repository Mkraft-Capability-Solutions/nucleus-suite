"use client";

import { Building2, Plus } from "lucide-react";
import styles from "../RecruitmentView.module.css";
import type { Translate } from "../workspaceHttp";
import type { Establishment, Loadable, RequisitionRegister } from "./types";
import { NS } from "./useRecruitmentData";
import { SourceState, formatMinor } from "./parts";

type Props = {
  t: Translate;
  locale: string | undefined;
  establishment: Loadable<Establishment>;
  register: Loadable<RequisitionRegister>;
  onRetry: () => void;
  onRaise: () => void;
};

const STATE_BADGE: Record<string, string> = { within_headroom: "badgeSuccess", at_limit: "badgeWarning", over_plan: "badgeDanger" };
const DISPLAY_BADGE: Record<string, string> = { draft: "badgeMuted", blocked: "badgeDanger", submitted: "badgeInfo", approved: "badgeWarning", filled: "badgeSuccess" };

/**
 * Tab two: approved manpower lines from GET /api/v1/establishment (sanctioned, filled and open derived
 * live) and the requisition register from GET /api/v1/requisition-register.
 */
export default function EstablishmentTab({ t, locale, establishment, register, onRetry, onRaise }: Props) {
  return (
    <div className={styles.stack}>
      <div className={`${styles.card} ${styles.cardAccent}`}>
        <div className={styles.cardHead}>
          <div>
            <h3><Building2 size={20} aria-hidden="true" />{t(`${NS}.text_quota_title`, "Sanctioned manpower quota enforcement")}</h3>
            <p>{t(`${NS}.text_quota_body`, "A replacement backfills a named vacated position and consumes no fresh quota. A new addition is blocked at approval when the department has no headroom left, unless an authorised approver records an override.")}</p>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={onRaise}><Plus size={15} aria-hidden="true" />{t(`${NS}.text_new_requisition`, "New requisition")}</button>
        </div>
      </div>

      <SourceState t={t} source={establishment} onRetry={onRetry}>
        {(data) => data.configured ? (
          <div className={styles.establishmentGrid}>
            {data.lines.map((line) => {
              const used = line.utilisationPercent ?? 0;
              const fill = line.state === "over_plan" || line.state === "at_limit" ? styles.fillFull : used > 75 ? styles.fillWarn : "";
              return (
                <div key={line.manpowerLineId ?? `${line.departmentId}-${line.designation}`} className={styles.deptCapacityCard}>
                  <div className={styles.cardTop}>
                    <div>
                      <strong>{line.departmentName || t(`${NS}.text_unnamed_department`, "Unnamed department")}</strong>
                      <span className={styles.sub}>{line.designation} · {t(`${NS}.text_plan_year`, "Plan {year}", { year: line.planYear })}</span>
                    </div>
                    <span className={`${styles.badge} ${styles[STATE_BADGE[line.state] ?? "badgeMuted"]}`}>
                      {line.headroom <= 0
                        ? t(`${NS}.text_no_headroom`, "No headroom")
                        : t(`${NS}.text_headroom_left`, "{count} open slots", { count: line.headroom })}
                    </span>
                  </div>
                  <div className={styles.capacityBar} role="img" aria-label={t(`${NS}.text_utilisation`, "{percent}% committed", { percent: used })}>
                    <div className={`${styles.capacityFill} ${fill}`} style={{ inlineSize: `${Math.min(100, used)}%` }} />
                  </div>
                  <div className={styles.capStats}>
                    <div>{t(`${NS}.text_sanctioned`, "Sanctioned")}<strong>{line.sanctioned}</strong></div>
                    <div>{t(`${NS}.text_filled`, "Filled")}<strong>{line.filled}</strong></div>
                    <div>{t(`${NS}.text_open_req`, "Open req")}<strong>{line.open}</strong></div>
                    <div>{t(`${NS}.text_headroom`, "Headroom")}<strong>{line.headroom}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyNote}>{t(`${NS}.text_establishment_unconfigured`, "No approved manpower lines exist for {year}, so establishment control is not in force. Headroom is unknown, not zero.", { year: data.planYear })}</p>
        )}
      </SourceState>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3>{t(`${NS}.text_register_title`, "Position requisitions and vacated code backfills")}</h3>
          {register.status === "ready" && <span className={styles.muted}>{t(`${NS}.text_total_openings`, "Total requisitions: {count}", { count: register.data.rows.length })}</span>}
        </div>
        <SourceState t={t} source={register} onRetry={onRetry}>
          {(data) => data.rows.length === 0 ? (
            <p className={styles.emptyNote}>{t(`${NS}.text_register_empty`, "No requisitions have been raised yet.")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t(`${NS}.text_col_code`, "Requisition")}</th>
                    <th scope="col">{t(`${NS}.text_col_title`, "Job title")}</th>
                    <th scope="col">{t(`${NS}.text_col_department`, "Department")}</th>
                    <th scope="col">{t(`${NS}.text_col_type`, "Type")}</th>
                    <th scope="col">{t(`${NS}.text_col_vacated`, "Vacated code / incumbent")}</th>
                    <th scope="col">{t(`${NS}.text_col_budget`, "Budget (annual CTC)")}</th>
                    <th scope="col">{t(`${NS}.text_col_headroom`, "Headroom")}</th>
                    <th scope="col">{t(`${NS}.text_col_status`, "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td className={styles.mono}>{row.code}</td>
                      <td>{row.title ?? "—"}<span className={styles.sub}>{row.position}</span></td>
                      <td>{row.department ?? "—"}</td>
                      <td>
                        <span className={`${styles.badge} ${row.requisitionType === "replacement" ? styles.badgePurple : styles.badgeInfo}`}>
                          {row.requisitionType === "replacement" ? t(`${NS}.text_type_replacement`, "Replacement") : t(`${NS}.text_type_addition`, "New addition")}
                        </span>
                      </td>
                      <td>
                        {row.againstPositionCode
                          ? <><span className={styles.mono}>{row.againstPositionCode}</span><span className={styles.sub}>{row.replacingEmployee ?? t(`${NS}.text_incumbent_unrecorded`, "Incumbent not recorded")}</span></>
                          : <span className={styles.hint}>{t(`${NS}.text_capacity_slot`, "Capacity slot")}</span>}
                      </td>
                      <td className={styles.mono}>{row.terms.ctcMaxMinor === null ? t(`${NS}.text_not_recorded`, "Not recorded") : formatMinor(row.terms.ctcMaxMinor, null, locale)}</td>
                      <td title={row.headroom.detail}>{row.headroom.label}</td>
                      <td title={row.displayStateReason}>
                        <span className={`${styles.badge} ${styles[DISPLAY_BADGE[row.displayState] ?? "badgeMuted"]}`}>{row.displayStateLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SourceState>
      </div>
    </div>
  );
}
