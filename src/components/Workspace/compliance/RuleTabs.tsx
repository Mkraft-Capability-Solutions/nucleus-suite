"use client";

import { Building2, CheckCircle2, Scale } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, formatDate, formatMoney, formatNumber, useT, type Resource } from "./api";
import type { RulePacks } from "./types";

/** State rule matrix and rule-pack inspector, both from GET /api/v1/compliance/rule-packs. */

function States({ packs, reload }: { packs: Resource<RulePacks>; reload: () => Promise<void> }) {
  const { t } = useT();
  if (packs.status === "loading") return <p className={styles.stateNote}>{t(`${NS}.loading`, "Loading…")}</p>;
  if (packs.status === "error") return <div className={styles.errorNote} role="alert"><span>{packs.message}</span><button type="button" className={styles.btnSecondary} onClick={() => void reload()}>{t(`${NS}.retry`, "Retry")}</button></div>;
  return null;
}

export function StateMatrixTab({ packs, reload }: { packs: Resource<RulePacks>; reload: () => Promise<void> }) {
  const { t, locale } = useT();
  const nr = <span className={styles.unavailable}>{t(`${NS}.not_recorded`, "Not recorded")}</span>;
  return (
    <div className={styles.matrixSection}>
      <div className={styles.matrixNotice}>
        <Scale size={18} aria-hidden="true" />
        <div>
          <strong>{t(`${NS}.sm_notice_title`, "Multi-state jurisdictional rule engine:")}</strong>{" "}
          {t(`${NS}.sm_notice_body`, "States notify the Labour Codes unevenly, so each state's rules live in a versioned, effective-dated rule pack.")}
        </div>
      </div>
      <States packs={packs} reload={reload} />
      {packs.status === "ready" && (packs.data.states.length === 0 ? (
        <p className={styles.stateNote}>{t(`${NS}.sm_empty`, "No state-scoped rule pack is stored yet, so no state rules can be shown.")}</p>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th scope="col">{t(`${NS}.sm_col_state`, "State / union territory")}</th>
                <th scope="col">{t(`${NS}.sm_col_wages`, "Code on Wages")}</th>
                <th scope="col">{t(`${NS}.sm_col_ss`, "Social Security Code")}</th>
                <th scope="col">{t(`${NS}.sm_col_floor`, "Minimum wage floor (monthly)")}</th>
                <th scope="col">{t(`${NS}.sm_col_ot`, "Overtime limit & multiplier")}</th>
                <th scope="col">{t(`${NS}.sm_col_night`, "Women night-shift rules")}</th>
              </tr>
            </thead>
            <tbody>
              {packs.data.states.map((s) => (
                <tr key={s.stateCode}>
                  <td><span className={styles.rowBetween}><Building2 size={16} aria-hidden="true" /><strong>{s.stateName ?? s.stateCode}</strong></span><div className={styles.metaLine}>{[s.packCode, s.versionCode].filter(Boolean).join(" · ")}</div></td>
                  <td>{s.codeOnWages ? <span className={styles.tagGreen}>{s.codeOnWages}</span> : nr}</td>
                  <td>{s.socialSecurityCode ? <span className={styles.tagBlue}>{s.socialSecurityCode}</span> : nr}</td>
                  <td className={styles.boldCell}>{formatMoney(s.minimumWageMonthlyMinor, s.currency, locale) ?? nr}</td>
                  <td>{s.overtimeRule ?? nr}</td>
                  <td>{s.womenNightShiftRule ? <span className={styles.textMuted}>{s.womenNightShiftRule}</span> : nr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function RulePacksTab({ packs, reload }: { packs: Resource<RulePacks>; reload: () => Promise<void> }) {
  const { t, locale } = useT();
  const nr = t(`${NS}.not_recorded`, "Not recorded");
  return (
    <div className={styles.packsSection}>
      <States packs={packs} reload={reload} />
      {packs.status === "ready" && packs.data.versions.length === 0 && <p className={styles.stateNote}>{t(`${NS}.rp_empty`, "No rule pack is stored in this environment.")}</p>}
      {packs.status === "ready" && packs.data.versions.slice(0, 10).map((v) => (
        <div key={v.versionId} className={styles.packCard}>
          <div className={styles.packHeader}>
            <div>
              <span className={styles.packTag}>{v.assigned ? t(`${NS}.rp_active`, "Active rule pack") : t(`${NS}.rp_available`, "Available version")}</span>
              <h3>{[v.packCode, v.versionCode].filter(Boolean).join(" ") || nr}</h3>
              <p>
                {t(`${NS}.rp_meta`, "Effective from {date} · Supersedes {prior} · Jurisdiction: {jurisdiction}", {
                  date: formatDate(v.effectiveFrom, locale) ?? nr, prior: v.supersedes ?? nr, jurisdiction: v.jurisdiction ?? v.stateCode ?? nr,
                })}
              </p>
              <p className={styles.metaLine}>
                {t(`${NS}.rp_contents`, "{rates} contribution rate(s) · wage floor {floor}", { rates: v.rateCount, floor: v.wageFloorPercent === null ? nr : `${formatNumber(v.wageFloorPercent, locale, 2)}%` })}
              </p>
            </div>
            <div className={styles.testBadge}>
              <CheckCircle2 size={18} aria-hidden="true" />
              {v.goldenTests ? t(`${NS}.rp_golden`, "{passed} / {total} golden tests passing", v.goldenTests) : t(`${NS}.rp_golden_none`, "No golden-test result recorded")}
            </div>
          </div>
          <div className={styles.codePreview}>
            <pre>{JSON.stringify(v.attributes, null, 2)}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}
