import type { PicklistCode } from "@/lib/picklists";

/**
 * FRM-PPL-01 employee master: every field the wizard captures, grouped into the review
 * sections of the approved three-click design (FORM-WIZARD-SHOWCASE.html). Labels are
 * locale keys with English fallbacks; option lists come from the typed workbook picklists,
 * the tenant reference API, or the code enums the person service maps (never records).
 */

export type FieldType = "text" | "email" | "tel" | "date" | "number" | "select" | "bool" | "textarea" | "employee";

export type OptionSource =
  | { kind: "picklist"; code: PicklistCode }
  | { kind: "reference"; list: "departments" | "locations" | "shifts" }
  | { kind: "enum"; values: ReadonlyArray<{ value: string; labelKey: string; fallback: string }> };

export type Format = "phone" | "pan" | "ifsc" | "aadhaar" | "uan" | "esiIp" | "pin" | "digits" | "upper" | "personName";

export type FieldDef = {
  key: string;
  labelKey: string;
  fallback: string;
  type: FieldType;
  required?: boolean;
  /** Required only when this returns true for the current values. */
  requiredWhen?: (values: FormValues) => boolean;
  /** Rendered only when this returns true. */
  visibleWhen?: (values: FormValues) => boolean;
  options?: OptionSource;
  format?: Format;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  wide?: boolean;
  hintKey?: string;
  hintFallback?: string;
  /** Kept out of the payload (confirmation fields). */
  clientOnly?: boolean;
  /** Read-only once the record exists. */
  lockedOnEdit?: boolean;
};

export type Scalar = string | boolean;
export type FormValues = Record<string, Scalar>;

export type SectionId =
  | "identity" | "family" | "contact" | "address" | "statutory" | "bank" | "placement" | "labour" | "medical" | "site";

export type SectionDef = { id: SectionId; titleKey: string; fallback: string; fields: FieldDef[] };

const married = (values: FormValues) => values.maritalStatus === "married";
const differentlyAbled = (values: FormValues) => values.isDifferentlyAbled === true;
const international = (values: FormValues) => values.isInternationalWorker === true;
const separatePermanent = (values: FormValues) => values.permanentSameAsPresent !== true;

/** The worker categories `createPerson` maps onto `employees.category`. */
export const WORKER_CATEGORIES = [
  { value: "PERM", labelKey: "wc_perm", fallback: "Permanent employee" },
  { value: "CONTRACT", labelKey: "wc_contract", fallback: "Contractual (daily wage, no rest day)" },
  { value: "THIRD_PARTY_EMP", labelKey: "wc_tp_emp", fallback: "Third-party employee (with rest days)" },
  { value: "THIRD_PARTY_HELPER", labelKey: "wc_tp_helper", fallback: "Third-party helper (no rest days)" },
  { value: "TRAINEE_DET", labelKey: "wc_det", fallback: "Trainee: DET (graduate engineer)" },
  { value: "TRAINEE_GET", labelKey: "wc_get", fallback: "Trainee: GET (diploma engineer)" },
] as const;

const OT_ELIGIBILITY = [
  { value: "ALL_DAYS", labelKey: "ot_all", fallback: "All days (regular and rest days)" },
  { value: "REST_HOLIDAYS_ONLY", labelKey: "ot_rest", fallback: "Rest days and holidays only" },
  { value: "NONE", labelKey: "ot_none", fallback: "Not eligible for OT" },
] as const;

const SALARY_SCOPE = [
  { value: "PLANT", labelKey: "scope_plant", fallback: "Plant (attendance and salary at plant)" },
  { value: "HO", labelKey: "scope_ho", fallback: "Head office (attendance at plant, salary at HO)" },
] as const;

