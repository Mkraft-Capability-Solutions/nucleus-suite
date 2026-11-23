"use client";

import { useState, type FormEvent } from "react";
import { Download, FileText, Plus, UploadCloud } from "lucide-react";
import styles from "./CMSModal.module.css";
import { CMS_NS as NS } from "./CMSAnnouncementsTab";
import { failureMessage, fieldErrors, formatDate, sendJson, useSubmitKey, useT } from "./engagement-client";

/**
 * Policy repository tab. Lists POLICY documents from GET /api/v1/documents/policies and uploads a PDF to the same
 * route (policy.manage, Idempotency-Key). Download fetches the stored file through
 * /api/v1/documents/{id}/download and surfaces the server's reason (for example, scan pending) on failure.
 */

export type PolicyDoc = { id: string; title: string; code: string | null; category: string; versionTag: string | null; department: string; effectiveFrom: string | null; fileName: string | null; sizeBytes: number | null; scan: string; uploadedAt: string };

type Draft = { title: string; code: string; category: string; versionTag: string; department: string; effectiveFrom: string };
type Errors = Partial<Record<keyof Draft | "file", string>>;

const CATEGORY_FALLBACK: Record<string, string> = {
  compliance_legal: "Compliance & legal", leave_attendance: "Leave & attendance", finance_operations: "Finance & operations",
  legal_safety: "Legal & safety (POSH)", benefits_wellness: "Benefits & wellness", general: "General",
};

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function CMSPoliciesTab({ items, canManage, categories, departments, maxBytes, onChanged, onToast }: {
  items: PolicyDoc[];
  canManage: boolean;
  categories: string[];
  departments: string[];
  maxBytes: number;
  onChanged: () => Promise<void>;
  onToast: (title: string, message: string, tone: "success" | "error") => void;
}) {
  const { t, locale } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<Draft>({ title: "", code: "", category: categories[0] ?? "general", versionTag: "", department: "all", effectiveFrom: today });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { keyFor, reset } = useSubmitKey();
  const categoryLabel = (code: string) => t(`${NS}.policy_category_${code}`, CATEGORY_FALLBACK[code] ?? code);
  const sizeLabel = (bytes: number | null) => (bytes === null ? "" : new Intl.NumberFormat(locale || undefined, { style: "unit", unit: "kilobyte", maximumFractionDigits: 1 }).format(bytes / 1024));

  const validate = (): Errors => {
    const found: Errors = {};
    if (draft.title.trim().length < 3) found.title = t(`${NS}.err_policy_title`, "Enter a policy title of at least 3 characters.");
    if (draft.code && !/^[A-Za-z0-9-]{2,40}$/.test(draft.code.trim())) found.code = t(`${NS}.err_policy_code`, "Use 2-40 letters, digits or hyphens.");
    if (!draft.versionTag.trim()) found.versionTag = t(`${NS}.err_version`, "Enter a version tag.");
    if (!draft.effectiveFrom) found.effectiveFrom = t(`${NS}.err_effective`, "Enter the effective date.");
    if (!file) found.file = t(`${NS}.err_file`, "Attach the policy PDF.");
    return found;
  };

  const pick = (selected: File | undefined, input: HTMLInputElement) => {
    if (!selected) return;
    if (selected.type !== "application/pdf" || selected.size > maxBytes) {
      setErrors({ ...errors, file: t(`${NS}.err_file_type`, "Upload a PDF of at most {size}.", { size: sizeLabel(maxBytes) }) });
      input.value = "";
      return;
    }
    setErrors({ ...errors, file: undefined });
    setFile(selected);
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first || !file) {
      document.getElementById(`cms-pol-${first}`)?.focus();
      return;
    }
    setBusy("upload");
    setFormError(null);
    const contentBase64 = await toBase64(file).catch(() => "");
    if (!contentBase64) {
      setBusy(null);
      setFormError(t(`${NS}.err_file_read`, "The file could not be read."));
      return;
    }
    const payload = {
      title: draft.title.trim(), code: draft.code.trim() || undefined, category: draft.category, versionTag: draft.versionTag.trim(),
      department: draft.department, effectiveFrom: draft.effectiveFrom, fileName: file.name, mimeType: "application/pdf", contentBase64,
    };
    const result = await sendJson("POST", "/api/v1/documents/policies", payload, { idempotencyKey: keyFor({ ...payload, contentBase64: `${file.name}:${file.size}:${file.lastModified}` }) });
    setBusy(null);
    if (!result.ok) {
      setErrors(fieldErrors(result.details) as Errors);
      setFormError(failureMessage(result, t, t(`${NS}.text_upload_failed`, "The policy could not be uploaded.")));
      return;
    }
    reset();
    setDraft({ ...draft, title: "", code: "", versionTag: "" });
    setFile(null);
    onToast(t(`${NS}.text_uploaded_title`, "Policy uploaded"), t(`${NS}.text_uploaded_body`, "{title} is stored and awaiting its security scan.", { title: payload.title }), "success");
    await onChanged();
  };

  const download = async (doc: PolicyDoc) => {
    setBusy(doc.id);
    try {
      const response = await fetch(`/api/v1/documents/${encodeURIComponent(doc.id)}/download`, { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        onToast(t(`${NS}.text_download_failed`, "Download unavailable"), body?.error?.message ?? t(`${NS}.text_download_failed`, "Download unavailable"), "error");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.fileName ?? `${doc.title}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      onToast(t(`${NS}.text_download_failed`, "Download unavailable"), t("components.Workspace.common.text_network_error", "The server could not be reached. Try again."), "error");
    } finally {
      setBusy(null);
    }
  };

  const err = (field: keyof Errors) => errors[field] && <span id={`cms-pol-${field}-error`} className={styles.fieldError} role="alert">{errors[field]}</span>;

  return (
    <>
      {canManage ? (
        <form onSubmit={upload} className={styles.stack} noValidate>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-pol-title">{t(`${NS}.text_policy_title`, "Policy title")} *</label>
              <input id="cms-pol-title" className={styles.input} value={draft.title} maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-required="true" aria-invalid={Boolean(errors.title)} />
              {err("title")}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-pol-code">{t(`${NS}.text_policy_code`, "Policy code (optional)")}</label>
              <input id="cms-pol-code" className={styles.input} value={draft.code} maxLength={40} onChange={(event) => setDraft({ ...draft, code: event.target.value })} aria-invalid={Boolean(errors.code)} />
              {err("code")}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-pol-category">{t(`${NS}.text_policy_category`, "Policy category")} *</label>
              <select id="cms-pol-category" className={styles.select} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                {categories.map((code) => <option key={code} value={code}>{categoryLabel(code)}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-pol-versionTag">{t(`${NS}.text_version_tag`, "Version tag")} *</label>
              <input id="cms-pol-versionTag" className={styles.input} value={draft.versionTag} maxLength={20} onChange={(event) => setDraft({ ...draft, versionTag: event.target.value })} placeholder={t(`${NS}.text_version_placeholder`, "For example: v2.1")} aria-required="true" aria-invalid={Boolean(errors.versionTag)} />
              {err("versionTag")}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-pol-department">{t(`${NS}.text_department`, "Department")}</label>
              <select id="cms-pol-department" className={styles.select} value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })}>
                <option value="all">{t(`${NS}.text_all_departments`, "All departments")}</option>
                {departments.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-pol-effectiveFrom">{t(`${NS}.text_effective_from`, "Effective from")} *</label>
              <input id="cms-pol-effectiveFrom" type="date" className={styles.input} value={draft.effectiveFrom} onChange={(event) => setDraft({ ...draft, effectiveFrom: event.target.value })} aria-required="true" aria-invalid={Boolean(errors.effectiveFrom)} />
              {err("effectiveFrom")}
            </div>
            <div className={`${styles.formGroup} ${styles.fullWidth ?? ""}`}>
              <label className={styles.uploadDropzone}>
                <input id="cms-pol-file" type="file" accept="application/pdf,.pdf" aria-label={t(`${NS}.text_select_pdf`, "Select policy PDF")} onChange={(event) => pick(event.target.files?.[0], event.target)} />
                <UploadCloud size={32} className={styles.uploadIcon} aria-hidden="true" />
                <p>{file ? <strong className={styles.attached}>{t(`${NS}.text_attached`, "Attached: {name}", { name: file.name })}</strong> : t(`${NS}.text_drop_pdf`, "Click to choose the policy PDF")}</p>
                <span>{t(`${NS}.text_pdf_limits`, "PDF only, up to {size}. Files are scanned before anyone can download them.", { size: sizeLabel(maxBytes) })}</span>
              </label>
              {err("file")}
            </div>
          </div>
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <div className={styles.actionsEnd}>
            <button type="submit" className={styles.btnPrimary} disabled={busy === "upload"}>
              <Plus size={16} aria-hidden="true" />{busy === "upload" ? t(`${NS}.text_uploading`, "Uploading…") : t(`${NS}.text_upload`, "Publish policy to repository")}
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.note}>{t(`${NS}.text_policy_read_only`, "Uploading policies needs the policy management permission.")}</p>
      )}

      <div className={styles.sectionDivider}>
        <h4 className={styles.existingTitle}><FileText size={16} aria-hidden="true" />{t(`${NS}.text_repository_count`, "Policy repository ({count})", { count: items.length })}</h4>
        {items.length === 0 && <p className={styles.note}>{t(`${NS}.text_no_policies`, "No policy documents have been uploaded yet.")}</p>}
        <div className={styles.itemsList}>
          {items.map((doc) => (
            <div key={doc.id} className={styles.listItem}>
              <div className={styles.itemLeft}>
                <div className={styles.docIcon} aria-hidden="true">{t(`${NS}.text_pdf`, "PDF")}</div>
                <div className={styles.itemInfo}>
                  <h4>{doc.title}{doc.versionTag && <span className={styles.versionTag}>{doc.versionTag}</span>}{doc.scan !== "available" && <span className={styles.scanBadge}>{doc.scan === "pending_scan" ? t(`${NS}.text_scan_pending`, "Scan pending") : doc.scan === "quarantined" ? t(`${NS}.text_scan_quarantined`, "Quarantined") : t(`${NS}.text_scan_unknown`, "Not scanned")}</span>}</h4>
                  <p>{[categoryLabel(doc.category), doc.department === "all" ? t(`${NS}.text_all_departments`, "All departments") : doc.department, doc.effectiveFrom ? t(`${NS}.text_effective_on`, "Effective {date}", { date: formatDate(doc.effectiveFrom, locale) }) : null, sizeLabel(doc.sizeBytes) || null].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => void download(doc)} disabled={busy === doc.id}>
                  <Download size={14} aria-hidden="true" />{t(`${NS}.text_download`, "Download")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
