import { describe, expect, it } from "vitest";
import { NOTIFIABLE_EVENTS, renderTemplate, upsertPreferencesSchema } from "@/server/notifications/service";

describe("notification contracts", () => {
  it("maps domain events to templates with recipient rules", () => {
    expect(NOTIFIABLE_EVENTS["leave.requested"]?.template).toBe("leave.submitted");
    expect(NOTIFIABLE_EVENTS["leave.approved"]?.template).toBe("leave.decided");
    expect(NOTIFIABLE_EVENTS["payroll.finalized"]?.recipients).toBe("payroll-operators");
    expect(NOTIFIABLE_EVENTS["loan.disbursed"]?.template).toBe("loan.status");
    expect(NOTIFIABLE_EVENTS["unknown.event"]).toBeUndefined();
  });

  it("renders templates with event variables and no raw PII leakage", () => {
    const body = renderTemplate("Leave {{leaveType}} for {{days}} day(s) is {{status}}.", { leaveType: "EL", days: 2, status: "approved" });
    expect(body).toBe("Leave EL for 2 day(s) is approved.");
    expect(renderTemplate("Hello {{missing}}.", {})).toBe("Hello .");
  });

  it("validates preference payloads", () => {
    expect(upsertPreferencesSchema.safeParse({ channels: { inapp: true, email: false }, mutedEvents: ["pulse"] }).success).toBe(true);
    expect(upsertPreferencesSchema.safeParse({ channels: { inapp: "yes" } }).success).toBe(false);
    expect(upsertPreferencesSchema.safeParse({ mutedEvents: "all" }).success).toBe(false);
  });
});
