import { picklistValues, type PicklistCode } from "./picklists";
import type { Field, WorkflowOperation } from "./workflow-catalog";
const text = (name: string, optional = false): Field => ({ name, kind: "text", min: 1, max: 250, optional });
const uuid = (name: string, optional = false): Field => ({ name, kind: "text", format: "uuid", optional });
const date = (name: string, optional = false): Field => ({ name, kind: "text", format: "date", optional });
/** An identifier the workbook states a format rule for; the rule lives in `validator`. */
const identifier = (name: string, format: string, optional = true): Field => ({ name, kind: "text", format, optional });
const choice = (name: string, options: string[]): Field => ({ name, kind: "select", options });
const bool = (name: string, optional = false, fallback?: boolean): Field => ({ name, kind: "boolean", optional, default: fallback });
const count = (name: string, min: number, max: number, optional = false, fallback?: number): Field =>
  ({ name, kind: "number", integer: true, min, max, optional, default: fallback });
/** A single choice from a workbook vocabulary; the code travels so the renderer prints its labels. */
const pick = (name: string, code: PicklistCode, optional = false, fallback?: string): Field =>
  ({ name, kind: "select", options: [...picklistValues(code)], picklist: code, optional, default: fallback });
/** A multi-select from a workbook vocabulary. */
const picks = (name: string, code: PicklistCode, fallback?: string[], optional = false): Field =>
  ({ name, kind: "array", min: 1, max: 10, optional, default: fallback, item: { kind: "select", options: [...picklistValues(code)], picklist: code } });
