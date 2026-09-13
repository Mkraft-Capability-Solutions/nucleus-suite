import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = process.cwd();
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]); }
const source = files(join(root, 'src')).map(path => relative(root, path));
const navigation = JSON.parse(readFileSync('src/data/ui/navigation.catalog.json', 'utf8'));
const topology = JSON.parse(readFileSync('db/schema/canonical-manifest.json', 'utf8'));
const journal = JSON.parse(readFileSync('db/migrations/meta/_journal.json', 'utf8'));
const migrationFiles = files('db/migrations').filter(path => path.endsWith('.sql')).sort();
const entries = navigation.domains.flatMap(domain => domain.groups.flatMap(group => group.items.map(item => ({ domain: domain.id, group: group.heading, ...item }))));
const resources = files('src/data/ui').filter(path => path.endsWith('.json')).map(path => {
 let strings = 0; function walk(value) { if (typeof value === 'string') strings++; else if (value && typeof value === 'object') Object.values(value).forEach(walk); }
 walk(JSON.parse(readFileSync(path, 'utf8'))); return { path, stringValues: strings };
});
const inventory = {
 baseline: '04520f5',
 pages: source.filter(path => /\/page\.[jt]sx?$/.test(path)),
 routeHandlers: source.filter(path => /\/route\.[jt]s$/.test(path)),
 components: source.filter(path => path.startsWith('src/components/') && /\.[jt]sx?$/.test(path)),
 providers: source.filter(path => path.startsWith('src/context/')),
 services: source.filter(path => path.startsWith('src/server/') && path.endsWith('/service.ts')),
 clientServices: source.filter(path => path.startsWith('src/services/')),
 navigation: entries,
 uiResources: resources,
 schema: { logicalTables: topology.logicalTableCount, declaredRelationships: topology.relationshipCount, tables: topology.tables },
 migrations: { files: migrationFiles, journalEntries: journal.entries.map(entry => entry.tag), unjournaled: migrationFiles.filter(path => !journal.entries.some(entry => path.endsWith(`${entry.tag}.sql`))) },
};
writeFileSync('plan/enterprise-inventory.json', JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ pages: inventory.pages.length, routeHandlers: inventory.routeHandlers.length, components: inventory.components.length, services: inventory.services.length, navigationEntries: entries.length, uiResources: resources.length, uiStringValues: resources.reduce((total, resource) => total + resource.stringValues, 0), ...inventory.migrations }, null, 2));
