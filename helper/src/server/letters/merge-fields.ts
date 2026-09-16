import "server-only";

/**
 * Letter merge fields — R-22 / F-DOC-01.
 *
 * The workbook makes two demands of this vocabulary:
 *
 *   1. The available merge fields come "from the employee record".
 *   2. "A template referencing a field that does not exist must fail validation on
 *      save, not at issue."
 *
 * The vocabulary below is the client's own, read off the templates in
 * `scripts/excel_data/32_letter_templates.json` - eight templates, twenty-six
 * distinct fields. None of it is invented, and nothing outside it may appear in a
 * template body.
 *
 * Each field declares where its value comes from:
 *
 *   `record` - resolvable from the employee record (or the manager it points at),
 *              filled automatically when the letter is issued.
 *   `manual` - real to the client's templates but held nowhere on the employee
 *              record: an incident, a conduct remark, a components table, a salary
 *              certificate period. `issueLetterSchema.manualFields` already exists
 *              for exactly these, and they must be supplied at issue.
 *
 * A `manual` field is NOT a gap that can be closed by guessing: writing
 * `prior_warnings` off the employee row would mean inventing a disciplinary history.
 * The split is stated here so the template editor can say which is which.
 */

export type MergeFieldSource = "record" | "manual";

export type MergeFieldSpec = {
  key: string;
  label: string;
  source: MergeFieldSource;
  /** For a record field, where the value is read from. For a manual one, why it is manual. */
  note: string;
};

/** The merge-field catalogue. Ordered as the client's templates introduce them. */
export const MERGE_FIELDS: readonly MergeFieldSpec[] = [
  { key: "name", label: "Employee name", source: "record", note: "`employees.first_name` and `employees.last_name`." },
  { key: "designation", label: "Designation", source: "record", note: "`employees.designation`." },
  { key: "doj", label: "Date of joining", source: "record", note: "`employees.joining_date`." },
  { key: "location", label: "Location", source: "record", note: "`employees.location`." },
  { key: "reporting_to", label: "Reporting manager", source: "record", note: "The name on `employees.manager_employee_id`." },
  {
    key: "confirmation_date",
    label: "Confirmation date",
    source: "record",
    note: "`employees.metadata->>'confirmation_date'`, the only place this system records a confirmation.",
  },
  {
    key: "band",
    label: "Band",
    source: "manual",
    note: "No employee-to-band relationship exists in this schema: `compensation_bands` is not joined to an employee, so a band cannot be read off the record.",
  },
  {
    key: "ctc",
    label: "Cost to company",
    source: "manual",
    note: "`employees.basic_salary_minor` is basic pay, not CTC. Deriving one from the other would state a figure nobody approved.",
  },
  { key: "revised_ctc", label: "Revised CTC", source: "manual", note: "Same as `ctc`; and the revision is the letter's own subject." },
  { key: "old_ctc", label: "Previous CTC", source: "manual", note: "Same as `ctc`." },
  { key: "new_ctc", label: "New CTC", source: "manual", note: "Same as `ctc`." },
  { key: "notice_days", label: "Notice period (days)", source: "manual", note: "Notice period is a contract term; `employees` carries no notice-period column." },
  { key: "probation_months", label: "Probation (months)", source: "manual", note: "Probation length is a contract term; `employees` carries no probation column." },
  { key: "effective_date", label: "Effective date", source: "manual", note: "The date this particular letter takes effect, which belongs to the letter and not to the employee." },
  { key: "components_table", label: "Salary components table", source: "manual", note: "A rendered block of the salary structure this letter carries; it is not a single value on the record." },
  { key: "from_location", label: "Transferred from", source: "manual", note: "The employee record holds the current location only; the prior one belongs to the transfer." },
  { key: "to_location", label: "Transferred to", source: "manual", note: "The destination belongs to the transfer, not yet to the record." },
  { key: "lwd", label: "Last working day", source: "manual", note: "`employees` carries no last-working-day column; the date belongs to the exit record." },
  { key: "conduct", label: "Conduct remark", source: "manual", note: "A written judgement, held nowhere on the employee record." },
  { key: "dues_cleared", label: "Dues cleared", source: "manual", note: "The no-dues position belongs to the settlement, not to the employee record." },
  { key: "gross", label: "Gross pay", source: "manual", note: "A payslip figure for a stated period, not a value on the employee record." },
  { key: "net", label: "Net pay", source: "manual", note: "A payslip figure for a stated period, not a value on the employee record." },
  { key: "period", label: "Period", source: "manual", note: "The period a salary certificate covers, chosen when the certificate is issued." },
  { key: "incident_date", label: "Incident date", source: "manual", note: "Belongs to the disciplinary matter this letter is about." },
  { key: "incident", label: "Incident", source: "manual", note: "Belongs to the disciplinary matter this letter is about." },
  { key: "prior_warnings", label: "Prior warnings", source: "manual", note: "No disciplinary history is held on the employee record." },
] as const;

