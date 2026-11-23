"use client";

import { CheckCircle2, Database, RefreshCw, Server } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, formatDate, formatNumber, useResource, useT } from "./api";
import GlQueuePanel from "./GlQueuePanel";
import type { ErpOverview } from "./types";

/**
 * ERP master sync and GL posting. Connectors and the inbound sync log come from GET /api/v1/compliance/erp-sync.
 * Inbound records are pushed by the ERP to POST /api/v1/compliance/erp-sync; this workspace has no pull
 * connector, so the manual trigger stays visible but disabled with that reason.
 */

type Notify = (title: string, message: string, tone: "success" | "error") => void;
const SYNC_CLASS = { applied: styles.tagGreen, partial: styles.tagAmber, failed: styles.tagAmber, pending: styles.tagBlue } as const;

export default function ErpIntegrationTab({ notify }: { notify: Notify }) {
  const { t, locale } = useT();
  const erp = useResource<ErpOverview>("/api/v1/compliance/erp-sync", t(`${NS}.erp_failed`, "The ERP sync log could not be loaded."));
  const data = erp.state.status === "ready" ? erp.state.data : null;

  const policy = [
    { domain: t(`${NS}.erp_owned`, "ERP-owned"), system: t(`${NS}.erp_owned_system`, "Enterprise ERP"), cls: styles.tagBlue, attrs: t(`${NS}.erp_owned_attrs`, "Legal entity, cost centre, grade / band, currency, bank account"), rule: t(`${NS}.erp_owned_rule`, "Read-only in Nucleus; updated only through inbound ERP records.") },
    { domain: t(`${NS}.nucleus_owned`, "Nucleus-owned"), system: t(`${NS}.nucleus_owned_system`, "Nucleus HRMS core"), cls: styles.tagGreen, attrs: t(`${NS}.nucleus_owned_attrs`, "Attendance, biometric punches, shift rosters, overtime, leave balances, gate passes"), rule: t(`${NS}.nucleus_owned_rule`, "Write-protected: inbound records carrying these fields are rejected.") },
    { domain: t(`${NS}.shared_owned`, "Shared"), system: t(`${NS}.shared_owned_system`, "Bidirectional sync"), cls: styles.tagAmber, attrs: t(`${NS}.shared_owned_attrs`, "Designation, department, corporate email, employment status"), rule: t(`${NS}.shared_owned_rule`, "Synchronised with conflict logging; the latest accepted record wins.") },
  ];

  return (
    <div className={styles.simulatorSection}>
      <div className={styles.simNotice}>
        <Server size={18} aria-hidden="true" />
        <div>
          <strong>{t(`${NS}.erp_notice_title`, "ERP integration and GL posting queue:")}</strong>{" "}
          {t(`${NS}.erp_notice_body`, "Employee master sync with field-ownership governance, and balanced GL journal dispatch with zero-variance verification.")}
        </div>
      </div>

      {erp.state.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.loading`, "Loading…")}</p>}
      {erp.state.status === "error" && <div className={styles.errorNote} role="alert"><span>{erp.state.message}</span><button type="button" className={styles.btnSecondary} onClick={() => void erp.reload()}>{t(`${NS}.retry`, "Retry")}</button></div>}

      {data && (
        <div className={styles.connectorGrid}>
          {data.connectors.length === 0 && <p className={styles.stateNote}>{t(`${NS}.erp_no_connectors`, "No ERP connector is connected. Connect one under Settings → Integrations.")}</p>}
          {data.connectors.map((c) => (
            <div key={c.id} className={styles.connectorCard}>
              <div className={styles.connectorInfo}>
                <h4>{c.code}</h4>
                <p>{c.environment ?? t(`${NS}.not_recorded`, "Not recorded")}</p>
              </div>
              <span className={c.verifiedRoundTrip ? styles.connectedStatus : styles.tagAmber}>
                <CheckCircle2 size={13} aria-hidden="true" />
                {c.verifiedRoundTrip ? t(`${NS}.erp_verified`, "Connected · verified") : t(`${NS}.erp_unverified`, "{status} · not verified", { status: c.status ?? t(`${NS}.not_recorded`, "Not recorded") })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.cardPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h3><Database size={18} aria-hidden="true" /> {t(`${NS}.erp_policy_title`, "Master sync and field-ownership policy")}</h3>
            <p>{t(`${NS}.erp_policy_subtitle`, "Single source of truth between the enterprise ERP and the Nucleus time office.")}</p>
          </div>
          <button type="button" className={styles.btnPrimary} disabled title={t(`${NS}.erp_trigger_unavailable`, "No pull connector exists: inbound records arrive when the ERP pushes them to this workspace.")}>
            <RefreshCw size={14} aria-hidden="true" />{t(`${NS}.erp_trigger`, "Trigger inbound ERP sync")}
          </button>
        </div>
        <p className={styles.metaLine}>{t(`${NS}.erp_trigger_unavailable`, "No pull connector exists: inbound records arrive when the ERP pushes them to this workspace.")}</p>
        <table className={styles.musterTable}>
          <thead>
            <tr>
              <th scope="col">{t(`${NS}.erp_col_domain`, "Field domain")}</th>
              <th scope="col">{t(`${NS}.erp_col_system`, "System of record")}</th>
              <th scope="col">{t(`${NS}.erp_col_attrs`, "Governed attributes")}</th>
              <th scope="col">{t(`${NS}.erp_col_rule`, "Governance policy")}</th>
            </tr>
          </thead>
          <tbody>
            {policy.map((row) => (
              <tr key={row.domain}><td><strong>{row.domain}</strong></td><td><span className={row.cls}>{row.system}</span></td><td>{row.attrs}</td><td className={styles.metaLine}>{row.rule}</td></tr>
            ))}
          </tbody>
        </table>

        <h4>{t(`${NS}.erp_log_title`, "Inbound ERP employee sync log ({count} batches)", { count: data?.syncLog.length ?? 0 })}</h4>
        {data && data.syncLog.length === 0 && <p className={styles.stateNote}>{t(`${NS}.erp_log_empty`, "No inbound ERP records have been received.")}</p>}
        {data && data.syncLog.length > 0 && (
          <div className={styles.musterTableWrap}>
            <table className={styles.musterTable}>
              <thead>
                <tr>
                  <th scope="col">{t(`${NS}.erp_col_batch`, "Batch (day) & last update")}</th>
                  <th scope="col">{t(`${NS}.erp_col_connector`, "Connector")}</th>
                  <th scope="col">{t(`${NS}.erp_col_received`, "Records received")}</th>
                  <th scope="col">{t(`${NS}.erp_col_applied`, "Records applied")}</th>
                  <th scope="col">{t(`${NS}.erp_col_blocked`, "Records blocked")}</th>
                  <th scope="col">{t(`${NS}.erp_col_status`, "Sync status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.syncLog.map((log) => (
                  <tr key={log.key}>
                    <td><strong>{formatDate(log.day, locale) ?? log.day}</strong><div className={styles.metaLine}>{formatDate(log.lastAt, locale, true) ?? ""}</div></td>
                    <td>{log.connector ?? t(`${NS}.erp_direct`, "Direct API")}</td>
                    <td>{formatNumber(log.received, locale)}</td>
                    <td className={styles.textOk}>{formatNumber(log.applied, locale)}</td>
                    <td className={log.blocked > 0 ? styles.textWarn : undefined}>{formatNumber(log.blocked, locale)}</td>
                    <td><span className={SYNC_CLASS[log.status]}>{t(`${NS}.erp_status_${log.status}`, log.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GlQueuePanel notify={notify} />
    </div>
  );
}
