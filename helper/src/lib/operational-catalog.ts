import { picklistValues, type PicklistCode } from "./picklists";
import type { Field, WorkflowOperation } from "./workflow-catalog";

type Transition = { from: string[]; to: string; approval?: boolean };
export type OperationalResource = {
  module: string; label: string; fields: Field[]; initial: string;
  transitions: Record<string, Transition>; editable: string[];
  permission: string; employeeRequired?: boolean;
};
const text = (name: string, optional = false, max = 500, fallback?: string): Field => ({ name, kind: "text", min: 1, max, optional, ...(fallback === undefined ? {} : { default: fallback }) });
const date = (name: string, optional = false): Field => ({ ...text(name, optional), format: "date" });
const number = (name: string, max = 100000000, optional = false): Field => ({ name, kind: "number", min: 0, max, integer: true, optional });
const decimal = (name: string, max = 100, optional = false): Field => ({ name, kind: "number", min: 0, max, optional });
const select = (name: string, options: string[]): Field => ({ name, kind: "select", options });
/**
 * A select whose vocabulary comes from the workbook picklist registry.
 *
 * Recording the code alongside the values lets the renderer print the workbook's own labels
 * ("Staff — monthly") instead of a humanised slug, and means a vocabulary is stated once.
 */
const picklistSelect = (name: string, code: PicklistCode, fallback?: string): Field => ({ name, kind: "select", options: [...picklistValues(code)], picklist: code, ...(fallback === undefined ? {} : { default: fallback }) });
/**
 * Claim types the travel module raises that PL_CLAIM_TYPE does not list.
 *
 * FRM-PAY-06 is the reimbursement taxonomy; the same resource also carries the expense lines of
 * a trip, where transport and accommodation are real categories. Dropping them to match the
 * workbook exactly would remove the only category a hotel bill could be filed under.
 */
const TRAVEL_ONLY_CLAIM_TYPES = ["transport", "accommodation"];
const approval: Record<string, Transition> = {
  submit: { from: ["draft", "returned"], to: "submitted" },
  approve: { from: ["submitted"], to: "approved", approval: true },
  return: { from: ["submitted"], to: "returned", approval: true },
  reject: { from: ["submitted"], to: "rejected", approval: true },
  cancel: { from: ["draft", "returned", "submitted"], to: "cancelled" },
};
const employee: Field = { name: "employeeId", kind: "text", format: "uuid" };

