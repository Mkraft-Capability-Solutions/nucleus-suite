import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/platform/http";
import {
  BACKOFF_MINUTES,
  backoffForAttempt,
  classifyFailure,
  dedupeKey,
  isAuthorizedCron,
  shouldDeadLetter,
} from "@/server/jobs/worker";
import { TASK_TYPES, isKnownTaskType } from "@/server/jobs/handlers";

describe("worker backoff schedule (OC-P9-03)", () => {
  it("backs off at 1m, 5m, 30m, 2h and 12h", () => {
    expect(BACKOFF_MINUTES).toEqual([1, 5, 30, 120, 720]);
  });

  it("selects the backoff slot by attempt and clamps past the end", () => {
    expect(backoffForAttempt(1)).toBe(1);
    expect(backoffForAttempt(2)).toBe(5);
    expect(backoffForAttempt(3)).toBe(30);
    expect(backoffForAttempt(4)).toBe(120);
    expect(backoffForAttempt(5)).toBe(720);
    expect(backoffForAttempt(99)).toBe(720);
  });

  it("dead-letters only when attempts exhaust the task maximum", () => {
    expect(shouldDeadLetter(9, 10)).toBe(false);
    expect(shouldDeadLetter(10, 10)).toBe(true);
    expect(shouldDeadLetter(11, 10)).toBe(true);
  });
});

describe("worker failure classification (OC-P9-03)", () => {
  it.each([[408], [429], [500], [502], [503], [504]])("retries HTTP %i", (status) => {
    expect(classifyFailure(new HttpError({ status, code: "X", message: "x", retryable: true }))).toBe("retry");
  });

  it.each([[400], [401], [403], [404], [409], [412], [413], [415], [422]])("dead-letters HTTP %i", (status) => {
    expect(classifyFailure(new HttpError({ status, code: "X", message: "x" }))).toBe("dead_letter");
  });

  it("retries unknown and network failures instead of burying them", () => {
    expect(classifyFailure(new Error("fetch failed"))).toBe("retry");
    expect(classifyFailure("string failure")).toBe("retry");
  });
});

describe("cron authorization and enqueue dedupe (OC-P9-03)", () => {
  it("authorizes only the exact bearer secret with timing-safe comparison", () => {
    const headers = (token: string | null) => new Headers(token ? { authorization: `Bearer ${token}` } : {});
    expect(isAuthorizedCron(headers("s3cret"), "s3cret")).toBe(true);
    expect(isAuthorizedCron(headers("wrong"), "s3cret")).toBe(false);
    expect(isAuthorizedCron(headers(null), "s3cret")).toBe(false);
    expect(isAuthorizedCron(headers("s3cret"), "")).toBe(false);
  });

  it("derives stable dedupe keys independent of payload key order", () => {
    const first = dedupeKey("leave.accrue_monthly", { period: "2026-09", extra: 1 });
    const second = dedupeKey("leave.accrue_monthly", { extra: 1, period: "2026-09" });
    expect(first).toBe(second);
    expect(dedupeKey("leave.accrue_monthly", { period: "2026-10", extra: 1 })).not.toBe(first);
    expect(dedupeKey("leave.year_close", { period: "2026-09", extra: 1 })).not.toBe(first);
  });
});

describe("the task registry (R-21)", () => {
  it("knows the occasion-announcement job, so the scheduler will accept it", () => {
    expect(TASK_TYPES).toContain("engagement.announce_occasions");
    expect(isKnownTaskType("engagement.announce_occasions")).toBe(true);
    // Anything outside the registry is still dead-lettered without a retry.
    expect(isKnownTaskType("engagement.announce_birthdays")).toBe(false);
  });

  it("dedupes a day's occasion run, so scheduling it twice queues one task", () => {
    expect(dedupeKey("engagement.announce_occasions", { asOf: "2026-09-15" })).toBe(
      dedupeKey("engagement.announce_occasions", { asOf: "2026-09-15" }),
    );
    expect(dedupeKey("engagement.announce_occasions", { asOf: "2026-09-16" })).not.toBe(
      dedupeKey("engagement.announce_occasions", { asOf: "2026-09-15" }),
    );
  });
});
