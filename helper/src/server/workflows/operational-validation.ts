import { z } from "zod";

import { picklistValues } from "@/lib/picklists";
import { operationalResources } from "@/lib/operational-catalog";
import {
  AADHAAR_PATTERN, ESI_IP_PATTERN, isAadhaarChecksumValid, isIndividualPan,
  NPS_PRAN_PATTERN, PASSPORT_PATTERN, UAN_PATTERN,
} from "@/lib/statutory-ids";
import type { Field } from "@/lib/workflow-catalog";
import { HttpError } from "@/server/platform/http";
import { EARNING_HEADS, RECOVERY_HEADS } from "@/server/payroll/settlement";
import { settlementReasonIssues, SETTLEMENT_REMARKS_MIN_LENGTH } from "@/server/payroll/settlement-proposals";
import { declarationIssues } from "@/server/payroll/tax";

/**
 * Formats the workbook states a rule for. A catalog field opts in through `format`, so
 * the rule lives with the identifier it belongs to instead of being retyped per resource.
 */
const FORMATS: Record<string, z.ZodType> = {
  aadhaar: z.string().trim().regex(AADHAAR_PATTERN, "Aadhaar is 12 digits.").refine(isAadhaarChecksumValid, "That Aadhaar number fails its checksum."),
  pan: z.string().trim().toUpperCase().refine(isIndividualPan, "A personal PAN looks like ABCDE1234F with P as the fourth character."),
  uan: z.string().trim().regex(UAN_PATTERN, "A UAN is 12 digits."),
  esiIp: z.string().trim().regex(ESI_IP_PATTERN, "An ESI IP number is 17 digits."),
  npsPran: z.string().trim().regex(NPS_PRAN_PATTERN, "A PRAN is 12 digits."),
  passport: z.string().trim().toUpperCase().regex(PASSPORT_PATTERN, "A passport number is 8 or 9 letters and digits."),
};

/** FRM-TIM-02 publishes a roster for at most a two-month window. */
const ROSTER_MAX_PERIOD_DAYS = 62;

/** FRM-PAY-06 vendor GSTIN: 2-digit state code, PAN, entity number, `Z`, checksum character. */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function validator(field: Field): z.ZodType {
  let schema: z.ZodType;
  if (field.kind === "number") schema = (field.integer ? z.number().int() : z.number()).min(field.min ?? 0).max(field.max ?? Number.MAX_SAFE_INTEGER);
  else if (field.kind === "boolean") schema = z.boolean();
  // A multi-select declares its member field in `item`; the renderer already draws both.
  else if (field.kind === "array") schema = z.array(validator(field.item ?? { kind: "text" })).min(field.min ?? 1).max(field.max ?? 50);
  else if (field.kind === "select") schema = z.enum(field.options as [string, ...string[]]);
  // A repeating table declares its row shape in `fields`; the renderer already draws one.
  else if (field.kind === "object") schema = z.object(Object.fromEntries((field.fields ?? []).map(member => [member.name!, validator(member)]))).strict();
  else if (field.format && Object.hasOwn(FORMATS, field.format)) schema = FORMATS[field.format];
  else if (field.format === "uuid") schema = z.string().uuid();
  else if (field.format === "date") schema = z.iso.date();
  else schema = z.string().trim().min(field.min ?? 1).max(field.max ?? 500);
  // The workbook marks several fields mandatory *with* a stated default. Applying it here is what
  // makes "mandatory, default Net" mean the workbook's value rather than a 400 on an omitted field.
  if (field.default !== undefined) return schema.default(field.default);
  // A derived field is computed on save, so it is never required on the way in. It stays
  // accepted rather than rejected because a client that echoes back a record it just read
  // would otherwise be refused for sending a value it did not invent.
  return field.optional || field.derived ? schema.optional() : schema;
}

