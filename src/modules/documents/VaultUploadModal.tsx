"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Alert, Button, Drawer, Field, Input, Select } from "@/design/redesign/ui";
import { useTranslation } from "@/context/I18nContext";
import { MAX_DOCUMENT_BYTES, formatBytes } from "@/lib/documents/file-types";
import { CATEGORIES, VAULT_ACCEPT, VaultError, uploadToVault, type DocumentCategory } from "./people-data";
import styles from "./Documents.module.css";

const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

/** Upload to one person's vault: category, optional expiry and title, one PDF or image (checked again by its bytes on the server). */
export default function VaultUploadModal({ employeeId, employeeName, onClose, onUploaded }: {
  employeeId: string; employeeName: string; onClose: () => void; onUploaded: (title: string, alertsRecomputed: boolean) => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [title, setTitle] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per modal session, so a retried submit is not filed twice.
  const idempotencyKey = useRef(crypto.randomUUID());
  const today = new Date().toISOString().slice(0, 10);

  function choose(next: File | null) {
    setErrors((current) => ({ ...current, file: "" }));
    if (!next) return;
    if (!ALLOWED.includes(next.type)) { setErrors((current) => ({ ...current, file: t("documents.vault_file_type", "Upload a PDF, PNG, JPEG or WebP file.") })); return; }
    if (next.size > MAX_DOCUMENT_BYTES) { setErrors((current) => ({ ...current, file: t("documents.vault_file_size", "Files are limited to 10 MB.") })); return; }
    setFile(next);
  }

  async function submit() {
    const next: Record<string, string> = {};
    if (!category) next.category = t("documents.vault_category_required", "Choose a category.");
    if (!file) next.file = t("documents.vault_file_required", "Choose a file.");
    if (expiryDate && expiryDate < today) next.expiryDate = t("documents.vault_expiry_past", "The expiry date has already passed.");
    setErrors(next);
    if (Object.keys(next).length || !category || !file) return;
    setBusy(true); setFailure(null);
    try {
      const created = await uploadToVault(employeeId, { category, title, expiryDate: expiryDate || undefined, file }, idempotencyKey.current);
      onUploaded(created.title, created.alertsRecomputed);
    } catch (error) {
      const fieldErrors: Record<string, string> = {};
      if (error instanceof VaultError) for (const detail of error.details) fieldErrors[detail.field === "contentBase64" || detail.field === "fileName" ? "file" : detail.field] = error.message;
      setErrors(fieldErrors);
      setFailure((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <Drawer open onOpenChange={(open) => { if (!open && !busy) onClose(); }} title={t("documents.vault_upload_title", "Upload a document")}
      description={t("documents.vault_upload_for", "Filed in {name}'s folder.", { name: employeeName })}
      footer={<><Button onClick={onClose} disabled={busy}>{t("common.cancel", "Cancel")}</Button><Button variant="primary" icon={Upload} loading={busy} onClick={() => void submit()}>{t("documents.vault_upload", "Upload")}</Button></>}>
      <div className={styles.form}>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <Field id="vault-category" label={t("documents.vault_category", "Category")} required error={errors.category || null}>
          <Select id="vault-category" value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory | "")}>
            <option value="">{t("documents.vault_choose_category", "Choose a category")}</option>
            {CATEGORIES.map((entry) => <option key={entry} value={entry}>{t(`documents.category_${entry.toLowerCase()}`, entry.replace("_", " "))}</option>)}
          </Select>
        </Field>
        <Field id="vault-file" label={t("documents.vault_file", "File")} required error={errors.file || null} hint={file ? `${file.name} · ${formatBytes(file.size)}` : t("documents.vault_file_hint", "PDF, PNG, JPEG or WebP; up to 10 MB.")}>
          <Input id="vault-file" type="file" accept={VAULT_ACCEPT} onChange={(event) => choose(event.target.files?.[0] ?? null)} />
        </Field>
        <Field id="vault-title" label={t("documents.vault_title", "Title")}>
          <Input id="vault-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field id="vault-expiry" label={t("documents.vault_expiry", "Expiry date")} error={errors.expiryDate || null} hint={t("documents.vault_expiry_hint", "Passports, visas and permits: expiry alerts use this.")}>
          <Input id="vault-expiry" type="date" min={today} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}
