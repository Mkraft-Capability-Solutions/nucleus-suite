"use client";

import { ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import { formatDays, useLeaveResource, useLeaveT, type LeaveEngine } from "./leave-client";

const NS = "components.Leave.LeavePolicyReference";

/**
 * The tenant's leave policy: leave-type rules from `leave_types` and the band
 * accrual rules from `accrual_rules`, both read through GET /api/v1/leave/engine.
 */
export default function LeavePolicyReference() {
  const { t, locale } = useLeaveT();
  const { state, reload } = useLeaveResource<LeaveEngine>("/api/v1/leave/engine", t(`${NS}.text_load_failed`, "The leave policy could not be loaded."));
  const notSet = t(`${NS}.text_not_specified`, "Not specified");
  return (
    <section className={styles.stack} aria-labelledby="leave-policy-title">
      <div>
        <h3 id="leave-policy-title" className={styles.itemTitle}>{t(`${NS}.text_title`, "Leave types and accrual policy")}</h3>
        <p className={styles.sub}>{t(`${NS}.text_notice`, "Configured for your organisation. Changes are made in leave policy administration.")}</p>
      </div>
      <ResourceView resource={state} onRetry={reload}>
        {(data) => (
          <>
            {data.leaveTypeRules.length === 0 ? (
              <div className={styles.state}>{t(`${NS}.text_no_types`, "No leave types are configured yet.")}</div>
            ) : (
              <div className={styles.grid}>
                {data.leaveTypeRules.map((rule) => (
                  <article key={rule.code} className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4>{rule.name}</h4>
                      <span className={`${styles.badge} ${styles.mono}`}>{rule.code}</span>
                    </div>
                    <dl className={styles.list}>
                      <div><dt className={styles.muted}>{t(`${NS}.label_carry`, "Carry forward")}</dt><dd>{rule.carryForward ?? notSet}</dd></div>
                      <div><dt className={styles.muted}>{t(`${NS}.label_monthly`, "Maximum per month")}</dt><dd>{rule.maxPerMonth === null ? notSet : formatDays(rule.maxPerMonth, locale)}</dd></div>
                      <div><dt className={styles.muted}>{t(`${NS}.label_expiry`, "Expiry")}</dt><dd>{rule.expiryRule ?? notSet}</dd></div>
                      <div><dt className={styles.muted}>{t(`${NS}.label_year_end`, "Year end")}</dt><dd>{rule.yearEndAction ?? notSet}</dd></div>
                      <div><dt className={styles.muted}>{t(`${NS}.label_cannot_combine`, "Cannot combine with")}</dt><dd>{rule.cannotCombineWith.length ? rule.cannotCombineWith.join(", ") : notSet}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
            <div className={styles.card}>
              <div className={styles.cardHead}><h4>{t(`${NS}.text_accrual_title`, "Accrual rules by band")}</h4></div>
              {data.bandRules.length === 0 ? (
                <div className={styles.state}>{t(`${NS}.text_no_rules`, "No accrual rules are configured yet.")}</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.muted}>{t(`${NS}.caption_accrual`, "Annual entitlement and credit cycle per policy and band")}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t(`${NS}.col_policy`, "Policy")}</th>
                        <th scope="col">{t(`${NS}.col_band`, "Band")}</th>
                        <th scope="col">{t(`${NS}.col_type`, "Leave type")}</th>
                        <th scope="col">{t(`${NS}.col_annual`, "Annual days")}</th>
                        <th scope="col">{t(`${NS}.col_frequency`, "Accrual")}</th>
                        <th scope="col">{t(`${NS}.col_credit`, "Credit date")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bandRules.map((rule, index) => (
                        <tr key={`${rule.policyCode}-${rule.leaveBand ?? ""}-${rule.leaveType}-${index}`}>
                          <td className={styles.mono}>{rule.policyCode}</td>
                          <td>{rule.leaveBand ?? notSet}</td>
                          <td>{rule.leaveType || notSet}</td>
                          <td>{rule.annualDays === null ? notSet : formatDays(rule.annualDays, locale)}</td>
                          <td>{rule.accrualFrequency ?? notSet}</td>
                          <td>{rule.creditDate ?? notSet}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </ResourceView>
    </section>
  );
}
