// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  NO_VALUE,
  attendanceStatusFor,
  dayPartForHour,
  firstNameOf,
  greetingFor,
  hourInZone,
  initialsOf,
  instantClockOrDash,
  longDateLabel,
  minutesOrDash,
  punchControlFor,
  punchStateOf,
  shiftLabel,
  textOrDash,
  workedShare,
} from "./employee-welcome-hero";

/* ------------------------------------------------------------------ */
/* 1 · The greeting boundary                                           */
/* ------------------------------------------------------------------ */

describe("greeting time-of-day boundary", () => {
  it.each([0, 5, 11])("reads %i:00 as morning", (hour) => {
    expect(dayPartForHour(hour)).toBe("morning");
  });

  it.each([12, 15, 16])("reads %i:00 as afternoon", (hour) => {
    expect(dayPartForHour(hour)).toBe("afternoon");
  });

  it.each([17, 21, 23])("reads %i:00 as evening", (hour) => {
    expect(dayPartForHour(hour)).toBe("evening");
  });

  it("turns over exactly at noon and at five", () => {
    expect(dayPartForHour(11)).toBe("morning");
    expect(dayPartForHour(12)).toBe("afternoon");
    expect(dayPartForHour(16)).toBe("afternoon");
    expect(dayPartForHour(17)).toBe("evening");
  });

  it("does not throw on an unusable hour, because it renders inside a heading", () => {
    expect(dayPartForHour(Number.NaN)).toBe("morning");
    expect(dayPartForHour(24)).toBe("morning");
    expect(dayPartForHour(-1)).toBe("evening");
  });

  it("addresses the person by their recorded first name", () => {
    expect(greetingFor(9, "Anita")).toBe("Good morning, Anita!");
    expect(greetingFor(13, "Anita")).toBe("Good afternoon, Anita!");
    expect(greetingFor(19, "Anita")).toBe("Good evening, Anita!");
  });

  it("greets without a name rather than inventing one when none is recorded", () => {
    expect(greetingFor(9, null)).toBe("Good morning!");
    expect(greetingFor(9, "   ")).toBe("Good morning!");
    expect(greetingFor(9, undefined)).toBe("Good morning!");
  });

  it("takes the first token of a full name, and nothing at all from an empty record", () => {
    expect(firstNameOf("  Anita   Raghavan ")).toBe("Anita");
    expect(firstNameOf("Anita")).toBe("Anita");
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });

  it("reads the hour on the tenant's clock when one is configured", () => {
    // 03:30 UTC is 09:00 in Kolkata and 12:30 in Auckland: the same instant
    // greets one tenant good morning and the other good afternoon.
    const instant = new Date("2026-09-16T03:30:00.000Z");
    expect(hourInZone(instant, "Asia/Kolkata")).toBe(9);
    expect(dayPartForHour(hourInZone(instant, "Asia/Kolkata"))).toBe("morning");
    expect(hourInZone(instant, "Pacific/Auckland")).toBe(15);
    expect(dayPartForHour(hourInZone(instant, "Pacific/Auckland"))).toBe("afternoon");
  });

  it("falls back to the browser clock rather than guessing when the zone is absent or unusable", () => {
    const instant = new Date("2026-09-16T03:30:00.000Z");
    expect(hourInZone(instant, null)).toBe(instant.getHours());
    expect(hourInZone(instant, "   ")).toBe(instant.getHours());
    expect(hourInZone(instant, "Not/AZone")).toBe(instant.getHours());
  });
});

/* ------------------------------------------------------------------ */
/* 2 · Which punch control renders                                     */
/* ------------------------------------------------------------------ */

describe("punch state decision", () => {
  const open = { sessionOpen: true, punchedInAt: "2026-09-16T03:48:00.000Z" };
  const closed = { sessionOpen: false, punchedInAt: "2026-09-16T03:48:00.000Z" };
  const none = { sessionOpen: false, punchedInAt: null };

  it("reads a running clock as an open session", () => {
    expect(punchStateOf(open)).toBe("open");
  });

  it("reads the day's first IN with no running clock as a closed day", () => {
    expect(punchStateOf(closed)).toBe("closed");
  });

  it("reads a day with no punches as no session, not as a closed one", () => {
    expect(punchStateOf(none)).toBe("none");
    expect(punchStateOf({ sessionOpen: false, punchedInAt: "  " })).toBe("none");
    expect(punchStateOf(null)).toBe("none");
    expect(punchStateOf(undefined)).toBe("none");
  });

  it("offers Punch out — and only Punch out — while a session is open", () => {
    const control = punchControlFor("open");
    expect(control.kind).toBe("punch-out");
    expect(control.label).toBe("Punch out");
  });

  it("offers Punch in on a day with no punches", () => {
    expect(punchControlFor("none").kind).toBe("punch-in");
  });

  it("still offers Punch in on a closed day, leaving the 409 to the engine", () => {
    // The engine, not this component, decides whether a second session may open.
    // Pre-empting its refusal would put a guess in front of the real answer.
    expect(punchControlFor("closed").kind).toBe("punch-in");
  });

  it("never yields both controls for one state", () => {
    for (const state of ["open", "closed", "none"] as const) {
      const control = punchControlFor(state);
      expect(["punch-in", "punch-out"]).toContain(control.kind);
    }
  });

  it("words the status so the state is never carried by colour alone", () => {
    expect(attendanceStatusFor("open")).toEqual({ tone: "success", label: "On the clock" });
    expect(attendanceStatusFor("closed")).toEqual({ tone: "info", label: "Session closed for today" });
    expect(attendanceStatusFor("none")).toEqual({ tone: "neutral", label: "No punch recorded today" });
  });
});

