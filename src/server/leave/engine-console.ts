import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { splitMovement } from "./ledger-register";
import { approvalStepLabel } from "./request-register";

/**
 * Read models behind the Leave Management console: the rule pack in force, the
 * approval pipeline, the comp-off expiry clock, early returns and the band /
 * leave-type rule matrix. Every number here is read from a stored row — no
 * accrual, proration or expiry arithmetic is invented in this module.
 */

/** Guard before any `::float` cast, so free text in a jsonb attribute never aborts the query. */
const NUMERIC = `~ '^-?[0-9]+(\\.[0-9]+)?$'`;

/** Guard before any `::date` cast on a stored attribute string. */
const ISO_DATE = `~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`;

const EMPLOYEE_NAME = `case when emp.id is null then null
         else trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')) end`;

function humanise(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

// ---------------------------------------------------------------------------
// 1. Rule pack in force
// ---------------------------------------------------------------------------

export type LeaveEngineStatus = {
  rulePackCode: string | null;
  rulePackVersion: string | null;
  effectiveFrom: string | null;
  rules: string[];
};

/**
 * Renders the pack's stored settings as reviewable lines (unit-tested). A pack
 * that stores an explicit `rules` array is rendered from that array; otherwise
 * each stored scalar setting becomes one line. Nothing here is prose written by
 * this module — only the stored keys and values, with the key humanised.
 */
export function deriveRulePackRules(attributes: Record<string, unknown> | null | undefined): string[] {
  if (!attributes || typeof attributes !== "object") return [];
  const stored = (attributes as Record<string, unknown>).rules;
  if (Array.isArray(stored)) {
    return stored
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          for (const key of ["label", "name", "title", "description", "text", "rule"]) {
            const value = (entry as Record<string, unknown>)[key];
            if (typeof value === "string" && value.trim() !== "") return value.trim();
          }
          return JSON.stringify(entry);
        }
        return entry === null || entry === undefined ? "" : String(entry);
      })
      .filter((entry) => entry !== "");
  }
  // The identifying fields are surfaced on their own, and `demo_point` is seed
  // bookkeeping rather than a rule, so neither is repeated as a rule line.
  const skip = new Set(["code", "name", "version", "rules", "demo_point"]);
  return Object.entries(attributes)
    .filter(([key, value]) => !skip.has(key) && value !== null && value !== undefined && typeof value !== "object")
    .map(([key, value]) => `${humanise(key)}: ${String(value)}`);
}

/**
 * The rule pack version assigned to this tenant, with the effective date the
 * assignment carries. Rule pack versions are not themselves tenant-scoped, so
 * the tenant boundary is the assignment — never read a version without it.
 */
