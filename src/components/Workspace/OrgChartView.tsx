"use client";

import { useMemo, useState } from "react";
import { Building2, Eye, Maximize2, Minimize2, Search, Users } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import EmployeeDossierModal from "./EmployeeDossierModal";
import TreeNode from "./org-chart/TreeNode";
import { ALL_DEPTS, deptSummary, filterTree, flatten, fullName, matches, toDossier, type OrgChartNode } from "./org-chart/data";
import { label } from "./org-chart/labels";
import { useOrgChart } from "./org-chart/useOrgChart";
import styles from "./OrgChartView.module.css";

type View = "tree" | "dept";

/** Org chart from stored manager links (GET /api/v1/org-chart); no inferred hierarchy or placeholder people. */
export default function OrgChartView() {
  const { t } = useTranslation();
  const { state, reload } = useOrgChart();
  const [view, setView] = useState<View>("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDept, setActiveDept] = useState<string>(ALL_DEPTS);
  const [forceExpanded, setForceExpanded] = useState<boolean | null>(null);
  const [dossier, setDossier] = useState<OrgChartNode | null>(null);

  const roots = useMemo(() => (state.status === "ready" ? state.data.roots : []), [state]);
  const employees = useMemo(() => flatten(roots), [roots]);
  const depts = useMemo(() => deptSummary(employees), [employees]);
  const tree = useMemo(() => filterTree(roots, searchQuery, activeDept), [roots, searchQuery, activeDept]);
  const deptName = (name: string) => name || label(t, "noDepartment");
  const highlight = (node: OrgChartNode) => Boolean(searchQuery.trim()) && matches(node, searchQuery);

  if (state.status !== "ready") {
    return (
      <div className={styles.container}>
        <div className={styles.stateBox} role={state.status === "error" ? "alert" : "status"}>
          {state.status === "loading" ? label(t, "loading") : (
            <>
              <span>{label(t, "loadError")}{state.message ? ` ${state.message}` : ""}</span>
              <button type="button" className={styles.actionBtn} onClick={reload}>{label(t, "retry")}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>
            <Users size={24} className={styles.signalIcon} aria-hidden="true" />
            {label(t, "title")}
          </h2>
          <p>{label(t, "subtitle", { employees: employees.length, departments: depts.length })}</p>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={label(t, "search")}
              aria-label={label(t, "search")}
              className={styles.searchInput}
            />
          </div>
          <select className={styles.selectFilter} value={activeDept} onChange={(e) => setActiveDept(e.target.value)} aria-label={label(t, "deptView")}>
            <option value={ALL_DEPTS}>{label(t, "allDepartments", { count: employees.length })}</option>
            {depts.map((d) => (
              <option key={d.name} value={d.name}>{deptName(d.name)} ({d.count})</option>
            ))}
          </select>
          <button type="button" className={`${styles.actionBtn} ${styles.toolbarBtn}`} onClick={() => setForceExpanded((prev) => prev !== true)}>
            {forceExpanded === true ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
            {label(t, forceExpanded === true ? "collapseAll" : "expandAll")}
          </button>
          <div className={styles.viewToggle} role="group">
            {(["tree", "dept"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                className={`${styles.toggleBtn} ${view === id ? styles.toggleBtnActive : ""}`}
                onClick={() => setView(id)}
              >
                {label(t, id === "tree" ? "treeView" : "deptView")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.deptRibbon}>
        <button type="button" className={`${styles.deptCard} ${activeDept === ALL_DEPTS ? styles.deptCardActive : ""}`} onClick={() => setActiveDept(ALL_DEPTS)}>
          <div className={styles.deptCount}>{employees.length}</div>
          <div className={styles.deptLabel}>{label(t, "totalRoster")}</div>
        </button>
        {depts.slice(0, 6).map((dept) => (
          <button
            key={dept.name}
            type="button"
            className={`${styles.deptCard} ${activeDept === dept.name ? styles.deptCardActive : ""}`}
            onClick={() => setActiveDept(dept.name)}
          >
            <div className={styles.deptCount}>{dept.count}</div>
            <div className={styles.deptLabel}>{deptName(dept.name)}</div>
          </button>
        ))}
      </div>

      {view === "tree" && (
        <div className={styles.treeCanvas}>
          <div className={styles.treeCanvasInner}>
            {tree.length === 0 ? (
              <div className={styles.stateBox}>{label(t, employees.length ? "noMatches" : "emptyRoster")}</div>
            ) : (
              tree.map((root) => (
                <TreeNode key={root.id} node={root} highlight={highlight} onOpenDossier={setDossier} forceExpanded={forceExpanded} />
              ))
            )}
          </div>
        </div>
      )}

      {view === "dept" && (
        <div className={styles.deptViewGrid}>
          {depts.length === 0 && <div className={styles.stateBox}>{label(t, "emptyRoster")}</div>}
          {depts
            .filter((d) => activeDept === ALL_DEPTS || d.name === activeDept)
            .map((dept) => ({ ...dept, shown: dept.employees.filter((e) => matches(e, searchQuery)) }))
            .filter((dept) => dept.shown.length > 0)
            .map((dept) => (
              <div key={dept.name} className={styles.deptSection}>
                <div className={styles.deptHeader}>
                  <div className={styles.deptHeaderTitle}>
                    <Building2 size={16} className={styles.signalIcon} aria-hidden="true" />
                    <span>{deptName(dept.name)}</span>
                  </div>
                  <span className={styles.deptCountPill}>{label(t, "members", { count: dept.count })}</span>
                </div>
                <div className={styles.deptCardsGrid}>
                  {dept.shown.map((emp) => (
                    <div key={emp.id} className={styles.deptEmpCard}>
                      <div className={`${styles.nodeAvatar} ${styles.deptAvatar}`} aria-hidden="true">{fullName(emp).charAt(0)}</div>
                      <div className={styles.deptEmpMeta}>
                        <div className={styles.deptEmpName}>{fullName(emp)}</div>
                        <div className={styles.deptEmpRole}>{emp.designation ?? label(t, "noDesignation")}</div>
                      </div>
                      <button type="button" className={styles.actionBtn} onClick={() => setDossier(emp)} title={label(t, "viewDossier")} aria-label={label(t, "viewDossier")}>
                        <Eye size={12} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {dossier && <EmployeeDossierModal employee={toDossier(dossier)} onClose={() => setDossier(null)} onEdit={undefined} />}
    </div>
  );
}
