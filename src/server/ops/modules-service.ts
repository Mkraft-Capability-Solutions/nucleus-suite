import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export interface OperationalModuleConfig {
  screenId: string;
  table: string;
  permission: string;
  auditAction: string;
}

export const OPERATIONAL_MODULES: Record<string, OperationalModuleConfig> = {
  // Registry modules with null endpoints
  document_vault: {
    screenId: "SCR-014",
    table: "documents",
    permission: "employee.read",
    auditAction: "document.vault_create",
  },
  attendance_detail: {
    screenId: "SCR-022",
    table: "attendance_entries",
    permission: "attendance.read",
    auditAction: "attendance.day_override",
  },
  overtime_register: {
    screenId: "SCR-024",
    table: "overtime_entries",
    permission: "attendance.read",
    auditAction: "attendance.overtime_record",
  },
  attendance_exceptions: {
    screenId: "SCR-025",
    table: "attendance_exceptions",
    permission: "attendance.read",
    auditAction: "attendance.exception_record",
  },
  leave_policy_admin: {
    screenId: "SCR-032",
    table: "leave_policies",
    permission: "employee.read",
    auditAction: "leave.policy_configure",
  },
  tax_declarations: {
    screenId: "SCR-054",
    table: "tax_profiles",
    permission: "payroll.read",
    auditAction: "payroll.tax_declare",
  },
  bank_disbursement: {
    screenId: "SCR-055",
    table: "disbursement_batches",
    permission: "payroll.read",
    auditAction: "payroll.disbursement_control",
  },
  rule_pack_manager: {
    screenId: "SCR-070",
    table: "rule_pack_versions",
    permission: "compliance.read",
    auditAction: "compliance.rule_pack_manage",
  },
  golden_case_library: {
    screenId: "SCR-071",
    table: "rule_pack_assignments",
    permission: "compliance.read",
    auditAction: "compliance.golden_case_record",
  },
  gl_mapping: {
    screenId: "SCR-102",
    table: "gl_mappings",
    permission: "payroll.read",
    auditAction: "payroll.gl_mapping_update",
  },
  reconciliation: {
    screenId: "SCR-103",
    table: "reconciliation_items",
    permission: "payroll.read",
    auditAction: "payroll.reconciliation_record",
  },
  clearance_board: {
    screenId: "SCR-061",
    table: "clearance_items",
    permission: "employee.read",
    auditAction: "lifecycle.clearance_record",
  },
  asset_register: {
    screenId: "SCR-064",
    table: "hardware_assets",
    permission: "employee.read",
    auditAction: "assets.record_create",
  },
  letters_register: {
    screenId: "SCR-067",
    table: "hr_letters",
    permission: "employee.read",
    auditAction: "letters.issue_record",
  },
  check_in_out: {
    screenId: "SCR-020",
    table: "attendance_punches",
    permission: "attendance.read",
    auditAction: "attendance.punch_record",
  },
  my_attendance: {
    screenId: "SCR-021",
    table: "attendance_days",
    permission: "attendance.read",
    auditAction: "attendance.day_query",
  },
  full_and_final: {
    screenId: "SCR-056",
    table: "fnf_settlements",
    permission: "payroll.read",
    auditAction: "lifecycle.fnf_settlement_record",
  },

  // Additional workbook-specified domain forms
  ats_pipeline: {
    screenId: "SCR-062",
    table: "applications",
    permission: "employee.read",
    auditAction: "talent.pipeline_advance",
  },
  interview_schedule: {
    screenId: "SCR-063",
    table: "interview_sessions",
    permission: "employee.read",
    auditAction: "talent.interview_schedule",
  },
  contractor_daily_muster: {
    screenId: "SCR-071",
    table: "contract_worker_assignments",
    permission: "attendance.read",
    auditAction: "contractor.muster_record",
  },
  contractor_compliance: {
    screenId: "SCR-072",
    table: "contractor_statutory_evidence",
    permission: "employee.read",
    auditAction: "contractor.compliance_challan",
  },
  disciplinary_enquiry: {
    screenId: "SCR-081",
    table: "compliance_evidence",
    permission: "compliance.read",
    auditAction: "compliance.enquiry_record",
  },
  safety_incident_register: {
    screenId: "SCR-082",
    table: "safety_evaluations",
    permission: "compliance.read",
    auditAction: "compliance.safety_incident",
  },
  social_workplace_feed: {
    screenId: "SCR-084",
    table: "feed_posts",
    permission: "employee.read",
    auditAction: "engagement.feed_post",
  },
  skill_matrix_admin: {
    screenId: "SCR-091",
    table: "job_skill_requirements",
    permission: "employee.read",
    auditAction: "skills.matrix_update",
  },
  tni_survey: {
    screenId: "SCR-092",
    table: "surveys",
    permission: "employee.read",
    auditAction: "learning.tni_survey_submit",
  },
  performance_review_cycle: {
    screenId: "SCR-094",
    table: "review_cycles",
    permission: "employee.read",
    auditAction: "performance.cycle_create",
  },
  shift_master: {
    screenId: "SCR-028",
    table: "attendance_shifts",
    permission: "attendance.read",
    auditAction: "attendance.shift_master",
  },
  roster_schedule: {
    screenId: "SCR-029",
    table: "shift_rosters",
    permission: "attendance.read",
    auditAction: "attendance.roster_schedule",
  },
  compensatory_off: {
    screenId: "SCR-033",
    table: "leave_coff_grants",
    permission: "employee.read",
    auditAction: "leave.coff_claim",
  },
  leave_encashment: {
    screenId: "SCR-034",
    table: "leave_encashments",
    permission: "employee.read",
    auditAction: "leave.encashment_request",
  },
  helpdesk_ticket: {
    screenId: "SCR-043",
    table: "helpdesk_tickets",
    permission: "employee.read",
    auditAction: "support.ticket_create",
  },
  pay_component_master: {
    screenId: "SCR-057",
    table: "pay_components",
    permission: "payroll.read",
    auditAction: "payroll.component_master",
  },
  reimbursement_claim: {
    screenId: "SCR-058",
    table: "reimbursement_claims",
    permission: "payroll.read",
    auditAction: "payroll.reimbursement_claim",
  },
  probation_confirmation: {
    screenId: "SCR-068",
    table: "probation_evaluations",
    permission: "employee.read",
    auditAction: "lifecycle.confirmation_review",
  },
  resignation_exit: {
    screenId: "SCR-069",
    table: "resignation_requests",
    permission: "employee.read",
    auditAction: "lifecycle.resignation_submit",
  },
  salary_advance: {
    screenId: "SCR-081",
    table: "salary_advances",
    permission: "payroll.read",
    auditAction: "payroll.salary_advance",
  },
  candidate_application: {
    screenId: "SCR-092",
    table: "candidates",
    permission: "employee.read",
    auditAction: "talent.candidate_create",
  },
  interview_feedback: {
    screenId: "SCR-093",
    table: "interview_evaluations",
    permission: "employee.read",
    auditAction: "talent.interview_feedback",
  },
  offer_management: {
    screenId: "SCR-094",
    table: "candidate_offers",
    permission: "employee.read",
    auditAction: "talent.offer_release",
  },
  contractor_invoice: {
    screenId: "SCR-096",
    table: "contractor_invoices",
    permission: "compliance.read",
    auditAction: "contractor.invoice_reconciliation",
  },
  location_master: {
    screenId: "SCR-002",
    table: "locations",
    permission: "employee.read",
    auditAction: "platform.location_update",
  },
};

