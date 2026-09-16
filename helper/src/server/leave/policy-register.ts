import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** Audit action for a leave type configuration save, named once for the routes and tests. */
export const POLICY_CONFIGURE_ACTION = "leave.policy_configure";

export type LeavePolicyState = "draft" | "simulated" | "effective" | "superseded";

/** Pure lifecycle mapping for one accrual rule (unit-tested). */
export function deriveLeavePolicyState(recordStatus: string | null | undefined): LeavePolicyState {
  const normalized = (recordStatus ?? "").trim().toLowerCase();
  if (normalized === "draft") return "draft";
  if (normalized === "simulated") return "simulated";
  if (["superseded", "archived", "inactive"].includes(normalized)) return "superseded";
  return "effective";
}

/** The transitions the register allows, and the statuses each may start from. */
export const POLICY_TRANSITIONS = {
  simulate: { to: "simulated", from: ["draft", "active", "effective"] },
  activate: { to: "active", from: ["draft", "simulated"] },
  supersede: { to: "superseded", from: ["active", "effective", "simulated", "draft"] },
} as const;

export type LeavePolicyTransition = keyof typeof POLICY_TRANSITIONS;

export type LeavePolicyRow = {
  id: string;
  policy_code: string;
  policy_name: string | null;
  leave_type: string;
  leave_type_name: string | null;
  leave_band: string | null;
  annual_days: number | null;
  accrual_frequency: string | null;
  days_per_period: number | null;
  eligibility_wait_months: number | null;
  credit_on_completion: number | null;
  credit_date: string | null;
  effective_from: string;
  record_status: string;
  /** FRM-LVE-01 configuration, read back so an existing rule opens populated. */
  configuration: LeaveTypeConfiguration | null;
  status: LeavePolicyState;
};

/** The workbook's Leave Type Configuration as it is stored and read back. */
export type LeaveTypeConfiguration = {
  leave_type: string | null;
  name: string | null;
  unit: string | null;
  is_paid: boolean | null;
  gender_restriction: string | null;
  applicable_classes: string[] | null;
  applicable_bands: string[] | null;
  accrual_method: string | null;
  annual_days: number | null;
  accrual_frequency: string | null;
  accrual_day: string | null;
  proration_rule: string | null;
  eligibility_wait_days: number | null;
  earned_against_attendance: boolean | null;
  carry_forward: boolean | null;
  max_carry_forward: number | null;
  carry_forward_expiry_months: number | null;
  max_accumulation: number | null;
  allow_negative: boolean | null;
  negative_limit: number | null;
  is_encashable: boolean | null;
  encashment_cap: number | null;
  min_days: number | null;
  max_days: number | null;
  max_instances_month: number | null;
  allow_half_day: boolean | null;
  advance_notice_days: number | null;
  backdate_days: number | null;
  reason_mandatory: boolean | null;
  document_after_days: number | null;
  sandwich_rule: string | null;
  excluded_with: string[] | null;
  prerequisite_type: string | null;
  approval_chain_id: string | null;
  effective_from: string | null;
  status: string | null;
};

type PolicyQueryRow = Omit<LeavePolicyRow, "status">;

const NUMERIC = `~ '^-?[0-9]+(\\.[0-9]+)?$'`;