export function parseOperationalInput(resource: string, input: unknown) {
  const definition = Object.hasOwn(operationalResources, resource) ? operationalResources[resource] : undefined;
  if (!definition) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Unknown operational workflow." });
  const schema = z.object(Object.fromEntries(definition.fields.map(field => [field.name!, validator(field)]))).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Check the highlighted fields.", details: parsed.error.issues.map(issue => ({ field: issue.path.join("."), issue: issue.message })) });
  const data = parsed.data;
  if (data.startDate && data.endDate && String(data.endDate) < String(data.startDate)) throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The end date must be on or after the start date." });
  if (resource === "travel" && Number(data.advanceMinor) > Number(data.estimatedCostMinor)) throw new HttpError({ status: 422, code: "INVALID_ADVANCE", message: "The advance cannot exceed the estimated cost." });
  if (resource === "timesheets" && Number(data.minutes) < 1) throw new HttpError({ status: 422, code: "INVALID_DURATION", message: "Enter at least one minute." });
  if (resource === "allocations" && Number(data.allocationPercent) < 1) throw new HttpError({ status: 422, code: "INVALID_ALLOCATION", message: "Allocation must be between 1 and 100 percent." });
  if (resource === "rosters" && ![data.startTime, data.endTime].every(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)))) throw new HttpError({ status: 422, code: "INVALID_TIME", message: "Enter shift times as HH:MM using a 24-hour clock." });
  // FRM-TIM-01: the absent threshold sits below the half-day one, or a day that is short enough
  // to be absent would also qualify as a half day and the two rules would contradict each other.
  if (resource === "shifts" && Number(data.absentBelowMinutes) >= Number(data.halfDayMinutes)) {
    throw new HttpError({
      status: 422, code: "INVALID_THRESHOLD",
      message: "The absent threshold must be below the half-day threshold.",
      details: [{ field: "absentBelowMinutes", issue: `Must be less than the half-day threshold of ${data.halfDayMinutes} minutes.` }],
    });
  }
  // FRM-TIM-02 caps a published roster period at 62 days.
  if (resource === "rosters" && data.startDate && data.endDate) {
    const days = Math.round((Date.parse(`${String(data.endDate)}T00:00:00Z`) - Date.parse(`${String(data.startDate)}T00:00:00Z`)) / 86_400_000) + 1;
    if (days > ROSTER_MAX_PERIOD_DAYS) {
      throw new HttpError({
        status: 422, code: "PERIOD_TOO_LONG",
        message: `A roster covers at most ${ROSTER_MAX_PERIOD_DAYS} days. This one covers ${days}.`,
        details: [{ field: "endDate", issue: `Shorten the period to ${ROSTER_MAX_PERIOD_DAYS} days or fewer.` }],
      });
    }
  }
  // FRM-PAY-06 gives the vendor GSTIN a 15-character format, so a malformed one is refused on
  // the way in rather than stored and flagged on the screen afterwards.
  if (resource === "expenses" && data.vendorGstin !== undefined && !GSTIN_PATTERN.test(String(data.vendorGstin).trim().toUpperCase())) {
    throw new HttpError({
      status: 422, code: "INVALID_GSTIN",
      message: "A vendor GSTIN is 15 characters: state code, PAN, entity number, Z, checksum.",
      details: [{ field: "vendorGstin", issue: "Enter the 15-character GSTIN, or leave it blank." }],
    });
  }
  // FRM-PAY-05's conditional requirements live with the tax projection that reads them.
  if (resource === "taxDeclarations") {
    const issues = declarationIssues(data);
    if (issues.length > 0) {
      throw new HttpError({ status: 422, code: "DECLARATION_INCOMPLETE", message: "Check the highlighted declaration fields.", details: issues });
    }
  }
  if (resource === "settlements") {
    // One list of heads, shared with the proposal desk, so the two can never disagree about
    // which side of the settlement a figure falls on.
    const EARNINGS: readonly string[] = EARNING_HEADS;
    const RECOVERIES: readonly string[] = RECOVERY_HEADS;
    // A head the proposal did not carry contributes nothing; it is not an error.
    const head = (code: string) => Number(data[code] ?? 0);
    const lines = [...EARNINGS, ...RECOVERIES]
      .map(code => ({ code, amount_minor: head(code), direction: RECOVERIES.includes(code) ? "deduction" : "earning" }))
      .filter(line => line.amount_minor !== 0);
    // A waiver reduces what is recovered, so it is recorded as an earning-side
    // offset rather than by quietly editing the recovery it forgives.
    const waiver = head("recoveryWaiverMinor");
    if (waiver > 0) lines.push({ code: "recoveryWaiverMinor", amount_minor: waiver, direction: "earning" });
    data.lines = lines;
    const earnings = EARNINGS.reduce((total, code) => total + head(code), 0) + waiver;
    const recoveries = RECOVERIES.reduce((total, code) => total + head(code), 0);
    data.netPayableMinor = earnings - recoveries;
    // RL-341: a negative net is a legitimate outcome of a settlement and must be
    // handled, not blocked - an employee can owe more than they are due. It is
    // flagged as a recovery so it is routed for collection instead of payment.
    data.settlementOutcome = Number(data.netPayableMinor) < 0 ? "recovery_pending" : "payable";
    data.recoverableMinor = Number(data.netPayableMinor) < 0 ? -Number(data.netPayableMinor) : 0;
    const reasonIssues = settlementReasonIssues(data);
    if (reasonIssues.length > 0) {
      throw new HttpError({
        status: 422,
        code: "WAIVER_REASON_REQUIRED",
        message: "A waived or unexplained recovery needs a reason on the record.",
        details: reasonIssues,
      });
    }
    // FRM-PAY-08 "Approval and remarks": minimum 10 characters.
    if (String(data.notes ?? "").trim().length < SETTLEMENT_REMARKS_MIN_LENGTH) {
      throw new HttpError({
        status: 422,
        code: "REMARKS_REQUIRED",
        message: `Settlement remarks must be at least ${SETTLEMENT_REMARKS_MIN_LENGTH} characters.`,
        details: [{ field: "notes", issue: "Say what was settled and on whose authority." }],
      });
    }
  }
  return data;
}

