import { describe, expect, it } from "vitest";
import { employees, navigation } from "./hrms-data";

describe("demo data integrity", () => {
  const items = navigation.flatMap((group) => group.items);
  it("has unique module IDs", () => expect(new Set(items.map((item) => item.id)).size).toBe(items.length));
  it("has unique routes", () => expect(new Set(items.map((item) => item.href)).size).toBe(items.length));
  it("uses absolute internal routes", () => expect(items.every((item) => item.href.startsWith("/"))).toBe(true));
  it("has unique employee codes and email addresses", () => {
    expect(new Set(employees.map((employee) => employee.id)).size).toBe(employees.length);
    expect(new Set(employees.map((employee) => employee.email)).size).toBe(employees.length);
  });
  it("keeps capability scores inside the valid range", () => expect(employees.every((employee) => employee.capability >= 0 && employee.capability <= 100)).toBe(true));
});
