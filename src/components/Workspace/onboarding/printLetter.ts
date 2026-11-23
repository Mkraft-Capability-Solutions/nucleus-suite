/**
 * Opens a print view of a server-generated letter. The print document is plain black on
 * white from the browser defaults (no colour literals); all values are HTML-escaped.
 */

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function printLetter(args: { title: string; entityName: string; reference: string; content: string; hint: string }): void {
  if (typeof window === "undefined") return;
  const html = `<!doctype html><html lang="${escapeHtml(document.documentElement.lang || "en")}"><head><meta charset="utf-8"><title>${escapeHtml(args.title)}</title>
<style>@page{size:A4 portrait;margin:18mm 16mm}body{font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.65;margin:0}
header{border-block-end:2px solid;padding-block-end:10px;margin-block-end:22px;display:flex;justify-content:space-between;gap:12px}
.brand{font-size:18pt;font-weight:700;letter-spacing:.04em}.ref{font-size:9pt}.hint{font-family:system-ui,sans-serif;font-size:10pt;margin-block-end:16px}
pre{white-space:pre-wrap;font:inherit;margin:0}@media print{.hint{display:none}}</style></head>
<body>${args.hint ? `<p class="hint">${escapeHtml(args.hint)}</p>` : ""}<header><div class="brand">${escapeHtml(args.entityName)}</div><div class="ref">${escapeHtml(args.reference)}</div></header>
<pre>${escapeHtml(args.content)}</pre></body></html>`;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.inlineSize = "0";
  frame.style.blockSize = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc || !frame.contentWindow) { frame.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const view = frame.contentWindow;
  window.setTimeout(() => {
    view.focus();
    view.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 200);
}
