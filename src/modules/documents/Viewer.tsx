"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Download, ExternalLink, FileWarning, Trash2, X } from "lucide-react";
import { Badge, Button, Details, cx, theme, ui } from "@/design/redesign/ui";
import { formatBytes } from "@/lib/documents/file-types";
import { documentState, fileUrl, type LibraryDocument } from "./data";
import styles from "./Documents.module.css";

/** Opens a document in place: PDFs, images and text are shown; Word and Excel files are offered as a download. */

const SHOWN = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"];
const date = (value: string | null) => (value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);
const SOURCE = { hr: "Filed by HR", self: "Added by the employee", system: "Issued by payroll", record: "From the HR record" } as const;

export default function Viewer({ document, onClose, onDelete }: { document: LibraryDocument; onClose: () => void; onDelete?: () => void }) {
  // Payslips without a stored file are rendered as a PDF from their payroll run.
  const mime = document.mime ?? (document.isPayslip ? "application/pdf" : null);
  const shown = mime !== null && SHOWN.includes(mime);
  const state = documentState(document);
  const src = fileUrl(document.id);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(theme.scope, ui.backdrop, ui.dialogBackdrop)} />
        <Dialog.Popup className={cx(theme.scope, styles.viewer)}>
          <header className={styles.viewerHead}>
            <div className={styles.viewerTitles}>
              <Dialog.Title className={styles.viewerTitle}>{document.title}</Dialog.Title>
              <Dialog.Description className={styles.viewerSub}>{document.employeeName} · {document.type}</Dialog.Description>
            </div>
            <div className={styles.viewerActions}>
              <Button icon={Download} onClick={() => { window.location.href = fileUrl(document.id, true); }}>Download</Button>
              {shown && <Button variant="ghost" icon={ExternalLink} onClick={() => window.open(src, "_blank", "noopener")}>New tab</Button>}
              {onDelete && <Button variant="ghost" icon={Trash2} onClick={onDelete}>Delete</Button>}
              <Dialog.Close className={cx(ui.button, ui.ghost, ui.iconButton)} aria-label="Close"><X aria-hidden="true" /></Dialog.Close>
            </div>
          </header>
          <div className={styles.viewerBody}>
            <div className={styles.viewerStage}>
              {!shown ? (
                <div className={styles.viewerFallback}>
                  <FileWarning size={32} aria-hidden="true" />
                  <p>This file type cannot be shown in the browser.</p>
                  <Button variant="primary" icon={Download} onClick={() => { window.location.href = fileUrl(document.id, true); }}>Download {document.fileName ?? "the file"}</Button>
                </div>
              ) : mime!.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- a private, access-checked file; not an optimisable asset
                <img className={styles.viewerImage} src={src} alt={document.title} />
              ) : (
                <iframe className={styles.viewerFrame} src={src} title={document.title} />
              )}
            </div>
            <aside className={styles.viewerSide} aria-label="Document details">
              <Badge tone={state.tone}>{state.label}</Badge>
              <Details items={[
                { label: "Person", value: `${document.employeeName} (${document.employeeCode})` },
                { label: "Company", value: document.company },
                { label: "Department", value: document.department },
                { label: "Type", value: document.type },
                { label: "Number", value: document.code },
                { label: "Issued", value: date(document.issuedOn) },
                { label: "Expires", value: date(document.expiresOn) },
                { label: "Added", value: `${date(document.uploadedAt) ?? "—"}${document.uploadedBy ? ` by ${document.uploadedBy}` : ""}` },
                { label: "Source", value: SOURCE[document.source] },
                { label: "File", value: document.fileName ? `${document.fileName}${document.sizeBytes ? ` · ${formatBytes(document.sizeBytes)}` : ""}` : document.isPayslip ? "Generated from the payroll run" : null },
              ]} />
            </aside>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
