import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { slaRemaining } from "./helpdesk-page";

const helpdesk = readFileSync(resolve(process.cwd(), "src/components/hrms/helpdesk-page.tsx"), "utf8");
const org = readFileSync(resolve(process.cwd(), "src/components/hrms/org-registers.tsx"), "utf8");
const engine = readFileSync(resolve(process.cwd(), "src/server/compliance/wage-floor.ts"), "utf8");

// Only the statutory console is under test in this file; the other registers in
// org-registers.tsx belong to their own suites.
const statutory = org.slice(
  org.indexOf("const MINOR_UNITS_PER_MAJOR"),
  org.indexOf("/* ---------------- Access scope administration ---------------- */"),
);

describe("Helpdesk & Grounded Policy Assistant", () => {
  it("names the console and its purpose", () => {
    expect(helpdesk).toContain("Helpdesk & Grounded Policy Assistant");
    expect(helpdesk).toContain("SLA-governed ticket routing");
    expect(helpdesk).toContain("verifiable source clause citations");
  });

  it("renders both module tabs", () => {
    for (const label of ["Support Tickets", "Grounded Policy Assistant"]) {
      expect(helpdesk, `missing the ${label} tab`).toContain(label);
    }
    expect(helpdesk).toContain("<ModuleTabs");
    expect(helpdesk).toContain("<TabPanel");
    // The tickets tab carries the live queue count.
    expect(helpdesk).toContain('entry.id === "tickets" ? tickets.length : null');
  });

  it("keeps every governed ticket endpoint and audited action", () => {
    for (const path of [
      "/api/v1/operations/tickets",
      "/history?pageSize=100",
      "/api/v1/people?search=&page=1&pageSize=100",
    ]) {
      expect(helpdesk, `does not call ${path}`).toContain(path);
    }
    for (const action of ["assign", "reply", "resolve", "close", "reopen"]) {
      expect(helpdesk, `missing the ${action} action`).toContain(`"${action}"`);
    }
    expect(helpdesk).toContain("Idempotency-Key");
    expect(helpdesk).toContain("If-Match");
    expect(helpdesk).toContain("Raise Support Ticket");
  });

  it("filters the queue with chips built from the categories actually present", () => {
    expect(helpdesk).toContain('const [categoryChip, setCategoryChip] = useState("ALL")');
    expect(helpdesk).toContain('["ALL", ...[...new Set(tickets.map((row) => str(row.category)).filter(Boolean))].sort().map((value) => value.toUpperCase())]');
    expect(helpdesk).toContain("aria-pressed={categoryChip === chip}");
    // The category and priority drop-downs the chips replaced are gone.
    expect(helpdesk).not.toContain("setPriorityFilter");
    expect(helpdesk).not.toContain("setCategoryFilter");
  });

  it("renders tickets as cards carrying requester, assignee and SLA", () => {
    for (const fragment of ["Requester ", "Assignee ", "SLA · ", "Unassigned", "priorityTone("]) {
      expect(helpdesk, `missing the ${fragment} card detail`).toContain(fragment);
    }
    expect(helpdesk).toContain("peopleById");
  });

  it("searches the policy corpus and cites every clause", () => {
    expect(helpdesk).toContain("/api/v1/ai/knowledge?q=");
    expect(helpdesk).toContain("Source citation");
    expect(helpdesk).toContain("No policy clause matched this question");
  });

  it("covers loading, error and empty states", () => {
    expect(helpdesk).toContain("<RegisterStates");
    expect(helpdesk).toContain("No tickets in this view");
    expect(helpdesk).toContain("Support tickets unavailable");
    expect(helpdesk).toContain("The policy corpus could not be searched");
    expect(helpdesk).toContain('role="status"');
    expect(helpdesk).toContain('role="alert"');
    expect(helpdesk).not.toMatch(/Math\.random|faker|placeholder data/i);
  });
});

