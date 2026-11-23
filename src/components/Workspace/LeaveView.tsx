"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckCircle, Clock, FileText, Layers, RotateCcw, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { useHRMS } from "@/context/HRMSContext";
import LeaveApplicationDialog from "@/components/Leave/LeaveApplicationDialog";
import LeavePolicyReference from "@/components/Leave/LeavePolicyReference";
import LeaveWorkflowPanel from "@/components/Leave/LeaveWorkflowPanel";
import LeaveOverviewTab from "@/components/Leave/LeaveOverviewTab";
import LeaveCompOffTab, { summariseCompOff } from "@/components/Leave/LeaveCompOffTab";
import LeaveEarlyReturnTab from "@/components/Leave/LeaveEarlyReturnTab";
import LeaveCreditAllocationPanel from "@/components/Leave/LeaveCreditAllocationPanel";
import EarlyReturnDialog from "@/components/Leave/EarlyReturnDialog";
import { formatDays, formatLeaveDate, useLeaveChanged, useLeaveResource, useLeaveT, type CompOffEntry, type LeaveContext, type LeaveEngine, type LeaveRequestRow } from "@/components/Leave/leave-client";
import PolicyHandbookModal from "@/components/Policies/PolicyHandbookModal";
import styles from "./LeaveView.module.css";

const NS = "components.Workspace.LeaveView";

type Tab = "balances_apply" | "approval_pipeline" | "comp_off_clock" | "early_return_recredit" | "policy_matrix" | "leave_credit";

const SUB_FEATURE_TAB: Record<string, Tab> = {
  leave_requests: "balances_apply",
  leave_ledger: "balances_apply",
  approval_inbox: "approval_pipeline",
  leave_approval: "approval_pipeline",
  early_return: "early_return_recredit",
  leave_policy_admin: "policy_matrix",
  leave_types: "policy_matrix",
  comp_off: "comp_off_clock",
  coff_lapse: "comp_off_clock",
};

type ShowToast = (title: string, message: string, tone: string) => void;

/**
 * Leave Management workspace. Every figure comes from the leave APIs: the rule
 * pack and pipeline from /api/v1/leave/engine, balances from
 * /api/v1/leave/balance-cards, requests from /api/v1/leave-requests/register,
 * comp-off from /api/v1/leave/comp-off-clock and early returns from
 * /api/v1/leave/early-returns.
 */
