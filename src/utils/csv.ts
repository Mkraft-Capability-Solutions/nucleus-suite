/** Quote RFC 4180 cells and neutralize spreadsheet formula prefixes in user-entered text. */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function csvRows(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