export const operationalResources: Record<string, OperationalResource> = {
  // FRM-SSV-01. `dueDate` is the workbook's `sla_due_ts` and `assign`'s `ownerEmployeeId` is its
  // `assignee_id`, so neither is repeated here. `queue_id` is derived "from the routing rule" and
  // this product has no routing-rule table, so it is left out rather than offered as a free input.
  tickets: { module: "helpdesk", label: "Support tickets", permission: "hr.helpdesk", initial: "open", editable: ["open", "returned"], fields: [employee, picklistSelect("category", "PL_TICKET_CATEGORY"), text("subCategory", false, 40), picklistSelect("priority", "PL_PRIORITY", "normal"), text("subject"), text("description"), { name: "isConfidential", kind: "boolean" }, { name: "attachmentRefs", kind: "array", item: { kind: "text", min: 1, max: 200 }, min: 1, max: 5, optional: true }, { name: "csatRating", kind: "number", integer: true, min: 1, max: 5, optional: true }, text("csatComment", true), date("dueDate", true)], transitions: {
    assign: { from: ["open", "in_progress"], to: "in_progress", approval: true },
    reply: { from: ["open", "in_progress", "resolved"], to: "same" },
    // PL_TICKET_STATUS carries "Awaiting employee": the clock is with the requester, not the desk.
    awaitEmployee: { from: ["open", "in_progress"], to: "awaiting_employee", approval: true },
    resume: { from: ["awaiting_employee"], to: "in_progress" },
    resolve: { from: ["open", "in_progress", "awaiting_employee"], to: "resolved", approval: true },
    close: { from: ["resolved"], to: "closed" }, reopen: { from: ["resolved", "closed"], to: "open" },
  } },
  projects: { module: "projects", label: "Projects", permission: "workforce.projects", initial: "draft", editable: ["draft"], fields: [text("code"), text("name"), text("client", true), employee, date("startDate"), date("endDate"), number("budgetMinor"), text("costCenter"), text("description")], transitions: { activate: { from: ["draft", "on_hold"], to: "active", approval: true }, hold: { from: ["active"], to: "on_hold", approval: true }, close: { from: ["active", "on_hold"], to: "closed", approval: true } } },
  allocations: { module: "projects", label: "Workforce allocations", permission: "workforce.projects", initial: "draft", editable: ["draft", "returned"], fields: [employee, { name: "projectId", kind: "text", format: "uuid" }, text("role"), number("allocationPercent", 100), date("startDate"), date("endDate"), text("costCenter")], transitions: { ...approval, release: { from: ["approved"], to: "released", approval: true } } },
  travel: { module: "travel", label: "Travel & duty requests", permission: "workforce.travel", initial: "draft", editable: ["draft", "returned"], fields: [employee, select("requestType", ["business_travel", "local_duty", "field_visit"]), text("purpose"), text("origin"), text("destination"), date("startDate"), date("endDate"), select("transport", ["rail", "air", "road", "company_vehicle"]), text("accommodation", true), number("estimatedCostMinor"), number("advanceMinor"), text("contactPhone")], transitions: { ...approval, complete: { from: ["approved"], to: "completed" } } },
  expenses: { module: "travel", label: "Expense claims", permission: "workforce.travel", initial: "draft", editable: ["draft", "returned"], fields: [employee, { name: "travelId", kind: "text", format: "uuid", optional: true }, date("expenseDate"), { ...picklistSelect("category", "PL_CLAIM_TYPE"), options: [...picklistValues("PL_CLAIM_TYPE"), ...TRAVEL_ONLY_CLAIM_TYPES] }, number("amountMinor"), text("currency"), text("receiptDocumentId"), text("description"), text("billNumber"), text("vendor"), { ...text("vendorGstin", true), min: 15, max: 15 }, number("entitlementMinor", 100000000, true), number("approvedAmountMinor", 100000000, true), text("payrollRunId", true)], transitions: { ...approval, reimburse: { from: ["approved"], to: "reimbursed", approval: true } } },
  timesheets: { module: "timesheets", label: "Timesheets", permission: "workforce.timesheets", initial: "draft", editable: ["draft", "returned"], fields: [employee, { name: "projectId", kind: "text", format: "uuid" }, date("workDate"), number("minutes", 1440), text("task"), select("billing", ["billable", "non_billable"]), text("notes", true)], transitions: { ...approval } },
  // FRM-PPL-06. The workbook asks two different questions about condition: PL_ASSET_CONDITION
  // when the asset is issued and PL_ASSET_RETURN_CONDITION when it comes back. One merged
  // vocabulary could answer neither, so `condition` here is the issue-side question and the
  // return transition carries its own.
  assets: { module: "assets", label: "Asset register", permission: "workforce.assets", initial: "available", editable: ["available", "returned", "maintenance"], fields: [{name:"legalEntityId",kind:"text",format:"uuid"}, text("assetTag"), text("name"), picklistSelect("category", "PL_ASSET_TYPE"), text("serialNumber"), date("purchaseDate"), number("purchaseCostMinor"), text("location"), picklistSelect("condition", "PL_ASSET_CONDITION"), number("recoveryAmountMinor", 100000000, true)], transitions: { allocate: { from: ["available", "returned"], to: "allocated", approval: true }, return: { from: ["allocated"], to: "returned", approval: true }, repair: { from: ["returned", "available"], to: "maintenance", approval: true }, restore: { from: ["maintenance"], to: "available", approval: true }, retire: { from: ["available", "returned", "maintenance"], to: "retired", approval: true } } },
  // FRM-TIM-02. Rest days in the week and consecutive working days are counted from the
  // published rows, so they are surfaced rather than stored.
  rosters: { module: "rosters", label: "Shift planning", permission: "workforce.rosters", initial: "draft", editable: ["draft", "returned"], fields: [employee, date("startDate"), date("endDate"), text("shiftCode"), text("site"), text("orgUnit"), text("startTime"), text("endTime"), number("breakMinutes", 480), { ...picklistSelect("dayTypeOverride", "PL_DAY_TYPE"), optional: true }, picklistSelect("publishStatus", "PL_PUBLISH_STATUS", "draft"), { name: "notifyOnPublish", kind: "boolean", default: true }, { ...text("publishReason", true), min: 10 }, { name: "restDaysInWeek", kind: "number", integer: true, min: 0, max: 7, optional: true, derived: true }, { name: "consecutiveDays", kind: "number", integer: true, min: 0, max: 366, optional: true, derived: true }, { name: "rosterSpanDays", kind: "number", integer: true, min: 0, max: 366, optional: true, derived: true }, text("notes", true)], transitions: { ...approval, publish: { from: ["approved"], to: "published", approval: true }, withdraw: { from: ["published"], to: "withdrawn", approval: true } } },
  mobility: { module: "mobility", label: "Internal mobility", permission: "talent.mobility", initial: "draft", editable: ["draft", "returned"], fields: [employee, text("targetRole"), text("targetDepartment"), text("targetLocation"), date("effectiveDate"), text("motivation"), text("developmentPlan")], transitions: { ...approval, complete: { from: ["approved"], to: "completed", approval: true } } },
  settlements: { module: "settlements", label: "Full & final proposals", permission: "payroll.settlement", initial: "draft", editable: ["draft", "returned"], fields: [employee, {name:"offboardingCaseId",kind:"text",format:"uuid"}, {name:"payrollRunId",kind:"text",format:"uuid"}, date("lastWorkingDate"), number("salaryPayableMinor"), number("leaveEncashmentMinor"), number("gratuityMinor"), number("otherEarningsMinor"), number("loanRecoveryMinor"), number("noticeRecoveryMinor"), number("taxDeductionMinor"), number("bonusPayableMinor", 100000000, true), number("advanceRecoveryMinor", 100000000, true), number("assetRecoveryMinor", 100000000, true), number("otherRecoveryMinor", 100000000, true), number("noticePayableMinor", 100000000, true), number("recoveryWaiverMinor", 100000000, true), { ...text("recoveryWaiverReason", true), min: 20 }, { ...text("otherRecoveryReason", true), min: 10 }, { ...picklistSelect("exitType", "PL_EXIT_TYPE"), optional: true }, text("calculationPolicyReference"), { ...text("notes"), min: 10 }], transitions: {...approval, finalize:{from:["approved"],to:"finalized",approval:true}} },
  // FRM-FIN-01. A mapping belongs to one legal entity and names both sides of the posting.
  // `accountCode` and `postingSide` stay, optional, because records written before this shape
  // carry one side and `mergeMappings` still resolves them.
  ledger: { module:"accounting",label:"GL component mappings",permission:"payroll.accounting",initial:"draft",editable:["draft","returned"],fields:[text("entityCode"),text("componentCode"),text("debitAccountCode"),text("creditAccountCode"),{name:"dimensionSource",kind:"array",item:{kind:"text",min:1,max:60},min:1,max:6,default:["cost_center"]},{name:"locationOverride",kind:"array",optional:true,min:1,max:50,item:{kind:"object",fields:[text("location"),text("debitAccountCode"),text("creditAccountCode")]}},text("accountCode",true),{...select("postingSide",["debit","credit"]),optional:true},text("costCenterSource",true),date("startDate"),date("endDate")],transitions:{...approval,retire:{from:["approved"],to:"retired",approval:true}} },
  taxDeclarations: { module:"tax-declaration-projection", label:"Investment declarations", permission:"payroll.settlement", initial:"draft", editable:["draft","returned","proof_pending"], fields:[
    employee, text("financialYear"), select("taxRegime", ["old_regime", "new_regime"]),
    number("employeePfMinor", 10000000000, true), number("publicProvidentFundMinor", 10000000000, true), number("lifeInsuranceMinor", 10000000000, true), number("elssMinor", 10000000000, true), number("tuitionFeesMinor", 10000000000, true), number("housingPrincipalMinor", 10000000000, true), number("otherSection80cMinor", 10000000000, true),
    number("nps80ccd1bMinor", 10000000000, true), number("healthInsuranceSelfMinor", 10000000000, true), number("healthInsuranceParentsMinor", 10000000000, true), number("disability80ddMinor", 10000000000, true), number("educationLoanInterestMinor", 10000000000, true), number("donations80gMinor", 10000000000, true), number("savingsInterest80ttaMinor", 10000000000, true),
    number("rentPaidMonthlyMinor", 10000000000, true), text("landlordName", true), text("landlordPan", true), text("rentedAddress", true), date("rentPeriodFrom", true), date("rentPeriodTo", true),
    number("housingInterestSelfMinor", 10000000000, true), number("housingInterestLetOutMinor", 10000000000, true), text("lenderName", true), text("lenderPan", true),
    number("otherSourcesIncomeMinor", 10000000000, true), number("previousEmployerIncomeMinor", 10000000000, true), number("previousEmployerTdsMinor", 10000000000, true),
    text("proofDocumentId", true), text("verifierRemarks", true),
  ], transitions:{
    submit:{from:["draft","returned"],to:"submitted"},
    requestProof:{from:["submitted"],to:"proof_pending",approval:true},
    verify:{from:["submitted","proof_pending"],to:"verified",approval:true},
    partiallyVerify:{from:["submitted","proof_pending"],to:"partially_verified",approval:true},
    return:{from:["submitted","proof_pending"],to:"returned",approval:true},
    reject:{from:["submitted","proof_pending"],to:"rejected",approval:true},
    cancel:{from:["draft","returned","submitted"],to:"cancelled"},
  } },
  // RL-04 of the client's demo build sheet defines overtime as gross work hours less the shift's
  // OT threshold, and its acceptance test T-03 expects 7:20 from a 19:20 day on a 12-hour shift.
  // The forms workbook's PL_OT_BASIS states a default of Net, which would give 6:35. Two client
  // documents disagree, so the default follows the one with the acceptance test attached and the
  // disagreement is recorded here; a tenant that wants net sets the field.
  // FRM-TIM-01. `crosses_midnight`, `shift_hours` and the rest-day counts the workbook marks
  // "(derived)" stay derived - end before start already says the shift crosses midnight.
  // `status` is the workbook's Active/Inactive flag, which is not the same question as this
  // resource's draft/approved/published/retired lifecycle, so both are kept.
  shifts: { module: "rosters", label: "Shift master", permission: "workforce.rosters", initial: "draft", editable: ["draft", "returned"], fields: [text("shiftCode"), text("name"), text("shiftGroup"), text("startTime"), text("endTime"), number("durationMinutes", 1440), number("graceInMinutes", 60), number("graceOutMinutes", 60), number("breakMinutes", 480), text("break1Start", true), text("break1End", true), { name: "break1Paid", kind: "boolean", default: false }, text("break2Start", true), text("break2End", true), { name: "break2Paid", kind: "boolean", default: true }, number("fullDayMinutes", 1440), number("halfDayMinutes", 1440), number("absentBelowMinutes", 1440), text("earliestIn"), text("latestIn"), { name: "autoDetectEnabled", kind: "boolean", default: true }, text("site", true), select("otEligible", ["yes", "no"]), picklistSelect("otBasis", "PL_OT_BASIS", "gross_minutes"), number("otAfterMinutes", 1440), { name: "nightAllowanceEligible", kind: "boolean", default: false }, picklistSelect("status", "PL_ACTIVE_STATUS", "active")], transitions: { ...approval, publish: { from: ["approved"], to: "published", approval: true }, retire: { from: ["published"], to: "retired", approval: true } } },
  tasks: { module: "projects", label: "Project tasks", permission: "workforce.projects", initial: "todo", editable: ["todo", "in_progress", "review"], fields: [{ name: "projectId", kind: "text", format: "uuid" }, text("title"), text("description", true), { name: "assigneeEmployeeId", kind: "text", format: "uuid", optional: true }, select("tag", ["dev", "design", "research", "security", "operations"]), select("priority", ["urgent", "high", "medium", "low"]), date("dueDate", true), number("estimateMinutes", 100000, true)], transitions: { start: { from: ["todo"], to: "in_progress" }, review: { from: ["in_progress"], to: "review" }, revise: { from: ["review"], to: "in_progress" }, approve: { from: ["review"], to: "done", approval: true }, reopen: { from: ["done"], to: "todo", approval: true }, cancel: { from: ["todo", "in_progress", "review"], to: "cancelled" } } },
  "worker-categories": { module: "field-workforce", label: "Worker categories", permission: "workforce.field", initial: "draft", editable: ["draft", "returned"], fields: [text("code"), text("label"), select("wageType", ["monthly", "daily"]), select("restDayPattern", ["fixed_sunday", "fixed_sunday_alt_saturday", "rotational_weekly_off", "none"]), select("otEligibility", ["all", "none", "restday_holiday_only"]), text("statutoryComponents"), select("graceExempt", ["yes", "no"]), text("notes", true)], transitions: { ...approval, publish: { from: ["approved"], to: "published", approval: true }, retire: { from: ["published"], to: "retired", approval: true } } },
  "plant-calendars": { module: "field-workforce", label: "Plant work calendars", permission: "workforce.field", initial: "draft", editable: ["draft", "returned"], fields: [{ name: "legalEntityId", kind: "text", format: "uuid" }, text("locationCode"), text("name"), text("stateCode"), number("calendarYear", 4000), select("weeklyOffPattern", ["fixed_sunday", "fixed_sunday_alt_saturday", "rotational_weekly_off", "none"]), text("notes", true)], transitions: { ...approval, publish: { from: ["approved"], to: "published", approval: true }, archive: { from: ["published"], to: "archived", approval: true } } },
  holidays: { module: "field-workforce", label: "Statutory holidays", permission: "workforce.field", initial: "draft", editable: ["draft", "returned"], fields: [{ name: "calendarId", kind: "text", format: "uuid" }, date("holidayDate"), text("name"), select("holidayType", ["national", "state", "festival", "optional"]), decimal("wageMultiplier", 10), select("payable", ["yes", "no"])], transitions: { ...approval, publish: { from: ["approved"], to: "published", approval: true }, cancel_holiday: { from: ["published"], to: "cancelled", approval: true } } },
  // FRM-CMP-01, statutory half. Applicability is per entity and location, and how often the
  // obligation recurs is what makes a period meaningful, so both are recorded on the register row.
  // F-SHF-03 Night Extension Rule Setup and F-ATT-06 Grace & Late Policy Setup. RL-17 and
  // RL-18 are configured here, not in code; the build sheet's configuration register states
  // the defaults carried below (03:00 / 09:30 / 20:00 / Present; 15 / 15 / 3 / half day /
  // calendar month). The exempt grade rank and the monthly cap are stated nowhere (Q-06,
  // Q-11) and so carry no default.
  "night-extension-rules": { module: "rosters", label: "Night extension rules", permission: "workforce.rosters", initial: "draft", editable: ["draft", "returned"], fields: [text("appliesToShiftCode"), text("triggerAfterTime", false, 5, "03:00"), text("permittedArrivalUntil", false, 5, "09:30"), text("minimumDepartureTime", false, 5, "20:00"), picklistSelect("resultingDayStatus", "PL_ATTENDANCE_STATUS", "present"), number("maxUsesPerMonth", 31, true), date("effectiveFrom")], transitions: { ...approval, publish: { from: ["approved"], to: "published", approval: true }, retire: { from: ["published"], to: "retired", approval: true } } },
  "grace-late-policies": { module: "rosters", label: "Grace & late policies", permission: "workforce.rosters", initial: "draft", editable: ["draft", "returned"], fields: [text("policyCode"), { name: "graceInMinutes", kind: "number", integer: true, min: 0, max: 60, default: 15 }, { name: "graceOutMinutes", kind: "number", integer: true, min: 0, max: 60, default: 15 }, { name: "latesAllowedPerMonth", kind: "number", integer: true, min: 0, max: 31, default: 3 }, picklistSelect("consequenceBeyondAllowance", "PL_ATTENDANCE_STATUS", "half_day"), select("counterResetBasis", ["calendar_month", "payroll_month"]), number("exemptFromGradeRank", 99, true), date("effectiveFrom")], transitions: { ...approval, publish: { from: ["approved"], to: "published", approval: true }, retire: { from: ["published"], to: "retired", approval: true } } },
  filings: { module:"statutory",label:"Statutory filing register",permission:"compliance.filing",initial:"draft",editable:["draft","returned"],fields:[text("formCode"),text("act",false,120),text("authority",false,120),text("stateCode"),{name:"locationId",kind:"text",format:"uuid",optional:true},picklistSelect("frequency","PL_FREQUENCY","monthly"),text("period"),{name:"generatedFormId",kind:"text",format:"uuid"},date("dueDate"),text("owner"),text("notes",true)],transitions:{...approval,file:{from:["approved"],to:"filed",approval:true},accept:{from:["filed"],to:"accepted",approval:true}} },

};

