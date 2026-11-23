"use client";

import Dialog from "@mui/material/Dialog";
import { Edit2, X } from "lucide-react";
import { NS, recordValue, type LookupKind, type LookupState, type ModuleRecord, type OperationalModule, type ResolvedField, type Translate } from "./data";
import styles from "../OperationalModuleView.module.css";

type Props = {
  module: OperationalModule;
  record: ModuleRecord;
  fields: ResolvedField[];
  lookups: Partial<Record<LookupKind, LookupState>>;
  canWrite: boolean;
  formatDate: (iso: string | null) => string;
  t: Translate;
  onClose: () => void;
  onEdit: () => void;
};

/** Read-only view of every field of one record, as stored by the server. */
export default function RecordViewDialog({ module, record, fields, lookups, canWrite, formatDate, t, onClose, onEdit }: Props) {
  return (
    <Dialog open onClose={onClose} aria-labelledby="operational-view-title" maxWidth="sm" fullWidth>
      <div className={styles.formDialog}>
        <header>
          <div>
            <span>{t(`${NS}.text_record_details`, "Record details")}</span>
            <h2 id="operational-view-title">{module.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t(`${NS}.aria-label_close`, "Close")}><X size={18} aria-hidden /></button>
        </header>
        <dl className={styles.viewGrid}>
          {fields.map((field) => {
            const value = recordValue(record, field.label, module, lookups);
            return (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{field.key.toLowerCase().includes("status") ? <span className={styles.status}>{value}</span> : value}</dd>
              </div>
            );
          })}
        </dl>
        <div className={styles.viewMeta}>
          <span>{t(`${NS}.text_record_id`, "Record ID")} <code>{record.id}</code></span>
          <span>{t(`${NS}.text_created_at`, "Created")} {formatDate(record.createdAt)}</span>
        </div>
        <footer>
          <span />
          <div>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>{t(`${NS}.text_close`, "Close")}</button>
            <button type="button" className={styles.primaryButton} onClick={onEdit} disabled={!canWrite}>
              <Edit2 size={14} aria-hidden /> {t(`${NS}.text_edit_this_record`, "Edit this record")}
            </button>
          </div>
        </footer>
      </div>
    </Dialog>
  );
}
