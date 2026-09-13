import { csvCell, csvRows } from './csv';

/**
 * Generates and triggers a browser download for a CSV dataset.
 * @param {string} filename Name of the downloaded file (e.g. 'employee_directory.csv')
 * @param {string[]} headers Array of column header labels
 * @param {Array<Array<any>>} dataRows Array of row arrays matching the headers
 */
export function downloadCSV(filename, headers, dataRows) {
    if (typeof window === 'undefined') return;
    const formattedRows = [headers, ...dataRows];
    const csvContent = csvRows(formattedRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Downloads a pre-formatted CSV template file with sample row for bulk onboarding / import.
 * @param {string} filename Name of template file
 * @param {string[]} headers Header row column names
 * @param {Array<any>} sampleRow Optional sample row values
 */
export function downloadCSVTemplate(filename, headers, sampleRow = []) {
    const rows = sampleRow.length ? [sampleRow] : [];
    downloadCSV(filename, headers, rows);
}