describe("slaRemaining", () => {
  const now = new Date("2026-09-14T10:00:00.000Z");

  it("reports no target rather than inventing a due date", () => {
    for (const missing of [null, "", "   ", "not-a-date"]) {
      expect(slaRemaining(missing, now)).toEqual({ label: "No SLA target", breached: false, escalated: false });
    }
  });

  it("counts minutes down inside the last hour and flags the escalation window", () => {
    expect(slaRemaining("2026-09-14T10:45:00.000Z", now)).toEqual({
      label: "45m remaining",
      breached: false,
      escalated: true,
    });
  });

  it("counts hours and minutes down outside the escalation window", () => {
    expect(slaRemaining("2026-09-14T12:15:00.000Z", now)).toEqual({
      label: "2h 15m remaining",
      breached: false,
      escalated: false,
    });
    // A whole number of hours drops the empty minute part.
    expect(slaRemaining("2026-09-14T14:00:00.000Z", now).label).toBe("4h remaining");
    expect(slaRemaining("2026-09-16T13:00:00.000Z", now).label).toBe("2d 3h remaining");
  });

  it("reports a breach with the elapsed span", () => {
    expect(slaRemaining("2026-09-14T07:00:00.000Z", now)).toEqual({
      label: "Breached 3h ago",
      breached: true,
      escalated: true,
    });
    expect(slaRemaining("2026-09-14T09:30:00.000Z", now).label).toBe("Breached 30m ago");
  });

  it("stops the clock at an audited resolution", () => {
    expect(slaRemaining("2026-09-14T12:00:00.000Z", now, "2026-09-14T09:00:00.000Z")).toEqual({
      label: "Resolved on-time",
      breached: false,
      escalated: false,
    });
    // Resolving late is still a breach, measured at the resolution.
    expect(slaRemaining("2026-09-14T12:00:00.000Z", now, "2026-09-14T14:00:00.000Z")).toEqual({
      label: "Breached 2h ago",
      breached: true,
      escalated: true,
    });
  });

  it("reads a date-only target as the end of that day, matching the overdue rule", () => {
    // Both instants are local so the assertion holds in any timezone.
    expect(slaRemaining("2026-09-14", new Date("2026-09-14T22:59:59")).breached).toBe(false);
    expect(slaRemaining("2026-09-13", new Date("2026-09-14T00:30:00")).breached).toBe(true);
  });
});

