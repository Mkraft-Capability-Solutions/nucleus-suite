"use client";

import { useState } from "react";
import { Award, FileText, Lock, PieChart, RefreshCw, ShieldCheck, TrendingUp, UploadCloud } from "lucide-react";
import { useHRMS } from "@/context/HRMSContext";
import { useResource } from "./payroll/payroll-client";
import { PAYROLL_ENDPOINTS } from "./payroll/payroll-api";
import { NS, usePayrollT } from "./payroll/PayrollParts";
import PayrollOverviewTab from "./payroll/PayrollOverviewTab";
import PayrollRunsTab from "./payroll/PayrollRunsTab";
import PayrollLoansTab from "./payroll/PayrollLoansTab";
import PayrollFnfTab from "./payroll/PayrollFnfTab";
import PayrollScopingTab from "./payroll/PayrollScopingTab";
import SalaryJournalModal from "./payroll/SalaryJournalModal";
import type { ComplianceObligation, FnfSettlement, LegalEntity, LoanRegister, PayrollOverview, PayrollRun } from "./payroll/payroll-types";
import styles from "./PayrollView.module.css";

/**
 * Payroll workspace: gross-to-net and EWA, off-cycle runs, company loans, same-day
 * F&F and location scoping. Every value is read from a tenant-scoped API (see the
 * tab components); writes go through idempotent endpoints and the UI changes only
 * after the server accepts them.
 */

type Tab = "overview" | "offcycle" | "loans" | "fnf" | "scoping";

const SUB_FEATURE_TAB: Record<string, Tab> = {
  full_and_final: "fnf", fnf: "fnf", payroll_fnf: "fnf",
  loans_advances: "loans", loans: "loans",
  salary_simulator: "offcycle", offcycle: "offcycle", payroll_ewa: "offcycle",
  gl_mapping: "scoping", scoping: "scoping", payroll_accounting: "scoping",
  payroll_runs: "overview", pre_payroll_audit: "overview", payslips: "overview", overview: "overview", payroll_global: "overview",
};

type Props = {
  onNavigate?: (tab: string, module?: string, sub?: string) => void;
  onSelectConsole?: (consoleId: string) => void;
  activeSubFeature?: string | null;
};

type Toast = (title: string, message: string, tone: "success" | "error" | "info") => void;

