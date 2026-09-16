import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface ColumnInfo {
  column: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

interface SchemaDump {
  totalTables: number;
  tables: Record<string, ColumnInfo[]>;
  foreignKeys: Array<{
    child_table: string;
    child_column: string;
    parent_table: string;
    parent_column: string;
  }>;
  counts: Record<string, number>;
}

function main() {
  const dump = JSON.parse(
    readFileSync(join(process.cwd(), "scripts", "schema-dump.json"), "utf8")
  ) as SchemaDump;

  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "db", "schema", "canonical-manifest.json"), "utf8")
  );

  console.log("Canonical table count:", manifest.logicalTableCount);
  console.log("Total DB public tables:", dump.totalTables);

  // Find non-standard columns (columns other than id, tenant_id, record_status, attributes, version, created_at, updated_at)
  const standardCols = new Set([
    "id", "tenant_id", "record_status", "attributes", "version", "created_at", "updated_at"
  ]);

  const customColsPerTable: Record<string, string[]> = {};
  const requiredCustomColsPerTable: Record<string, string[]> = {};

  for (const [table, cols] of Object.entries(dump.tables)) {
    const custom = cols.filter(c => !standardCols.has(c.column));
    if (custom.length > 0) {
      customColsPerTable[table] = custom.map(c => `${c.column} (${c.type}, nullable: ${c.nullable}, default: ${c.default ? 'YES' : 'NO'})`);
      const req = custom.filter(c => !c.nullable && !c.default);
      if (req.length > 0) {
        requiredCustomColsPerTable[table] = req.map(c => `${c.column} (${c.type})`);
      }
    }
  }

  console.log("\nTables with required custom columns (must provide values on insert):");
  for (const [t, cols] of Object.entries(requiredCustomColsPerTable)) {
    console.log(`  ${t}:`, cols.join(", "));
  }

  // Check FK dependencies
  const graph: Record<string, Set<string>> = {};
  const allTables = new Set(Object.keys(dump.tables));

  for (const t of allTables) {
    graph[t] = new Set<string>();
  }

  // FK edges: child -> parent (child depends on parent)
  // Note: Only required FKs or non-self-referencing FKs force order
  for (const fk of dump.foreignKeys) {
    if (fk.child_table !== fk.parent_table && allTables.has(fk.parent_table)) {
      // check if child column is required
      const col = dump.tables[fk.child_table]?.find(c => c.column === fk.child_column);
      if (col && !col.nullable) {
        graph[fk.child_table].add(fk.parent_table);
      }
    }
  }

  // Topological sort of tables based on required FK dependencies
  const inDegree: Record<string, number> = {};
  const dependents: Record<string, Set<string>> = {};

  for (const t of allTables) {
    inDegree[t] = 0;
    dependents[t] = new Set<string>();
  }

  for (const [child, parents] of Object.entries(graph)) {
    for (const parent of parents) {
      dependents[parent].add(child);
      inDegree[child]++;
    }
  }

  const queue: string[] = [];
  for (const t of allTables) {
    if (inDegree[t] === 0) queue.push(t);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    sorted.push(curr);

    for (const dep of dependents[curr]) {
      inDegree[dep]--;
      if (inDegree[dep] === 0) {
        queue.push(dep);
      }
    }
  }

  console.log(`\nTopologically sorted ${sorted.length} of ${allTables.size} tables with required dependencies.`);
  const remaining = [...allTables].filter(t => !sorted.includes(t));
  if (remaining.length > 0) {
    console.log("Cyclic required dependencies found in tables:", remaining);
  }

  writeFileSync(
    join(process.cwd(), "scripts", "schema-analysis.json"),
    JSON.stringify({
      requiredCustomColsPerTable,
      customColsPerTable,
      sortedTables: sorted,
      cyclicTables: remaining,
      totalCanonical: manifest.logicalTableCount,
    }, null, 2),
    "utf8"
  );
  console.log("Written analysis to scripts/schema-analysis.json");
}

main();