describe("Statutory Compliance Engine & 2026 Labour Codes Simulator", () => {
  it("names the console and its purpose", () => {
    expect(statutory).toContain("Statutory Compliance Engine & 2026 Labour Codes Simulator");
    expect(statutory).toContain("Code on Wages, Social Security, Industrial Relations, OSH");
    expect(statutory).toContain("statutory obligation calendar");
  });

  it("renders the five module tabs with a live obligation count", () => {
    for (const label of [
      "50% Wage Floor Simulator",
      "Statutory Obligations",
      "Factory Act Registers",
      "ERP Master Sync & GL Queue",
      "Statutory Rule Packs",
    ]) {
      expect(statutory, `missing the ${label} tab`).toContain(label);
    }
    expect(statutory).toContain("<ModuleTabs");
    expect(statutory).toContain("<TabPanel");
    expect(statutory).toContain('entry.id === "obligations" ? obligations.length : null');
  });

  it("drives only governed endpoints", () => {
    for (const path of [
      "/api/v1/compliance/wage-floor",
      "/api/v1/compliance/obligations",
      "/api/v1/compliance/evidence",
      "/api/v1/compliance/forms",
      "/api/v1/operations/filings?pageSize=100",
    ]) {
      expect(statutory, `does not call ${path}`).toContain(path);
    }
  });

  it("exposes the header actions and badges the stored rule pack", () => {
    expect(statutory).toContain("Audit Dossier");
    expect(statutory).toContain('href="/document-vault"');
    expect(statutory).toContain("Run Simulator");
    expect(statutory).toContain('onClick={() => setTab("simulator")}');
    expect(statutory).toContain("Rule pack {packCode");
    expect(statutory).toContain("Version {packVersion}");
  });

  it("builds the simulator from sliders and a live Basic + DA indicator", () => {
    expect(statutory).toContain("Salary Structure Inputs (Monthly)");
    expect(statutory).toContain("Statutory Floor Add-Back Engine");
    expect(statutory).toContain('type="range"');
    for (const field of ["Total Monthly Gross", "Basic", "Dearness Allowance", "HRA", "Special Allowance"]) {
      expect(statutory, `missing the ${field} slider`).toContain(field);
    }
    expect(statutory).toContain("Basic + DA: {basicDaPercent.toFixed(2)}%");
    expect(statutory).toContain("belowFloor ? \"border-warning/30");
    // Debounced POST on change, never a per-keystroke request.
    expect(statutory).toContain("window.setTimeout(");
    expect(statutory).toContain("window.clearTimeout(handle)");
  });

  it("renders the unconfigured state instead of computing without a stored pack", () => {
    expect(statutory).toContain("No statutory rate pack is configured");
    expect(statutory).toContain("floorPercent === null ? (");
    expect(statutory).toContain("no percentage is assumed on your behalf");
    expect(statutory).toContain("The configured pack stores no contribution rates");
  });

  it("shows the declared base against the statutory base with a variance row per rate", () => {
    for (const fragment of ["Declared wage base", "Statutory wage base", "Pre-code", "Post-code", "Delta", "resultLines.map"]) {
      expect(statutory, `missing ${fragment}`).toContain(fragment);
    }
  });

  it("never prints a raw minor amount", () => {
    expect(statutory).toContain("MINOR_UNITS_PER_MAJOR = 100");
    expect(statutory).toContain("parsed / MINOR_UNITS_PER_MAJOR");
    for (const fragment of [
      "formatMinor(result.declaredBaseMinor)",
      "formatMinor(result.statutoryBaseMinor)",
      "formatMinor(result.addBackMinor)",
      "formatMinor(line.preCodeMinor)",
      "formatMinor(line.postCodeMinor)",
      "formatMinor(line.deltaMinor)",
    ]) {
      expect(statutory, `${fragment} is missing — a minor amount would print raw`).toContain(fragment);
    }
  });

  it("covers loading, error and empty states", () => {
    expect(statutory).toContain("<RegisterStates");
    expect(statutory).toContain("No obligations in this view");
    expect(statutory).toContain("Obligations unavailable");
    expect(statutory).toContain("No statutory forms are generated yet");
    expect(statutory).toContain('role="status"');
    expect(statutory).toContain('role="alert"');
    expect(statutory).not.toMatch(/Math\.random|faker|placeholder data/i);
  });
});

describe("the wage-floor engine hardcodes no statutory figure", () => {
  it("carries no bare contribution, gratuity or floor percentage", () => {
    const numbers = engine.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) ?? [];
    // 0 and 1 are structural, 100 converts a stored percentage to a fraction,
    // 200 caps a stored label's length and 2026 only names the Labour Codes.
    const unexpected = numbers.filter((value) => !["0", "1", "100", "200", "2026"].includes(value));
    expect(unexpected, `unexpected numeric literals: ${unexpected.join(", ")}`).toEqual([]);
    for (const literal of [/\b0\.12\b/, /\b12\b/, /\b15\b/, /\b26\b/, /\b50\b/]) {
      expect(engine, `the engine must not contain ${literal}`).not.toMatch(literal);
    }
  });

  it("takes the floor percentage and every rate as arguments", () => {
    expect(engine).toContain("rates: StatutoryRate[],");
    expect(engine).toContain("floorPercent: number,");
    expect(engine).toContain("rates.length === 0 ? null :");
  });
});
