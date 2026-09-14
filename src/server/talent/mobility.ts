import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { tenantTx, type Access } from "@/server/platform/access";
import { operationalScope } from "@/server/workflows/operational-access";

/**
 * Career & internal mobility — read model and action gating.
 *
 * Mobility requests are plain `hrms_operation_records` rows served and mutated
 * by the generic operational endpoints (`/api/v1/operations/mobility`). This
 * module adds only what those endpoints cannot: the employee's CURRENT role,
 * department and location beside the requested target, the reporting fact that
 * decides team scope, and an explicit, per-action statement of what the caller
 * may do and — when they may not — why. Every write still goes through the
 * generic endpoints; nothing here mutates.
 */

export const MOBILITY_RESOURCE = "mobility";
export const MOBILITY_PERMISSION = operationalResources[MOBILITY_RESOURCE].permission;
export const MOBILITY_TRANSITIONS = operationalResources[MOBILITY_RESOURCE].transitions;
export const MOBILITY_INITIAL_STATUS = operationalResources[MOBILITY_RESOURCE].initial;
export const MOBILITY_EDITABLE_STATUSES = operationalResources[MOBILITY_RESOURCE].editable;

/** Every status a mobility record can hold, derived from the catalog. */
export const MOBILITY_STATUSES: readonly string[] = [
  MOBILITY_INITIAL_STATUS,
  ...Object.values(MOBILITY_TRANSITIONS).map((transition) => transition.to),
].filter((status, index, all) => all.indexOf(status) === index);

/**
 * What `complete` actually does, taken from the generic service rather than
 * from intent. `mutateOperationalRecord` flips the record status, writes one
 * `hrms_operation_events` row and one `audit_events` row. Its per-resource
 * side effects cover assets, settlements and offboarding cases only — there is
 * no branch for `mobility`, so no employee, employment or assignment row is
 * touched. docs/HRMS_WORKFLOW_DELIVERY.md records the same intent: employment
 * assignment changes remain explicit in People Core.
 */
export const COMPLETION_EFFECT = {
  does:
    "Completing marks the approved request as done: the record moves to completed, and the action is written to this request's history and to the tenant audit trail.",
  doesNot:
    "Completing does NOT move the employee. The employee master, the assignment record, the reporting line, the department, the location and the pay structure are all left exactly as they were. The effective-dated assignment change is a separate, explicit act in People Core.",
} as const;

/**
 * There is no internal job posting in this system. `job_postings` carries a
 * channel list, an open/close window and a status; it has no internal-versus-
 * external flag, and no column or table joins a mobility request to a
 * requisition or a posting. The navigation label says "(IJP)"; the data does
 * not support one, and this screen says so rather than implying otherwise.
 */
export const IJP_POSTING_LINK = {
  available: false,
  summary: "Internal job postings do not exist in this system.",
  detail:
    "A mobility request is a direct, named request for one target role. It is not an application against a posting: job postings carry no internal-or-external flag, and nothing links a mobility request to a requisition or a posting. Internal applications, internal shortlists and IJP reporting cannot be produced from this data.",
} as const;

export type MobilityScope = "all" | "team" | "self";
export type MobilityVerb = "read" | "write" | "approve";

/**
 * The non-throwing twin of `operationalScope`, used to explain an action
 * instead of refusing a request. The precedence is deliberately identical:
 * write never widens to team, approve never narrows to self.
 */
export function mobilityScope(permissions: readonly string[], verb: MobilityVerb): MobilityScope | null {
  if (permissions.includes(`${MOBILITY_PERMISSION}.${verb}`)) return "all";
  if (verb !== "write" && permissions.includes(`${MOBILITY_PERMISSION}.team.${verb}`)) return "team";
  if (verb !== "approve" && permissions.includes(`${MOBILITY_PERMISSION}.self.${verb}`)) return "self";
  return null;
}

export type MobilityViewer = {
  employeeId: string | null;
  membershipId: string | null;
  permissions: readonly string[];
};

export type MobilityAction = "submit" | "approve" | "return" | "reject" | "cancel" | "complete";

export const MOBILITY_ACTIONS: ReadonlyArray<{ action: MobilityAction; label: string; effect: string }> = [
  { action: "submit", label: "Submit", effect: "Sends the request to an approver. It cannot be edited again unless it is returned." },
  { action: "approve", label: "Approve", effect: `Records the approval decision. ${COMPLETION_EFFECT.doesNot}` },
  { action: "return", label: "Return for changes", effect: "Sends the request back to the requester and makes it editable again." },
  { action: "reject", label: "Reject", effect: "Closes the request with no move. This is final for this request." },
  { action: "cancel", label: "Cancel", effect: "Withdraws the request. This is final for this request." },
  { action: "complete", label: "Complete", effect: `${COMPLETION_EFFECT.does} ${COMPLETION_EFFECT.doesNot}` },
];

export type MobilityRequestState = {
  status: string;
  employeeId: string | null;
  createdByMembershipId: string | null;
  /** True when the subject employee reports to the viewer (decides team scope). */
  reportsToViewer: boolean;
};

