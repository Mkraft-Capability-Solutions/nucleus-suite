import { parseDelimitedCsv, prepareMisImport } from "@/lib/mis-reporting.mjs";
import type { LabelKey } from "./labels";

export type ImportCheck = {
  file: string;
  accepted: number;
  rejected: Array<{ row: number; issues: string[] }>;
};

export class ImportCheckError extends Error {
  constructor(readonly key: LabelKey) {
    super(key);
  }
}

/** Validates an MIS file client-side with the shared column rules; nothing is stored. */
export async function checkImportFile(file: File, period: { from: string; to: string }): Promise<ImportCheck> {
  if (file.size > 5 * 1024 * 1024) throw new ImportCheckError("importSizeError");
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new ImportCheckError("importTypeError");
  let parsed: { rows: Array<Record<string, unknown>> };
  if (/\.xlsx?$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    parsed = { rows: XLSX.utils.sheet_to_json(sheet, { defval: "" }) };
  } else {
    parsed = parseDelimitedCsv(await file.text());
  }
  if (parsed.rows.length > 10000) throw new ImportCheckError("importRowsError");
  const prepared = prepareMisImport(parsed, { periodStart: period.from, periodEnd: period.to }) as {
    accepted: unknown[];
    rejected: Array<{ sourceRowNumber: number; issues: string[] }>;
  };
  return {
    file: file.name,
    accepted: prepared.accepted.length,
    rejected: prepared.rejected.map((r) => ({ row: r.sourceRowNumber, issues: r.issues })),
  };
}
