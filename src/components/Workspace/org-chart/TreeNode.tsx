"use client";

import { useState } from "react";
import { Building2, Eye, MapPin, Minus, Plus } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { fullName, initials, type OrgChartNode } from "./data";
import { label } from "./labels";
import styles from "../OrgChartView.module.css";

type Props = {
  node: OrgChartNode;
  highlight: (node: OrgChartNode) => boolean;
  onOpenDossier: (node: OrgChartNode) => void;
  forceExpanded: boolean | null;
};

export default function TreeNode({ node, highlight, onOpenDossier, forceExpanded }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [seenForce, setSeenForce] = useState(forceExpanded);
  if (seenForce !== forceExpanded) {
    // Expand/collapse-all overrides the local toggle when it changes (adjust-state-on-prop-change pattern).
    setSeenForce(forceExpanded);
    if (forceExpanded !== null) setExpanded(forceExpanded);
  }

  const reports = node.children ?? [];
  const name = fullName(node);
  const designation = node.designation ?? label(t, "noDesignation");

  return (
    <div className={styles.nodeWrapper}>
      <div className={`${styles.nodeCard} ${highlight(node) ? styles.nodeCardMatched : ""}`}>
        <div className={styles.nodeTop}>
          <div className={styles.nodeAvatar} aria-hidden="true">{initials(node)}</div>
          <div className={styles.nodeMeta}>
            <div className={styles.nodeName} title={name}>{name}</div>
            <div className={styles.nodeRole} title={designation}>{designation}</div>
            <div className={styles.nodeCode}>{node.employeeCode}</div>
          </div>
        </div>
        <div className={styles.nodeInfoRow}>
          <span className={styles.nodeDeptBadge}>
            <Building2 size={11} aria-hidden="true" /> {node.department ?? label(t, "noDepartment")}
          </span>
          <span className={styles.nodeLocation}>
            <MapPin size={11} aria-hidden="true" /> {node.location ?? label(t, "noLocation")}
          </span>
        </div>
        <div className={styles.nodeBottom}>
          <div className={styles.reportsCount}>
            {reports.length > 0 ? (
              <span>{reports.length === 1 ? label(t, "directReportOne") : label(t, "directReports", { count: reports.length })}</span>
            ) : (
              <span className={styles.muted}>{label(t, "individualContributor")}</span>
            )}
          </div>
          <div className={styles.nodeActions}>
            <button type="button" className={styles.actionBtn} onClick={() => onOpenDossier(node)} title={label(t, "viewDossier")}>
              <Eye size={12} aria-hidden="true" /> {label(t, "dossier")}
            </button>
            {reports.length > 0 && (
              <button
                type="button"
                className={styles.expandBtn}
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                title={label(t, expanded ? "collapseTeam" : "expandTeam")}
                aria-label={label(t, expanded ? "collapseTeam" : "expandTeam")}
              >
                {expanded ? <Minus size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      </div>
      {reports.length > 0 && expanded && (
        <>
          <div className={styles.connectorDown} />
          <div className={styles.childrenContainer}>
            {reports.map((child) => (
              <div key={child.id} className={styles.childSlot}>
                <div className={styles.connectorUp} />
                <TreeNode node={child} highlight={highlight} onOpenDossier={onOpenDossier} forceExpanded={forceExpanded} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
