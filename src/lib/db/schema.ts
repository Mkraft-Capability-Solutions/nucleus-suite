import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// Better Auth core tables. Property names intentionally follow its adapter contract.
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    status: text("status").default("active").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("user_email_uq").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("session_token_uq").on(table.token),
    index("session_user_id_idx").on(table.userId),
    index("session_expires_at_idx").on(table.expiresAt),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_uq").on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    legalName: text("legal_name"),
    defaultCurrency: text("default_currency").default("INR").notNull(),
    timezone: text("timezone").default("Asia/Kolkata").notNull(),
    status: text("status").default("active").notNull(),
    branding: jsonb("branding").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tenants_slug_uq").on(table.slug),
    check("tenants_status_check", sql`${table.status} in ('active', 'suspended', 'archived')`),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").default("active").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_tenant_user_uq").on(table.tenantId, table.userId),
    index("memberships_user_id_idx").on(table.userId),
    index("memberships_tenant_role_idx").on(table.tenantId, table.role),
  ],
);

export const employeesTable = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    employeeCode: text("employee_code").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    workEmail: text("work_email"),
    designation: text("designation").notNull(),
    designationLevel: integer("designation_level").default(0).notNull(),
    department: text("department").notNull(),
    location: text("location").notNull(),
    category: text("category").default("regular").notNull(),
    payrollOwner: text("payroll_owner").default("plant").notNull(),
    managerEmployeeId: uuid("manager_employee_id"),
    joiningDate: date("joining_date").notNull(),
    status: text("status").default("active").notNull(),
    basicSalaryMinor: bigint("basic_salary_minor", { mode: "number" }),
    currency: text("currency").default("INR").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("employees_tenant_code_uq").on(table.tenantId, table.employeeCode),
    index("employees_tenant_status_idx").on(table.tenantId, table.status),
    index("employees_tenant_department_idx").on(table.tenantId, table.department),
    index("employees_manager_id_idx").on(table.managerEmployeeId),
    check("employees_manager_not_self_check", sql`${table.managerEmployeeId} is null or ${table.managerEmployeeId} <> ${table.id}`),
    check(
      "employees_category_check",
      sql`${table.category} in ('regular', 'contract', 'third-party-employee', 'third-party-helper', 'trainee')`,
    ),
  ],
);

export const attendanceDays = pgTable(
  "attendance_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "restrict" }),
    attendanceDate: date("attendance_date").notNull(),
    assignedShift: text("assigned_shift").notNull(),
    detectedShift: text("detected_shift"),
    grossSpanMinutes: integer("gross_span_minutes").default(0).notNull(),
    productiveMinutes: integer("productive_minutes").default(0).notNull(),
    breakMinutes: integer("break_minutes").default(0).notNull(),
    creditedGatePassMinutes: integer("credited_gate_pass_minutes").default(0).notNull(),
    payableOtMinutes: integer("payable_ot_minutes").default(0).notNull(),
    status: text("status").notNull(),
    exceptionReason: text("exception_reason"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("attendance_days_tenant_employee_date_uq").on(
      table.tenantId,
      table.employeeId,
      table.attendanceDate,
    ),
    index("attendance_days_tenant_date_idx").on(table.tenantId, table.attendanceDate),
    index("attendance_days_employee_date_idx").on(table.employeeId, table.attendanceDate),
    check(
      "attendance_days_status_check",
      sql`${table.status} in ('present', 'half_day', 'absent', 'leave', 'holiday', 'rest_day', 'pending')`,
    ),
  ],
);

export const attendancePunches = pgTable(
  "attendance_punches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    attendanceDayId: uuid("attendance_day_id")
      .notNull()
      .references(() => attendanceDays.id, { onDelete: "cascade" }),
    punchedAt: timestamp("punched_at", { withTimezone: true }).notNull(),
    type: text("type").notNull(),
    source: text("source").notNull(),
    deviceReference: text("device_reference"),
    ...timestamps,
  },
  (table) => [
    index("attendance_punches_day_time_idx").on(table.attendanceDayId, table.punchedAt),
    index("attendance_punches_tenant_time_idx").on(table.tenantId, table.punchedAt),
    check("attendance_punch_type_check", sql`${table.type} in ('in', 'out')`),
  ],
);

export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "restrict" }),
    leaveType: text("leave_type").notNull(),
    balance: numeric("balance", { precision: 8, scale: 2 }).default("0").notNull(),
    asOfDate: date("as_of_date").notNull(),
    expiresAt: date("expires_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("leave_balances_tenant_employee_type_uq").on(
      table.tenantId,
      table.employeeId,
      table.leaveType,
    ),
    index("leave_balances_expiry_idx").on(table.tenantId, table.expiresAt),
  ],
);

