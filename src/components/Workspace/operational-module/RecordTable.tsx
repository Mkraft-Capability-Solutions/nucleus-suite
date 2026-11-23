"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Edit2, Eye, FileText, RefreshCw, Search } from "lucide-react";
import TablePagination from "../../Common/TablePagination";
import { NS, recordValue, type LookupKind, type LookupState, type ModuleRecord, type OperationalModule, type Translate } from "./data";
import type { RecordsState } from "./hooks";
import styles from "../OperationalModuleView.module.css";

type Props = {
  module: OperationalModule;
  state: RecordsState;
  lookups: Partial<Record<LookupKind, LookupState>>;
  selectedId: string | null;
  canWrite: boolean;
  search: string;
  page: number;
  pageSize: number;
  t: Translate;
  onSearch: (value: string) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onSelect: (record: ModuleRecord) => void;
  onView: (record: ModuleRecord) => void;
  onEdit: (record: ModuleRecord) => void;
  onRetry: () => void;
};

/** Server-paginated, server-searched register; column sorting applies to the loaded page. */
export default function RecordTable({ module, state, lookups, selectedId, canWrite, search, page, pageSize, t, onSearch, onPage, onPageSize, onSelect, onView, onEdit, onRetry }: Props) {
  const [sort, setSort] = useState<{ column: string; asc: boolean } | null>(null);
  const items = useMemo(() => (state.status === "ready" ? state.items : []), [state]);
  const rows = useMemo(() => {
    if (!sort) return items;
    return [...items].sort((a, b) => {
      const left = recordValue(a, sort.column, module, lookups);
      const right = recordValue(b, sort.column, module, lookups);
      return (sort.asc ? 1 : -1) * left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [items, sort, module, lookups]);
  const total = state.status === "ready" ? state.total : 0;
  const colSpan = module.columns.length + 1;

  const toggleSort = (column: string) => setSort((current) => (current?.column === column ? { column, asc: !current.asc } : { column, asc: true }));

  return (
    <section className={styles.listCard} aria-label={module.title}>
      <div className={styles.cardTitle}>
        <div>
          <h2>{module.title}</h2>
          <p aria-live="polite">
            {state.status === "ready" ? t(`${NS}.text_records_total`, "{count} records", { count: total }) : state.status === "loading" ? t(`${NS}.text_loading_records`, "Loading records…") : t(`${NS}.text_records_unavailable`, "Records unavailable")}
          </p>
        </div>
        <div className={styles.searchRow}>
          <label className={styles.searchBox}>
            <Search size={14} aria-hidden />
            <span className={styles.srOnly}>{t(`${NS}.aria-label_search`, "Search records")}</span>
            <input type="search" value={search} placeholder={t(`${NS}.placeholder_search`, "Search…")} onChange={(event) => onSearch(event.target.value)} />
          </label>
          <FileText size={19} aria-hidden />
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              {module.columns.map((column) => {
                const active = sort?.column === column;
                return (
                  <th key={column} aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}>
                    <button type="button" className={styles.sortButton} onClick={() => toggleSort(column)} title={t(`${NS}.title_sort_by`, "Sort by {column}", { column })}>
                      {column}
                      {active ? (sort.asc ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />) : <ArrowUpDown size={12} aria-hidden />}
                    </button>
                  </th>
                );
              })}
              <th className={styles.actionsCol}>{t(`${NS}.text_actions`, "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {state.status === "loading" && <tr><td colSpan={colSpan} className={styles.stateRow}>{t(`${NS}.text_loading_records`, "Loading records…")}</td></tr>}
            {state.status === "error" && (
              <tr><td colSpan={colSpan} className={styles.stateRow}>
                <span role="alert">{state.message}</span>{" "}
                <button type="button" className={styles.secondaryButton} onClick={onRetry}><RefreshCw size={14} aria-hidden /> {t(`${NS}.text_retry`, "Retry")}</button>
              </td></tr>
            )}
            {state.status === "ready" && rows.length === 0 && (
              <tr><td colSpan={colSpan} className={styles.stateRow}>
                {search.trim() ? t(`${NS}.text_no_matches`, "No records match your search.") : t(`${NS}.text_empty`, "No records have been created in this register yet.")}
              </td></tr>
            )}
            {rows.map((record) => (
              <tr key={record.id} className={selectedId === record.id ? styles.selectedRow : ""} onClick={() => onSelect(record)} aria-selected={selectedId === record.id}>
                {module.columns.map((column) => {
                  const value = recordValue(record, column, module, lookups);
                  return <td key={column}>{column === "Status" || column === "Publish status" ? <span className={styles.status}>{value}</span> : value}</td>;
                })}
                <td className={styles.actionsCol}>
                  <span className={styles.rowActions}>
                    <button type="button" className={styles.rowActionBtn} title={t(`${NS}.title_view_details`, "View details")} aria-label={t(`${NS}.title_view_details`, "View details")} onClick={(event) => { event.stopPropagation(); onView(record); }}>
                      <Eye size={14} aria-hidden />
                    </button>
                    <button type="button" className={styles.rowActionBtn} disabled={!canWrite} title={t(`${NS}.title_edit_update`, "Edit / update")} aria-label={t(`${NS}.aria-label_edit_record`, "Edit record")} onClick={(event) => { event.stopPropagation(); onEdit(record); }}>
                      <Edit2 size={14} aria-hidden />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination currentPage={page} totalItems={total} pageSize={pageSize} onPageChange={onPage} onPageSizeChange={onPageSize} />
      </div>
    </section>
  );
}
