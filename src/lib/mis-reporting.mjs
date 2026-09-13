
import { readData } from '../services/workspace-data.mjs';
export const MIS_COLUMN_LABELS = readData("lib.mis-reporting", "MIS_COLUMN_LABELS_1");

const HEADER_MAP = readData("lib.mis-reporting", "HEADER_MAP_2");

const REQUIRED_FIELDS = readData("lib.mis-reporting", "REQUIRED_FIELDS_3");

function normalizedHeader(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsvLine(text) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

export function parseDelimitedCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return readData("lib.mis-reporting", "content_4");
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] ?? '']));
  });
  return { headers, rows };
}

function numberFrom(value) {
  const normalized = String(value ?? '').replace(/,/g, '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function currencyFrom(value) {
  const text = String(value ?? '');
  if (text.includes('₹')) return 'INR';
  if (text.includes('$')) return 'USD';
  if (text.includes('£')) return 'GBP';
  if (text.includes('€')) return 'EUR';
  return null;
}

function canonicalRow(raw) {
  const canonical = {};
  Object.entries(raw).forEach(([header, value]) => {
    const key = HEADER_MAP[normalizedHeader(header)];
    if (key) canonical[key] = String(value ?? '').trim();
  });
  return canonical;
}

function normalizedRisk(value) {
  const text = String(value || '');
  const band = text.match(/\b(low|medium|high)\b/i)?.[1];
  const percent = numberFrom(text.match(/\(([^)]+)\)/)?.[1] ?? '');
  return { band: band ? `${band[0].toUpperCase()}${band.slice(1).toLowerCase()}` : null, percent };
}

export function prepareMisImport(parsed, suppliedContext = {}) {
  const context = {
    periodStart: suppliedContext.periodStart || '',
    periodEnd: suppliedContext.periodEnd || '',
    asOfAt: suppliedContext.asOfAt || new Date().toISOString(),
    legalEntity: suppliedContext.legalEntity || '',
    location: suppliedContext.location || '',
    timezone: suppliedContext.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    sourceSystem: suppliedContext.sourceSystem || 'CSV import',
  };
  const accepted = [];
  const rejected = [];
  const seenIds = new Set();
  const rawRows = parsed?.rows || [];

  rawRows.forEach((raw, index) => {
    const row = canonicalRow(raw);
    const issues = [];
    REQUIRED_FIELDS.forEach((field) => {
      if (!row[field]) issues.push(`${MIS_COLUMN_LABELS[field]} is required.`);
    });
    if (row.empId && seenIds.has(row.empId)) issues.push('Duplicate employee ID in this file.');
    if (row.empId) seenIds.add(row.empId);

    const attendancePct = numberFrom(row.attendancePct);
    const overtimeHrs = numberFrom(row.overtimeHrs);
    const grossCtcAmount = numberFrom(row.grossCtc);
    const performanceRatingValue = numberFrom(String(row.performanceRating || '').split('/')[0]);
    const { band: flightRiskBand, percent: flightRiskScore } = normalizedRisk(row.flightRisk);
    const grossCtcCurrency = currencyFrom(row.grossCtc);

    if (attendancePct === null || attendancePct < 0 || attendancePct > 100) issues.push('Attendance % must be between 0 and 100.');
    if (overtimeHrs === null || overtimeHrs < 0) issues.push('Overtime (Hrs) must be zero or greater.');
    if (grossCtcAmount === null || grossCtcAmount < 0) issues.push('Gross CTC must contain a valid amount.');
    if (!grossCtcCurrency) issues.push('Gross CTC must include a recognised currency symbol.');
    if (performanceRatingValue === null || performanceRatingValue < 0 || performanceRatingValue > 5) issues.push('Performance Rating must use a value from 0 to 5.');
    if (!flightRiskBand) issues.push('Flight Risk must be Low, Medium or High.');
    if (flightRiskScore !== null && (flightRiskScore < 0 || flightRiskScore > 100)) issues.push('Flight Risk score must be between 0 and 100.');

    const normalized = {
      ...row,
      attendancePct,
      overtimeHrs,
      grossCtcAmount,
      grossCtcCurrency,
      performanceRatingValue,
      flightRiskBand,
      flightRiskScore,
      reportContext: context,
      sourceRowNumber: index + 2,
    };
    if (issues.length) rejected.push({ ...normalized, issues });
    else accepted.push(normalized);
  });

  return { context, accepted, rejected, total: rawRows.length };
}

export function summarizeMisRecords(records = []) {
  const validRecords = records.filter(Boolean);
  const total = validRecords.length;
  const averageAttendance = total ? Number((validRecords.reduce((sum, row) => sum + (Number(row.attendancePct) || 0), 0) / total).toFixed(2)) : 0;
  const totalOvertime = Number(validRecords.reduce((sum, row) => sum + (Number(row.overtimeHrs) || 0), 0).toFixed(2));
  const riskCounts = validRecords.reduce((counts, row) => ({ ...counts, [row.flightRiskBand || String(row.attritionRisk || '').split(' ')[0] || 'Unknown']: (counts[row.flightRiskBand || String(row.attritionRisk || '').split(' ')[0] || 'Unknown'] || 0) + 1 }), {});
  const currencies = new Set(validRecords.map((row) => row.grossCtcCurrency).filter(Boolean));
  return { total, averageAttendance, totalOvertime, highRiskCount: riskCounts.High || 0, riskCounts, currencyCount: currencies.size };
}

export function toReportCsv(records = [], columns = Object.keys(MIS_COLUMN_LABELS)) {
  const encode = (value) => {
    const raw = String(value ?? '');
    const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? "'" + raw : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const headers = columns.map((column) => MIS_COLUMN_LABELS[column] || column).join(',');
  const rows = records.map((record) => columns.map((column) => encode(record[column])).join(','));
  return [headers, ...rows].join('\n');
}

/** Client display policy only; production must also project fields server-side. */
export function redactMisExport(records, { canViewCompensation, canViewRisk }, redacted = 'Restricted') {
  return records.map(record => ({
    ...record,
    ...(!canViewCompensation ? { grossCtc: redacted, grossCtcCurrency: redacted } : {}),
    ...(!canViewRisk ? { flightRisk: redacted, flightRiskBand: redacted, attritionRisk: redacted } : {}),
  }));
}