export function operationalWorkflowOperations(): WorkflowOperation[] {
  return Object.entries(operationalResources).flatMap(([key, resource]) => {
    const base = { module: resource.module, section: "operations/" + key, source: "src/app/api/v1/operations/[resource]/route.ts", query: ["employeeId", "status", "search"], version: false };
    const path = "/api/v1/operations/" + key;
    const fields = { kind: "object", fields: resource.fields };
    return [
      { ...base, id: "GET " + path, method: "GET", path, body: { kind: "object", fields: [] }, permissions: [resource.permission + ".read"], permissionAlternatives: [[resource.permission + ".self.read"], [resource.permission + ".team.read"]] },
      { ...base, id: "POST " + path, method: "POST", path, body: fields, label: "Create " + resource.label, permissions: [resource.permission + ".write"], permissionAlternatives: [[resource.permission + ".self.write"]] },
      { ...base, id: "GET " + path + "/[id]/history", method: "GET", path: path + "/[id]/history", source: "src/app/api/v1/operations/[resource]/[id]/[action]/route.ts", body: {kind:"object",fields:[]}, label:"History", permissions:[resource.permission + ".read"], permissionAlternatives:[[resource.permission + ".self.read"], [resource.permission + ".team.read"]] },
      { ...base, id: "PATCH " + path + "/[id]", method: "PATCH", source: "src/app/api/v1/operations/[resource]/[id]/route.ts", path: path + "/[id]", body: fields, version: true, label: "Edit record", permissions: [resource.permission + ".write"], permissionAlternatives: [[resource.permission + ".self.write"]] },
      ...Object.entries(resource.transitions).map(([action, transition]) => ({ ...base, id: "POST " + path + "/[id]/" + action, method: "POST", source: "src/app/api/v1/operations/[resource]/[id]/[action]/route.ts", path: path + "/[id]/" + action, version: true, label: action, body: { kind: "object", fields: [text("reason"), ...(action === "allocate" ? [employee] : []), ...(action === "assign" ? [{ ...employee, name: "ownerEmployeeId" }] : []), ...(["reimburse", "finalize"].includes(action) ? [text("paymentReference")] : []), ...(["file", "accept"].includes(action) ? [text("acknowledgementReference")] : []), ...(key === "assets" && action === "allocate" ? [picklistSelect("conditionAtIssue", "PL_ASSET_CONDITION"), { name: "acknowledgedByEmployee", kind: "boolean", default: false }, date("expectedReturn", true)] : []), ...(key === "assets" && action === "return" ? [picklistSelect("condition", "PL_ASSET_RETURN_CONDITION"), date("returnedOn"), number("recoveryAmountMinor", 100000000, true), text("returnRemarks", true)] : [])] }, permissions: [resource.permission + (transition.approval ? ".approve" : ".write"), ...(key === "expenses" && action === "reimburse" ? ["payroll.accounting.write"] : [])], permissionAlternatives: [[resource.permission + (transition.approval ? ".team.approve" : ".self.write"), ...(key === "expenses" && action === "reimburse" ? ["payroll.accounting.write"] : [])]] })),
    ];
  });
}