/**
 * SCR-058. An approver may pass less than was claimed, never more. Kept pure so the
 * rule is testable without a database and reads the same wherever it is applied.
 */
export function assertPassedAmount(claimedMinor: number, passedMinor: unknown): number {
  if (typeof passedMinor !== "number") {
    throw new HttpError({
      status: 400, code: "BAD_REQUEST",
      message: "The amount passed must be a whole number of minor units.",
      details: [{ field: "approvedAmountMinor", issue: "Enter the amount as a number; a missing value is not a zero." }],
    });
  }
  const passed = passedMinor;
  if (!Number.isInteger(passed) || passed < 0) {
    throw new HttpError({
      status: 400, code: "BAD_REQUEST",
      message: "The amount passed must be a whole number of minor units.",
      details: [{ field: "approvedAmountMinor", issue: "Enter a whole, non-negative amount." }],
    });
  }
  if (passed > claimedMinor) {
    throw new HttpError({
      status: 422, code: "PASSED_EXCEEDS_CLAIMED",
      message: `The amount passed cannot exceed the amount claimed. Claimed ${claimedMinor}, passed ${passed}.`,
      details: [{ field: "approvedAmountMinor", issue: "An approver may reduce a claim, not increase it." }],
    });
  }
  return passed;
}

export const transitionInput = z.object({
  // FRM-PPL-06 asks two different questions: the condition an asset is issued in, and the
  // condition it comes back in. They are separate vocabularies and separate transitions.
  condition: z.enum(picklistValues("PL_ASSET_RETURN_CONDITION")).optional(),
  conditionAtIssue: z.enum(picklistValues("PL_ASSET_CONDITION")).optional(),
  acknowledgedByEmployee: z.boolean().optional(),
  expectedReturn: z.iso.date().optional(),
  recoveryAmountMinor: z.number().int().min(0).max(100000000).optional(),
  returnRemarks: z.string().trim().min(1).max(500).optional(),
  returnedOn: z.iso.date().optional(),
  reason: z.string().trim().min(3).max(1000),
  employeeId: z.string().uuid().optional(),
  ownerEmployeeId: z.string().uuid().optional(),
  acknowledgementReference: z.string().trim().min(3).max(160).optional(),
  paymentReference: z.string().trim().min(3).max(120).optional(),
}).strict();

export function transitionDefinition(resource: string, action: string) {
  const definition = operationalResources[resource];
  const transition = definition && Object.hasOwn(definition.transitions, action) ? definition.transitions[action] : undefined;
  if (!transition) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "This action is not available." });
  return transition;
}
