import "server-only";

import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * W-01's chain — Supervisor, then HOD, then HR Head — and who may act at each
 * step.
 *
 * The sequence, the actor and timestamp per level and the segregation of duties
 * were already genuine. What was missing was authority: `decideLeave` gated on
 * one flat `leave.approve` and then acted on whatever row happened to be
 * pending, so an HR Head who posted first succeeded and was recorded in the
 * supervisor's row. Holding the permission says a user may approve leave; it
 * does not say they are this applicant's supervisor.
 *
 * Each level is resolved from the employee record, never from a role name alone:
 *
 *  - Supervisor — `employees.manager_employee_id` on the applicant.
 *  - HOD        — the employee holding `departments.hod_position_id` for the
 *                 applicant's department.
 *  - HR Head    — the `hr_head` role, which is tenant-wide by nature.
 */

export const APPROVAL_LEVELS = ["supervisor", "hod", "hr_head"] as const;
export type LeaveApprovalLevel = (typeof APPROVAL_LEVELS)[number];

/** The role that holds the HR Head step of W-01 and the single step of W-02. */
export const HR_HEAD_ROLE = "hr_head";

export type ResolvedApprover = {
  level: LeaveApprovalLevel;
  label: string;
  /** The employee who may act at this level, where the level names a person. */
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  /** Where the answer came from, named so an unresolved level can be fixed. */
  source: string;
  /** Set when the level cannot be resolved; carries what has to be recorded. */
  missing: string | null;
};

const LEVEL_LABEL: Record<LeaveApprovalLevel, string> = {
  supervisor: "Supervisor",
  hod: "HOD",
  hr_head: "HR Head",
};

type ApproverRow = {
  supervisor_id: string | null;
  supervisor_code: string | null;
  supervisor_name: string | null;
  department: string | null;
  hod_id: string | null;
  hod_code: string | null;
  hod_name: string | null;
};

const NAME = (alias: string) => `nullif(trim(coalesce(${alias}.first_name, '') || ' ' || coalesce(${alias}.last_name, '')), '')`;

const APPROVER_SELECT = `select
    sup.id as supervisor_id, sup.employee_code as supervisor_code, ${NAME("sup")} as supervisor_name,
    emp.department as department,
    hod.id as hod_id, hod.employee_code as hod_code, ${NAME("hod")} as hod_name
  from employees emp
  left join employees sup on sup.tenant_id = emp.tenant_id and sup.id = emp.manager_employee_id
  left join departments dep on dep.tenant_id = emp.tenant_id and dep.attributes->>'code' = emp.department
  left join employee_assignments asg on asg.tenant_id = emp.tenant_id and asg.position_id = dep.hod_position_id
    and coalesce(asg.record_status, '') not in ('superseded', 'archived', 'inactive')
  left join employments eml on eml.tenant_id = asg.tenant_id and eml.id = asg.employment_id
  left join employees hod on hod.tenant_id = eml.tenant_id and hod.id = eml.employee_id and hod.status = 'active'
  where emp.tenant_id = $1 and emp.id = $2::uuid
  order by coalesce(asg.attributes->>'effectiveFrom', '') desc, asg.created_at desc
  limit 1`;

/** The three approvers for one applicant, each with its provenance. */
export async function resolveLeaveApprovers(
  access: Access,
  applicantEmployeeId: string,
): Promise<Record<LeaveApprovalLevel, ResolvedApprover>> {
  const [rows] = await tenantTx(access, [sqlClient.query(APPROVER_SELECT, [access.tenantId, applicantEmployeeId])]);
  const row = (rows as ApproverRow[])[0] ?? null;
  return {
    supervisor: {
      level: "supervisor",
      label: LEVEL_LABEL.supervisor,
      employeeId: row?.supervisor_id ?? null,
      employeeCode: row?.supervisor_code ?? null,
      employeeName: row?.supervisor_name ?? null,
      source: "employees.manager_employee_id",
      missing: row?.supervisor_id ? null : "The applicant has no reporting manager recorded on their employee record.",
    },
    hod: {
      level: "hod",
      label: LEVEL_LABEL.hod,
      employeeId: row?.hod_id ?? null,
      employeeCode: row?.hod_code ?? null,
      employeeName: row?.hod_name ?? null,
      source: "departments.hod_position_id",
      missing: row?.hod_id
        ? null
        : `No active employee holds the HOD position for department ${row?.department ?? "(not recorded)"}. Set departments.hod_position_id and assign someone to it.`,
    },
    hr_head: {
      level: "hr_head",
      label: LEVEL_LABEL.hr_head,
      employeeId: null,
      employeeCode: null,
      employeeName: null,
      source: `membership role "${HR_HEAD_ROLE}"`,
      missing: null,
    },
  };
}

/**
 * Refuses a decision taken at a level the caller does not hold.
 *
 * The permission check has already run; this is the second half of it. An HR
 * Head who tries to post the supervisor's decision is stopped here, which is
 * what T-09 asks for — and it is also what stops the HR Head being recorded as
 * the supervisor in `leave_approvals`.
 */
export async function assertMayDecideAtLevel(
  access: Access,
  level: LeaveApprovalLevel,
  applicantEmployeeId: string,
): Promise<ResolvedApprover> {
  const approvers = await resolveLeaveApprovers(access, applicantEmployeeId);
  const approver = approvers[level];

  if (level === "hr_head") {
    if (!access.context.roles.includes(HR_HEAD_ROLE)) {
      throw new HttpError({
        status: 403,
        code: "FORBIDDEN",
        message: `This step is the HR Head's. The current user does not hold the "${HR_HEAD_ROLE}" role.`,
      });
    }
    return approver;
  }

  if (approver.missing !== null) {
    throw new HttpError({
      status: 422,
      code: "APPROVAL_CHAIN_INCOMPLETE",
      message: `The ${approver.label} for this applicant cannot be resolved. ${approver.missing}`,
      details: [{ field: approver.source, issue: approver.missing }],
    });
  }

  const actorEmployeeId = access.context.employeeId ?? null;
  if (actorEmployeeId === null || actorEmployeeId !== approver.employeeId) {
    throw new HttpError({
      status: 403,
      code: "FORBIDDEN",
      message: `This step is the ${approver.label}'s${approver.employeeCode ? ` (${approver.employeeCode})` : ""}. It cannot be taken by another approver, and the chain must be walked in order.`,
    });
  }
  return approver;
}
