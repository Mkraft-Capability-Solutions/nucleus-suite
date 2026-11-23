"use client";

import { RefreshCw } from "lucide-react";
import { useT } from "@/hooks/useT";
import { selectList, useApiResource } from "@/hooks/useApiResource";
import styles from "./TodaysFocus.module.css";

/** The caller's open self-service tasks from GET /api/v1/home/actions (onboarding, clearance, policy, documents, leave). */
const NS = "components.Dashboard.TodaysFocus";
type Row = { id: string; action: string; context: string; source: string; due_on: string | null; status: string; href: string };

export default function TodaysFocus() {
  const { t, locale } = useT();
  const { state, reload } = useApiResource<Row[]>("/api/v1/home/actions", selectList);
  const open = state.status === "ready" ? state.data.filter((row) => row.status !== "completed") : [];

  return (
    <div className={`${styles.container} glass-card`}>
      <div className={styles.header}>
        <div className={styles.titleGroup}><h2>{t(`${NS}.TodaysFocus_text_2`, "Today's focus")}</h2><span className={styles.subtitle}>{t(`${NS}.text_subtitle`, "Your open tasks")}</span></div>
        <div className={styles.actions}><button type="button" className={styles.iconBtn} aria-label={t(`${NS}.text_refresh`, "Refresh")} onClick={reload}><RefreshCw size={18} aria-hidden="true" /></button></div>
      </div>
      <div className={styles.taskList} aria-live="polite">
        {state.status === "loading" && <p className={styles.metaInfo}>{t(`${NS}.text_loading`, "Loading your tasks…")}</p>}
        {state.status === "error" && <p className={styles.metaInfo} role="alert">{state.message || t(`${NS}.text_failed`, "Your tasks could not be loaded.")}</p>}
        {state.status === "ready" && open.length === 0 && <p className={styles.metaInfo}>{t(`${NS}.text_empty`, "You have no open tasks.")}</p>}
        {open.map((row) => (
          <div key={row.id} className={`${styles.taskItem} ${row.status === "needs_attention" ? styles.highPriority : ""}`}>
            <div className={styles.taskHeader}>
              <div className={styles.checkboxWrapper}><span className={styles.priorityLabel}>{row.source}</span><h3>{row.action}</h3></div>
              {row.due_on && <span className={styles.dueDate}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(row.due_on))}</span>}
            </div>
            {row.context && <div className={styles.metaInfo}><span>{row.context}</span></div>}
            <div className={styles.taskActions}><a className={styles.primaryBtn} href={row.href}>{t(`${NS}.TodaysFocus_text_10`, "Start")}</a></div>
          </div>
        ))}
      </div>
    </div>
  );
}
