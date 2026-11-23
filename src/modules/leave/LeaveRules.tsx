"use client";

import { ScrollText } from "lucide-react";
import { Details, EmptyState, ErrorState, Panel, SkeletonRows, ui } from "@/design/redesign/ui";
import { useLeaveEngine, useLeaveTypes } from "./data";
import { leaveName, rangeLabel } from "./format";
import styles from "./Leave.module.css";

/** Leave types, the rules each follows, and the entitlement by band. Read-only. */
export default function LeaveRules() {
  const engine = useLeaveEngine();
  const types = useLeaveTypes();
  if (engine.error) return <ErrorState message={engine.error.message} onRetry={() => void engine.mutate()} />;
  if (!engine.data) return <Panel><SkeletonRows rows={6} columns={3} /></Panel>;
  const data = engine.data;
  const typeRows = types.data ?? [];

  return (
    <div className={styles.section}>
      <div className={ui.grid2}>
        <Panel title="Leave types" subtitle="What employees can apply for" flush>
          {typeRows.length === 0 ? <EmptyState icon={ScrollText} title="No leave types recorded" /> : (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead><tr><th>Type</th><th>Code</th><th className={styles.hideSm}>Unit</th></tr></thead>
                <tbody>
                  {typeRows.map((row) => (
                    <tr key={row.id}><td>{leaveName(row.attributes.code, row.attributes.name)}</td><td className={ui.mono}>{row.attributes.code ?? "—"}</td><td className={styles.hideSm}>{row.attributes.unit ?? "day"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Rule pack" subtitle="The statutory leave rules in force">
          {data.engine.rulePackCode || data.engine.rules.length ? (
            <>
              <Details items={[
                { label: "Rule pack", value: data.engine.rulePackCode },
                { label: "Version", value: data.engine.rulePackVersion },
                { label: "In force from", value: data.engine.effectiveFrom ? rangeLabel(data.engine.effectiveFrom, data.engine.effectiveFrom) : null },
              ]} />
              {data.engine.rules.length > 0 && <ul className={styles.ruleList}>{data.engine.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>}
            </>
          ) : (
            <ul className={styles.ruleList}>
              <li>Casual leave: at most 2 days a month, and not combined with earned or sick leave.</li>
              <li>Earned leave: at most 10 days a month.</li>
              <li>Compensatory off lapses 60 days after the day worked.</li>
              <li>Approval: manager, then head of department and HR where the policy needs them. Nobody approves their own leave.</li>
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Carry-forward and limits" subtitle="Per leave type" flush>
        {data.leaveTypeRules.length === 0 ? <EmptyState icon={ScrollText} title="No leave type rules recorded">Configure them under Leave › Leave policies.</EmptyState> : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead><tr><th>Type</th><th>Carry forward</th><th className={styles.hideSm}>Expiry</th><th className={styles.hideSm}>Year end</th><th className={ui.numeric}>Max a month</th><th className={styles.hideSm}>Not with</th></tr></thead>
              <tbody>
                {data.leaveTypeRules.map((rule) => (
                  <tr key={rule.code}>
                    <td>{leaveName(rule.code, rule.name)}</td>
                    <td>{rule.carryForward ?? "—"}</td>
                    <td className={styles.hideSm}>{rule.expiryRule ?? "—"}</td>
                    <td className={styles.hideSm}>{rule.yearEndAction ?? "—"}</td>
                    <td className={ui.numeric}>{rule.maxPerMonth ?? "—"}</td>
                    <td className={styles.hideSm}>{rule.cannotCombineWith.length ? rule.cannotCombineWith.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Entitlement by band" subtitle="Annual days and how they are credited" flush>
        {data.bandRules.length === 0 ? <EmptyState icon={ScrollText} title="No band rules recorded" /> : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead><tr><th>Band</th><th>Type</th><th className={ui.numeric}>Days a year</th><th>Credited</th><th className={styles.hideSm}>Policy</th></tr></thead>
              <tbody>
                {data.bandRules.map((rule, index) => (
                  <tr key={`${rule.policyCode}-${rule.leaveType}-${index}`}>
                    <td>{rule.leaveBand ?? "All"}</td>
                    <td>{leaveName(rule.leaveType)}</td>
                    <td className={ui.numeric}>{rule.annualDays ?? "—"}</td>
                    <td>{[rule.accrualFrequency, rule.creditDate].filter(Boolean).join(" · ") || "—"}</td>
                    <td className={styles.hideSm}>{rule.policyCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
