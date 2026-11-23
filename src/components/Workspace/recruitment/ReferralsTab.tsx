"use client";

import { Award, UserPlus } from "lucide-react";
import styles from "../RecruitmentView.module.css";
import type { Translate } from "../workspaceHttp";
import type { Loadable, ReferralLedger } from "./types";
import { NS } from "./useRecruitmentData";
import { SourceState, formatDate, formatMinor } from "./parts";

type Props = { t: Translate; locale: string | undefined; ledger: Loadable<ReferralLedger>; onRetry: () => void; onRefer: () => void };

/**
 * Tab three: the referral ledger from GET /api/v1/talent-pipeline?view=referrals. Award amounts come only from
 * the tenant's configured referral award scheme; with no scheme the amounts read "not configured", never a default.
 */
export default function ReferralsTab({ t, locale, ledger, onRetry, onRefer }: Props) {
  return (
    <div className={styles.stack}>
      <div className={`${styles.card} ${styles.cardAccentAgent}`}>
        <div className={styles.cardHead}>
          <div>
            <h3><Award size={20} aria-hidden="true" />{t(`${NS}.text_referral_program`, "Employee referral program and bonus ledger")}</h3>
            <p>
              {ledger.status === "ready" && ledger.data.schemeConfigured
                ? t(`${NS}.text_scheme_configured`, "Awards follow the {scheme} scheme: part on joining, the balance on confirmation.", { scheme: ledger.data.schemeCode ?? "" })
                : t(`${NS}.text_scheme_body`, "Referral awards are paid in two parts, on joining and on confirmation, using the amounts in the tenant's referral award scheme.")}
            </p>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={onRefer}><UserPlus size={15} aria-hidden="true" />{t(`${NS}.text_refer_candidate`, "Refer candidate")}</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3>{t(`${NS}.text_referral_ledger`, "Active employee referrals and milestone payout tracking")}</h3>
          {ledger.status === "ready" && <span className={styles.muted}>{t(`${NS}.text_total_referrals`, "Total referrals: {count}", { count: ledger.data.rows.length })}</span>}
        </div>
        <SourceState t={t} source={ledger} onRetry={onRetry}>
          {(data) => (
            <div className={styles.stack}>
              {data.configurationGaps.length > 0 && (
                <ul className={styles.list} aria-label={t(`${NS}.text_configuration_gaps`, "Configuration gaps")}>
                  {data.configurationGaps.map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
              )}
              {data.rows.length === 0 ? (
                <p className={styles.emptyNote}>{t(`${NS}.text_referrals_empty`, "No referrals have been submitted yet.")}</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">{t(`${NS}.text_col_reference`, "Referral ref")}</th>
                        <th scope="col">{t(`${NS}.text_col_candidate`, "Candidate")}</th>
                        <th scope="col">{t(`${NS}.text_col_role`, "Role and department")}</th>
                        <th scope="col">{t(`${NS}.text_col_referred_by`, "Referred by")}</th>
                        <th scope="col">{t(`${NS}.text_col_pipeline`, "Pipeline status")}</th>
                        <th scope="col">{t(`${NS}.text_col_disbursed`, "Disbursed / eligible")}</th>
                        <th scope="col">{t(`${NS}.text_col_next_payout`, "Next payout milestone")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.referralId}>
                          <td className={styles.mono}>{row.reference}<span className={styles.sub}>{formatDate(row.referredOn, locale)}</span></td>
                          <td>{row.candidateName}</td>
                          <td>{row.roleTitle ?? t(`${NS}.text_role_unrecorded`, "Role not recorded")}<span className={styles.sub}>{row.department ?? "—"}</span></td>
                          <td>{row.referredBy ?? "—"}</td>
                          <td><span className={`${styles.badge} ${styles.badgeInfo}`}>{row.pipelineStageLabel ?? row.status}</span></td>
                          <td className={styles.mono}>
                            {row.award.configured && row.award.eligibleMinor !== null
                              ? `${formatMinor(row.award.disbursedMinor ?? 0, row.award.currency, locale)} / ${formatMinor(row.award.eligibleMinor, row.award.currency, locale)}`
                              : t(`${NS}.text_not_configured`, "Not configured")}
                          </td>
                          <td>{row.award.nextMilestone ? <>{row.award.nextMilestone.label}<span className={styles.sub}>{row.award.nextMilestone.requirement}</span></> : t(`${NS}.text_all_paid`, "All milestones paid")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </SourceState>
      </div>
    </div>
  );
}
