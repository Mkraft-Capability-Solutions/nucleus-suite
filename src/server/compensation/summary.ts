import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Compensation & benefits read model and benefit selection lock (CompensationView).
 *
 * - Pay: the employee's monthly basic (`employees.basic_salary_minor`) and the
 *   annual CTC when the latest salary assignment records one (`ctc_minor` /
 *   `annual_ctc_minor`). No CTC is derived from basic: absent means absent.
 * - Band: the `compensation_bands` row of the employee's current grade
 *   (employments -> employee_assignments.grade_id). Bands hold monthly basic in
 *   minor units, the unit `proposeCompensation` validates against, so the
 *   compa-ratio is basic / band midpoint and the position is (basic - min) / (max - min).
 * - Market benchmark: no table holds survey data, so it is always reported
 *   unavailable.
 * - Benefits: the tenant's `benefit_plans` x `benefit_options`, with the
 *   employee's active `benefit_enrollments`.
 */

export type BandView = {
  gradeCode: string | null;
  minMinor: number;
  maxMinor: number;
  midMinor: number;
  currency: string;
};

export type BenefitOptionView = {
  optionId: string;
  optionCode: string;
  optionName: string;
  planCode: string;
  planName: string;
  coverageMinor: number | null;
  employeeShareMinor: number | null;
  enrolled: boolean;
};

export type CompensationSummary = {
  employee: { id: string; code: string; name: string; currency: string };
  basicMonthlyMinor: number | null;
  annualCtcMinor: number | null;
  band: BandView | null;
  compaRatio: number | null;
  bandPositionPct: number | null;
  marketBenchmark: null;
  benefits: BenefitOptionView[];
};

function minorOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/** Pure: compa-ratio and in-band position, both null when either side is missing or the band is degenerate. */
export function bandMetrics(basicMinor: number | null, band: { minMinor: number; maxMinor: number } | null): { midMinor: number | null; compaRatio: number | null; positionPct: number | null } {
  if (!band || band.maxMinor <= band.minMinor) return { midMinor: null, compaRatio: null, positionPct: null };
  const midMinor = Math.round((band.minMinor + band.maxMinor) / 2);
  if (basicMinor === null || basicMinor <= 0) return { midMinor, compaRatio: null, positionPct: null };
  const compaRatio = Math.round((basicMinor / midMinor) * 100) / 100;
  const raw = ((basicMinor - band.minMinor) / (band.maxMinor - band.minMinor)) * 100;
  return { midMinor, compaRatio, positionPct: Math.round(raw * 10) / 10 };
}

function selfEmployeeId(access: Access): string {
  const id = access.context.employeeId ?? null;
  if (!id) {
    throw new HttpError({ status: 403, code: "EMPLOYEE_LINK_REQUIRED", message: "Link this account to its employee profile to view its compensation." });
  }
  return id;
}