export const leaveRequestsTable = pgTable(
  "leave_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "restrict" }),
    leaveType: text("leave_type").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    requestedDays: numeric("requested_days", { precision: 6, scale: 2 }).notNull(),
    actualReturnDate: date("actual_return_date"),
    status: text("status").default("pending_supervisor").notNull(),
    reason: text("reason"),
    ...timestamps,
  },
  (table) => [
    index("leave_requests_tenant_status_idx").on(table.tenantId, table.status),
    index("leave_requests_employee_dates_idx").on(table.employeeId, table.startsOn, table.endsOn),
    check("leave_request_dates_check", sql`${table.endsOn} >= ${table.startsOn}`),
  ],
);

export const leaveApprovals = pgTable(
  "leave_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    leaveRequestId: uuid("leave_request_id")
      .notNull()
      .references(() => leaveRequestsTable.id, { onDelete: "cascade" }),
    level: text("level").notNull(),
    approverUserId: text("approver_user_id").references(() => user.id, { onDelete: "restrict" }),
    status: text("status").default("pending").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    comment: text("comment"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("leave_approvals_request_level_uq").on(table.leaveRequestId, table.level),
    index("leave_approvals_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    period: text("period").notNull(),
    scope: text("scope").notNull(),
    status: text("status").default("draft").notNull(),
    employeeCount: integer("employee_count").default(0).notNull(),
    grossMinor: bigint("gross_minor", { mode: "number" }).default(0).notNull(),
    deductionsMinor: bigint("deductions_minor", { mode: "number" }).default(0).notNull(),
    netMinor: bigint("net_minor", { mode: "number" }).default(0).notNull(),
    currency: text("currency").default("INR").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payroll_runs_tenant_period_scope_uq").on(table.tenantId, table.period, table.scope),
    index("payroll_runs_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const payrollAnomaliesTable = pgTable(
  "payroll_anomalies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "restrict" }),
    ruleCode: text("rule_code").notNull(),
    severity: text("severity").notNull(),
    facts: jsonb("facts").$type<Record<string, unknown>>().notNull(),
    status: text("status").default("open").notNull(),
    resolution: text("resolution"),
    ...timestamps,
  },
  (table) => [
    index("payroll_anomalies_run_status_idx").on(table.payrollRunId, table.status),
    index("payroll_anomalies_tenant_severity_idx").on(table.tenantId, table.severity),
  ],
);

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "restrict" }),
    principalMinor: bigint("principal_minor", { mode: "number" }).notNull(),
    outstandingMinor: bigint("outstanding_minor", { mode: "number" }).notNull(),
    currency: text("currency").default("INR").notNull(),
    status: text("status").default("draft").notNull(),
    directorOverride: boolean("director_override").default(false).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("loans_tenant_status_idx").on(table.tenantId, table.status),
    index("loans_employee_status_idx").on(table.employeeId, table.status),
    check(
      "loans_amount_check",
      sql`${table.principalMinor} > 0 and ${table.outstandingMinor} >= 0`,
    ),
  ],
);

export const loanGuarantors = pgTable(
  "loan_guarantors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    guarantorEmployeeId: uuid("guarantor_employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    status: text("status").default("pending").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("loan_guarantors_loan_employee_uq").on(table.loanId, table.guarantorEmployeeId),
    index("loan_guarantors_employee_status_idx").on(table.guarantorEmployeeId, table.status),
    check("loan_guarantor_sequence_check", sql`${table.sequence} between 1 and 3`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    reason: text("reason"),
    correlationId: uuid("correlation_id").defaultRandom().notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_events_tenant_time_idx").on(table.tenantId, table.createdAt),
    index("audit_events_entity_idx").on(table.tenantId, table.entityType, table.entityId),
    index("audit_events_actor_idx").on(table.actorUserId, table.createdAt),
  ],
);

export const vpRuleSets = pgTable(
  "vp_rule_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    domain: text("domain").notNull(),
    code: text("code").notNull(),
    version: integer("version").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    status: text("status").default("draft").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
    createdByMembershipId: uuid("created_by_membership_id").references(() => memberships.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("vp_rule_sets_tenant_domain_code_version_uq").on(table.tenantId, table.domain, table.code, table.version),
    index("vp_rule_sets_active_idx").on(table.tenantId, table.domain, table.code, table.effectiveFrom),
    check("vp_rule_sets_version_check", sql`${table.version} > 0`),
  ],
);

export const vpFeatureRecords = pgTable(
  "vp_feature_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    employeeId: uuid("employee_id").references(() => employeesTable.id, { onDelete: "restrict" }),
    referenceId: uuid("reference_id"),
    externalKey: text("external_key"),
    status: text("status").notNull(),
    effectiveOn: date("effective_on"),
    data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
    createdByMembershipId: uuid("created_by_membership_id").references(() => memberships.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [index("vp_feature_records_kind_status_idx").on(table.tenantId, table.kind, table.status, table.createdAt)],
);

export const vpErpRecords = pgTable(
  "vp_erp_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    connectionId: uuid("connection_id"),
    direction: text("direction").notNull(),
    externalKey: text("external_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").default("received").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    errorMessage: text("error_message"),
    acknowledgementRef: text("acknowledgement_ref"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("vp_erp_records_idempotency_uq").on(table.tenantId, table.direction, table.externalKey, table.payloadHash),
    index("vp_erp_records_status_idx").on(table.tenantId, table.direction, table.status, table.createdAt),
  ],
);

export const gatePasses = pgTable(
  "gate_passes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    outTime: timestamp("out_time", { withTimezone: true }).notNull(),
    expectedInTime: timestamp("expected_in_time", { withTimezone: true }),
    actualInTime: timestamp("actual_in_time", { withTimezone: true }),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [
    index("gate_pass_tenant_idx").on(table.tenantId),
    index("gate_pass_employee_idx").on(table.employeeId),
  ],
);

export const otRuns = pgTable(
  "ot_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    status: text("status").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attributes: jsonb("attributes").default({}).notNull(),
    ...timestamps,
  },
  (table) => [
    index("ot_runs_tenant_idx").on(table.tenantId),
  ],
);