export const MERGE_FIELD_KEYS: readonly string[] = MERGE_FIELDS.map((field) => field.key);

export const RECORD_MERGE_FIELD_KEYS: readonly string[] = MERGE_FIELDS.filter((field) => field.source === "record").map(
  (field) => field.key,
);

export function mergeFieldSpec(key: string): MergeFieldSpec | null {
  return MERGE_FIELDS.find((field) => field.key === key) ?? null;
}

/** `{{ field }}` — whitespace tolerated, the key itself is not. */
const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;

/**
 * Every merge field a piece of template text references, in first-seen order.
 * Returns the raw token, so an unknown or malformed one can be reported verbatim.
 */
export function referencedMergeFields(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER)) {
    const token = (match[1] ?? "").trim();
    if (!found.includes(token)) found.push(token);
  }
  return found;
}

export type MergeFieldIssue = { field: string; issue: string };

/**
 * Validate the merge fields a template references. This is the save-time gate the
 * workbook demands: a template naming a field that does not exist is refused here,
 * so the failure lands on the person editing the template rather than on the person
 * issuing a letter to a real employee months later.
 */
export function validateTemplateMergeFields(text: string): MergeFieldIssue[] {
  const issues: MergeFieldIssue[] = [];
  for (const token of referencedMergeFields(text)) {
    if (token === "") {
      issues.push({ field: "{{}}", issue: "An empty merge field. Name the field between the braces." });
      continue;
    }
    if (mergeFieldSpec(token)) continue;
    const suggestion = MERGE_FIELD_KEYS.find((key) => key.replace(/_/g, "") === token.toLowerCase().replace(/[_\s-]/g, ""));
    issues.push({
      field: token,
      issue: suggestion
        ? `\`${token}\` is not a merge field. Did you mean \`${suggestion}\`?`
        : `\`${token}\` is not a merge field. The employee record cannot supply it. Available fields: ${MERGE_FIELD_KEYS.join(", ")}.`,
    });
  }
  return issues;
}

/** The employee facts a record-sourced merge field can be filled from. */
export type MergeEmployee = {
  firstName: string | null;
  lastName: string | null;
  designation: string | null;
  joiningDate: string | null;
  location: string | null;
  managerName: string | null;
  confirmationDate: string | null;
};

function fromRecord(key: string, employee: MergeEmployee): string | null {
  switch (key) {
    case "name": {
      const name = `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim();
      return name === "" ? null : name;
    }
    case "designation":
      return employee.designation;
    case "doj":
      return employee.joiningDate;
    case "location":
      return employee.location;
    case "reporting_to":
      return employee.managerName;
    case "confirmation_date":
      return employee.confirmationDate;
    default:
      return null;
  }
}

export type RenderedLetter = {
  text: string;
  /** Every value that went into the text, so the issue can be reproduced from it alone. */
  values: Record<string, string>;
  /** Fields the template names that neither the record nor the issue could fill. */
  unresolved: MergeFieldIssue[];
};

/**
 * Fill a template's merge fields for one employee.
 *
 * A record field comes from the employee; a manual field comes from the values
 * supplied at issue. An unfilled field is reported, never replaced with a blank or
 * with the placeholder text: a letter with a hole in it must not be issued.
 */
export function renderTemplate(text: string, employee: MergeEmployee, manual: Record<string, string>): RenderedLetter {
  const values: Record<string, string> = {};
  const unresolved: MergeFieldIssue[] = [];
  for (const key of referencedMergeFields(text)) {
    const spec = mergeFieldSpec(key);
    if (!spec) {
      unresolved.push({ field: key, issue: `\`${key}\` is not a merge field.` });
      continue;
    }
    const supplied = manual[key];
    const resolved =
      spec.source === "record" ? (fromRecord(key, employee) ?? (supplied?.trim() ? supplied.trim() : null)) : (supplied?.trim() || null);
    if (resolved === null) {
      unresolved.push({
        field: key,
        issue:
          spec.source === "record"
            ? `${spec.label} is blank on this employee's record (${spec.note}), so the letter cannot be filled.`
            : `${spec.label} is not held on the employee record (${spec.note}). Supply it in \`manualFields\`.`,
      });
      continue;
    }
    values[key] = resolved;
  }
  const rendered = text.replace(PLACEHOLDER, (whole, raw: string) => {
    const key = raw.trim();
    return Object.hasOwn(values, key) ? values[key]! : whole;
  });
  return { text: rendered, values, unresolved };
}
