/**
 * Removes internal console codes (S1–S10) from user-facing text in every UI config and locale file.
 * IDs stay: a value that is exactly a code ("S1") is an identifier used for routing and is left untouched.
 *
 * Usage: npx tsx scripts/clean-display-codes.ts [--dry]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/config/ui", "src/locales"];
const CODE = "S(?:10|[1-9])";
const RANGE = new RegExp(`\\s*\\(?\\b${CODE}\\s*(?:through|to|\\u2013|-|\\.\\.)\\s*${CODE}\\b\\)?`, "g");
const PAREN = new RegExp(`\\s*\\(${CODE}\\)`, "g");
const LEADING = new RegExp(`\\b${CODE}\\b\\s+`, "g");
const EXACT_ID = new RegExp(`^${CODE}$`);
const DRY = process.argv.includes("--dry");

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (name.endsWith(".json")) out.push(p);
  }
  return out;
}

export function cleanText(value: string): string {
  if (EXACT_ID.test(value.trim())) return value;
  if (!new RegExp(`\\b${CODE}\\b`).test(value)) return value;
  const out = value.replace(RANGE, "").replace(PAREN, "").replace(LEADING, "");
  return out.replace(/ {2,}/g, " ").replace(/\s+([.,)])/g, "$1").replace(/\(\s*\)/g, "");
}

function walk(node: unknown, changes: { count: number; samples: string[] }): unknown {
  if (typeof node === "string") {
    const next = cleanText(node);
    if (next !== node) {
      changes.count += 1;
      if (changes.samples.length < 12) changes.samples.push(`${node}  →  ${next}`);
    }
    return next;
  }
  if (Array.isArray(node)) return node.map((item) => walk(item, changes));
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => {
      // The console-switch toast ("Loaded {value1} ({value2}).") printed the console code as value2.
      if (k === "text_a00b1786e3" && typeof v === "string" && v.includes("{value2}")) {
        changes.count += 1;
        return [k, v.replace(/\s*[(（]\s*\{value2\}\s*[)）]/, "").replace(/\{value2\}/, "")];
      }
      return [k, walk(v, changes)];
    }));
  }
  return node;
}

function main(): void {
  const changes = { count: 0, samples: [] as string[] };
  let touched = 0;
  for (const root of ROOTS) {
    for (const file of files(root)) {
      const raw = readFileSync(file, "utf8");
      const before = changes.count;
      const next = walk(JSON.parse(raw), changes);
      if (changes.count !== before) {
        touched += 1;
        if (!DRY) writeFileSync(file, JSON.stringify(next, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
      }
    }
  }
  console.log(`${DRY ? "Would change" : "Changed"} ${changes.count} strings in ${touched} files.`);
  for (const s of changes.samples) console.log("  " + s);
}

main();
