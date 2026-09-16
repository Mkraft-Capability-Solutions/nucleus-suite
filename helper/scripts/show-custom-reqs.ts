import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const reqs = JSON.parse(
  readFileSync(join(process.cwd(), "scripts", "table-requirements.json"), "utf8")
) as Record<
  string,
  {
    fks: Array<{ column: string }>;
    requiredColumns: Array<{ column: string; type: string }>;
  }
>;

const nonFkList: Record<string, Array<{ column: string; type: string }>> = {};

for (const [t, data] of Object.entries(reqs)) {
  const fkCols = new Set(data.fks.map((f) => f.column));
  const nonFk = data.requiredColumns.filter((c) => !fkCols.has(c.column));
  if (nonFk.length > 0) {
    nonFkList[t] = nonFk;
  }
}

writeFileSync(
  join(process.cwd(), "scripts", "non-fk-requirements.json"),
  JSON.stringify(nonFkList, null, 2),
  "utf8"
);
console.log(`Found ${Object.keys(nonFkList).length} tables with non-FK required columns.`);
