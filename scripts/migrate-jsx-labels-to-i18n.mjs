import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const interfaceJsonPath = 'src/locales/en/interface.json';
const interfaceJson = JSON.parse(fs.readFileSync(interfaceJsonPath, 'utf8'));

// Helper to convert text to a clean slug
function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'text';
}

function getNamespace(filePath) {
  // Normalize path e.g. src/components/Workspace/EmployeeCreationWizard.js -> components.Workspace.EmployeeCreationWizard
  const rel = filePath.replace(/\\/g, '/').replace(/^src\//, '').replace(/\.[jt]sx?$/, '');
  return rel.replace(/\//g, '.');
}

const gap = JSON.parse(fs.readFileSync('plan/frontend-live-gap-register.json', 'utf8'));
const targetFiles = gap.files
  .filter(f => f.hardcodedLabelLocations.length > 0)
  .map(f => f.path);

console.log(`Processing ${targetFiles.length} files...`);

let totalExtracted = 0;
let totalReplaced = 0;

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) continue;
  let source = fs.readFileSync(filePath, 'utf8');
  const namespace = getNamespace(filePath);
  if (!interfaceJson[namespace]) {
    interfaceJson[namespace] = {};
  }

  const isTsx = filePath.endsWith('.tsx');
  const isJsx = filePath.endsWith('.jsx') || filePath.endsWith('.js');
  const scriptKind = isTsx ? ts.ScriptKind.TSX : (isJsx ? ts.ScriptKind.JSX : ts.ScriptKind.TS);

  const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);

  // Collect replacements: { start, end, replacement, text, key }
  const replacements = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      // Skip pure punctuation or empty
      if (text && text.length > 1 && !/^[{}(),.;:!*+\\/\-_=><[\]]+$/.test(text)) {
        const key = `text_${toSlug(text)}`;
        interfaceJson[namespace][key] = text;
        totalExtracted++;
        // Preserve surrounding whitespace in the JSX text node
        const raw = node.text;
        const leadingWs = raw.match(/^\s*/)[0];
        const trailingWs = raw.match(/\s*$/)[0];
        const repl = `${leadingWs}{t("${namespace}.${key}", ${JSON.stringify(text)})}${trailingWs}`;
        replacements.push({
          start: node.getStart(ast),
          end: node.getEnd(),
          replacement: repl,
        });
      }
    } else if (
      ts.isJsxAttribute(node) &&
      ['title', 'placeholder', 'aria-label', 'alt', 'label', 'helperText'].includes(node.name.getText(ast)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const text = node.initializer.text.trim();
      const attrName = node.name.getText(ast);
      if (text && text.length > 1 && !/^[{}(),.;:!*+\\/\-_=><[\]]+$/.test(text)) {
        const key = `${attrName}_${toSlug(text)}`;
        interfaceJson[namespace][key] = text;
        totalExtracted++;
        replacements.push({
          start: node.initializer.getStart(ast),
          end: node.initializer.getEnd(),
          replacement: `{t("${namespace}.${key}", ${JSON.stringify(text)})}`,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(ast);

  if (replacements.length === 0) continue;

  // Sort replacements descending by start position to avoid offset shifts
  replacements.sort((a, b) => b.start - a.start);

  // Apply replacements
  let updated = source;
  for (const { start, end, replacement } of replacements) {
    updated = updated.slice(0, start) + replacement + updated.slice(end);
    totalReplaced++;
  }

  // Ensure import { useTranslation } from '@/context/I18nContext'
  if (!updated.includes('useTranslation')) {
    // Insert after "use client" or at top
    if (updated.startsWith('"use client";') || updated.startsWith("'use client';")) {
      updated = updated.replace(/^(["']use client["'];?\s*)/, `$1\nimport { useTranslation } from '@/context/I18nContext';\n`);
    } else {
      updated = `import { useTranslation } from '@/context/I18nContext';\n` + updated;
    }
  }

  // Ensure `const { t } = useTranslation();` is declared in component functions that use `t(`
  // Check if `t(` is used without `const { t } = useTranslation();`
  // Simple heuristic: find top-level function or default export function
  // If `t(` is in the code and `const { t }` or `const {t` is not in the code
  if (updated.includes('t(') && !/const\s*\{\s*t[,\s}]/.test(updated)) {
    // Find component functions: e.g. `export default function Name(...) {` or `function Name(...) {`
    updated = updated.replace(
      /(export\s+default\s+function\s+[A-Za-z0-9_]*\s*\([^)]*\)\s*\{)/g,
      `$1\n    const { t } = useTranslation();`
    );
    // Also handle `export function Name(...) {`
    updated = updated.replace(
      /(export\s+function\s+[A-Za-z0-9_]*\s*\([^)]*\)\s*\{)/g,
      `$1\n    const { t } = useTranslation();`
    );
  }

  fs.writeFileSync(filePath, updated, 'utf8');
}

fs.writeFileSync(interfaceJsonPath, JSON.stringify(interfaceJson, null, 2) + '\n', 'utf8');
console.log(`Done! Extracted ${totalExtracted} labels, applied ${totalReplaced} replacements.`);
