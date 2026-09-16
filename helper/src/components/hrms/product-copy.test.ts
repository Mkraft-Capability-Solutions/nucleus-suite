import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS = ["people-pages.tsx", "capability-pages.tsx", "work-pages.tsx", "platform-pages.tsx"];

function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("product-facing copy", () => {
  it("does not expose API routes or missing-endpoint implementation notes", () => {
    const visibleSource = COMPONENTS
      .map((file) => readFileSync(resolve(process.cwd(), "src/components/hrms", file), "utf8"))
      .map(withoutComments)
      .join("\n");

    expect(visibleSource).not.toMatch(/(?:GET|POST|PATCH|DELETE) \/api\//);
    expect(visibleSource).not.toMatch(/no (?:list|read) endpoint/i);
    expect(visibleSource).not.toMatch(/write-only in v1/i);
  });
});
