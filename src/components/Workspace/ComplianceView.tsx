"use client";

import { useState } from "react";
import { Calculator, Calendar, Download, FileCheck, HardHat, Layers, MapPin, Server, ShieldCheck } from "lucide-react";
import { useHRMS } from "@/context/HRMSContext";
import { downloadCSV } from "@/utils/exportUtils";
import styles from "./ComplianceView.module.css";
import { NS, formatDate, useResource, useT } from "./compliance/api";
import ErpIntegrationTab from "./compliance/ErpIntegrationTab";
import FactoryRegistersTab from "./compliance/FactoryRegistersTab";
import FormFTab from "./compliance/FormFTab";
import ObligationsTab from "./compliance/ObligationsTab";
import { RulePacksTab, StateMatrixTab } from "./compliance/RuleTabs";
import WageFloorTab from "./compliance/WageFloorTab";
import type { RulePacks, StatutoryRegister } from "./compliance/types";

/**
 * Statutory compliance workspace. Every tab reads a tenant-scoped API:
 *  - Wage floor: /api/v1/compliance/wage-floor (stored rule pack)
 *  - Obligations: /api/v1/statutory-register + /api/v1/operations/filings/{id}/{action}
 *  - Factory registers: /api/v1/compliance (Form 18 / 36) and /api/v1/compliance/muster-roll (Form 28)
 *  - Form F: /api/v1/compliance/form-f
 *  - ERP & GL: /api/v1/compliance/erp-sync and /api/v1/compliance/gl-dispatch
 *  - State matrix and rule packs: /api/v1/compliance/rule-packs
 */

type Tab = "simulator" | "calendar" | "factory_registers" | "form_f_gratuity" | "erp_integration" | "matrix" | "packs";
type Props = { onNavigate?: (tab: string) => void; onSelectConsole?: (id: string) => void; activeSubFeature?: string | null };

export default function ComplianceView(_props: Props) {
  const { t, locale } = useT();
  const { showToast } = useHRMS() as { showToast?: (title: string, message: string, type: string) => void };
  const [tab, setTab] = useState<Tab>("simulator");
  const register = useResource<StatutoryRegister>("/api/v1/statutory-register", t(`${NS}.ob_failed`, "The filing register could not be loaded."));
  const packs = useResource<RulePacks>("/api/v1/compliance/rule-packs", t(`${NS}.rp_failed`, "Rule packs could not be loaded."));
  const notify = (title: string, message: string, tone: "success" | "error") => showToast?.(title, message, tone);

  const active = packs.state.status === "ready" ? packs.state.data.active : null;
  const registerState = register.state.status === "idle" ? { status: "loading" as const } : register.state;
  const packState = packs.state.status === "idle" ? { status: "loading" as const } : packs.state;
  const obligationCount = register.state.status === "ready" ? register.state.data.items.length : null;

  const exportDossier = () => {
    if (register.state.status !== "ready") return;
    const headers = [t(`${NS}.ob_col_obligation`, "Obligation"), t(`${NS}.ob_col_jurisdiction`, "Jurisdiction"), t(`${NS}.ob_col_period`, "Filing period"), t(`${NS}.ob_col_due`, "Statutory due date"),
      t(`${NS}.ob_col_status`, "Status"), t(`${NS}.receipt_filed_on`, "Filed on"), t(`${NS}.receipt_ack`, "Acknowledgement / TRRN"), t(`${NS}.ob_col_amount`, "Amount remitted"), t(`${NS}.ob_col_owner`, "Assigned owner")];
    const rows = register.state.data.items.map((r) => [r.formCode, r.stateCode, r.period, r.dueDate ?? "", r.status, r.outcome?.filedOn ?? "", r.outcome?.acknowledgementNumber ?? "",
      r.outcome?.amountRemittedMinor === null || r.outcome?.amountRemittedMinor === undefined ? "" : `${(r.outcome.amountRemittedMinor / 100).toFixed(2)} ${r.outcome.currency}`, r.owner]);
    const result = downloadCSV(`statutory-compliance-dossier-${register.state.data.asOf}.csv`, headers, rows) as { success: boolean };
    notify(t(`${NS}.dossier_title`, "Audit dossier"), result.success ? t(`${NS}.dossier_done`, "Statutory filing dossier downloaded.") : t(`${NS}.dossier_empty`, "No filings are registered, so there is nothing to export."), result.success ? "success" : "error");
  };

  const tabs: Array<{ id: Tab; icon: typeof Calculator; label: string }> = [
    { id: "simulator", icon: Calculator, label: t(`${NS}.tab_wage_floor`, "Wage floor") },
    { id: "calendar", icon: Calendar, label: obligationCount === null ? t(`${NS}.tab_obligations`, "Obligations") : t(`${NS}.tab_obligations_n`, "Obligations ({count})", { count: obligationCount }) },
    { id: "factory_registers", icon: HardHat, label: t(`${NS}.tab_factory`, "Factory registers") },
    { id: "form_f_gratuity", icon: FileCheck, label: t(`${NS}.tab_form_f`, "Form F gratuity") },
    { id: "erp_integration", icon: Server, label: t(`${NS}.tab_erp`, "ERP & GL sync") },
    { id: "matrix", icon: MapPin, label: t(`${NS}.tab_matrix`, "State matrix") },
    { id: "packs", icon: Layers, label: t(`${NS}.tab_packs`, "Rule packs") },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.badgeRow}>
            <span className={styles.livePill}><ShieldCheck size={13} aria-hidden="true" />{t(`${NS}.badge_engine`, "India statutory engine")}</span>
            <span className={styles.versionPill}>
              {active
                ? t(`${NS}.badge_pack`, "Rule pack: {code} {version}", { code: active.packCode ?? "", version: active.versionCode ?? "" })
                : packs.state.status === "ready" ? t(`${NS}.badge_no_pack`, "No rule pack assigned") : t(`${NS}.loading`, "Loading…")}
              {active?.effectiveFrom ? ` · ${formatDate(active.effectiveFrom, locale) ?? ""}` : ""}
            </span>
          </div>
          <h2>{t(`${NS}.title`, "Statutory compliance engine & Labour Codes simulator")}</h2>
          <p>{t(`${NS}.subtitle`, "The four Indian Labour Codes with versioned, state-scoped rule packs, the 50% wage-floor simulation and the statutory obligation calendar.")}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={exportDossier} disabled={register.state.status !== "ready"} title={t(`${NS}.dossier_hint`, "Export the statutory filing register as CSV")}>
            <Download size={16} aria-hidden="true" />{t(`${NS}.dossier_title`, "Audit dossier")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setTab("simulator")}>
            <Calculator size={16} aria-hidden="true" />{t(`${NS}.run_simulator`, "Run simulator")}
          </button>
        </div>
      </div>

      <div className={styles.tabsRow} role="tablist" aria-label={t(`${NS}.tabs_label`, "Compliance sections")}>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${styles.tabBtn} ${tab === id ? styles.activeTab : ""}`} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </div>

      {tab === "simulator" && <WageFloorTab />}
      {tab === "calendar" && <ObligationsTab register={registerState} reload={register.reload} notify={notify} />}
      {tab === "factory_registers" && <FactoryRegistersTab notify={notify} />}
      {tab === "form_f_gratuity" && <FormFTab notify={notify} />}
      {tab === "erp_integration" && <ErpIntegrationTab notify={notify} />}
      {tab === "matrix" && <StateMatrixTab packs={packState} reload={packs.reload} />}
      {tab === "packs" && <RulePacksTab packs={packState} reload={packs.reload} />}
    </div>
  );
}
