import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklists, picklistValues } from "@/lib/picklists";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Employee helpdesk (SCR helpdesk). Tickets live in `helpdesk_tickets` (envelope + JSONB).
 *
 * Authorization:
 *  - `hr.helpdesk.read` / `hr.helpdesk.write` — helpdesk agents: every ticket in the tenant.
 *  - `hr.helpdesk.self.read` / `hr.helpdesk.self.write` — employees: only tickets they raised,
 *    addressed by the session's linked employee id (never by a request field).
 *  - `hr.helpdesk.approve` — deleting a ticket.
 * Tickets another principal may not see return 404, never 403, so existence is not leaked.
 * The SLA due time is derived from the priority on the server; the UI only counts down to it.
 */

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Response window per priority, in hours. */
export const SLA_HOURS: Record<TicketPriority, number> = { low: 48, medium: 24, high: 8, urgent: 2 };

export const TICKET_STATUSES = picklistValues("PL_TICKET_STATUS");
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Allowed status changes. Anything not listed is refused with 409. */
export const TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ["in_progress", "awaiting_employee", "resolved", "closed"],
  in_progress: ["awaiting_employee", "resolved", "closed"],
  awaiting_employee: ["in_progress", "resolved", "closed"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: ["in_progress", "awaiting_employee", "resolved", "closed"],
};

const CATEGORY_VALUES = picklistValues("PL_TICKET_CATEGORY");

/**
 * Labels the generic "Raise support ticket" action form still submits, mapped to picklist slugs so that
 * form keeps working. Anything else must already be a PL_TICKET_CATEGORY value or label.
 */
const LEGACY_CATEGORY: Record<string, string> = {
  "payroll and taxes": "payroll",
  "leaves and attendance": "leave",
  "medical and benefits": "other",
  "it and hardware": "it",
  "workplace grievance": "grievance",
};

export function toCategorySlug(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const needle = raw.trim().toLowerCase();
  const match = picklists.PL_TICKET_CATEGORY.values.find((entry) => entry.value === needle || entry.label.toLowerCase() === needle);
  return match?.value ?? LEGACY_CATEGORY[needle] ?? needle;
}

const toPrioritySlug = (raw: unknown) => (typeof raw === "string" ? (raw.trim().toLowerCase() === "critical" ? "urgent" : raw.trim().toLowerCase()) : raw);

export const createTicketSchema = z.object({
  category: z.preprocess(toCategorySlug, z.enum(CATEGORY_VALUES, { message: "Choose a helpdesk category." })),
  priority: z.preprocess(toPrioritySlug, z.enum(TICKET_PRIORITIES)).default("medium"),
  subject: z.string().trim().min(3, "Enter a subject of at least 3 characters.").max(200),
  description: z.string().trim().min(5, "Describe the issue in at least 5 characters.").max(4000),
});

export const replySchema = z.object({
  text: z.string().trim().min(1, "A reply cannot be empty.").max(2000),
  internal: z.boolean().default(false),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    category: z.enum(CATEGORY_VALUES).optional(),
    assigneeEmployeeId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), "Nothing to update.");

export const listTicketsQuery = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateTicket = z.infer<typeof createTicketSchema>;
export type Reply = z.infer<typeof replySchema>;
export type UpdateTicket = z.infer<typeof updateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuery>;

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/** Normalise legacy stored values ("OPEN", "In Progress") to the picklist slug. */
export function normalizeStatus(raw: unknown): TicketStatus {
  const slug = String(raw ?? "open").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (TICKET_STATUSES as readonly string[]).includes(slug) ? (slug as TicketStatus) : "open";
}

export function normalizePriority(raw: unknown): TicketPriority {
  const slug = String(raw ?? "medium").trim().toLowerCase();
  if (slug === "critical") return "urgent";
  return (TICKET_PRIORITIES as readonly string[]).includes(slug) ? (slug as TicketPriority) : "medium";
}

export function slaDueAt(createdAtIso: string, priority: TicketPriority): string {
  return new Date(new Date(createdAtIso).getTime() + SLA_HOURS[priority] * 3_600_000).toISOString();
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return from === to || TICKET_TRANSITIONS[from].includes(to);
}

