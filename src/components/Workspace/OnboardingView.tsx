"use client";

import { useCallback, useMemo, useState } from "react";
import { Award, Clock, FileText, Laptop, Layers, Workflow } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "./OnboardingView.module.css";
import WorkflowBuilderModal from "./WorkflowBuilderModal";
import type { Translate } from "./onboarding/api";
import { useResource } from "./onboarding/useResource";
import AssetsTab, { type AssetRow } from "./onboarding/AssetsTab";
import AssetAllocateDialog from "./onboarding/AssetAllocateDialog";
import LettersTab from "./onboarding/LettersTab";
import RecognitionTab, { type RecognitionRegister } from "./onboarding/RecognitionTab";
import AwardDialog from "./onboarding/AwardDialog";
import { ChainsTab, MilestonesTab, StudioTab, type InstanceRow, type TemplateRow } from "./onboarding/LifecycleTabs";

/**
 * Onboarding workspace. Every value comes from the tenant-scoped API:
 * assets        GET /api/v1/assets/register · POST register, POST {id}/allocate, POST {id}/return
 * letters       POST /api/v1/hr-letters/generate · GET /api/v1/hr-letters
 * recognition   GET/POST /api/v1/recognition-register · GET /api/v1/onboarding/celebrations
 * studio/chains GET /api/v1/onboarding/templates
 * milestones    GET /api/v1/onboarding/instances · POST /api/v1/onboarding/tasks/{id}/complete
 */

type Tab = "assets" | "letters" | "recognition" | "studio" | "milestones" | "chains";

const NS = "components.Workspace.OnboardingView";

const SUB_FEATURE_TABS: Record<string, Tab> = {
  asset_register: "assets", assets: "assets", ops_assets: "assets",
  letters_register: "letters", letters: "letters",
  recognition: "recognition", talent_recognition: "recognition",
  studio: "studio", platform_workflows: "studio",
  milestones: "milestones", induction_tasks: "milestones",
  joining_chain: "chains", clearance_board: "chains", chains: "chains",
};

type Props = {
  onNavigate?: (tab: string) => void;
  onSelectConsole?: (consoleId: string) => void;
  activeSubFeature?: string | null;
};