export const createModuleRecordSchema = z.record(z.string(), z.unknown());

export async function listModuleRecords(
  access: Access,
  moduleId: string,
  args: { page: number; pageSize: number }
) {
  const config = OPERATIONAL_MODULES[moduleId];
  if (!config) {
    throw new HttpError({
      status: 404,
      code: "MODULE_NOT_FOUND",
      message: `Operational module '${moduleId}' is not recognized.`,
    });
  }

  enforce(access.context, config.permission, { tenantId: access.tenantId });

  const offset = (args.page - 1) * args.pageSize;

  // Query PostgreSQL for module records
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(distinct entity_id)::int as total
      from audit_events
      where tenant_id = ${access.tenantId}
        and entity_type = ${config.table}
    `,
    sqlClient`
      with ranked as (
        select id, entity_id, after, created_at,
               row_number() over (partition by entity_id order by created_at desc) as rn
        from audit_events
        where tenant_id = ${access.tenantId}
          and entity_type = ${config.table}
      )
      select id, entity_id, after, created_at
      from ranked
      where rn = 1
      order by created_at desc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);

  const total = (countRows as Array<{ total: number }>)[0]?.total ?? 0;
  const items = (rows as Array<{ id: string; entity_id: string; after: Record<string, unknown> | null; created_at: string }>).map((row) => ({
    id: row.entity_id || row.id,
    values: row.after || {},
    createdAt: row.created_at,
  }));

  return { items, total };
}