export async function getLeaveEngineStatus(access: Access): Promise<LeaveEngineStatus> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select v.attributes->>'code' as rule_pack_code,
          coalesce(v.attributes->>'version', v.version::text) as rule_pack_version,
          asg.attributes->>'effective_from' as effective_from,
          v.attributes as pack_attributes
        from rule_pack_assignments asg
        join rule_pack_versions v on v.id = asg.rule_pack_version_id
        where asg.tenant_id = $1
          and coalesce(asg.record_status, '') = 'active'
          and coalesce(v.record_status, '') = 'active'
        order by coalesce(asg.attributes->>'effective_from', '') desc, asg.created_at desc
        limit 1`,
      [access.tenantId],
    ),
  ]);
  const found = (
    rows as Array<{
      rule_pack_code: string | null;
      rule_pack_version: string | null;
      effective_from: string | null;
      pack_attributes: Record<string, unknown> | null;
    }>
  )[0];
  if (!found) return { rulePackCode: null, rulePackVersion: null, effectiveFrom: null, rules: [] };
  return {
    rulePackCode: found.rule_pack_code,
    rulePackVersion: found.rule_pack_version,
    effectiveFrom: found.effective_from,
    rules: deriveRulePackRules(found.pack_attributes),
  };
}

// ---------------------------------------------------------------------------
// 2. Approval pipeline
// ---------------------------------------------------------------------------

export type ApprovalPipelineStage = {
  stage: "pending_supervisor" | "pending_hod" | "pending_hr";
  label: string;
  count: number;
};

/** The chain every leave request walks, in order. */
export const PIPELINE_STAGES = ["pending_supervisor", "pending_hod", "pending_hr"] as const;

/**
 * Fills the full chain from the counted statuses (unit-tested). A stage with
 * nothing waiting on it still appears, at zero, so the console never loses a
 * step just because the queue happens to be empty.
 */
export function buildPipeline(counts: Array<{ status: string; total: number }>): {
  stages: ApprovalPipelineStage[];
  totalPending: number;
} {
  const byStatus = new Map(counts.map((row) => [(row.status ?? "").trim().toLowerCase(), Number(row.total) || 0]));
  const stages = PIPELINE_STAGES.map((stage) => ({
    stage,
    label: approvalStepLabel(stage),
    count: byStatus.get(stage) ?? 0,
  }));
  return { stages, totalPending: stages.reduce((sum, stage) => sum + stage.count, 0) };
}

/** Live leave requests waiting at each step of the approval chain. */
export async function getApprovalPipeline(
  access: Access,
): Promise<{ stages: ApprovalPipelineStage[]; totalPending: number }> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select lower(coalesce(r.status, '')) as status, count(*)::int as total
        from leave_requests r
        where r.tenant_id = $1 and lower(coalesce(r.status, '')) = any($2::text[])
        group by 1`,
      [access.tenantId, [...PIPELINE_STAGES]],
    ),
  ]);
  return buildPipeline(rows as Array<{ status: string; total: number }>);
}

// ---------------------------------------------------------------------------
// 3. Comp-off expiry clock
// ---------------------------------------------------------------------------

export type CompOffClockEntry = {
  id: string;
  creditId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  earnedOn: string | null;
  expiresOn: string | null;
  daysRemaining: number;
  status: "open" | "consumed" | "lapsed";
  daysToExpiry: number | null;
};

/**
 * Pure status mapping for one comp-off grant (unit-tested). A grant the source
 * already settled — consumed or lapsed — keeps that stored verdict; otherwise a
 * stored expiry that has already passed reads as lapsed. An expiry falling on
 * today has not passed yet, so the grant is still open.
 */
export function deriveCompOffStatus(
  storedStatus: string | null | undefined,
  expiresOn: string | null | undefined,
  today = new Date().toISOString().slice(0, 10),
): "open" | "consumed" | "lapsed" {
  const normalized = (storedStatus ?? "").trim().toLowerCase();
  if (normalized === "consumed") return "consumed";
  if (normalized === "lapsed") return "lapsed";
  const expiry = (expiresOn ?? "").slice(0, 10);
  if (expiry !== "" && expiry < today) return "lapsed";
  return "open";
}

type CompOffQueryRow = Omit<CompOffClockEntry, "status"> & { storedStatus: string | null };

