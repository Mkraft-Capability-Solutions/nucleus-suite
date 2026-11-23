/**
 * Compares API routes and server modules between this repo and a sibling repo,
 * scores each side on production signals, and recommends keep / copy / merge.
 *
 * Usage: npx tsx scripts/compare-services.ts [otherRepoPath] [outFile]
 * Defaults: ../Nucleus-HRMS and docs/plans/V1.0/SERVICE-COMPARISON.md
 *
 * Read-only for both repos except the report file it writes.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

type Side = "suite" | "hrms";

interface Signals {
  lines: number;
  tenant: boolean;
  permission: boolean;
  validation: boolean;
  idempotency: boolean;
  tested: boolean;
  methods: string[];
  hash: string;
}

interface Entry {
  key: string;
  kind: "route" | "server";
  suite?: Signals;
  hrms?: Signals;
}

const SUITE_ROOT = resolve(process.cwd());
const HRMS_ROOT = resolve(process.argv[2] ?? join(SUITE_ROOT, "..", "Nucleus-HRMS"));
const OUT = resolve(process.argv[3] ?? join(SUITE_ROOT, "docs/plans/V1.0/SERVICE-COMPARISON.md"));

const SOURCE = /\.(ts|tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE.test(name)) out.push(p);
  }
  return out;
}

function read(p: string): string {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/** Server code a route imports (one level), so a thin route is judged by what it calls. */
function withImports(root: string, file: string, text: string): string {
  const parts = [text];
  for (const m of text.matchAll(/from\s+["']@\/(server\/[^"']+)["']/g)) {
    for (const ext of [".ts", "/index.ts", ".tsx"]) {
      const p = join(root, "src", m[1] + ext);
      if (existsSync(p)) {
        parts.push(read(p));
        break;
      }
    }
  }
  return parts.join("\n");
}

