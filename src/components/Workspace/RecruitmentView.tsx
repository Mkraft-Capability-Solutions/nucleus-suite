"use client";

import { useState, type ReactNode } from "react";
import { Award, Briefcase, Building2, DollarSign, Download, FileCheck, Plus, Shield, Sparkles, UploadCloud, UserPlus } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import { downloadCSV } from "@/utils/exportUtils";
import DataImportModal from "./DataImportModal";
import styles from "./RecruitmentView.module.css";
import { errorMessage, sendJson, type Translate } from "./workspaceHttp";
import PipelineTab from "./recruitment/PipelineTab";
import EstablishmentTab from "./recruitment/EstablishmentTab";
import ReferralsTab from "./recruitment/ReferralsTab";
import { FairnessTab, InterviewsTab } from "./recruitment/InsightTabs";
import RequisitionModal from "./recruitment/RequisitionModal";
import ReferralModal from "./recruitment/ReferralModal";
import { SourceState } from "./recruitment/parts";
import { NS, useRecruitmentData } from "./recruitment/useRecruitmentData";
import type { PipelineCard } from "./recruitment/types";

type Tab = "pipeline" | "establishment" | "referrals" | "interviews" | "bias";
type Toast = (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
type Props = { onNavigate?: (tab: string, sub?: string, console?: string) => void; onSelectConsole?: (console: string) => void; activeSubFeature?: string | null };

const SUB_FEATURE_TABS: Record<string, Tab> = {
  talent_ats: "pipeline", recruitment_pipeline: "pipeline",
  talent_establishment: "establishment", recruitment_establishment: "establishment",
  talent_referrals: "referrals", recruitment_referrals: "referrals",
  talent_interviews: "interviews", recruitment_interviews: "interviews",
  talent_bias: "bias", recruitment_bias: "bias",
};

/**
 * SCR-090 talent acquisition workspace. Every figure comes from the talent read models
 * (/api/v1/talent-pipeline, /api/v1/establishment, /api/v1/requisition-register); writes go to
 * POST /api/v1/applications/:id/advance, POST /api/v1/requisition-register and POST /api/v1/referrals.
 */
export default function RecruitmentView({ onNavigate, onSelectConsole, activeSubFeature }: Props) {
  const { t: rawT, locale } = useTranslation();
  const t = rawT as Translate;
  const { showToast } = (useHRMS() ?? {}) as { showToast?: Toast };
  const toast: Toast = (title, message, type) => showToast?.(title, message, type);
  const data = useRecruitmentData(t);
  const [chosenTab, setChosenTab] = useState<{ tab: Tab; sub: string | null | undefined } | null>(null);
  const [modal, setModal] = useState<"requisition" | "referral" | "import" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // A sub-feature from navigation selects the tab until the user picks another one.
  const routedTab = activeSubFeature ? SUB_FEATURE_TABS[activeSubFeature] : undefined;
  const activeTab: Tab = chosenTab && chosenTab.sub === activeSubFeature ? chosenTab.tab : routedTab ?? chosenTab?.tab ?? "pipeline";
  const selectTab = (tab: Tab) => setChosenTab({ tab, sub: activeSubFeature });

  const board = data.board.status === "ready" ? data.board.data : null;
  const cards = board ? board.columns.flatMap((column) => column.cards) : [];
  const ledger = data.referrals.status === "ready" ? data.referrals.data : null;
  const establishment = data.establishment.status === "ready" ? data.establishment.data : null;
  const fairness = data.fairness.status === "ready" ? data.fairness.data : null;

  const advance = async (card: PipelineCard) => {
    if (!card.nextStage || busyId) return;
    setBusyId(card.applicationId);
    try {
      await sendJson(`/api/v1/applications/${encodeURIComponent(card.applicationId)}/advance`, { method: "POST", body: { to: card.nextStage }, idempotencyKey: crypto.randomUUID() },
        t(`${NS}.text_advance_failed`, "The stage could not be changed."));
      toast(t(`${NS}.text_stage_updated`, "Candidate stage updated"), t(`${NS}.text_stage_updated_body`, "{name} moved to {stage}.", { name: card.candidateName, stage: card.nextStageLabel ?? card.nextStage }), "success");
      data.reload();
    } catch (error) {
      toast(t(`${NS}.text_advance_failed`, "The stage could not be changed."), errorMessage(error, ""), "error");
    } finally {
      setBusyId(null);
    }
  };

  const exportCandidates = () => {
    if (cards.length === 0) return;
    const headers = [t(`${NS}.csv_application`, "Application ID"), t(`${NS}.csv_name`, "Name"), t(`${NS}.csv_role`, "Role"), t(`${NS}.csv_department`, "Department"), t(`${NS}.csv_stage`, "Stage"), t(`${NS}.csv_score`, "Match score"), t(`${NS}.csv_experience`, "Experience (years)"), t(`${NS}.csv_source`, "Source")];
    const rows = cards.map((card) => [card.applicationId, card.candidateName, card.roleTitle ?? "", card.department ?? "", card.stageLabel, card.matchScore === null ? "" : String(card.matchScore), card.experienceYears === null ? "" : String(card.experienceYears), card.source ?? ""]);
    const result = downloadCSV("nucleus_candidate_pipeline.csv", headers, rows) as { success?: boolean } | undefined;
    if (result?.success) toast(t(`${NS}.text_export_done`, "Export complete"), t(`${NS}.text_export_done_body`, "Candidate pipeline CSV downloaded."), "success");
  };

  const sanctionedTotal = establishment?.configured ? establishment.lines.reduce((total, line) => total + line.sanctioned, 0) : null;
  const openRequisitions = data.register.status === "ready" ? data.register.data.rows.filter((row) => row.displayState !== "filled") : [];
  const schemeNote = ledger?.schemeConfigured
    ? t(`${NS}.text_scheme_short`, "Award paid per the {scheme} referral scheme.", { scheme: ledger.schemeCode ?? "" })
    : t(`${NS}.text_scheme_missing`, "No referral award scheme is configured, so no bonus amount is promised.");
  const ctcReason = t(`${NS}.text_ctc_unavailable`, "CTC exceptions are raised from an offer that exceeds its band. No offer-linked CTC exception record backs this workspace yet.");

  const tabs: Array<{ id: Tab; icon: ReactNode; label: string; badge?: string }> = [
    { id: "pipeline", icon: <Briefcase size={16} />, label: t(`${NS}.text_tab_pipeline`, "Candidate pipeline"), badge: board ? String(board.totals.active) : undefined },
    { id: "establishment", icon: <Building2 size={16} />, label: t(`${NS}.text_tab_establishment`, "Approved manpower and establishment") },
    { id: "referrals", icon: <Award size={16} />, label: t(`${NS}.text_tab_referrals`, "Employee referral portal"), badge: ledger ? String(ledger.rows.length) : undefined },
    { id: "interviews", icon: <FileCheck size={16} />, label: t(`${NS}.text_tab_interviews`, "Structured interview engine") },
    { id: "bias", icon: <Shield size={16} />, label: t(`${NS}.text_tab_bias`, "Bias detection and DEI analytics") },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.text_title`, "Talent acquisition, establishment and referrals")}</h2>
          <p>{t(`${NS}.text_subtitle`, "Approved manpower ceilings, replacement codes, the employee referral ledger and the candidate pipeline{year}.", { year: establishment ? ` (${establishment.planYear})` : "" })}</p>
        </div>
        <div className={styles.actions}>
          {(onNavigate || onSelectConsole) && (
            <button type="button" className={styles.btnSecondary} onClick={() => { onSelectConsole?.("S4"); onNavigate?.("dashboard", "dashboard", "s4"); }} title={t(`${NS}.title_command`, "Open the talent acquisition command dashboard")}>
              <Sparkles size={15} aria-hidden="true" />{t(`${NS}.text_command`, "Talent acquisition command")}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={() => setModal("import")} title={t(`${NS}.title_upload_ats_candidate_resumes_csv_profile`, "Upload ATS candidate resumes and CSV profiles in bulk")}>
            <UploadCloud size={15} aria-hidden="true" />{t(`${NS}.text_bulk_ats_import`, "Bulk ATS import")}
          </button>
          <button type="button" className={styles.btnSecondary} disabled title={ctcReason} aria-label={`${t(`${NS}.text_ctc_exception_workflow`, "CTC exception workflow")}. ${ctcReason}`}>
            <DollarSign size={15} aria-hidden="true" />{t(`${NS}.text_ctc_exception_workflow`, "CTC exception workflow")}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={exportCandidates} disabled={cards.length === 0}
            title={cards.length === 0 ? t(`${NS}.text_export_empty`, "No candidates in the pipeline to export") : t(`${NS}.text_export_candidates`, "Export candidates")}>
            <Download size={15} aria-hidden="true" />{t(`${NS}.text_export_candidates`, "Export candidates")}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => setModal("referral")} disabled={data.register.status !== "ready"}>
            <UserPlus size={16} aria-hidden="true" />{t(`${NS}.text_refer_candidate`, "Refer candidate")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setModal("requisition")} disabled={data.register.status !== "ready"}>
            <Plus size={16} aria-hidden="true" />{t(`${NS}.text_create_requisition`, "Create requisition")}
          </button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <Stat tone={styles.toneInfo} icon={<Briefcase size={22} />} label={t(`${NS}.text_stat_active`, "Active applications")} value={board ? String(board.totals.active) : null} pending={data.board.status} t={t} />
        <Stat tone={styles.toneSignal} icon={<Building2 size={22} />} label={t(`${NS}.text_stat_sanctioned`, "Sanctioned manpower quota")} value={sanctionedTotal === null ? (establishment ? t(`${NS}.text_not_configured`, "Not configured") : null) : String(sanctionedTotal)} pending={data.establishment.status} t={t} muted={sanctionedTotal === null} />
        <Stat tone={styles.tonePending} icon={<UserPlus size={22} />} label={t(`${NS}.text_stat_referrals`, "Employee referrals")} value={ledger ? String(ledger.rows.length) : null} pending={data.referrals.status} t={t} />
        <Stat tone={styles.toneAgent} icon={<Shield size={22} />} label={t(`${NS}.text_stat_fairness`, "Adverse impact ratio")} value={fairness ? (fairness.readiness.computable ? t(`${NS}.text_air_ready`, "Ready to compute") : t(`${NS}.text_air_unavailable`, "Not available")) : null} pending={data.fairness.status} t={t} muted />
      </div>

      <div className={styles.tabNav} role="tablist" aria-label={t(`${NS}.text_tabs`, "Recruitment sections")}>
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ""}`} onClick={() => selectTab(tab.id)}>
            {tab.icon}{tab.label}{tab.badge !== undefined && <span className={`${styles.badge} ${styles.badgeInfo}`}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "pipeline" && (
          <SourceState t={t} source={data.board} onRetry={data.reload}>
            {(value) => value.columns.every((column) => column.cards.length === 0)
              ? <p className={styles.emptyNote}>{t(`${NS}.text_pipeline_empty`, "No applications yet. Refer a candidate or import candidates against a requisition.")}</p>
              : <PipelineTab t={t} board={value} busyId={busyId} onAdvance={advance} onRefuse={(message) => toast(t(`${NS}.text_move_refused`, "Move not allowed"), message, "warning")} />}
          </SourceState>
        )}
        {activeTab === "establishment" && <EstablishmentTab t={t} locale={locale} establishment={data.establishment} register={data.register} onRetry={data.reload} onRaise={() => setModal("requisition")} />}
        {activeTab === "referrals" && <ReferralsTab t={t} locale={locale} ledger={data.referrals} onRetry={data.reload} onRefer={() => setModal("referral")} />}
        {activeTab === "interviews" && <InterviewsTab t={t} locale={locale} source={data.interviews} onRetry={data.reload} />}
        {activeTab === "bias" && <FairnessTab t={t} source={data.fairness} onRetry={data.reload} />}
      </div>

      {modal === "requisition" && data.register.status === "ready" && (
        <RequisitionModal t={t} register={data.register.data} people={data.people.status === "ready" ? data.people.data : []} defaultManagerId={null}
          onClose={() => setModal(null)}
          onCreated={(code) => { setModal(null); toast(t(`${NS}.text_requisition_created`, "Requisition created"), t(`${NS}.text_requisition_created_body`, "Requisition {code} was saved as a draft.", { code }), "success"); data.reload(); }} />
      )}
      {modal === "referral" && (
        <ReferralModal t={t} requisitions={openRequisitions} schemeNote={schemeNote} onClose={() => setModal(null)}
          onCreated={(name) => { setModal(null); toast(t(`${NS}.text_referral_submitted`, "Referral submitted"), t(`${NS}.text_referral_submitted_body`, "{name} was referred.", { name }), "success"); data.reload(); }} />
      )}
      <DataImportModal isOpen={modal === "import"} onClose={() => { setModal(null); data.reload(); }} initialPreset="candidates" />
    </div>
  );
}

function Stat({ tone, icon, label, value, pending, t, muted = false }: { tone: string; icon: ReactNode; label: string; value: string | null; pending: string; t: Translate; muted?: boolean }) {
  const text = value ?? (pending === "loading" ? t(`${NS}.text_loading`, "Loading…") : t(`${NS}.text_unavailable`, "Unavailable"));
  return (
    <div className={styles.statCard}>
      <div className={`${styles.statIcon} ${tone}`} aria-hidden="true">{icon}</div>
      <div>
        <div className={value === null || muted ? `${styles.statValue} ${styles.statValueMuted}` : styles.statValue}>{text}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}