const POLICY_SELECT = `select a.id,
    coalesce(a.attributes->>'policy_code', left(a.id::text, 8)) as policy_code,
    pol.attributes->>'name' as policy_name,
    coalesce(lt.attributes->>'code', '') as leave_type,
    lt.attributes->>'name' as leave_type_name,
    a.attributes->>'leave_band' as leave_band,
    case when coalesce(a.attributes->>'annual_days', '') ${NUMERIC}
         then (a.attributes->>'annual_days')::float end as annual_days,
    a.attributes->>'accrual_frequency' as accrual_frequency,
    case when coalesce(a.attributes->>'days_per_period', '') ${NUMERIC}
         then (a.attributes->>'days_per_period')::float end as days_per_period,
    case when coalesce(a.attributes->>'eligibility_wait_months', '') ${NUMERIC}
         then (a.attributes->>'eligibility_wait_months')::float end as eligibility_wait_months,
    case when coalesce(a.attributes->>'credit_on_completion', '') ${NUMERIC}
         then (a.attributes->>'credit_on_completion')::float end as credit_on_completion,
    a.attributes->>'credit_date' as credit_date,
    coalesce(a.attributes->>'effective_from', a.attributes->>'credit_date', '') as effective_from,
    coalesce(a.record_status, '') as record_status,
    -- The configuration lives across the two rows the workbook describes: the leave
    -- type carries what is true of the type, the accrual rule what is true of this
    -- version of its accrual. They are merged here so the form reads one object.
    (coalesce(lt.attributes->'configuration', '{}'::jsonb) || coalesce(a.attributes->'configuration', '{}'::jsonb))
      as configuration
  from accrual_rules a
  left join leave_types lt on lt.tenant_id = a.tenant_id and lt.id = a.leave_type_id
  left join leave_policies pol on pol.tenant_id = a.tenant_id and pol.id = a.leave_policy_id`;

/** Leave policy configuration queue: one row per accrual rule version. */
export async function listLeavePolicies(access: Access, search: string): Promise<LeavePolicyRow[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${POLICY_SELECT}
       where a.tenant_id = $1
         and ($2 = '%%' or (coalesce(a.attributes->>'policy_code', '') || ' ' || coalesce(lt.attributes->>'code', '')
              || ' ' || coalesce(a.attributes->>'leave_band', '')) ilike $2)
       order by coalesce(a.attributes->>'policy_code', left(a.id::text, 8)) asc limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return (rows as PolicyQueryRow[]).map((row) => ({ ...row, status: deriveLeavePolicyState(row.record_status) }));
}

/** One rule with the leave-type rules it inherits and its audit trail. */
export async function getLeavePolicyRecord(access: Access, id: string) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${POLICY_SELECT} where a.tenant_id = $1 and a.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const found = (rows as PolicyQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const record: LeavePolicyRow = { ...found, status: deriveLeavePolicyState(found.record_status) };

  // The leave type's own rules (carry-forward, expiry, combination limits) are
  // what this accrual rule credits against, so the detail shows them together.
  let leaveTypeRules: Record<string, unknown> | null = null;
  try {
    const [typeRows] = await tenantTx(access, [
      sqlClient`
        select lt.attributes->>'carry_forward' as carry_forward,
               lt.attributes->>'expiry_rule' as expiry_rule,
               lt.attributes->>'year_end_action' as year_end_action,
               lt.attributes->>'max_per_month' as max_per_month,
               lt.attributes->>'cannot_combine_with' as cannot_combine_with,
               lt.attributes->>'applies_to_bands' as applies_to_bands
        from accrual_rules a
        join leave_types lt on lt.tenant_id = a.tenant_id and lt.id = a.leave_type_id
        where a.tenant_id = ${access.tenantId} and a.id = ${id} limit 1
      `,
    ]);
    leaveTypeRules = (typeRows as Array<Record<string, unknown>>)[0] ?? null;
  } catch {
    leaveTypeRules = null;
  }

  // How many employees currently sit on this rule's band, so a change is not
  // applied blind. Counted from assignments, never estimated.
  let coverage: number | null = null;
  try {
    const [coverageRows] = await tenantTx(access, [
      sqlClient`
        select count(*)::int as total from leave_policy_assignments lpa
        join accrual_rules a on a.tenant_id = lpa.tenant_id and a.leave_policy_id = lpa.leave_policy_id
        where lpa.tenant_id = ${access.tenantId} and a.id = ${id}
      `,
    ]);
    coverage = (coverageRows as Array<{ total: number }>)[0]?.total ?? 0;
  } catch {
    coverage = null;
  }

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'leave_policy' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return { record, leaveTypeRules, coverage, auditTrail };
}

