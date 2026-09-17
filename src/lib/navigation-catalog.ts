export type NavigationStatus = "ready" | "future";

export type NavigationDomainId = "workspace" | "people" | "work" | "capability" | "platform";

export type NavigationItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  domain: NavigationDomainId;
  icon: string;
  keywords: string[];
  requiredPermissions: string[];
  status: NavigationStatus;
  badge?: "notifications";
};

export type NavigationDomain = {
  id: NavigationDomainId;
  label: string;
  description: string;
  icon: string;
};

export const navigationDomains: NavigationDomain[] = [
  { id: "workspace", label: "Workspace", description: "Your dashboard, inbox and assistant", icon: "layout-dashboard" },
  { id: "people", label: "People", description: "Core HR, organisation and lifecycle", icon: "users-round" },
  { id: "work", label: "Work & pay", description: "Attendance, leave, payroll and advances", icon: "clock-3" },
  { id: "capability", label: "Talent & growth", description: "Hiring, performance, learning and insights", icon: "target" },
  { id: "platform", label: "Governance", description: "Compliance, integrations and settings", icon: "shield-check" },
];

export const navigationCatalog: NavigationItem[] = [
  { id: "overview", label: "Command centre", description: "Live workforce overview and action queue", href: "/", domain: "workspace", icon: "layout-dashboard", keywords: ["home", "dashboard", "overview"], requiredPermissions: [], status: "ready" },
  { id: "inbox", label: "My inbox", description: "Approvals, exceptions and assigned work", href: "/inbox", domain: "workspace", icon: "inbox", keywords: ["tasks", "approvals", "notifications"], requiredPermissions: ["employee.read"], status: "ready", badge: "notifications" },
  { id: "assistant", label: "Mira assistant", description: "Grounded policy and workforce guidance", href: "/assistant", domain: "workspace", icon: "sparkles", keywords: ["ai", "help", "policy"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "nucleus-ai", label: "Nucleus AI", description: "Spoken workspace assistant and live analysis", href: "/nucleus-ai", domain: "workspace", icon: "sparkles", keywords: ["ai", "voice", "nucleus", "talk"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "people", label: "People core", description: "Directory, profiles, positions and documents", href: "/people", domain: "people", icon: "users-round", keywords: ["employees", "directory", "profiles"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "organization", label: "Organisation", description: "Departments, reporting lines and positions", href: "/organization", domain: "people", icon: "network", keywords: ["org", "departments", "structure"], requiredPermissions: ["employee.read", "tenant.read"], status: "ready" },
  { id: "onboarding", label: "Lifecycle", description: "Onboarding, probation, assets and exits", href: "/onboarding", domain: "people", icon: "route", keywords: ["joiners", "onboarding", "offboarding"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "engagement", label: "Engagement", description: "Surveys, recognition and wellbeing", href: "/engagement", domain: "people", icon: "heart-handshake", keywords: ["survey", "recognition", "wellbeing"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "attendance", label: "Time office", description: "Punches, attendance, rosters and overtime", href: "/attendance", domain: "work", icon: "clock-3", keywords: ["time", "punch", "roster"], requiredPermissions: ["attendance.read", "attendance.write"], status: "ready" },
  { id: "leave", label: "Leave & COFF", description: "Balances, requests, approvals and policy", href: "/leave", domain: "work", icon: "calendar-days", keywords: ["holiday", "absence", "coff"], requiredPermissions: ["leave.read", "leave.approve"], status: "ready" },
  { id: "payroll", label: "Payroll", description: "Runs, anomalies, journals and payslips", href: "/payroll", domain: "work", icon: "indian-rupee", keywords: ["salary", "pay", "payslip"], requiredPermissions: ["payroll.read", "payroll.run"], status: "ready" },
  { id: "loans", label: "Loans & advances", description: "Applications, reviews and repayments", href: "/loans", domain: "work", icon: "hand-coins", keywords: ["loan", "advance", "repayment"], requiredPermissions: ["payroll.read", "payroll.run"], status: "ready" },
  { id: "performance", label: "Performance", description: "Goals, reviews, feedback and calibration", href: "/performance", domain: "capability", icon: "target", keywords: ["goals", "reviews", "feedback"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "talent", label: "Talent acquisition", description: "Requisitions, candidates, interviews and offers", href: "/talent", domain: "capability", icon: "user-round-search", keywords: ["recruiting", "candidates", "hiring"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "learning", label: "Learning", description: "Courses, assignments, certificates and skills", href: "/learning", domain: "capability", icon: "graduation-cap", keywords: ["courses", "training", "skills"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "compensation", label: "Compensation", description: "Rewards, bands, changes and benefits", href: "/compensation", domain: "capability", icon: "gem", keywords: ["rewards", "bands", "benefits"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "insights", label: "People intelligence", description: "Metrics, snapshots, analysis and exports", href: "/insights", domain: "capability", icon: "chart-no-axes-combined", keywords: ["analytics", "reports", "metrics"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "compliance", label: "Compliance", description: "Obligations, controls, evidence and filings", href: "/compliance", domain: "platform", icon: "scale", keywords: ["statutory", "controls", "evidence"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "integrations", label: "Integrations", description: "Connectors, sync runs, webhooks and API keys", href: "/integrations", domain: "platform", icon: "plug-zap", keywords: ["connectors", "sync", "webhooks"], requiredPermissions: ["tenant.read", "tenant.manage"], status: "ready" },
  { id: "readiness", label: "VP readiness", description: "Release gates, evidence and run history", href: "/readiness", domain: "platform", icon: "shield-check", keywords: ["verification", "gates", "release"], requiredPermissions: ["employee.read", "employee.write"], status: "ready" },
  { id: "settings", label: "Settings", description: "Organisation, access, policies and security", href: "/settings", domain: "platform", icon: "settings-2", keywords: ["configuration", "roles", "permissions"], requiredPermissions: ["tenant.read", "tenant.manage", "role.manage", "membership.manage"], status: "ready" },
];

export function canAccessNavigationItem(item: NavigationItem, permissions: string[]) {
  return item.status === "ready" && (item.requiredPermissions.length === 0 || item.requiredPermissions.some((permission) => permissions.includes(permission)));
}

export function getAuthorizedNavigation(permissions: string[]) {
  return navigationCatalog.filter((item) => canAccessNavigationItem(item, permissions));
}

export const navigation = navigationDomains.map((domain) => ({
  label: domain.label,
  items: navigationCatalog.filter((item) => item.domain === domain.id && item.status === "ready").map(({ id, label, href, badge }) => ({ id, label, href, ...(badge ? { badge } : {}) })),
}));