/** Comp-off grants with the days left on each, soonest expiry first. */
export async function listCompOffClock(access: Access): Promise<CompOffClockEntry[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select g.id,
          g.attributes->>'credit_id' as "creditId",
          emp.employee_code as "employeeCode",
          ${EMPLOYEE_NAME} as "employeeName",
          g.attributes->>'earned_on' as "earnedOn",
          g.attributes->>'expires_on' as "expiresOn",
          case when coalesce(g.attributes->>'days_remaining', '') ${NUMERIC}
               then (g.attributes->>'days_remaining')::float else 0 end as "daysRemaining",
          g.attributes->>'status' as "storedStatus",
          case when coalesce(g.attributes->>'expires_on', '') ${ISO_DATE}
               then ((g.attributes->>'expires_on')::date - current_date) end as "daysToExpiry"
        from comp_off_grants g
        left join employees emp on emp.tenant_id = g.tenant_id and emp.id = g.employee_id
        where g.tenant_id = $1
        order by coalesce(nullif(g.attributes->>'expires_on', ''), '9999-12-31') asc,
          coalesce(g.attributes->>'credit_id', '') asc, g.created_at asc
        limit 200`,
      [access.tenantId],
    ),
  ]);
  return (rows as CompOffQueryRow[]).map(({ storedStatus, ...row }) => ({
    ...row,
    daysRemaining: Number(row.daysRemaining) || 0,
    daysToExpiry: row.daysToExpiry === null ? null : Number(row.daysToExpiry),
    status: deriveCompOffStatus(storedStatus, row.expiresOn),
  }));
}

// ---------------------------------------------------------------------------
// 4. Early returns
// ---------------------------------------------------------------------------

export type EarlyReturnEntry = {
  id: string;
  employeeCode: string | null;
  employeeName: string | null;
  leaveType: string;
  startsOn: string | null;
  endsOn: string | null;
  requestedDays: number;
  actualReturnDate: string;
  recreditedDays: number | null;
};

/**
 * Requests closed early, with the days actually put back. The re-credit is read
 * from the ledger credit booked against the request — it is never recomputed
 * from the dates, because only the ledger knows what was really returned. A
 * request with no such credit reports null rather than a guess.
 */
export async function listEarlyReturns(access: Access): Promise<EarlyReturnEntry[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select r.id,
          emp.employee_code as "employeeCode",
          ${EMPLOYEE_NAME} as "employeeName",
          coalesce(r.leave_type, '') as "leaveType",
          r.starts_on::text as "startsOn",
          r.ends_on::text as "endsOn",
          coalesce(r.requested_days, 0)::float as "requestedDays",
          r.actual_return_date::text as "actualReturnDate",
          (select sum(case when coalesce(l.attributes->>'days', '') ${NUMERIC}
                           then abs((l.attributes->>'days')::float) else 0 end)
             from leave_ledger_entries l
             where l.tenant_id = r.tenant_id and l.leave_request_id = r.id
               and lower(coalesce(l.attributes->>'transaction_type', l.attributes->>'kind', '')) = 'credit'
          ) as "recreditedDays"
        from leave_requests r
        left join employees emp on emp.tenant_id = r.tenant_id and emp.id = r.employee_id
        where r.tenant_id = $1 and r.actual_return_date is not null
        order by r.actual_return_date desc, r.created_at desc
        limit 200`,
      [access.tenantId],
    ),
  ]);
  return (rows as EarlyReturnEntry[]).map((row) => ({
    ...row,
    requestedDays: Number(row.requestedDays) || 0,
    recreditedDays: row.recreditedDays === null ? null : Number(row.recreditedDays),
  }));
}

// ---------------------------------------------------------------------------
// 5. Band and leave-type rule matrix
// ---------------------------------------------------------------------------

export type BandRule = {
  policyCode: string;
  leaveBand: string | null;
  leaveType: string;
  annualDays: number | null;
  accrualFrequency: string | null;
  creditDate: string | null;
};

export type LeaveTypeRule = {
  code: string;
  name: string;
  carryForward: string | null;
  expiryRule: string | null;
  yearEndAction: string | null;
  maxPerMonth: number | null;
  cannotCombineWith: string[];
};

/**
 * The leave-type catalogue carries one narrative note row whose `code` holds a
 * whole sentence and whose `name` is empty. It is documentation, not a leave
 * type, so it is dropped here rather than rendered as a rule (unit-tested).
 */
export function isCatalogLeaveType(code: string | null | undefined, name: string | null | undefined): boolean {
  const trimmedCode = (code ?? "").trim();
  const trimmedName = (name ?? "").trim();
  return trimmedCode !== "" && trimmedCode.length <= 12 && trimmedName !== "";
}

