"use client";

import { useState } from "react";
import {
  Building2, ChevronRight, Download, Eye, File, FileImage, FileSpreadsheet, FileText, Folder, FolderOpen, LayoutGrid, List, MoreHorizontal, Search, Trash2, Upload, X,
} from "lucide-react";
import { ActionMenu, Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, Scope, Select, SkeletonRows, Textarea, cx, ui } from "@/design/redesign/ui";
import { formatBytes } from "@/lib/documents/file-types";
import { deleteDocument, documentState, fileUrl, useDocuments, useTree, type Filters, type LibraryDocument, type LibraryTree } from "./data";
import UploadDrawer from "./UploadDrawer";
import Viewer from "./Viewer";
import styles from "./Documents.module.css";

/**
 * The document library: every employee document filed under company > department > person, as
 * folders or as one list. HR and administrators see and manage everyone's; everyone else sees their
 * own folder, can add to it, and can delete what they uploaded. What each person may do comes from
 * the server (the tree's `reach`), never from the role name in the browser.
 */

type Place = { company?: string; department?: string; employee?: string };
type View = "folders" | "list";
const VIEW_KEY = "nucleus_documents_view";

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function FileIcon({ mime, size = 18 }: { mime: string | null; size?: number }) {
  if (mime?.startsWith("image/")) return <FileImage size={size} aria-hidden="true" />;
  if (mime?.includes("spreadsheet")) return <FileSpreadsheet size={size} aria-hidden="true" />;
  if (mime === "application/pdf" || mime?.includes("word") || mime === "text/plain") return <FileText size={size} aria-hidden="true" />;
  return <File size={size} aria-hidden="true" />;
}

const KIND_CLASS = (mime: string | null) => (mime === "application/pdf" ? styles.kindPdf : mime?.startsWith("image/") ? styles.kindImage : mime?.includes("spreadsheet") ? styles.kindSheet : mime?.includes("word") ? styles.kindWord : styles.kindOther);

function findPerson(data: LibraryTree | undefined, employeeId: string | undefined) {
  if (!data || !employeeId) return null;
  for (const company of data.companies) for (const department of company.departments) {
    const found = department.employees.find((employee) => employee.id === employeeId);
    if (found) return { ...found, company, department };
  }
  return null;
}

