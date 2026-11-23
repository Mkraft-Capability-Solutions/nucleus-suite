/**
 * Who may do what in the document library, from the caller's permissions (pure; the service in
 * src/server/documents/library.ts applies it to every request).
 *   document.read / write / delete            everyone's documents (HR, administrators)
 *   document.self.read / write / delete       one's own documents only (needs a linked employee record)
 */

export type Reach = "all" | "self" | null;
export type DocumentAccess = { read: Reach; write: Reach; delete: Reach; employeeId: string | null };

/** What the caller may do, from a permission check (pure, unit-tested). */
export function documentAccess(can: (permission: string) => boolean, employeeId: string | null | undefined): DocumentAccess {
  const self = employeeId ?? null;
  const reach = (action: "read" | "write" | "delete"): Reach => (can(`document.${action}`) ? "all" : self && can(`document.self.${action}`) ? "self" : null);
  return { read: reach("read"), write: reach("write"), delete: reach("delete"), employeeId: self };
}

/** May this caller delete this document? (pure, unit-tested) */
export function mayDelete(reach: Reach, document: { employeeId: string; source: string | null; uploadedBy: string | null; isPayslip: boolean }, employeeId: string | null): boolean {
  if (document.isPayslip || !reach) return false;
  if (reach === "all") return true;
  return document.employeeId === employeeId && document.source === "self" && document.uploadedBy === employeeId;
}

/** The class a document type falls in (shown with the document, used to group in reports). */
export function classify(typeName: string): string {
  const name = typeName.toLowerCase();
  if (/aadhaar|pan card|passport|voter|driving|birth/.test(name)) return "identity";
  if (/visa|permit/.test(name)) return "immigration";
  if (/offer|appointment|relieving|experience|contract|letter/.test(name)) return "employment";
  if (/medical|fitness|health/.test(name)) return "medical";
  if (/degree|certificate|marksheet|education/.test(name)) return "education";
  if (/payslip|salary|form 16|tax/.test(name)) return "pay";
  return "other";
}
