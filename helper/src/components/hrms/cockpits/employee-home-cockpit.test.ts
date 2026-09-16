import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/hrms/cockpits/employee-home-cockpit.tsx"),
  "utf8",
);

function callbackBody(name: string): string {
  const start = source.indexOf(`const ${name} = useCallback(`);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf("}, [cockpit, refresh]);", start));
}

describe("S8 punch clock", () => {
  const punchOut = callbackBody("punchOut");
  const punchIn = callbackBody("punchIn");

  it("posts only the out punch, never the stored punch-in alongside it", () => {
    // Re-posting the recorded IN wrote a duplicate IN row on every punch-out.
    expect(punchOut).toContain('punches: [{ at: new Date().toISOString(), type: "out", source: "web" }]');
    expect(punchOut).not.toContain("at: shift.punchedInAt");
  });

  it("posts exactly one in punch when opening the day", () => {
    expect(punchIn).toContain('punches: [{ at: new Date().toISOString(), type: "in", source: "web" }]');
  });

  it("gates each control on the derived session state rather than a stored timestamp", () => {
    expect(punchIn).toContain("if (shift.sessionOpen) return;");
    expect(punchOut).toContain("if (!shift.sessionOpen) return;");
  });

  it("sends one idempotency key per punch so a retry cannot double-post", () => {
    for (const body of [punchIn, punchOut]) {
      expect(body).toContain('"idempotency-key": idempotencyKey()');
    }
  });

  it("shows the server's own refusal instead of inventing a reason", () => {
    for (const body of [punchIn, punchOut]) {
      expect(body).toContain("typeof detail.message === \"string\"");
      expect(body).toContain("The punch was refused (${response.status})");
    }
  });

  it("keeps the honest empty state for figures the platform has not produced", () => {
    expect(source).toContain('{shift.workedMinutes === null ? "—" : minutesLabel(shift.workedMinutes)}');
    expect(source).toContain('{shift.breakMinutes === null ? "—" : minutesLabel(shift.breakMinutes)}');
    expect(source).toContain("shift.targetMinutes === null ?");
  });

  it("uses semantic tokens only — no hardcoded colour literals", () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/);
    expect(source).not.toMatch(/\b(?:bg|text|border)-(?:red|green|blue|amber|slate|zinc|gray|emerald|rose)-\d{2,3}\b/);
  });
});
