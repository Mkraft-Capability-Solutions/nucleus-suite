"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { useHRMS } from "@/context/HRMSContext";
import LeaveEmployeeSelect from "./LeaveEmployeeSelect";
import { Badge, FormError, ResourceView } from "./LeaveBits";
import styles from "./Leave.module.css";
import {
  announceLeaveChanged,
  formatDays,
  postLeave,
  useLeaveResource,
  useLeaveT,
  useSubmitKey,
  type AllocationNote,
  type AllocationPreview,
  type LeaveContext,
  type LeaveEmployee,
  type LeaveEngine,
} from "./leave-client";

const NS = "components.Leave.LeaveCreditAllocationPanel";

const NOTES: Record<AllocationNote, string> = {
  senior_management_annual: "Senior management: the full annual EL, CL and SL are credited on 1 January.",
  regular_monthly_el: "EL accrues monthly through the accrual run.",
  new_joiner_waiting: "Less than six months of service: EL starts after six months.",
  prorated_cl_sl: "CL and SL are prorated from the joining date.",
  trainee_cl_only: "Trainee: CL is not credited for this trainee type.",
  birthday_eligible: "One birthday leave day (date of birth on record).",
  contractual_no_credit: "Contract and third-party workers receive no leave credit.",
};
const CODES = ["EL", "CL", "SL", "BIRTHDAY"] as const;
type ShowToast = (title: string, message: string, tone: string) => void;

/**
 * Auto credit allocation (HR, leave.maintain): the entitlement the server
 * computes for an employee (GET /api/v1/leave/allocation), crediting it once a
 * year (POST same), and queueing the monthly EL accrual job
 * (POST /api/v1/leave/accrual-runs). Restrictions come from the tenant leave types.
 */
