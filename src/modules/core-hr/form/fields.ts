import type { FieldRule } from "@/hooks/useFormValidation";
import { getPicklistOptions } from "@/lib/picklist-catalog";

/**
 * The employee form: the same fields and the same validation rules as the classic wizard
 * (EmployeeCreationWizard: TAB_RULES, field keys), grouped into sections. Keys are kept identical
 * so the stored record reads the same in both interfaces.
 */

export type FieldType = "text" | "email" | "tel" | "date" | "select" | "checkbox" | "textarea" | "number" | "manager";

export type FormField = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  hint?: string;
  /** Full-width in the two-column grid. */
  wide?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  /** Only shown when this returns true for the current values. */
  showIf?: (values: Record<string, unknown>) => boolean;
  /** Read-only when editing an existing record. */
  lockedOnEdit?: boolean;
};

export type Repeater = {
  key: "education" | "experience" | "dependants" | "nominees";
  label: string;
  addLabel: string;
  fields: FormField[];
  empty: Record<string, unknown>;
};

export type FormSection = { id: string; title: string; description: string; fields: FormField[]; repeaters?: Repeater[] };

const pick = (code: string) => (getPicklistOptions(code) as Array<{ value: string }>).map((option) => option.value);

export const FORM_SECTIONS: FormSection[] = [
  {
    id: "identity",
    title: "Identity",
    description: "Legal name and personal identity as on official documents.",
    fields: [
      { key: "employeeCode", label: "Employee code", required: true, lockedOnEdit: true, hint: "Unique in the organisation. Cannot be changed later." },
      { key: "salutation", label: "Salutation", type: "select", options: pick("PL_SALUTATION") },
      { key: "firstName", label: "First name", required: true, autoComplete: "given-name" },
      { key: "middleName", label: "Middle name", autoComplete: "additional-name" },
      { key: "lastName", label: "Last name", required: true, autoComplete: "family-name" },
      { key: "nameAsPerBank", label: "Name as per bank records" },
      { key: "formerName", label: "Former name", hint: "If the name has changed (for PF and background checks)." },
      { key: "gender", label: "Gender", type: "select", required: true, options: pick("PL_GENDER") },
      { key: "dateOfBirth", label: "Date of birth", type: "date", required: true },
      { key: "bloodGroup", label: "Blood group", type: "select", options: pick("PL_BLOOD_GROUP") },
      { key: "nationality", label: "Nationality" },
      { key: "placeOfBirth", label: "Place of birth" },
      { key: "motherTongue", label: "Mother tongue" },
      { key: "socialCategory", label: "Social category", type: "select", options: pick("PL_SOCIAL_CAT") },
      { key: "religion", label: "Religion" },
      { key: "isDifferentlyAbled", label: "Person with disability", type: "checkbox" },
      { key: "disabilityType", label: "Disability type", showIf: (values) => values.isDifferentlyAbled === true },
      { key: "disabilityPercent", label: "Disability percentage", type: "number", showIf: (values) => values.isDifferentlyAbled === true, hint: "40% and above qualifies for the higher deduction." },
      { key: "isExServiceman", label: "Ex-serviceman", type: "checkbox" },
    ],
  },
  {
    id: "family",
    title: "Family",
    description: "Parents and spouse, used in statutory forms and nominations.",
    fields: [
      { key: "maritalStatus", label: "Marital status", type: "select", options: pick("PL_MARITAL_STATUS") },
      { key: "marriageDate", label: "Date of marriage", type: "date", showIf: (values) => String(values.maritalStatus ?? "").toLowerCase() === "married" },
      { key: "fatherName", label: "Father's name" },
      { key: "motherName", label: "Mother's name" },
      { key: "spouseName", label: "Spouse's name", showIf: (values) => String(values.maritalStatus ?? "").toLowerCase() === "married" },
    ],
    repeaters: [
      {
        key: "dependants", label: "Dependants", addLabel: "Add dependant",
        empty: { name: "", relation: "", dob: "", gender: "", insured: true },
        fields: [
          { key: "name", label: "Name" },
          { key: "relation", label: "Relation", type: "select", options: pick("PL_RELATION") },
          { key: "dob", label: "Date of birth", type: "date" },
          { key: "gender", label: "Gender", type: "select", options: pick("PL_GENDER") },
          { key: "insured", label: "Covered by insurance", type: "checkbox" },
        ],
      },
      {
        key: "nominees", label: "Nominees", addLabel: "Add nominee",
        empty: { name: "", relation: "", dob: "", sharePercent: 100, scheme: "PF", guardianName: "", address: "" },
        fields: [
          { key: "name", label: "Name" },
          { key: "relation", label: "Relation", type: "select", options: pick("PL_RELATION") },
          { key: "dob", label: "Date of birth", type: "date" },
          { key: "sharePercent", label: "Share %", type: "number" },
          { key: "scheme", label: "Scheme", type: "select", options: ["PF", "Gratuity", "ESI", "Insurance"] },
          { key: "guardianName", label: "Guardian (if minor)" },
          { key: "address", label: "Address", wide: true },
        ],
      },
    ],
  },
  {
    id: "contact",
    title: "Contact & address",
    description: "How to reach the employee and who to call in an emergency.",
    fields: [
      { key: "mobile", label: "Mobile", type: "tel", required: true, inputMode: "tel", autoComplete: "tel", placeholder: "10-digit mobile" },
      { key: "altMobile", label: "Alternate mobile", type: "tel", inputMode: "tel" },
      { key: "personalEmail", label: "Personal email", type: "email", required: true, autoComplete: "email" },
      { key: "officialEmail", label: "Work email", type: "email", hint: "Used for sign-in invitations and notifications." },
      { key: "presentAddr1", label: "Address line 1", required: true, wide: true, autoComplete: "address-line1" },
      { key: "presentAddr2", label: "Address line 2", wide: true, autoComplete: "address-line2" },
      { key: "presentCity", label: "City", required: true, autoComplete: "address-level2" },
      { key: "presentDistrict", label: "District" },
      { key: "presentState", label: "State", required: true, autoComplete: "address-level1" },
      { key: "presentPin", label: "PIN code", required: true, inputMode: "numeric", autoComplete: "postal-code" },
      { key: "presentCountry", label: "Country", autoComplete: "country-name" },
      { key: "permanentSameAsPresent", label: "Permanent address is the same", type: "checkbox" },
      { key: "permanentAddress", label: "Permanent address", type: "textarea", wide: true, showIf: (values) => values.permanentSameAsPresent === false },
      { key: "emergencyName", label: "Emergency contact name", required: true },
      { key: "emergencyRelation", label: "Relation", type: "select", options: pick("PL_RELATION") },
      { key: "emergencyPhone", label: "Emergency contact phone", type: "tel", required: true, inputMode: "tel" },
      { key: "emergencySecondaryName", label: "Second emergency contact" },
      { key: "emergencySecondaryRelation", label: "Relation", type: "select", options: pick("PL_RELATION") },
      { key: "emergencySecondaryPhone", label: "Phone", type: "tel", inputMode: "tel" },
    ],
  },
  {
    id: "statutory",
    title: "Statutory & bank",
    description: "Identifiers and the salary account. Stored masked and shown only to roles allowed to see them.",
    fields: [
      { key: "panToken", label: "PAN", placeholder: "ABCDE1234F" },
      { key: "aadhaarToken", label: "Aadhaar", inputMode: "numeric", placeholder: "12 digits" },
      { key: "uan", label: "UAN", inputMode: "numeric", placeholder: "12 digits" },
      { key: "esiIp", label: "ESI IP number", inputMode: "numeric", placeholder: "17 digits" },
      { key: "passportToken", label: "Passport number" },
      { key: "passportExpiry", label: "Passport expiry", type: "date" },
      { key: "drivingLicence", label: "Driving licence" },
      { key: "voterId", label: "Voter ID" },
      { key: "npsPran", label: "NPS PRAN" },
      { key: "isInternationalWorker", label: "International worker", type: "checkbox" },
      { key: "countryOfOrigin", label: "Country of origin", showIf: (values) => values.isInternationalWorker === true },
      { key: "workPermitNo", label: "Work permit number", showIf: (values) => values.isInternationalWorker === true },
      { key: "bankName", label: "Bank name", required: true },
      { key: "bankBranch", label: "Branch" },
      { key: "accountToken", label: "Account number", required: true, inputMode: "numeric" },
      { key: "accountConfirm", label: "Confirm account number", required: true, inputMode: "numeric" },
      { key: "ifsc", label: "IFSC", required: true, placeholder: "HDFC0000123" },
      { key: "accountType", label: "Account type", type: "select", required: true, options: ["Savings", "Current", "Salary"] },
      { key: "paymentMode", label: "Payment mode", type: "select", options: ["Bank Transfer", "Cheque", "Cash"] },
    ],
  },
  {
    id: "background",
    title: "Education & experience",
    description: "Qualifications and previous employers.",
    fields: [],
    repeaters: [
      {
        key: "education", label: "Education", addLabel: "Add qualification",
        empty: { level: "", degree: "", institute: "", passingYear: "", score: "" },
        fields: [
          { key: "level", label: "Level", type: "select", options: pick("PL_EDU_LEVEL") },
          { key: "degree", label: "Degree / course" },
          { key: "institute", label: "Institute" },
          { key: "passingYear", label: "Year of passing", inputMode: "numeric" },
          { key: "score", label: "Score / grade" },
        ],
      },
      {
        key: "experience", label: "Previous employment", addLabel: "Add employer",
        empty: { employer: "", designation: "", fromDate: "", toDate: "", lastCtc: "", reasonForLeaving: "", prevUan: "" },
        fields: [
          { key: "employer", label: "Employer" },
          { key: "designation", label: "Designation" },
          { key: "fromDate", label: "From", type: "date" },
          { key: "toDate", label: "To", type: "date" },
          { key: "lastCtc", label: "Last CTC", inputMode: "numeric" },
          { key: "prevUan", label: "Previous UAN", inputMode: "numeric" },
          { key: "reasonForLeaving", label: "Reason for leaving", wide: true },
        ],
      },
    ],
  },
  {
    id: "job",
    title: "Job & placement",
    description: "Where the employee works, who they report to and how time and pay are handled.",
    fields: [
      { key: "designation", label: "Designation", required: true },
      { key: "department", label: "Department", required: true },
      { key: "location", label: "Work location", required: true },
      { key: "manager", label: "Reporting manager", type: "manager", required: true },
      { key: "joiningDate", label: "Date of joining", type: "date", required: true },
      { key: "workerClass", label: "Worker class", type: "select", required: true, options: pick("PL_WORKER_CLASS") },
      { key: "workerCategory", label: "Worker category", type: "select", options: ["PERM", "CONTRACT", "THIRD_PARTY_EMP", "THIRD_PARTY_HELPER", "TRAINEE_DET", "TRAINEE_GET"], hint: "Decides labour-law treatment and overtime." },
      { key: "status", label: "Status", type: "select", options: ["Active", "Probation", "On Leave", "Notice", "Inactive"] },
      { key: "assignedShift", label: "Shift", type: "select", options: ["A", "B", "C", "GENERAL", "AUTO_DETECT"] },
      { key: "otEligibility", label: "Overtime eligibility", type: "select", options: ["ALL_DAYS", "REST_HOLIDAYS_ONLY", "NONE"] },
      { key: "salaryLocationScope", label: "Salary processed at", type: "select", options: ["PLANT", "HO"] },
      { key: "hasRestDays", label: "Has weekly rest days", type: "checkbox" },
      { key: "effectiveFrom", label: "Effective from", type: "date" },
      { key: "changeReason", label: "Reason for this record or change", wide: true },
    ],
  },
  {
    id: "site",
    title: "Health & site",
    description: "Medical fitness, safety induction and site facilities.",
    fields: [
      { key: "medicalExamDate", label: "Medical examination date", type: "date" },
      { key: "fitnessStatus", label: "Fitness status", type: "select", options: ["Fit", "Fit with restrictions", "Unfit", "Pending"] },
      { key: "safetyInductionDate", label: "Safety induction date", type: "date" },
      { key: "biometricEnrolId", label: "Biometric enrolment ID" },
      { key: "accessCardNo", label: "Access card number" },
      { key: "lockerNo", label: "Locker number" },
      { key: "transportRoute", label: "Transport route" },
      { key: "uniformSize", label: "Uniform size", type: "select", options: ["XS", "S", "M", "L", "XL", "XXL"] },
      { key: "canteenEligible", label: "Canteen eligible", type: "checkbox" },
    ],
  },
];

