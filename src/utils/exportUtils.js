import { csvCell, csvRows } from './csv';

/**
 * Generates and triggers a browser download for a CSV dataset.
 * Includes UTF-8 Byte Order Mark (\uFEFF) to ensure Excel and spreadsheet apps
 * render unicode characters (such as ₹ currency symbol and accented glyphs) correctly.
 * @param {string} filename Name of the downloaded file (e.g. 'employee_directory.csv')
 * @param {string[]} headers Array of column header labels
 * @param {Array<Array<any>>} dataRows Array of row arrays matching the headers
 */
/**
 * Checks whether the dataset contains exportable row records.
 * @param {Array<Array<any>>|Array<object>} dataRows
 * @returns {boolean}
 */
export function hasExportableData(dataRows) {
    return Boolean(Array.isArray(dataRows) && dataRows.length > 0);
}

export function downloadCSV(filename, headers, dataRows) {
    if (typeof window === 'undefined') return { success: false, reason: 'SSR' };
    if (!hasExportableData(dataRows)) {
        return { success: false, reason: 'NO_DATA', message: 'No data records available to export.' };
    }
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
    return { success: true };
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
    if (typeof window === 'undefined') return { success: false, reason: 'SSR' };
    if (!hasExportableData(dataRows)) {
        return { success: false, reason: 'NO_DATA', message: 'No data records available to export.' };
    }
    
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
/**
 * Opens a styled printable HTML document view ready for Ctrl+P / Save as PDF.
 * Formatted with official corporate letterhead, CIN, watermark, and print styles.
 * @param {string} title 
 * @param {Record<string, any>} metadata 
 * @param {string[]} headers 
 * @param {Array<Array<any>>} rows 
 */
export function downloadPrintableDocument(title, metadata = {}, headers = [], rows = []) {
    if (typeof window === 'undefined') return;

    const metaHtml = Object.entries(metadata)
        .map(([k, v]) => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px;">
                <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:0.05em;">${k}</div>
                <div style="font-size:13px; color:#0f172a; font-weight:600; margin-top:2px;">${v}</div>
            </div>
        `)
        .join('');

    const headersHtml = headers.map(h => `
        <th style="border:1px solid #cbd5e1; padding:10px 12px; background:#f1f5f9; color:#0f172a; font-size:12px; font-weight:700; text-align:left;">${h}</th>
    `).join('');

    const rowsHtml = rows.map((r, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            ${r.map(cell => `<td style="border:1px solid #e2e8f0; padding:9px 12px; font-size:12px; color:#1e293b;">${cell ?? '-'}</td>`).join('')}
        </tr>
    `).join('');

    const docHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 15mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    padding: 24px 32px;
                    color: #0f172a;
                    background: #ffffff;
                    margin: 0;
                    line-height: 1.5;
                    position: relative;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .no-print-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    padding: 12px 20px;
                    border-radius: 8px;
                    margin-bottom: 24px;
                }
                .no-print-bar button {
                    background: #0F6E5C;
                    color: #ffffff;
                    border: none;
                    padding: 8px 18px;
                    border-radius: 6px;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .no-print-bar button:hover {
                    background: #0b5346;
                }
                @media print {
                    .no-print-bar { display: none !important; }
                    body { padding: 0 !important; }
                }
                .doc-container {
                    max-width: 850px;
                    margin: 0 auto;
                    position: relative;
                }
                .watermark {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-32deg);
                    font-size: 40pt;
                    font-weight: 900;
                    color: rgba(15, 110, 92, 0.04);
                    letter-spacing: 0.1em;
                    pointer-events: none;
                    white-space: nowrap;
                    z-index: 0;
                    user-select: none;
                }
                .header-box {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 2.5px solid #10222f;
                    padding-bottom: 14px;
                    margin-bottom: 20px;
                }
                .brand-title {
                    font-size: 24px;
                    font-weight: 800;
                    color: #0F6E5C;
                    letter-spacing: 0.05em;
                    font-family: 'Times New Roman', Times, serif;
                }
                .brand-sub {
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 2px;
                }
                .office-info {
                    text-align: right;
                    font-size: 11px;
                    color: #64748b;
                    line-height: 1.4;
                }
                .doc-title {
                    font-size: 18px;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 0 0 16px 0;
                }
                .meta-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 12px;
                    margin-bottom: 24px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 24px;
                }
                .footer-box {
                    margin-top: 36px;
                    padding-top: 12px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: #94a3b8;
                }
            </style>
        </head>
        <body>
            <div class="no-print-bar">
                <div>
                    <strong style="color: #0F6E5C; font-size: 14px;">${title}</strong>
                    <div style="font-size: 12px; color: #64748b;">Ready to print or save • Select "Save as PDF" in destination to download</div>
                </div>
                <button onclick="window.print()">
                    🖨️ Save as PDF / Print
                </button>
            </div>
            <div class="doc-container">
                <div class="watermark">NUCLEUS ENTERPRISE HRMS</div>
                <div class="header-box">
                    <div>
                        <div class="brand-title">N U C L E U S</div>
                        <div class="brand-sub">Nucleus Technologies India Pvt Ltd • Corporate Human Resources</div>
                    </div>
                    <div class="office-info">
                        Registered Office: Manyata Tech Park, Bengaluru<br />
                        CIN: U72200KA2021PTC148892 • GSTIN: 29AABCN1234F1Z5
                    </div>
                </div>
                <h1 class="doc-title">${title}</h1>
                ${metaHtml ? `<div class="meta-grid">${metaHtml}</div>` : ''}
                ${headers.length > 0 ? `
                    <table>
                        <thead><tr>${headersHtml}</tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                ` : ''}
                <div class="footer-box">
                    <span>Nucleus Enterprise Solutions • System Authenticated Electronic Document</span>
                    <span>Generated on ${new Date().toLocaleString('en-IN')}</span>
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 350);
                };
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=950');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(docHtml);
        printWindow.document.close();
    } else {
        // Fallback to hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(docHtml);
        iframeDoc.close();
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        }, 500);
    }
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