/* ------------------------------------------------------------------ */
/* 3 · An absent value is a dash, never a zero                         */
/* ------------------------------------------------------------------ */

describe("absent values render as a dash, not a fabricated zero", () => {
  it("dashes a minute count the platform has not produced", () => {
    expect(minutesOrDash(null)).toBe(NO_VALUE);
    expect(minutesOrDash(undefined)).toBe(NO_VALUE);
    expect(minutesOrDash(Number.NaN)).toBe(NO_VALUE);
    expect(minutesOrDash(null)).not.toBe("0h 00m");
  });

  it("keeps a genuinely recorded zero, which is a real reading", () => {
    expect(minutesOrDash(0)).toBe("0h 00m");
    expect(minutesOrDash(510)).toBe("8h 30m");
  });

  it("dashes an unrecorded string, treating an empty field as absent", () => {
    expect(textOrDash(null)).toBe(NO_VALUE);
    expect(textOrDash("")).toBe(NO_VALUE);
    expect(textOrDash("   ")).toBe(NO_VALUE);
    expect(textOrDash(" Bengaluru ")).toBe("Bengaluru");
  });

  it("dashes a punch time that was never recorded", () => {
    expect(instantClockOrDash(null)).toBe(NO_VALUE);
    expect(instantClockOrDash("")).toBe(NO_VALUE);
    expect(instantClockOrDash("not an instant")).toBe(NO_VALUE);
    expect(instantClockOrDash("2026-09-16T03:48:00.000Z", "Asia/Kolkata")).toContain("09");
  });

  it("dashes a working date the payload did not supply", () => {
    expect(longDateLabel(null)).toBe(NO_VALUE);
    expect(longDateLabel("")).toBe(NO_VALUE);
    expect(longDateLabel("16/09/2026")).toBe(NO_VALUE);
    expect(longDateLabel("2026-09-16")).not.toBe(NO_VALUE);
  });

  it("withholds the progress share rather than showing 0% when a side is missing", () => {
    expect(workedShare(null, 510)).toBeNull();
    expect(workedShare(240, null)).toBeNull();
    expect(workedShare(240, 0)).toBeNull();
    expect(workedShare(undefined, undefined)).toBeNull();
    expect(workedShare(Number.NaN, 510)).toBeNull();
  });

  it("computes the share only when both the worked figure and the target are real", () => {
    expect(workedShare(255, 510)).toBe(50);
    expect(workedShare(0, 510)).toBe(0);
    expect(workedShare(600, 510)).toBe(100);
  });

  it("states the absence of a shift in words instead of printing an empty window", () => {
    expect(shiftLabel(null)).toBe("No shift assigned");
    expect(shiftLabel({ shiftName: null, shiftCode: null, startsAt: null, endsAt: null })).toBe("No shift assigned");
    expect(shiftLabel({ shiftName: null, shiftCode: "A", startsAt: null, endsAt: null })).toBe("A");
    expect(shiftLabel({ shiftName: "General", shiftCode: "A", startsAt: "09:00", endsAt: "18:00" })).toBe(
      "General · 09:00–18:00",
    );
    expect(shiftLabel({ shiftName: null, shiftCode: null, startsAt: "09:00", endsAt: "18:00" })).toBe("09:00–18:00");
  });

  it("dashes the avatar initials rather than inventing a monogram — there is no photo field", () => {
    expect(initialsOf(null)).toBe(NO_VALUE);
    expect(initialsOf("  ")).toBe(NO_VALUE);
    expect(initialsOf("Anita")).toBe("AN");
    expect(initialsOf("Anita Raghavan")).toBe("AR");
    expect(initialsOf("Anita Devi Raghavan")).toBe("AR");
  });
});