/** Validation rules: identical to the classic wizard's TAB_RULES. */
export const FORM_RULES: Record<string, FieldRule[]> = {
  identity: [
    { key: "employeeCode", label: "Employee Code", required: true, minLength: 1 },
    { key: "firstName", label: "First Name", required: true, minLength: 1 },
    { key: "lastName", label: "Last Name", required: true, minLength: 1 },
    { key: "gender", label: "Gender", required: true },
    { key: "dateOfBirth", label: "Date of Birth", required: true, type: "date" },
  ],
  family: [],
  contact: [
    { key: "mobile", label: "Primary Mobile", required: true, type: "phone" },
    { key: "personalEmail", label: "Personal Email", required: true, type: "email" },
    { key: "officialEmail", label: "Work Email", type: "email" },
    { key: "emergencyName", label: "Emergency Contact Name", required: true, minLength: 2 },
    { key: "emergencyPhone", label: "Emergency Contact Phone", required: true, type: "phone" },
    { key: "presentAddr1", label: "Present Address Line 1", required: true, minLength: 3 },
    { key: "presentCity", label: "City", required: true, minLength: 2 },
    { key: "presentState", label: "State", required: true },
    { key: "presentPin", label: "PIN Code", required: true, type: "pin" },
  ],
  statutory: [
    { key: "panToken", label: "PAN Number", type: "pan" },
    { key: "aadhaarToken", label: "Aadhaar Number", type: "aadhaar" },
    { key: "uan", label: "UAN (Universal Account Number)", type: "uan" },
    { key: "esiIp", label: "ESI IP Number", type: "esiIp" },
    { key: "bankName", label: "Bank Name", required: true, minLength: 2 },
    { key: "accountToken", label: "Account Number", required: true, minLength: 9, maxLength: 18 },
    { key: "accountConfirm", label: "Confirm Account Number", required: true, matchKey: "accountToken", matchLabel: "Account Number" },
    { key: "ifsc", label: "IFSC Code", required: true, type: "ifsc" },
    { key: "accountType", label: "Account Type", required: true },
  ],
  background: [],
  job: [
    { key: "department", label: "Department", required: true },
    { key: "designation", label: "Designation", required: true, minLength: 2 },
    { key: "joiningDate", label: "Date of Joining", required: true, type: "date" },
    { key: "manager", label: "Reporting Manager", required: true, minLength: 2 },
    { key: "location", label: "Work Location", required: true },
    { key: "workerClass", label: "Worker Class", required: true },
  ],
  site: [],
};

export const ALL_FORM_RULES = Object.values(FORM_RULES).flat();

/** Empty values for a new employee. No invented defaults: every field starts blank or neutral. */
export function emptyEmployeeValues(today: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const section of FORM_SECTIONS) {
    for (const field of section.fields) values[field.key] = field.type === "checkbox" ? false : "";
    for (const repeater of section.repeaters ?? []) values[repeater.key] = [];
  }
  return {
    ...values,
    nationality: "Indian",
    presentCountry: "India",
    permanentSameAsPresent: true,
    accountType: "Savings",
    paymentMode: "Bank Transfer",
    joiningDate: today,
    effectiveFrom: today,
    status: "Active",
    workerCategory: "PERM",
    hasRestDays: true,
    otEligibility: "ALL_DAYS",
    salaryLocationScope: "PLANT",
    assignedShift: "GENERAL",
    canteenEligible: true,
  };
}
