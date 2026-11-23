"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock, Download, Plus, Users } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { downloadCSV } from "@/utils/exportUtils";
import styles from "./ContractWorkforceView.module.css";
import { NS, errorText, getData, type Agency, type ContractWorker, type Loadable, type Reconciliation, type Translate } from "./contract-workforce/api";
import { categoryLabel, complianceLabel } from "./contract-workforce/labels";
import ReconciliationTab from "./contract-workforce/ReconciliationTab";
import WorkerRegistryTab from "./contract-workforce/WorkerRegistryTab";
import VendorMasterTab from "./contract-workforce/VendorMasterTab";
import RegisterWorkerDialog from "./contract-workforce/RegisterWorkerDialog";

/**
 * Contract & contingent workforce console. Every figure comes from the contractor routes:
 * GET /api/v1/contractors/reconciliation (gate punch vs invoice), GET /api/v1/contractors/assignments (worker register,
 * server-side search and pagination), GET /api/v1/contractors/agencies (vendor master). Registering a worker posts to
 * /api/v1/contractors/assignments with an Idempotency-Key and the register refreshes only after the server accepts it.
 */

type Tab = "reconciliation" | "workers" | "vendors";
export type WorkerPage = { rows: ContractWorker[]; total: number };
const PAGE_SIZE = 25;

type Props = {
  /** Passed by MainWorkspace; the console keeps its own tabs, so navigation callbacks are accepted but unused. */
  onNavigate?: (tab: string) => void;
  onSelectConsole?: (consoleId: string) => void;
  activeSubFeature?: string | null;
};

const SUB_FEATURE_TAB: Record<string, Tab> = { reconciliation: "reconciliation", workers: "workers", registry: "workers", vendors: "vendors" };

