"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, History, Layers, MapPin, Network, Search, Users } from "lucide-react";
import GroupStructurePanel from "@/components/People/GroupStructurePanel";
import { Avatar, Badge, EmptyState, ErrorState, Input, Panel, Select, SkeletonRows, cx, ui, type Tone } from "@/design/redesign/ui";
import {
  formatDate, formatDateTime, humanise, useDocuments, useOrgChart, usePositions, useSanctionedStrength,
  type AuditRow, type DocumentRow, type LocationRow, type OrgNode, type PeoplePayload,
} from "../data";
import type { PersonRow } from "./Directory";
import styles from "./Registers.module.css";

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function Overview({ data, people, onOpen, onShow }: {
  data: PeoplePayload | undefined; people: PersonRow[]; onOpen: (row: PersonRow) => void; onShow: (section: string) => void;
}) {
  const documents = useDocuments();
  const active = people.filter((row) => row.status === "active" && !row.sample);
  const noManager = active.filter((row) => !row.manager_name);
  const noDepartment = active.filter((row) => !row.department || row.department === "—");
  const noEmail = active.filter((row) => !row.work_email);
  const [now] = useState(() => Date.now());
  const today = new Date(now).toISOString().slice(0, 10);
  const in30 = new Date(now + 30 * 86_400_000).toISOString().slice(0, 10);
  const recentJoiners = [...active].filter((row) => row.joining_date && row.joining_date.slice(0, 10) <= today).sort((a, b) => (b.joining_date ?? "").localeCompare(a.joining_date ?? "")).slice(0, 6);
  const expiring = (documents.data ?? []).filter((row) => row.expires_on && row.expires_on.slice(0, 10) <= in30 && row.status !== "replaced");
  const pendingDocs = (documents.data ?? []).filter((row) => row.status === "pending_verification");
  const summary = data?.summary;

  const metrics: Array<{ label: string; value: ReactNode; detail: string; action?: () => void }> = [
    { label: "Active employees", value: summary ? summary.activeEmployees.toLocaleString("en-IN") : "—", detail: "On the rolls today", action: () => onShow("directory") },
    { label: "Open sanctioned positions", value: summary?.sanctionedOpen ?? "—", detail: summary?.sanctionedOpen === null ? "No manpower plan recorded" : "From the approved manpower plan", action: () => onShow("positions") },
    { label: "Documents verified", value: summary?.verifiedPercent === null || summary?.verifiedPercent === undefined ? "—" : `${summary.verifiedPercent}%`, detail: summary?.documentsTotal ? `${summary.documentsVerified} of ${summary.documentsTotal} documents` : "No documents uploaded", action: () => onShow("documents") },
    { label: "Changes recorded", value: summary?.auditEvents?.toLocaleString("en-IN") ?? "—", detail: "Entries in the audit trail", action: () => onShow("audit") },
  ];

  const attentionItems: Array<{ label: string; count: number; tone: Tone; action: () => void }> = [
    { label: "Active employees without a reporting manager", count: noManager.length, tone: "warning", action: () => onShow("directory") },
    { label: "Active employees without a department", count: noDepartment.length, tone: "warning", action: () => onShow("directory") },
    { label: "Active employees without a work email", count: noEmail.length, tone: "neutral", action: () => onShow("directory") },
    { label: "Documents waiting for verification", count: pendingDocs.length, tone: "info", action: () => onShow("documents") },
    { label: "Documents expired or expiring within 30 days", count: expiring.length, tone: "danger", action: () => onShow("documents") },
  ];
  const attention = attentionItems.filter((item) => item.count > 0);

  return (
    <div className={styles.stack}>
      <div className={styles.metrics} role="list">
        {metrics.map((metric) => (
          <button key={metric.label} type="button" role="listitem" className={styles.metric} onClick={metric.action}>
            <span className={styles.metricLabel}>{metric.label}</span>
            <span className={styles.metricValue}>{metric.value}</span>
            <span className={styles.metricDetail}>{metric.detail}</span>
          </button>
        ))}
      </div>
      <div className={ui.grid2}>
        <Panel title="Needs attention" subtitle="Gaps in employee records and documents" flush highlight>
          {attention.length === 0 ? <EmptyState icon={AlertTriangle} title="Nothing needs attention">Every active record has a manager, department and work email, and no documents are waiting or expiring.</EmptyState> : (
            <ul className={styles.list}>
              {attention.map((item) => (
                <li key={item.label}>
                  <button type="button" className={styles.listButton} onClick={item.action}>
                    <span>{item.label}</span>
                    <Badge tone={item.tone}>{item.count}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent joiners" subtitle="Latest joining dates" flush>
          {recentJoiners.length === 0 ? <EmptyState icon={Users} title="No joiners recorded">Joining dates appear here once employees are added.</EmptyState> : (
            <ul className={styles.list}>
              {recentJoiners.map((row) => (
                <li key={row.id}>
                  <button type="button" className={styles.listButton} onClick={() => onOpen(row)}>
                    <span className={styles.personCell}><Avatar name={row.name} size={28} /><span><span className={styles.strong}>{row.name}</span><span className={styles.sub}>{[row.designation, row.department].filter((value) => value && value !== "—").join(" · ")}</span></span></span>
                    <span className={cx(ui.muted, ui.nowrap)}>{formatDate(row.joining_date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Organisation                                                        */
/* ------------------------------------------------------------------ */

export function Organisation({ data, canSeeGroup, onOpen, people }: { data: PeoplePayload | undefined; canSeeGroup: boolean; onOpen: (row: PersonRow) => void; people: PersonRow[] }) {
  const [view, setView] = useState<"reporting" | "companies" | "locations">("reporting");
  return (
    <div className={cx(styles.stack, ui.fit)}>
      <div className={styles.segment} role="tablist" aria-label="Organisation views">
        {([["reporting", "Reporting lines", Network], ["companies", "Companies", Layers], ["locations", "Locations", MapPin]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={styles.segmentButton} onClick={() => setView(id)}><Icon aria-hidden="true" size={16} />{label}</button>
        ))}
      </div>
      {view === "reporting" && <ReportingTree onOpen={(id) => { const row = people.find((person) => person.id === id); if (row) onOpen(row); }} />}
      {view === "companies" && (canSeeGroup ? <GroupStructurePanel /> : <Panel title="Companies"><EmptyState title="Group structure is not enabled">Ask the platform administrator to enable Group structure for this organisation.</EmptyState></Panel>)}
      {view === "locations" && <LocationsTable rows={data?.locations ?? null} />}
    </div>
  );
}

function ReportingTree({ onOpen }: { onOpen: (id: string) => void }) {
  const chart = useOrgChart();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const count = useMemo(() => {
    const walk = (nodes: OrgNode[]): number => nodes.reduce((sum, node) => sum + 1 + walk(node.children ?? []), 0);
    return walk(chart.data ?? []);
  }, [chart.data]);

  const matches = (node: OrgNode): boolean => {
    const text = `${node.firstName} ${node.lastName} ${node.employeeCode} ${node.designation} ${node.department}`.toLowerCase();
    return text.includes(query.toLowerCase()) || (node.children ?? []).some(matches);
  };
  const toggle = (id: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const renderNode = (node: OrgNode, depth: number): ReactNode => {
    if (query && !matches(node)) return null;
    const children = node.children ?? [];
    const open = query ? true : !collapsed.has(node.id);
    const name = `${node.firstName} ${node.lastName}`.trim();
    return (
      <li key={node.id} role="treeitem" aria-selected={false} aria-expanded={children.length ? open : undefined} aria-level={depth + 1} className={styles.treeItem}>
        <div className={styles.treeRow} style={{ paddingLeft: depth * 20 }}>
          {children.length ? (
            <button type="button" className={styles.treeToggle} aria-label={`${open ? "Collapse" : "Expand"} ${name}'s team`} onClick={() => toggle(node.id)}>
              {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            </button>
          ) : <span className={styles.treeSpacer} aria-hidden="true" />}
          <button type="button" className={styles.treeNode} onClick={() => onOpen(node.id)}>
            <Avatar name={name} size={28} />
            <span><span className={styles.strong}>{name}</span><span className={styles.sub}>{[node.designation, node.department].filter(Boolean).join(" · ")}</span></span>
          </button>
          {children.length > 0 && <span className={styles.treeCount}>{children.length} direct {children.length === 1 ? "report" : "reports"}</span>}
        </div>
        {children.length > 0 && open && <ul role="group" className={styles.tree}>{children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <Panel fill title="Reporting lines" subtitle={chart.data ? `${count} active employees` : undefined} actions={
      <div className={ui.searchBox} style={{ width: 240 }}><Search aria-hidden="true" /><Input type="search" aria-label="Find a person in the reporting tree" placeholder="Find a person…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    } flush>
      {chart.error ? <div style={{ padding: 16 }}><ErrorState message={chart.error.message} onRetry={() => void chart.mutate()} /></div>
        : chart.isLoading ? <SkeletonRows rows={6} columns={2} />
        : (chart.data ?? []).length === 0 ? <EmptyState icon={Network} title="No reporting lines yet">Set each employee&apos;s reporting manager to build the tree.</EmptyState>
        : <ul role="tree" aria-label="Reporting lines" className={styles.tree}>{chart.data!.map((node) => renderNode(node, 0))}</ul>}
    </Panel>
  );
}

function LocationsTable({ rows }: { rows: LocationRow[] | null }) {
  if (rows === null) return <Panel title="Locations"><ErrorState message="Locations could not be loaded." /></Panel>;
  return (
    <Panel fill title="Locations and work sites" subtitle={`${rows.length} recorded`} flush>
      {rows.length === 0 ? <EmptyState icon={MapPin} title="No locations recorded">Locations are added with the Location master in the record screens.</EmptyState> : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead><tr><th>Code</th><th>Name</th><th>City</th><th>State</th><th>Type</th><th className={ui.numeric}>Headcount</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}><td className={ui.mono}>{row.code}</td><td>{row.name}</td><td>{row.city ?? "—"}</td><td>{row.state ?? "—"}</td><td>{row.establishment_type ? humanise(row.establishment_type) : "—"}</td><td className={ui.numeric}>{row.headcount}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Positions                                                           */
/* ------------------------------------------------------------------ */

const POSITION_TONE: Record<string, Tone> = { filled: "success", vacant: "warning", frozen: "neutral" };

export function Positions() {
  const positions = usePositions();
  const sanctioned = useSanctionedStrength();
  const [filter, setFilter] = useState("");
  const rows = (positions.data ?? []).filter((row) => !filter || row.vacancy === filter);
  return (
    <div className={cx(styles.stack, ui.fit)}>
      <Panel fill title="Position register" subtitle={positions.data ? `${positions.data.length} positions · ${positions.data.filter((row) => row.vacancy === "vacant").length} vacant` : undefined}
        actions={<Select aria-label="Filter positions" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ width: 160 }}><option value="">All positions</option><option value="filled">Filled</option><option value="vacant">Vacant</option></Select>} flush>
        {positions.error ? <div style={{ padding: 16 }}><ErrorState message={positions.error.message} onRetry={() => void positions.mutate()} /></div>
          : positions.isLoading ? <SkeletonRows rows={5} columns={6} />
          : rows.length === 0 ? <EmptyState icon={Layers} title={positions.data?.length ? "No positions match" : "No positions recorded"}>Positions are created from the Position register record screen or approved requisitions.</EmptyState>
          : (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead><tr><th>Code</th><th>Title</th><th>Department</th><th>Location</th><th>Incumbent</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className={ui.mono}>{row.code}</td><td>{row.title}</td><td>{row.department}</td><td>{row.location}</td>
                      <td>{row.incumbent_name ?? <span className={ui.muted}>Vacant</span>}</td>
                      <td><Badge tone={POSITION_TONE[row.vacancy] ?? "neutral"}>{humanise(row.vacancy)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>
      <Panel fill title="Sanctioned strength" subtitle="Approved headcount against people deployed" flush>
        {sanctioned.error ? <div style={{ padding: 16 }}><ErrorState message={sanctioned.error.message} onRetry={() => void sanctioned.mutate()} /></div>
          : sanctioned.isLoading ? <SkeletonRows rows={3} columns={5} />
          : (sanctioned.data ?? []).length === 0 ? <EmptyState icon={Users} title="No manpower plan recorded">Sanctioned strength appears once a manpower plan is approved.</EmptyState>
          : (
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead><tr><th>Line</th><th>Department</th><th>Designation</th><th className={ui.numeric}>Sanctioned</th><th className={ui.numeric}>Filled</th><th>Status</th></tr></thead>
                <tbody>
                  {(sanctioned.data ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className={ui.mono}>{String(row.record_code ?? row.code ?? row.record ?? "—")}</td>
                      <td>{String(row.organisation ?? row.department ?? row.org_unit ?? "—")}</td>
                      <td>{String(row.designation ?? "—")}</td>
                      <td className={ui.numeric}>{String(row.sanctioned ?? "—")}</td>
                      <td className={ui.numeric}>{String(row.filled ?? "—")}</td>
                      <td><Badge tone={row.status === "over_plan" ? "danger" : row.status === "at_limit" ? "warning" : "success"}>{humanise(String(row.status ?? "within_headroom"))}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

const DOCUMENT_TONE: Record<string, Tone> = { verified: "success", pending_verification: "info", rejected: "danger", expired: "danger", replaced: "neutral" };

export function Documents({ onOpenEmployee }: { onOpenEmployee: (code: string) => void }) {
  const documents = useDocuments();
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const rows = (documents.data ?? []).filter((row) => (!status || row.status === status)
    && (!query || `${row.title} ${row.employee_name ?? ""} ${row.employee_code ?? ""} ${row.document_type}`.toLowerCase().includes(query.toLowerCase())));
  return (
    <Panel fill title="Document vault" subtitle={documents.data ? `${documents.data.length} documents` : undefined} actions={
      <div className={styles.filters}>
        <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search documents" placeholder="Search documents…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <Select aria-label="Document status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(DOCUMENT_TONE).map((value) => <option key={value} value={value}>{humanise(value)}</option>)}
        </Select>
      </div>
    } flush>
      <DocumentsTable rows={rows} loading={documents.isLoading} error={documents.error?.message ?? null} onRetry={() => void documents.mutate()} total={documents.data?.length ?? 0} onOpenEmployee={onOpenEmployee} />
    </Panel>
  );
}

export function DocumentsTable({ rows, loading, error, onRetry, total, onOpenEmployee, showEmployee = true }: {
  rows: DocumentRow[]; loading: boolean; error: string | null; onRetry: () => void; total: number; onOpenEmployee?: (code: string) => void; showEmployee?: boolean;
}) {
  if (error) return <div style={{ padding: 16 }}><ErrorState message={error} onRetry={onRetry} /></div>;
  if (loading) return <SkeletonRows rows={4} columns={5} />;
  if (rows.length === 0) return <EmptyState icon={FileText} title={total ? "No documents match" : "No documents uploaded"}>Documents uploaded for employees appear here with their verification status and expiry.</EmptyState>;
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <thead><tr><th>Document</th>{showEmployee && <th>Employee</th>}<th>Type</th><th>Expires</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><span className={styles.strong}>{row.title}</span><span className={styles.sub}>{row.code}</span></td>
              {showEmployee && <td>{row.employee_code && onOpenEmployee ? <button type="button" className={styles.linkButton} onClick={() => onOpenEmployee(row.employee_code!)}>{row.employee_name ?? row.employee_code}</button> : row.employee_name ?? "—"}</td>}
              <td>{humanise(row.document_type)}</td>
              <td className={ui.nowrap}>{formatDate(row.expires_on) || "—"}</td>
              <td><Badge tone={DOCUMENT_TONE[row.status] ?? "neutral"}>{humanise(row.status)}</Badge>{row.rejection_reason && <span className={styles.sub}>{row.rejection_reason}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export function Audit({ rows, onOpenEmployee }: { rows: AuditRow[] | null; onOpenEmployee: (id: string) => void }) {
  const [query, setQuery] = useState("");
  if (rows === null) return <Panel title="Audit trail"><ErrorState message="The audit trail could not be loaded, or your role cannot read it." /></Panel>;
  const filtered = rows.filter((row) => !query || `${row.action} ${row.entity_type} ${row.reason ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <Panel fill title="Audit trail" subtitle="The 50 most recent changes in this organisation" actions={
      <div className={ui.searchBox} style={{ width: 240 }}><Search aria-hidden="true" /><Input type="search" aria-label="Search the audit trail" placeholder="Search actions…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    } flush>
      {filtered.length === 0 ? <EmptyState icon={History} title={rows.length ? "No entries match" : "No changes recorded"}>Every create, update and approval is recorded here.</EmptyState> : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead><tr><th>When</th><th>Action</th><th>Record</th><th>Reason</th></tr></thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className={ui.nowrap}>{formatDateTime(row.created_at)}</td>
                  <td>{humanise(row.action)}</td>
                  <td>{row.entity_type === "employee" && row.entity_id ? <button type="button" className={styles.linkButton} onClick={() => onOpenEmployee(row.entity_id!)}>Employee</button> : humanise(row.entity_type)}</td>
                  <td className={styles.reason}>{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

