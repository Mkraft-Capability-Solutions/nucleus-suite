import { picklistLabel, picklistValues } from "@/lib/picklists";

/**
 * Typed registry of the workspace action forms (`nucleus:open-action` → ActionFormModal).
 *
 * Each action either submits to a real, database-backed route with the body that route's zod schema accepts
 * (`status: "available"`), or is rendered as unavailable with the reason (`status: "unavailable"`): there is
 * no fallback endpoint, so nothing is ever "saved" to a route that does not exist. Fields the target API does
 * not store are kept on screen but disabled with their reason (`unsupported`), never silently dropped.
 *
 * Labels are locale keys under `components.Workspace.ActionFormModal` with English fallbacks.
 * Client validation mirrors the server schema named on each entry; the server stays authoritative.
 */

export const ACTION_NS = "components.Workspace.ActionFormModal";

/** [locale key suffix, English fallback] */
export type Label = readonly [string, string];

export type OptionSourceId = "employees" | "departments" | "locations" | "legalEntities" | "roles" | "documentTypes" | "integrationCatalog" | "timeZones";
export type FieldKind = "text" | "email" | "date" | "month" | "time" | "number" | "textarea" | "select" | "url" | "tel" | "password" | "file" | "reference";

export type ActionField = {
  key: string;
  label: Label;
  kind: FieldKind;
  required?: boolean;
  options?: ReadonlyArray<{ value: string; label: Label }>;
  source?: OptionSourceId;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: { regex: RegExp; message: Label };
  accept?: string;
  maxBytes?: number;
  /** Shown disabled with this reason: the target API has nowhere to store the value. */
  unsupported?: Label;
  /** Prefilled from the launch context and not editable. */
  readOnly?: boolean;
};

export type ActionValues = Record<string, string>;
export type ActionFiles = Record<string, File | undefined>;
export type ActionContext = Record<string, unknown>;

type Base = { title: Label; submit: Label; fields: ActionField[] };
export type AvailableAction = Base & {
  status: "available";
  method: "POST" | "PATCH";
  /** Schema the body is validated against on the server (documentation + test anchor). */
  serverSchema: string;
  /** Context keys that must be present (e.g. the record being decided); otherwise the form is unavailable. */
  requiresContext?: Array<{ key: string; reason: Label }>;
  endpoint: (context: ActionContext, values: ActionValues) => string;
  body: (values: ActionValues, files: ActionFiles, context: ActionContext) => Promise<unknown> | unknown;
  ifMatch?: (context: ActionContext) => number | undefined;
  /** Side effect after the server accepted the write. */
  after?: "profile" | "photo";
  /** Cross-field rule, returns field → message. */
  validate?: (values: ActionValues) => Record<string, Label>;
};
export type UnavailableAction = Base & { status: "unavailable"; reason: Label };
export type ActionDefinition = AvailableAction | UnavailableAction;

/* ------------------------------------------------------------------ helpers */

const f = (key: string, fallback: string, kind: FieldKind, extra: Partial<ActionField> = {}): ActionField => ({ key, label: [`field_${key}`, fallback], kind, ...extra });
const req = { required: true } as const;
const opt = (value: string, fallback: string): { value: string; label: Label } => ({ value, label: [`option_${value}`, fallback] });
const picklist = (code: Parameters<typeof picklistValues>[0]) => picklistValues(code).map((value) => ({ value, label: [`picklist_${code}_${value}`, picklistLabel(code, value)] as Label }));
const text = (value: string | undefined) => (value ?? "").trim();
const optionalText = (value: string | undefined) => (text(value) === "" ? undefined : text(value));
/** Decimal amount in major units → integer minor units (two decimals). */
export const toMinor = (value: string | undefined) => Math.round(Number(text(value)) * 100);
const lines = (value: string | undefined) => text(value).split(/[\n,;]+/).map((entry) => entry.trim()).filter(Boolean);
const ctxString = (context: ActionContext, key: string) => (typeof context[key] === "string" || typeof context[key] === "number" ? String(context[key]) : "");
const ctxId = (key: string) => (context: ActionContext) => encodeURIComponent(ctxString(context, key));
const notStored = (what: string): Label => [`unsupported_${what}`, "Not stored by this service yet."];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = { regex: /^[A-Za-z0-9-]{2,24}$/, message: ["pattern_code", "Use 2–24 letters, digits or hyphens."] as Label };
const PAN = { regex: /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: ["pattern_pan", "Enter a valid PAN, for example ABCDE1234F."] as Label };
const TAN = { regex: /^[A-Za-z]{4}[0-9]{5}[A-Za-z]$/, message: ["pattern_tan", "Enter a valid TAN."] as Label };
const CIN = { regex: /^([LUlu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}|[A-Za-z]{3}-[0-9]{4})$/, message: ["pattern_cin", "Enter a valid CIN or LLPIN."] as Label };
const CURRENCY = { regex: /^[A-Za-z]{3}$/, message: ["pattern_currency", "Use a three-letter ISO currency code."] as Label };
const UUID_PATTERN = { regex: UUID, message: ["pattern_uuid", "Enter the record identifier exactly as shown."] as Label };

export function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("unreadable")));
    reader.onerror = () => reject(reader.error ?? new Error("unreadable"));
    reader.readAsDataURL(file);
  });
}

const unavailable = (title: Label, submit: Label, fields: ActionField[], reason: Label): UnavailableAction => ({ status: "unavailable", title, submit, fields, reason });

/* ------------------------------------------------------------------ registry */