export const dossierResources: Record<string, { table: string; label: string; fields: Field[]; columns: Record<string, string>; sensitive?: "bank" | "tax" }> = {
  // `workerSubCategoryId` is the middle level of RL-05's resolution order: a worker category
  // row under the contract's category, which is what tells a third-party Employee apart from
  // a third-party Helper without a code change. It is not in `columns`, so it lives on the
  // row's attributes envelope and needs no migration.
  //
  // `confirmationDate` is deliberately NOT a field here. Confirmation is a guarded transition
  // (POST /api/v1/onboarding/confirmations) that refuses while induction is outstanding, and
  // a free-text date on this form would be a second writer that walks straight past the gate.
  // The date the transition writes is still read back with the rest of the envelope.
  employments: { table: "employments", label: "Employment contracts", columns: { employeeId: "employee_id", legalEntityId: "legal_entity_id", workerCategoryId: "worker_category_id" }, fields: [uuid("employeeId"), uuid("legalEntityId"), uuid("workerCategoryId"), uuid("workerSubCategoryId", true), pick("contractType", "PL_EMPLOYMENT_TYPE"), date("effectiveFrom"), date("effectiveTo", true), text("contractReference"), count("probationMonths", 0, 24, true, 3), date("probationEndDate", true), bool("isRehire", true, false), text("priorEmployeeCode", true)] },
  contacts: { table: "employee_contacts", label: "Contact details", columns: { employeeId: "employee_id" }, fields: [uuid("employeeId"), choice("contactType", ["personal_email", "mobile", "home_phone", "current_address", "permanent_address", "alternate_mobile", "official_email"]), text("value"), text("addressLine2", true), text("city", true), text("district", true), pick("state", "PL_STATE", true), text("postalCode", true), pick("country", "PL_COUNTRY", true), pick("accommodationType", "PL_ACCOMMODATION", true), date("residingSince", true), date("effectiveFrom"), date("effectiveTo", true)] },
  emergency: { table: "emergency_contacts", label: "Emergency contacts", columns: { employeeId: "employee_id" }, fields: [uuid("employeeId"), text("name"), pick("relationship", "PL_RELATION"), text("phone"), text("alternatePhone", true), text("address", true)] },
  dependants: { table: "dependants", label: "Dependants and nominees", columns: { employeeId: "employee_id" }, fields: [uuid("employeeId"), text("name"), pick("relationship", "PL_RELATION"), date("birthDate"), pick("gender", "PL_GENDER", true), bool("insured", true, false), text("nominationPurpose", true), { name: "nominationPercent", kind: "number", min: 0, max: 100, optional: true }, picks("nominationSchemes", "PL_NOMINEE_SCHEME", undefined, true), text("guardianName", true), text("nomineeAddress", true), date("effectiveFrom"), date("effectiveTo", true)] },
  bank: { table: "bank_accounts", label: "Bank accounts", sensitive: "bank", columns: { employeeId: "employee_id" }, fields: [uuid("employeeId"), text("accountHolder"), text("bankName"), text("branch"), text("accountNumber"), text("routingCode"), pick("accountType", "PL_ACCOUNT_TYPE", false, "savings"), pick("paymentMode", "PL_PAYMENT_MODE", false, "bank_transfer_neft"), text("proofDocumentId", true), text("currency"), date("effectiveFrom"), date("effectiveTo", true)] },
  // The statutory identifiers live here rather than on the employee row because this is
  // the app's encrypted, separately-permissioned per-employee store (FRM-PPL-01 marks
  // Aadhaar, PAN and passport "stored tokenised" and masked). `taxIdentifier` is the PAN
  // the resource already carried.
  tax: { table: "tax_profiles", label: "Tax and statutory identifiers", sensitive: "tax", columns: { employeeId: "employee_id", jurisdictionId: "jurisdiction_id" }, fields: [uuid("employeeId"), uuid("jurisdictionId"), identifier("taxIdentifier", "pan", false), text("financialYear"), choice("regime", ["old", "new", "other"]), text("residencyStatus"), text("declarationReference", true), identifier("aadhaarToken", "aadhaar"), bool("aadhaarNameVerified", true, false), identifier("uan", "uan"), text("pfMemberId", true), identifier("esiIpNumber", "esiIp"), identifier("passportToken", "passport"), date("passportExpiry", true), text("drivingLicence", true), text("voterId", true), identifier("npsPran", "npsPran"), bool("isInternationalWorker", true, false), pick("countryOfOrigin", "PL_COUNTRY", true), text("workPermitNumber", true), date("workPermitExpiry", true), date("effectiveFrom"), date("effectiveTo", true)] },
  assignments: { table: "employee_assignments", label: "Assignment history", columns: { employmentId: "employment_id", departmentId: "department_id", positionId: "position_id", locationId: "location_id", gradeId: "grade_id", managerEmployeeId: "manager_employee_id", costCenterId: "cost_center_id" }, fields: [uuid("employmentId"), uuid("departmentId"), uuid("subDepartmentId", true), uuid("positionId"), uuid("designationId", true), uuid("locationId"), text("workArea", true), uuid("gradeId", true), text("jobLevel", true), uuid("costCenterId", true), uuid("businessUnitId", true), uuid("projectId", true), uuid("payrollGroupId", true), uuid("managerEmployeeId", true), uuid("secondaryManagerId", true), uuid("hrbpId", true), count("noticePeriodDays", 0, 180, true), bool("overrideHasRestDays", true), pick("overrideRestDayPattern", "PL_REST_DAY_PATTERN", true), pick("overrideWageType", "PL_WAGE_TYPE", true), pick("overrideOtEligibility", "PL_OT_ELIGIBILITY", true), uuid("shiftGroupId", true), uuid("defaultShiftId", true), picks("attendanceModes", "PL_ATTENDANCE_MODE", ["biometric_device"]), text("leaveBand", true), bool("pfApplicable", true), bool("esiApplicable", true), bool("ptApplicable", true), bool("gratuityApplicable", true), bool("isUnionMember", true, false), text("unionCode", true), date("effectiveFrom"), date("effectiveTo", true), pick("changeType", "PL_ASSIGNMENT_CHANGE", false, "new_hire"), text("reason"), uuid("changeDocumentId", true)] },
};

export function dossierWorkflowOperations(): WorkflowOperation[] {
  return Object.entries(dossierResources).flatMap(([key, resource]) => {
    const path = "/api/v1/dossier/" + key;
    const base = { module: "people", section: "dossier/" + key, source: "src/app/api/v1/dossier/[resource]/route.ts", query: [key === "assignments" ? "employmentId" : "employeeId"], version: false };
    const fieldPermissions = resource.sensitive ? ["employee." + resource.sensitive + ".read"] : [];
    return [
      { ...base, id: "GET " + path, path, method: "GET", body: { kind: "object", fields: [] }, permissions: ["employee.dossier.read", ...fieldPermissions] },
      { ...base, id: "POST " + path, path, method: "POST", label: "Add " + resource.label, body: { kind: "object", fields: resource.fields }, permissions: ["employee.dossier.write", ...fieldPermissions] },
      { ...base, id: "PATCH " + path + "/[id]", path: path + "/[id]", method: "PATCH", source: "src/app/api/v1/dossier/[resource]/[id]/route.ts", label: "Update " + resource.label, version: true, body: { kind: "object", fields: resource.fields }, permissions: ["employee.dossier.write", ...fieldPermissions] },
    ];
  });
}
