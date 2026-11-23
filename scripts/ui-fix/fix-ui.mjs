#!/usr/bin/env node
/**
 * UI/UX fix script (dry run by default).
 *
 * Applies only mechanical, behaviour-preserving transforms and reports everything that needs a
 * per-screen decision. Usage:
 *   node scripts/ui-fix/fix-ui.mjs                 # dry run, prints + writes scripts/ui-fix/REPORT.md
 *   node scripts/ui-fix/fix-ui.mjs --apply         # writes the transforms to disk
 *   node scripts/ui-fix/fix-ui.mjs --apply --only=avatar,dialog
 *
 * Transforms (--only ids):
 *   avatar    External ui-avatars.com URLs -> offline initials SVG via src/lib/avatar.ts
 *   hex       Exact hex values that equal a light-mode token -> var(--token) (style/colour lines only)
 *   clickable <div|span onClick> -> adds role="button", tabIndex, Enter/Space key handling
 *   dialog    Modal panels (styles.modal + stopPropagation) -> role="dialog" aria-modal="true"
 *   breakpoint max-width 639px -> 640px (the two were one pixel apart)
 *
 * Excluded from transforms: chart code (ECharts needs resolved colours, not var()), the landing
 * feature (its own design system), API routes, tests.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");
const REPORT = path.join(ROOT, "scripts/ui-fix/REPORT.md");
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = new Set(onlyArg ? onlyArg.slice(7).split(",") : ["avatar", "hex", "clickable", "dialog", "breakpoint"]);

const EXCLUDE = /node_modules|[\\/]\.next[\\/]|[\\/]src[\\/]app[\\/]api[\\/]|\.test\.|\.spec\.|[\\/]features[\\/]landing[\\/]|[\\/]Charts?[\\/]|theme/i;
const EXTS = /\.(js|jsx|ts|tsx|css)$/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.test(e.name) && !EXCLUDE.test(p)) out.push(p);
  }
  return out;
}

// ---- tokens: light-mode hex values from the first :root block of globals.css (white excluded:
// --surface flips to dark in dark mode and would turn white button text dark).
function loadTokens() {
  const css = fs.readFileSync(path.join(SRC, "app/(suite)/globals.css"), "utf8");
  const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  const map = new Map();
  for (const m of root.matchAll(/--([a-zA-Z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    const hex = m[2].toLowerCase();
    if (hex === "#ffffff" || map.has(hex)) continue;
    map.set(hex, m[1]);
  }
  return map;
}
const TOKENS = loadTokens();
const COLOUR_LINE = /style=|\b(color|background|backgroundColor|borderColor|border|fill|stroke|boxShadow)\s*:/;

// ---- transforms ------------------------------------------------------------------------------
const AVATAR_RE = /https:\/\/ui-avatars\.com\/api\/\?name=\$\{encodeURIComponent\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)\}[^`]*/g;

function transformAvatar(text) {
  let n = 0;
  const out = text.replace(AVATAR_RE, (_m, expr) => { n++; return `\${avatarDataUri(${expr})}`; });
  if (n && !/import\s*\{[^}]*avatarDataUri[^}]*\}\s*from/.test(out)) {
    return { text: addImport(out, `import { avatarDataUri } from "@/lib/avatar";`), n };
  }
  return { text: out, n };
}

// A custom-property declaration (--name: value) defines a token. Its value must stay literal
// so that a dark-mode override keeps its meaning, so such lines are never rewritten.
const DECLARES_TOKEN = /--[a-zA-Z0-9-]+\s*:/;