export async function getCompensationSummary(access: Access): Promise<CompensationSummary> {
  // Own compensation: the caller sees only the employee their membership is linked to.
  const employeeId = selfEmployeeId(access);
  const [employeeRows, assignmentRows, bandRows, optionRows] = await tenantTx(access, [
    sqlClient`select id, employee_code, first_name, last_name, basic_salary_minor, currency from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
    sqlClient`select attributes from employee_salary_assignments where tenant_id = ${access.tenantId} and employee_id = ${employeeId} order by created_at desc limit 1`,
    sqlClient`
      select g.attributes->>'code' as grade_code, b.attributes->>'min_minor' as min_minor, b.attributes->>'max_minor' as max_minor, b.attributes->>'currency' as currency
      from employments em
      join employee_assignments ea on ea.tenant_id = em.tenant_id and ea.employment_id = em.id
      join grades g on g.tenant_id = ea.tenant_id and g.id = ea.grade_id
      join compensation_bands b on b.tenant_id = g.tenant_id and b.grade_id = g.id
      where em.tenant_id = ${access.tenantId} and em.employee_id = ${employeeId}
      order by em.created_at desc, ea.created_at desc, b.created_at desc
      limit 1
    `,
    sqlClient`
      select o.id as option_id, o.attributes->>'code' as option_code, o.attributes->>'name' as option_name,
             o.attributes->>'employee_share_minor' as employee_share_minor,
             p.attributes->>'code' as plan_code, p.attributes->>'name' as plan_name, p.attributes->>'coverage_minor' as coverage_minor,
             exists (
               select 1 from benefit_enrollments en
               where en.tenant_id = o.tenant_id and en.benefit_option_id = o.id and en.employee_id = ${employeeId}
                 and en.attributes->>'status' = 'active'
             ) as enrolled
      from benefit_options o
      join benefit_plans p on p.tenant_id = o.tenant_id and p.id = o.benefit_plan_id
      where o.tenant_id = ${access.tenantId}
      order by p.attributes->>'name', o.attributes->>'name'
      limit 100
    `,
  ]);
  const employee = (employeeRows as Array<{ id: string; employee_code: string; first_name: string | null; last_name: string | null; basic_salary_minor: unknown; currency: string | null }>)[0];
  if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The linked employee record was not found." });
  const currency = employee.currency ?? "INR";
  const assignment = ((assignmentRows as Array<{ attributes: Record<string, unknown> | null }>)[0]?.attributes) ?? {};
  const basicMonthlyMinor = minorOrNull(employee.basic_salary_minor);
  const annualCtcMinor = minorOrNull(assignment.annual_ctc_minor ?? assignment.ctc_minor);
  const bandRow = (bandRows as Array<{ grade_code: string | null; min_minor: string | null; max_minor: string | null; currency: string | null }>)[0];
  const minMinor = minorOrNull(bandRow?.min_minor);
  const maxMinor = minorOrNull(bandRow?.max_minor);
  const bandBase = bandRow && minMinor !== null && maxMinor !== null ? { minMinor, maxMinor } : null;
  const metrics = bandMetrics(basicMonthlyMinor, bandBase);
  const band: BandView | null = bandBase && metrics.midMinor !== null
    ? { gradeCode: bandRow?.grade_code ?? null, minMinor: bandBase.minMinor, maxMinor: bandBase.maxMinor, midMinor: metrics.midMinor, currency: bandRow?.currency ?? currency }
    : null;
  const name = [employee.first_name, employee.last_name].filter((part) => typeof part === "string" && part.trim().length > 0).join(" ");
  return {
    employee: { id: employee.id, code: employee.employee_code, name: name || employee.employee_code, currency },
    basicMonthlyMinor,
    annualCtcMinor,
    band,
    compaRatio: band ? metrics.compaRatio : null,
    bandPositionPct: band ? metrics.positionPct : null,
    marketBenchmark: null,
    benefits: (optionRows as Array<Record<string, unknown>>).map((row) => ({
      optionId: String(row.option_id),
      optionCode: String(row.option_code ?? ""),
      optionName: String(row.option_name ?? row.option_code ?? ""),
      planCode: String(row.plan_code ?? ""),
      planName: String(row.plan_name ?? row.plan_code ?? ""),
      coverageMinor: minorOrNull(row.coverage_minor),
      employeeShareMinor: minorOrNull(row.employee_share_minor),
      enrolled: row.enrolled === true,
    })),
  };
}

export const lockBenefitSelectionSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1, "Select at least one benefit.").max(50),
});

/**
 * Lock the caller's flex-benefit selections: one active enrollment per newly
 * selected option, all in one transaction with one audit event each. An option
 * already enrolled is skipped (reported in `alreadyEnrolled`), never duplicated.
 */
export async function lockBenefitSelection(access: Access, input: z.infer<typeof lockBenefitSelectionSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const employeeId = selfEmployeeId(access);
  const optionIds = [...new Set(input.optionIds)];
  const [optionRows, enrolledRows] = await tenantTx(access, [
    sqlClient`select id, benefit_plan_id from benefit_options where tenant_id = ${access.tenantId} and id = any(${optionIds}::uuid[])`,
    sqlClient`
      select benefit_option_id from benefit_enrollments
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and benefit_option_id = any(${optionIds}::uuid[])
        and attributes->>'status' = 'active'
    `,
  ]);
  const options = optionRows as Array<{ id: string; benefit_plan_id: string }>;
  if (options.length !== optionIds.length) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "One or more selected benefit options do not exist.", details: [{ field: "optionIds", issue: "Unknown benefit option." }] });
  }
  const already = new Set((enrolledRows as Array<{ benefit_option_id: string }>).map((row) => row.benefit_option_id));
  const toEnroll = options.filter((option) => !already.has(option.id));
  const created = toEnroll.map((option) => ({ id: crypto.randomUUID(), option }));
  if (created.length > 0) {
    await tenantTx(access, created.flatMap(({ id, option }) => [
      sqlClient`
        insert into benefit_enrollments (id, tenant_id, benefit_option_id, benefit_plan_id, employee_id, attributes)
        values (${id}, ${access.tenantId}, ${option.id}, ${option.benefit_plan_id}, ${employeeId},
          ${JSON.stringify({ status: "active", locked_at: new Date().toISOString(), locked_by: access.context.actorUserId })}::jsonb)
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'benefit.selection_lock', 'benefit_enrollment', ${id}, 'Flex benefit selection locked', ${uuidOrNull(requestId)}::uuid)
      `,
    ]));
  }
  return { employeeId, enrollmentIds: created.map((entry) => entry.id), alreadyEnrolled: [...already] };
}