export default function LeaveView({ activeSubFeature }: { onNavigate?: (tab: string) => void; onSelectConsole?: (id: string) => void; activeSubFeature?: string }) {
  const { t, locale } = useLeaveT();
  const hrms = useHRMS() as { showToast?: ShowToast } | null;
  const [selectedTab, setSelectedTab] = useState<Tab>("balances_apply");
  const [syncedSubFeature, setSyncedSubFeature] = useState<string | undefined>(undefined);
  const [applyOpen, setApplyOpen] = useState(false);
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [earlyReturn, setEarlyReturn] = useState<LeaveRequestRow | null>(null);

  // Contextual navigation picks the tab when the sub-feature changes; the user's own clicks win afterwards.
  if (activeSubFeature !== syncedSubFeature) {
    setSyncedSubFeature(activeSubFeature);
    const mapped = activeSubFeature ? SUB_FEATURE_TAB[activeSubFeature] : undefined;
    if (mapped) setSelectedTab(mapped);
  }
  const activeTab = selectedTab;

  const context = useLeaveResource<LeaveContext>("/api/v1/leave/context", t(`${NS}.text_context_failed`, "Your leave profile could not be loaded."));
  const engine = useLeaveResource<LeaveEngine>("/api/v1/leave/engine", t(`${NS}.text_engine_failed`, "The leave rule pack could not be loaded."));
  const coff = useLeaveResource<CompOffEntry[]>("/api/v1/leave/comp-off-clock", t(`${NS}.text_coff_failed`, "Comp-off credits could not be loaded."));
  useLeaveChanged(engine.reload);
  const ctx = context.state.status === "ready" ? context.state.data : null;

  useEffect(() => {
    try {
      if (sessionStorage.getItem("nucleus:auto_open_leave_apply") === "true") {
        sessionStorage.removeItem("nucleus:auto_open_leave_apply");
        window.setTimeout(() => setApplyOpen(true), 0);
      }
    } catch {
      // Session storage is a convenience only; the apply button still works without it.
    }
    const open = () => setApplyOpen(true);
    window.addEventListener("nucleus:open_leave_apply", open);
    return () => window.removeEventListener("nucleus:open_leave_apply", open);
  }, []);

  const verify = () => {
    engine.reload();
    hrms?.showToast?.(t(`${NS}.toast_verify_title`, "Rule pack"), t(`${NS}.toast_verify_body`, "Re-reading the rule pack assigned to your organisation."), "info");
  };

  const pendingBadge = engine.state.status === "ready" ? formatDays(engine.state.data.pipeline.totalPending, locale) : null;
  const openCoff = coff.state.status === "ready" ? summariseCompOff(coff.state.data).openDays : null;
  const tabs: Array<{ id: Tab; icon: typeof Calendar; label: string; badge?: string | null; tone?: string }> = [
    { id: "balances_apply", icon: Calendar, label: t(`${NS}.tab_balances`, "Balances & apply") },
    { id: "approval_pipeline", icon: Layers, label: t(`${NS}.tab_pipeline`, "Approval pipeline"), badge: pendingBadge === null ? null : t(`${NS}.badge_pending`, "{count} pending", { count: pendingBadge }), tone: styles.badgeAmber },
    { id: "comp_off_clock", icon: Clock, label: t(`${NS}.tab_coff`, "Comp-off clock"), badge: openCoff === null ? null : t(`${NS}.badge_days`, "{days} days", { days: formatDays(openCoff, locale) }), tone: openCoff ? styles.badgeTeal : styles.badgeCoral },
    { id: "early_return_recredit", icon: RotateCcw, label: t(`${NS}.tab_early_return`, "Early return re-credit") },
    { id: "policy_matrix", icon: ShieldCheck, label: t(`${NS}.tab_policy`, "Policy matrix") },
    { id: "leave_credit", icon: Sparkles, label: t(`${NS}.tab_credit`, "Auto credit allocation") },
  ];

  return (
    <div className={styles.leaveContainer}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.text_title`, "Leave management")}</h2>
          <p>{t(`${NS}.text_subtitle`, "Balances, approvals, comp-off and early returns, governed by your organisation's leave rules.")}</p>
        </div>
        <div className={styles.headerActions}>
          {ctx?.canMaintain && (
            <button type="button" className={styles.btnSecondary} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:open_bulk_upload"))} title={t(`${NS}.title_bulk`, "Upload leave balances or adjustments in bulk")}>
              <UploadCloud size={15} aria-hidden="true" /> {t(`${NS}.button_bulk`, "Bulk balances upload")}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={() => setHandbookOpen(true)} title={t(`${NS}.title_handbook`, "Open the policy handbook")}>
            <FileText size={15} aria-hidden="true" /> {t(`${NS}.button_handbook`, "Policy handbook")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setApplyOpen(true)}>
            <Calendar size={15} aria-hidden="true" /> {t(`${NS}.button_apply`, "Apply leave")}
          </button>
        </div>
      </div>

      <div className={styles.engineBanner} aria-live="polite">
        <div className={styles.engineInfo}>
          <ShieldCheck size={24} aria-hidden="true" className={styles.engineIcon} />
          <div>
            <div className={styles.engineTitleRow}>
              <strong>{t(`${NS}.text_engine_title`, "Leave rule pack")}</strong>
              {engine.state.status === "ready" && engine.state.data.engine.rulePackCode && (
                <span className={`${styles.badge} ${styles.badgeBlue}`}>{engine.state.data.engine.rulePackCode}{engine.state.data.engine.rulePackVersion ? ` · v${engine.state.data.engine.rulePackVersion}` : ""}</span>
              )}
            </div>
            <div className={styles.engineMeta}>
              {engine.state.status === "loading" && t(`${NS}.text_loading`, "Loading…")}
              {engine.state.status === "error" && engine.state.message}
              {engine.state.status === "ready" && (engine.state.data.engine.rulePackCode
                ? t(`${NS}.text_effective`, "In force from {date}", { date: formatLeaveDate(engine.state.data.engine.effectiveFrom, locale) })
                : t(`${NS}.text_no_pack`, "No rule pack is assigned to your organisation yet."))}
            </div>
          </div>
        </div>
        <button type="button" className={styles.btnSecondary} onClick={verify} disabled={engine.state.status === "loading"}>
          <CheckCircle size={14} aria-hidden="true" /> {t(`${NS}.button_verify`, "Re-check rule pack")}
        </button>
      </div>

      <div className={styles.subnavTabs} role="tablist" aria-label={t(`${NS}.aria_tabs`, "Leave sections")}>
        {tabs.map(({ id, icon: Icon, label, badge, tone }) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={`${styles.tabBtn} ${activeTab === id ? styles.tabBtnActive : ""}`} onClick={() => setSelectedTab(id)}>
            <Icon size={15} aria-hidden="true" /> {label}
            {badge && <span className={`${styles.badge} ${tone ?? ""}`}>{badge}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "balances_apply" && <LeaveOverviewTab ctx={ctx} onApply={() => setApplyOpen(true)} onEarlyReturn={setEarlyReturn} />}
        {activeTab === "approval_pipeline" && <LeaveWorkflowPanel />}
        {activeTab === "comp_off_clock" && <LeaveCompOffTab resource={coff.state} reload={coff.reload} />}
        {activeTab === "early_return_recredit" && <LeaveEarlyReturnTab ctx={ctx} onEarlyReturn={setEarlyReturn} />}
        {activeTab === "policy_matrix" && <LeavePolicyReference />}
        {activeTab === "leave_credit" && <LeaveCreditAllocationPanel ctx={ctx} />}
      </div>

      {earlyReturn && <EarlyReturnDialog request={earlyReturn} onClose={() => setEarlyReturn(null)} />}
      <LeaveApplicationDialog open={applyOpen} onClose={() => setApplyOpen(false)} />
      <PolicyHandbookModal isOpen={handbookOpen} onClose={() => setHandbookOpen(false)} />
    </div>
  );
}
