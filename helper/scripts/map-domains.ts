import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "db", "schema", "canonical-manifest.json"), "utf8")
);

// In canonical-manifest.json, let's see how sourceFiles map to tables
console.log("Source files in manifest:", manifest.sourceFiles);

// Let's check design/database/uml to see which table belongs to which file
import { readdirSync } from "node:fs";
const umlDir = join(process.cwd(), "design", "database", "uml");
const pumlFiles = readdirSync(umlDir).filter(f => /^\d{2}-.+\.puml$/.test(f) && f !== "00-schema-atlas.puml" && f !== "11-complete-schema.puml" && f !== "12-cross-domain-foreign-keys.puml" && f !== "13-domain-fk-matrix.puml");

const domainTables: Record<string, string[]> = {};
for (const f of pumlFiles) {
  const content = readFileSync(join(umlDir, f), "utf8");
  const matches = [...content.matchAll(/entity\s+"([a-z0-9_]+)"/g)].map(m => m[1]);
  const physicalMap: Record<string, string> = { users: "user", identities: "account", sessions: "session" };
  domainTables[f] = [...new Set(matches.map(m => physicalMap[m] || m))];
  console.log(`${f}: ${domainTables[f].length} tables`);
}

writeFileSync(
  join(process.cwd(), "scripts", "domain-tables.json"),
  JSON.stringify(domainTables, null, 2),
  "utf8"
);
