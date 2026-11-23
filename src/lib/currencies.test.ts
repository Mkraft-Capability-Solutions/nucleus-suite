import { describe, expect, it } from "vitest";
import { buildPersonPayload } from "@/modules/core-hr/form/person-payload";
import { crossFieldErrors } from "@/modules/core-hr/form/EmployeeForm";
import { currencyDigits, formatMoney, fromMinorUnits, isSalaryCurrency, toMinorUnits } from "./currencies";

describe("salary currencies", () => {
  it("stores amounts in each currency's own minor units", () => {
    expect(toMinorUnits("1,50,000.50", "INR")).toBe(15000050);
    expect(toMinorUnits("4500", "USD")).toBe(450000);
    expect(toMinorUnits("250000", "JPY")).toBe(250000);
    expect(toMinorUnits("1.250", "KWD")).toBe(1250);
    expect(currencyDigits("KWD")).toBe(3);
    expect(fromMinorUnits(15000050, "INR")).toBe("150000.50");
    expect(fromMinorUnits(250000, "JPY")).toBe("250000");
    expect(fromMinorUnits(1250, "KWD")).toBe("1.250");
  });

  it("refuses amounts the currency cannot hold", () => {
    expect(toMinorUnits("100.5", "JPY")).toBeNull();
    expect(toMinorUnits("10.123", "USD")).toBeNull();
    expect(toMinorUnits("-5", "INR")).toBeNull();
    expect(toMinorUnits("abc", "INR")).toBeNull();
    expect(toMinorUnits("", "INR")).toBeNull();
    expect(isSalaryCurrency("USD")).toBe(true);
    expect(isSalaryCurrency("XYZ")).toBe(false);
  });

  it("formats in the currency", () => {
    expect(formatMoney(15000050, "INR")).toBe("₹1,50,000.50");
    expect(formatMoney(250000, "JPY")).toContain("2,50,000");
  });

  it("sends the salary with its currency and keeps it out of the profile", () => {
    const payload = buildPersonPayload({ firstName: "A", lastName: "B", basicSalary: "4,500.75", salaryCurrency: "USD", salaryMasked: false }, null);
    expect(payload.basicSalaryMinor).toBe(450075);
    expect(payload.currency).toBe("USD");
    expect(payload.basicSalary).toBeUndefined();
    expect((payload.details as Record<string, unknown>).basicSalary).toBeUndefined();
    expect((payload.details as Record<string, unknown>).salaryCurrency).toBeUndefined();
    const noSalary = buildPersonPayload({ firstName: "A", lastName: "B", basicSalary: "", salaryCurrency: "INR" }, null);
    expect(noSalary.basicSalaryMinor).toBeUndefined();
    expect(noSalary.currency).toBe("INR");
  });

  it("checks the amount against the chosen currency in the form", () => {
    expect(crossFieldErrors({ basicSalary: "100.5", salaryCurrency: "JPY" }).basicSalary).toMatch(/whole amount in JPY/);
    expect(crossFieldErrors({ basicSalary: "100.505", salaryCurrency: "USD" }).basicSalary).toMatch(/up to 2 decimals/);
    expect(crossFieldErrors({ basicSalary: "1.255", salaryCurrency: "KWD" }).basicSalary).toBeUndefined();
  });
});
