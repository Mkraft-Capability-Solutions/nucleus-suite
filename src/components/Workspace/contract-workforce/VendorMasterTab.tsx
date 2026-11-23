"use client";

import { Building2 } from "lucide-react";
import { launchAction } from "@/lib/action-launcher";
import styles from "../ContractWorkforceView.module.css";
import { NS, type Agency, type Loadable, type Translate } from "./api";
import { evidenceLabel } from "./labels";

/**
 * Staffing vendor master from GET /api/v1/contractors/agencies. PF/ESIC states are the latest
 * contractor_statutory_evidence rows. There is no vendor audit-rating or SLA table, so those two elements are shown
 * as unavailable with the reason instead of a number.
 */
export default function VendorMasterTab({ t, state, onRetry }: { t: Translate; state: Loadable<Agency[]>; onRetry: () => void }) {
  if (state.status === "loading") return <p className={styles.stateNote}>{t(`${NS}.text_vendors_loading`, "Loading the vendor master…")}</p>;
  if (state.status === "error") {
    return (
      <div className={styles.stateError} role="alert">
        <span>{state.message}</span>
        <button type="button" className={styles.btnSecondary} onClick={onRetry}>{t(`${NS}.text_retry`, "Retry")}</button>
      </div>
    );
  }
  if (state.data.length === 0) return <p className={styles.stateNote}>{t(`${NS}.text_vendors_empty`, "No staffing agencies are on record yet.")}</p>;
  const notRecorded = t(`${NS}.text_not_recorded`, "Not recorded");
  const unavailable = t(`${NS}.text_unavailable_no_source`, "Not available: no vendor rating or SLA record is kept yet.");

  return (
    <div className={styles.vendorsSection}>
      <div className={styles.vendorsGrid}>
        {state.data.map((v) => (
          <article key={v.id} className={styles.vendorCard}>
            <div className={styles.vendorHead}>
              <Building2 size={24} aria-hidden="true" />
              <div>
                <h4>{v.name ?? notRecorded}</h4>
                <span className={styles.siteText}>
                  {t(`${NS}.text_vendor_ids`, "ID: {code} · Licence: {licence}", { code: v.code ?? notRecorded, licence: v.licenceNumber ?? notRecorded })}
                </span>
              </div>
            </div>
            <dl className={styles.vendorDetails}>
              <div><dt>{t(`${NS}.text_active_personnel`, "Active personnel:")}</dt><dd>{t(`${NS}.text_deployed_count`, "{count} deployed under {contracts} contracts", { count: v.workerCount, contracts: v.contractCount })}</dd></div>
              <div><dt>{t(`${NS}.text_pf_ecr`, "PF monthly ECR:")}</dt><dd><span className={v.pfEvidence.status ? styles.tagGreen : styles.tagMuted}>{evidenceLabel(t, v.pfEvidence)}</span></dd></div>
              <div><dt>{t(`${NS}.text_esic_return`, "ESIC return:")}</dt><dd><span className={v.esicEvidence.status ? styles.tagBlue : styles.tagMuted}>{evidenceLabel(t, v.esicEvidence)}</span></dd></div>
              <div><dt>{t(`${NS}.text_audit_rating`, "Audit quality rating:")}</dt><dd className={styles.unavailable}>{unavailable}</dd></div>
            </dl>
            <div className={styles.vendorBottom}>
              <button type="button" className={styles.btnSecondary} disabled title={unavailable}>{t(`${NS}.text_contract_sla`, "Contract SLA")}</button>
              <button type="button" className={styles.btnPrimary} onClick={() => launchAction("filing", { entity: v.name ?? v.id })}>{t(`${NS}.text_verify_filings`, "Verify filings")}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
