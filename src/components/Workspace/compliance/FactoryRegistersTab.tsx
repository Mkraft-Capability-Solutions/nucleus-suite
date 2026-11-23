"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText, HardHat } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, useResource, useT } from "./api";
import AccidentPanel from "./AccidentPanel";
import InspectionPanel from "./InspectionPanel";
import MusterRollPanel from "./MusterRollPanel";
import type { FactoryRegisters } from "./types";

/** Factories Act registers: Form 28 (derived muster roll), Form 18 and Form 36 (GET/POST /api/v1/compliance). */

type Sub = "form28" | "form18" | "form36";
type Notify = (title: string, message: string, tone: "success" | "error") => void;

export default function FactoryRegistersTab({ notify }: { notify: Notify }) {
  const { t } = useT();
  const [sub, setSub] = useState<Sub>("form28");
  const registers = useResource<FactoryRegisters>("/api/v1/compliance", t(`${NS}.fr_failed`, "The factory registers could not be loaded."));
  const { reload } = registers;

  // The inspector entry is recorded through the workspace action dialog; refresh once the server accepted it.
  useEffect(() => {
    const onCompleted = (event: Event) => {
      if ((event as CustomEvent<{ action?: string }>).detail?.action === "inspector") void reload();
    };
    window.addEventListener("nucleus:action-completed", onCompleted);
    return () => window.removeEventListener("nucleus:action-completed", onCompleted);
  }, [reload]);

  const changed = (message: string) => {
    notify(t(`${NS}.fr_title`, "Factory registers"), message, "success");
    void reload();
  };
  const data = registers.state.status === "ready" ? registers.state.data : null;
  const count = (n: number | undefined) => (n === undefined ? "" : ` (${n})`);

  return (
    <div className={styles.simulatorSection}>
      <div className={styles.simNotice}>
        <HardHat size={18} aria-hidden="true" />
        <div>
          <strong>{t(`${NS}.fr_notice_title`, "Factories Act 1948 statutory registers:")}</strong>{" "}
          {t(`${NS}.fr_notice_body`, "Muster roll derived from attendance, accident notices under Section 88 and the inspection book under Section 112.")}
        </div>
      </div>

      <div className={styles.subTabsNav} role="tablist" aria-label={t(`${NS}.fr_title`, "Factory registers")}>
        <button type="button" role="tab" aria-selected={sub === "form28"} className={`${styles.subTabBtn} ${sub === "form28" ? styles.activeSubTab : ""}`} onClick={() => setSub("form28")}>
          <FileSpreadsheet size={15} aria-hidden="true" />{t(`${NS}.fr_tab_28`, "Form 28: Muster roll")}
        </button>
        <button type="button" role="tab" aria-selected={sub === "form18"} className={`${styles.subTabBtn} ${sub === "form18" ? styles.activeSubTab : ""}`} onClick={() => setSub("form18")}>
          <AlertTriangle size={15} aria-hidden="true" />{t(`${NS}.fr_tab_18`, "Form 18: Accident notices")}{count(data?.accidents.length)}
        </button>
        <button type="button" role="tab" aria-selected={sub === "form36"} className={`${styles.subTabBtn} ${sub === "form36" ? styles.activeSubTab : ""}`} onClick={() => setSub("form36")}>
          <FileText size={15} aria-hidden="true" />{t(`${NS}.fr_tab_36`, "Form 36: Inspection book")}{count(data?.inspections.length)}
        </button>
      </div>

      {sub === "form28" && <MusterRollPanel notify={notify} />}
      {sub !== "form28" && registers.state.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.fr_loading`, "Loading registers…")}</p>}
      {sub !== "form28" && registers.state.status === "error" && (
        <div className={styles.errorNote} role="alert"><span>{registers.state.message}</span><button type="button" className={styles.btnSecondary} onClick={() => void reload()}>{t(`${NS}.retry`, "Retry")}</button></div>
      )}
      {sub === "form18" && data && <AccidentPanel accidents={data.accidents} onChanged={changed} />}
      {sub === "form36" && data && <InspectionPanel inspections={data.inspections} onChanged={changed} />}
    </div>
  );
}
