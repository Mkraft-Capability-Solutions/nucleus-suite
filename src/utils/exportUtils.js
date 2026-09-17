import { csvCell, csvRows } from './csv';

/**
 * Generates and triggers a browser download for a CSV dataset.
 * Includes UTF-8 Byte Order Mark (\uFEFF) to ensure Excel and spreadsheet apps
 * render unicode characters (such as ₹ currency symbol and accented glyphs) correctly.
 * @param {string} filename Name of the downloaded file (e.g. 'employee_directory.csv')
 * @param {string[]} headers Array of column header labels
 * @param {Array<Array<any>>} dataRows Array of row arrays matching the headers
 */
export function downloadCSV(filename, headers, dataRows) {
    if (typeof window === 'undefined') return;
    const formattedRows = [headers, ...dataRows];
    const csvContent = csvRows(formattedRows);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
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
 * Generates and triggers a browser download for an Excel-compatible spreadsheet (.xlsx / .xml).
 * Formats columns, types, and styles using XML SpreadsheetML format which opens directly
 * in Microsoft Excel and LibreOffice Calc without file-type mismatch or corruption warnings.
 * @param {string} filename Name of the downloaded file (e.g. 'workforce_report.xlsx')
 * @param {string[]} headers Array of column header labels
 * @param {Array<Array<any>>} dataRows Array of row arrays matching the headers
 * @param {string} [sheetName='Workforce Data'] Sheet title in workbook
 */
export function downloadXLSX(filename, headers, dataRows, sheetName = 'Workforce Data') {
    if (typeof window === 'undefined') return;
    
    const escapeXml = (str) => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const headerCells = headers.map(h => 
        `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
    ).join('');

    const bodyRows = dataRows.map(row => {
        const cells = row.map(cell => {
            if (cell === null || cell === undefined) {
                return `<Cell><Data ss:Type="String">—</Data></Cell>`;
            }
            if (typeof cell === 'number' && Number.isFinite(cell)) {
                return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
            }
            const str = String(cell);
            if (/^-?\d+(\.\d+)?$/.test(str.trim()) && !str.startsWith('0') && str.length < 15) {
                return `<Cell><Data ss:Type="Number">${str.trim()}</Data></Cell>`;
            }
            return `<Cell><Data ss:Type="String">${escapeXml(str)}</Data></Cell>`;
        }).join('');
        return `<Row>${cells}</Row>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   <Row ss:Height="24">${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

    const finalName = filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.xml') 
        ? filename 
        : `${filename}.xlsx`;
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', finalName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Downloads arbitrary file content (text, JSON, XML, PDF, etc.)
 * @param {string} filename 
 * @param {string|Blob} content 
 * @param {string} mimeType 
 */
export function downloadFile(filename, content, mimeType = 'text/plain;charset=utf-8;') {
    if (typeof window === 'undefined') return;
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Downloads a JSON dataset file formatted with indentation.
 * @param {string} filename 
 * @param {any} data 
 */
export function downloadJSON(filename, data) {
    const jsonStr = JSON.stringify(data, null, 2);
    downloadFile(filename.endsWith('.json') ? filename : `${filename}.json`, jsonStr, 'application/json');
}

/**
 * Opens a styled printable HTML document view ready for Ctrl+P / Save as PDF
 * @param {string} title 
 * @param {Record<string, any>} metadata 
 * @param {string[]} headers 
 * @param {Array<Array<any>>} rows 
 */
export function downloadPrintableDocument(title, metadata = {}, headers = [], rows = []) {
    if (typeof window === 'undefined') return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        // Fallback to CSV if popup blocker prevents new window
        downloadCSV(`${title.replace(/\s+/g, '_').toLowerCase()}.csv`, headers, rows);
        return;
    }

    const metaHtml = Object.entries(metadata)
        .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
        .join('');

    const headersHtml = headers.map(h => `<th style="border:1px solid #cbd5e1;padding:8px;background:#f1f5f9;text-align:left;">${h}</th>`).join('');
    const rowsHtml = rows.map(r => `<tr>${r.map(cell => `<td style="border:1px solid #e2e8f0;padding:8px;">${cell ?? '-'}</td>`).join('')}</tr>`).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; }
                h1 { font-size: 20px; margin-bottom: 8px; }
                .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; font-size: 13px; color: #475569; background: #f8fafc; padding: 12px; border-radius: 6px; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h1>${title}</h1>
                <button onclick="window.print()" style="padding:6px 14px; background:#4f46e5; color:white; border:none; border-radius:4px; cursor:pointer;">Print / Save PDF</button>
            </div>
            ${metaHtml ? `<div class="meta">${metaHtml}</div>` : ''}
            <table>
                <thead><tr>${headersHtml}</tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
}

/**
 * Downloads a pre-formatted CSV template file with sample row for bulk onboarding / import.
 * @param {string} filename Name of template file
 * @param {string[]} headers Header row column names
 * @param {Array<any>} sampleRow Optional sample row values
 */
export function downloadCSVTemplate(filename, headers, sampleRow = []) {
    const rows = sampleRow && sampleRow.length ? [sampleRow] : [];
    downloadCSV(filename, headers, rows);
}