export async function createModuleRecord(
  access: Access,
  moduleId: string,
  payload: Record<string, unknown>,
  requestId: string
) {
  const config = OPERATIONAL_MODULES[moduleId];
  if (!config) {
    throw new HttpError({
      status: 404,
      code: "MODULE_NOT_FOUND",
      message: `Operational module '${moduleId}' is not recognized.`,
    });
  }

  enforce(access.context, config.permission, { tenantId: access.tenantId });

  const id = crypto.randomUUID();
  const attributes = {
    ...payload,
    moduleId,
    screenId: config.screenId,
    createdAt: new Date().toISOString(),
  };

  await tenantTx(access, [
    sqlClient`
      insert into audit_events (
        tenant_id,
        actor_user_id,
        membership_id,
        action,
        entity_type,
        entity_id,
        reason,
        after,
        request_id
      ) values (
        ${access.tenantId},
        ${access.context.actorUserId},
        ${access.context.membershipId},
        ${config.auditAction},
        ${config.table},
        ${id},
        ${`Form ${config.screenId} submission (${moduleId})`},
        ${JSON.stringify(attributes)}::jsonb,
        ${uuidOrNull(requestId)}::uuid
      )
    `,
  ]);

  return {
    id,
    moduleId,
    screenId: config.screenId,
    attributes,
    createdAt: attributes.createdAt,
  };
}

export async function updateModuleRecord(
  access: Access,
  moduleId: string,
  recordId: string,
  payload: Record<string, unknown>,
  requestId: string
) {
  const config = OPERATIONAL_MODULES[moduleId];
  if (!config) {
    throw new HttpError({
      status: 404,
      code: "MODULE_NOT_FOUND",
      message: `Operational module '${moduleId}' is not recognized.`,
    });
  }

  enforce(access.context, config.permission, { tenantId: access.tenantId });

  // Query prior state
  const priorRows = await tenantTx(access, [
    sqlClient`
      select after
      from audit_events
      where tenant_id = ${access.tenantId}
        and entity_type = ${config.table}
        and entity_id = ${recordId}
      order by created_at desc
      limit 1
    `,
  ]);

  const prior = (priorRows[0] as Array<{ after: Record<string, unknown> | null }>)[0]?.after || {};
  const attributes = {
    ...prior,
    ...payload,
    moduleId,
    screenId: config.screenId,
    updatedAt: new Date().toISOString(),
  };

  await tenantTx(access, [
    sqlClient`
      insert into audit_events (
        tenant_id,
        actor_user_id,
        membership_id,
        action,
        entity_type,
        entity_id,
        reason,
        before,
        after,
        request_id
      ) values (
        ${access.tenantId},
        ${access.context.actorUserId},
        ${access.context.membershipId},
        ${`${config.auditAction}.update`},
        ${config.table},
        ${recordId},
        ${`Form ${config.screenId} update (${moduleId})`},
        ${JSON.stringify(prior)}::jsonb,
        ${JSON.stringify(attributes)}::jsonb,
        ${uuidOrNull(requestId)}::uuid
      )
    `,
  ]);

  return {
    id: recordId,
    moduleId,
    screenId: config.screenId,
    attributes,
    updatedAt: attributes.updatedAt,
  };
}

export async function getModuleRecord(
  access: Access,
  moduleId: string,
  recordId: string
) {
  const config = OPERATIONAL_MODULES[moduleId];
  if (!config) {
    throw new HttpError({
      status: 404,
      code: "MODULE_NOT_FOUND",
      message: `Operational module '${moduleId}' is not recognized.`,
    });
  }

  enforce(access.context, config.permission, { tenantId: access.tenantId });

  const rows = await tenantTx(access, [
    sqlClient`
      select id, entity_id, after, created_at
      from audit_events
      where tenant_id = ${access.tenantId}
        and entity_type = ${config.table}
        and entity_id = ${recordId}
      order by created_at desc
      limit 1
    `,
  ]);

  const row = (rows[0] as Array<{ id: string; entity_id: string; after: Record<string, unknown> | null; created_at: string }>)[0];
  if (!row) {
    throw new HttpError({
      status: 404,
      code: "RECORD_NOT_FOUND",
      message: `Record '${recordId}' in operational module '${moduleId}' not found.`,
    });
  }

  return {
    id: row.entity_id || row.id,
    values: row.after || {},
    createdAt: row.created_at,
  };
}


