import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_CHANNELS,
  ANNOUNCEMENT_LANGUAGES,
  ANNOUNCEMENT_TYPES,
  AUDIENCE_RULE_MAX_LENGTH,
  DEFAULT_EXPIRY_DAYS,
  DELIVERY_POSTURE,
  PUBLISH_AT_FALLBACK,
  QUIET_HOURS,
  UNAVAILABLE_METRICS,
  PERSISTED_FIELDS,
  UNPERSISTED_FIELDS,
  announcementActionGates,
  audienceRefusal,
  defaultExpiryDate,
  deriveAnnouncementState,
  expiryInstantFromDate,
  matchesAudience,
  parseAudienceRule,
  quietHoursDecision,
  resolveAudienceOver,
  type AudienceCandidate,
} from "./announcement-register";

/**
 * SCR-066 / FRM-EXP-03. Pure derivation only — no database, no network.
 * Every assertion is about a rule the workbook states or about a fact this
 * repository's write path forces on the screen.
 */

const POPULATION: AudienceCandidate[] = [
  { id: "e1", employeeCode: "EMP-001", name: "Asha Rao", department: "Engineering", location: "Pune", designation: "Engineer", legalEntityId: "le-1" },
  { id: "e2", employeeCode: "EMP-002", name: "Bhavin Shah", department: "Engineering", location: "Mumbai", designation: "Lead", legalEntityId: "le-1" },
  { id: "e3", employeeCode: "EMP-003", name: "Chitra Nair", department: "Finance", location: "Pune", designation: "Analyst", legalEntityId: "le-2" },
];

describe("announcement vocabularies (SCR-066)", () => {
  it("carries the five PL_ANNOUNCEMENT_TYPE values", () => {
    expect(ANNOUNCEMENT_TYPES.map((entry) => entry.label)).toEqual(["General", "Policy", "Emergency", "Celebration", "Statutory notice"]);
  });

  it("carries the five PL_ANNOUNCEMENT_CHANNEL values and allows more than one", () => {
    expect(ANNOUNCEMENT_CHANNELS.map((entry) => entry.label)).toEqual([
      "Employee portal",
      "Mobile push",
      "Email",
      "WhatsApp",
      "Notice board display",
    ]);
  });

  it("carries fourteen PL_LANGUAGE values", () => {
    expect(ANNOUNCEMENT_LANGUAGES).toHaveLength(14);
    expect(new Set(ANNOUNCEMENT_LANGUAGES.map((entry) => entry.code)).size).toBe(14);
  });
});

describe("audience rule parsing (SCR-066)", () => {
  it("accepts `all` as everyone", () => {
    const parsed = parseAudienceRule(" All ");
    expect(parsed.ok && parsed.everyone).toBe(true);
  });

  it("parses multiple clauses and canonicalises them", () => {
    const parsed = parseAudienceRule("department:Engineering; location:Pune,Mumbai");
    expect(parsed.ok && parsed.canonical).toBe("department:Engineering;location:Pune,Mumbai");
    expect(parsed.ok && parsed.clauses).toEqual([
      { key: "department", values: ["Engineering"] },
      { key: "location", values: ["Pune", "Mumbai"] },
    ]);
  });

  it("refuses a dimension with no employee relationship rather than resolving it loosely", () => {
    const parsed = parseAudienceRule("band:B3");
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.error).toContain("No employee-to-band relationship");
  });

  it("refuses a rule longer than the 120 characters the write endpoint stores", () => {
    const parsed = parseAudienceRule(`department:${"x".repeat(AUDIENCE_RULE_MAX_LENGTH)}`);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.error).toContain("120");
  });

  it("refuses an empty rule and a clause with no value", () => {
    expect(parseAudienceRule("   ").ok).toBe(false);
    expect(parseAudienceRule("location:").ok).toBe(false);
    expect(parseAudienceRule("Engineering").ok).toBe(false);
  });

  it("ANDs across clauses and ORs within one, case-insensitively", () => {
    const parsed = parseAudienceRule("department:engineering;location:PUNE");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(matchesAudience(POPULATION[0]!, parsed.clauses)).toBe(true);
    expect(matchesAudience(POPULATION[1]!, parsed.clauses)).toBe(false);
    expect(matchesAudience(POPULATION[2]!, parsed.clauses)).toBe(false);
  });
});

