"use client";

import { useState, type ReactNode } from "react";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import SummarizeOutlined from "@mui/icons-material/SummarizeOutlined";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { useHRMS } from "@/context/HRMSContext";
import { useTranslation } from "@/context/I18nContext";
import { ANALYTICS_PERIODS, type AnalyticsPeriod, type WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";
import MisReportingHub from "./MisReportingHub";
import { NS, Notice } from "./analytics-view/AnalyticsParts";
import { useWorkforceInsights } from "./analytics-view/useWorkforceInsights";
import PeopleTab from "./analytics-view/PeopleTab";
import WorkforceTab from "./analytics-view/WorkforceTab";
import PayrollTab from "./analytics-view/PayrollTab";
import TalentTab from "./analytics-view/TalentTab";
import CopilotTab from "./analytics-view/CopilotTab";
import CustomReportTab, { PERIOD_LABELS } from "./analytics-view/CustomReportTab";
import CapabilityTab from "./analytics-view/CapabilityTab";
import styles from "./AnalyticsView.module.css";

type Tab = "people" | "workforce" | "payroll" | "talent" | "copilot" | "custom" | "mis" | "operational";
type Toast = (title: string, message: string, type?: string) => void;
type Props = {
  onNavigate?: (tab: string, sub?: string) => void;
  onSelectConsole?: (consoleId: string) => void;
  activeSubFeature?: string;
};

const SUB_FEATURE_TAB: Record<string, Tab> = {
  analytics_people: "people",
  analytics_workforce: "workforce",
  analytics_payroll: "payroll",
  analytics_talent: "talent",
  analytics_copilot: "copilot",
  analytics_custom: "custom",
  operational_reports: "operational",
};

const TABS: Array<{ id: Tab; key: string; fallback: string; icon: ReactNode }> = [
  { id: "people", key: "text_people_intelligence", fallback: "People Intelligence", icon: <PeopleAltOutlined sx={{ fontSize: 16 }} /> },
  { id: "workforce", key: "text_workforce_ops", fallback: "Workforce & Ops", icon: <AccessTimeOutlined sx={{ fontSize: 16 }} /> },
  { id: "payroll", key: "text_payroll_analytics", fallback: "Payroll Analytics", icon: <AccountBalanceWalletOutlined sx={{ fontSize: 16 }} /> },
  { id: "talent", key: "text_talent_funnel", fallback: "Talent Funnel", icon: <HowToRegOutlined sx={{ fontSize: 16 }} /> },
  { id: "copilot", key: "text_ai_copilot_studio", fallback: "AI Copilot Studio", icon: <AutoAwesomeOutlined sx={{ fontSize: 16 }} /> },
  { id: "custom", key: "text_custom_reports", fallback: "Custom Reports", icon: <AssessmentOutlined sx={{ fontSize: 16 }} /> },
  { id: "mis", key: "text_mis_master_hub", fallback: "MIS Master Hub", icon: <SummarizeOutlined sx={{ fontSize: 16 }} /> },
  { id: "operational", key: "text_mci_engine", fallback: "MCI Engine", icon: <SpeedOutlined sx={{ fontSize: 16 }} /> },
];

const NEEDS_INSIGHTS = new Set<Tab>(["people", "workforce", "payroll", "talent", "operational"]);

/**
 * People Intelligence & Predictive AI Studio. Every figure comes from GET /api/v1/analytics/workforce-insights
 * (tenant scoped, per-section permissions); the copilot runs on POST /api/v1/ai/nucleus/chat; MCI runs are
 * stored through POST /api/v1/analytics/capability-index.
 */
export default function AnalyticsView({ onNavigate, activeSubFeature = "analytics_people" }: Props) {
  const { t } = useTranslation();
  const { showToast } = useHRMS() as { showToast: Toast };
  const [selected, setSelected] = useState<{ tab: Tab; from: string }>({ tab: SUB_FEATURE_TAB[activeSubFeature] ?? "people", from: activeSubFeature });
  const activeTab = selected.from === activeSubFeature ? selected.tab : (SUB_FEATURE_TAB[activeSubFeature] ?? selected.tab);
  const setActiveTab = (tab: Tab) => setSelected({ tab, from: activeSubFeature });
  const [period, setPeriod] = useState<AnalyticsPeriod>("current_quarter");
  const [department, setDepartment] = useState("");
  const { state, reload } = useWorkforceInsights(period, department || null);
  const data: WorkforceInsightsPayload | null = state.status === "ready" ? state.data : null;

  const renderInsights = (render: (payload: WorkforceInsightsPayload) => ReactNode) => {
    if (state.status === "loading") return <Notice>{t(`${NS}.text_loading_insights`, "Loading workforce analytics...")}</Notice>;
    if (state.status === "error") {
      return (
        <Notice error action={<button type="button" className={styles.btnSecondary} onClick={reload}>{t(`${NS}.text_retry`, "Retry")}</button>}>
          {state.message || t(`${NS}.error_insights_load`, "Workforce analytics could not be loaded.")}
        </Notice>
      );
    }
    return render(state.data);
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.text_people_intelligence_predictive_ai_studio`, "People Intelligence & Predictive AI Studio")}</h2>
          <p>{t(`${NS}.text_enterprise_workforce_telemetry_wage_bill`, "Enterprise workforce telemetry, wage bill analytics, talent funnel velocity, and autonomous agent reasoning.")}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={reload} disabled={state.status === "loading"}>
            <RefreshOutlined sx={{ fontSize: 16 }} />
            {t(`${NS}.text_sync_telemetry`, "Sync Telemetry")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setActiveTab("custom")}>
            <DownloadOutlined sx={{ fontSize: 16 }} />
            {t(`${NS}.text_export_reports`, "Export Reports")}
          </button>
        </div>
      </div>

      <div className={styles.tabNav} role="tablist" aria-label={t(`${NS}.label_analytics_sections`, "Analytics sections")}>
        {TABS.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ""}`} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}
            {t(`${NS}.${tab.key}`, tab.fallback)}
          </button>
        ))}
      </div>

      {NEEDS_INSIGHTS.has(activeTab) && (
        <div className={styles.filterRow}>
          <div className={styles.field}>
            <label htmlFor="analytics-period">{t(`${NS}.text_date_range`, "Date Range")}</label>
            <select id="analytics-period" className={styles.select} value={period} onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}>
              {ANALYTICS_PERIODS.map((key) => <option key={key} value={key}>{t(`${NS}.${PERIOD_LABELS[key][0]}`, PERIOD_LABELS[key][1])}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="analytics-department">{t(`${NS}.text_department_scope`, "Department Scope")}</label>
            <select id="analytics-department" className={styles.select} value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">{t(`${NS}.text_all_departments`, "All Departments")}</option>
              {(data?.departments ?? (department ? [department] : [])).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          {data && (
            <span className={styles.rowSub}>
              {t(`${NS}.text_window`, "{from} to {to}", { from: data.window.from, to: data.window.to })}
            </span>
          )}
        </div>
      )}

      {activeTab === "people" && renderInsights((payload) => <PeopleTab data={payload} />)}
      {activeTab === "workforce" && renderInsights((payload) => <WorkforceTab data={payload} onNavigate={onNavigate} />)}
      {activeTab === "payroll" && renderInsights((payload) => <PayrollTab data={payload} onNavigate={onNavigate} />)}
      {activeTab === "talent" && renderInsights((payload) => <TalentTab data={payload} />)}
      {activeTab === "copilot" && <CopilotTab />}
      {activeTab === "custom" && <CustomReportTab departments={data?.departments ?? []} showToast={showToast} />}
      {activeTab === "mis" && <MisReportingHub setMisMasterData={undefined} showToast={showToast} onNavigate={onNavigate} />}
      {activeTab === "operational" && renderInsights((payload) => <CapabilityTab data={payload} showToast={showToast} onComputed={reload} />)}
    </div>
  );
}
