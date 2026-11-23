/**
 * Opens the document library in its modal from anywhere in the workspace: the Core HR menu, an
 * employee's profile, a quick action or an old /documents link. The modal host (DocumentsModal,
 * mounted once by AppWorkspace) listens for the event; a request made before the host is mounted
 * is kept and picked up when it mounts.
 */

export type DocumentsTarget = {
  /** Employee id (UUID) whose folder opens first. */
  employee?: string;
  /** Library document id to open in the viewer once that folder has loaded. */
  document?: string;
};

export const OPEN_DOCUMENTS_EVENT = "nucleus:open-documents";

let pending: DocumentsTarget | null = null;

export function openDocuments(target: DocumentsTarget = {}): void {
  if (typeof window === "undefined") return;
  pending = target;
  window.dispatchEvent(new CustomEvent<DocumentsTarget>(OPEN_DOCUMENTS_EVENT, { detail: target }));
}

/** The request waiting for the host, if any (cleared once read). */
export function takePendingDocuments(): DocumentsTarget | null {
  const value = pending;
  pending = null;
  return value;
}