export const transitionLeavePolicySchema = z.object({
  action: z.enum(["simulate", "activate", "supersede"]),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Moves one accrual rule through its lifecycle. This changes only the rule's
 * governance state — accrual arithmetic is untouched and stays server-owned.
 */
export async function transitionLeavePolicy(
  access: Access,
  id: string,
  input: z.infer<typeof transitionLeavePolicySchema>,
  requestId: string,
) {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const transition = POLICY_TRANSITIONS[input.action];
  const [rows] = await tenantTx(access, [
    sqlClient`select id, coalesce(record_status, '') as record_status from accrual_rules
      where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const rule = (rows as Array<{ id: string; record_status: string }>)[0];
  if (!rule) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (!(transition.from as readonly string[]).includes(rule.record_status)) {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: `This policy cannot be ${input.action}d from status ${rule.record_status || "unknown"}.`,
    });
  }
  await tenantTx(access, [
    sqlClient`update accrual_rules set record_status = ${transition.to}, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`leave.policy_${input.action}`}, 'leave_policy', ${id}, ${input.reason},
        ${JSON.stringify({ record_status: rule.record_status })}::jsonb,
        ${JSON.stringify({ record_status: transition.to })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: rule.record_status, to: transition.to };
}


/**
 * FRM-LVE-01 Leave Type Configuration.
 *
 * Defaults are the workbook's own stated defaults; every field the workbook leaves
 * blank is required from the caller rather than filled in here. Conditional
 * requirements ("Y if carry forward", "Y if allowed", "Y if encashable") are
 * enforced as refinements so a half-configured type cannot be saved.
 */
export const leaveTypeConfigurationSchema = z
  .object({
    // Type
    leaveType: z.string().trim().min(1).max(10),
    name: z.string().trim().min(1).max(60),
    unit: z.enum(picklistValues("PL_LEAVE_UNIT")).default("days"),
    isPaid: z.boolean().default(true),
    genderRestriction: z.enum(picklistValues("PL_GENDER")).optional(),
    applicableClasses: z.array(z.enum(picklistValues("PL_WORKER_CLASS"))).min(1),
    applicableBands: z.array(z.string().trim().min(1).max(60)).min(1),
    // Accrual
    accrualMethod: z.enum(picklistValues("PL_ACCRUAL_METHOD")).default("monthly_accrual"),
    annualDays: z.number().min(0).max(365),
    accrualFrequency: z.enum(picklistValues("PL_FREQUENCY")).default("monthly"),
    accrualDay: z.enum(picklistValues("PL_ACCRUAL_DAY")).default("period_end"),
    prorationRule: z.string().trim().min(1).max(60),
    eligibilityWaitDays: z.number().int().min(0).max(365).default(0),
    earnedAgainstAttendance: z.boolean().default(false),
    // Balance
    carryForward: z.boolean().default(true),
    maxCarryForward: z.number().min(0).max(365).optional(),
    carryForwardExpiryMonths: z.number().int().min(0).max(120).optional(),
    maxAccumulation: z.number().min(0).max(999).optional(),
    allowNegative: z.boolean().default(false),
    negativeLimit: z.number().min(0).max(365).optional(),
    isEncashable: z.boolean().default(false),
    encashmentCap: z.number().min(0).max(365).optional(),
    // Application
    minDays: z.number().min(0).max(365).default(0.5),
    maxDays: z.number().min(0).max(365).optional(),
    maxInstancesMonth: z.number().int().min(1).max(31).optional(),
    allowHalfDay: z.boolean().default(true),
    advanceNoticeDays: z.number().int().min(0).max(90).default(1),
    backdateDays: z.number().int().min(0).max(90).default(7),
    reasonMandatory: z.boolean().default(false),
    documentAfterDays: z.number().int().min(0).max(365).optional(),
    // Rules
    sandwichRule: z.enum(picklistValues("PL_SANDWICH_RULE")).default("exclude_holidays_and_rest_days"),
    excludedWith: z.array(z.string().trim().min(1).max(10)).optional(),
    prerequisiteType: z.string().trim().min(1).max(10).optional(),
    approvalChainId: z.string().trim().min(1).max(60),
    // Control
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(picklistValues("PL_ACTIVE_STATUS")).default("active"),
  })
  .refine((input) => !input.carryForward || input.maxCarryForward !== undefined, {
    path: ["maxCarryForward"],
    message: "A carry-forward type must state its maximum carry forward.",
  })
  .refine((input) => !input.allowNegative || input.negativeLimit !== undefined, {
    path: ["negativeLimit"],
    message: "A type that allows a negative balance must state the limit.",
  })
  .refine((input) => !input.isEncashable || input.encashmentCap !== undefined, {
    path: ["encashmentCap"],
    message: "An encashable type must state its annual encashment cap.",
  })
  .refine((input) => input.maxDays === undefined || input.maxDays >= input.minDays, {
    path: ["maxDays"],
    message: "The maximum days per request cannot be below the minimum.",
  })
  .refine((input) => input.maxAccumulation === undefined || input.maxAccumulation >= input.annualDays, {
    path: ["maxAccumulation"],
    message: "The maximum accumulation cannot be below the annual entitlement.",
  })
  .refine((input) => input.prerequisiteType === undefined || input.prerequisiteType !== input.leaveType, {
    path: ["prerequisiteType"],
    message: "A leave type cannot require itself as a prerequisite.",
  })
  .refine((input) => !(input.excludedWith ?? []).includes(input.leaveType), {
    path: ["excludedWith"],
    message: "A leave type cannot exclude itself.",
  });

export type LeaveTypeConfigurationInput = z.infer<typeof leaveTypeConfigurationSchema>;

/** The keys that describe the leave TYPE rather than this version of its accrual. */
function typeConfiguration(input: LeaveTypeConfigurationInput) {
  return {
    leave_type: input.leaveType,
    name: input.name,
    unit: input.unit,
    is_paid: input.isPaid,
    gender_restriction: input.genderRestriction ?? null,
    applicable_classes: input.applicableClasses,
    applicable_bands: input.applicableBands,
    carry_forward: input.carryForward,
    max_carry_forward: input.maxCarryForward ?? null,
    carry_forward_expiry_months: input.carryForwardExpiryMonths ?? null,
    max_accumulation: input.maxAccumulation ?? null,
    allow_negative: input.allowNegative,
    negative_limit: input.negativeLimit ?? null,
    is_encashable: input.isEncashable,
    encashment_cap: input.encashmentCap ?? null,
    min_days: input.minDays,
    max_days: input.maxDays ?? null,
    max_instances_month: input.maxInstancesMonth ?? null,
    allow_half_day: input.allowHalfDay,
    advance_notice_days: input.advanceNoticeDays,
    backdate_days: input.backdateDays,
    reason_mandatory: input.reasonMandatory,
    document_after_days: input.documentAfterDays ?? null,
    sandwich_rule: input.sandwichRule,
    excluded_with: input.excludedWith ?? [],
    prerequisite_type: input.prerequisiteType ?? null,
    approval_chain_id: input.approvalChainId,
  };
}

/** The keys that describe this accrual rule version. */
function accrualConfiguration(input: LeaveTypeConfigurationInput) {
  return {
    accrual_method: input.accrualMethod,
    annual_days: input.annualDays,
    accrual_frequency: input.accrualFrequency,
    accrual_day: input.accrualDay,
    proration_rule: input.prorationRule,
    eligibility_wait_days: input.eligibilityWaitDays,
    earned_against_attendance: input.earnedAgainstAttendance,
    effective_from: input.effectiveFrom,
    status: input.status,
  };
}

/** The leave type row for a code, created on first configuration. */
async function ensureConfiguredLeaveType(access: Access, input: LeaveTypeConfigurationInput): Promise<string> {
  const configuration = typeConfiguration(input);
  const [rows] = await tenantTx(access, [
    sqlClient`select id from leave_types where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.leaveType} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  const attributes = { code: input.leaveType, name: input.name, unit: input.unit, configuration };
  if (existing) {
    await tenantTx(access, [
      sqlClient`update leave_types set attributes = attributes || ${JSON.stringify(attributes)}::jsonb, updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${existing.id}`,
    ]);
    return existing.id;
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into leave_types (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify(attributes)}::jsonb)`,
  ]);
  return id;
}

/**
 * The leave policy an accrual rule hangs off. Nucleus groups accrual rules under a
 * policy; the workbook has no field for it, so the grouping simply carries the
 * leave type's own code and name rather than a made-up policy name.
 */
async function ensureLeavePolicyFor(access: Access, input: LeaveTypeConfigurationInput): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from leave_policies where tenant_id = ${access.tenantId} and attributes->>'code' = ${input.leaveType} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into leave_policies (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code: input.leaveType, name: input.name })}::jsonb)`,
  ]);
  return id;
}

/** Creates one configured leave type and the accrual rule version that carries it. */
export async function createLeaveTypeConfiguration(
  access: Access,
  input: LeaveTypeConfigurationInput,
  requestId: string,
) {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const leaveTypeId = await ensureConfiguredLeaveType(access, input);
  const leavePolicyId = await ensureLeavePolicyFor(access, input);
  const id = crypto.randomUUID();
  const attributes = {
    policy_code: input.leaveType,
    annual_days: input.annualDays,
    accrual_frequency: input.accrualFrequency,
    effective_from: input.effectiveFrom,
    configuration: accrualConfiguration(input),
  };
  await tenantTx(access, [
    sqlClient`
      insert into accrual_rules (id, tenant_id, leave_policy_id, leave_type_id, record_status, attributes)
      values (${id}, ${access.tenantId}, ${leavePolicyId}, ${leaveTypeId}, 'draft', ${JSON.stringify(attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${POLICY_CONFIGURE_ACTION}, 'leave_policy', ${id}, ${`Leave type ${input.leaveType} configured`},
        ${JSON.stringify({ ...typeConfiguration(input), ...accrualConfiguration(input) })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, leaveType: input.leaveType, status: "draft" as const };
}

/**
 * Re-configures one accrual rule and the leave type behind it. A superseded rule is
 * a closed version and is never edited in place — supersede it and configure a new
 * one so in-flight requests keep the version they started on.
 */
export async function updateLeaveTypeConfiguration(
  access: Access,
  id: string,
  input: LeaveTypeConfigurationInput,
  requestId: string,
) {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, coalesce(record_status, '') as record_status, attributes from accrual_rules
      where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const rule = (rows as Array<{ id: string; record_status: string; attributes: Record<string, unknown> }>)[0];
  if (!rule) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (deriveLeavePolicyState(rule.record_status) === "superseded") {
    throw new HttpError({
      status: 409,
      code: "WORKFLOW_CONFLICT",
      message: "A superseded rule is a closed version. Configure a new rule instead of editing it.",
    });
  }
  const leaveTypeId = await ensureConfiguredLeaveType(access, input);
  const attributes = {
    policy_code: input.leaveType,
    annual_days: input.annualDays,
    accrual_frequency: input.accrualFrequency,
    effective_from: input.effectiveFrom,
    configuration: accrualConfiguration(input),
  };
  await tenantTx(access, [
    sqlClient`update accrual_rules set leave_type_id = ${leaveTypeId},
        attributes = attributes || ${JSON.stringify(attributes)}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${POLICY_CONFIGURE_ACTION}, 'leave_policy', ${id}, ${`Leave type ${input.leaveType} reconfigured`},
        ${JSON.stringify(rule.attributes.configuration ?? {})}::jsonb,
        ${JSON.stringify({ ...typeConfiguration(input), ...accrualConfiguration(input) })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, leaveType: input.leaveType, status: rule.record_status };
}
