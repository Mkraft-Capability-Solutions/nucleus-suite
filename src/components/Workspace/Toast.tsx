"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { useT } from "@/hooks/useT";
import styles from "./Toast.module.css";

/** Workspace toast. Colours come from tokens; errors stay until dismissed long enough to be read. */
export type ToastType = "success" | "warning" | "error" | "info";
type ToastProps = { id: string | number; type?: ToastType; title?: string; message?: string; onClose: (id: string | number) => void };

const NS = "components.Workspace.Toast";
const ICONS: Record<ToastType, typeof Info> = { success: CheckCircle, warning: AlertCircle, error: AlertCircle, info: Info };

export default function Toast({ id, type = "info", title, message, onClose }: ToastProps) {
  const { t } = useT();
  const kind: ToastType = type in ICONS ? type : "info";
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), kind === "error" ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [id, onClose, kind]);
  const Icon = ICONS[kind];

  return (
    <div role={kind === "error" ? "alert" : "status"} className={`${styles.toast} ${styles[kind]}`}>
      <span className={styles.icon} aria-hidden="true"><Icon size={20} /></span>
      <div className={styles.content}>
        {title && <span className={styles.title}>{title}</span>}
        {message && <span className={styles.message}>{message}</span>}
      </div>
      <button type="button" className={styles.dismiss} aria-label={t(`${NS}.dismissLabel`, "Dismiss notification")} onClick={() => onClose(id)}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