export default function DocumentsWorkspace({ organisation }: { organisation?: string }) {
  const tree = useTree();
  const [place, setPlace] = useState<Place>({});
  const [view, setViewState] = useState<View>(() => {
    try { return (typeof window !== "undefined" && localStorage.getItem(VIEW_KEY) === "list") ? "list" : "folders"; } catch { return "folders"; }
  });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<LibraryDocument | null>(null);
  const [removing, setRemoving] = useState<LibraryDocument | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const setView = (next: View) => { setViewState(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* storage blocked */ } };
  const data = tree.data;
  const selfOnly = data?.reach.read === "self";
  // Someone who sees only their own documents always stands in their own folder.
  const effective: Place = selfOnly && data?.me ? { employee: data.me } : place;

  const company = data?.companies.find((entry) => entry.id === effective.company);
  const department = company?.departments.find((entry) => entry.name === effective.department);
  const person = findPerson(data, effective.employee);

  // Files are listed in the list view, inside a person's folder, and whenever a search or type filter is on.
  const showFiles = view === "list" || Boolean(effective.employee) || Boolean(search.trim()) || Boolean(type);
  const filters: Filters | null = data && showFiles ? {
    company: effective.employee ? undefined : effective.company, department: effective.employee ? undefined : effective.department,
    employee: effective.employee, type: type || undefined, search: search.trim() || undefined,
  } : null;
  const documents = useDocuments(filters);
  const rows = documents.data?.documents ?? [];

  const canUploadHere = data?.reach.write === "all" || (data?.reach.write === "self" && Boolean(data.me));
  const refresh = () => { void tree.mutate(); void documents.mutate(); };
  const go = (next: Place) => { setPlace(next); setSearch(""); };

  async function confirmDelete() {
    const target = removing;
    if (!target) return;
    setRemoving(null);
    try {
      await deleteDocument(target.id, reason);
      setNotice({ tone: "success", text: `"${target.title}" was deleted. The record of it stays in the audit trail.` });
      if (viewing?.id === target.id) setViewing(null);
      refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: (error as Error).message });
    }
    setReason("");
  }

  const actionsFor = (document: LibraryDocument) => [
    { label: "Open", icon: Eye, onSelect: () => setViewing(document), disabled: !document.hasFile },
    { label: "Download", icon: Download, onSelect: () => { window.location.href = fileUrl(document.id, true); }, disabled: !document.hasFile },
    ...(document.canDelete ? [{ label: "Delete", icon: Trash2, onSelect: () => setRemoving(document), separatorBefore: true }] : []),
  ];

  /* ---------------- breadcrumb ---------------- */
  const crumbs: Array<{ label: string; place: Place | null }> = selfOnly
    ? [{ label: "My documents", place: null }]
    : [
      { label: "All companies", place: {} },
      ...(company || person ? [{ label: (company ?? person!.company).name, place: { company: (company ?? person!.company).id } }] : []),
      ...(department || person ? [{ label: (department ?? person!.department).name, place: { company: (company ?? person!.company).id, department: (department ?? person!.department).name } }] : []),
      ...(person ? [{ label: person.name, place: null }] : []),
    ];

  /* ---------------- folder tree (left) ---------------- */
  const treeNav = data && !selfOnly && (
    <nav className={styles.tree} aria-label="Folders">
      <button type="button" className={cx(styles.treeRow, styles.treeRoot)} aria-current={!effective.company && !effective.employee ? "true" : undefined} onClick={() => go({})}>
        <FolderOpen size={16} aria-hidden="true" /><span className={styles.treeName}>All companies</span>
        <span className={styles.treeCount}>{data.companies.reduce((sum, entry) => sum + entry.documents, 0)}</span>
      </button>
      <ul className={styles.treeList}>
        {data.companies.map((entry) => {
          const open = collapsed[entry.id] === undefined ? effective.company === entry.id || person?.company.id === entry.id : !collapsed[entry.id];
          return (
            <li key={entry.id}>
              <div className={styles.treeLine}>
                <button type="button" className={styles.treeToggle} aria-label={open ? `Fold ${entry.name}` : `Unfold ${entry.name}`} aria-expanded={open} onClick={() => setCollapsed((value) => ({ ...value, [entry.id]: open }))}>
                  <ChevronRight size={14} className={cx(styles.chevron, open && styles.chevronOpen)} aria-hidden="true" />
                </button>
                <button type="button" className={styles.treeRow} aria-current={effective.company === entry.id && !effective.department ? "true" : undefined} onClick={() => go({ company: entry.id })}>
                  <Building2 size={15} aria-hidden="true" /><span className={styles.treeName}>{entry.name}</span><span className={styles.treeCount}>{entry.documents}</span>
                </button>
              </div>
              {open && (
                <ul className={styles.treeList}>
                  {entry.departments.map((group) => {
                    const key = `${entry.id}|${group.name}`;
                    const groupOpen = collapsed[key] === undefined ? (effective.department === group.name && effective.company === entry.id) || person?.department === group : !collapsed[key];
                    return (
                      <li key={key}>
                        <div className={styles.treeLine}>
                          <button type="button" className={styles.treeToggle} aria-label={groupOpen ? `Fold ${group.name}` : `Unfold ${group.name}`} aria-expanded={groupOpen} onClick={() => setCollapsed((value) => ({ ...value, [key]: groupOpen }))}>
                            <ChevronRight size={14} className={cx(styles.chevron, groupOpen && styles.chevronOpen)} aria-hidden="true" />
                          </button>
                          <button type="button" className={styles.treeRow} aria-current={effective.company === entry.id && effective.department === group.name && !effective.employee ? "true" : undefined} onClick={() => go({ company: entry.id, department: group.name })}>
                            <Folder size={15} aria-hidden="true" /><span className={styles.treeName}>{group.name}</span><span className={styles.treeCount}>{group.documents}</span>
                          </button>
                        </div>
                        {groupOpen && (
                          <ul className={cx(styles.treeList, styles.treePeople)}>
                            {group.employees.map((employee) => (
                              <li key={employee.id}>
                                <button type="button" className={cx(styles.treeRow, employee.former && styles.treeFormer)} aria-current={effective.employee === employee.id ? "true" : undefined} onClick={() => go({ employee: employee.id })}>
                                  <span className={styles.treeDot} aria-hidden="true" /><span className={styles.treeName}>{employee.name}</span><span className={styles.treeCount}>{employee.documents}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );

  /* ---------------- folders (right, folder view) ---------------- */
  function folderGrid() {
    if (!data) return null;
    if (!effective.company) {
      return (
        <ul className={styles.folders}>
          {data.companies.map((entry) => (
            <li key={entry.id}>
              <button type="button" className={styles.folder} onClick={() => go({ company: entry.id })}>
                <span className={cx(styles.folderIcon, styles.folderCompany)}><Building2 size={20} aria-hidden="true" /></span>
                <span className={styles.folderName}>{entry.name}</span>
                <span className={styles.folderMeta}>{entry.departments.length} departments · {entry.people} people</span>
                <span className={styles.folderCount}>{entry.documents} {entry.documents === 1 ? "document" : "documents"}</span>
              </button>
            </li>
          ))}
        </ul>
      );
    }
    if (company && !effective.department) {
      return (
        <ul className={styles.folders}>
          {company.departments.map((group) => (
            <li key={group.name}>
              <button type="button" className={styles.folder} onClick={() => go({ company: company.id, department: group.name })}>
                <span className={cx(styles.folderIcon, styles.folderDepartment)}><Folder size={20} aria-hidden="true" /></span>
                <span className={styles.folderName}>{group.name}</span>
                <span className={styles.folderMeta}>{group.people} {group.people === 1 ? "person" : "people"}</span>
                <span className={styles.folderCount}>{group.documents} {group.documents === 1 ? "document" : "documents"}</span>
              </button>
            </li>
          ))}
        </ul>
      );
    }
    if (department) {
      return (
        <ul className={styles.folders}>
          {department.employees.map((employee) => (
            <li key={employee.id}>
              <button type="button" className={cx(styles.folder, employee.former && styles.folderFormer)} onClick={() => go({ employee: employee.id })}>
                <span className={styles.folderAvatar}><Avatar name={employee.name} size={36} /></span>
                <span className={styles.folderName}>{employee.name}</span>
                <span className={styles.folderMeta}>{employee.designation ?? "—"} · {employee.code}</span>
                <span className={styles.folderCount}>{employee.documents} {employee.documents === 1 ? "document" : "documents"}{employee.former ? <Badge tone="neutral">Former</Badge> : null}</span>
              </button>
            </li>
          ))}
        </ul>
      );
    }
    return null;
  }

  /* ---------------- files (cards or table) ---------------- */
  function files() {
    if (documents.error) return <div className={styles.pad}><ErrorState message={(documents.error as Error).message} onRetry={() => void documents.mutate()} /></div>;
    if (!documents.data) return <SkeletonRows rows={5} columns={5} />;
    if (rows.length === 0) {
      return (
        <EmptyState icon={FolderOpen} title={search || type ? "No documents match" : person ? `No documents for ${person.name} yet` : "No documents here yet"}
          action={canUploadHere && !search && !type ? <Button icon={Upload} variant="primary" onClick={() => setUploading(true)}>Upload a document</Button> : undefined}>
          {search || type ? "Try another search or type." : "Uploaded documents are filed here by company, department and person."}
        </EmptyState>
      );
    }
    if (view === "folders") {
      return (
        <ul className={styles.files}>
          {rows.map((document) => {
            const state = documentState(document);
            return (
              <li key={document.id} className={styles.fileCard}>
                <button type="button" className={styles.fileOpen} onClick={() => setViewing(document)} disabled={!document.hasFile} title={document.hasFile ? "Open" : "No file is stored for this record"}>
                  <span className={cx(styles.fileKind, KIND_CLASS(document.mime))}><FileIcon mime={document.mime} size={22} /></span>
                  <span className={styles.fileTitle}>{document.title}</span>
                  <span className={styles.fileMeta}>{document.type}{!effective.employee ? ` · ${document.employeeName}` : ""}</span>
                  <span className={styles.fileMeta}>{dateLabel(document.uploadedAt)}{document.sizeBytes ? ` · ${formatBytes(document.sizeBytes)}` : ""}</span>
                </button>
                <div className={styles.fileFoot}>
                  <Badge tone={state.tone}>{state.label}</Badge>
                  <ActionMenu label={`Actions for ${document.title}`} trigger={<MoreHorizontal size={16} aria-hidden="true" />} actions={actionsFor(document)} />
                </div>
              </li>
            );
          })}
        </ul>
      );
    }
    return (
      <div className={cx(ui.tableWrap, styles.tableFill)}>
        <table className={ui.table}>
          <thead>
            <tr><th>Document</th>{!effective.employee && <th>Person</th>}{!effective.employee && <th>Company · department</th>}<th>Type</th><th>Uploaded</th><th className={ui.numeric}>Size</th><th>Status</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {rows.map((document) => {
              const state = documentState(document);
              return (
                <tr key={document.id}>
                  <td>
                    <button type="button" className={styles.rowTitle} onClick={() => setViewing(document)} disabled={!document.hasFile}>
                      <span className={cx(styles.rowKind, KIND_CLASS(document.mime))}><FileIcon mime={document.mime} size={16} /></span>
                      <span className={styles.rowText}><span className={styles.rowName}>{document.title}</span><span className={styles.rowSub}>{document.fileName ?? document.code ?? (document.hasFile ? "Generated copy" : "No file stored")}</span></span>
                    </button>
                  </td>
                  {!effective.employee && <td><button type="button" className={styles.linkButton} onClick={() => go({ employee: document.employeeId })}>{document.employeeName}</button><span className={styles.rowSub}>{document.employeeCode}{document.former ? " · Former" : ""}</span></td>}
                  {!effective.employee && <td><span className={styles.rowName}>{document.company}</span><span className={styles.rowSub}>{document.department}</span></td>}
                  <td>{document.type}</td>
                  <td className={ui.nowrap}><span className={styles.rowName}>{dateLabel(document.uploadedAt)}</span><span className={styles.rowSub}>{document.source === "system" ? "Payroll" : document.uploadedBy ?? "HR records"}</span></td>
                  <td className={cx(ui.numeric, ui.nowrap)}>{formatBytes(document.sizeBytes)}</td>
                  <td><Badge tone={state.tone}>{state.label}</Badge></td>
                  <td className={styles.rowActions}><ActionMenu label={`Actions for ${document.title}`} trigger={<MoreHorizontal size={16} aria-hidden="true" />} actions={actionsFor(document)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const heading = selfOnly ? "My documents" : person ? person.name : department ? department.name : company ? company.name : "All companies";
  const subheading = person
    ? `${person.designation ?? ""}${person.designation ? " · " : ""}${person.department.name} · ${person.company.name}${person.former ? " · Former employee" : ""}`
    : department ? `${department.people} people · ${department.documents} documents` : company ? `${company.departments.length} departments · ${company.documents} documents` : data ? `${data.companies.length} companies · ${data.companies.reduce((sum, entry) => sum + entry.documents, 0)} documents` : "";

  return (
    <Scope module="documents" className={ui.fit}>
      <div className={cx(ui.page, ui.fit)}>
        <PageHeader
          eyebrow={organisation || "Documents"}
          title="Documents"
          description={selfOnly ? "Your documents: add your own, open or download any of them." : "Every employee document, filed by company, department and person."}
          actions={canUploadHere ? <Button icon={Upload} variant="primary" onClick={() => setUploading(true)}>Upload</Button> : undefined}
        />

        {notice && (
          <div className={cx(styles.notice, notice.tone === "danger" ? styles.noticeDanger : styles.noticeSuccess)} role="status">
            <span>{notice.text}</span>
            <button type="button" className={styles.noticeClose} aria-label="Dismiss" onClick={() => setNotice(null)}><X size={14} aria-hidden="true" /></button>
          </div>
        )}

        {tree.error ? <ErrorState message={(tree.error as Error).message} onRetry={() => void tree.mutate()} /> : !data ? (
          <div className={cx(ui.panel)}><SkeletonRows rows={6} columns={4} /></div>
        ) : (
          <div className={cx(styles.layout, selfOnly && styles.layoutSingle)}>
            {treeNav}
            <section className={cx(ui.panel, ui.fill, styles.content)} aria-label="Documents">
              <div className={styles.toolbar}>
                <div className={styles.titleBlock}>
                  {crumbs.length > 1 && <nav aria-label="Folder path" className={styles.crumbs}>
                    {crumbs.map((crumb, index) => (
                      <span key={`${crumb.label}-${index}`} className={styles.crumb}>
                        {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
                        {crumb.place && index < crumbs.length - 1 ? <button type="button" onClick={() => go(crumb.place!)}>{crumb.label}</button> : <span aria-current="page">{crumb.label}</span>}
                      </span>
                    ))}
                  </nav>}
                  <h2 className={styles.heading}>{person && !selfOnly ? <><Avatar name={person.name} size={24} />{heading}</> : heading}</h2>
                  {subheading && <p className={styles.subheading}>{subheading}</p>}
                </div>
                <div className={styles.tools}>
                  <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label="Search documents" placeholder={person ? `Search ${person.name.split(" ")[0]}'s documents` : "Search documents or people"} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                  <Select aria-label="Document type" value={type} onChange={(event) => setType(event.target.value)}>
                    <option value="">All types</option>
                    {data.types.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </Select>
                  <div className={ui.pills} role="group" aria-label="View">
                    <button type="button" className={ui.pill} aria-pressed={view === "folders"} onClick={() => setView("folders")}><LayoutGrid aria-hidden="true" />Folders</button>
                    <button type="button" className={ui.pill} aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" />List</button>
                  </div>
                </div>
              </div>
              {/* A new folder or view starts at the top. */}
              <div className={styles.body} key={`${view}:${effective.company ?? ""}:${effective.department ?? ""}:${effective.employee ?? ""}`}>
                {showFiles ? files() : folderGrid()}
                {documents.data?.truncated && <p className={styles.truncated}>Showing the newest 1,000. Open a folder or search to narrow it down.</p>}
              </div>
            </section>
          </div>
        )}
      </div>

      {uploading && data && (
        <UploadDrawer
          tree={data}
          defaultEmployee={effective.employee ?? null}
          onClose={() => setUploading(false)}
          onUploaded={(title, verification, employeeId) => {
            setUploading(false);
            setNotice({ tone: "success", text: verification === "pending" ? `"${title}" was added. HR will verify it.` : `"${title}" was added.` });
            if (!selfOnly) go({ employee: employeeId });
            refresh();
          }}
        />
      )}
      {viewing && <Viewer document={viewing} onClose={() => setViewing(null)} onDelete={viewing.canDelete ? () => setRemoving(viewing) : undefined} />}
      <ConfirmDialog open={Boolean(removing)} title="Delete this document?" confirmLabel="Delete" tone="danger" onCancel={() => { setRemoving(null); setReason(""); }} onConfirm={() => void confirmDelete()}>
        <p className={styles.confirmText}><strong>{removing?.title}</strong>{removing ? ` · ${removing.employeeName}` : ""}. The file is removed for good; a record that it existed, and who deleted it, stays in the audit trail.</p>
        <label className={styles.confirmLabel} htmlFor="delete-reason">Reason (optional)</label>
        <Textarea id="delete-reason" rows={2} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="For example: uploaded to the wrong person" />
      </ConfirmDialog>
    </Scope>
  );
}