export const retroArrears = pgTable(
  "retro_arrears",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    month: text("month").notNull(),
    reason: text("reason"),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [
    index("retro_arrears_tenant_idx").on(table.tenantId),
    index("retro_arrears_employee_idx").on(table.employeeId),
  ],
);

// Automatically generated Operational Module Tables
const moduleTableConfig = {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").references(() => employeesTable.id, { onDelete: "cascade" }),
  status: text("status").default("active").notNull(),
  attributes: jsonb("attributes").default({}).notNull(),
  ...timestamps,
};

export const documentVault = pgTable("document_vault", moduleTableConfig);
export const probationConfirmation = pgTable("probation_confirmation", moduleTableConfig);
export const resignationExit = pgTable("resignation_exit", moduleTableConfig);
export const attendanceDetail = pgTable("attendance_detail", moduleTableConfig);
export const shiftMaster = pgTable("shift_master", moduleTableConfig);
export const locationMaster = pgTable("location_master", moduleTableConfig);
export const rosterSchedule = pgTable("roster_schedule", {
  ...moduleTableConfig,
  startTime: text("start_time"),
  endTime: text("end_time"),
});
export const leavePolicyAdmin = pgTable("leave_policy_admin", moduleTableConfig);
export const compensatoryOff = pgTable("compensatory_off", moduleTableConfig);
export const leaveEncashment = pgTable("leave_encashment", moduleTableConfig);
export const taxDeclarations = pgTable("tax_declarations", moduleTableConfig);
export const bankDisbursement = pgTable("bank_disbursement", moduleTableConfig);
export const glMapping = pgTable("gl_mapping", moduleTableConfig);
export const reconciliationTable = pgTable("reconciliation_table", moduleTableConfig);
export const reimbursementClaim = pgTable("reimbursement_claim", moduleTableConfig);
export const salaryAdvance = pgTable("salary_advance", moduleTableConfig);
export const clearanceBoard = pgTable("clearance_board", moduleTableConfig);
export const rulePackManager = pgTable("rule_pack_manager", moduleTableConfig);
export const goldenCaseLibrary = pgTable("golden_case_library", moduleTableConfig);
export const contractorInvoice = pgTable("contractor_invoice", moduleTableConfig);
export const statutoryRegister = pgTable("statutory_register", moduleTableConfig);

export const schema = {
  user,
  session,
  account,
  verification,
  tenants,
  memberships,
  employees: employeesTable,
  attendanceDays,
  attendancePunches,
  leaveBalances,
  leaveRequests: leaveRequestsTable,
  leaveApprovals,
  payrollRuns,
  payrollAnomalies: payrollAnomaliesTable,
  loans,
  loanGuarantors,
  auditEvents,
  vpRuleSets,
  vpFeatureRecords,
  vpErpRecords,
  gatePasses,
  otRuns,
  retroArrears,
  documentVault,
  probationConfirmation,
  resignationExit,
  attendanceDetail,
  shiftMaster,
  rosterSchedule,
  leavePolicyAdmin,
  compensatoryOff,
  leaveEncashment,
  taxDeclarations,
  bankDisbursement,
  glMapping,
  reconciliationTable,
  reimbursementClaim,
  salaryAdvance,
  clearanceBoard,
  rulePackManager,
  goldenCaseLibrary,
  contractorInvoice,
  statutoryRegister,
};

export const onboardingInstances = pgTable("onboarding_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  employeeId: uuid("employee_id"),
  employmentId: uuid("employment_id"),
  onboardingTemplateId: uuid("onboarding_template_id"),
  workflowInstanceId: uuid("workflow_instance_id"),
  recordStatus: text("record_status").default("active"),
  attributes: jsonb("attributes").default({}).notNull(),
  version: bigint("version", { mode: "number" }).default(1),
  ...timestamps,
});
export const jobRequisitions = pgTable("job_requisitions", moduleTableConfig);
export const performanceReviews = pgTable("performance_reviews", moduleTableConfig);
export const learningPaths = pgTable("learning_paths", moduleTableConfig);
export const contractorWorkforce = pgTable("contractor_workforce", moduleTableConfig);
export const projectWorkforce = pgTable("project_workforce", moduleTableConfig);
export const helpdeskTickets = pgTable("helpdesk_tickets", moduleTableConfig);