export default function PayrollView({ onNavigate, onSelectConsole, activeSubFeature }: Props) {
  const { t } = usePayrollT();
  const { showToast } = (useHRMS() ?? {}) as { showToast?: Toast };
  const notify: Toast = (title, message, tone) => showToast?.(title, message, tone);
  const initialTab = (activeSubFeature ? SUB_FEATURE_TAB[activeSubFeature] : undefined) ?? "overview";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [seenSubFeature, setSeenSubFeature] = useState(activeSubFeature ?? null);
  const [entityId, setEntityId] = useState("");
  const [journalOpen, setJournalOpen] = useState(false);

  // A deep link (sub-feature) selects its tab; adjusted during render, not in an effect.
  if ((activeSubFeature ?? null) !== seenSubFeature) {
    setSeenSubFeature(activeSubFeature ?? null);
    const mapped = activeSubFeature ? SUB_FEATURE_TAB[activeSubFeature] : undefined;
    if (mapped) setActiveTab(mapped);
  }

  const overview = useResource<PayrollOverview>(PAYROLL_ENDPOINTS.overview);
  const obligations = useResource<ComplianceObligation[]>(PAYROLL_ENDPOINTS.obligations);
  const entities = useResource<{ items: LegalEntity[] }>(PAYROLL_ENDPOINTS.legalEntities);
  const runs = useResource<PayrollRun[]>(PAYROLL_ENDPOINTS.runs);
  const loans = useResource<LoanRegister>(PAYROLL_ENDPOINTS.loanRegister);
  const settlements = useResource<FnfSettlement[]>(PAYROLL_ENDPOINTS.fnf);

  const entityList = entities.state.status === "ready" ? entities.state.data.items : [];
  const selectedEntity = entityList.find((entity) => entity.id === entityId) ?? entityList[0] ?? null;
  const openControlRoom = onNavigate || onSelectConsole ? () => {
    onSelectConsole?.("S5");
    onNavigate?.("dashboard", "dashboard", "s5");
  } : null;

  const tabs: Array<{ key: Tab; label: string; icon: typeof PieChart; badge: string | null; badgeClass: string }> = [
    { key: "overview", label: t(`${NS}.text_tab_overview`, "Gross-to-net and EWA"), icon: PieChart, badge: null, badgeClass: "" },
    { key: "offcycle", label: t(`${NS}.text_tab_runs`, "Off-cycle payroll runs"), icon: RefreshCw, badge: runs.state.status === "ready" ? String(runs.state.data.length) : "–", badgeClass: styles.badgeInfo },
    { key: "loans", label: t(`${NS}.text_tab_loans`, "Company loans and guarantor lock"), icon: Lock, badge: loans.state.status === "ready" ? t(`${NS}.text_badge_locked`, "{count} locked", { count: loans.state.data.locks.length }) : "–", badgeClass: loans.state.status === "ready" && loans.state.data.locks.length > 0 ? styles.badgeDanger : styles.badgeSuccess },
    { key: "fnf", label: t(`${NS}.text_tab_fnf`, "Same-day F&F and no-dues"), icon: Award, badge: settlements.state.status === "ready" ? t(`${NS}.text_badge_exits`, "{count} exits", { count: settlements.state.data.length }) : "–", badgeClass: styles.badgePurple },
    { key: "scoping", label: t(`${NS}.text_tab_scoping`, "Location scoping"), icon: ShieldCheck, badge: null, badgeClass: "" },
  ];

  return (
    <div className={styles.payrollContainer}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.text_title`, "Enterprise payroll engine and adjacencies")}</h2>
          <p>{t(`${NS}.text_subtitle`, "Gross-to-net, earned wage access, off-cycle runs, guarantor-backed loans, same-day F&F and location-scoped salary security.")}</p>
        </div>
        <div className={styles.row}>
          <label className={styles.srOnly} htmlFor="payroll-entity">{t(`${NS}.text_legal_entity`, "Legal entity")}</label>
          <select id="payroll-entity" className={styles.select} value={selectedEntity?.id ?? ""} onChange={(event) => setEntityId(event.target.value)} disabled={entityList.length === 0}
            title={entities.state.status === "error" ? entities.state.message : undefined}>
            {entityList.length === 0 && <option value="">{entities.state.status === "loading" ? t(`${NS}.text_loading`, "Loading…") : t(`${NS}.text_no_entities`, "No legal entity")}</option>}
            {entityList.map((entity) => <option key={entity.id} value={entity.id}>{`${entity.legal_name} (${entity.currency_code})`}</option>)}
          </select>
          {openControlRoom && (
            <button type="button" className={styles.btnSecondary} onClick={openControlRoom} title={t(`${NS}.text_open_control_room`, "Open the payroll control room dashboard")}>
              <TrendingUp size={15} aria-hidden="true" />{t(`${NS}.text_control_room`, "Control room")}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={() => window.dispatchEvent(new CustomEvent("nucleus:open_bulk_upload"))} title={t(`${NS}.title_upload_employee_salary_structures_pay_sl`, "Upload Employee Salary Structures & Pay Slips in Bulk")}>
            <UploadCloud size={15} aria-hidden="true" />{t(`${NS}.text_bulk_structure_upload`, "Bulk Structure Upload")}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => setJournalOpen(true)}>
            <FileText size={16} aria-hidden="true" />{t(`${NS}.text_finance_journal`, "Finance salary journal (GL)")}
          </button>
        </div>
      </div>

      <div className={styles.subTabsRow} role="tablist" aria-label={t(`${NS}.text_tabs_label`, "Payroll sections")}>
        {tabs.map(({ key, label, icon: Icon, badge, badgeClass }) => (
          <button key={key} type="button" role="tab" aria-selected={activeTab === key} className={`${styles.subTabBtn} ${activeTab === key ? styles.subTabActive : ""}`} onClick={() => setActiveTab(key)}>
            <Icon size={16} aria-hidden="true" />{label}
            {badge !== null && <span className={`${styles.badge} ${badgeClass}`}>{badge}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "overview" && (
          <div className={styles.stack}>
            <PayrollOverviewTab overview={overview.state} obligations={obligations.state} packLabel={selectedEntity?.legal_name ?? null} onReload={overview.reload} onOpenControlRoom={openControlRoom} notify={notify} />
          </div>
        )}
        {activeTab === "offcycle" && <PayrollRunsTab runs={runs} notify={notify} />}
        {activeTab === "loans" && <PayrollLoansTab register={loans} notify={notify} />}
        {activeTab === "fnf" && <PayrollFnfTab settlements={settlements} notify={notify} />}
        {activeTab === "scoping" && <PayrollScopingTab />}
      </div>

      {journalOpen && (
        <SalaryJournalModal runs={runs} entities={entityList} onClose={() => setJournalOpen(false)} notify={notify} />
      )}
    </div>
  );
}