function transformHex(text, file) {
  if (file.endsWith(".css")) {
    let n = 0;
    const out = text.split("\n").map((line) => {
      if (DECLARES_TOKEN.test(line)) return line;
      return line.replace(/#[0-9a-fA-F]{6}\b/g, (h) => { const t = TOKENS.get(h.toLowerCase()); if (!t) return h; n++; return `var(--${t})`; });
    }).join("\n");
    return { text: out, n };
  }
  let n = 0;
  const out = text.split("\n").map((line) => {
    if (!COLOUR_LINE.test(line) || DECLARES_TOKEN.test(line)) return line;
    return line.replace(/#[0-9a-fA-F]{6}\b/g, (h) => { const t = TOKENS.get(h.toLowerCase()); if (!t) return h; n++; return `var(--${t})`; });
  }).join("\n");
  return { text: out, n };
}

const KEY_HANDLER = `role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} `;
function transformClickable(text) {
  let n = 0;
  const out = text.split("\n").map((line) => {
    const m = /<(div|span)\b[^>]*?\bonClick=\{/.exec(line);
    if (!m) return line;
    if (/onKeyDown|role=|stopPropagation|onClose|overlay|Overlay|backdrop/i.test(line)) return line;
    const at = line.indexOf("onClick={", m.index);
    n++;
    return line.slice(0, at) + KEY_HANDLER + line.slice(at);
  }).join("\n");
  return { text: out, n };
}

function transformDialog(text) {
  let n = 0;
  const out = text.split("\n").map((line) => {
    if (/role=/.test(line)) return line;
    const m = /className=\{styles\.(modal|modalContent|modalCard|modalBox|dialog)\}/.exec(line);
    if (!m) return line;
    n++;
    return line.replace(m[0], `${m[0]} role="dialog" aria-modal="true"`);
  }).join("\n");
  return { text: out, n };
}

function transformBreakpoint(text) {
  let n = 0;
  const out = text.replace(/max-width:\s*639px/g, () => { n++; return "max-width: 640px"; });
  return { text: out, n };
}

function addImport(text, importLine) {
  const lines = text.split("\n");
  let last = -1;
  let inImport = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^import\s/.test(l)) inImport = true;
    if (inImport && /from\s+["'][^"']+["'];?\s*$/.test(l)) { last = i; inImport = false; continue; }
    if (inImport && /^import\s+["'][^"']+["'];?\s*$/.test(l)) { last = i; inImport = false; continue; }
    if (!inImport && /^\s*$|^\s*\/\/|^\s*\/\*|^\s*\*|^\s*\*\/|^["']use (client|server)["'];?\s*$/.test(l)) continue;
    if (!inImport && last >= -1 && !/^import\s/.test(l)) break;
  }
  lines.splice(last + 1, 0, importLine);
  return lines.join("\n");
}

// ---- report-only checks ----------------------------------------------------------------------
function reportOnly(files) {
  const r = { inline: [], readData: [], unlabelledInputs: [], nativeDialogs: [], fixedPx: [], breakpoints: [], avatarLeft: [], unmappedHex: new Map(), totals: { inline: 0, readData: 0, inputs: 0, native: 0, fixedPx: 0 } };
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8");
    const rel = path.relative(ROOT, f);
    const inl = (t.match(/style=\{\{/g) || []).length;
    if (inl) { r.inline.push([inl, rel]); r.totals.inline += inl; }
    const rd = (t.match(/readData\(/g) || []).length;
    if (rd) { r.readData.push([rd, rel]); r.totals.readData += rd; }
    const inputs = t.split("\n").filter((l) => /<(input|select|textarea)\b/.test(l) && !/aria-label|id=/.test(l)).length;
    if (inputs) { r.unlabelledInputs.push([inputs, rel]); r.totals.inputs += inputs; }
    const nat = (t.match(/\balert\(|\bconfirm\(/g) || []).length;
    if (nat) { r.nativeDialogs.push([nat, rel]); r.totals.native += nat; }
    const px = t.split("\n").filter((l) => /(width|minWidth|height):\s*\d{3,4}px/.test(l)).length;
    if (px) { r.fixedPx.push([px, rel]); r.totals.fixedPx += px; }
    if (/max-width:\s*(800|900|1023)px/.test(t)) r.breakpoints.push(rel);
    if (/ui-avatars\.com/.test(t)) r.avatarLeft.push(rel);
    for (const h of t.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const k = h[0].toUpperCase();
      if (!TOKENS.has(h[0].toLowerCase())) r.unmappedHex.set(k, (r.unmappedHex.get(k) || 0) + 1);
    }
  }
  const by = (a) => a.sort((x, y) => y[0] - x[0]);
  r.inline = by(r.inline); r.readData = by(r.readData); r.unlabelledInputs = by(r.unlabelledInputs);
  r.fixedPx = by(r.fixedPx);
  r.unmappedHex = [...r.unmappedHex.entries()].sort((a, b) => b[1] - a[1]);
  return r;
}

// ---- main -------------------------------------------------------------------------------------
const files = walk(SRC);
const changes = [];
for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  const original = text;
  const applied = {};
  const steps = [
    ["avatar", (t) => transformAvatar(t)],
    ["hex", (t) => transformHex(t, file)],
    ["clickable", (t) => (file.endsWith(".css") ? { text: t, n: 0 } : transformClickable(t))],
    ["dialog", (t) => (file.endsWith(".css") ? { text: t, n: 0 } : transformDialog(t))],
    ["breakpoint", (t) => (file.endsWith(".css") ? transformBreakpoint(t) : { text: t, n: 0 })],
  ];
  for (const [id, fn] of steps) {
    if (!ONLY.has(id)) continue;
    const res = fn(text);
    if (res.n) { applied[id] = res.n; text = res.text; }
  }
  if (text !== original) {
    changes.push({ file: path.relative(ROOT, file), applied, text });
  }
}

// Create the avatar helper once (used by the avatar transform).
const avatarHelper = path.join(SRC, "lib/avatar.ts");
const needsAvatar = changes.some((c) => c.applied.avatar);
const helperSource = `/**
 * Offline avatar: initials on a neutral tile, generated in the browser.
 * Replaces the external ui-avatars.com service so employee names never leave the app.
 * SVG cannot read CSS variables, so the tile colour is a constant here.
 */
const TILE = "#2563EB";
const TEXT = "#FFFFFF";

export function avatarInitials(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase().replace(/[^\\p{L}\\p{N}]/gu, "") || "?";
}

export function avatarDataUri(name: string | null | undefined): string {
  const svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="\${TILE}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="600" fill="\${TEXT}">\${avatarInitials(name)}</text></svg>\`;
  return \`data:image/svg+xml;charset=utf-8,\${encodeURIComponent(svg)}\`;
}
`;

const helperTest = `import { describe, expect, it } from "vitest";
import { avatarDataUri, avatarInitials } from "./avatar";

describe("avatarInitials", () => {
  it("uses first and last initials", () => {
    expect(avatarInitials("Asha Verma")).toBe("AV");
  });
  it("uses one letter for single names and ? for empty input", () => {
    expect(avatarInitials("Asha")).toBe("A");
    expect(avatarInitials("")).toBe("?");
    expect(avatarInitials(undefined)).toBe("?");
  });
});

describe("avatarDataUri", () => {
  it("returns an offline SVG data URI, never an external URL", () => {
    const uri = avatarDataUri("Asha Verma");
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(uri).not.toContain("ui-avatars");
  });
});
`;

const headerLines = [];
headerLines.push(`# UI fix report`);
headerLines.push("");
headerLines.push(`Mode: ${APPLY ? "APPLIED" : "dry run (nothing written)"} · transforms: ${[...ONLY].join(", ")}`);
headerLines.push("");
headerLines.push(`## 1. Transforms ${APPLY ? "applied" : "that would apply"}`);
headerLines.push("");
const totals = { avatar: 0, hex: 0, clickable: 0, dialog: 0, breakpoint: 0 };
for (const c of changes) for (const [k, v] of Object.entries(c.applied)) totals[k] += v;
headerLines.push("| Transform | Edits |", "|---|---|");
for (const [k, v] of Object.entries(totals)) headerLines.push(`| ${k} | ${v} |`);
headerLines.push("");
headerLines.push(`Files changed: ${changes.length}`);
headerLines.push("");
for (const c of changes) headerLines.push(`- ${c.file} — ${Object.entries(c.applied).map(([k, v]) => `${k}:${v}`).join(", ")}`);
headerLines.push("");

const report = reportOnly(files.filter((f) => !EXCLUDE.test(f)));
const remaining = [];
remaining.push("## 2. Needs a human decision (not changed)");
remaining.push("");
remaining.push(`- Inline style objects: ${report.totals.inline} (fix per component with shared primitives; no safe automatic conversion)`);
remaining.push(`- readData() calls: ${report.totals.readData} (must move to API hooks; behaviour depends on each endpoint)`);
remaining.push(`- Inputs/selects/textareas without id or aria-label: ${report.totals.inputs} (needs visible label text, which must come from locale files)`);
remaining.push(`- Native alert()/confirm(): ${report.totals.native} (replace with Modal and Toast; wording needs review)`);
remaining.push(`- Fixed pixel sizes (width/height ≥100px): ${report.totals.fixedPx} lines (layout decision per view)`);
remaining.push(`- Old breakpoints 800/900/1023px still present in: ${report.breakpoints.length} files (consolidate per view)`);
remaining.push(`- Hex values with no token match: ${report.unmappedHex.reduce((s, [, n]) => s + n, 0)} occurrences across ${report.unmappedHex.length} colours (add tokens or map by design)`);
remaining.push(`- Files still referencing ui-avatars.com after transform: ${report.avatarLeft.length}${report.avatarLeft.length ? " — " + report.avatarLeft.join(", ") : ""}`);
remaining.push("");
remaining.push("### Top files: inline styles");
for (const [n, f] of report.inline.slice(0, 15)) remaining.push(`- ${n} · ${f}`);
remaining.push("");
remaining.push("### Top files: readData() (static data)");
for (const [n, f] of report.readData.slice(0, 15)) remaining.push(`- ${n} · ${f}`);
remaining.push("");
remaining.push("### Native dialogs");
for (const [n, f] of report.nativeDialogs) remaining.push(`- ${n} · ${f}`);
remaining.push("");
remaining.push("### Top unmapped hex colours");
for (const [hex, n] of report.unmappedHex.slice(0, 10)) remaining.push(`- ${hex} · ${n}`);
remaining.push("");

const out = headerLines.concat(remaining).join("\n");
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, out);
console.log(out.split("\n").slice(0, 30).join("\n"));
console.log(`\nFull report: ${REPORT}`);

if (APPLY) {
  for (const c of changes) fs.writeFileSync(path.join(ROOT, c.file), c.text);
  if (needsAvatar && !fs.existsSync(avatarHelper)) {
    fs.writeFileSync(avatarHelper, helperSource);
    fs.writeFileSync(path.join(SRC, "lib/avatar.test.ts"), helperTest);
    console.log("Wrote src/lib/avatar.ts and src/lib/avatar.test.ts");
  }
  console.log(`Applied ${changes.length} file changes.`);
} else {
  console.log(`Dry run: ${changes.length} files would change. Re-run with --apply to write.`);
}