/** A short human reference, stable for the ticket. */
export function ticketReference(id: string, createdAtIso: string): string {
  const day = createdAtIso.slice(0, 10).replace(/-/g, "");
  return `HD-${day}-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export type TicketMessage = {
  id: string;
  authorName: string;
  authorRole: "requester" | "agent";
  text: string;
  at: string | null;
  internal: boolean;
};

/** Read a stored message, including the legacy `{sender, role, time, text}` shape. */
export function normalizeMessage(raw: unknown, index: number): TicketMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const text = typeof value.text === "string" ? value.text : "";
  if (!text) return null;
  const role = String(value.authorRole ?? value.role ?? "requester").toLowerCase();
  const at = typeof value.at === "string" && !Number.isNaN(Date.parse(value.at)) ? value.at : null;
  return {
    id: typeof value.id === "string" ? value.id : `legacy-${index}`,
    authorName: String(value.authorName ?? value.sender ?? ""),
    authorRole: role === "agent" ? "agent" : "requester",
    text,
    at,
    internal: value.internal === true,
  };
}

export function categoryCatalog() {
  return picklists.PL_TICKET_CATEGORY.values.map((entry) => ({ value: entry.value, label: entry.label }));
}

export function statusCatalog() {
  return picklists.PL_TICKET_STATUS.values.map((entry) => ({ value: entry.value, label: entry.label }));
}

/* ------------------------------------------------------------------ */
/* Session-scoped helpers                                              */
/* ------------------------------------------------------------------ */

function has(access: Access, permission: string): boolean {
  return authorize(access.context, { action: permission, resource: { tenantId: access.tenantId } }).allowed;
}

type Scope = { all: boolean; agent: boolean; employeeId: string | null };

async function selfEmployee(access: Access): Promise<{ id: string; name: string } | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.id, e.first_name, e.last_name
      from memberships m join employees e on e.tenant_id = m.tenant_id and e.id = m.employee_id
      where m.tenant_id = ${access.tenantId} and m.id = ${access.context.membershipId}
      limit 1
    `,
  ]);
  const row = (rows as Array<{ id: string; first_name: string | null; last_name: string | null }>)[0];
  if (!row) return null;
  return { id: row.id, name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() };
}

async function readScope(access: Access): Promise<Scope> {
  if (has(access, "hr.helpdesk.read")) {
    return { all: true, agent: has(access, "hr.helpdesk.write"), employeeId: (await selfEmployee(access))?.id ?? null };
  }
  enforce(access.context, "hr.helpdesk.self.read", { tenantId: access.tenantId });
  return { all: false, agent: false, employeeId: (await selfEmployee(access))?.id ?? null };
}

const NOT_FOUND = () => new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested ticket was not found." });

type TicketRow = {
  id: string;
  status: string;
  attributes: Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
  employee_id: string | null;
  first_name: string | null;
  last_name: string | null;
  employee_code: string | null;
  department: string | null;
};

export type TicketView = {
  id: string;
  version: number;
  reference: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  raisedBy: { employeeId: string | null; name: string | null; code: string | null; department: string | null };
  assignee: { employeeId: string | null; name: string | null };
  createdAt: string;
  updatedAt: string;
  slaHours: number;
  slaDueAt: string;
  resolvedAt: string | null;
  messageCount: number;
  isMine: boolean;
};

const iso = (value: string | Date) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

export function projectTicket(row: TicketRow, selfEmployeeId: string | null): TicketView {
  const a = row.attributes ?? {};
  const createdAt = iso(row.created_at);
  const priority = normalizePriority(a.priority);
  const messages = Array.isArray(a.messages) ? a.messages : [];
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return {
    id: row.id,
    version: 1,
    reference: str(a.reference) ?? ticketReference(row.id, createdAt),
    subject: str(a.subject) ?? "",
    description: str(a.description) ?? "",
    category: str(a.category) ?? "other",
    priority,
    status: normalizeStatus(row.status),
    raisedBy: { employeeId: row.employee_id, name: name || null, code: row.employee_code, department: row.department },
    assignee: { employeeId: str(a.assignee_employee_id), name: str(a.assignee_name) },
    createdAt,
    updatedAt: iso(row.updated_at),
    slaHours: SLA_HOURS[priority],
    slaDueAt: str(a.sla_due_at) ?? slaDueAt(createdAt, priority),
    resolvedAt: str(a.resolved_at),
    messageCount: messages.length,
    isMine: selfEmployeeId !== null && row.employee_id === selfEmployeeId,
  };
}

