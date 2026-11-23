import { cockpitCatalog } from "@/lib/cockpit-catalog";
import type { AccessSource, PageCategory } from "@/lib/access/ui-access-catalog";
import type { Translate } from "./adminApi";

/** Localised names for catalog keys. Keys stay technical IDs; only the visible text is translated. */

export const LABEL_NS = "components.Workspace.AccessLabels";

const PAGE_TEXT: Record<string, [string, string]> = {
  people_core: ["People Core (Employee Directory)", "Digital employee records, KYC, org reporting and profiles"],
  team: ["Departments & Org Hierarchy", "Org graph, reporting tree and department rosters"],
  onboarding: ["Onboarding & Lifecycle", "Day-1 readiness, document verification and asset clearance"],
  contract_workforce: ["Contingent & Contract Workforce", "Vendor staffing pools, compliance audits and contractor billing"],
  attendance: ["Attendance & Rosters", "Biometric punches, shift rosters and overtime ledger"],
  leaves: ["Leave Management", "Leave quotas, approvals and balances"],
  projects: ["Projects & Sprints", "Pod allocations, sprint velocity and billable hours"],
  helpdesk: ["Helpdesk & Policies", "Service tickets, SLA tracking and policy assistant"],
  payroll: ["Payroll", "Salary register, deductions and payslips"],
  compensation: ["Compensation & Benefits", "Salary benchmarking, compa-ratios and allowances"],
  compliance: ["Statutory Compliance", "Labour codes, PF/ESI and statutory filings"],
  recruitment: ["Talent Acquisition", "Requisitions, candidate pipelines and scorecards"],
  performance: ["Performance & OKRs", "Appraisals, goals and talent calibration"],
  learning: ["Learning & Development", "Course catalogue and compliance training"],
  analytics: ["People Analytics", "Headcount, attrition and workforce insights"],
  experience: ["Employee Experience", "Recognition, surveys and wellbeing"],
  integrations: ["Integrations & API", "Connectors, webhooks and API keys"],
  settings: ["Settings", "Personal profile, preferences and security"],
};

const CATEGORY_TEXT: Record<PageCategory, string> = {
  core_hr: "Core HR",
  workforce: "Workforce operations",
  pay: "Pay & compliance",
  talent: "Talent & growth",
  experience: "Experience",
  platform: "Platform",
};

export function pageName(t: Translate, key: string): string {
  return t(`${LABEL_NS}.page_${key}`, PAGE_TEXT[key]?.[0] ?? key);
}

export function pageDescription(t: Translate, key: string): string {
  return t(`${LABEL_NS}.page_${key}_desc`, PAGE_TEXT[key]?.[1] ?? "");
}

export function categoryName(t: Translate, category: PageCategory): string {
  return t(`${LABEL_NS}.category_${category}`, CATEGORY_TEXT[category]);
}

export function cardName(t: Translate, code: string): string {
  const cockpit = cockpitCatalog.find((entry) => entry.code === code);
  return t(`${LABEL_NS}.card_${code}`, cockpit?.label ?? code);
}

export function cardDescription(t: Translate, code: string): string {
  const cockpit = cockpitCatalog.find((entry) => entry.code === code);
  return t(`${LABEL_NS}.card_${code}_desc`, cockpit?.description ?? "");
}

export function sourceLabel(t: Translate, source: AccessSource): string {
  switch (source) {
    case "super_admin": return t(`${LABEL_NS}.source_super_admin`, "Super admin: full access");
    case "role": return t(`${LABEL_NS}.source_role`, "Granted by role");
    case "role_default": return t(`${LABEL_NS}.source_role_default`, "Allowed by role permissions");
    case "override_allow": return t(`${LABEL_NS}.source_override_allow`, "Granted for this person");
    case "override_deny": return t(`${LABEL_NS}.source_override_deny`, "Blocked for this person");
    case "none": return t(`${LABEL_NS}.source_none`, "Not granted");
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
}

export function permissionDomain(key: string): string {
  const parts = key.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : key;
}

export function riskLabel(t: Translate, risk: string): string {
  if (risk === "standard") return t(`${LABEL_NS}.risk_standard`, "Standard");
  if (risk === "elevated") return t(`${LABEL_NS}.risk_elevated`, "Elevated");
  if (risk === "high") return t(`${LABEL_NS}.risk_high`, "High");
  if (risk === "restricted") return t(`${LABEL_NS}.risk_restricted`, "Restricted");
  return risk;
}