describe("audience resolution and the empty-audience refusal (SCR-066)", () => {
  it("resolves a real head-count against the supplied population", () => {
    const resolved = resolveAudienceOver("location:Pune", POPULATION);
    expect(resolved.resolvedCount).toBe(2);
    expect(resolved.populationCount).toBe(3);
    expect(audienceRefusal(resolved)).toBe("");
  });

  it("resolves `all` to the whole active population", () => {
    expect(resolveAudienceOver("all", POPULATION).resolvedCount).toBe(3);
  });

  it("refuses an announcement whose rule resolves to nobody", () => {
    const resolved = resolveAudienceOver("location:Chennai", POPULATION);
    expect(resolved.valid).toBe(true);
    expect(resolved.resolvedCount).toBe(0);
    expect(audienceRefusal(resolved)).toContain("resolves to 0 of 3");
    expect(audienceRefusal(resolved)).toContain("refused");
  });

  it("refuses when there is no population at all to resolve against", () => {
    const resolved = resolveAudienceOver("all", []);
    expect(resolved.resolvedCount).toBe(0);
    expect(audienceRefusal(resolved)).toContain("no active employees");
  });

  it("refuses an unresolvable rule as an unknown audience rather than publishing to it", () => {
    const resolved = resolveAudienceOver("band:B3", POPULATION);
    expect(resolved.valid).toBe(false);
    expect(audienceRefusal(resolved)).toContain("audience is unknown");
  });

  it("breaks the resolved audience down by department and location", () => {
    const resolved = resolveAudienceOver("all", POPULATION);
    expect(resolved.byDepartment).toEqual([
      { key: "Engineering", label: "Engineering", count: 2 },
      { key: "Finance", label: "Finance", count: 1 },
    ]);
    expect(resolved.byLocation.map((row) => row.key)).toEqual(["Pune", "Mumbai"]);
  });
});

describe("expiry defaulting (SCR-066)", () => {
  it("defaults `expires on` to publish plus thirty days", () => {
    expect(DEFAULT_EXPIRY_DAYS).toBe(30);
    expect(defaultExpiryDate("2026-01-01T00:00:00.000Z")).toBe("2026-01-31");
  });

  it("carries the default across a month boundary and a leap day", () => {
    expect(defaultExpiryDate("2026-09-14T09:30:00.000Z")).toBe("2026-10-14");
    expect(defaultExpiryDate("2028-02-01T00:00:00.000Z")).toBe("2028-03-02");
  });

  it("returns nothing for an unparseable publish instant rather than a guessed date", () => {
    expect(defaultExpiryDate("not-a-date")).toBe("");
  });

  it("treats the stored expiry date as inclusive, matching the existing read", () => {
    expect(expiryInstantFromDate("2026-03-31")).toBe("2026-03-31T23:59:59.999Z");
    expect(expiryInstantFromDate(null)).toBeNull();
    expect(expiryInstantFromDate("31-03-2026")).toBeNull();
  });
});

