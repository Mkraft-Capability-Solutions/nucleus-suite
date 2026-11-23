"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import ModuleNotEnabled from "@/components/Entitlements/ModuleNotEnabled";
import { useAuth } from "@/context/AuthContext";
import { cx, theme, ui } from "@/design/redesign/ui";
import { entitlementForNavItem } from "@/lib/entitlements/routes";
import { entitlementLabel } from "@/lib/entitlements/tree";
import DocumentsWorkspace from "./DocumentsWorkspace";
import { OPEN_DOCUMENTS_EVENT, takePendingDocuments, type DocumentsTarget } from "./launcher";
import styles from "./Documents.module.css";

/**
 * The document library as a modal over the current screen (95% of the viewport on a desktop, the
 * whole screen on a phone). Mounted once by AppWorkspace; opened with `openDocuments()` from the
 * Core HR menu, an employee's profile, quick actions or an old /documents link. Each opening starts
 * fresh, in the folder (and document) it was asked for.
 */

type AuthShape = { isEntitled: (key: string) => boolean; tenantAccess?: { tenant?: { name?: string } } | null };

const ENTITLEMENT = entitlementForNavItem("document_vault");

export default function DocumentsModal() {
  const { isEntitled, tenantAccess } = useAuth() as unknown as AuthShape;
  // The last request stays rendered while the modal fades out; `open` decides whether it shows.
  const [request, setRequest] = useState<{ target: DocumentsTarget; key: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = (target: DocumentsTarget) => {
      setRequest((current) => ({ target, key: (current?.key ?? 0) + 1 }));
      setOpen(true);
    };
    const onOpen = () => { const target = takePendingDocuments(); if (target) show(target); };
    // A request made before this host mounted (for example an old /documents link on first load).
    onOpen();
    window.addEventListener(OPEN_DOCUMENTS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DOCUMENTS_EVENT, onOpen);
  }, []);

  const organisation = tenantAccess?.tenant?.name;
  const allowed = !ENTITLEMENT || isEntitled(ENTITLEMENT);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) setOpen(false); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(theme.scope, ui.backdrop, styles.libraryBackdrop)} />
        <Dialog.Popup className={cx(theme.scope, styles.libraryModal)}>
          {request && (allowed ? (
            <DocumentsWorkspace key={request.key} inModal organisation={organisation} initialEmployee={request.target.employee} initialDocument={request.target.document} />
          ) : (
            <div className={styles.libraryBlocked}>
              <Dialog.Title className={styles.srOnly}>Documents</Dialog.Title>
              <Dialog.Close className={cx(ui.button, ui.ghost, ui.iconButton, styles.libraryBlockedClose)} aria-label="Close documents"><X aria-hidden="true" /></Dialog.Close>
              <ModuleNotEnabled label={ENTITLEMENT ? entitlementLabel(ENTITLEMENT) : "Documents"} tenantName={organisation} onBack={undefined} />
            </div>
          ))}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
