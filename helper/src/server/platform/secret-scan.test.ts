import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * OC-P9-03 — Read-only secret and credential hygiene scan (TDD spec).
 *
 * Fails the suite if any committed source embeds a private key, a cloud
 * token, or a database URL carrying a real password. Doctrine:
 * - `*.test.ts` files may NAME threats to assert their absence (excluded).
 * - `localhost` placeholders and `configuration-required`/`example` markers
 *   are explicitly non-secret (allowlisted).
 */

const ROOT = resolve(process.cwd());

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "coverage") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|mjs|js|json)$/.test(full)) {
      out.push(full);
    }
  }
  return out;
}

function isPlaceholder(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("configuration-required") ||
    lower.includes("example.test") ||
    lower.includes("example.invalid") ||
    lower.includes("placeholder")
  );
}

describe("secret hygiene scan (OC-P9-03)", () => {
  // Walk once: full-tree readdir+stat+read is I/O-bound and exceeds the 5s
  // default timeout on slow CI filesystems (proven by Vercel failures).
  const SRC_FILES: string[] = walk(join(ROOT, "src"));
  it("embeds no private keys outside tests", { timeout: 60_000 }, () => {
    const pattern = /BEGIN (EC |RSA |OPENSSH )?PRIVATE KEY/;
    const hits = SRC_FILES.filter((file) => !file.endsWith(".test.ts"))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .filter((line) => pattern.test(line))
          .map((line) => `${file} :: ${line.trim().slice(0, 80)}`),
      );
    expect(hits).toEqual([]);
  });

  it("embeds no cloud/token secrets outside tests", { timeout: 60_000 }, () => {
    const patterns = [/AKIA[0-9A-Z]{16}/, /xox[bap]-[A-Za-z0-9-]+/, /sk-live-[A-Za-z0-9]+/, /whsec_[A-Za-z0-9]+/];
    const hits = SRC_FILES.filter((file) => !file.endsWith(".test.ts"))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .filter((line) => patterns.some((pattern) => pattern.test(line)))
          .map((line) => `${file} :: ${line.trim().slice(0, 80)}`),
      );
    expect(hits).toEqual([]);
  });

  it("commits no database URL carrying a real password", { timeout: 60_000 }, () => {
    const pattern = /postgres(ql)?:\/\/[^/\s:]+:[^/\s@]+@/;
    const hits = SRC_FILES.filter((file) => !file.endsWith(".test.ts"))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .filter((line) => pattern.test(line) && !isPlaceholder(line))
          .map((line) => `${file} :: ${line.trim().slice(0, 80)}`),
      );
    expect(hits).toEqual([]);
  });
});
