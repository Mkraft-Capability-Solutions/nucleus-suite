import { cockpitCatalog, isAdminPrincipal } from "./cockpit-catalog";

export type NavigationStatus = "ready" | "future";

export type NavigationDomainId = "workspace" | "core_hr" | "talent" | "payroll_finance" | "workforce_ops" | "analytics_ai" | "platform";

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
  group?: string;
  /**
   * Narrows visibility beyond permissions. This field is an ALLOWLIST for the
   * employee surface, not a denylist for the admin one:
   *
   * - "admin"    : administrative principals only.
   * - "employee" : non-administrative principals only, so a self-service
   *                console stays a self-service console.
   * - "both"     : either principal, subject to `requiredPermissions`.
   * - UNSET      : administrative principals only.
   *
   * THE DEFAULT IS DENY FOR EMPLOYEES. An item nobody has marked is hidden
   * from a non-administrative principal. That is deliberate: a module added
   * to this catalogue later is invisible to employees until somebody decides
   * it should be visible and marks it, rather than leaking onto the employee
   * menu from the moment it lands and staying there until somebody remembers
   * to exclude it. Forgetting to mark a new module costs an employee a menu
   * entry; forgetting to exclude one cost them nothing and cost everyone else
   * their privacy.
   *
   * `requiredPermissions` still applies on top. Audience only ever narrows
   * what permissions already allow — marking an item can never grant reach.
   */
  audience?: "admin" | "employee" | "both";
};

export type NavigationDomain = {
  id: NavigationDomainId;
  label: string;
  description: string;
  icon: string;
};

export const navigationDomains: NavigationDomain[] = [
  { id: "workspace", label: "Dashboard", description: "Overview, approvals and personal work", icon: "layout-dashboard" },
  { id: "core_hr", label: "Core HR", description: "People, attendance, leave and lifecycle", icon: "users-round" },
  { id: "talent", label: "Talent", description: "Acquisition, performance, learning and recognition", icon: "user-round-search" },
  { id: "payroll_finance", label: "Payroll & Finance", description: "Payroll, compensation, benefits and advances", icon: "indian-rupee" },
  { id: "workforce_ops", label: "Workforce Operations", description: "Contract and contingent workforce operations", icon: "network" },
  { id: "analytics_ai", label: "Analytics & AI", description: "Reports, workforce intelligence and AI", icon: "chart-no-axes-combined" },
  { id: "platform", label: "Platform Settings", description: "Integrations, access, configuration and security", icon: "settings-2" },
];

const cockpitNavigationItems: NavigationItem[] = cockpitCatalog.map((cockpit) => ({
  id: cockpit.id,
  label: `${cockpit.code}: ${cockpit.label}`,
  description: cockpit.description,
  href: `/${cockpit.id}`,
  domain: "workspace" as const,
  group: "Executive & operational consoles",
  icon: cockpit.icon,
  keywords: cockpit.keywords,
  requiredPermissions: cockpit.requiredPermissions,
  status: "ready" as const,
  audience: cockpit.audience,
}));

