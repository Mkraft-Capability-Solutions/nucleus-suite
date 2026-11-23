/**
 * The file types the document library accepts, recognised from the file's own bytes (its
 * signature), not from the name or the browser's claim. A file whose bytes do not match an allowed
 * type is refused, so an executable renamed to .pdf cannot be stored or served.
 */

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type FileKind = { mime: string; extension: string; label: string; previewable: boolean };

export const FILE_KINDS = {
  pdf: { mime: "application/pdf", extension: "pdf", label: "PDF", previewable: true },
  png: { mime: "image/png", extension: "png", label: "PNG image", previewable: true },
  jpeg: { mime: "image/jpeg", extension: "jpg", label: "JPEG image", previewable: true },
  webp: { mime: "image/webp", extension: "webp", label: "WebP image", previewable: true },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx", label: "Word document", previewable: false },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", label: "Excel workbook", previewable: false },
  doc: { mime: "application/msword", extension: "doc", label: "Word 97–2003 document", previewable: false },
  txt: { mime: "text/plain", extension: "txt", label: "Text file", previewable: true },
} as const satisfies Record<string, FileKind>;

/** What the upload control offers (the server decides from the bytes either way). */
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.doc,.txt";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);

/** The allowed type these bytes are, or null. `fileName` only separates Word from Excel inside a zip. */
export function detectFileKind(bytes: Uint8Array, fileName = ""): FileKind | null {
  if (bytes.length === 0) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return FILE_KINDS.pdf; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return FILE_KINDS.png;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return FILE_KINDS.jpeg;
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return FILE_KINDS.webp; // RIFF....WEBP
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return /\.doc$/i.test(fileName) ? FILE_KINDS.doc : null;
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // Office Open XML is a zip; the part names say which application wrote it.
    const head = latin1(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
    if (head.includes("word/")) return FILE_KINDS.docx;
    if (head.includes("xl/")) return FILE_KINDS.xlsx;
    if (/\.docx$/i.test(fileName) && head.includes("[Content_Types].xml")) return FILE_KINDS.docx;
    if (/\.xlsx$/i.test(fileName) && head.includes("[Content_Types].xml")) return FILE_KINDS.xlsx;
    return null;
  }
  // Plain text: valid UTF-8 with no control characters other than tab and line breaks.
  if (/\.(txt|csv)$/i.test(fileName) && isPlainText(bytes)) return FILE_KINDS.txt;
  return null;
}

function latin1(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index < bytes.length; index += 1) text += String.fromCharCode(bytes[index]!);
  return text;
}

function isPlainText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  for (const byte of sample) if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(sample); return true; } catch { return false; }
}

/** "1.2 MB", "340 KB". */
export function formatBytes(size: number | null | undefined): string {
  if (!size || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