export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  employee: {
    status: "available", method: "POST", serverSchema: "createPersonSchema (src/server/organization/service.ts)",
    title: ["employee_title", "Add employee"], submit: ["employee_submit", "Create employee"],
    endpoint: () => "/api/v1/people",
    fields: [
      f("firstName", "First name", "text", { ...req, maxLength: 80 }),
      f("lastName", "Last name", "text", { ...req, maxLength: 80 }),
      f("workEmail", "Work email", "email", req),
      f("department", "Department", "reference", { ...req, source: "departments" }),
      f("designation", "Designation", "text", { ...req, maxLength: 120 }),
      f("location", "Work location", "reference", { ...req, source: "locations" }),
      f("joiningDate", "Joining date", "date", req),
      f("manager", "Reporting manager", "reference", { source: "employees", unsupported: ["unsupported_manager", "Set the reporting manager in the employee dossier after the record is created."] }),
    ],
    body: (v) => ({ firstName: text(v.firstName), lastName: text(v.lastName), workEmail: text(v.workEmail), department: text(v.department), designation: text(v.designation), location: text(v.location), joiningDate: text(v.joiningDate) }),
  },
  legal_entity: {
    status: "available", method: "POST", serverSchema: "createLegalEntitySchema (src/server/organization/establishment-master.ts)",
    title: ["legal_entity_title", "Create legal entity"], submit: ["legal_entity_submit", "Create legal entity"],
    endpoint: () => "/api/v1/organization/legal-entities",
    fields: [
      f("entityCode", "Entity code", "text", { ...req, pattern: CODE }),
      f("registeredName", "Registered name", "text", { ...req, minLength: 3, maxLength: 200 }),
      f("registeredAddress", "Registered address", "textarea", { ...req, minLength: 5, maxLength: 500 }),
      f("currencyCode", "Currency (ISO code)", "text", { ...req, pattern: CURRENCY }),
      f("entityType", "Entity type", "select", { ...req, options: [opt("Private Limited", "Private Limited"), opt("Public Limited", "Public Limited"), opt("LLP", "LLP"), opt("Partnership", "Partnership")] }),
      f("cinLlpin", "CIN / LLPIN", "text", { ...req, pattern: CIN }),
      f("entityPan", "PAN", "text", { ...req, pattern: PAN }),
      f("tan", "TAN", "text", { ...req, pattern: TAN }),
      f("effectiveFrom", "Effective from", "date", req),
    ],
    body: (v) => ({ entityCode: text(v.entityCode).toUpperCase(), registeredName: text(v.registeredName), registeredAddress: text(v.registeredAddress), currencyCode: text(v.currencyCode).toUpperCase(), entityType: text(v.entityType), cinLlpin: text(v.cinLlpin).toUpperCase(), entityPan: text(v.entityPan).toUpperCase(), tan: text(v.tan).toUpperCase(), effectiveFrom: text(v.effectiveFrom) }),
  },
  location: {
    status: "available", method: "POST", serverSchema: "createLocationSchema (src/server/organization/establishment-master.ts)",
    title: ["location_title", "Create location master"], submit: ["location_submit", "Create location"],
    endpoint: () => "/api/v1/organization/locations",
    fields: [
      f("locationCode", "Location code", "text", { ...req, pattern: CODE }),
      f("locationName", "Location name", "text", { ...req, minLength: 2, maxLength: 160 }),
      f("entityCode", "Legal entity", "reference", { ...req, source: "legalEntities" }),
      f("locationType", "Location type", "select", { ...req, options: [opt("Plant", "Plant"), opt("Corporate Office", "Corporate office"), opt("Branch Office", "Branch office"), opt("Warehouse", "Warehouse")] }),
      f("stateCode", "State code", "text", { ...req, pattern: { regex: /^[A-Za-z]{2,4}$/, message: ["pattern_state", "Use the 2–4 letter state code."] } }),
      f("timeZone", "Time zone", "reference", { ...req, source: "timeZones" }),
    ],
    body: (v) => ({ locationCode: text(v.locationCode).toUpperCase(), locationName: text(v.locationName), entityCode: text(v.entityCode), locationType: text(v.locationType), stateCode: text(v.stateCode).toUpperCase(), timeZone: text(v.timeZone) }),
  },
  position: {
    status: "available", method: "POST", serverSchema: "createRequisitionSchema (src/server/talent/service.ts)",
    title: ["position_title", "Create position slot"], submit: ["position_submit", "Create slot"],
    endpoint: () => "/api/v1/requisitions",
    fields: [
      f("title", "Position title", "text", { ...req, maxLength: 200 }),
      f("department", "Department", "reference", { ...req, source: "departments" }),
      f("positionCode", "Position code", "text", { ...req, maxLength: 40 }),
      f("hiringManager", "Hiring manager", "reference", { ...req, source: "employees" }),
      f("location", "Location", "reference", { source: "locations", unsupported: notStored("location") }),
      f("grade", "Grade or band", "text", { unsupported: notStored("grade") }),
      f("headcount", "Approved headcount", "number", { unsupported: notStored("headcount") }),
      f("effectiveDate", "Effective date", "date", { unsupported: notStored("effectiveDate") }),
    ],
    body: (v) => ({ title: text(v.title), departmentName: text(v.department), positionCode: text(v.positionCode), hiringManagerEmployeeId: text(v.hiringManager) }),
  },
  document: {
    status: "available", method: "POST", serverSchema: "createDocumentSchema (src/server/organization/service.ts)",
    title: ["document_title", "Upload employee document"], submit: ["document_submit", "Upload document"],
    endpoint: () => "/api/v1/documents",
    fields: [
      f("employee", "Employee", "reference", { ...req, source: "employees" }),
      f("documentType", "Document type", "reference", { ...req, source: "documentTypes" }),
      f("documentClass", "Document category", "select", { ...req, options: picklist("PL_DOCUMENT_CLASS") }),
      f("title", "Document title", "text", { ...req, maxLength: 200 }),
      f("file", "File", "file", { ...req, accept: "application/pdf,image/png,image/jpeg", maxBytes: 10 * 1024 * 1024 }),
      f("expiryDate", "Expiry date", "date"),
    ],
    body: async (v, files) => {
      const file = files.file as File;
      const dataUrl = await fileAsDataUrl(file);
      return { employeeId: text(v.employee), documentTypeId: text(v.documentType), documentClass: text(v.documentClass), title: text(v.title), mimeType: file.type || "application/octet-stream", contentBase64: dataUrl.slice(dataUrl.indexOf(",") + 1), expiresAt: optionalText(v.expiryDate) };
    },
  },
  invite: {
    status: "available", method: "POST", serverSchema: "createInviteSchema (src/server/admin/service.ts)",
    title: ["invite_title", "Invite teammate"], submit: ["invite_submit", "Send invitation"],
    endpoint: () => "/api/v1/invitations",
    fields: [
      f("email", "Work email", "email", req),
      f("role", "Role", "reference", { ...req, source: "roles" }),
      f("name", "Full name", "text", { unsupported: ["unsupported_invite_name", "The invitee enters their own name when they accept."] }),
      f("team", "Team or department", "text", { unsupported: notStored("team") }),
      f("message", "Invitation message", "textarea", { unsupported: notStored("message") }),
    ],
    body: (v) => ({ email: text(v.email), roleCodes: [text(v.role)] }),
  },
  oneOnOne: unavailable(["oneOnOne_title", "Schedule a 1 on 1"], ["oneOnOne_submit", "Schedule 1 on 1"],
    [f("participant", "Participant", "reference", { source: "employees" }), f("date", "Date", "date"), f("time", "Time", "time"), f("agenda", "Agenda", "textarea")],
    ["oneOnOne_reason", "Meeting scheduling is not available: there is no calendar or meeting service. Record the conversation as a check-in from Performance instead."]),
  feedback360: {
    status: "available", method: "POST", serverSchema: "requestFeedbackSchema (src/server/performance/service.ts)",
    title: ["feedback360_title", "Request 360 feedback"], submit: ["feedback360_submit", "Request feedback"],
    endpoint: () => "/api/v1/feedback",
    fields: [
      f("employee", "Employee under review", "reference", { ...req, source: "employees" }),
      f("reviewer", "Reviewer", "reference", { ...req, source: "employees" }),
      f("cycle", "Review cycle code", "text", { ...req, maxLength: 40 }),
      f("message", "Message to the reviewer", "textarea", { ...req, maxLength: 1000 }),
      f("dueDate", "Response due date", "date", { unsupported: notStored("dueDate") }),
    ],
    body: (v) => ({ subjectEmployeeId: text(v.employee), providerEmployeeId: text(v.reviewer), reviewCycleCode: text(v.cycle), prompt: text(v.message) }),
    validate: (v) => (text(v.employee) && text(v.employee) === text(v.reviewer) ? { reviewer: ["error_self_review", "Choose a reviewer other than the employee under review."] } : {}),
  },
  okr: {
    status: "available", method: "POST", serverSchema: "createObjectiveSchema (src/server/performance/service.ts)",
    title: ["okr_title", "Create OKR goal"], submit: ["okr_submit", "Create goal"],
    endpoint: () => "/api/v1/objectives",
    fields: [
      f("objective", "Objective", "text", { ...req, maxLength: 200 }),
      f("owner", "Owner", "reference", { ...req, source: "employees" }),
      f("cycle", "Cycle", "text", { unsupported: notStored("cycle") }),
      f("weight", "Weight percent", "number", { unsupported: notStored("weight") }),
      f("keyResults", "Key results", "textarea", { unsupported: ["unsupported_key_results", "Add key results on the objective after it is created."] }),
      f("dueDate", "Due date", "date", { unsupported: notStored("dueDate") }),
    ],
    body: (v) => ({ title: text(v.objective), ownerEmployeeId: text(v.owner) }),
  },
  wellbeing: unavailable(["wellbeing_title", "Create wellbeing plan"], ["wellbeing_submit", "Create plan"],
    [f("affectedGroup", "Employee or cohort", "text"), f("action", "Proposed action", "textarea"), f("owner", "Plan owner", "reference", { source: "employees" }), f("reviewDate", "Review date", "date")],
    ["wellbeing_reason", "Wellbeing plans are not available: no wellbeing plan service or table exists yet."]),
  compCycle: {
    status: "available", method: "POST", serverSchema: "createCycleSchema (src/server/compensation/service.ts)",
    title: ["compCycle_title", "Create annual review cycle"], submit: ["compCycle_submit", "Save review cycle"],
    endpoint: () => "/api/v1/compensation/cycles",
    fields: [
      f("name", "Cycle code", "text", { ...req, maxLength: 40 }),
      f("budget", "Budget allocation", "number", { ...req, min: 0.01, max: 999999999, step: 0.01 }),
      f("effectiveDate", "Effective date", "date", { unsupported: notStored("effectiveDate") }),
      f("eligiblePopulation", "Eligible employees", "textarea", { unsupported: notStored("eligiblePopulation") }),
      f("approvalRoute", "Approval route", "text", { unsupported: notStored("approvalRoute") }),
    ],
    body: (v) => ({ code: text(v.name), budgetMinor: toMinor(v.budget) }),
  },
  offCycleOt: {
    status: "available", method: "POST", serverSchema: "createRunSchema (src/server/payroll/service.ts)",
    title: ["offCycleOt_title", "Create off cycle OT run"], submit: ["offCycleOt_submit", "Create OT run"],
    endpoint: () => "/api/v1/payroll-runs",
    fields: [
      f("period", "OT period", "month", req),
      f("paymentDate", "Payment date", "date", req),
      f("employeeScope", "Employee codes (one per line, empty = whole group)", "textarea"),
      f("approvalReference", "Approved OT reference", "text", { unsupported: notStored("approvalReference") }),
    ],
    body: (v) => ({ period: text(v.period), runType: "off_cycle_overtime", scope: "ot", payDate: text(v.paymentDate), ...(lines(v.employeeScope).length ? { populationFilter: lines(v.employeeScope) } : {}) }),
  },
  arrears: {
    status: "available", method: "POST", serverSchema: "retro-arrears createSchema (src/app/api/v1/commands/retro-arrears/route.ts)",
    title: ["arrears_title", "Create retro arrears entry"], submit: ["arrears_submit", "Create arrears entry"],
    endpoint: () => "/api/v1/commands/retro-arrears",
    fields: [
      f("employee", "Employee", "reference", { ...req, source: "employees" }),
      f("originalPeriod", "Original pay period", "month", req),
      f("amount", "Arrears amount", "number", { ...req, min: 0.01, max: 999999999, step: 0.01 }),
      f("reason", "Correction reason", "textarea", { ...req, maxLength: 500 }),
      f("paymentDate", "Payment date", "date", { unsupported: ["unsupported_arrears_payment", "Arrears are paid in the next payroll run."] }),
    ],
    body: (v) => ({ employeeId: text(v.employee), month: text(v.originalPeriod), amountMinor: toMinor(v.amount), reason: text(v.reason) }),
  },
  contractor: {
    status: "available", method: "POST", serverSchema: "assignWorkerSchema (src/server/contractors/service.ts)",
    title: ["contractor_title", "Register contract worker"], submit: ["contractor_submit", "Register worker"],
    endpoint: () => "/api/v1/contractors/assignments",
    fields: [
      f("name", "Worker name", "text", { ...req, maxLength: 120 }),
      f("agency", "Agency", "text", { ...req, maxLength: 120 }),
      f("worksite", "Worksite", "text", { ...req, maxLength: 80 }),
      f("role", "Role", "text", { ...req, maxLength: 80 }),
      f("shift", "Shift", "text", { ...req, maxLength: 40 }),
      f("startDate", "Assignment start", "date", req),
      f("dailyWage", "Daily wage", "number", { ...req, min: 0, max: 100000, step: 0.01 }),
      f("uan", "UAN", "text", { maxLength: 30 }),
      f("contract", "Contract reference", "text", { unsupported: ["unsupported_contract", "Link the worker to a contract from the contractor register."] }),
      f("endDate", "Assignment end", "date", { unsupported: notStored("endDate") }),
    ],
    // Every optional server default (UAN, site, shift, wage) is sent explicitly so no placeholder value is stored.
    body: (v) => ({ personName: text(v.name), vendorName: text(v.agency), site: text(v.worksite), role: text(v.role), shift: text(v.shift), startsOn: text(v.startDate), dailyWage: Number(text(v.dailyWage)), uan: text(v.uan) }),
  },
  debitNote: unavailable(["debitNote_title", "Issue debit note"], ["debitNote_submit", "Create debit note"],
    [f("vendor", "Vendor", "text"), f("invoice", "Invoice reference", "text"), f("amount", "Amount", "number"), f("reason", "Reason", "textarea")],
    ["debitNote_reason", "Debit notes are not available: payroll accounting exposes read-only journals and has no debit-note service."]),
  filing: unavailable(["filing_title", "Review and file obligation"], ["filing_submit", "Record filing"],
    [f("entity", "Legal entity", "text"), f("obligation", "Obligation", "text"), f("period", "Filing period", "text"), f("submissionDate", "Submission date", "date")],
    ["filing_reason", "Filing is recorded on the statutory filing register record (its File step), which needs the generated form; this quick form cannot create one."]),
  inspector: unavailable(["inspector_title", "Record inspector entry"], ["inspector_submit", "Record visit"],
    [f("inspector", "Inspector name", "text"), f("authority", "Authority", "text"), f("visitDate", "Visit date", "date"), f("purpose", "Visit purpose", "textarea")],
    ["inspector_reason", "The inspection book (Form 36) has no service or table yet, so visits cannot be recorded."]),
  apiKey: unavailable(["apiKey_title", "Generate API key"], ["apiKey_submit", "Generate key"],
    [f("name", "Key name", "text"), f("environment", "Environment", "text"), f("scopes", "Scopes", "textarea"), f("expiry", "Expiry date", "date")],
    ["apiKey_reason", "API key issuance is not available: there is no key-management service. Webhook endpoints are configured from Integrations."]),
  connector: {
    status: "available", method: "POST", serverSchema: "connectSchema (src/server/integrations/service.ts)",
    title: ["connector_title", "Configure connector"], submit: ["connector_submit", "Save connector"],
    endpoint: () => "/api/v1/integrations/connections",
    fields: [
      f("catalogCode", "Connector", "reference", { ...req, source: "integrationCatalog" }),
      f("environment", "Environment", "select", { ...req, options: [opt("Sandbox", "Sandbox"), opt("Simulated", "Simulated"), opt("Live", "Live (needs a verified round trip)")] }),
      f("connectionUrl", "Connection URL", "url", { ...req, maxLength: 500 }),
      f("authentication", "Authentication method", "select", { ...req, options: [opt("oauth2", "OAuth 2.0"), opt("api_key", "API key"), opt("service_account", "Service account")] }),
      f("syncSchedule", "Sync schedule", "select", { ...req, options: [opt("manual", "Manual"), opt("hourly", "Hourly"), opt("daily", "Daily")] }),
      f("mappingNotes", "Field mapping notes", "textarea", { maxLength: 1000 }),
    ],
    body: (v) => ({ catalogCode: text(v.catalogCode), environment: text(v.environment), config: { connectionUrl: text(v.connectionUrl), authentication: text(v.authentication), syncSchedule: text(v.syncSchedule), ...(optionalText(v.mappingNotes) ? { mappingNotes: text(v.mappingNotes) } : {}) } }),
  },
  learningPath: {
    status: "available", method: "POST", serverSchema: "createPathSchema (src/server/learning/service.ts)",
    title: ["learningPath_title", "Create learning path"], submit: ["learningPath_submit", "Create learning path"],
    endpoint: () => "/api/v1/learning-paths",
    fields: [
      f("code", "Path code", "text", { ...req, maxLength: 40 }),
      f("title", "Path title", "text", { ...req, maxLength: 200 }),
      f("courses", "Course codes (one per line)", "textarea", req),
      f("learner", "Learner", "reference", { source: "employees", unsupported: ["unsupported_learner", "Assign learners to the path from Learning after it is created."] }),
      f("timeframe", "Target timeframe", "text", { unsupported: notStored("timeframe") }),
    ],
    body: (v) => ({ code: text(v.code), title: text(v.title), courseCodes: lines(v.courses) }),
    validate: (v) => (lines(v.courses).length > 50 ? { courses: ["error_courses_max", "Add at most 50 courses."] } : {}),
  },
  focusBlock: unavailable(["focusBlock_title", "Schedule focus block"], ["focusBlock_submit", "Schedule block"],
    [f("date", "Date", "date"), f("startTime", "Start time", "time"), f("duration", "Duration (minutes)", "number")],
    ["focusBlock_reason", "Focus blocks need a connected calendar, and no calendar service is configured."]),
  photo: {
    status: "available", method: "POST", serverSchema: "postSchema (src/app/api/v1/operations/photos/route.ts)",
    title: ["photo_title", "Change profile photo"], submit: ["photo_submit", "Save photo"],
    endpoint: () => "/api/v1/operations/photos",
    fields: [f("photo", "Photo file (PNG, JPEG or WebP, up to 512 KB)", "file", { ...req, accept: "image/png,image/jpeg,image/webp", maxBytes: 512 * 1024 })],
    body: async (_v, files) => ({ photoDataUrl: await fileAsDataUrl(files.photo as File) }),
    after: "photo",
  },
  biometric: unavailable(["biometric_title", "Set up biometric sign in"], ["biometric_submit", "Start secure setup"],
    [f("method", "Method", "text"), f("deviceName", "Device name", "text"), f("recoveryEmail", "Recovery email", "email")],
    ["biometric_reason", "Biometric sign-in is not enabled for this workspace: the authentication service has no passkey or biometric enrolment."]),
  returnPlan: {
    status: "available", method: "POST", serverSchema: "earlyReturnSchema (src/server/leave/service.ts)",
    title: ["returnPlan_title", "Record early return from leave"], submit: ["returnPlan_submit", "Save return date"],
    requiresContext: [{ key: "leaveRequestId", reason: ["returnPlan_context", "Open this from the employee's leave request to record the return."] }],
    endpoint: (c) => `/api/v1/leave-requests/${ctxId("leaveRequestId")(c)}/early-return`,
    fields: [
      f("returnDate", "Actual return date", "date", req),
      f("checklist", "Return checklist", "textarea", { unsupported: notStored("checklist") }),
      f("owner", "Plan owner", "reference", { source: "employees", unsupported: notStored("owner") }),
    ],
    body: (v) => ({ actualReturnDate: text(v.returnDate) }),
  },
  kudos: {
    status: "available", method: "POST", serverSchema: "recognizeSchema (src/server/engagement/service.ts)",
    title: ["kudos_title", "Send recognition note"], submit: ["kudos_submit", "Send note"],
    endpoint: () => "/api/v1/recognition-events",
    fields: [
      f("recipient", "Recipient", "reference", { ...req, source: "employees" }),
      f("message", "Recognition message", "textarea", { ...req, maxLength: 1000 }),
      f("channel", "Delivery channel", "text", { unsupported: ["unsupported_channel", "Recognition is posted to the Nucleus feed."] }),
    ],
    body: (v) => ({ recipientEmployeeId: text(v.recipient), message: text(v.message) }),
  },
  probation: {
    status: "available", method: "POST", serverSchema: "generateLetterSchema (src/server/letters/service.ts)",
    title: ["probation_title", "Prepare probation confirmation"], submit: ["probation_submit", "Prepare letter"],
    endpoint: () => "/api/v1/hr-letters/generate",
    fields: [
      f("employee", "Employee", "reference", { ...req, source: "employees" }),
      f("effectiveDate", "Effective date", "date", req),
      f("notes", "Decision notes", "textarea", { ...req, maxLength: 1000 }),
      f("decision", "Extend or do not confirm", "text", { unsupported: ["unsupported_probation_decision", "Only confirmation letters can be generated; extensions and non-confirmation have no letter template yet."] }),
    ],
    body: (v) => ({ employeeId: text(v.employee), letterType: "confirmation", attributes: { effectiveDate: text(v.effectiveDate), notes: text(v.notes) } }),
  },
  widget: unavailable(["widget_title", "Save analysis widget"], ["widget_submit", "Save widget"],
    [f("name", "Widget name", "text"), f("dashboard", "Dashboard", "text"), f("visibility", "Visibility", "text")],
    ["widget_reason", "Saved analysis widgets need a per-user preferences table, which is not available yet. Use Customize on your dashboard."]),
  twoFactor: unavailable(["twoFactor_title", "Set up two factor authentication"], ["twoFactor_submit", "Continue to verification"],
    [f("method", "Authentication method", "text"), f("phone", "Recovery phone", "tel")],
    ["twoFactor_reason", "Two-factor authentication is not enabled in the sign-in service for this workspace."]),
  passwordReset: unavailable(["passwordReset_title", "Reset password"], ["passwordReset_submit", "Send reset link"],
    [f("email", "Work email", "email")],
    ["passwordReset_reason", "Password reset e-mail delivery is not configured. Ask your workspace administrator to reset your access."]),
  growthAction: unavailable(["growthAction_title", "Assign growth action"], ["growthAction_submit", "Assign action"],
    [f("employee", "Employee", "reference", { source: "employees" }), f("action", "Growth action", "textarea"), f("dueDate", "Follow up date", "date")],
    ["growthAction_reason", "Growth actions have no service yet. Record development goals as an OKR objective instead."]),
  ticket: {
    status: "available", method: "POST", serverSchema: "createTicketSchema (src/app/api/v1/helpdesk/tickets/route.ts)",
    title: ["ticket_title", "Raise support ticket"], submit: ["ticket_submit", "Submit ticket"],
    endpoint: () => "/api/v1/helpdesk/tickets",
    fields: [
      f("category", "Category", "select", { ...req, options: [opt("payroll_taxes", "Payroll and taxes"), opt("leave_attendance", "Leaves and attendance"), opt("medical_benefits", "Medical and benefits"), opt("it_hardware", "IT and hardware"), opt("workplace_grievance", "Workplace grievance")] }),
      f("priority", "Priority", "select", { ...req, options: [opt("LOW", "Low"), opt("MEDIUM", "Medium"), opt("HIGH", "High"), opt("URGENT", "Urgent")] }),
      f("subject", "Subject", "text", { ...req, minLength: 3, maxLength: 200 }),
      f("description", "Description", "textarea", { ...req, minLength: 5, maxLength: 4000 }),
    ],
    body: (v) => ({ category: text(v.category), priority: text(v.priority), subject: text(v.subject), description: text(v.description) }),
  },
  reply: {
    status: "available", method: "POST", serverSchema: "createMessageSchema (src/app/api/v1/helpdesk/tickets/[id]/messages/route.ts)",
    title: ["reply_title", "Reply to support ticket"], submit: ["reply_submit", "Send reply"],
    requiresContext: [{ key: "ticketId", reason: ["reply_context", "Open a ticket from the helpdesk queue to reply to it."] }],
    endpoint: (c) => `/api/v1/helpdesk/tickets/${ctxId("ticketId")(c)}/messages`,
    fields: [f("message", "Reply or resolution notes", "textarea", { ...req, maxLength: 2000 })],
    body: (v) => ({ text: text(v.message) }),
  },
  settings: {
    status: "available", method: "POST", serverSchema: "updateOwnProfileSchema (src/server/identity/profile.ts)",
    title: ["settings_title", "Save profile settings"], submit: ["settings_submit", "Save changes"],
    endpoint: () => "/api/v1/operations/profile",
    fields: [
      f("name", "Full name", "text", { ...req, maxLength: 120 }),
      f("phone", "Phone", "tel", { maxLength: 32, pattern: { regex: /^[+0-9 ()-]*$/, message: ["pattern_phone", "Use digits, spaces and + ( ) - only."] } }),
      f("location", "Work location", "text", { maxLength: 120 }),
      f("email", "Work email", "email", { unsupported: ["unsupported_email", "The sign-in e-mail is managed by your administrator."] }),
      f("timezone", "Time zone", "text", { unsupported: ["unsupported_timezone", "The workspace time zone is a tenant setting in Settings."] }),
    ],
    body: (v) => ({ name: text(v.name), ...(optionalText(v.phone) ? { phone: text(v.phone) } : {}), ...(optionalText(v.location) ? { location: text(v.location) } : {}) }),
    after: "profile",
  },
  password: {
    status: "available", method: "POST", serverSchema: "Better Auth changePassword (minPasswordLength 12, src/lib/auth.ts)",
    title: ["password_title", "Update password"], submit: ["password_submit", "Update password"],
    endpoint: () => "/api/auth/change-password",
    fields: [
      f("currentPassword", "Current password", "password", req),
      f("newPassword", "New password (at least 12 characters)", "password", { ...req, minLength: 12, maxLength: 128 }),
      f("confirmPassword", "Confirm new password", "password", req),
    ],
    validate: (v) => (v.newPassword !== v.confirmPassword ? { confirmPassword: ["error_password_match", "The passwords do not match."] } : {}),
    body: (v) => ({ currentPassword: v.currentPassword, newPassword: v.newPassword, revokeOtherSessions: true }),
  },
  assetReturn: {
    status: "available", method: "POST", serverSchema: "returnAssetSchema (src/server/assets/service.ts)",
    title: ["assetReturn_title", "Record asset return"], submit: ["assetReturn_submit", "Record return"],
    requiresContext: [{ key: "assetId", reason: ["assetReturn_context", "Open the asset from the asset register to record its return."] }],
    endpoint: (c) => `/api/v1/assets/register/${ctxId("assetId")(c)}/return`,
    fields: [
      f("condition", "Return condition", "select", { ...req, options: picklist("PL_ASSET_RETURN_CONDITION") }),
      f("returnDate", "Return date", "date", req),
      f("recoveryAmount", "Recovery amount (damaged or lost)", "number", { min: 0, max: 999999999, step: 0.01 }),
      f("remarks", "Inspection remarks", "textarea", { ...req, minLength: 3, maxLength: 500 }),
    ],
    validate: (v) => {
      if (!["damaged", "lost"].includes(text(v.condition))) return {};
      const issues: Record<string, Label> = {};
      if (text(v.recoveryAmount) === "") issues.recoveryAmount = ["error_recovery_required", "Enter the recovery amount; use 0 if nothing is recovered."];
      if (text(v.remarks).length < 10) issues.remarks = ["error_remarks_damaged", "Remarks on a damaged or lost asset need at least 10 characters."];
      return issues;
    },
    body: (v) => ({ condition: text(v.condition), returnedOn: text(v.returnDate), reason: text(v.remarks), ...(text(v.recoveryAmount) !== "" ? { recoveryAmountMinor: toMinor(v.recoveryAmount) } : {}) }),
  },
  clearance: {
    status: "available", method: "PATCH", serverSchema: "clearDepartmentSchema (src/server/fnf/service.ts)",
    title: ["clearance_title", "Record department clearance"], submit: ["clearance_submit", "Save clearance"],
    requiresContext: [{ key: "settlementId", reason: ["clearance_context", "Open the full and final settlement to record a department clearance."] }],
    endpoint: (c) => `/api/v1/fnf-settlements/${ctxId("settlementId")(c)}/clear-department`,
    fields: [
      f("department", "Department", "select", { ...req, options: [opt("hr", "HR"), opt("it", "IT"), opt("finance", "Finance"), opt("admin", "Administration")] }),
      f("remarks", "Remarks", "textarea", { maxLength: 500 }),
      f("status", "Hold pending", "text", { unsupported: ["unsupported_clearance_hold", "Only a completed clearance can be recorded; holds are tracked on the settlement."] }),
    ],
    body: (v) => ({ department: text(v.department), ...(optionalText(v.remarks) ? { remarks: text(v.remarks) } : {}) }),
  },
  roster: unavailable(["roster_title", "Review roster proposal"], ["roster_submit", "Apply roster proposal"],
    [f("site", "Site", "text"), f("assignments", "Assignment notes", "textarea"), f("effectiveDate", "Effective date", "date")],
    ["roster_reason", "Roster proposals cannot be applied in bulk: shift planning records are created per employee in Shift planning."]),
  leaveDecision: {
    status: "available", method: "POST", serverSchema: "decide bodySchema (src/app/api/v1/leave-requests/[id]/decide/route.ts)",
    title: ["leaveDecision_title", "Decide leave request"], submit: ["leaveDecision_submit", "Record decision"],
    requiresContext: [{ key: "leaveRequestId", reason: ["leaveDecision_context", "Open the leave request from the approval queue to decide it."] }],
    endpoint: (c) => `/api/v1/leave-requests/${ctxId("leaveRequestId")(c)}/decide`,
    fields: [
      f("employee", "Employee", "text", { readOnly: true }),
      f("decision", "Decision", "select", { ...req, options: [opt("approve", "Approve"), opt("reject", "Reject")] }),
      f("remarks", "Decision remarks", "textarea", { ...req, maxLength: 1000 }),
    ],
    body: (v) => ({ approve: text(v.decision) === "approve", comment: text(v.remarks) }),
  },
  benefitLock: unavailable(["benefitLock_title", "Lock benefit selections"], ["benefitLock_submit", "Lock selections"],
    [f("benefits", "Selected benefits", "textarea"), f("enrollmentYear", "Enrollment year", "number")],
    ["benefitLock_reason", "Locking a benefit window is not available: enrolments are recorded one option at a time and there is no lock service."]),
  payrollPreview: unavailable(["payrollPreview_title", "Preview payroll register"], ["payrollPreview_submit", "Generate preview"],
    [f("period", "Payroll period", "month"), f("format", "Preview format", "text")],
    ["payrollPreview_reason", "Register previews are produced from a calculated payroll run (Payroll › run cockpit); this form cannot create one."]),
  payrollRelease: {
    status: "available", method: "POST", serverSchema: "releaseBatchSchema (src/server/payroll/disbursement.ts)",
    title: ["payrollRelease_title", "Authorize payroll release"], submit: ["payrollRelease_submit", "Authorize release"],
    requiresContext: [
      { key: "disbursementId", reason: ["payrollRelease_context", "Open the disbursement batch to authorize its release."] },
      { key: "version", reason: ["payrollRelease_version", "The batch version is required to authorize its release."] },
    ],
    endpoint: (c) => `/api/v1/disbursements/${ctxId("disbursementId")(c)}/release`,
    ifMatch: (c) => (Number.isInteger(Number(c.version)) ? Number(c.version) : undefined),
    fields: [f("releaseRemarks", "Release remarks", "textarea", { maxLength: 200 })],
    body: (v) => (optionalText(v.releaseRemarks) ? { releaseRemarks: text(v.releaseRemarks) } : {}),
  },
  actionReversal: {
    status: "available", method: "POST", serverSchema: "reverse bodySchema (src/app/api/v1/ai/actions/[id]/reverse/route.ts)",
    title: ["actionReversal_title", "Reverse AI action"], submit: ["actionReversal_submit", "Record reversal"],
    endpoint: (_c, v) => `/api/v1/ai/actions/${encodeURIComponent(text(v.actionId))}/reverse`,
    fields: [
      f("actionId", "Action ID", "text", { ...req, pattern: UUID_PATTERN }),
      f("reason", "Reason for reversal", "textarea", { ...req, maxLength: 500 }),
      f("confirmation", "Confirmation", "select", { ...req, options: [opt("confirmed", "I confirm this action should be reversed")] }),
    ],
    body: (v) => ({ reason: text(v.reason) }),
  },
  anomalyReview: {
    status: "available", method: "POST", serverSchema: "resolveAnomalySchema (src/app/api/v1/attendance/anomalies/[id]/resolve/route.ts)",
    title: ["anomalyReview_title", "Review attendance anomaly"], submit: ["anomalyReview_submit", "Save review"],
    requiresContext: [{ key: "anomalyId", reason: ["anomalyReview_context", "Open the anomaly from the attendance review queue to record an outcome."] }],
    endpoint: (c) => `/api/v1/attendance/anomalies/${ctxId("anomalyId")(c)}/resolve`,
    fields: [
      f("signal", "Signal", "text", { readOnly: true }),
      f("outcome", "Review outcome", "select", { ...req, options: [opt("RESOLVE", "Resolve"), opt("WAIVE", "No action required (waive)"), opt("ESCALATE", "Open investigation (escalate)")] }),
      f("notes", "Review notes", "textarea", { ...req, maxLength: 500 }),
    ],
    body: (v) => ({ action: text(v.outcome), reason: text(v.notes) }),
  },
};

