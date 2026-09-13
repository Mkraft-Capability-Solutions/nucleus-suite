import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const extensions = new Set(['.tsx', '.ts', '.jsx', '.js', '.mjs', '.css', '.json']);
const files = [];
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { scan(path); continue; }
    if (!extensions.has(extname(path))) continue;
    const source = readFileSync(path, 'utf8');
    const lines = source.split('\n');
    const record = { path, lines: lines.length - Number(source.endsWith('\n')) };
    const markers = lines.flatMap((line, index) => /\b(TODO|FIXME|placeholder|not implemented)\b/i.test(line)
      ? [{ line: index + 1, marker: line.trim().slice(0, 180) }] : []);
    if (markers.length) record.reviewMarkers = markers;
    if (path.includes('/api/') && entry.name.startsWith('route.')) {
      record.guardReferences = [...new Set(source.match(/\b(?:requireAuth|requirePermission|requireRole|requireTenant|withTenant|assertPermission|getSession|checkPermission|assertDemoMode)\b/g) ?? [])].sort();
    }
    files.push(record);
  }
}
scan('src');
files.sort((a, b) => a.path.localeCompare(b.path));
writeFileSync('plan/MASTER_QA_CODE_INVENTORY.json', JSON.stringify({
  scope: 'Source inventory and review signals; presence of a guard reference is not proof of authorization correctness.',
  files,
}, null, 2) + '\n');
console.log(`Inventoried ${files.length} source/config/style files. Markers require contextual review.`);
