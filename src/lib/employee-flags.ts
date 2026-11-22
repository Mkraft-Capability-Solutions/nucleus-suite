/**
 * Employee flags: warnings and alerts raised from the employee record itself. Each organisation
 * chooses which rules are on and when they fire (table employee_flag_rules, migration 0034); a
 * missing rule uses the defaults below. Flags are computed when asked for, never stored.
 *
 * Every rule reads a date the employee form captures:
 * - passport_expiry   employees.metadata.passportExpiry       (Statutory & bank → Passport expiry)
 * - visa_expiry       employees.metadata.workPermitExpiry     (international workers → Work permit / visa expiry)
 * - medical_exam_due  employees.metadata.medicalExamDate + interval; metadata.fitnessStatus
 *                     (Health & site → Medical examination date, Fitness status)
 * - retirement_due    employees.date_of_birth + retirement age (Identity → Date of birth)
 */

export const FLAG_RULE_KEYS = ["passport_expiry", "visa_expiry", "medical_exam_due", "retirement_due"] as const;
export type FlagRuleKey = (typeof FLAG_RULE_KEYS)[number];
export type FlagSeverity = "warning" | "alert";

export type FlagRuleSettings = { intervalMonths?: number; retirementAge?: number };

export type FlagRule = {
  key: FlagRuleKey;
  enabled: boolean;
  /** Warning from this many days before the due date. */
  warningDays: number;
  /** Alert from this many days before the due date (and once it has passed). Never more than warningDays. */
  alertDays: number;
  settings: FlagRuleSettings;
};

export type FlagRuleDefinition = {
  key: FlagRuleKey;
  label: string;
  description: string;
  /** Where the date comes from, in the words of the employee form. */
  source: string;
  defaults: Omit<FlagRule, "key">;
  setting?: { key: keyof FlagRuleSettings; label: string; unit: string; min: number; max: number };
};

export const FLAG_RULES: readonly FlagRuleDefinition[] = [
  {
    key: "passport_expiry",
    label: "Passport expiry",
    description: "The employee's passport is about to expire or has expired.",
    source: "Statutory & bank → Passport expiry",
    defaults: { enabled: true, warningDays: 90, alertDays: 30, settings: {} },
  },
  {
    key: "visa_expiry",
    label: "Work permit / visa expiry",
    description: "An international worker's work permit or visa is about to expire or has expired.",
    source: "Statutory & bank → Work permit / visa expiry (international workers)",
    defaults: { enabled: true, warningDays: 90, alertDays: 30, settings: {} },
  },
  {
    key: "medical_exam_due",
    label: "Medical examination due",
    description: "The periodic medical examination is due or overdue, or the employee is recorded as unfit or pending a fitness decision.",
    source: "Health & site → Medical examination date and Fitness status",
    defaults: { enabled: true, warningDays: 30, alertDays: 0, settings: { intervalMonths: 12 } },
    setting: { key: "intervalMonths", label: "Examination every", unit: "months", min: 1, max: 60 },
  },
  {
    key: "retirement_due",
    label: "Retirement approaching",
    description: "The employee reaches the organisation's retirement age soon.",
    source: "Identity → Date of birth",
    defaults: { enabled: true, warningDays: 180, alertDays: 60, settings: { retirementAge: 60 } },
    setting: { key: "retirementAge", label: "Retirement age", unit: "years", min: 50, max: 75 },
  },
];

export const FLAG_RULE_BY_KEY = Object.fromEntries(FLAG_RULES.map((rule) => [rule.key, rule])) as Record<FlagRuleKey, FlagRuleDefinition>;

/** The organisation's rules: stored values over the defaults, one per known rule, in catalogue order. */
export function resolveRules(stored: ReadonlyArray<Partial<Omit<FlagRule, "key">> & { key: string }>): FlagRule[] {
  return FLAG_RULES.map((definition) => {
    const row = stored.find((entry) => entry.key === definition.key);
    return {
      key: definition.key,
      enabled: row?.enabled ?? definition.defaults.enabled,
      warningDays: row?.warningDays ?? definition.defaults.warningDays,
      alertDays: row?.alertDays ?? definition.defaults.alertDays,
      settings: { ...definition.defaults.settings, ...(row?.settings ?? {}) },
    };
  });
}

/** The parts of an employee record the rules read. */
export type FlaggableEmployee = {
  id: string;
  code: string;
  name: string;
  dateOfBirth: string | null;
  passportExpiry: string | null;
  workPermitExpiry: string | null;
  isInternationalWorker: boolean;
  medicalExamDate: string | null;
  fitnessStatus: string | null;
};

