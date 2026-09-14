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
      select count(*)::int as total
      from audit_events
      where tenant_id = ${access.tenantId}
        and entity_type = ${config.table}
    `,
    sqlClient`
      select id, entity_id, attributes, after, created_at
      from audit_events
      where tenant_id = ${access.tenantId}
        and entity_type = ${config.table}
      order by created_at desc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);

  const total = (countRows as Array<{ total: number }>)[0]?.total ?? 0;
  const items = (rows as Array<{ id: string; entity_id: string; attributes: unknown; after: Record<string, unknown> | null; created_at: string }>).map((row) => ({
    id: row.entity_id || row.id,
    values: row.after || row.attributes || {},
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
        attributes,
        request_id
      ) values (
        ${access.tenantId},
        ${access.context.actorUserId},
        ${access.context.membershipId},
        ${config.auditAction},
        ${config.table},
        ${id},
        ${`Form ${config.screenId} submission (${moduleId})`},
        ${JSON.stringify(payload)}::jsonb,
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