export default function LeaveCreditAllocationPanel({ ctx }: { ctx: LeaveContext | null }) {
  const { t, locale } = useLeaveT();
  const hrms = useHRMS() as { showToast?: ShowToast } | null;
  const [picked, setPicked] = useState<LeaveEmployee | null>(null);
  const employee = picked ?? ctx?.employee ?? null;
  const preview = useLeaveResource<AllocationPreview>(ctx?.canMaintain && employee ? `/api/v1/leave/allocation?employeeId=${employee.id}` : null, t(`${NS}.text_preview_failed`, "The allocation could not be calculated."));
  const engine = useLeaveResource<LeaveEngine>("/api/v1/leave/engine", t(`${NS}.text_rules_failed`, "Leave rules could not be loaded."));
  const [busy, setBusy] = useState<"credit" | "run" | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const lock = useRef(false);
  const creditKey = useSubmitKey();
  const runKey = useSubmitKey();
  const period = new Date().toISOString().slice(0, 7);

  if (!ctx) return null;
  if (!ctx.canMaintain) {
    return <div className={styles.state}>{t(`${NS}.text_hr_only`, "Leave allocation is managed by HR. Your role can view balances but not credit leave.")}</div>;
  }

  const run = async (kind: "credit" | "run") => {
    if (lock.current || (kind === "credit" && !employee)) return;
    const url = kind === "credit" ? "/api/v1/leave/allocation" : "/api/v1/leave/accrual-runs";
    const body = kind === "credit" ? { employeeId: employee?.id } : { period };
    const keys = kind === "credit" ? creditKey : runKey;
    lock.current = true;
    setBusy(kind);
    setNotice(null);
    const result = await postLeave<{ credited?: Record<string, number> }>(url, body, keys.keyFor(body), t(`${NS}.text_failure`, "The allocation could not be recorded."));
    lock.current = false;
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    keys.settle();
    const text = kind === "credit"
      ? t(`${NS}.text_credited`, "Annual allocation credited to {name}.", { name: employee?.name ?? "" })
      : t(`${NS}.text_queued`, "Accrual run for {period} queued. The scheduler credits each eligible employee once.", { period });
    setNotice({ tone: "ok", text });
    hrms?.showToast?.(t(`${NS}.toast_title`, "Leave allocation"), text, "success");
    announceLeaveChanged();
    preview.reload();
  };

  return (
    <div className={styles.stack}>
      <div className={styles.notice}>
        <Info size={18} aria-hidden="true" />
        <div>
          <strong>{t(`${NS}.text_rules_title`, "Auto leave credit rules")}</strong>
          <div>{t(`${NS}.text_rules_body`, "Senior management (AGM and above) receive EL, CL and SL on 1 January. Other staff accrue EL monthly after six months of service; CL and SL are prorated by joining date. Trainees and contract workers follow their category rules. Birthday leave needs a date of birth on record.")}</div>
        </div>
      </div>
      <div className={styles.spread}>
        <div className={styles.picker}>
          <LeaveEmployeeSelect label={t(`${NS}.label_employee`, "Employee")} value={employee} onChange={setPicked} />
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.primary} disabled={busy !== null || preview.state.status !== "ready" || !preview.state.data.eligible || preview.state.data.alreadyCredited} aria-busy={busy === "credit"} onClick={() => run("credit")}>
            <CheckCircle2 size={16} aria-hidden="true" /> {t(`${NS}.button_credit`, "Credit annual allocation")}
          </button>
          <button type="button" className={styles.secondary} disabled={busy !== null} aria-busy={busy === "run"} onClick={() => run("run")}>
            <RefreshCw size={15} aria-hidden="true" /> {t(`${NS}.button_run`, "Queue monthly accrual run ({period})", { period })}
          </button>
        </div>
      </div>
      {notice?.tone === "error" && <FormError message={notice.text} />}
      {notice?.tone === "ok" && <div className={`${styles.notice} ${styles.noticeOk}`} role="status">{notice.text}</div>}
      {!employee && <div className={styles.state}>{t(`${NS}.text_pick`, "Choose an employee to see their entitlement.")}</div>}
      {employee && (
        <ResourceView resource={preview.state} onRetry={preview.reload}>
          {(data) => (
            <>
              <div className={styles.row}>
                {data.seniorManagement && <Badge tone="info">{t(`${NS}.text_senior`, "Senior management")}</Badge>}
                {data.alreadyCredited && <Badge tone="ok">{t(`${NS}.text_already`, "{year} allocation already credited", { year: data.year })}</Badge>}
                {!data.eligible && <Badge tone="flag">{t(`${NS}.text_not_eligible`, "Not eligible for leave credit")}</Badge>}
              </div>
              <div className={styles.grid}>
                {CODES.map((code) => (
                  <div key={code} className={styles.card}>
                    <div className={styles.kpiLabel}>{engine.state.status === "ready" ? engine.state.data.leaveTypeRules.find((rule) => rule.code === code)?.name ?? code : code}</div>
                    <div className={styles.kpiValue}>{formatDays(data.days[code], locale)}<span className={styles.kpiUnit}>{t(`${NS}.text_per_year`, "days / year")}</span></div>
                    {code === "EL" && data.monthlyEL > 0 && <div className={styles.muted}>{t(`${NS}.text_monthly`, "+{days} per month via accrual", { days: formatDays(data.monthlyEL, locale) })}</div>}
                  </div>
                ))}
              </div>
              <div className={styles.card}>
                <div className={styles.cardHead}><h4>{t(`${NS}.text_basis`, "Calculation basis")}</h4></div>
                <ul className={styles.list}>
                  {data.notes.map((note) => <li key={note} className={styles.itemMeta}>{t(`${NS}.note_${note}`, NOTES[note])}</li>)}
                </ul>
              </div>
            </>
          )}
        </ResourceView>
      )}
      <div className={styles.card}>
        <div className={styles.cardHead}><h4><AlertTriangle size={15} aria-hidden="true" /> {t(`${NS}.text_restrictions`, "Leave restrictions and rules")}</h4></div>
        <ResourceView resource={engine.state} onRetry={engine.reload} isEmpty={(data) => data.leaveTypeRules.length === 0} empty={t(`${NS}.text_no_rules`, "No leave types are configured yet.")}>
          {(data) => (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t(`${NS}.col_type`, "Leave type")}</th>
                    <th scope="col">{t(`${NS}.col_max`, "Max per month")}</th>
                    <th scope="col">{t(`${NS}.col_combine`, "Cannot combine with")}</th>
                    <th scope="col">{t(`${NS}.col_year_end`, "Year end")}</th>
                    <th scope="col">{t(`${NS}.col_expiry`, "Expiry")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaveTypeRules.map((rule) => (
                    <tr key={rule.code}>
                      <td>{rule.name}</td>
                      <td>{rule.maxPerMonth === null ? "—" : formatDays(rule.maxPerMonth, locale)}</td>
                      <td>{rule.cannotCombineWith.join(", ") || "—"}</td>
                      <td>{rule.yearEndAction ?? "—"}</td>
                      <td>{rule.expiryRule ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ResourceView>
      </div>
    </div>
  );
}
