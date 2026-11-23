"use client";

import type { ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import { X } from "lucide-react";
import styles from "../AttendanceView.module.css";

/** Accessible dialog shell (focus trap, Escape, labelled title) shared by the attendance forms and panels. */
export default function AttendanceDialog({ open, onClose, titleId, title, icon, closeLabel, wide = false, busy = false, children }: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  icon?: ReactNode;
  closeLabel: string;
  wide?: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={() => { if (!busy) onClose(); }} aria-labelledby={titleId} maxWidth={wide ? "md" : "sm"} fullWidth
      slotProps={{ paper: { className: `${styles.modalCard} ${wide ? styles.modalWide : ""}` } }}>
      <div className={styles.modalHead}>
        <h3 id={titleId}>{icon}{title}</h3>
        <button type="button" className={styles.modalClose} onClick={onClose} disabled={busy} aria-label={closeLabel}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </Dialog>
  );
}
