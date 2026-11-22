/**
 * A minimal, dependency-free PDF writer for one-page record copies (a payslip, a document's digital
 * copy): a title, an optional subtitle and label/value rows in Helvetica. Text is limited to
 * Latin-1; anything outside it is replaced, so the file always opens.
 */

export type PdfLine = { label: string; value: string };
export type PdfPage = { heading: string; subheading?: string; lines: PdfLine[]; footer?: string; sections?: Array<{ title: string; lines: PdfLine[] }> };

const WIDTH = 595; // A4 in points
const HEIGHT = 842;
const MARGIN = 56;

/** Latin-1 only, with PDF string escapes. */
function pdfText(text: string): string {
  const latin = text
    .replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹/g, "Rs ")
    .replace(/…/g, "...").replace(/·/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  return latin.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > max) { if (current) lines.push(current); current = word; } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function renderPdf(page: PdfPage): Uint8Array {
  const ops: string[] = [];
  let y = HEIGHT - MARGIN;
  const text = (x: number, size: number, font: "F1" | "F2", value: string, grey = false) => {
    ops.push(`BT ${grey ? "0.4 0.42 0.47 rg" : "0.06 0.09 0.16 rg"} /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
  };
  // Header band
  ops.push(`0.16 0.47 0.84 rg ${MARGIN} ${y - 4} 6 34 re f`);
  text(MARGIN + 16, 20, "F2", page.heading);
  y -= 22;
  if (page.subheading) { text(MARGIN + 16, 11, "F1", page.subheading, true); }
  y -= 30;
  ops.push(`0.86 0.88 0.91 RG 0.8 w ${MARGIN} ${y + 10} m ${WIDTH - MARGIN} ${y + 10} l S`);
  const rows = (lines: PdfLine[]) => {
    for (const line of lines) {
      const wrapped = wrap(line.value || "-", 58);
      text(MARGIN, 10, "F1", line.label, true);
      wrapped.forEach((part, index) => { if (index) y -= 14; text(MARGIN + 170, 11, "F1", part); });
      y -= 22;
    }
  };
  rows(page.lines);
  for (const section of page.sections ?? []) {
    y -= 8;
    text(MARGIN, 12, "F2", section.title);
    y -= 20;
    rows(section.lines);
  }
  if (page.footer) {
    y = MARGIN;
    ops.push(`0.86 0.88 0.91 RG 0.8 w ${MARGIN} ${y + 16} m ${WIDTH - MARGIN} ${y + 16} l S`);
    for (const part of wrap(page.footer, 100)) { text(MARGIN, 8, "F1", part, true); y -= 11; }
  }
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${latin1Length(content)} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(latin1Length(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = latin1Length(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(body.length);
  for (let index = 0; index < body.length; index += 1) bytes[index] = body.charCodeAt(index) & 0xff;
  return bytes;
}

function latin1Length(text: string): number {
  return text.length;
}
