"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, Lock, Search, Upload, Users } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, ErrorState, Input, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import { useTranslation } from "@/context/I18nContext";
import { formatBytes } from "@/lib/documents/file-types";
import { PEOPLE_CHANGED, VaultError, accessLink, useEmployeeFolder, usePeople, type EmployeeDocument } from "./people-data";
import VaultUploadModal from "./VaultUploadModal";
import VaultPreview from "./VaultPreview";
import styles from "./Documents.module.css";

/**
 * People > Documents: a paginated, searchable person directory; choosing a person lists their
 * vault documents with upload, inline preview and download (signed links). Access is decided by
 * the API; a 403 shows the permission-denied state.
 */

const PAGE_SIZE = 25;

function useDateFormat() {
  const { locale } = useTranslation();
  return (value: string | null) => (value ? new Intl.DateTimeFormat(locale || "en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00`)) : "—");
}

function Denied() {
  const { t } = useTranslation();
  return <EmptyState icon={Lock} title={t("documents.vault_denied_title", "You do not have access")}>{t("documents.vault_denied", "Your role cannot open these documents. Ask an HR administrator for access.")}</EmptyState>;
}

export default function PeopleVault() {
  const { t } = useTranslation();
  const date = useDateFormat();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const people = usePeople(page, search, PAGE_SIZE);
  const meta = people.data?.meta;
  const selfOnly = meta?.scope === "self";
  const only = selfOnly ? people.data?.data[0] : undefined;
  const current = selected ?? (only ? { id: only.employeeId, name: only.name } : null);

  // Refresh the directory when any view changes a person's documents.
  useEffect(() => {
    const refresh = () => void people.mutate();
    window.addEventListener(PEOPLE_CHANGED, refresh);
    return () => window.removeEventListener(PEOPLE_CHANGED, refresh);
  }, [people]);

  if (people.error instanceof VaultError && people.error.status === 403) return <Denied />;
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className={cx(styles.layout, selfOnly && styles.layoutSingle)}>
      {!selfOnly && (
        <aside className={cx(ui.panel, styles.content)} aria-label={t("documents.vault_people", "People")}>
          <div className={ui.searchBox}><Search aria-hidden="true" /><Input type="search" aria-label={t("documents.vault_search", "Search people")} placeholder={t("documents.vault_search", "Search people")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          {people.error ? <ErrorState message={(people.error as Error).message} onRetry={() => void people.mutate()} />
            : !people.data ? <SkeletonRows rows={8} columns={2} />
            : people.data.data.length === 0 ? <EmptyState icon={Users} title={t("documents.vault_no_people", "No people match")} />
            : (
              <ul className={styles.list} role="list">
                {people.data.data.map((person) => (
                  <li key={person.employeeId}>
                    <button type="button" className={styles.rowTitle} aria-pressed={current?.id === person.employeeId} onClick={() => setSelected({ id: person.employeeId, name: person.name })}>
                      <Avatar name={person.name} size={24} />
                      <span>{person.name} <small>({person.employeeCode})</small></span>
                    </button>
                    <span className={styles.subheading}>
                      {t("documents.vault_count", "{count, plural, one {# document} other {# documents}}", { count: person.documentCount })}
                      {person.nearestExpiry ? ` · ${t("documents.vault_next_expiry", "next expiry {date}", { date: date(person.nearestExpiry) })}` : ""}
                    </span>
                    {person.expiredCount > 0 && <Badge tone="danger">{t("documents.vault_expired", "{count} expired", { count: person.expiredCount })}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          {meta && pages > 1 && (
            <nav className={ui.actions} aria-label={t("documents.vault_pages", "Pages")}>
              <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.previous", "Previous")}</Button>
              <span>{t("documents.vault_page_of", "Page {page} of {pages}", { page, pages })}</span>
              <Button size="sm" variant="ghost" icon={ChevronRight} disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("common.next", "Next")}</Button>
            </nav>
          )}
        </aside>
      )}
      <section className={cx(ui.panel, ui.fill, styles.content)} aria-label={t("documents.vault_documents", "Documents")}>
        {current ? <PersonDocuments employeeId={current.id} name={current.name} date={date} />
          : <EmptyState icon={Users} title={t("documents.vault_pick", "Choose a person")}>{t("documents.vault_pick_hint", "Their documents are listed here.")}</EmptyState>}
      </section>
    </div>
  );
}

function PersonDocuments({ employeeId, name, date }: { employeeId: string; name: string; date: (value: string | null) => string }) {
  const { t } = useTranslation();
  const folder = useEmployeeFolder(employeeId);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState<EmployeeDocument | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    const refresh = (event: Event) => { if ((event as CustomEvent<{ employeeId?: string }>).detail?.employeeId === employeeId) void folder.mutate(); };
    window.addEventListener(PEOPLE_CHANGED, refresh);
    return () => window.removeEventListener(PEOPLE_CHANGED, refresh);
  }, [employeeId, folder]);

  async function download(document: EmployeeDocument) {
    try { window.location.assign((await accessLink(employeeId, document.id, "download")).url); }
    catch (error) { setNotice({ tone: "danger", text: (error as Error).message }); }
  }

  if (folder.error instanceof VaultError && (folder.error.status === 403 || folder.error.status === 404)) return <Denied />;
  if (folder.error) return <ErrorState message={(folder.error as Error).message} onRetry={() => void folder.mutate()} />;
  if (!folder.data) return <SkeletonRows rows={5} columns={4} />;
  const { documents, canUpload } = folder.data;

  return (
    <>
      <div className={styles.toolbar}>
        <h2 className={styles.heading}><Avatar name={name} size={24} />{name}</h2>
        {canUpload && <Button variant="primary" icon={Upload} onClick={() => setUploading(true)}>{t("documents.vault_upload", "Upload")}</Button>}
      </div>
      {notice && <p role="status" className={cx(styles.notice, notice.tone === "danger" ? styles.noticeDanger : styles.noticeSuccess)}>{notice.text}</p>}
      {documents.length === 0 ? <EmptyState title={t("documents.vault_empty", "No documents filed yet")} /> : (
        <table className={ui.table}>
          <thead><tr>
            <th scope="col">{t("documents.vault_title", "Title")}</th><th scope="col">{t("documents.vault_category", "Category")}</th>
            <th scope="col">{t("documents.vault_expiry", "Expiry date")}</th><th scope="col">{t("documents.vault_size", "Size")}</th>
            <th scope="col">{t("documents.vault_added", "Added")}</th><th scope="col"><span className={styles.srOnly}>{t("documents.vault_actions", "Actions")}</span></th>
          </tr></thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>{document.title}</td>
                <td>{t(`documents.category_${document.category.toLowerCase()}`, document.category.replace("_", " "))}</td>
                <td>{document.expiryDate ? <Badge tone={document.expiryDate < new Date().toISOString().slice(0, 10) ? "danger" : "neutral"}>{date(document.expiryDate)}</Badge> : "—"}</td>
                <td>{formatBytes(document.fileSizeBytes)}</td>
                <td>{date(document.createdAt)}{document.uploadedBy ? ` · ${document.uploadedBy}` : ""}</td>
                <td className={ui.actions}>
                  <Button size="sm" variant="ghost" icon={Eye} onClick={() => setPreviewing(document)}>{t("documents.vault_view", "View")}</Button>
                  <Button size="sm" variant="ghost" icon={Download} onClick={() => void download(document)}>{t("documents.vault_download", "Download")}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {uploading && <VaultUploadModal employeeId={employeeId} employeeName={name} onClose={() => setUploading(false)} onUploaded={(title, alerts) => {
        setUploading(false);
        setNotice({ tone: "success", text: alerts ? t("documents.vault_uploaded", "\"{title}\" was filed.", { title }) : t("documents.vault_uploaded_alerts_later", "\"{title}\" was filed. Expiry alerts update in the next daily scan.", { title }) });
      }} />}
      {previewing && <VaultPreview employeeId={employeeId} document={previewing} onClose={() => setPreviewing(null)} onDownload={() => void download(previewing)} />}
    </>
  );
}
