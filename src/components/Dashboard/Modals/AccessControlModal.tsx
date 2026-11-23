"use client";

import { useEffect, useId } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useT } from "@/components/Workspace/admin/AdminParts";
import RoleAccessPanel from "@/components/Workspace/admin/RoleAccessPanel";
import styles from "@/components/Workspace/admin/Admin.module.css";

/**
 * Quick access-control dialog opened from the settings menu: the same role panel as the
 * Access Control Studio (select or create a role, grant pages / cards / actions, preview).
 * Every change is saved through /api/v1/roles/** before the dialog reflects it.
 */

const NS = "components.Dashboard.Modals.AccessControlModal";

export default function AccessControlModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useT();
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className={styles.cardHeader}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionIcon} aria-hidden="true"><ShieldCheck size={20} /></span>
            <div>
              <h2 id={titleId} className={styles.cardTitle}>{t(`${NS}.text_title`, "Access Control & Permissions")}</h2>
              <p className={styles.cardSubtitle}>{t(`${NS}.text_subtitle`, "Choose or create a role, grant pages, dashboard cards and actions, and preview what it sees.")}</p>
            </div>
          </div>
          <button type="button" className={styles.btnGhost} onClick={onClose} aria-label={t(`${NS}.text_close`, "Close access control")}><X size={18} /></button>
        </div>
        <RoleAccessPanel />
        <div className={styles.footer}>
          <span className={styles.help}>{t(`${NS}.text_footer`, "Saved changes apply to members on their next request.")}</span>
          <button type="button" className={styles.btnPrimary} onClick={onClose}>{t(`${NS}.text_done`, "Done")}</button>
        </div>
      </div>
    </div>
  );
}