export const navigationCatalog: NavigationItem[] = [
  ...cockpitNavigationItems,
  // The root surface renders by principal, not by permission list: the People
  // Command Centre for an administrative principal, the employee's own home for
  // everybody else (see components/hrms/dashboard.tsx, and /api/v1/home which
  // enforces the same split server-side). It therefore stays visible to every
  // signed-in account and carries a neutral label, because what it opens is not
  // the same surface for every reader.
  { id: "overview", label: "Home", description: "Your workspace home: the command centre for an administrator, your own record for an employee", href: "/", domain: "workspace", group: "Overview & actions", icon: "layout-dashboard", keywords: ["home", "dashboard", "overview", "command centre"], requiredPermissions: [], status: "ready", audience: "both" },
  { id: "inbox", label: "My Inbox", description: "Approvals, exceptions and assigned work", href: "/inbox", domain: "workspace", group: "Overview & actions", icon: "inbox", keywords: ["tasks", "approvals", "notifications"], requiredPermissions: ["employee.read"], status: "ready", badge: "notifications", audience: "both" },
  { id: "people", label: "People Core", description: "Directory, profiles, positions and documents", href: "/people", domain: "core_hr", group: "Foundation & lifecycle", icon: "users-round", keywords: ["employees", "directory", "profiles"], requiredPermissions: ["employee.read", "employee.dossier.read", "employee.dossier.write"], status: "ready" },
  { id: "attendance", label: "Smart Attendance", description: "Punches, attendance, rosters and overtime", href: "/attendance", domain: "core_hr", group: "Foundation & lifecycle", icon: "clock-3", keywords: ["time", "punch", "roster"], requiredPermissions: ["attendance.read", "attendance.write"], status: "ready", audience: "both" },
  { id: "leave", label: "Leave Management", description: "Balances, requests, approvals and policy", href: "/leave", domain: "core_hr", group: "Foundation & lifecycle", icon: "calendar-days", keywords: ["holiday", "absence", "coff"], requiredPermissions: ["leave.read", "leave.approve"], status: "ready", audience: "both" },
  { id: "onboarding", label: "Onboarding & Lifecycle", description: "Onboarding, probation, assets and exits", href: "/onboarding", domain: "core_hr", group: "Foundation & lifecycle", icon: "route", keywords: ["joiners", "onboarding", "offboarding"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "organization", label: "Organization Management", description: "Departments, reporting lines and positions", href: "/organization", domain: "core_hr", group: "Organization & governance", icon: "network", keywords: ["org", "departments", "structure"], requiredPermissions: ["employee.read", "tenant.read"], status: "ready" },
  { id: "compliance", label: "Compliance", description: "Obligations, controls, evidence and filings", href: "/compliance", domain: "core_hr", group: "Organization & governance", icon: "scale", keywords: ["statutory", "controls", "evidence"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "talent", label: "Talent ATS", description: "Requisitions, candidates, interviews and offers", href: "/talent", domain: "talent", group: "Acquisition & performance", icon: "user-round-search", keywords: ["recruiting", "candidates", "hiring"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "performance", label: "Performance & OKRs", description: "Goals, reviews, feedback and calibration", href: "/performance", domain: "talent", group: "Acquisition & performance", icon: "target", keywords: ["goals", "reviews", "feedback"], requiredPermissions: ["employee.read"], status: "ready", audience: "both" },
  { id: "learning", label: "Learning & Capability", description: "Courses, assignments, certificates and skills", href: "/learning", domain: "talent", group: "Growth & recognition", icon: "graduation-cap", keywords: ["courses", "training", "skills"], requiredPermissions: ["employee.read"], status: "ready", audience: "both" },
  { id: "engagement", label: "Recognition & Engagement", description: "Surveys, recognition and wellbeing", href: "/engagement", domain: "talent", group: "Growth & recognition", icon: "heart-handshake", keywords: ["survey", "recognition", "wellbeing"], requiredPermissions: ["employee.read"], status: "ready", audience: "both" },
  { id: "payroll", label: "Global Payroll", description: "Runs, anomalies, journals and payslips", href: "/payroll", domain: "payroll_finance", group: "Payroll & compensation", icon: "indian-rupee", keywords: ["salary", "pay", "payslip"], requiredPermissions: ["payroll.read", "payroll.run"], status: "ready" },
  { id: "compensation", label: "Compensation & Benefits", description: "Rewards, bands, changes and benefits", href: "/compensation", domain: "payroll_finance", group: "Payroll & compensation", icon: "gem", keywords: ["rewards", "bands", "benefits"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "reimbursement-claims", label: "Reimbursement & Claims", description: "Expense claims, bills and reimbursements", href: "/reimbursement-claims", domain: "payroll_finance", group: "Payroll & compensation", icon: "receipt", keywords: ["reimbursement", "claims", "expenses", "bills", "scr-058"], requiredPermissions: ["workforce.travel.read", "workforce.travel.write", "workforce.travel.approve", "workforce.travel.self.read", "workforce.travel.self.write", "workforce.travel.team.read", "workforce.travel.team.approve", "payroll.accounting.write"], status: "ready", audience: "both" },
  { id: "loans", label: "Loans, Advances & EWA", description: "Applications, reviews and repayments", href: "/loans", domain: "payroll_finance", group: "Payroll & compensation", icon: "hand-coins", keywords: ["loan", "advance", "repayment"], requiredPermissions: ["payroll.read", "payroll.run"], status: "ready" },
  { id: "contractors", label: "Contract & Contingent Workforce", description: "Agencies, contracts, assignments and invoice reconciliation", href: "/contractors", domain: "workforce_ops", group: "Scheduling & workforce", icon: "users-round", keywords: ["contractor", "agency", "contingent", "invoice"], requiredPermissions: ["employee.read", "employee.write"], status: "ready", audience: "admin" },
  { id: "insights", label: "People Intelligence & Reports", description: "Metrics, snapshots, analysis and exports", href: "/insights", domain: "analytics_ai", group: "Dashboards & intelligence", icon: "chart-no-axes-combined", keywords: ["analytics", "reports", "metrics"], requiredPermissions: ["employee.read"], status: "ready", audience: "admin" },
  { id: "assistant", label: "AI Copilot & Agents", description: "Grounded policy and workforce guidance", href: "/assistant", domain: "analytics_ai", group: "AI & custom reporting", icon: "sparkles", keywords: ["ai", "help", "policy"], requiredPermissions: ["employee.read"], status: "ready", audience: "both" },
  // Nucleus AI arrived after the employee surface was scoped, so it carries no
  // audience: the filter is default-deny for a non-administrative principal, which
  // keeps the voice agent where it already was — administrators only. Widening it to
  // employees is a product decision about who may draft actions by voice, not a
  // merge decision.
  { id: "nucleus-ai", label: "Nucleus AI", description: "Speak to your workforce data, and draft actions for confirmation", href: "/nucleus-ai", domain: "analytics_ai", group: "AI & custom reporting", icon: "mic", keywords: ["ai", "voice", "assistant", "agent", "analysis", "speak", "nucleus"], requiredPermissions: ["employee.read"], status: "ready" },
  { id: "integrations", label: "Integrations & API", description: "Connectors, sync runs, webhooks and API keys", href: "/integrations", domain: "platform", group: "Integrations & automation", icon: "plug-zap", keywords: ["connectors", "sync", "webhooks"], requiredPermissions: ["tenant.read", "tenant.manage"], status: "ready", audience: "admin" },
  { id: "settings", label: "Settings & Access", description: "Organisation, access, policies and security", href: "/settings", domain: "platform", group: "Security & governance", icon: "settings-2", keywords: ["configuration", "roles", "permissions"], requiredPermissions: ["tenant.read", "tenant.manage", "role.manage", "membership.manage"], status: "ready", audience: "admin" },
  { id: "readiness", label: "Readiness & Controls", description: "Release gates, evidence and run history", href: "/readiness", domain: "platform", group: "Security & governance", icon: "shield-check", keywords: ["verification", "gates", "release"], requiredPermissions: ["employee.read", "employee.write"], status: "ready" },
  {"id":"helpdesk","label":"HR Operations","description":"HR Operations records, forms and approvals","href":"/helpdesk","domain":"core_hr","group":"Organization & governance","icon":"network","keywords":["helpdesk","hr operations"],"requiredPermissions":["hr.helpdesk.read","hr.helpdesk.write","hr.helpdesk.approve", "hr.helpdesk.self.read", "hr.helpdesk.self.write", "hr.helpdesk.team.read", "hr.helpdesk.team.approve"],"status":"ready","audience":"both"},
  {"id":"rosters","label":"Shift Planning & Rosters","description":"Shift master, roster planning, publication and coverage","href":"/rosters","domain":"workforce_ops","group":"Scheduling & workforce","icon":"calendar-days","keywords":["rosters","shift planning & rosters"],"requiredPermissions":["workforce.rosters.read","workforce.rosters.write","workforce.rosters.approve"],"status":"ready"},
  {"id":"projects","label":"Projects & Pod Allocation","description":"Projects, pod allocation and task orchestration","href":"/projects","domain":"workforce_ops","group":"Scheduling & workforce","icon":"briefcase","keywords":["projects","projects & workforce allocation"],"requiredPermissions":["workforce.projects.read","workforce.projects.write","workforce.projects.approve"],"status":"ready","audience":"both"},
  {"id":"assets","label":"Assets & Gate Passes","description":"Asset inventory, serial custody, returns and gate pass movement","href":"/assets","domain":"workforce_ops","group":"Operations & assets","icon":"shield-check","keywords":["assets","inventory","custody","returns"],"requiredPermissions":["workforce.assets.read","workforce.assets.write","workforce.assets.approve"],"status":"ready"},
  {"id":"travel","label":"Travel & Duty Management","description":"Travel requests, duty assignment, advances and expense claims","href":"/travel","domain":"workforce_ops","group":"Operations & assets","icon":"file-text","keywords":["travel","travel & duty management"],"requiredPermissions":["workforce.travel.read","workforce.travel.write","workforce.travel.approve", "workforce.travel.self.read", "workforce.travel.self.write", "workforce.travel.team.read", "workforce.travel.team.approve"],"status":"ready","audience":"both"},
  {"id":"timesheets","label":"Timesheets & Productivity","description":"Time entries, billable split, approval and productivity","href":"/timesheets","domain":"workforce_ops","group":"Operations & assets","icon":"timer","keywords":["timesheets","timesheets & productivity"],"requiredPermissions":["workforce.timesheets.read","workforce.timesheets.write","workforce.timesheets.approve", "workforce.timesheets.self.read", "workforce.timesheets.self.write", "workforce.timesheets.team.read", "workforce.timesheets.team.approve"],"status":"ready","audience":"both"},
  {"id":"field-workforce","label":"Field Workforce","description":"Worker categories, plant calendars and statutory holiday rules","href":"/field-workforce","domain":"workforce_ops","group":"Scheduling & workforce","icon":"map-pin","keywords":["field","worker categories","plant","calendar","holidays"],"requiredPermissions":["workforce.field.read","workforce.field.write","workforce.field.approve"],"status":"ready"},
  {"id":"approval-inbox","label":"Unified Approval Inbox","description":"Every pending item across every module in one scoped queue","href":"/approval-inbox","domain":"workforce_ops","group":"Workforce operations","icon":"clipboard-check","keywords":["approval","inbox","queue","pending","delegation"],"requiredPermissions":["employee.read"],"status":"ready","badge":"notifications"},
  {"id":"talent-acquisition","label":"Talent Acquisition & Establishment","description":"Candidate pipeline, approved manpower, referrals and hiring fairness","href":"/talent-acquisition","domain":"talent","group":"Acquisition & performance","icon":"user-plus","keywords":["talent","acquisition","requisition","referral","establishment","manpower","pipeline"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"performance-capability","label":"Performance & Capability","description":"Cascading OKRs, calibration, coaching notes and succession bench","href":"/performance-capability","domain":"talent","group":"Acquisition & performance","icon":"target","keywords":["okr","performance","calibration","nine box","succession","coaching"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"recruitment-requisitions","label":"Recruitment requisitions","description":"Requisition register with live establishment headroom and the approval gate","href":"/recruitment-requisitions","domain":"talent","group":"Acquisition & performance","icon":"clipboard-list","keywords":["requisition","recruitment","headroom","establishment","sanctioned strength","manpower","hiring","scr-090"],"requiredPermissions":["employee.read"],"status":"ready","audience":"admin"},
  {"id":"referral-tracking","label":"Referral tracking","description":"Employee referrals, pipeline stage and two-part award maturation","href":"/referral-tracking","domain":"talent","group":"Acquisition & performance","icon":"user-plus","keywords":["referral","referrals","bounty","award","referrer","candidate","scr-091"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"my-learning","label":"My learning","description":"Your assigned learning: path, due date, progress and status","href":"/my-learning","domain":"talent","group":"Growth & recognition","icon":"graduation-cap","keywords":["my","learning","training","courses","due","scr-063"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"recognition-register","label":"Recognition register","description":"Nominations, committee decisions, announcements and recognition awards","href":"/recognition-register","domain":"talent","group":"Growth & recognition","icon":"award","keywords":["recognition","award","nomination","citation","kudos","scr-065"],"requiredPermissions":["employee.read","employee.write"],"status":"ready"},
  {"id":"announcements","label":"Announcements","description":"Compose, resolve the audience for, and track announcements","href":"/announcements","domain":"talent","group":"Growth & recognition","icon":"megaphone","keywords":["announcement","notice","broadcast","audience","channel","publish","scr-066"],"requiredPermissions":["employee.read","employee.write"],"status":"ready"},
  {"id":"employee-experience","label":"Employee Experience & Capability Index","description":"Capability index, wellbeing and the recognition feed","href":"/employee-experience","domain":"talent","group":"Growth & recognition","icon":"heart","keywords":["experience","wellbeing","capability index","kudos","feed","recognition"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"mobility","label":"Career & Internal Mobility","description":"Career & Internal Mobility records, forms and approvals","href":"/mobility","domain":"talent","group":"Growth & recognition","icon":"network","keywords":["mobility","career & internal mobility"],"requiredPermissions":["talent.mobility.read","talent.mobility.write","talent.mobility.approve"],"status":"ready","audience":"both"},
  {"id":"accounting","label":"Payroll Accounting","description":"Payroll Accounting worklists, review and records","domain":"payroll_finance","group":"Statutory & accounting","href":"/accounting","icon":"book-open","keywords":["accounting","payroll accounting"],"requiredPermissions":["payroll.accounting.read","payroll.accounting.write","payroll.accounting.approve"],"status":"ready"},
  {"id":"statutory","label":"Tax & Statutory","description":"Tax & Statutory worklists, review and records","domain":"payroll_finance","group":"Statutory & accounting","href":"/statutory","icon":"stamp","keywords":["statutory","tax & statutory"],"requiredPermissions":["compliance.filing.read","compliance.forms.generate"],"status":"ready"},
  {"id":"settlements","label":"Full & Final Settlement","description":"Full & Final Settlement worklists, review and records","domain":"payroll_finance","group":"Statutory & accounting","href":"/settlements","icon":"wallet","keywords":["settlements","full & final settlement"],"requiredPermissions":["payroll.settlement.read","payroll.settlement.write","payroll.settlement.approve"],"status":"ready"},
  {"id":"payroll-run-cockpit","label":"Payroll run cockpit","description":"Payroll runs, status and next actions","href":"/payroll-run-cockpit","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"gauge","keywords":["payroll","run","cockpit"],"requiredPermissions":["payroll.read","payroll.run"],"status":"ready"},
  {"id":"pre-payroll-audit","label":"Pre-payroll audit","description":"Pre-payroll checks, exceptions and sign-off","href":"/pre-payroll-audit","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"clipboard-check","keywords":["pre-payroll","audit","checks"],"requiredPermissions":["payroll.read","payroll.run"],"status":"ready"},
  {"id":"salary-structure-simulator","label":"Salary structure simulator","description":"Model salary structures and cost impact","href":"/salary-structure-simulator","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"calculator","keywords":["salary","structure","simulator"],"requiredPermissions":["payroll.read"],"status":"ready"},
  {"id":"payslips","label":"Payslips","description":"Your own payslips; the whole register for a payroll reader","href":"/payslips","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"file-text","keywords":["payslips","salary","slips"],"requiredPermissions":["payroll.read","employee.read"],"status":"ready","audience":"both"},
  {"id":"tax-declaration-projection","label":"Tax declaration and projection","description":"Declarations, projections and tax computation","href":"/tax-declaration-projection","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"file-check","keywords":["tax","declaration","projection"],"requiredPermissions":["payroll.read"],"status":"ready"},
  {"id":"bank-disbursement-control","label":"Bank disbursement control","description":"Bank advice, disbursement and controls","href":"/bank-disbursement-control","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"landmark","keywords":["bank","disbursement","control"],"requiredPermissions":["payroll.read","payroll.run"],"status":"ready"},
  {"id":"full-final-settlement","label":"Full and final settlement","description":"Full and final settlement cases and payout","href":"/full-final-settlement","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"circle-check","keywords":["full","final","settlement"],"requiredPermissions":["payroll.settlement.read"],"status":"ready"},
  {"id":"gl-mapping-journal","label":"GL mapping and journal","description":"GL mappings, journals and postings","href":"/gl-mapping-journal","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"arrow-left-right","keywords":["gl","mapping","journal"],"requiredPermissions":["payroll.accounting.read"],"status":"ready"},
  {"id":"payroll-reconciliation","label":"Payroll reconciliation","description":"Payroll reconciliation and variances","href":"/payroll-reconciliation","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"clipboard-list","keywords":["payroll","reconciliation"],"requiredPermissions":["payroll.read"],"status":"ready"},
  {"id":"loans-advances","label":"Loans and advances","description":"Loans and advances ledger and recovery","href":"/loans-advances","domain":"payroll_finance","group":"Payroll & Finance Operations","icon":"banknote","keywords":["loans","advances"],"requiredPermissions":["payroll.read"],"status":"ready"},
  {"id":"statutory-compliance","label":"Statutory Compliance","description":"Statutory registers, filings and compliance status","href":"/statutory-compliance","domain":"core_hr","group":"Organization & governance","icon":"scale","keywords":["statutory","compliance","filings","registers"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"access-scope-administration","label":"Access scope administration","description":"Access scope administration records and controls","href":"/access-scope-administration","domain":"core_hr","group":"People & Lifecycle","icon":"key-round","keywords":["access","scope","administration","people","lifecycle"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"employee-record","label":"Employee record","description":"Employee record details and history","href":"/employee-record","domain":"core_hr","group":"People & Lifecycle","icon":"id-card","keywords":["employee","record","profile"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"assignment-policy-attributes","label":"Assignment and policy attributes","description":"Assignment and policy attributes configuration","href":"/assignment-policy-attributes","domain":"core_hr","group":"People & Lifecycle","icon":"notebook-pen","keywords":["assignment","policy","attributes"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"position-register","label":"Position register","description":"Position register and sanctioned posts","href":"/position-register","domain":"core_hr","group":"People & Lifecycle","icon":"building-2","keywords":["position","register","posts"],"requiredPermissions":["employee.read"],"status":"ready","audience":"admin"},
  {"id":"sanctioned-strength-board","label":"Sanctioned strength board","description":"Sanctioned strength versus deployed headcount","href":"/sanctioned-strength-board","domain":"core_hr","group":"People & Lifecycle","icon":"radar","keywords":["sanctioned","strength","board","headcount"],"requiredPermissions":["employee.read"],"status":"ready","audience":"admin"},
  {"id":"document-vault","label":"Document vault","description":"Employee document vault and verification","href":"/document-vault","domain":"core_hr","group":"People & Lifecycle","icon":"archive","keywords":["document","vault","verification"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"joining-chain-console","label":"Joining chain console","description":"Joining chain status and pending steps","href":"/joining-chain-console","domain":"core_hr","group":"People & Lifecycle","icon":"user-check","keywords":["joining","chain","console","onboarding"],"requiredPermissions":["employee.read"],"status":"ready","audience":"admin"},
  {"id":"clearance-board","label":"Clearance board","description":"Exit clearance status across functions","href":"/clearance-board","domain":"core_hr","group":"People & Lifecycle","icon":"clipboard-check","keywords":["clearance","board","exit","no-dues"],"requiredPermissions":["employee.read"],"status":"ready","audience":"admin"},
  {"id":"asset-register","label":"Asset register","description":"Asset inventory, assignment and returns","href":"/asset-register","domain":"core_hr","group":"People & Lifecycle","icon":"briefcase","keywords":["asset","register","inventory","custody"],"requiredPermissions":["employee.read"],"status":"ready"},
  {"id":"letters-issue-register","label":"Letters and issue register","description":"Issued letters and acknowledgement tracking","href":"/letters-issue-register","domain":"core_hr","group":"People & Lifecycle","icon":"scroll-text","keywords":["letters","issue","register"],"requiredPermissions":["employee.read"],"status":"ready","audience":"admin"},
  {"id":"policy-acknowledgements","label":"Policy acknowledgements","description":"Policy versions and employee acknowledgements","href":"/policy-acknowledgements","domain":"core_hr","group":"People & Lifecycle","icon":"file-badge","keywords":["policy","acknowledgements"],"requiredPermissions":["employee.read"],"status":"ready","audience":"both"},
  {"id":"employee-home-actions","label":"Employee home actions","description":"Actions available on the employee home surface","href":"/employee-home-actions","domain":"core_hr","group":"People & Lifecycle","icon":"home","keywords":["employee","home","actions"],"requiredPermissions":["employee.read"],"status":"ready","audience":"both"},
  {"id":"check-in-out","label":"Check in and check out","description":"Record check in and check out punches","href":"/check-in-out","domain":"core_hr","group":"Attendance Operations","icon":"fingerprint","keywords":["check in","check out","punch"],"requiredPermissions":["attendance.read"],"status":"ready","audience":"both"},
  {"id":"my-attendance-history","label":"My attendance history","description":"Personal attendance history and summaries","href":"/my-attendance-history","domain":"core_hr","group":"Attendance Operations","icon":"history","keywords":["my","attendance","history"],"requiredPermissions":["attendance.read"],"status":"ready","audience":"both"},
  {"id":"attendance-day-detail","label":"Attendance day detail","description":"Day-wise attendance breakup and traces","href":"/attendance-day-detail","domain":"core_hr","group":"Attendance Operations","icon":"calendar-check","keywords":["attendance","day","detail"],"requiredPermissions":["attendance.read"],"status":"ready","audience":"both"},
  {"id":"gate-pass-register","label":"Gate pass register","description":"Gate passes issued and movement log","href":"/gate-pass-register","domain":"core_hr","group":"Attendance Operations","icon":"door-open","keywords":["gate","pass","register"],"requiredPermissions":["attendance.read"],"status":"ready","audience":"both"},
  {"id":"overtime-register","label":"Overtime register","description":"Overtime hours claimed and approved","href":"/overtime-register","domain":"core_hr","group":"Attendance Operations","icon":"timer","keywords":["overtime","register"],"requiredPermissions":["attendance.read"],"status":"ready","audience":"admin"},
  {"id":"attendance-exception-queue","label":"Attendance exception queue","description":"Exceptions pending review and decision","href":"/attendance-exception-queue","domain":"core_hr","group":"Attendance Operations","icon":"triangle-alert","keywords":["attendance","exception","queue"],"requiredPermissions":["attendance.read"],"status":"ready","audience":"admin"},
  {"id":"attendance-recompute-monitor","label":"Attendance recompute monitor","description":"Recompute runs and processing status","href":"/attendance-recompute-monitor","domain":"core_hr","group":"Attendance Operations","icon":"refresh-cw","keywords":["attendance","recompute","monitor"],"requiredPermissions":["attendance.read"],"status":"ready","audience":"admin"},
  {"id":"team-history","label":"Team history","description":"Team attendance history for reviewers","href":"/team-history","domain":"core_hr","group":"Attendance Operations","icon":"users","keywords":["team","history","attendance"],"requiredPermissions":["attendance.read"],"status":"ready"},
  {"id":"break-register","label":"Break register","description":"Derived breaks by employee and date","href":"/break-register","domain":"core_hr","group":"Attendance Operations","icon":"timer","keywords":["break","register","attendance"],"requiredPermissions":["attendance.read"],"status":"ready"},
  {"id":"leave-requests","label":"Leave requests","description":"Submitted leave requests and decisions","href":"/leave-requests","domain":"core_hr","group":"Leave Operations","icon":"calendar-check2","keywords":["leave","requests"],"requiredPermissions":["leave.read"],"status":"ready","audience":"both"},
  {"id":"leave-balance-ledger","label":"Leave balance and ledger","description":"Balances and accrual ledger entries","href":"/leave-balance-ledger","domain":"core_hr","group":"Leave Operations","icon":"wallet","keywords":["leave","balance","ledger"],"requiredPermissions":["leave.read"],"status":"ready","audience":"both"},
  {"id":"leave-policy-configuration","label":"Leave policy configuration","description":"Leave types, rules and policy setup","href":"/leave-policy-configuration","domain":"core_hr","group":"Leave Operations","icon":"book-open","keywords":["leave","policy","configuration"],"requiredPermissions":["leave.read"],"status":"ready","audience":"admin"},
];

/**
 * Whether this principal may see, and open, this destination.
 *
 * Permissions are checked first and audience second, so audience can only ever
 * take an item away. An employee never gains reach by being marked; an item
 * they could not have opened anyway stays shut.
 *
 * The audience half is default-deny for a non-administrative principal: it must
 * find an explicit "employee" or "both" mark. An administrative principal keeps
 * the old behaviour and sees everything except the self-service consoles.
 */
export function canAccessNavigationItem(item: NavigationItem, permissions: string[], roles: string[] = []) {
  if (item.status !== "ready") return false;
  const permitted = item.requiredPermissions.length === 0 || item.requiredPermissions.some((permission) => permissions.includes(permission));
  if (!permitted) return false;
  if (isAdminPrincipal(permissions, roles)) return item.audience !== "employee";
  return item.audience === "employee" || item.audience === "both";
}

export const navigationOrder = ["overview",...cockpitCatalog.map((cockpit) => cockpit.id),"inbox","people","attendance","leave","onboarding","organization","helpdesk","compliance","statutory-compliance","access-scope-administration","employee-record","assignment-policy-attributes","position-register","sanctioned-strength-board","document-vault","joining-chain-console","clearance-board","asset-register","letters-issue-register","policy-acknowledgements","employee-home-actions","check-in-out","my-attendance-history","attendance-day-detail","gate-pass-register","overtime-register","attendance-exception-queue","attendance-recompute-monitor","team-history","break-register","leave-requests","leave-balance-ledger","leave-policy-configuration","talent","talent-acquisition","recruitment-requisitions","referral-tracking","performance","performance-capability","learning","my-learning","mobility","engagement","employee-experience","recognition-register","announcements","payroll","compensation","reimbursement-claims","loans","statutory","accounting","settlements","payroll-run-cockpit","pre-payroll-audit","salary-structure-simulator","payslips","tax-declaration-projection","bank-disbursement-control","full-final-settlement","gl-mapping-journal","payroll-reconciliation","loans-advances","rosters","projects","field-workforce","contractors","assets","travel","timesheets","approval-inbox","insights","assistant","integrations","settings","readiness"];

export function getAuthorizedNavigation(permissions: string[], roles: string[] = []) {
  return navigationCatalog.filter((item) => canAccessNavigationItem(item, permissions, roles)).sort((a,b) => navigationOrder.indexOf(a.id) - navigationOrder.indexOf(b.id));
}

export const navigation = navigationDomains.map((domain) => ({
  label: domain.label,
  items: navigationCatalog.filter((item) => item.domain === domain.id && item.status === "ready").map(({ id, label, href, badge }) => ({ id, label, href, ...(badge ? { badge } : {}) })),
}));
