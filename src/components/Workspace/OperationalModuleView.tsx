"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Edit2, Plus, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import LeaveWorkflowPanel from "@/components/Leave/LeaveWorkflowPanel";
import ProcessGuide from "./ProcessGuide";
import { NS, resolveFields, transitionRecord, type ModuleRecord, type OperationalModule, type Translate } from "./operational-module/data";
import { useIdempotencyKey, useLookups, useModuleRecords } from "./operational-module/hooks";
import RecordTable from "./operational-module/RecordTable";
import RecordDetailPanel from "./operational-module/RecordDetailPanel";
import RecordFormDialog from "./operational-module/RecordFormDialog";
import RecordViewDialog from "./operational-module/RecordViewDialog";
import styles from "./OperationalModuleView.module.css";

export { dedupeOptions } from "./operational-module/data";

type Props = { module: OperationalModule; onNavigate?: (tab: string) => void };
type Notice = { tone: "ok" | "error"; text: string } | null;
type FormState = { mode: "create" } | { mode: "edit"; record: ModuleRecord } | null;

/**
 * Generic register screen for an operational module from the module registry. Records, lookups and the
 * audit trail come from the database through /api/v1 routes; writes update the list only after the server
 * accepted them (see ./operational-module/data.ts for the endpoints).
 */
export default function OperationalModuleView(props: Props) {
  if (props.module.screenId === "SCR-030") return <><ProcessGuide screenId={props.module.screenId} /><LeaveWorkflowPanel /></>;
  return <OperationalModuleContent key={props.module.id} {...props} />;
}

const isEditAction = (action: string) => /edit|update|modify|roster|schedule/i.test(action);