const ContractWorkforceView = ({ activeSubFeature = null }: Props) => {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const [activeTab, setActiveTab] = useState<Tab>(() => (activeSubFeature && SUB_FEATURE_TAB[activeSubFeature]) || "reconciliation");
  const [recon, setRecon] = useState<Loadable<Reconciliation[]>>({ status: "loading" });
  const [agencies, setAgencies] = useState<Loadable<Agency[]>>({ status: "loading" });
  const [workers, setWorkers] = useState<Loadable<WorkerPage>>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadRecon = useCallback(async (signal?: AbortSignal) => {
    setRecon({ status: "loading" });
    try {
      const { data } = await getData<Reconciliation[]>("/api/v1/contractors/reconciliation", t(`${NS}.text_recon_load_failed`, "The reconciliation queue could not be loaded."), signal);
      setRecon({ status: "ready", data });
    } catch (error) {
      if (!signal?.aborted) setRecon({ status: "error", message: errorText(error, t(`${NS}.text_recon_load_failed`, "The reconciliation queue could not be loaded.")) });
    }
  }, [t]);

  const loadAgencies = useCallback(async (signal?: AbortSignal) => {
    setAgencies({ status: "loading" });
    try {
      const { data } = await getData<Agency[]>("/api/v1/contractors/agencies", t(`${NS}.text_vendors_load_failed`, "The vendor master could not be loaded."), signal);
      setAgencies({ status: "ready", data });
    } catch (error) {
      if (!signal?.aborted) setAgencies({ status: "error", message: errorText(error, t(`${NS}.text_vendors_load_failed`, "The vendor master could not be loaded.")) });
    }
  }, [t]);

  const loadWorkers = useCallback(async (pageNumber: number, query: string, signal?: AbortSignal) => {
    setWorkers({ status: "loading" });
    try {
      const params = new URLSearchParams({ page: String(pageNumber), pageSize: String(PAGE_SIZE) });
      if (query.trim()) params.set("q", query.trim());
      const { data, total } = await getData<ContractWorker[]>(`/api/v1/contractors/assignments?${params}`, t(`${NS}.text_workers_load_failed`, "The worker register could not be loaded."), signal);
      setWorkers({ status: "ready", data: { rows: data, total: total ?? data.length } });
    } catch (error) {
      if (!signal?.aborted) setWorkers({ status: "error", message: errorText(error, t(`${NS}.text_workers_load_failed`, "The worker register could not be loaded.")) });
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRecon(controller.signal);
    void loadAgencies(controller.signal);
    return () => controller.abort();
  }, [loadRecon, loadAgencies]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadWorkers(page, search, controller.signal), search ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadWorkers, page, search]);

  /** Exports the whole register (every page the server returns), not just the visible page. */
  const exportRegister = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const all: ContractWorker[] = [];
      for (let next = 1; next <= 50; next += 1) {
        const { data, total } = await getData<ContractWorker[]>(`/api/v1/contractors/assignments?page=${next}&pageSize=100`, t(`${NS}.text_workers_load_failed`, "The worker register could not be loaded."));
        all.push(...data);
        if (data.length < 100 || (total !== null && all.length >= total)) break;
      }
      const headers = [
        t(`${NS}.text_col_worker_code`, "Worker ID"), t(`${NS}.text_col_name`, "Name"), t(`${NS}.text_vendor_agency`, "Vendor / Agency"),
        t(`${NS}.text_col_contract`, "Contract"), t(`${NS}.text_col_category`, "Category"), t(`${NS}.text_col_trade`, "Trade / Role"),
        t(`${NS}.text_col_uan`, "UAN"), t(`${NS}.text_col_esic`, "ESIC"), t(`${NS}.text_work_site`, "Work Site"),
        t(`${NS}.text_col_daily_wage`, "Daily wage"), t(`${NS}.text_col_currency`, "Currency"), t(`${NS}.text_compliance`, "Compliance"), t(`${NS}.text_col_starts_on`, "Start date"),
      ];
      const rows = all.map((w) => [w.workerCode ?? "", w.name ?? "", w.agencyName ?? "", w.contractCode ?? "", categoryLabel(t, w.category), w.trade ?? "",
        w.uan ?? "", w.esicNumber ?? "", w.site ?? "", w.dailyWage ?? "", w.currency, complianceLabel(t, w.compliance), w.startsOn ?? ""]);
      const result = downloadCSV("contract_workforce_register.csv", headers, rows) as { success: boolean };
      if (!result.success) setNotice({ tone: "error", text: t(`${NS}.text_export_empty`, "There are no registered workers to export.") });
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error, t(`${NS}.text_workers_load_failed`, "The worker register could not be loaded.")) });
    } finally {
      setExporting(false);
    }
  };

  const onRegistered = (name: string) => {
    setIsRegisterOpen(false);
    setNotice({ tone: "ok", text: t(`${NS}.text_register_done`, "{name} is registered in the contract worker register.", { name }) });
    setActiveTab("workers");
    setSearch("");
    setPage(1);
    void loadWorkers(1, "");
    void loadAgencies();
  };

  const count = (state: Loadable<unknown[]> | Loadable<WorkerPage>) =>
    state.status !== "ready" ? "…" : Array.isArray(state.data) ? String(state.data.length) : String(state.data.total);

  const tabs: Array<{ id: Tab; icon: typeof Clock; label: string }> = [
    { id: "reconciliation", icon: Clock, label: t(`${NS}.text_tab_reconciliation`, "Gate punch vs invoice reconciliation ({count})", { count: count(recon) }) },
    { id: "workers", icon: Users, label: t(`${NS}.text_tab_workers`, "Contract worker registry ({count})", { count: count(workers) }) },
    { id: "vendors", icon: Building2, label: t(`${NS}.text_tab_vendors`, "Staffing vendor master ({count})", { count: count(agencies) }) },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.badgeRow}>
            <span className={styles.livePill}><Users size={13} aria-hidden="true" />{t(`${NS}.text_pill_module`, "Contingent workforce")}</span>
            <span className={styles.mfgPill}><Building2 size={13} aria-hidden="true" />{t(`${NS}.text_pill_core`, "Manufacturing & industrial core")}</span>
          </div>
          <h2>{t(`${NS}.text_title`, "Contract & Contingent Workforce Management")}</h2>
          <p>{t(`${NS}.text_subtitle`, "Contract personnel as first-class workforce peers: gate attendance reconciled against vendor invoices, statutory KYC and vendor compliance.")}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => void exportRegister()} disabled={exporting} title={t(`${NS}.title_export_contract_workforce_register`, "Export Contract Workforce Register")}>
            <Download size={16} aria-hidden="true" />{exporting ? t(`${NS}.text_exporting`, "Exporting…") : t(`${NS}.text_export_register`, "Export register")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setIsRegisterOpen(true)}>
            <Plus size={16} aria-hidden="true" />{t(`${NS}.text_register_contract_worker`, "Register Contract Worker")}
          </button>
        </div>
      </div>

      {notice && (
        <div className={notice.tone === "ok" ? styles.noticeOk : styles.noticeError} role={notice.tone === "ok" ? "status" : "alert"}>
          {notice.tone === "ok" && <CheckCircle2 size={16} aria-hidden="true" />}{notice.text}
          <button type="button" className={styles.noticeClose} onClick={() => setNotice(null)} aria-label={t(`${NS}.text_dismiss`, "Dismiss")}>×</button>
        </div>
      )}

      <div className={styles.tabsRow} role="tablist" aria-label={t(`${NS}.text_tabs`, "Contract workforce sections")}>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={`${styles.tabBtn} ${activeTab === id ? styles.activeTab : ""}`} onClick={() => setActiveTab(id)}>
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </div>

      {activeTab === "reconciliation" && <ReconciliationTab t={t} state={recon} onRetry={() => void loadRecon()} onChanged={() => void loadRecon()} />}
      {activeTab === "workers" && (
        <WorkerRegistryTab t={t} state={workers} search={search} page={page} pageSize={PAGE_SIZE}
          onSearch={(value) => { setSearch(value); setPage(1); }} onPage={setPage} onRetry={() => void loadWorkers(page, search)} />
      )}
      {activeTab === "vendors" && <VendorMasterTab t={t} state={agencies} onRetry={() => void loadAgencies()} />}

      {isRegisterOpen && <RegisterWorkerDialog t={t} onClose={() => setIsRegisterOpen(false)} onRegistered={onRegistered} />}
    </div>
  );
};

export default ContractWorkforceView;