export const SECTIONS: readonly SectionDef[] = [
  { id: "identity", titleKey: "sec_identity", fallback: "Identity", fields: [
    { key: "employeeCode", labelKey: "f_employee_code", fallback: "Employee code", type: "text", maxLength: 40, lockedOnEdit: true, hintKey: "h_employee_code", hintFallback: "Leave blank and the system assigns the next code." },
    { key: "salutation", labelKey: "f_salutation", fallback: "Salutation", type: "select", options: { kind: "picklist", code: "PL_SALUTATION" } },
    { key: "firstName", labelKey: "f_first_name", fallback: "First name", type: "text", required: true, maxLength: 80, format: "personName" },
    { key: "middleName", labelKey: "f_middle_name", fallback: "Middle name", type: "text", maxLength: 60 },
    { key: "lastName", labelKey: "f_last_name", fallback: "Last name", type: "text", required: true, maxLength: 80 },
    { key: "fullLegalName", labelKey: "f_full_legal_name", fallback: "Full name (as on Aadhaar)", type: "text", maxLength: 180 },
    { key: "nameAsPerBank", labelKey: "f_name_as_per_bank", fallback: "Name as per bank", type: "text", minLength: 2, maxLength: 180 },
    { key: "formerName", labelKey: "f_former_name", fallback: "Former name", type: "text", maxLength: 180 },
    { key: "gender", labelKey: "f_gender", fallback: "Gender", type: "select", required: true, options: { kind: "picklist", code: "PL_GENDER" } },
    { key: "dateOfBirth", labelKey: "f_dob", fallback: "Date of birth", type: "date", required: true },
    { key: "bloodGroup", labelKey: "f_blood_group", fallback: "Blood group", type: "select", options: { kind: "picklist", code: "PL_BLOOD_GROUP" } },
    { key: "maritalStatus", labelKey: "f_marital_status", fallback: "Marital status", type: "select", options: { kind: "picklist", code: "PL_MARITAL_STATUS" } },
    { key: "marriageDate", labelKey: "f_marriage_date", fallback: "Marriage date", type: "date", visibleWhen: married, requiredWhen: married },
    { key: "nationality", labelKey: "f_nationality", fallback: "Nationality", type: "select", options: { kind: "picklist", code: "PL_NATIONALITY" } },
    { key: "placeOfBirth", labelKey: "f_place_of_birth", fallback: "Place of birth", type: "text", maxLength: 60 },
    { key: "motherTongue", labelKey: "f_mother_tongue", fallback: "Mother tongue", type: "select", options: { kind: "picklist", code: "PL_LANGUAGE" } },
    { key: "socialCategory", labelKey: "f_social_category", fallback: "Social category", type: "select", options: { kind: "picklist", code: "PL_SOCIAL_CATEGORY" } },
    { key: "religion", labelKey: "f_religion", fallback: "Religion", type: "select", options: { kind: "picklist", code: "PL_RELIGION" } },
    { key: "isDifferentlyAbled", labelKey: "f_differently_abled", fallback: "Person with disability", type: "bool" },
    { key: "disabilityType", labelKey: "f_disability_type", fallback: "Disability type", type: "select", options: { kind: "picklist", code: "PL_DISABILITY_TYPE" }, visibleWhen: differentlyAbled, requiredWhen: differentlyAbled },
    { key: "disabilityPercent", labelKey: "f_disability_percent", fallback: "Disability (%)", type: "number", min: 0, max: 100, visibleWhen: differentlyAbled, requiredWhen: differentlyAbled, hintKey: "h_disability", hintFallback: "40% and above qualifies for the higher 80U deduction." },
    { key: "isExServiceman", labelKey: "f_ex_serviceman", fallback: "Ex-serviceman", type: "bool" },
  ] },
  { id: "family", titleKey: "sec_family", fallback: "Family", fields: [
    { key: "fatherName", labelKey: "f_father_name", fallback: "Father's name", type: "text", maxLength: 120 },
    { key: "motherName", labelKey: "f_mother_name", fallback: "Mother's name", type: "text", maxLength: 120 },
    { key: "spouseName", labelKey: "f_spouse_name", fallback: "Spouse name", type: "text", maxLength: 120, requiredWhen: married },
  ] },
  { id: "contact", titleKey: "sec_contact", fallback: "Contact and emergency", fields: [
    { key: "mobile", labelKey: "f_mobile", fallback: "Primary mobile", type: "tel", required: true, format: "phone", hintKey: "h_mobile", hintFallback: "10-digit Indian mobile number." },
    { key: "altMobile", labelKey: "f_alt_mobile", fallback: "Alternate mobile", type: "tel", format: "phone" },
    { key: "personalEmail", labelKey: "f_personal_email", fallback: "Personal email", type: "email", required: true, maxLength: 254 },
    { key: "officialEmail", labelKey: "f_official_email", fallback: "Official email", type: "email", maxLength: 254 },
    { key: "emergencyName", labelKey: "f_emergency_name", fallback: "Emergency contact name", type: "text", required: true, minLength: 2, maxLength: 120 },
    { key: "emergencyRelation", labelKey: "f_emergency_relation", fallback: "Emergency contact relation", type: "select", options: { kind: "picklist", code: "PL_RELATION" } },
    { key: "emergencyPhone", labelKey: "f_emergency_phone", fallback: "Emergency contact phone", type: "tel", required: true, format: "phone" },
    { key: "emergencySecondaryName", labelKey: "f_emergency2_name", fallback: "Second emergency contact", type: "text", maxLength: 120 },
    { key: "emergencySecondaryRelation", labelKey: "f_emergency2_relation", fallback: "Second contact relation", type: "select", options: { kind: "picklist", code: "PL_RELATION" } },
    { key: "emergencySecondaryPhone", labelKey: "f_emergency2_phone", fallback: "Second contact phone", type: "tel", format: "phone" },
  ] },
  { id: "address", titleKey: "sec_address", fallback: "Address", fields: [
    { key: "presentAddr1", labelKey: "f_addr1", fallback: "Present address line 1", type: "text", required: true, minLength: 3, maxLength: 200, wide: true },
    { key: "presentAddr2", labelKey: "f_addr2", fallback: "Present address line 2", type: "text", maxLength: 200, wide: true },
    { key: "presentCity", labelKey: "f_city", fallback: "City", type: "text", required: true, minLength: 2, maxLength: 80 },
    { key: "presentDistrict", labelKey: "f_district", fallback: "District", type: "text", maxLength: 80 },
    { key: "presentState", labelKey: "f_state", fallback: "State", type: "select", required: true, options: { kind: "picklist", code: "PL_STATE" } },
    { key: "presentPin", labelKey: "f_pin", fallback: "PIN code", type: "text", required: true, format: "pin" },
    { key: "presentCountry", labelKey: "f_country", fallback: "Country", type: "select", options: { kind: "picklist", code: "PL_COUNTRY" } },
    { key: "accommodationType", labelKey: "f_accommodation", fallback: "Accommodation", type: "select", options: { kind: "picklist", code: "PL_ACCOMMODATION" } },
    { key: "permanentSameAsPresent", labelKey: "f_same_address", fallback: "Permanent address is the same as present", type: "bool" },
    { key: "permanentAddress", labelKey: "f_permanent_address", fallback: "Permanent address", type: "textarea", maxLength: 500, wide: true, visibleWhen: separatePermanent, requiredWhen: separatePermanent },
  ] },
  { id: "statutory", titleKey: "sec_statutory", fallback: "Statutory identifiers", fields: [
    { key: "aadhaarToken", labelKey: "f_aadhaar", fallback: "Aadhaar number", type: "text", format: "aadhaar", hintKey: "h_aadhaar", hintFallback: "12 digits, no spaces." },
    { key: "panToken", labelKey: "f_pan", fallback: "PAN", type: "text", format: "pan", hintKey: "h_pan", hintFallback: "5 letters, 4 digits, 1 letter." },
    { key: "uan", labelKey: "f_uan", fallback: "UAN", type: "text", format: "uan" },
    { key: "esiIp", labelKey: "f_esi", fallback: "ESI IP number", type: "text", format: "esiIp" },
    { key: "passportToken", labelKey: "f_passport", fallback: "Passport number", type: "text", format: "upper", maxLength: 20 },
    { key: "passportExpiry", labelKey: "f_passport_expiry", fallback: "Passport expiry", type: "date" },
    { key: "drivingLicence", labelKey: "f_driving_licence", fallback: "Driving licence", type: "text", format: "upper", maxLength: 20 },
    { key: "voterId", labelKey: "f_voter_id", fallback: "Voter ID", type: "text", format: "upper", maxLength: 20 },
    { key: "npsPran", labelKey: "f_nps_pran", fallback: "NPS PRAN", type: "text", format: "digits", maxLength: 12 },
    { key: "isInternationalWorker", labelKey: "f_international", fallback: "International worker", type: "bool" },
    { key: "countryOfOrigin", labelKey: "f_country_origin", fallback: "Country of origin", type: "select", options: { kind: "picklist", code: "PL_COUNTRY" }, visibleWhen: international, requiredWhen: international },
    { key: "workPermitNo", labelKey: "f_work_permit", fallback: "Work permit number", type: "text", maxLength: 40, visibleWhen: international },
  ] },
  { id: "bank", titleKey: "sec_bank", fallback: "Bank", fields: [
    { key: "bankName", labelKey: "f_bank_name", fallback: "Bank name", type: "text", required: true, minLength: 2, maxLength: 120 },
    { key: "bankBranch", labelKey: "f_bank_branch", fallback: "Branch", type: "text", maxLength: 120 },
    { key: "accountToken", labelKey: "f_account", fallback: "Account number", type: "text", required: true, format: "digits", minLength: 9, maxLength: 18 },
    { key: "accountConfirm", labelKey: "f_account_confirm", fallback: "Confirm account number", type: "text", required: true, format: "digits", clientOnly: true },
    { key: "ifsc", labelKey: "f_ifsc", fallback: "IFSC", type: "text", required: true, format: "ifsc" },
    { key: "accountType", labelKey: "f_account_type", fallback: "Account type", type: "select", required: true, options: { kind: "picklist", code: "PL_ACCOUNT_TYPE" } },
    { key: "paymentMode", labelKey: "f_payment_mode", fallback: "Payment mode", type: "select", options: { kind: "picklist", code: "PL_PAYMENT_MODE" } },
  ] },
  { id: "placement", titleKey: "sec_placement", fallback: "Placement", fields: [
    { key: "department", labelKey: "f_department", fallback: "Department", type: "select", required: true, options: { kind: "reference", list: "departments" } },
    { key: "designation", labelKey: "f_designation", fallback: "Designation", type: "text", required: true, minLength: 2, maxLength: 120 },
    { key: "joiningDate", labelKey: "f_joining_date", fallback: "Date of joining", type: "date", required: true },
    { key: "manager", labelKey: "f_manager", fallback: "Reporting manager", type: "employee", required: true },
    { key: "location", labelKey: "f_location", fallback: "Work location", type: "select", required: true, options: { kind: "reference", list: "locations" } },
    { key: "workerClass", labelKey: "f_worker_class", fallback: "Worker class", type: "select", required: true, options: { kind: "picklist", code: "PL_WORKER_CLASS" } },
    { key: "status", labelKey: "f_status", fallback: "Record status", type: "select", options: { kind: "picklist", code: "PL_PERSON_STATUS" } },
    { key: "effectiveFrom", labelKey: "f_effective_from", fallback: "Effective from", type: "date" },
    { key: "changeReason", labelKey: "f_change_reason", fallback: "Reason for change", type: "text", maxLength: 200 },
  ] },
  { id: "labour", titleKey: "sec_labour", fallback: "Labour law and overtime", fields: [
    { key: "workerCategory", labelKey: "f_worker_category", fallback: "Worker category", type: "select", options: { kind: "enum", values: WORKER_CATEGORIES } },
    { key: "hasRestDays", labelKey: "f_rest_days", fallback: "Weekly rest day applies", type: "bool" },
    { key: "otEligibility", labelKey: "f_ot", fallback: "Overtime eligibility", type: "select", options: { kind: "enum", values: OT_ELIGIBILITY } },
    { key: "salaryLocationScope", labelKey: "f_salary_scope", fallback: "Salary location", type: "select", options: { kind: "enum", values: SALARY_SCOPE } },
    { key: "assignedShift", labelKey: "f_shift", fallback: "Default shift", type: "select", options: { kind: "reference", list: "shifts" } },
  ] },
  { id: "medical", titleKey: "sec_medical", fallback: "Medical and safety", fields: [
    { key: "medicalExamDate", labelKey: "f_medical_exam", fallback: "Pre-employment medical", type: "date" },
    { key: "fitnessStatus", labelKey: "f_fitness", fallback: "Fitness status", type: "select", options: { kind: "picklist", code: "PL_FITNESS_STATUS" } },
    { key: "safetyInductionDate", labelKey: "f_safety_induction", fallback: "Safety induction date", type: "date" },
  ] },
  { id: "site", titleKey: "sec_site", fallback: "Site and facilities", fields: [
    { key: "biometricEnrolId", labelKey: "f_biometric", fallback: "Biometric enrolment ID", type: "text", maxLength: 40 },
    { key: "accessCardNo", labelKey: "f_access_card", fallback: "Access card number", type: "text", maxLength: 40 },
    { key: "transportRoute", labelKey: "f_transport", fallback: "Transport route", type: "text", maxLength: 60 },
    { key: "canteenEligible", labelKey: "f_canteen", fallback: "Canteen eligible", type: "bool" },
    { key: "uniformSize", labelKey: "f_uniform", fallback: "Uniform size", type: "text", maxLength: 20 },
    { key: "lockerNo", labelKey: "f_locker", fallback: "Locker number", type: "text", maxLength: 20 },
  ] },
];

