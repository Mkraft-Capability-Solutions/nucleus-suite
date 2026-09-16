import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * OC-P0-04 — Static parity and forbidden-stack checks (TDD acceptance spec).
 *
 * Guards the founder-selected stack (DEC-005/DEC-029): no Kafka, Redis,
 * Kubernetes, MongoDB, Elasticsearch, Neo4j; no stock LangGraph PostgresSaver;
 * no second resume-scoring engine and no prohibited candidate-score columns in
 * the backend/data boundary. Runs before any implementation task.
 */

const ROOT = resolve(process.cwd());

function walk(dir: string, extensions: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "coverage") continue;
      walk(full, extensions, out);
    } else if (extensions.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const CODE_DIRS = ["src", "db", "scripts", "e2e"].map((d) => join(ROOT, d));
const FORBIDDEN_STACK = [
  "kafkajs",
  "@nestjs/microservices",
  "ioredis",
  "bullmq",
  "mongoose",
  "mongodb",
  "@elastic/elasticsearch",
  "neo4j-driver",
  "@langchain/langgraph-checkpoint-postgres",
  "PostgresSaver",
];

describe("forbidden-stack static guard (OC-P0-04)", () => {
  // Walks are hoisted: full-tree readdir+stat+read is I/O-bound and exceeds
  // the 5s default timeout on slow CI filesystems (proven by Vercel failures).
  const CODE_FILES_TSX_MJS: string[] = CODE_DIRS.flatMap((dir) => walk(dir, [".ts", ".tsx", ".mjs"]));
  const CODE_FILES_TSX: string[] = CODE_DIRS.flatMap((dir) => walk(dir, [".ts", ".tsx"]));
  const BOUNDARY_DIRS = [join(ROOT, "src/lib/db"), join(ROOT, "src/server"), join(ROOT, "src/app/api"), join(ROOT, "src/lib/ai")];
  const BOUNDARY_FILES: string[] = BOUNDARY_DIRS.flatMap((dir) => walk(dir, [".ts", ".tsx"]));
  it("declares no forbidden infrastructure dependency in package.json", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const forbidden of FORBIDDEN_STACK) {
      expect(declared[forbidden], `forbidden dependency ${forbidden}`).toBeUndefined();
    }
  });

  it("imports no forbidden infrastructure module in implementation sources", { timeout: 60_000 }, () => {
    const files = CODE_FILES_TSX_MJS.filter(
      (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx") && !file.includes(`${"e2e"}${""}/fixtures`),
    );
    const hits: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN_STACK) {
        if (content.includes(forbidden)) hits.push(`${file} :: ${forbidden}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("forbids array-destructuring bare sqlClient results (rows, not result arrays)", { timeout: 60_000 }, () => {
    // tenantTx() returns one result per statement (destructuring correct).
    // Bare sqlClient`` returns the rows array itself; `const [x] = await
    // sqlClient`` silently takes the first ROW (proven by three FX failures).
    const files = CODE_FILES_TSX.filter(
      (file) => !file.endsWith(".test.ts") && !file.includes("scripts") && !file.includes("tmp"),
    );
    const hits: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (/ const \[[a-zA-Z_$][\w$]*\] = await sqlClient`/.test(content)) {
        hits.push(file);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps the backend/data boundary free of prohibited candidate-score fields", { timeout: 60_000 }, () => {
    // Scope: only the backend/data boundary. *.test.ts and UI copy are excluded:
    // tests must name the forbidden fields to assert their rejection.
    const files = BOUNDARY_FILES.filter((file) => !file.endsWith(".test.ts"));
    const forbiddenFields = [
      "confidence",
      "composite",
      "heuristic",
      "keyword_score",
      "keyword-score",
      "keywordMatcher",
      "keyword_matcher",
      "subscore",
      "sub_score",
      "percentile",
      "ranking",
      "cutoff",
    ];
    const hits: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      // Exception: a file may NAME forbidden fields inside a single explicitly
      // marked rejection denylist (FORBIDDEN_SCORE_KEYS) whose only purpose is
      // to reject them at the API boundary. Strip that literal before scanning.
      const scannable = content
        .replace(/const FORBIDDEN_SCORE_KEYS = \[[\s\S]*?\];/, "const FORBIDDEN_SCORE_KEYS = [];")
        // The leave scheme's joining cutoff and proration-band cutoff day (RL-10, open question
        // Q-02) are calendar boundaries for casual and sick leave, not score thresholds. They are
        // allowed by exact identifier so every other use of "cutoff" on this boundary still fails.
        .replace(/joiningAfterCutoffDays|joining_after_cutoff_days|cutoffDay|cutoff_day/g, "bandBoundary");
      for (const field of forbiddenFields) {
        if (scannable.toLowerCase().includes(field)) hits.push(`${file} :: ${field}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("quality-gate configuration parity (OC-P0-04)", () => {
  it("holds vitest coverage thresholds at 90/90/90/85 for the deterministic core", () => {
    const config = readFileSync(join(ROOT, "vitest.config.mts"), "utf8");
    expect(config).toContain("lines: 90");
    expect(config).toContain("functions: 90");
    expect(config).toContain("statements: 90");
    expect(config).toContain("branches: 85");
  });

  it("runs the browser suite on desktop Chromium and a Pixel 7 viewport", () => {
    const config = readFileSync(join(ROOT, "playwright.config.ts"), "utf8");
    expect(config).toContain("Desktop Chrome");
    expect(config).toContain("Pixel 7");
  });

  it("keeps unit, typecheck, lint, e2e and coverage commands wired", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    for (const script of ["lint", "typecheck", "test", "test:coverage", "test:e2e", "build", "check"]) {
      expect(manifest.scripts?.[script], `missing script ${script}`).toBeTruthy();
    }
  });
});