/** Splits the stored exclusion list into codes (unit-tested); empty when absent. */
export function splitCannotCombineWith(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

type LeaveTypeQueryRow = Omit<LeaveTypeRule, "name" | "cannotCombineWith"> & {
  name: string | null;
  cannotCombineWith: string | null;
};

/** The accrual rules per band and the leave-type rules they credit against. */
export async function getBandRulesMatrix(
  access: Access,
): Promise<{ bandRules: BandRule[]; leaveTypeRules: LeaveTypeRule[] }> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [bandRows, typeRows] = await tenantTx(access, [
    sqlClient.query(
      `select coalesce(a.attributes->>'policy_code', left(a.id::text, 8)) as "policyCode",
          a.attributes->>'leave_band' as "leaveBand",
          coalesce(lt.attributes->>'code', '') as "leaveType",
          case when coalesce(a.attributes->>'annual_days', '') ${NUMERIC}
               then (a.attributes->>'annual_days')::float end as "annualDays",
          a.attributes->>'accrual_frequency' as "accrualFrequency",
          a.attributes->>'credit_date' as "creditDate"
        from accrual_rules a
        left join leave_types lt on lt.tenant_id = a.tenant_id and lt.id = a.leave_type_id
        where a.tenant_id = $1
        order by coalesce(a.attributes->>'policy_code', left(a.id::text, 8)) asc
        limit 200`,
      [access.tenantId],
    ),
    sqlClient.query(
      `select coalesce(lt.attributes->>'code', '') as code,
          lt.attributes->>'name' as name,
          lt.attributes->>'carry_forward' as "carryForward",
          lt.attributes->>'expiry_rule' as "expiryRule",
          lt.attributes->>'year_end_action' as "yearEndAction",
          case when coalesce(lt.attributes->>'max_per_month', '') ${NUMERIC}
               then (lt.attributes->>'max_per_month')::float end as "maxPerMonth",
          lt.attributes->>'cannot_combine_with' as "cannotCombineWith"
        from leave_types lt
        where lt.tenant_id = $1
        order by coalesce(lt.attributes->>'code', '') asc
        limit 200`,
      [access.tenantId],
    ),
  ]);
  const leaveTypeRules = (typeRows as LeaveTypeQueryRow[])
    .filter((row) => isCatalogLeaveType(row.code, row.name))
    .map((row) => ({
      ...row,
      name: (row.name ?? "").trim(),
      maxPerMonth: row.maxPerMonth === null ? null : Number(row.maxPerMonth),
      cannotCombineWith: splitCannotCombineWith(row.cannotCombineWith),
    }));
  return { bandRules: bandRows as BandRule[], leaveTypeRules };
}

// ---------------------------------------------------------------------------
// 6. Balance cards
// ---------------------------------------------------------------------------

export type LeaveBalanceCard = {
  leaveType: string;
  leaveTypeName: string | null;
  allocated: number;
  availed: number;
  available: number;
  accrualNote: string | null;
};

export type AccrualNoteSource = {
  accrualFrequency: string | null;
  daysPerPeriod: number | null;
  leaveBand: string | null;
};

/**
 * Renders the stored accrual settings for a leave type as a note (unit-tested).
 * A leave type carries one rule per band, and nothing stored on the employee
 * says which band they sit in, so no band is picked on their behalf: where every
 * band accrues identically the note states the single rule, and where the bands
 * differ each distinct rule is named with the bands it belongs to. Null when no
 * rule for the leave type stores either setting.
 */
export function renderAccrualNote(rules: AccrualNoteSource[]): string | null {
  const byCore = new Map<string, string[]>();
  for (const rule of rules) {
    const frequency = (rule.accrualFrequency ?? "").trim();
    const days = rule.daysPerPeriod;
    if (frequency === "" && (days === null || days === undefined)) continue;
    const core =
      days === null || days === undefined ? frequency : `${frequency === "" ? "Accrual" : frequency}, ${days} days per period`;
    const bands = byCore.get(core) ?? [];
    const band = (rule.leaveBand ?? "").trim();
    if (band !== "" && !bands.includes(band)) bands.push(band);
    byCore.set(core, bands);
  }
  if (byCore.size === 0) return null;
  if (byCore.size === 1) return [...byCore.keys()][0];
  return [...byCore.entries()]
    .map(([core, bands]) => (bands.length === 0 ? core : `${core} (${bands.join(", ")})`))
    .join("; ");
}

/**
 * Aggregates one employee's ledger into a card per leave type (unit-tested).
 * Movements arrive in two shapes — the imported ledger's `transaction_type`
 * (Credit/Debit/Reversal) and the application's own `kind` (credit/debit) — and
 * both are normalised by `splitMovement`, which scores anything it does not
 * recognise as zero rather than guessing which column it belongs in.
 */
