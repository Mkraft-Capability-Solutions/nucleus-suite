"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChevronDown from "@mui/icons-material/ExpandMore";
import Business from "@mui/icons-material/ApartmentOutlined";
import Check from "@mui/icons-material/Check";
import { useTranslation } from "@/context/I18nContext";
import styles from "./EntitySwitcher.module.css";

/** Mirrors src/server/organization/active-entity.ts (HierarchyNode, ActiveEntity). */
export type HierarchyNode = {
  id: string; parentId: string | null; rootGroupId: string; legalName: string; code: string | null;
  industryVertical: string | null; defaultCurrency: string; status: string; selectable: boolean; children: HierarchyNode[];
};
export type CompanyScope = { companyIds: string[] | "ALL" };
type Selection = { companyId: string } | "ALL_GROUP_ENTITIES" | null;
type ActiveEntity = { selection: Selection; scope: CompanyScope; canSelectAll: boolean };

export const ACTIVE_ENTITY_EVENT = "nucleus:active-entity-changed";
const ALL = "ALL_GROUP_ENTITIES";

type Row = { node: HierarchyNode; depth: number };

function flatten(nodes: HierarchyNode[], depth = 0, out: Row[] = []): Row[] {
  for (const node of nodes) {
    out.push({ node, depth });
    flatten(node.children, depth + 1, out);
  }
  return out;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
  return body.data as T;
}

/** Header pill that scopes the workspace to one company of the group, or all of them for group administrators. */
export default function EntitySwitcher() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<HierarchyNode[] | null>(null);
  const [active, setActive] = useState<ActiveEntity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [hierarchy, current] = await Promise.all([
        fetch("/api/v1/organizations/hierarchy", { credentials: "same-origin" }),
        fetch("/api/v1/session/active-entity", { credentials: "same-origin" }),
      ]);
      // Feature off or no access: the switcher is simply not offered.
      if (hierarchy.status === 401 || hierarchy.status === 403) { setHidden(true); return; }
      const data = await readJson<{ tree: HierarchyNode[]; canSelectAll: boolean }>(hierarchy);
      setTree(data.tree);
      setActive(await readJson<ActiveEntity>(current));
    } catch {
      setError(t("components.Workspace.EntitySwitcher.load_error", "Companies could not be loaded."));
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const rows = useMemo(() => flatten(tree ?? []), [tree]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ node }) => node.legalName.toLowerCase().includes(q) || (node.code ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  const selectedId = active?.selection && active.selection !== ALL ? active.selection.companyId : null;
  const allLabel = t("components.Workspace.EntitySwitcher.all", "All group companies");
  const selectableCount = rows.filter((row) => row.node.selectable).length;
  const currentLabel = selectedId
    ? rows.find((row) => row.node.id === selectedId)?.node.legalName ?? allLabel
    : active?.canSelectAll || selectableCount !== 1 ? allLabel : rows.find((row) => row.node.selectable)?.node.legalName ?? allLabel;

  async function choose(companyId: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/session/active-entity", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }),
      });
      const next = await readJson<ActiveEntity>(response);
      setActive(next);
      setOpen(false);
      setQuery("");
      window.dispatchEvent(new CustomEvent(ACTIVE_ENTITY_EVENT, { detail: { selection: next.selection, scope: next.scope } }));
    } catch {
      setError(t("components.Workspace.EntitySwitcher.save_error", "The company could not be selected."));
    } finally {
      setSaving(false);
    }
  }

  if (hidden || (tree && tree.length === 0)) return null;

  return (
    <div ref={ref} className={styles.wrap}>
      <button type="button" className={styles.pill} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        aria-label={t("components.Workspace.EntitySwitcher.aria", "Active company: {name}", { name: currentLabel })}>
        <Business sx={{ fontSize: 16 }} aria-hidden="true" />
        <span className={styles.label}>{tree ? currentLabel : t("components.Workspace.EntitySwitcher.loading", "Loading companies…")}</span>
        <ChevronDown sx={{ fontSize: 14 }} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.menu}>
          <input className={styles.search} type="search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={t("components.Workspace.EntitySwitcher.search", "Search companies")}
            aria-label={t("components.Workspace.EntitySwitcher.search", "Search companies")} />
          {error && <div className={`${styles.state} ${styles.error}`} role="alert">{error} <button type="button" className={styles.item} onClick={() => void load()}>{t("components.Workspace.EntitySwitcher.retry", "Try again")}</button></div>}
          {!tree && !error && <div className={styles.state}>{t("components.Workspace.EntitySwitcher.loading", "Loading companies…")}</div>}
          {tree && (
            <ul className={styles.list} role="listbox" aria-busy={saving}>
              {active?.canSelectAll && !query && (
                <li role="option" aria-selected={active.selection === ALL || !active.selection}>
                  <button type="button" disabled={saving} className={`${styles.item} ${active.selection === ALL || !active.selection ? styles.itemActive : ""}`} style={{ paddingInlineStart: "0.5rem" }} onClick={() => void choose(ALL)}>
                    {allLabel}
                    {(active.selection === ALL || !active.selection) && <Check sx={{ fontSize: 14 }} aria-hidden="true" />}
                  </button>
                </li>
              )}
              {filtered.length === 0 && <li className={styles.state}>{t("components.Workspace.EntitySwitcher.empty", "No company matches your search.")}</li>}
              {filtered.map(({ node, depth }) => (
                <li key={node.id} role="option" aria-selected={node.id === selectedId} aria-disabled={!node.selectable}>
                  <button type="button" disabled={!node.selectable || saving} className={`${styles.item} ${node.id === selectedId ? styles.itemActive : ""}`}
                    style={{ paddingInlineStart: `${0.5 + (query ? 0 : depth) * 1}rem` }} onClick={() => void choose(node.id)}>
                    {node.legalName}
                    {node.id === selectedId && <Check sx={{ fontSize: 14 }} aria-hidden="true" />}
                    <span className={styles.meta}>{node.code ?? node.defaultCurrency}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && !open && <span className={styles.kicker} role="status">{error}</span>}
    </div>
  );
}
