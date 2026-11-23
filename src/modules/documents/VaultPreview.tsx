"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, X } from "lucide-react";
import { Button, ErrorState, SkeletonRows, cx, theme, ui } from "@/design/redesign/ui";
import { useTranslation } from "@/context/I18nContext";
import { accessLink, type EmployeeDocument } from "./people-data";
import styles from "./Documents.module.css";

/** Inline preview of a vault document (PDF or image) through a 5-minute signed link. */
export default function VaultPreview({ employeeId, document, onClose, onDownload }: { employeeId: string; document: EmployeeDocument; onClose: () => void; onDownload: () => void }) {
  const { t } = useTranslation();
  const [state, setState] = useState<{ url: string | null; error: string | null; attempt: number }>({ url: null, error: null, attempt: 0 });

  // Fetching the signed link is a side effect tied to opening the dialog (and to retry).
  useEffect(() => {
    let live = true;
    accessLink(employeeId, document.id, "view")
      .then((link) => { if (live) setState((current) => ({ ...current, url: link.url, error: null })); })
      .catch((error: Error) => { if (live) setState((current) => ({ ...current, url: null, error: error.message })); });
    return () => { live = false; };
  }, [employeeId, document.id, state.attempt]);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(theme.scope, ui.backdrop, ui.dialogBackdrop)} />
        <Dialog.Popup className={cx(theme.scope, styles.viewer)}>
          <header className={styles.viewerHead}>
            <div className={styles.viewerTitles}>
              <Dialog.Title className={styles.viewerTitle}>{document.title}</Dialog.Title>
              <Dialog.Description className={styles.viewerSub}>{document.fileName}</Dialog.Description>
            </div>
            <div className={styles.viewerActions}>
              <Button icon={Download} onClick={onDownload}>{t("documents.vault_download", "Download")}</Button>
              <Dialog.Close className={cx(ui.button, ui.ghost, ui.iconButton)} aria-label={t("common.close", "Close")}><X aria-hidden="true" /></Dialog.Close>
            </div>
          </header>
          <div className={styles.viewerStage}>
            {state.error ? <ErrorState message={state.error} onRetry={() => setState((current) => ({ ...current, error: null, attempt: current.attempt + 1 }))} />
              : !state.url ? <SkeletonRows rows={4} columns={1} />
              : document.mimeType.startsWith("image/")
                // eslint-disable-next-line @next/next/no-img-element -- a private, signed, short-lived file; not an optimisable asset
                ? <img className={styles.viewerImage} src={state.url} alt={document.title} />
                : <iframe className={styles.viewerFrame} src={state.url} title={document.title} />}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
