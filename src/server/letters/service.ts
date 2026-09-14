import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

type EmployeeData = {
  id: string; first_name: string; last_name: string; employee_code: string;
  designation: string; department: string; location: string;
  joining_date: string; basic_salary_minor: number | null;
  date_of_birth: string | null; probation_end_date: string | null;
};

async function fetchEmployee(access: Access, employeeId: string): Promise<EmployeeData> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, first_name, last_name, employee_code, designation, department, location,
             joining_date::text, basic_salary_minor, date_of_birth::text, probation_end_date::text
      from employees
      where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1
    `,
  ]);
  const emp = (rows as EmployeeData[])[0];
  if (!emp) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Employee not found." });
  return emp;
}

function formatCurrency(minor: number | null): string {
  if (!minor) return "—";
  return `₹${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

// Letter templates
function generateAppointmentLetter(emp: EmployeeData, attrs: Record<string, unknown>): string {
  const ctc = attrs.ctc_minor as number | null;
  return `APPOINTMENT LETTER

Date: ${formatDate(new Date().toISOString().slice(0, 10))}

To,
${emp.first_name} ${emp.last_name}

Dear ${emp.first_name},

We are pleased to appoint you as ${emp.designation} in the ${emp.department} department at our ${emp.location} facility.

Employee Code: ${emp.employee_code}
Date of Joining: ${formatDate(emp.joining_date)}
Basic Salary: ${formatCurrency(emp.basic_salary_minor)} per month
${ctc ? `CTC: ${formatCurrency(ctc)} per annum` : ""}

Your appointment is subject to the following terms and conditions:
1. This appointment is subject to satisfactory completion of the probation period.
2. You will be governed by the company's HR policies and procedures.
3. This appointment is subject to your maintaining satisfactory performance standards.

Please sign and return a copy of this letter as acceptance.

Yours sincerely,

Human Resources Department
`;
}

function generateConfirmationLetter(emp: EmployeeData, _attrs: Record<string, unknown>): string {
  return `EMPLOYMENT CONFIRMATION LETTER

Date: ${formatDate(new Date().toISOString().slice(0, 10))}

To,
${emp.first_name} ${emp.last_name}
Employee Code: ${emp.employee_code}

Dear ${emp.first_name},

We are pleased to confirm your employment as ${emp.designation} in the ${emp.department} department, effective from ${formatDate(emp.probation_end_date ?? new Date().toISOString().slice(0, 10))}.

Your performance during the probationary period has been satisfactory. All terms and conditions of your original appointment letter remain unchanged.

We look forward to your continued contribution to the organization.

Yours sincerely,

Human Resources Department
`;
}

function generateExperienceLetter(emp: EmployeeData, attrs: Record<string, unknown>): string {
  const exitDate = attrs.exit_date as string | null;
  return `EXPERIENCE CERTIFICATE

Date: ${formatDate(new Date().toISOString().slice(0, 10))}

TO WHOM IT MAY CONCERN

This is to certify that ${emp.first_name} ${emp.last_name} (Employee Code: ${emp.employee_code}) was employed with us as ${emp.designation} in the ${emp.department} department from ${formatDate(emp.joining_date)} to ${formatDate(exitDate ?? new Date().toISOString().slice(0, 10))}.

During the tenure, ${emp.first_name} demonstrated excellent professional skills and maintained a good work record. We wish them success in their future endeavors.

Yours sincerely,

Human Resources Department
`;
}

function generateIncrementLetter(emp: EmployeeData, attrs: Record<string, unknown>): string {
  const newSalary = attrs.new_basic_salary_minor as number | null;
  const incrementPct = attrs.increment_pct as number | null;
  const effectiveDate = attrs.effective_date as string | null;
  return `SALARY INCREMENT LETTER

Date: ${formatDate(new Date().toISOString().slice(0, 10))}

To,
${emp.first_name} ${emp.last_name}
Employee Code: ${emp.employee_code}

Dear ${emp.first_name},

We are pleased to inform you that your annual salary increment has been approved effective ${formatDate(effectiveDate ?? new Date().toISOString().slice(0, 10))}.

${incrementPct ? `Increment: ${incrementPct}%` : ""}
Revised Basic Salary: ${formatCurrency(newSalary ?? emp.basic_salary_minor)} per month

This increment reflects your performance and contribution to the organization.

Yours sincerely,

Human Resources Department
`;
}

const LETTER_GENERATORS: Record<string, (emp: EmployeeData, attrs: Record<string, unknown>) => string> = {
  appointment: generateAppointmentLetter,
  confirmation: generateConfirmationLetter,
  experience: generateExperienceLetter,
  increment: generateIncrementLetter,
  // Others fall back to a generic template
};

export const generateLetterSchema = z.object({
  employeeId: z.string().uuid(),
  letterType: z.enum(["appointment", "confirmation", "increment", "experience", "no_dues", "offer", "relieving", "form_f", "transfer"]),
  attributes: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function generateHrLetter(access: Access, input: z.infer<typeof generateLetterSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const emp = await fetchEmployee(access, input.employeeId);
  const generator = LETTER_GENERATORS[input.letterType];
  const content = generator
    ? generator(emp, input.attributes)
    : `${input.letterType.toUpperCase()} LETTER\n\nFor: ${emp.first_name} ${emp.last_name} (${emp.employee_code})\nDate: ${formatDate(new Date().toISOString().slice(0, 10))}\n`;

  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into hr_letters (id, tenant_id, employee_id, letter_type, content, generated_by_membership_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.letterType}, ${content}, ${access.context.membershipId},
        ${JSON.stringify(input.attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'people.letter_generate', 'hr_letter', ${id},
        'HR letter generated',
        ${JSON.stringify({ letterType: input.letterType, employeeId: input.employeeId })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, letterType: input.letterType, content, employeeId: input.employeeId, employeeName: `${emp.first_name} ${emp.last_name}` };
}

export async function listHrLetters(access: Access, args: { employeeId?: string | null; letterType?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from hr_letters
      where tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.letterType ?? null}::text is null or letter_type = ${args.letterType ?? null}::text)
    `,
    sqlClient`
      select l.id, l.employee_id, l.letter_type, l.generated_at, l.attributes,
             e.first_name, e.last_name, e.employee_code
      from hr_letters l
      join employees e on e.id = l.employee_id and e.tenant_id = l.tenant_id
      where l.tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or l.employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.letterType ?? null}::text is null or l.letter_type = ${args.letterType ?? null}::text)
      order by l.generated_at desc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const total = ((countRows as Array<{ total: number }>)[0]?.total ?? 0);
  return { items: rows, total };
}