export const ALL_FIELDS: readonly (FieldDef & { section: SectionId })[] = SECTIONS.flatMap((section) => section.fields.map((field) => ({ ...field, section: section.id })));
export const FIELD_BY_KEY: ReadonlyMap<string, FieldDef & { section: SectionId }> = new Map(ALL_FIELDS.map((field) => [field.key, field]));

/** Defaults are policy, not data: no names, numbers or identifiers are prefilled. */
export function initialValues(today: string): FormValues {
  const values: FormValues = {};
  for (const field of ALL_FIELDS) values[field.key] = field.type === "bool" ? false : "";
  values.permanentSameAsPresent = true;
  values.hasRestDays = true;
  values.canteenEligible = true;
  values.status = "active";
  values.joiningDate = today;
  values.effectiveFrom = today;
  return values;
}

/* Repeating rows ---------------------------------------------------------------------- */

export type RowField = { key: string; labelKey: string; fallback: string; type: "text" | "date" | "number" | "select" | "bool"; options?: PicklistCode; maxLength?: number };
export type RowGroupId = "dependants" | "nominees" | "education" | "experience";
export type RowGroup = { id: RowGroupId; titleKey: string; fallback: string; addKey: string; addFallback: string; max: number; fields: RowField[] };
export type Row = Record<string, string | boolean>;

