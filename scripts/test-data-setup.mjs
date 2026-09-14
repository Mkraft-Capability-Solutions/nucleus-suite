import { readFile, readdir } from 'node:fs/promises';
import { configureWorkspaceTransport } from '../src/services/workspace-data.mjs';
const resources = { workbook: JSON.parse(await readFile(new URL('./seeds/workbook.json', import.meta.url), 'utf8')) };
for (const file of await readdir(new URL('../src/config/ui/', import.meta.url))) {
    if (file.endsWith('.json')) resources[file.slice(0, -5)] = JSON.parse(await readFile(new URL('../src/config/ui/' + file, import.meta.url), 'utf8'));
}
await configureWorkspaceTransport(async () => ({ version: 1, resources }));
