import { describe, expect, it } from "vitest";
import {
  canAccessNavigationItem,
  getAuthorizedNavigation,
  navigationCatalog,
  navigationDomains,
} from "./navigation-catalog";

describe("navigation catalogue", () => {
  it("provides complete canonical metadata for every destination", () => {
    for (const item of navigationCatalog) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.icon).toBeTruthy();
      expect(item.keywords.length).toBeGreaterThan(0);
      expect(navigationDomains.some((domain) => domain.id === item.domain)).toBe(true);
    }
  });

  it("keeps destination IDs and routes unique", () => {
    expect(new Set(navigationCatalog.map((item) => item.id)).size).toBe(navigationCatalog.length);
    expect(new Set(navigationCatalog.map((item) => item.href)).size).toBe(navigationCatalog.length);
  });

  it("always exposes the command centre but filters restricted destinations", () => {
    const anonymous = getAuthorizedNavigation([]);
    expect(anonymous.map((item) => item.id)).toEqual(["overview"]);
    expect(anonymous.some((item) => item.id === "payroll")).toBe(false);
  });

  it("grants a destination when at least one required permission is present", () => {
    const payroll = navigationCatalog.find((item) => item.id === "payroll");
    expect(payroll).toBeDefined();
    expect(canAccessNavigationItem(payroll!, ["payroll.read"])).toBe(true);
    expect(canAccessNavigationItem(payroll!, ["employee.read"])).toBe(false);
  });

  it("never exposes future destinations", () => {
    const future = { ...navigationCatalog[0], id: "future", href: "/future", status: "future" as const };
    expect(canAccessNavigationItem(future, [])).toBe(false);
  });
});
