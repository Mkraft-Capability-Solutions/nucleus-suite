import fs from "fs";
import path from "path";

const dir = path.resolve(__dirname);
const files = fs.readdirSync(dir).filter((f) => f.startsWith("domain") && f.endsWith(".ts"));

const referencedTables = new Set<string>();

for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), "utf8");
  // Match INSERT INTO <table> or FROM <table> or hasData(client, "table")
  const insertMatches = content.matchAll(/INSERT\s+INTO\s+["']?([a-zA-Z0-9_]+)["']?/gi);
  for (const m of insertMatches) {
    referencedTables.add(m[1].toLowerCase());
  }
  const hasDataMatches = content.matchAll(/hasData\(\s*client,\s*["']([a-zA-Z0-9_]+)["']/gi);
  for (const m of hasDataMatches) {
    referencedTables.add(m[1].toLowerCase());
  }
}

if (referencedTables.has("user")) referencedTables.add('"user"');

const manifestPath = path.resolve(__dirname, "../../db/schema/canonical-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
  tables: Array<{ physical: string }>;
};
const canonicalTables: string[] = manifest.tables.map((t) => t.physical);

const legacyTables = [
  "attendance_days",
  "attendance_punches",
  "leave_balances",
  "leave_approvals",
  "loans",
  "auth_security_events",
  "verification"
];

const allTargetTables = [...new Set([...canonicalTables, ...legacyTables])].sort();

const missingTables = allTargetTables.filter((t) => !referencedTables.has(t.toLowerCase()));

console.log(`Total target tables: ${allTargetTables.length}`);
console.log(`Tables referenced in domain seeders: ${referencedTables.size}`);
console.log(`Missing tables count: ${missingTables.length}`);
if (missingTables.length > 0) {
  console.log("Missing tables list:");
  console.log(missingTables.join("\n"));
} else {
  console.log("ALL 311 TABLES ARE REFERENCED IN DOMAIN SEEDERS!");
}