export type EmployeeFlag = {
  /** Stable per employee, rule and severity: a person who closed the warning sees the alert. */
  id: string;
  employeeId: string;
  rule: FlagRuleKey;
  severity: FlagSeverity;
  /** The date that matters (expiry, examination due, retirement), when there is one. */
  dueDate: string | null;
  /** Days until the due date; negative once it has passed. */
  daysLeft: number | null;
  /** What is wrong, without the employee's name ("Passport expires in 25 days (12 Dec 2026)."). */
  detail: string;
};

const DAY = 86_400_000;

/** A calendar date (YYYY-MM-DD) or null; anything else (empty strings, junk) is treated as missing. */
export function parseDay(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : text;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/** Adds months (or years × 12), keeping the day where the month allows it (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date, lastDay));
  return target.toISOString().slice(0, 10);
}

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function when(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} ago`;
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  return `in ${daysLeft} days`;
}

function severityFor(rule: FlagRule, daysLeft: number): FlagSeverity | null {
  if (daysLeft <= rule.alertDays) return "alert";
  if (daysLeft <= rule.warningDays) return "warning";
  return null;
}

function dated(rule: FlagRule, employee: FlaggableEmployee, dueDate: string, today: string, text: (relative: string, date: string) => string): EmployeeFlag | null {
  const daysLeft = daysBetween(today, dueDate);
  const severity = severityFor(rule, daysLeft);
  if (!severity) return null;
  return { id: `${employee.id}:${rule.key}:${severity}`, employeeId: employee.id, rule: rule.key, severity, dueDate, daysLeft, detail: text(when(daysLeft), formatDay(dueDate)) };
}

/** The flags one employee raises under the organisation's rules, as of `today` (YYYY-MM-DD). */
export function evaluateEmployee(employee: FlaggableEmployee, rules: readonly FlagRule[], today: string): EmployeeFlag[] {
  const flags: EmployeeFlag[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.key === "passport_expiry") {
      const due = parseDay(employee.passportExpiry);
      const flag = due && dated(rule, employee, due, today, (relative, date) => (due < today ? `Passport expired ${relative} (${date}).` : `Passport expires ${relative} (${date}).`));
      if (flag) flags.push(flag);
    } else if (rule.key === "visa_expiry") {
      const due = parseDay(employee.workPermitExpiry);
      const flag = due && dated(rule, employee, due, today, (relative, date) => (due < today ? `Work permit / visa expired ${relative} (${date}).` : `Work permit / visa expires ${relative} (${date}).`));
      if (flag) flags.push(flag);
    } else if (rule.key === "medical_exam_due") {
      const fitness = String(employee.fitnessStatus ?? "").trim().toLowerCase();
      const last = parseDay(employee.medicalExamDate);
      let flag: EmployeeFlag | null = null;
      if (last) {
        const due = addMonths(last, rule.settings.intervalMonths ?? 12);
        flag = dated(rule, employee, due, today, (relative, date) => (due < today ? `Medical examination overdue: was due ${relative} (${date}).` : `Medical examination due ${relative} (${date}).`));
      }
      // A recorded fitness decision raises the flag whatever the examination date says.
      if (fitness === "unfit") {
        flag = { id: `${employee.id}:${rule.key}:alert`, employeeId: employee.id, rule: rule.key, severity: "alert", dueDate: flag?.dueDate ?? null, daysLeft: flag?.daysLeft ?? null, detail: "Recorded as unfit at the last medical examination." };
      } else if (fitness === "pending" && (!flag || flag.severity === "warning")) {
        flag = { id: `${employee.id}:${rule.key}:warning`, employeeId: employee.id, rule: rule.key, severity: "warning", dueDate: flag?.dueDate ?? null, daysLeft: flag?.daysLeft ?? null, detail: "Medical fitness decision is pending." };
      }
      if (flag) flags.push(flag);
    } else if (rule.key === "retirement_due") {
      const born = parseDay(employee.dateOfBirth);
      if (!born || born >= today) continue;
      const due = addMonths(born, 12 * (rule.settings.retirementAge ?? 60));
      const flag = dated(rule, employee, due, today, (relative, date) => (due < today ? `Retirement age reached ${relative} (${date}).` : `Reaches retirement age ${relative} (${date}).`));
      if (flag) flags.push(flag);
    }
  }
  return flags;
}

/** Alerts first, then the soonest due date. */
export function sortFlags<T extends Pick<EmployeeFlag, "severity" | "daysLeft">>(flags: T[]): T[] {
  return [...flags].sort((a, b) => (a.severity === b.severity ? (a.daysLeft ?? -99999) - (b.daysLeft ?? -99999) : a.severity === "alert" ? -1 : 1));
}
