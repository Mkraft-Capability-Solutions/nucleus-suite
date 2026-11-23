import { describe, expect, it } from "vitest";
import { classify, documentAccess, mayDelete } from "@/lib/documents/access";
import { detectFileKind, formatBytes } from "@/lib/documents/file-types";
import { renderPdf } from "@/lib/documents/simple-pdf";
import { documentState } from "@/modules/documents/data";

const grants = (...keys: string[]) => (permission: string) => keys.includes(permission);

describe("document library access", () => {
  it("gives HR everyone's documents and everyone else their own", () => {
    expect(documentAccess(grants("document.read", "document.write", "document.delete"), "e1")).toEqual({ read: "all", write: "all", delete: "all", employeeId: "e1" });
    expect(documentAccess(grants("document.self.read", "document.self.write", "document.self.delete"), "e2")).toEqual({ read: "self", write: "self", delete: "self", employeeId: "e2" });
    // A self key means nothing without a linked employee record.
    expect(documentAccess(grants("document.self.read"), null)).toEqual({ read: null, write: null, delete: null, employeeId: null });
    expect(documentAccess(grants(), "e3").read).toBeNull();
  });

  it("lets a person delete only what they uploaded, and nobody delete a payslip", () => {
    const own = { employeeId: "e2", source: "self", uploadedBy: "e2", isPayslip: false };
    expect(mayDelete("self", own, "e2")).toBe(true);
    expect(mayDelete("self", { ...own, source: "hr", uploadedBy: "hr1" }, "e2")).toBe(false);
    expect(mayDelete("self", { ...own, employeeId: "e9", uploadedBy: "e9" }, "e2")).toBe(false);
    expect(mayDelete("all", { ...own, source: "record", uploadedBy: null }, "hr1")).toBe(true);
    expect(mayDelete("all", { ...own, isPayslip: true }, "hr1")).toBe(false);
    expect(mayDelete(null, own, "e2")).toBe(false);
  });

  it("classifies document types", () => {
    expect(["Passport", "Work permit / visa", "Offer letter", "Medical fitness certificate", "Degree certificate", "Something else"].map(classify))
      .toEqual(["identity", "immigration", "employment", "medical", "education", "other"]);
  });
});

describe("file checks", () => {
  const bytes = (text: string) => new Uint8Array(Buffer.from(text, "latin1"));
  it("recognises allowed files by their bytes, not their names", () => {
    expect(detectFileKind(bytes("%PDF-1.7 ..."), "a.pdf")?.mime).toBe("application/pdf");
    expect(detectFileKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), "x.bin")?.mime).toBe("image/png");
    expect(detectFileKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "a.jpg")?.mime).toBe("image/jpeg");
    expect(detectFileKind(bytes("RIFF\x00\x00\x00\x00WEBPVP8 "), "a.webp")?.mime).toBe("image/webp");
    expect(detectFileKind(bytes("PK\x03\x04....word/document.xml"), "a.docx")?.extension).toBe("docx");
    expect(detectFileKind(bytes("PK\x03\x04....xl/workbook.xml"), "a.xlsx")?.extension).toBe("xlsx");
    expect(detectFileKind(bytes("Hello, plain text\n"), "notes.txt")?.mime).toBe("text/plain");
  });

  it("refuses anything else, whatever it is called", () => {
    expect(detectFileKind(bytes("MZ\x90\x00 executable"), "invoice.pdf")).toBeNull();
    expect(detectFileKind(bytes("<svg onload=alert(1)>"), "logo.png")).toBeNull();
    expect(detectFileKind(bytes("PK\x03\x04 random zip"), "archive.zip")).toBeNull();
    expect(detectFileKind(bytes("binary\x00data"), "notes.txt")).toBeNull();
    expect(detectFileKind(new Uint8Array(), "empty.pdf")).toBeNull();
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("writes a PDF with a valid structure", () => {
    const pdf = Buffer.from(renderPdf({ heading: "Payslip 2026-10", subheading: "Tata – ₹ test", lines: [{ label: "Name", value: "Ananya Iyer" }], footer: "Generated" })).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const offset = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(offset, offset + 4)).toBe("xref");
    expect(detectFileKind(new Uint8Array(Buffer.from(pdf, "latin1")), "x.pdf")?.mime).toBe("application/pdf");
  });
});

describe("document state", () => {
  it("puts expiry before verification", () => {
    expect(documentState({ expiresOn: "2026-01-01", verification: "verified" }, "2026-11-22").label).toBe("Expired");
    expect(documentState({ expiresOn: "2026-12-15", verification: "verified" }, "2026-11-22").label).toBe("Expires soon");
    expect(documentState({ expiresOn: null, verification: "pending" }, "2026-11-22").label).toBe("Awaiting verification");
    expect(documentState({ expiresOn: null, verification: "available" }, "2026-11-22").label).toBe("Verified");
  });
});