export default function OnboardingView({ activeSubFeature }: Props) {
  const { t: rawT, locale } = useTranslation();
  const t = rawT as Translate;
  const subFeatureTab = activeSubFeature ? SUB_FEATURE_TABS[activeSubFeature] : undefined;
  const [selected, setSelected] = useState<{ tab: Tab; from: string | null | undefined }>({ tab: subFeatureTab ?? "assets", from: activeSubFeature });
  // A new sub-feature from the navigation wins over the last tab the user clicked.
  const activeTab: Tab = selected.from !== activeSubFeature && subFeatureTab ? subFeatureTab : selected.tab;
  const selectTab = (tab: Tab) => setSelected({ tab, from: activeSubFeature });

  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);

  const assets = useResource<AssetRow[]>("/api/v1/assets/register", t(`${NS}.assets_failed`, "The asset register could not be loaded."));
  const register = useResource<RecognitionRegister>("/api/v1/recognition-register?pageSize=50", t(`${NS}.wall_failed`, "The recognition register could not be loaded."));
  const templates = useResource<TemplateRow[]>("/api/v1/onboarding/templates", t(`${NS}.templates_failed`, "Onboarding workflows could not be loaded."));
  const instances = useResource<InstanceRow[]>("/api/v1/onboarding/instances", t(`${NS}.instances_failed`, "Onboarding cases could not be loaded."));

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeZone: "UTC" }), [locale]);
  const dateTimeFormat = useMemo(() => new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeStyle: "short" }), [locale]);
  const formatDate = useCallback((iso: string | null) => {
    if (!iso) return "—";
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
    return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
  }, [dateFormat]);
  const formatDateTime = useCallback((iso: string | null) => {
    if (!iso) return "—";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : dateTimeFormat.format(date);
  }, [dateTimeFormat]);
  const formatMoney = useCallback((minor: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale || undefined, { style: "currency", currency }).format(minor / 100);
    } catch {
      return `${currency} ${new Intl.NumberFormat(locale || undefined).format(minor / 100)}`;
    }
  }, [locale]);


  const tabs: Array<{ id: Tab; icon: typeof Laptop; label: string; badge: string | null; tone: string }> = [
    { id: "assets", icon: Laptop, label: t(`${NS}.tab_assets`, "Asset register"), badge: assets.state.status === "ready" ? String(assets.state.data.length) : null, tone: styles.badgeInfo },
    { id: "letters", icon: FileText, label: t(`${NS}.tab_letters`, "HR letters"), badge: null, tone: styles.badgeSuccess },
    { id: "recognition", icon: Award, label: t(`${NS}.tab_recognition`, "Recognition"), badge: register.state.status === "ready" ? String(register.state.data.count) : null, tone: styles.badgePurple },
    { id: "studio", icon: Workflow, label: t(`${NS}.tab_studio`, "Workflow pipelines"), badge: templates.state.status === "ready" ? String(templates.state.data.length) : null, tone: styles.badgeInfo },
    { id: "milestones", icon: Clock, label: t(`${NS}.tab_milestones`, "30-60-90 milestones"), badge: instances.state.status === "ready" ? String(instances.state.data.length) : null, tone: styles.badgeWarning },
    { id: "chains", icon: Layers, label: t(`${NS}.tab_chains`, "Lifecycle chains"), badge: null, tone: styles.badgeInfo },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.title`, "Onboarding and lifecycle")}</h2>
          <p>{t(`${NS}.subtitle`, "Assets, letters, recognition and the onboarding workflow for every joiner.")}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => setAssetOpen(true)}><Laptop size={15} aria-hidden="true" />{t(`${NS}.action_allocate`, "Allocate asset")}</button>
          <button type="button" className={styles.btnSecondary} onClick={() => setAwardOpen(true)}><Award size={15} aria-hidden="true" />{t(`${NS}.action_award`, "Grant award")}</button>
          <button type="button" className={styles.btnPrimary} onClick={() => setWorkflowOpen(true)} title={t(`${NS}.action_designer_hint`, "Open the workflow designer")}><Workflow size={16} aria-hidden="true" />{t(`${NS}.action_designer`, "Workflow designer")}</button>
        </div>
      </div>

      <div className={styles.tabNav} role="tablist" aria-label={t(`${NS}.tabs_label`, "Onboarding sections")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`onboarding-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls="onboarding-tab-panel"
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ""}`}
            onClick={() => selectTab(tab.id)}
          >
            <tab.icon size={16} aria-hidden="true" />{tab.label}
            {tab.badge !== null && <span className={`${styles.badge} ${tab.tone}`}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      <div id="onboarding-tab-panel" role="tabpanel" aria-labelledby={`onboarding-tab-${activeTab}`}>
        {activeTab === "assets" && <AssetsTab state={assets.state} onReload={assets.reload} onAllocate={() => setAssetOpen(true)} formatDate={formatDate} />}
        {activeTab === "letters" && <LettersTab formatDateTime={formatDateTime} />}
        {activeTab === "recognition" && <RecognitionTab register={register.state} onReload={register.reload} onGrant={() => setAwardOpen(true)} formatDate={formatDate} formatMoney={formatMoney} />}
        {activeTab === "studio" && <StudioTab state={templates.state} onReload={templates.reload} onOpenDesigner={() => setWorkflowOpen(true)} />}
        {activeTab === "milestones" && <MilestonesTab state={instances.state} onReload={instances.reload} formatDate={formatDate} />}
        {activeTab === "chains" && <ChainsTab state={templates.state} onReload={templates.reload} />}
      </div>

      <AssetAllocateDialog open={assetOpen} onClose={() => setAssetOpen(false)} onSaved={assets.reload} />
      <AwardDialog open={awardOpen} register={register.state.status === "ready" ? register.state.data : null} onClose={() => setAwardOpen(false)} onSaved={register.reload} formatMoney={formatMoney} />
      <WorkflowBuilderModal isOpen={workflowOpen} onClose={() => setWorkflowOpen(false)} />
    </div>
  );
}