/* ------------------------------------------------------------------ resolution + validation */

export type ResolvedAction =
  | { status: "available"; definition: AvailableAction }
  | { status: "unavailable"; definition: ActionDefinition; reason: Label }
  | { status: "unknown" };

/** Applies the context requirement so a record-bound action without its record is shown as unavailable. */
export function resolveAction(action: string | null | undefined, context: ActionContext = {}): ResolvedAction {
  if (!action || !Object.hasOwn(ACTION_REGISTRY, action)) return { status: "unknown" };
  const definition = ACTION_REGISTRY[action];
  if (definition.status === "unavailable") return { status: "unavailable", definition, reason: definition.reason };
  const missing = definition.requiresContext?.find((requirement) => ctxString(context, requirement.key) === "");
  if (missing) return { status: "unavailable", definition, reason: missing.reason };
  return { status: "available", definition };
}

/** Initial values: only from the launch context, never invented. */
export function initialValues(fields: ActionField[], context: ActionContext): ActionValues {
  return Object.fromEntries(fields.map((field) => [field.key, field.unsupported ? "" : ctxString(context, field.key)]));
}

/** Client validation mirroring the server schema; returns field → label. */
export function validateAction(definition: AvailableAction, values: ActionValues, files: ActionFiles): Record<string, Label> {
  const errors: Record<string, Label> = {};
  for (const field of definition.fields) {
    if (field.unsupported || field.readOnly) continue;
    const value = text(values[field.key]);
    if (field.kind === "file") {
      const file = files[field.key];
      if (!file) { if (field.required) errors[field.key] = ["error_required", "This field is required."]; continue; }
      if (field.maxBytes && file.size > field.maxBytes) errors[field.key] = ["error_file_size", "The file is too large."];
      else if (field.accept && file.type && !field.accept.split(",").includes(file.type)) errors[field.key] = ["error_file_type", "This file type is not accepted."];
      continue;
    }
    if (value === "") { if (field.required) errors[field.key] = ["error_required", "This field is required."]; continue; }
    if (field.minLength && value.length < field.minLength) errors[field.key] = ["error_min_length", "This value is too short."];
    else if (field.maxLength && value.length > field.maxLength) errors[field.key] = ["error_max_length", "This value is too long."];
    else if (field.pattern && !field.pattern.regex.test(value)) errors[field.key] = field.pattern.message;
    else if (field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.key] = ["error_email", "Enter a valid e-mail address."];
    else if (field.kind === "url" && !/^https?:\/\/\S+$/i.test(value)) errors[field.key] = ["error_url", "Enter a full URL starting with https://."];
    else if (field.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors[field.key] = ["error_date", "Enter a valid date."];
    else if (field.kind === "month" && !/^\d{4}-\d{2}$/.test(value)) errors[field.key] = ["error_month", "Enter a valid month."];
    else if (field.kind === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) errors[field.key] = ["error_number", "Enter a number."];
      else if (field.min !== undefined && number < field.min) errors[field.key] = ["error_min", "This value is too small."];
      else if (field.max !== undefined && number > field.max) errors[field.key] = ["error_max", "This value is too large."];
    } else if (field.options && !field.options.some((option) => option.value === value)) errors[field.key] = ["error_option", "Choose one of the listed options."];
  }
  return { ...errors, ...(definition.validate?.(values) ?? {}) };
}