function OperationalModuleContent({ module, onNavigate }: Props) {
  const { t: rawT, locale } = useTranslation();
  const t = rawT as Translate;
  const records = useModuleRecords(module, t);
  const lookups = useLookups(module, t);
  const fields = useMemo(() => resolveFields(module.fields, lookups), [module.fields, lookups]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [viewing, setViewing] = useState<ModuleRecord | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [auditToken, setAuditToken] = useState(0);
  const transitionKey = useIdempotencyKey();

  const state = records.state;
  const items = state.status === "ready" ? state.items : [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  // Missing storage or permission is a server fact: keep every control visible but disable writes.
  const storageMissing = state.status === "error" && ["MODULE_NOT_FOUND", "STORAGE_UNAVAILABLE"].includes(state.code);
  const forbidden = state.status === "error" && state.httpStatus === 403;
  const canWrite = state.status === "ready";

  const formatDate = useCallback((iso: string | null) => {
    if (!iso) return "—";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }, [locale]);

  const navigate = (tab: string) => {
    if (onNavigate) onNavigate(tab);
    else window.dispatchEvent(new CustomEvent("nucleus:open-action", { detail: { action: tab } }));
  };

  const onSaved = (record: ModuleRecord) => {
    const created = form?.mode === "create";
    setForm(null);
    setSelectedId(record.id);
    setAuditToken((value) => value + 1);
    setNotice({ tone: "ok", text: created ? t(`${NS}.text_created_success`, "{title}: record created.", { title: module.title }) : t(`${NS}.text_updated_success`, "{title}: record updated.", { title: module.title }) });
    if (created) records.reload();
    else records.replace(record);
  };

  const transition = async (target: string) => {
    if (!selected || transitioning) return;
    setTransitioning(target);
    setNotice(null);
    try {
      const payload = { id: selected.id, target };
      const updated = await transitionRecord(module, selected.id, target, transitionKey.keyFor(payload), t(`${NS}.text_transition_failed`, "The state could not be changed."));
      transitionKey.reset();
      records.replace(updated);
      setAuditToken((value) => value + 1);
      setNotice({ tone: "ok", text: t(`${NS}.text_transition_success`, "Record moved to {state}.", { state: target }) });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : t(`${NS}.text_transition_failed`, "The state could not be changed.") });
    } finally {
      setTransitioning(null);
    }
  };

  const runAction = (action: string, index: number) => {
    if (index === 0) { setForm({ mode: "create" }); return; }
    if (isEditAction(action) && selected) { setForm({ mode: "edit", record: selected }); return; }
    if (/^open compliances?$/i.test(action.trim())) navigate("compliance");
  };

  const actionAvailable = (action: string, index: number) => {
    if (index === 0) return canWrite;
    if (isEditAction(action)) return canWrite && Boolean(selected);
    return /^open compliances?$/i.test(action.trim());
  };

  const actionReason = (action: string, index: number) => {
    if (!canWrite) return t(`${NS}.title_register_unavailable`, "This register is not available, so records cannot be changed.");
    if (index !== 0 && isEditAction(action) && !selected) return t(`${NS}.title_select_first`, "Select a record first.");
    if (index !== 0 && !isEditAction(action) && !/^open compliances?$/i.test(action.trim())) return t(`${NS}.title_action_unavailable`, "This action is not connected to a server workflow yet.");
    return undefined;
  };

  return (
    <section className={styles.page} aria-labelledby="operational-module-title">
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{module.primary.replaceAll("_", " ")}</div>
          <h1 id="operational-module-title">{module.title}</h1>
          {module.description && <p>{module.description}</p>}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" onClick={records.reload} disabled={state.status === "loading"} aria-label={t(`${NS}.aria-label_refresh_records`, "Refresh records")}>
            <RefreshCw size={16} className={state.status === "loading" ? styles.spin : ""} aria-hidden /> {t(`${NS}.text_refresh`, "Refresh")}
          </button>
          {module.actions.map((action, index) => (
            <button
              key={action}
              className={index === 0 ? styles.primaryButton : styles.secondaryButton}
              type="button"
              onClick={() => runAction(action, index)}
              disabled={!actionAvailable(action, index)}
              title={actionReason(action, index)}
            >
              {index === 0 ? <Plus size={16} aria-hidden /> : isEditAction(action) ? <Edit2 size={16} aria-hidden /> : <UploadCloud size={16} aria-hidden />}
              {action}
            </button>
          ))}
        </div>
      </header>

      {notice && (
        <div role={notice.tone === "ok" ? "status" : "alert"} className={notice.tone === "ok" ? styles.notice : styles.error}>
          {notice.tone === "ok" ? <CheckCircle2 size={16} aria-hidden /> : <AlertCircle size={16} aria-hidden />}{notice.text}
        </div>
      )}
      {(storageMissing || forbidden) && state.status === "error" && (
        <div role="alert" className={styles.error}>
          <AlertCircle size={16} aria-hidden />
          {storageMissing ? t(`${NS}.text_storage_missing`, "This register is not connected to a database store yet, so it has no records and cannot accept new ones. ({reason})", { reason: state.message }) : state.message}
        </div>
      )}

      <ProcessGuide screenId={module.screenId} />

      <div className={styles.scopeBar}>
        <span><ShieldCheck size={16} aria-hidden /> {t(`${NS}.text_scope`, "Only records of your organisation are shown, and every read and change is checked against your role on the server.")}</span>
        <button type="button" className={styles.secondaryButton} onClick={() => navigate(module.primary)}>
          {t(`${NS}.text_open_module`, "Open {module}", { module: module.primary.replaceAll("_", " ") })}
        </button>
      </div>

      <div className={styles.layout}>
        <RecordTable
          module={module}
          state={state}
          lookups={lookups}
          selectedId={selected?.id ?? null}
          canWrite={canWrite}
          search={records.search}
          page={records.page}
          pageSize={records.pageSize}
          t={t}
          onSearch={records.setSearch}
          onPage={records.setPage}
          onPageSize={records.setPageSize}
          onSelect={(record) => setSelectedId(record.id)}
          onView={(record) => { setSelectedId(record.id); setViewing(record); }}
          onEdit={(record) => { setSelectedId(record.id); setForm({ mode: "edit", record }); }}
          onRetry={records.reload}
        />
        <RecordDetailPanel
          module={module}
          record={selected}
          lookups={lookups}
          canWrite={canWrite}
          transitioning={transitioning}
          auditToken={auditToken}
          formatDate={formatDate}
          t={t}
          onEdit={() => selected && setForm({ mode: "edit", record: selected })}
          onView={() => selected && setViewing(selected)}
          onTransition={(target) => void transition(target)}
        />
      </div>

      {form && (
        <RecordFormDialog
          key={form.mode === "edit" ? form.record.id : "create"}
          module={module}
          fields={fields}
          lookups={lookups}
          target={form.mode === "edit" ? form.record : null}
          t={t}
          onClose={() => setForm(null)}
          onSaved={onSaved}
        />
      )}
      {viewing && (
        <RecordViewDialog
          module={module}
          record={viewing}
          fields={fields}
          lookups={lookups}
          canWrite={canWrite}
          formatDate={formatDate}
          t={t}
          onClose={() => setViewing(null)}
          onEdit={() => { const record = viewing; setViewing(null); setForm({ mode: "edit", record }); }}
        />
      )}
    </section>
  );
}
