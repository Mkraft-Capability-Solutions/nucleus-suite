import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type CanonicalManifest = {
  tables: Array<{ physical: string; tenantScoped: boolean }>;
};
type SchemaDump = {
  tables: Record<
    string,
    Array<{ column: string; nullable: boolean; default: unknown; type: string }>
  >;
  foreignKeys: Array<{ child_table: string; child_column: string; parent_table: string }>;
};

const dump = JSON.parse(
  readFileSync(join(process.cwd(), "scripts", "schema-dump.json"), "utf8")
) as SchemaDump;

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "db", "schema", "canonical-manifest.json"), "utf8")
) as CanonicalManifest;

// Map table to required columns that have no default
const tableRequirements: Record<string, {
  tenantScoped: boolean;
  requiredColumns: Array<{ column: string; type: string }>;
  fks: Array<{ column: string; parentTable: string }>;
}> = {};

const standardCols = new Set(["id", "created_at", "updated_at", "version", "record_status", "attributes", "tenant_id"]);

for (const t of manifest.tables) {
  const tableName = t.physical;
  const cols = dump.tables[tableName] || [];
  const reqCols = cols.filter((c) => !c.nullable && !c.default && !standardCols.has(c.column));
  
  const fks = dump.foreignKeys
    .filter((fk) => fk.child_table === tableName)
    .map((fk) => ({ column: fk.child_column, parentTable: fk.parent_table }));

  tableRequirements[tableName] = {
    tenantScoped: t.tenantScoped,
    requiredColumns: reqCols.map((c) => ({ column: c.column, type: c.type })),
    fks
  };
}

writeFileSync(
  join(process.cwd(), "scripts", "table-requirements.json"),
  JSON.stringify(tableRequirements, null, 2),
  "utf8"
);
console.log("Saved table requirements for 304 tables.");
