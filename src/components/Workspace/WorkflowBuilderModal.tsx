"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Plus, Save, Terminal, Workflow as WorkflowIcon, X } from "lucide-react";
import styles from "./WorkflowBuilderModal.module.css";
import { failureMessage, readJson, sendJson, useT } from "./engagement-client";
import WorkflowStepInspector from "./WorkflowStepInspector";
import { STEP_ICONS, WF_NS, WORKFLOWS_PATH, issueLabel, stepTypeLabel, toStepInput, type Catalogue, type Step, type Trace, type Workflow } from "./workflow-model";

/**
 * Workflow studio on /api/v1/workflows. Steps are edited locally and saved as a new immutable version
 * (PUT with If-Match = latestVersion); "Simulate" runs the server dry-run trace; activation goes through
 * /status and is refused by the server while the trace reports issues.
 */

const NS = WF_NS;
type ListEnvelope = { data: Workflow[]; meta: Catalogue };
type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: Workflow[]; catalogue: Catalogue };

export default function WorkflowBuilderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useT();
  const [state, setState] = useState<State>({ status: "loading" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; version: number; steps: Step[] } | null>(null);
  const [selected, setSelected] = useState(0);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const fetchState = useCallback(async (signal?: AbortSignal): Promise<State> => {
    const result = await readJson<ListEnvelope>(WORKFLOWS_PATH, signal);
    if (!result.ok) return { status: "error", message: failureMessage(result, t, t(`${NS}.text_load_failed`, "Workflows could not be loaded.")) };
    return { status: "ready", items: result.body?.data ?? [], catalogue: result.body.meta };
  }, [t]);
  const load = useCallback(async () => setState(await fetchState()), [fetchState]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    fetchState(controller.signal).then(setState).catch(() => undefined);
    return () => controller.abort();
  }, [isOpen, fetchState]);

  const items = state.status === "ready" ? state.items : [];
  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null;
  // Local edits belong to one stored version; once the server returns a newer one the draft restarts from it.
  const draft: Step[] = active ? (edit && edit.id === active.id && edit.version === active.latestVersion ? edit.steps : active.steps) : [];
  const setDraft = (steps: Step[]) => {
    if (active) setEdit({ id: active.id, version: active.latestVersion, steps });
  };
  const choose = (id: string) => {
    setActiveId(id);
    setSelected(0);
    setTrace(null);
  };

  if (!isOpen) return null;
  const catalogue = state.status === "ready" ? state.catalogue : null;
  const dirty = active ? JSON.stringify(draft.map(toStepInput)) !== JSON.stringify(active.steps.map(toStepInput)) : false;

  const replace = (next: Workflow) => {
    setState((current) => (current.status === "ready" ? { ...current, items: current.items.map((item) => (item.id === next.id ? next : item)) } : current));
  };

  const save = async () => {
    if (!active) return;
    setBusy("save");
    const result = await sendJson<{ data: Workflow }>("PUT", `${WORKFLOWS_PATH}/${active.id}`, { steps: draft.map(toStepInput) }, { ifMatch: `"${active.latestVersion}"` });
    setBusy(null);
    if (!result.ok) return setNotice({ tone: "error", text: failureMessage(result, t, t(`${NS}.text_save_failed`, "The workflow could not be saved.")) });
    replace(result.body.data);
    setNotice({ tone: "ok", text: t(`${NS}.text_saved`, "Saved as version {version}.", { version: result.body.data.latestVersion }) });
  };

  const simulate = async () => {
    if (!active) return;
    setBusy("trace");
    const result = await readJson<{ data: Trace }>(`${WORKFLOWS_PATH}/${active.id}/trace`);
    setBusy(null);
    if (!result.ok) return setNotice({ tone: "error", text: failureMessage(result, t, t(`${NS}.text_trace_failed`, "The simulation could not run.")) });
    setTrace(result.body.data);
  };

  const setStatus = async (status: "active" | "draft") => {
    if (!active) return;
    setBusy("status");
    const result = await sendJson<{ data: Workflow }>("POST", `${WORKFLOWS_PATH}/${active.id}/status`, { status }, { ifMatch: `"${active.latestVersion}"` });
    setBusy(null);
    if (!result.ok) return setNotice({ tone: "error", text: failureMessage(result, t, t(`${NS}.text_status_failed`, "The status could not be changed.")) });
    replace(result.body.data);
    setNotice({ tone: "ok", text: status === "active" ? t(`${NS}.text_activated`, "Workflow activated.") : t(`${NS}.text_paused`, "Workflow moved back to draft.") });
  };

  const appendStep = () => {
    if (!catalogue || draft.length >= catalogue.maxSteps) return;
    setDraft([...draft, { type: "action", title: "", description: "", slaHours: null, operator: null }]);
    setSelected(draft.length);
  };

  const step = draft[selected];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="wf-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}><WorkflowIcon size={20} aria-hidden="true" /></div>
            <h3 id="wf-title">{t(`${NS}.text_heading`, "Workflow studio")}</h3>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.btnSimulate} onClick={simulate} disabled={!active || busy !== null || dirty} title={dirty ? t(`${NS}.text_save_first`, "Save the changes before simulating.") : undefined}>
              <Play size={16} aria-hidden="true" />{t(`${NS}.text_simulate`, "Simulate")}
            </button>
            <button type="button" className={styles.btnSecondary} onClick={save} disabled={!active || !dirty || busy !== null}>
              <Save size={16} aria-hidden="true" />{t(`${NS}.text_save`, "Save version")}
            </button>
            {active && (
              <button type="button" className={styles.btnSecondary} disabled={busy !== null || dirty} onClick={() => setStatus(active.status === "active" ? "draft" : "active")}>
                {active.status === "active" ? t(`${NS}.text_pause`, "Move to draft") : t(`${NS}.text_activate`, "Activate")}
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t(`${NS}.text_close`, "Close")}><X size={20} aria-hidden="true" /></button>
          </div>
        </div>

        {notice && <p className={notice.tone === "ok" ? styles.logSuccess : styles.logInfo} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}

        {state.status === "loading" && <div className={styles.emptyState} aria-busy="true">{t(`${NS}.text_loading`, "Loading workflows…")}</div>}
        {state.status === "error" && (
          <div className={styles.emptyState} role="alert">
            <p>{state.message}</p>
            <button type="button" className={styles.btnSecondary} onClick={() => { setState({ status: "loading" }); void load(); }}>{t(`${NS}.text_retry`, "Try again")}</button>
          </div>
        )}
        {state.status === "ready" && items.length === 0 && <div className={styles.emptyState}>{t(`${NS}.text_empty`, "No workflows are defined for this tenant yet.")}</div>}

        {state.status === "ready" && active && catalogue && (
          <>
            <div className={styles.workflowTabs} role="tablist">
              {items.map((item) => (
                <button key={item.id} type="button" role="tab" aria-selected={item.id === active.id} className={`${styles.wfTabBtn} ${item.id === active.id ? styles.active : ""}`} onClick={() => choose(item.id)}>
                  {item.name}
                  <span className={item.status === "active" ? styles.statusBadgeActive : styles.statusBadgeDraft}>{t(`${NS}.status_${item.status}`, item.status)}</span>
                </button>
              ))}
            </div>
            <div className={styles.workspace}>
              <div className={styles.canvasArea}>
                <div className={styles.workflowMetaCard}>
                  <strong>{active.code}</strong> · {t(`${NS}.text_version`, "Version {latest}, published {published}", { latest: active.latestVersion, published: active.publishedVersion ?? "-" })}
                </div>
                <ol>
                  {draft.map((item, index) => {
                    const Icon = STEP_ICONS[item.type];
                    return (
                      <li key={item.id ?? `new-${index}`} className={styles.nodeWrapper}>
                        {index > 0 && <div className={styles.connectorLine} aria-hidden="true" />}
                        <button type="button" className={`${styles.nodeCard} ${index === selected ? styles.selected : ""}`} aria-pressed={index === selected} onClick={() => setSelected(index)}>
                          <span className={styles.nodeLeft}>
                            <span className={styles.nodeTypeIcon}><Icon size={16} aria-hidden="true" /></span>
                            <span>{item.title || t(`${NS}.text_untitled`, "Untitled step")}</span>
                          </span>
                          <span className={styles.nodeRight}>
                            <span className={styles.typeBadge}>{stepTypeLabel(item.type, t)}</span>
                            {item.slaHours && <span className={styles.slaBadge}>{t(`${NS}.text_sla_badge`, "{hours} h SLA", { hours: item.slaHours })}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className={styles.appendNodeBar}>
                  <button type="button" className={styles.appendNodeBtn} onClick={appendStep} disabled={draft.length >= catalogue.maxSteps}>
                    <Plus size={16} aria-hidden="true" />{t(`${NS}.text_add_step`, "Add step")}
                  </button>
                </div>
                {trace && (
                  <section className={styles.terminalCard} aria-live="polite" aria-label={t(`${NS}.text_trace`, "Simulation trace")}>
                    <Terminal size={16} aria-hidden="true" />
                    {trace.path.map((line) => (
                      <p key={line.key} className={styles.terminalLine}>
                        <span className={styles.logTimestamp}>{line.order}</span> {stepTypeLabel(line.type, t)}: {line.title}
                      </p>
                    ))}
                    {trace.issues.map((issue, index) => <p key={`${issue.code}-${index}`} className={styles.logInfo}>{issueLabel(issue.code, t)}</p>)}
                    <p className={trace.runnable ? styles.logSuccess : styles.logInfo}>
                      {trace.runnable ? t(`${NS}.text_runnable`, "The workflow can be activated.") : t(`${NS}.text_not_runnable`, "Fix the issues above before activating.")}
                    </p>
                  </section>
                )}
              </div>
              {step && (
                <WorkflowStepInspector step={step} index={selected} catalogue={catalogue} canEdit={busy === null}
                  onChange={(next) => setDraft(draft.map((item, index) => (index === selected ? next : item)))}
                  onDelete={() => { setDraft(draft.filter((_, index) => index !== selected)); setSelected(Math.max(0, selected - 1)); }} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