function signals(root: string, file: string, testIndex: Set<string>): Signals {
  const text = read(file);
  const all = withImports(root, file, text);
  const base = file.replace(/\.(ts|tsx)$/, "");
  const dir = dirname(file);
  const tested =
    testIndex.has(base + ".test") ||
    [...testIndex].some((t) => t.startsWith(dir + "/") && t.endsWith(".test"));
  return {
    lines: text.split("\n").length,
    tenant: /tenantTx|tenant_id|tenantId/.test(all),
    permission: /requireAccess|enforce\(|requirePermission|hasPermission|can\(/.test(all),
    validation: /z\.object|safeParse|\.parse\(|zod/.test(all),
    idempotency: /Idempotency|idempotency/.test(all),
    tested,
    methods: [...text.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]),
    hash: createHash("sha1").update(text.replace(/\s+/g, " ")).digest("hex").slice(0, 10),
  };
}

function score(s?: Signals): number {
  if (!s) return -1;
  return (s.tenant ? 2 : 0) + (s.permission ? 3 : 0) + (s.validation ? 2 : 0) + (s.idempotency ? 1 : 0) + (s.tested ? 2 : 0);
}

function collect(root: string, side: Side, map: Map<string, Entry>): void {
  const files = walk(join(root, "src"));
  const tests = new Set(files.filter((f) => /\.test\.(ts|tsx)$/.test(f)).map((f) => f.replace(/\.(ts|tsx)$/, "")));
  for (const f of files) {
    if (/\.test\.(ts|tsx)$/.test(f)) continue;
    const rel = relative(join(root, "src"), f).split("\\").join("/");
    let key: string | null = null;
    let kind: Entry["kind"] = "route";
    const r = /^app\/(?:\([^/]+\)\/)?api\/(.+)\/route\.ts$/.exec(rel);
    if (r) key = "/api/" + r[1];
    else if (rel.startsWith("server/")) {
      key = rel.replace(/\.(ts|tsx)$/, "");
      kind = "server";
    }
    if (!key) continue;
    const e = map.get(key) ?? { key, kind };
    e[side] = signals(root, f, tests);
    map.set(key, e);
  }
}

function decide(e: Entry): { action: string; why: string } {
  const a = score(e.suite);
  const b = score(e.hrms);
  if (e.suite && e.hrms && e.suite.hash === e.hrms.hash) return { action: "same", why: "identical" };
  if (!e.suite) return { action: "copy", why: "only in Nucleus-HRMS" };
  if (!e.hrms) return { action: "keep", why: "only in this repo" };
  if (b > a) return { action: "copy", why: `HRMS scores ${b} vs ${a}` };
  if (a > b) return { action: "keep", why: `this repo scores ${a} vs ${b}` };
  return { action: "merge", why: `both score ${a}; review the diff` };
}

function flags(s?: Signals): string {
  if (!s) return "—";
  return [s.tenant ? "T" : "·", s.permission ? "P" : "·", s.validation ? "V" : "·", s.idempotency ? "I" : "·", s.tested ? "✓" : "·"].join("") + ` ${s.lines}L`;
}

function main(): void {
  if (!existsSync(HRMS_ROOT)) {
    console.error(`Other repo not found: ${HRMS_ROOT}`);
    process.exit(1);
  }
  const map = new Map<string, Entry>();
  collect(SUITE_ROOT, "suite", map);
  collect(HRMS_ROOT, "hrms", map);
  const rows = [...map.values()].sort((x, y) => x.kind.localeCompare(y.kind) || x.key.localeCompare(y.key));

  const tally: Record<string, number> = {};
  const groups: Record<string, Record<string, number>> = {};
  for (const e of rows) {
    const d = decide(e);
    tally[d.action] = (tally[d.action] ?? 0) + 1;
    if (e.kind === "route") {
      const g = e.key.split("/").slice(0, 4).join("/");
      groups[g] = groups[g] ?? {};
      groups[g][d.action] = (groups[g][d.action] ?? 0) + 1;
    }
  }

  const lines: string[] = [];
  lines.push("---", "title: Service comparison (nucleus-suite vs Nucleus-HRMS)", "status: draft", "owner: backend",
    `last_reviewed: ${new Date().toISOString().slice(0, 10)}`, "related:", "  - ./UI-GUIDELINE-PULSE.md", "---", "",
    "# Service comparison", "",
    "Purpose: decide, per API route and server module, whether to keep this repo's version, copy Nucleus-HRMS's, or merge.",
    "Generated by `npx tsx scripts/compare-services.ts`. Re-run after changes; do not edit by hand.", "",
    "Signals: **T** tenant scoping · **P** permission check · **V** input validation · **I** idempotency · **✓** tests nearby · L = lines.",
    "Score = T×2 + P×3 + V×2 + I×1 + tests×2. Signals are heuristics from the code text; confirm before copying.", "",
    "## Totals", "", "| Action | Count |", "|---|---|");
  for (const [k, v] of Object.entries(tally).sort()) lines.push(`| ${k} | ${v} |`);
  lines.push("", "## Routes by group", "", "| Group | copy | keep | merge | same |", "|---|---|---|---|---|");
  for (const [g, c] of Object.entries(groups).sort()) lines.push(`| \`${g}\` | ${c.copy ?? 0} | ${c.keep ?? 0} | ${c.merge ?? 0} | ${c.same ?? 0} |`);
  for (const kind of ["route", "server"] as const) {
    lines.push("", `## ${kind === "route" ? "API routes" : "Server modules"}`, "", "| Path | This repo | Nucleus-HRMS | Action | Why |", "|---|---|---|---|---|");
    for (const e of rows.filter((r) => r.kind === kind)) {
      const d = decide(e);
      if (d.action === "same") continue;
      lines.push(`| \`${e.key}\` | ${flags(e.suite)} | ${flags(e.hrms)} | ${d.action} | ${d.why} |`);
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join("\n") + "\n");
  console.log(`Compared ${rows.length} items → ${relative(SUITE_ROOT, OUT)}`);
  console.log(JSON.stringify(tally));
}

main();
