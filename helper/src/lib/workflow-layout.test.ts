import { describe, expect, it } from "vitest";
import { authorizedWorkflowGroups, workflowLayouts } from "./workflow-layout";
import { permitted, workflowOperations } from "./workflow-catalog";
import { navigationCatalog, navigationDomains } from "./navigation-catalog";

describe("business workflow architecture", () => {
  it("retains every API operation in exactly one business workflow", () => {
    for (const operation of workflowOperations) {
      const groups = workflowLayouts[operation.module] ?? [];
      expect(groups.filter(group => group.sections.includes(operation.section)), operation.id).toHaveLength(1);
    }
    for (const [module, groups] of Object.entries(workflowLayouts)) {
      expect(groups.length).toBeLessThanOrEqual(3);
      for (const section of groups.flatMap(group => group.sections)) {
        expect(workflowOperations.some(op => op.module === module && op.section === section), section).toBe(true);
      }
    }
  });

  it("matches the reference business area order and places compensation under finance", () => {
    expect(navigationDomains.map(domain => domain.label)).toEqual([
      "Dashboard", "Core HR", "Talent", "Payroll & Finance", "Workforce Operations", "Analytics & AI", "Platform Settings",
    ]);
    expect(navigationCatalog.find(item => item.id === "compensation")?.domain).toBe("payroll_finance");
    expect(navigationCatalog.find(item => item.id === "attendance")?.domain).toBe("core_hr");
    expect(navigationCatalog.find(item => item.id === "engagement")?.domain).toBe("talent");
  });

  it("filters resources without changing workflow order or exposing unauthorized operations", () => {
    for (const permissions of [[], ["employee.read"], ["payroll.read"], ["tenant.manage"]]) {
      for (const moduleId of Object.keys(workflowLayouts)) {
        const groups = authorizedWorkflowGroups(moduleId, permissions);
        for (const section of groups.flatMap(group => group.sections)) {
          expect(workflowOperations.some(op => op.module === moduleId && op.section === section && permitted(op, permissions))).toBe(true);
        }
        expect(groups.map(group => group.id)).toEqual(workflowLayouts[moduleId].filter(group => groups.some(allowed => allowed.id === group.id)).map(group => group.id));
      }
    }
  });
});
