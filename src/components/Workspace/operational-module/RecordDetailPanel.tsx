"use client";

import { Edit2, Eye, LoaderCircle } from "lucide-react";
import { currentState, NS, recordValue, type LookupKind, type LookupState, type ModuleRecord, type OperationalModule, type Translate } from "./data";
import { useAuditTrail } from "./hooks";
import styles from "../OperationalModuleView.module.css";

type Props = {
  module: OperationalModule;
  record: ModuleRecord | null;
  lookups: Partial<Record<LookupKind, LookupState>>;
  canWrite: boolean;
  transitioning: string | null;
  auditToken: number;
  formatDate: (iso: string | null) => string;
  t: Translate;
  onEdit: () => void;
  onView: () => void;
  onTransition: (state: string) => void;
};

/** Selected record: key facts, allowed actions, state timeline (server transitions) and its audit trail. */
export default function RecordDetailPanel({ module, record, lookups, canWrite, transitioning, auditToken, formatDate, t, onEdit, onView, onTransition }: Props) {
  const audit = useAuditTrail(record?.id ?? null, auditToken, t);
  const state = currentState(record, module);

  return (
    <aside className={styles.detailCard} aria-label={t(`${NS}.aria-label_selected_record`, "Selected record detail")}>
      <div className={styles.cardTitle}>
        <div>
          <h2>{t(`${NS}.text_record_detail`, "Record detail")}</h2>
          <p className={styles.mono}>{record ? String(record.attributes.reference ?? record.id) : t(`${NS}.text_no_selection`, "Select a record to see its details.")}</p>
        </div>
        {state && <span className={styles.status}>{state}</span>}
      </div>

      {record && (
        <dl className={styles.quickFacts}>
          {module.columns.slice(0, 4).map((column) => {
            const value = recordValue(record, column, module, lookups);
            return (
              <div key={column}>
                <dt>{column}</dt>
                <dd title={value}>{value}</dd>
              </div>
            );
          })}
        </dl>
      )}

      <div className={styles.detailActions}>
        <button type="button" className={styles.primaryButton} onClick={onEdit} disabled={!record || !canWrite}>
          <Edit2 size={14} aria-hidden /> {t(`${NS}.text_edit_record`, "Edit record")}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onView} disabled={!record}>
          <Eye size={14} aria-hidden /> {t(`${NS}.text_full_details`, "Full details")}
        </button>
      </div>

      <div className={styles.timeline}>
        <h3>{t(`${NS}.text_state_timeline`, "State timeline")}</h3>
        {module.states.map((item, index) => {
          const active = state?.toLowerCase() === item.toLowerCase();
          return (
            <button
              key={item}
              type="button"
              className={active ? styles.currentState : ""}
              aria-current={active ? "step" : undefined}
              disabled={!record || !canWrite || active || transitioning !== null}
              onClick={() => onTransition(item)}
              title={active ? t(`${NS}.title_current_state`, "Current state") : t(`${NS}.title_move_to_state`, "Move the record to {state}", { state: item })}
            >
              <span className={styles.stepNum}>{transitioning === item ? <LoaderCircle size={12} className={styles.spin} aria-hidden /> : index + 1}</span>
              <span className={styles.stateLabel}>{item}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.audit} aria-live="polite">
        <h3>{t(`${NS}.text_audit_trail`, "Audit trail")}</h3>
        {audit.status === "idle" && <p>{t(`${NS}.text_audit_idle`, "Select a record to see who changed it and when.")}</p>}
        {audit.status === "loading" && <p>{t(`${NS}.text_audit_loading`, "Loading the audit trail…")}</p>}
        {audit.status === "error" && <p className={styles.inlineError}>{audit.message}</p>}
        {audit.status === "ready" && audit.events.length === 0 && <p>{t(`${NS}.text_audit_empty`, "No audit events have been recorded for this record yet.")}</p>}
        {audit.status === "ready" && audit.events.length > 0 && (
          <ol className={styles.auditList}>
            {audit.events.map((event) => (
              <li key={event.id}>
                <strong>{event.reason || event.action}</strong>
                <span><time dateTime={event.created_at}>{formatDate(event.created_at)}</time> · <code>{event.action}</code></span>
              </li>
            ))}
          </ol>
        )}
        {record && (
          <p>
            <strong>{t(`${NS}.text_created_at`, "Created")}</strong> {formatDate(record.createdAt)}
            {record.updatedAt && <> · <strong>{t(`${NS}.text_updated_at`, "Updated")}</strong> {formatDate(record.updatedAt)}</>}
          </p>
        )}
      </div>
    </aside>
  );
}