export const ROW_GROUPS: readonly RowGroup[] = [
  { id: "dependants", titleKey: "sec_dependants", fallback: "Dependants", addKey: "add_dependant", addFallback: "Add dependant", max: 20, fields: [
    { key: "name", labelKey: "r_name", fallback: "Name", type: "text", maxLength: 120 },
    { key: "relation", labelKey: "r_relation", fallback: "Relation", type: "select", options: "PL_RELATION" },
    { key: "dob", labelKey: "r_dob", fallback: "Date of birth", type: "date" },
    { key: "gender", labelKey: "r_gender", fallback: "Gender", type: "select", options: "PL_GENDER" },
    { key: "insured", labelKey: "r_insured", fallback: "Insured", type: "bool" },
  ] },
  { id: "nominees", titleKey: "sec_nominees", fallback: "Statutory nominees", addKey: "add_nominee", addFallback: "Add nominee", max: 20, fields: [
    { key: "name", labelKey: "r_name", fallback: "Name", type: "text", maxLength: 120 },
    { key: "relation", labelKey: "r_relation", fallback: "Relation", type: "select", options: "PL_RELATION" },
    { key: "dob", labelKey: "r_dob", fallback: "Date of birth", type: "date" },
    { key: "sharePercent", labelKey: "r_share", fallback: "Share (%)", type: "number" },
    { key: "scheme", labelKey: "r_scheme", fallback: "Scheme", type: "select", options: "PL_NOMINEE_SCHEME" },
    { key: "guardianName", labelKey: "r_guardian", fallback: "Guardian (minor)", type: "text", maxLength: 120 },
  ] },
  { id: "education", titleKey: "sec_education", fallback: "Education", addKey: "add_education", addFallback: "Add qualification", max: 20, fields: [
    { key: "level", labelKey: "r_level", fallback: "Level", type: "select", options: "PL_EDUCATION_LEVEL" },
    { key: "degree", labelKey: "r_degree", fallback: "Degree", type: "text", maxLength: 100 },
    { key: "institute", labelKey: "r_institute", fallback: "Institute or board", type: "text", maxLength: 150 },
    { key: "passingYear", labelKey: "r_year", fallback: "Year of passing", type: "number" },
    { key: "score", labelKey: "r_score", fallback: "Score", type: "text", maxLength: 50 },
    { key: "isHighest", labelKey: "r_highest", fallback: "Highest", type: "bool" },
  ] },
  { id: "experience", titleKey: "sec_experience", fallback: "Work history", addKey: "add_experience", addFallback: "Add employer", max: 20, fields: [
    { key: "employer", labelKey: "r_employer", fallback: "Employer", type: "text", maxLength: 150 },
    { key: "designation", labelKey: "r_designation", fallback: "Designation", type: "text", maxLength: 100 },
    { key: "fromDate", labelKey: "r_from", fallback: "From", type: "date" },
    { key: "toDate", labelKey: "r_to", fallback: "To", type: "date" },
    { key: "reasonForLeaving", labelKey: "r_reason", fallback: "Reason for leaving", type: "text", maxLength: 200 },
    { key: "prevUan", labelKey: "r_prev_uan", fallback: "Previous UAN", type: "text", maxLength: 12 },
  ] },
];

export type Rows = Record<RowGroupId, Row[]>;

export function emptyRow(group: RowGroup): Row {
  return Object.fromEntries(group.fields.map((field) => [field.key, field.type === "bool" ? false : ""]));
}

export function initialRows(): Rows {
  return { dependants: [], nominees: [], education: [], experience: [] };
}

export function rowIsBlank(row: Row): boolean {
  return Object.values(row).every((value) => value === "" || value === false);
}
