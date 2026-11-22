"use client";

import { useMemo, useState } from "react";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type FilterFn, type SortingState, type VisibilityState, type RowSelectionState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, Download, Eye, MoreHorizontal, Pencil, Search, UserPlus, Users, X } from "lucide-react";
import { downloadCSV } from "@/utils/exportUtils";
import { ActionMenu, Avatar, Badge, Button, EmptyState, ErrorState, IconButton, Input, Select, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import { formatDate, STATUS_LABELS, type DirectoryRow } from "../data";
import styles from "./Directory.module.css";

export type PersonRow = DirectoryRow & { name: string; sample?: boolean };

type Props = {
  rows: PersonRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onOpen: (row: PersonRow) => void;
  onEdit: (row: PersonRow) => void;
  onAdd: () => void;
};

const globalSearch: FilterFn<PersonRow> = (row, _columnId, value) => {
  const query = String(value ?? "").trim().toLowerCase();
  if (!query) return true;
  const person = row.original;
  return [person.name, person.employee_code, person.designation, person.department, person.location, person.manager_name, person.work_email]
    .some((field) => String(field ?? "").toLowerCase().includes(query));
};

const COLUMN_LABELS: Record<string, string> = {
  employee: "Employee", designation: "Designation", department: "Department", location: "Location",
  manager: "Manager", joined: "Joined", status: "Status",
};

export default function Directory({ rows, loading, error, onRetry, canEdit, onOpen, onEdit, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("active");
  const [sorting, setSorting] = useState<SortingState>([{ id: "employee", desc: false }]);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  const departments = useMemo(() => [...new Set(rows.map((row) => row.department).filter((value) => value && value !== "—"))].sort(), [rows]);
  const locations = useMemo(() => [...new Set(rows.map((row) => row.location).filter((value) => value && value !== "—"))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((row) =>
    (!department || row.department === department) && (!location || row.location === location) && (!status || row.status === status),
  ), [rows, department, location, status]);

  const columns = useMemo<ColumnDef<PersonRow>[]>(() => [
    {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <input type="checkbox" aria-label="Select all employees on this page" checked={table.getIsAllPageRowsSelected()}
          ref={(node) => { if (node) node.indeterminate = table.getIsSomePageRowsSelected(); }}
          onChange={table.getToggleAllPageRowsSelectedHandler()} onClick={(event) => event.stopPropagation()} />
      ),
      cell: ({ row }) => (
        <input type="checkbox" aria-label={`Select ${row.original.name}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} onClick={(event) => event.stopPropagation()} />
      ),
    },
    {
      id: "employee", accessorFn: (row) => row.name, header: "Employee", enableHiding: false,
      cell: ({ row }) => (
        <div className={styles.person}>
          <Avatar name={row.original.name} />
          <div className={styles.personText}>
            <span className={styles.personName}>{row.original.name}</span>
            <span className={styles.personMeta}>{row.original.employee_code}{row.original.work_email ? ` · ${row.original.work_email}` : ""}{row.original.sample ? " · Sample data" : ""}</span>
          </div>
        </div>
      ),
    },
    { id: "designation", accessorKey: "designation", header: "Designation" },
    { id: "department", accessorKey: "department", header: "Department" },
    { id: "location", accessorKey: "location", header: "Location" },
    { id: "manager", accessorFn: (row) => row.manager_name ?? "", header: "Manager", cell: ({ getValue }) => getValue<string>() || <span className={ui.muted}>None</span> },
    { id: "joined", accessorFn: (row) => row.joining_date ?? "", header: "Joined", cell: ({ getValue }) => <span className={ui.nowrap}>{formatDate(getValue<string>()) || "—"}</span> },
    {
      id: "status", accessorKey: "status", header: "Status",
      cell: ({ row }) => { const meta = STATUS_LABELS[row.original.status]; return <Badge tone={meta.tone} dot>{meta.label}</Badge>; },
    },
    {
      id: "actions", enableSorting: false, enableHiding: false, header: () => <span className={styles.srOnly}>Actions</span>,
      cell: ({ row }) => (
        <ActionMenu label={`Actions for ${row.original.name}`} trigger={<MoreHorizontal aria-hidden="true" />} actions={[
          { label: "View profile", icon: Eye, onSelect: () => onOpen(row.original) },
          { label: "Edit", icon: Pencil, onSelect: () => onEdit(row.original), disabled: !canEdit || row.original.sample },
        ]} />
      ),
    },
  ], [canEdit, onEdit, onOpen]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoisable functions by design.
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnVisibility: visibility, rowSelection: selection, globalFilter: search, pagination },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setSearch,
    globalFilterFn: globalSearch,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const visibleRows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const selected = table.getSelectedRowModel().rows.map((row) => row.original);
  const { pageIndex, pageSize } = table.getState().pagination;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  const filtersActive = Boolean(search || department || location || status !== "active");

  function exportRows(list: PersonRow[]) {
    downloadCSV(
      `employees-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Employee code", "Name", "Designation", "Department", "Location", "Manager", "Joined", "Status", "Work email"],
      list.map((row) => [row.employee_code, row.name, row.designation, row.department, row.location, row.manager_name ?? "", row.joining_date ?? "", STATUS_LABELS[row.status].label, row.work_email ?? ""]),
    );
  }

  function clearFilters() {
    setSearch(""); setDepartment(""); setLocation(""); setStatus("active");
    table.setPageIndex(0);
  }

  return (
    <section className={cx(ui.panel, ui.fill)} aria-labelledby="directory-title">
      <div className={styles.toolbar}>
        <h2 id="directory-title" className={styles.srOnly}>Employee directory</h2>
        <div className={cx(ui.searchBox, styles.search)}>
          <Search aria-hidden="true" />
          <Input type="search" placeholder="Search name, code, designation, email…" aria-label="Search employees" value={search}
            onChange={(event) => { setSearch(event.target.value); table.setPageIndex(0); }} />
        </div>
        <div className={styles.filters}>
          <Select aria-label="Department" value={department} onChange={(event) => { setDepartment(event.target.value); table.setPageIndex(0); }}>
            <option value="">All departments</option>
            {departments.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select aria-label="Location" value={location} onChange={(event) => { setLocation(event.target.value); table.setPageIndex(0); }}>
            <option value="">All locations</option>
            {locations.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value); table.setPageIndex(0); }}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </Select>
          {filtersActive && <Button variant="ghost" icon={X} onClick={clearFilters}>Clear</Button>}
        </div>
        <div className={styles.toolbarEnd}>
          <ActionMenu label="Choose columns" trigger={<Columns3 aria-hidden="true" />} actions={table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => ({
            label: `${column.getIsVisible() ? "Hide" : "Show"} ${COLUMN_LABELS[column.id] ?? column.id}`,
            onSelect: () => column.toggleVisibility(),
          }))} />
        </div>
      </div>

      {selected.length > 0 && (
        <div className={styles.selectionBar} role="status">
          <span>{selected.length} selected</span>
          <Button size="sm" icon={Download} onClick={() => exportRows(selected)}>Export selected</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>Clear selection</Button>
        </div>
      )}

      {error ? <div style={{ padding: 16 }}><ErrorState message={error} onRetry={onRetry} /></div>
        : loading ? <SkeletonRows rows={8} columns={6} />
        : rows.length === 0 ? (
          <EmptyState icon={Users} title="No employees yet" action={canEdit ? <Button variant="primary" icon={UserPlus} onClick={onAdd}>Add employee</Button> : undefined}>
            Add employees one at a time or import a spreadsheet. They appear here as soon as they are saved.
          </EmptyState>
        ) : total === 0 ? (
          <EmptyState icon={Search} title="No employees match" action={<Button onClick={clearFilters}>Clear filters</Button>}>
            Nothing matches the search and filters. Status defaults to Active; choose All statuses to include people who have left.
          </EmptyState>
        ) : (
          <>
            <div className={cx(ui.tableWrap, styles.desktop)}>
              <table className={ui.table}>
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => {
                        const sorted = header.column.getIsSorted();
                        return (
                          <th key={header.id} className={header.id === "select" ? styles.selectCell : header.id === "actions" ? styles.actionsCell : undefined}
                            aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                            {header.column.getCanSort() ? (
                              <button type="button" className={ui.sortButton} onClick={header.column.getToggleSortingHandler()}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {sorted === "asc" ? <ArrowUp aria-hidden="true" /> : sorted === "desc" ? <ArrowDown aria-hidden="true" /> : <ChevronsUpDown aria-hidden="true" className={ui.muted} />}
                              </button>
                            ) : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id} className={ui.rowClickable} onClick={() => onOpen(row.original)} aria-selected={row.getIsSelected() || undefined}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={cell.column.id === "select" ? styles.selectCell : cell.column.id === "actions" ? styles.actionsCell : undefined}>
                          {cell.column.id === "employee"
                            ? <button type="button" className={styles.rowLink} onClick={(event) => { event.stopPropagation(); onOpen(row.original); }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</button>
                            : flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className={styles.mobileList} aria-label="Employees">
              {visibleRows.map((row) => {
                const person = row.original;
                const meta = STATUS_LABELS[person.status];
                return (
                  <li key={row.id} className={styles.mobileItem}>
                    <button type="button" className={styles.mobileMain} onClick={() => onOpen(person)}>
                      <Avatar name={person.name} size={36} />
                      <span className={styles.personText}>
                        <span className={styles.personName}>{person.name}</span>
                        <span className={styles.personMeta}>{[person.designation, person.department].filter((value) => value && value !== "—").join(" · ") || person.employee_code}</span>
                        <span className={styles.personMeta}>{person.employee_code}{person.location && person.location !== "—" ? ` · ${person.location}` : ""}{person.sample ? " · Sample data" : ""}</span>
                      </span>
                      <Badge tone={meta.tone} dot>{meta.label}</Badge>
                    </button>
                    {canEdit && !person.sample && <IconButton label={`Edit ${person.name}`} icon={Pencil} onClick={() => onEdit(person)} />}
                  </li>
                );
              })}
            </ul>

            <div className={styles.pagination}>
              <span className={styles.paginationText} aria-live="polite">{from}–{to} of {total}</span>
              <label className={styles.pageSize}>
                <span>Rows</span>
                <Select value={pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))} aria-label="Rows per page">
                  {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                </Select>
              </label>
              <div className={ui.actions}>
                <IconButton label="Previous page" icon={ChevronLeft} variant="secondary" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} />
                <IconButton label="Next page" icon={ChevronRight} variant="secondary" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} />
              </div>
              <Button variant="ghost" size="sm" icon={Download} onClick={() => exportRows(table.getFilteredRowModel().rows.map((row) => row.original))}>Export {total}</Button>
            </div>
          </>
        )}
    </section>
  );
}