describe("state derivation across the four states (SCR-066)", () => {
  const publishAt = "2026-06-01T10:00:00.000Z";

  it("holds a stored draft back regardless of the clock", () => {
    const derived = deriveAnnouncementState({ storedState: "draft", publishAt, expiresAt: null, now: "2026-07-01T00:00:00.000Z" });
    expect(derived.state).toBe("draft");
    expect(derived.basis).toBe("stored");
  });

  it("keeps a stored archived state without re-deriving it", () => {
    const derived = deriveAnnouncementState({ storedState: "archived", publishAt, expiresAt: null, now: publishAt });
    expect(derived.state).toBe("archived");
    expect(derived.basis).toBe("stored");
  });

  it("is scheduled one millisecond before publish-at", () => {
    const derived = deriveAnnouncementState({ storedState: null, publishAt, expiresAt: null, now: "2026-06-01T09:59:59.999Z" });
    expect(derived.state).toBe("scheduled");
    expect(derived.basis).toBe("publish_at");
  });

  it("is published at exactly publish-at — the boundary belongs to published", () => {
    const derived = deriveAnnouncementState({ storedState: null, publishAt, expiresAt: null, now: publishAt });
    expect(derived.state).toBe("published");
    expect(derived.basis).toBe("publish_at");
  });

  it("is published one millisecond after publish-at", () => {
    const derived = deriveAnnouncementState({ storedState: null, publishAt, expiresAt: null, now: "2026-06-01T10:00:00.001Z" });
    expect(derived.state).toBe("published");
  });

  it("is published one millisecond before the expiry instant", () => {
    const expiresAt = expiryInstantFromDate("2026-07-01");
    const derived = deriveAnnouncementState({ storedState: null, publishAt, expiresAt, now: "2026-07-01T23:59:59.998Z" });
    expect(derived.state).toBe("published");
  });

  it("is archived at exactly the expiry instant — the boundary belongs to archived", () => {
    const expiresAt = expiryInstantFromDate("2026-07-01");
    const derived = deriveAnnouncementState({ storedState: null, publishAt, expiresAt, now: "2026-07-01T23:59:59.999Z" });
    expect(derived.state).toBe("archived");
    expect(derived.basis).toBe("expiry");
  });

  it("is still published on the expiry date itself, as the existing read keeps it visible", () => {
    const expiresAt = expiryInstantFromDate("2026-07-01");
    const derived = deriveAnnouncementState({ storedState: null, publishAt, expiresAt, now: "2026-07-01T00:00:01.000Z" });
    expect(derived.state).toBe("published");
  });

  it("lets a passed expiry beat a future publish-at", () => {
    const expiresAt = expiryInstantFromDate("2026-01-01");
    const derived = deriveAnnouncementState({ storedState: null, publishAt: "2027-01-01T00:00:00.000Z", expiresAt, now: "2026-06-01T00:00:00.000Z" });
    expect(derived.state).toBe("archived");
    expect(derived.basis).toBe("expiry");
  });

  it("names the clock, not a write, as the source of scheduled and archived", () => {
    const scheduled = deriveAnnouncementState({ storedState: null, publishAt: "2027-01-01T00:00:00.000Z", expiresAt: null, now: "2026-06-01T00:00:00.000Z" });
    expect(scheduled.reason).toContain("Nothing was written");
    const archived = deriveAnnouncementState({ storedState: null, publishAt, expiresAt: expiryInstantFromDate("2026-01-01"), now: "2026-06-01T00:00:00.000Z" });
    expect(archived.reason).toContain("Nothing was written");
  });

  it("records that no stored publish-at exists, so scheduled is unreachable today", () => {
    expect(PUBLISH_AT_FALLBACK.source).toBe("feed_posts.created_at");
    expect(PUBLISH_AT_FALLBACK.note).toContain("never in the future");
  });
});

describe("quiet hours and the emergency bypass (SCR-066)", () => {
  it("reports the quiet-hours window as unconfigured instead of inventing one", () => {
    expect(QUIET_HOURS.configured).toBe(false);
    expect(QUIET_HOURS.window).toBeNull();
    expect(QUIET_HOURS.detail).toContain("No quiet-hours window is defined");
  });

  it("carries the bypass as a real property of an emergency announcement", () => {
    const decision = quietHoursDecision("emergency");
    expect(decision.bypass).toBe(true);
    expect(decision.windowConfigured).toBe(false);
    expect(decision.held).toBe(false);
    expect(decision.reason).toContain("No window is configured");
  });

  it("gives every other type no bypass, and says nothing was checked", () => {
    for (const type of ["general", "policy", "celebration", "statutory_notice"] as const) {
      const decision = quietHoursDecision(type);
      expect(decision.bypass).toBe(false);
      expect(decision.held).toBe(false);
      expect(decision.reason).toContain("Do not read this as the announcement having passed a quiet-hours check");
    }
  });
});

