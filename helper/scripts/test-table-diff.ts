import { readFileSync } from "node:fs";
import { join } from "node:path";

type CanonicalManifest = { tables: Array<{ physical: string }> };
type SchemaDump = { tables: Record<string, unknown> };

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "db", "schema", "canonical-manifest.json"), "utf8")
) as CanonicalManifest;

const dump = JSON.parse(
  readFileSync(join(process.cwd(), "scripts", "schema-dump.json"), "utf8")
) as SchemaDump;

console.log("Total canonical tables in manifest:", manifest.tables.length);
console.log("Total tables in DB dump:", Object.keys(dump.tables).length);

const manifestTableNames = new Set(manifest.tables.map((t) => t.physical));
const dbTableNames = new Set(Object.keys(dump.tables));

const missingInDb = [...manifestTableNames].filter(t => !dbTableNames.has(t));
console.log("Missing in DB from manifest:", missingInDb);

// Tables in DB that are not in manifest (e.g. drizzle migrations table or auth tables)
const extraInDb = [...dbTableNames].filter(t => !manifestTableNames.has(t));
console.log("Extra tables in DB (not in canonical 304):", extraInDb);