export function foldBalanceCards(
  movements: Array<{ leaveType: string; leaveTypeName: string | null; transactionType: string | null; days: number }>,
): Array<Omit<LeaveBalanceCard, "accrualNote">> {
  const cards = new Map<string, Omit<LeaveBalanceCard, "accrualNote">>();
  for (const movement of movements) {
    const key = movement.leaveType;
    const card = cards.get(key) ?? {
      leaveType: key,
      leaveTypeName: movement.leaveTypeName,
      allocated: 0,
      availed: 0,
      available: 0,
    };
    const { credit, debit } = splitMovement(movement.transactionType, movement.days);
    card.allocated = Math.round((card.allocated + credit) * 100) / 100;
    card.availed = Math.round((card.availed + debit) * 100) / 100;
    card.available = Math.round((card.allocated - card.availed) * 100) / 100;
    if (card.leaveTypeName === null) card.leaveTypeName = movement.leaveTypeName;
    cards.set(key, card);
  }
  return [...cards.values()].sort((left, right) => left.leaveType.localeCompare(right.leaveType));
}

/**
 * One employee's leave balances, derived only from their own ledger movements.
 * Nothing is accrued, prorated or expired here: the card is the arithmetic sum
 * of what the ledger already records.
 */
export async function listBalanceCards(access: Access, employeeId: string): Promise<LeaveBalanceCard[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const trimmed = (employeeId ?? "").trim();
  if (trimmed === "") {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An employee is required." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select coalesce(lt.attributes->>'code', l.attributes->>'leave_type', '') as "leaveType",
          lt.attributes->>'name' as "leaveTypeName",
          coalesce(l.attributes->>'transaction_type', l.attributes->>'kind') as "transactionType",
          case when coalesce(l.attributes->>'days', '') ${NUMERIC}
               then (l.attributes->>'days')::float else 0 end as days
        from leave_ledger_entries l
        left join leave_types lt on lt.tenant_id = l.tenant_id and lt.id = l.leave_type_id
        where l.tenant_id = $1 and l.employee_id = $2::uuid
        order by coalesce(l.attributes->>'effective_date', ''), l.created_at
        limit 500`,
      [access.tenantId, trimmed],
    ),
  ]);
  const cards = foldBalanceCards(
    (rows as Array<{ leaveType: string; leaveTypeName: string | null; transactionType: string | null; days: number }>).map(
      (row) => ({ ...row, days: Number(row.days) || 0 }),
    ),
  );
  if (cards.length === 0) return [];

  // The accrual note is decoration on the card, never part of its arithmetic,
  // so a failure to read the rules leaves the balances intact and the note null.
  let rulesByType = new Map<string, AccrualNoteSource[]>();
  try {
    const [ruleRows] = await tenantTx(access, [
      sqlClient.query(
        `select coalesce(lt.attributes->>'code', '') as "leaveType",
            a.attributes->>'accrual_frequency' as "accrualFrequency",
            case when coalesce(a.attributes->>'days_per_period', '') ${NUMERIC}
                 then (a.attributes->>'days_per_period')::float end as "daysPerPeriod",
            a.attributes->>'leave_band' as "leaveBand"
          from accrual_rules a
          join leave_types lt on lt.tenant_id = a.tenant_id and lt.id = a.leave_type_id
          where a.tenant_id = $1
          order by coalesce(a.attributes->>'policy_code', '') asc
          limit 200`,
        [access.tenantId],
      ),
    ]);
    rulesByType = new Map();
    for (const row of ruleRows as Array<AccrualNoteSource & { leaveType: string }>) {
      const bucket = rulesByType.get(row.leaveType) ?? [];
      bucket.push({
        accrualFrequency: row.accrualFrequency,
        daysPerPeriod: row.daysPerPeriod === null ? null : Number(row.daysPerPeriod),
        leaveBand: row.leaveBand,
      });
      rulesByType.set(row.leaveType, bucket);
    }
  } catch {
    rulesByType = new Map();
  }

  return cards.map((card) => ({
    ...card,
    accrualNote: renderAccrualNote(rulesByType.get(card.leaveType) ?? []),
  }));
}