async function loadTicket(access: Access, id: string, scope: Scope): Promise<TicketRow> {
  if (!uuidOrNull(id)) throw NOT_FOUND();
  const [rows] = await tenantTx(access, [
    sqlClient`
      select t.id, t.status, t.attributes, t.created_at, t.updated_at, t.employee_id,
             e.first_name, e.last_name, e.employee_code, e.department
      from helpdesk_tickets t
        left join employees e on e.tenant_id::text = t.tenant_id::text and e.id = t.employee_id
      where t.tenant_id = ${access.tenantId} and t.id = ${id}::uuid
      limit 1
    `,
  ]);
  const row = (rows as TicketRow[])[0];
  if (!row) throw NOT_FOUND();
  if (!scope.all && (scope.employeeId === null || row.employee_id !== scope.employeeId)) throw NOT_FOUND();
  return row;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function listTickets(access: Access, query: ListTicketsQuery) {
  const scope = await readScope(access);
  if (!scope.all && !scope.employeeId) {
    return { items: [] as TicketView[], hasMore: false, scope: "self" as const, linked: false, canManage: false };
  }
  const offset = (query.page - 1) * query.pageSize;
  const like = `%${(query.search ?? "").replace(/[%_]/g, "")}%`;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select t.id, t.status, t.attributes, t.created_at, t.updated_at, t.employee_id,
             e.first_name, e.last_name, e.employee_code, e.department
      from helpdesk_tickets t
        left join employees e on e.tenant_id::text = t.tenant_id::text and e.id = t.employee_id
      where t.tenant_id = ${access.tenantId}
        and (${scope.all} or t.employee_id = ${scope.employeeId}::uuid)
        and (${query.category ?? null}::text is null or lower(t.attributes->>'category') = ${query.category ?? null})
        and (${query.search ?? null}::text is null
             or (coalesce(t.attributes->>'subject', '') || ' ' || coalesce(t.attributes->>'reference', '')) ilike ${like})
      order by t.created_at desc, t.id desc
      limit ${query.pageSize + 1} offset ${offset}
    `,
  ]);
  const projected = (rows as TicketRow[]).map((row) => projectTicket(row, scope.employeeId));
  // Status is normalised from legacy spellings in projectTicket, so it is filtered after projection.
  const filtered = query.status ? projected.filter((item) => item.status === query.status) : projected;
  return {
    items: filtered.slice(0, query.pageSize),
    hasMore: (rows as unknown[]).length > query.pageSize,
    scope: scope.all ? ("all" as const) : ("self" as const),
    linked: scope.employeeId !== null,
    canManage: scope.agent,
  };
}

export async function getTicket(access: Access, id: string) {
  const scope = await readScope(access);
  const row = await loadTicket(access, id, scope);
  return projectTicket(row, scope.employeeId);
}

export async function listTicketMessages(access: Access, id: string): Promise<TicketMessage[]> {
  const scope = await readScope(access);
  const row = await loadTicket(access, id, scope);
  const raw = Array.isArray(row.attributes?.messages) ? (row.attributes.messages as unknown[]) : [];
  return raw
    .map((entry, index) => normalizeMessage(entry, index))
    .filter((entry): entry is TicketMessage => entry !== null && (scope.agent || !entry.internal));
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

const auditStatement = (access: Access, action: string, id: string, reason: string, after: unknown, requestId: string) => sqlClient`
  insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
  values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
    ${action}, 'helpdesk_ticket', ${id}, ${reason}, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)`;

export async function createTicket(access: Access, input: CreateTicket, requestId: string) {
  if (!has(access, "hr.helpdesk.write")) enforce(access.context, "hr.helpdesk.self.write", { tenantId: access.tenantId });
  const self = await selfEmployee(access);
  if (!self) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Raising a ticket requires a linked employee profile." });
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const attributes = {
    reference: ticketReference(id, createdAt),
    category: input.category,
    priority: input.priority,
    subject: input.subject,
    description: input.description,
    sla_due_at: slaDueAt(createdAt, input.priority),
    created_by: access.context.actorUserId,
    messages: [
      { id: crypto.randomUUID(), authorName: self.name, authorRole: "requester", authorUserId: access.context.actorUserId, text: input.description, at: createdAt, internal: false },
    ],
  };
  await tenantTx(access, [
    sqlClient`
      insert into helpdesk_tickets (id, tenant_id, employee_id, status, attributes, created_at, updated_at)
      values (${id}, ${access.tenantId}, ${self.id}::uuid, 'open', ${JSON.stringify(attributes)}::jsonb, ${createdAt}, ${createdAt})
    `,
    auditStatement(access, "helpdesk.ticket_create", id, "Support ticket raised", { reference: attributes.reference, category: input.category, priority: input.priority }, requestId),
  ]);
  return { id, reference: attributes.reference, status: "open" as const, slaDueAt: attributes.sla_due_at };
}

export async function replyToTicket(access: Access, id: string, input: Reply, requestId: string): Promise<TicketMessage> {
  const scope = await readScope(access);
  const row = await loadTicket(access, id, scope);
  const isRequester = scope.employeeId !== null && row.employee_id === scope.employeeId;
  if (!scope.agent) {
    enforce(access.context, "hr.helpdesk.self.write", { tenantId: access.tenantId });
    if (!isRequester) throw NOT_FOUND();
    if (input.internal) throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Only helpdesk agents can add internal notes.", details: [{ field: "internal", issue: "forbidden" }] });
  }
  const status = normalizeStatus(row.status);
  if (status === "closed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This ticket is closed. Reopen it before replying." });
  }
  const author = await selfEmployee(access);
  const message: TicketMessage = {
    id: crypto.randomUUID(),
    authorName: author?.name ?? "",
    authorRole: isRequester ? "requester" : "agent",
    text: input.text,
    at: new Date().toISOString(),
    internal: input.internal,
  };
  const stored = { ...message, authorUserId: access.context.actorUserId };
  await tenantTx(access, [
    sqlClient`
      update helpdesk_tickets
      set attributes = jsonb_set(coalesce(attributes, '{}'::jsonb), '{messages}',
            coalesce(attributes->'messages', '[]'::jsonb) || ${JSON.stringify([stored])}::jsonb),
          updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}::uuid
    `,
    auditStatement(access, "helpdesk.ticket_reply", id, input.internal ? "Internal note added" : "Reply added to ticket thread", { messageId: message.id, internal: input.internal }, requestId),
  ]);
  return message;
}

export async function updateTicket(access: Access, id: string, input: UpdateTicket, requestId: string) {
  enforce(access.context, "hr.helpdesk.write", { tenantId: access.tenantId });
  const scope = await readScope(access);
  const row = await loadTicket(access, id, scope);
  const current = normalizeStatus(row.status);
  const patch: Record<string, unknown> = {};
  let nextStatus: TicketStatus = current;
  if (input.status && input.status !== current) {
    if (!canTransition(current, input.status)) {
      throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `A ticket cannot move from ${current} to ${input.status}.`, details: [{ field: "status", issue: "transition_not_allowed" }] });
    }
    nextStatus = input.status;
    if (input.status === "resolved") patch.resolved_at = new Date().toISOString();
    if (input.status === "reopened") patch.resolved_at = null;
  }
  if (input.priority) {
    patch.priority = input.priority;
    patch.sla_due_at = slaDueAt(iso(row.created_at), input.priority);
  }
  if (input.category) patch.category = input.category;
  if (input.assigneeEmployeeId !== undefined) {
    if (input.assigneeEmployeeId === null) {
      patch.assignee_employee_id = null;
      patch.assignee_name = null;
    } else {
      const [rows] = await tenantTx(access, [
        sqlClient`select id, first_name, last_name from employees where tenant_id = ${access.tenantId} and id = ${input.assigneeEmployeeId} and status = 'active' limit 1`,
      ]);
      const assignee = (rows as Array<{ id: string; first_name: string | null; last_name: string | null }>)[0];
      if (!assignee) throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "The assignee is not an active employee.", details: [{ field: "assigneeEmployeeId", issue: "unknown" }] });
      patch.assignee_employee_id = assignee.id;
      patch.assignee_name = `${assignee.first_name ?? ""} ${assignee.last_name ?? ""}`.trim();
    }
  }
  await tenantTx(access, [
    sqlClient`
      update helpdesk_tickets
      set status = ${nextStatus}, attributes = attributes || ${JSON.stringify(patch)}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}::uuid
    `,
    auditStatement(access, "helpdesk.ticket_update", id, "Support ticket updated", { from: current, to: nextStatus, ...patch }, requestId),
  ]);
  return getTicket(access, id);
}

export async function deleteTicket(access: Access, id: string, requestId: string) {
  enforce(access.context, "hr.helpdesk.approve", { tenantId: access.tenantId });
  const scope = await readScope(access);
  await loadTicket(access, id, scope);
  await tenantTx(access, [
    sqlClient`delete from helpdesk_tickets where tenant_id = ${access.tenantId} and id = ${id}::uuid`,
    auditStatement(access, "helpdesk.ticket_delete", id, "Support ticket deleted", {}, requestId),
  ]);
  return { id, deleted: true };
}