describe("action gates (SCR-066)", () => {
  const good = resolveAudienceOver("all", POPULATION);
  const empty = resolveAudienceOver("location:Chennai", POPULATION);

  function gate(gates: ReturnType<typeof announcementActionGates>, action: string) {
    return gates.find((entry) => entry.action === action)!;
  }

  it("allows create and publish on the compose form when the audience resolves", () => {
    const gates = announcementActionGates({ state: null, audience: good, canWrite: true });
    expect(gate(gates, "create").allowed).toBe(true);
    expect(gate(gates, "publish").allowed).toBe(true);
    expect(gate(gates, "create").reason).toContain("3 employees");
  });

  it("refuses create when the audience is empty, and says why", () => {
    const gates = announcementActionGates({ state: null, audience: empty, canWrite: true });
    expect(gate(gates, "create").allowed).toBe(false);
    expect(gate(gates, "create").reason).toContain("resolves to 0 of 3");
  });

  it("refuses create without the write permission", () => {
    const gates = announcementActionGates({ state: null, audience: good, canWrite: false });
    expect(gate(gates, "create").allowed).toBe(false);
    expect(gate(gates, "create").reason).toContain("employee write permission");
  });

  it("never offers schedule, because no publish-at can be stored", () => {
    for (const state of [null, "published", "archived"] as const) {
      const gates = announcementActionGates({ state, audience: good, canWrite: true });
      expect(gate(gates, "schedule").allowed).toBe(false);
      expect(gate(gates, "schedule").reason).toContain("accepts no publish-at");
    }
  });

  it("never offers archive, because archiving is derived from expiry and not written", () => {
    const gates = announcementActionGates({ state: "published", audience: good, canWrite: true });
    expect(gate(gates, "archive").allowed).toBe(false);
    expect(gate(gates, "archive").reason).toContain("no state column to set");
  });

  it("refuses re-publishing an existing announcement", () => {
    const published = announcementActionGates({ state: "published", audience: good, canWrite: true });
    expect(gate(published, "publish").allowed).toBe(false);
    expect(gate(published, "publish").reason).toContain("already published");
    const archived = announcementActionGates({ state: "archived", audience: good, canWrite: true });
    expect(gate(archived, "publish").reason).toContain("cannot be brought back");
  });
});

describe("honesty declarations (SCR-066)", () => {
  it("states that nothing transmits on any channel", () => {
    expect(DELIVERY_POSTURE.transmits).toBe(false);
    expect(DELIVERY_POSTURE.summary).toContain("does not send");
    expect(DELIVERY_POSTURE.detail).toContain("configured and validated");
  });

  it("names what the product still cannot do with a stored field", () => {
    const fields = UNPERSISTED_FIELDS.map((entry) => entry.field);
    // The type, the channels, the publish-at instant and the language variants are all
    // stored now; what is missing is a transport and a scheduler that act on them.
    expect(fields).toContain("Delivery on the selected channels");
    expect(fields).toContain("Scheduled publishing");
    expect(fields).toContain("The acknowledged version");
    expect(fields).not.toContain("Announcement type");
    expect(UNPERSISTED_FIELDS.every((entry) => entry.reason.length > 0)).toBe(true);
  });

  it("lists the announcement fields the write path keeps", () => {
    for (const field of ["announcementType", "channels", "publishAt", "acknowledgementRequired", "languageVariants", "attachmentDocumentId"]) {
      expect(PERSISTED_FIELDS).toContain(field);
    }
  });

  it("declares read and acknowledgement counts unavailable rather than producing a number", () => {
    const metrics = UNAVAILABLE_METRICS.map((entry) => entry.metric);
    expect(metrics).toEqual(["Read count", "Acknowledgement count", "Acknowledged version"]);
  });
});
