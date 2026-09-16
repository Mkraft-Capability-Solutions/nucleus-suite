/**
 * Nucleus AI action catalog.
 * Lists every HRMS action the AI may draft, mapped to real /api/v1/ routes.
 * Ported from helper/src/lib/ai/nucleus-catalog.ts — no workflow-catalog dependency
 * (we use a self-contained flat structure compatible with our existing codebase).
 */

export type NucleusAction = {
  /** Function name exposed to the model. Snake case, verb first. */
  name: string;
  /** HTTP method + path of the real /api/v1/ route this drives. */
  method: 'POST' | 'PUT' | 'PATCH';
  path: string;
  /** One-line description the model reads to select the right tool. */
  summary: string;
  /** Fields the model must collect before a draft can be shown. */
  requiredFields: Array<{
    name: string;
    label: string;
    kind: 'text' | 'date' | 'select' | 'number' | 'boolean';
    optional?: boolean;
    options?: string[];
    format?: 'date' | 'uuid' | 'email';
    hint?: string;
  }>;
};

export const NUCLEUS_ACTIONS: readonly NucleusAction[] = [
  {
    name: 'apply_leave',
    method: 'POST',
    path: '/api/v1/leave-requests',
    summary: 'Raise a leave request for an employee over a date range.',
    requiredFields: [
      { name: 'leaveTypeId', label: 'Leave Type', kind: 'select', options: ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Comp Off', 'Maternity Leave', 'Paternity Leave'] },
      { name: 'startDate', label: 'Start Date', kind: 'date', format: 'date', hint: 'YYYY-MM-DD' },
      { name: 'endDate', label: 'End Date', kind: 'date', format: 'date', hint: 'YYYY-MM-DD' },
      { name: 'reason', label: 'Reason', kind: 'text', optional: true },
    ],
  },
  {
    name: 'record_attendance_punches',
    method: 'POST',
    path: '/api/v1/attendance/punches',
    summary: 'Record in and out punches for an employee on one work date.',
    requiredFields: [
      { name: 'date', label: 'Work Date', kind: 'date', format: 'date' },
      { name: 'punchIn', label: 'Punch In Time', kind: 'text', hint: 'HH:MM in 24h format' },
      { name: 'punchOut', label: 'Punch Out Time', kind: 'text', optional: true, hint: 'HH:MM in 24h format' },
    ],
  },
  {
    name: 'request_attendance_correction',
    method: 'POST',
    path: '/api/v1/regularizations',
    summary: 'Raise a correction against an attendance day that was recorded wrongly.',
    requiredFields: [
      { name: 'date', label: 'Attendance Date', kind: 'date', format: 'date' },
      { name: 'reason', label: 'Reason for Correction', kind: 'text' },
      { name: 'correctedIn', label: 'Correct Punch In', kind: 'text', optional: true },
      { name: 'correctedOut', label: 'Correct Punch Out', kind: 'text', optional: true },
    ],
  },
  {
    name: 'request_gate_pass',
    method: 'POST',
    path: '/api/v1/gate-passes',
    summary: 'Request a gate pass for an employee to leave the premises during a shift.',
    requiredFields: [
      { name: 'date', label: 'Date', kind: 'date', format: 'date' },
      { name: 'exitTime', label: 'Expected Exit Time', kind: 'text' },
      { name: 'returnTime', label: 'Expected Return Time', kind: 'text', optional: true },
      { name: 'purpose', label: 'Purpose', kind: 'text' },
    ],
  },
  {
    name: 'request_shift_swap',
    method: 'POST',
    path: '/api/v1/shift-swaps',
    summary: 'Request a shift swap between two employees on a date.',
    requiredFields: [
      { name: 'swapDate', label: 'Swap Date', kind: 'date', format: 'date' },
      { name: 'withEmployeeId', label: 'Swap With Employee ID', kind: 'text', format: 'uuid', hint: 'Employee UUID — resolve with find_employee first' },
      { name: 'reason', label: 'Reason', kind: 'text', optional: true },
    ],
  },
  {
    name: 'grant_compensatory_off',
    method: 'POST',
    path: '/api/v1/coff-grants',
    summary: 'Record a compensatory-off credit for a day the employee worked on a holiday.',
    requiredFields: [
      { name: 'workedDate', label: 'Date Worked', kind: 'date', format: 'date' },
      { name: 'expiryDate', label: 'Expiry Date', kind: 'date', format: 'date', optional: true },
    ],
  },
  {
    name: 'publish_announcement',
    method: 'POST',
    path: '/api/v1/announcements',
    summary: 'Compose and publish an announcement visible to the workforce.',
    requiredFields: [
      { name: 'title', label: 'Announcement Title', kind: 'text' },
      { name: 'body', label: 'Announcement Body', kind: 'text' },
      { name: 'audience', label: 'Audience', kind: 'select', options: ['All Employees', 'Department', 'Location', 'Role'], optional: true },
    ],
  },
  {
    name: 'recognise_employee',
    method: 'POST',
    path: '/api/v1/recognition-events',
    summary: 'Record a recognition event or badge award for an employee.',
    requiredFields: [
      { name: 'recipientId', label: 'Recipient Employee ID', kind: 'text', format: 'uuid' },
      { name: 'category', label: 'Recognition Category', kind: 'select', options: ['Innovation', 'Teamwork', 'Customer Focus', 'Leadership', 'Excellence', 'Milestone'] },
      { name: 'message', label: 'Recognition Message', kind: 'text' },
    ],
  },
  {
    name: 'give_feedback',
    method: 'POST',
    path: '/api/v1/feedback',
    summary: 'Record performance feedback about an employee.',
    requiredFields: [
      { name: 'subjectId', label: 'Employee ID', kind: 'text', format: 'uuid' },
      { name: 'type', label: 'Feedback Type', kind: 'select', options: ['Positive', 'Constructive', 'Neutral'] },
      { name: 'message', label: 'Feedback', kind: 'text' },
    ],
  },
  {
    name: 'create_objective',
    method: 'POST',
    path: '/api/v1/objectives',
    summary: 'Create a performance objective (OKR) owned by an employee.',
    requiredFields: [
      { name: 'title', label: 'Objective Title', kind: 'text' },
      { name: 'dueDate', label: 'Due Date', kind: 'date', format: 'date' },
      { name: 'description', label: 'Description', kind: 'text', optional: true },
    ],
  },
  {
    name: 'enrol_in_course',
    method: 'POST',
    path: '/api/v1/enrollments',
    summary: 'Enrol an employee on a training course.',
    requiredFields: [
      { name: 'courseId', label: 'Course ID', kind: 'text', format: 'uuid' },
    ],
  },
  {
    name: 'raise_requisition',
    method: 'POST',
    path: '/api/v1/requisitions',
    summary: 'Raise a hiring requisition for an open position.',
    requiredFields: [
      { name: 'positionTitle', label: 'Position Title', kind: 'text' },
      { name: 'department', label: 'Department', kind: 'text' },
      { name: 'headcount', label: 'Headcount', kind: 'number' },
      { name: 'urgency', label: 'Urgency', kind: 'select', options: ['Immediate', 'Within 30 Days', 'Within 90 Days', 'Planned'], optional: true },
    ],
  },
  {
    name: 'add_candidate',
    method: 'POST',
    path: '/api/v1/candidates',
    summary: 'Add a candidate to the talent pipeline against a requisition.',
    requiredFields: [
      { name: 'name', label: 'Candidate Name', kind: 'text' },
      { name: 'email', label: 'Candidate Email', kind: 'text', format: 'email' },
      { name: 'position', label: 'Position Applied For', kind: 'text' },
    ],
  },
  {
    name: 'record_referral',
    method: 'POST',
    path: '/api/v1/referrals',
    summary: 'Record an employee referral against a requisition and candidate.',
    requiredFields: [
      { name: 'candidateName', label: 'Candidate Name', kind: 'text' },
      { name: 'candidateEmail', label: 'Candidate Email', kind: 'text', format: 'email' },
      { name: 'position', label: 'Position', kind: 'text' },
    ],
  },
];

export type DraftField = {
  name: string;
  label: string;
  value: unknown;
  optional: boolean;
  origin: 'supplied' | 'default';
};

export type ActionDraft = {
  action: NucleusAction;
  fields: DraftField[];
  body: Record<string, unknown>;
};

export type TraceEntry = {
  tool: string;
  outcome: 'ok' | 'needs_more_info' | 'draft' | 'error';
  detail?: string;
  at: number;
};

export function findAction(name: string): NucleusAction | undefined {
  return NUCLEUS_ACTIONS.find((a) => a.name === name);
}

export function validateDraft(
  action: NucleusAction,
  values: Record<string, unknown>,
): { missing: Array<{ field: string; label: string }>; fields: DraftField[]; body: Record<string, unknown> } {
  const missing: Array<{ field: string; label: string }> = [];
  const fields: DraftField[] = [];
  const body: Record<string, unknown> = {};

  for (const field of action.requiredFields) {
    const raw = values[field.name];
    const supplied = raw !== undefined && raw !== null && raw !== '';
    if (!supplied) {
      if (!field.optional) missing.push({ field: field.name, label: field.label });
      continue;
    }
    body[field.name] = raw;
    fields.push({ name: field.name, label: field.label, value: raw, optional: Boolean(field.optional), origin: 'supplied' });
  }

  return { missing, fields, body };
}

export async function submitDraft(draft: ActionDraft): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(draft.action.path, {
    method: draft.action.method,
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(draft.body),
  });
  const payload = await response.json().catch(() => null) as { error?: { message?: string }; data?: { id?: string } } | null;
  if (!response.ok) {
    return { ok: false, message: payload?.error?.message ?? `The request was refused (${response.status}).` };
  }
  return { ok: true, message: payload?.data?.id ? `Recorded as ${payload.data.id}.` : 'Recorded.' };
}