export type MobilityActionGate = {
  action: MobilityAction;
  label: string;
  approval: boolean;
  allowed: boolean;
  /** Why the action is refused, or what it does when it is available. */
  reason: string;
};

function humanStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function humanStates(states: readonly string[]): string {
  const labels = states.map(humanStatus);
  if (labels.length <= 1) return labels[0] ?? "no state";
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/**
 * The exact refusal the server would produce, stated before the click.
 *
 * The separation-of-duties clause mirrors `mutateOperationalRecord`, which
 * refuses any `approval` transition where the actor is the record's creator or
 * its subject employee. The server answers that with a generic 409, so the
 * specific reason is worth saying here.
 */
export function mobilityActionGates(record: MobilityRequestState, viewer: MobilityViewer): MobilityActionGate[] {
  const isSelf = viewer.employeeId !== null && viewer.employeeId === record.employeeId;
  const raisedByViewer = viewer.membershipId !== null && viewer.membershipId === record.createdByMembershipId;

  return MOBILITY_ACTIONS.map(({ action, label, effect }) => {
    const transition = MOBILITY_TRANSITIONS[action];
    const approval = transition?.approval === true;
    const scope = mobilityScope(viewer.permissions, approval ? "approve" : "write");
    let reason = "";

    if (!transition) {
      reason = `${label} is not part of the mobility workflow.`;
    } else if (!transition.from.includes(record.status)) {
      reason = `${label} is only possible from ${humanStates(transition.from)}. This request is ${humanStatus(record.status)}.`;
    } else if (scope === null) {
      reason = approval
        ? `Deciding a mobility request needs ${MOBILITY_PERMISSION}.approve or ${MOBILITY_PERMISSION}.team.approve.`
        : `Changing a mobility request needs ${MOBILITY_PERMISSION}.write or ${MOBILITY_PERMISSION}.self.write.`;
    } else if (scope !== "all" && viewer.employeeId === null) {
      reason = "Link this account to its employee profile before using self-service or team workflows.";
    } else if (scope === "self" && !isSelf) {
      reason = "Your access covers only your own mobility requests, and this request belongs to another employee.";
    } else if (scope === "team" && !record.reportsToViewer) {
      reason = "Your access covers only the requests of people who report to you, and this employee does not.";
    } else if (approval && isSelf) {
      reason = "Nobody may decide their own mobility request. Another approver has to act on it.";
    } else if (approval && raisedByViewer) {
      reason = "You raised this request, so you cannot also decide it. Another approver has to act on it.";
    }

    return { action, label, approval, allowed: reason === "", reason: reason === "" ? effect : reason };
  });
}

export type MobilityStageState = "done" | "current" | "pending" | "halted";

export type MobilityTimelineStage = {
  id: string;
  label: string;
  detail: string;
  state: MobilityStageState;
};

const TIMELINE_STAGES: ReadonlyArray<{ id: string; label: string; detail: string; statuses: readonly string[] }> = [
  { id: "draft", label: "Draft", detail: "Raised and still editable by the requester.", statuses: ["draft", "returned"] },
  { id: "submitted", label: "Submitted", detail: "With an approver; the requester can no longer edit it.", statuses: ["submitted"] },
  { id: "decision", label: "Decision", detail: "Approved, returned for changes, or rejected.", statuses: ["approved", "returned", "rejected"] },
  { id: "completed", label: "Completed", detail: "The approved request is closed out. The employee record is unchanged.", statuses: ["completed"] },
];

const HALTING_STATUSES: readonly string[] = ["rejected", "cancelled"];

/**
 * The request's own state timeline. `seen` is the list of statuses the history
 * trail already recorded, so a returned request still shows that it reached
 * submission once.
 */
export function mobilityTimeline(status: string, seen: readonly string[] = []): MobilityTimelineStage[] {
  const currentIndex = TIMELINE_STAGES.findIndex((stage) => stage.statuses.includes(status));
  const halted = HALTING_STATUSES.includes(status);
  return TIMELINE_STAGES.map((stage, index) => {
    const wasSeen = stage.statuses.some((candidate) => seen.includes(candidate));
    let state: MobilityStageState;
    if (index === currentIndex) state = "current";
    else if (index < currentIndex || wasSeen) state = "done";
    else if (halted || currentIndex === -1) state = "halted";
    else state = "pending";
    return { id: stage.id, label: stage.label, detail: stage.detail, state };
  });
}

/** One row exactly as the register query returns it. */
export type MobilityRegisterRaw = {
  id: string;
  version: number | string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date | null;
  employee_id: string | null;
  created_by_membership_id: string | null;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  designation: string | null;
  department: string | null;
  location: string | null;
  employee_status: string | null;
  reports_to_viewer: boolean | null;
  data: Record<string, unknown> | null;
};

export type MobilityRegisterRow = {
  id: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  employeeStatus: string | null;
  currentRole: string | null;
  currentDepartment: string | null;
  currentLocation: string | null;
  targetRole: string;
  targetDepartment: string;
  targetLocation: string;
  effectiveDate: string;
  motivation: string;
  developmentPlan: string;
  createdByMembershipId: string | null;
  isSelf: boolean;
  raisedByViewer: boolean;
  reportsToViewer: boolean;
  /** True when the employee master already shows the requested role. */
  alreadyInTargetRole: boolean;
  actions: MobilityActionGate[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function timestamp(value: string | Date | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function sameLabel(left: string | null, right: string): boolean {
  return left !== null && right !== "" && left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** Pure projection of one register row, including its action gating. */
export function projectMobilityRow(raw: MobilityRegisterRaw, viewer: MobilityViewer): MobilityRegisterRow {
  const data = raw.data ?? {};
  const name = `${text(raw.first_name)} ${text(raw.last_name)}`.trim();
  const state: MobilityRequestState = {
    status: raw.status,
    employeeId: raw.employee_id,
    createdByMembershipId: raw.created_by_membership_id,
    reportsToViewer: raw.reports_to_viewer === true,
  };
  const currentRole = nullableText(raw.designation);
  const targetRole = text(data.targetRole);
  return {
    id: raw.id,
    version: Number(raw.version),
    status: raw.status,
    createdAt: timestamp(raw.created_at) ?? "",
    updatedAt: timestamp(raw.updated_at),
    employeeId: raw.employee_id,
    employeeCode: nullableText(raw.employee_code),
    employeeName: name.length > 0 ? name : null,
    employeeStatus: nullableText(raw.employee_status),
    currentRole,
    currentDepartment: nullableText(raw.department),
    currentLocation: nullableText(raw.location),
    targetRole,
    targetDepartment: text(data.targetDepartment),
    targetLocation: text(data.targetLocation),
    effectiveDate: text(data.effectiveDate),
    motivation: text(data.motivation),
    developmentPlan: text(data.developmentPlan),
    createdByMembershipId: raw.created_by_membership_id,
    isSelf: viewer.employeeId !== null && viewer.employeeId === raw.employee_id,
    raisedByViewer: viewer.membershipId !== null && viewer.membershipId === raw.created_by_membership_id,
    reportsToViewer: state.reportsToViewer,
    alreadyInTargetRole: sameLabel(currentRole, targetRole),
    actions: mobilityActionGates(state, viewer),
  };
}

export const mobilityRegisterQuery = z
  .object({
    status: z.string().trim().min(1).max(40).optional(),
    employeeId: z.string().uuid().optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(10_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type MobilityRegisterQuery = z.infer<typeof mobilityRegisterQuery>;

export type MobilityRegister = {
  items: MobilityRegisterRow[];
  nextCursor: string | null;
  scope: { read: MobilityScope; write: MobilityScope | null; approve: MobilityScope | null };
};

/**
 * The mobility work queue for the caller's scope.
 *
 * Scope is `operationalScope(access, "talent.mobility", "read")` and the row
 * predicate is the same one the generic list uses, so this register can never
 * show a record the generic endpoint would hide.
 */
export async function listMobilityRegister(access: Access, query: MobilityRegisterQuery): Promise<MobilityRegister> {
  const scope = operationalScope(access, MOBILITY_PERMISSION, "read");
  const viewerEmployeeId = access.context.employeeId ?? null;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const status = query.status ?? null;
  const employeeId = query.employeeId ?? null;
  const search = `%${(query.search ?? "").slice(0, 100)}%`;

  const [rows] = await tenantTx(access, [
    sqlClient`
      select r.id, r.version, r.status, r.created_at, r.updated_at, r.employee_id, r.created_by_membership_id, r.data,
        e.employee_code, e.first_name, e.last_name, e.designation, e.department, e.location, e.status as employee_status,
        coalesce(${viewerEmployeeId}::uuid is not null and e.manager_employee_id = ${viewerEmployeeId}::uuid, false) as reports_to_viewer
      from hrms_operation_records r
      left join employees e on e.tenant_id = r.tenant_id and e.id = r.employee_id
      where r.tenant_id = ${access.tenantId} and r.resource = ${MOBILITY_RESOURCE}
        and (${scope} = 'all' or r.employee_id = ${viewerEmployeeId}::uuid
          or (${scope} = 'team' and r.employee_id in (
            select id from employees where tenant_id = ${access.tenantId} and manager_employee_id = ${viewerEmployeeId}::uuid)))
        and (${employeeId}::uuid is null or r.employee_id = ${employeeId}::uuid)
        and (${status}::text is null or r.status = ${status})
        and r.data::text ilike ${search}
      order by r.created_at desc, r.id desc
      limit ${pageSize + 1} offset ${(page - 1) * pageSize}
    `,
  ]);

  const viewer: MobilityViewer = {
    employeeId: viewerEmployeeId,
    membershipId: access.context.membershipId ?? null,
    permissions: access.context.permissions,
  };
  const projected = (rows as MobilityRegisterRaw[]).map((row) => projectMobilityRow(row, viewer));
  return {
    items: projected.slice(0, pageSize),
    nextCursor: projected.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 })).toString("base64url") : null,
    scope: {
      read: scope,
      write: mobilityScope(access.context.permissions, "write"),
      approve: mobilityScope(access.context.permissions, "approve"),
    },
  };
}
