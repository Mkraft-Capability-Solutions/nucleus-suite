const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
if (!sourcePath || !outputPath) throw new Error('Usage: node build-demo-workbook-data.cjs <source.xlsx> <output.json>');

const workbook = XLSX.readFile(sourcePath, { cellDates: false });
const sheets = {};
for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  sheets[name] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ source: path.basename(sourcePath), sheets })}\n`);
