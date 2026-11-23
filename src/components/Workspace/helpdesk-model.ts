import type { Translate } from "./engagement-client";

/** Client-side view of the helpdesk API (`/api/v1/helpdesk/tickets`). */

export const HELPDESK_NS = "components.Workspace.HelpdeskView";
export const TICKETS_PATH = "/api/v1/helpdesk/tickets";

export type Priority = "low" | "medium" | "high" | "urgent";
export const PRIORITIES: readonly Priority[] = ["low", "medium", "high", "urgent"];

export type Ticket = {
  id: string;
  version: number;
  reference: string;
  subject: string;
  description: string;
  category: string;
  priority: Priority;
  status: string;
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

export type Option = { value: string; label: string };

export type TicketsMeta = {
  hasMore: boolean;
  scope: "all" | "self";
  linkedEmployee: boolean;
  canManage: boolean;
  categories: Option[];
  statuses: Option[];
  slaHours: Record<Priority, number>;
};

export type TicketsEnvelope = { data: Ticket[]; meta: TicketsMeta };

export type TicketMessage = { id: string; authorName: string; authorRole: "requester" | "agent"; text: string; at: string | null; internal: boolean };

const CLOSED = new Set(["resolved", "closed"]);

export function isClosedStatus(status: string): boolean {
  return CLOSED.has(status);
}

/** Remaining time to the SLA due instant, or the breach, in whole minutes. */
export function slaMinutesLeft(ticket: Pick<Ticket, "slaDueAt">, nowMs: number): number {
  return Math.round((new Date(ticket.slaDueAt).getTime() - nowMs) / 60_000);
}

export function slaLabel(ticket: Pick<Ticket, "slaDueAt" | "status">, nowMs: number, t: Translate): string {
  if (isClosedStatus(ticket.status)) return t(`${HELPDESK_NS}.text_sla_met`, "Closed");
  const minutes = slaMinutesLeft(ticket, nowMs);
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const span = hours > 0 ? t(`${HELPDESK_NS}.text_sla_span_hm`, "{hours}h {minutes}m", { hours, minutes: mins }) : t(`${HELPDESK_NS}.text_sla_span_m`, "{minutes}m", { minutes: mins });
  return minutes >= 0
    ? t(`${HELPDESK_NS}.text_sla_remaining`, "{span} remaining", { span })
    : t(`${HELPDESK_NS}.text_sla_breached`, "Overdue by {span}", { span });
}

export function priorityLabel(priority: string, t: Translate): string {
  const fallback: Record<string, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
  return t(`${HELPDESK_NS}.priority_${priority}`, fallback[priority] ?? priority);
}

export function optionLabel(options: readonly Option[], value: string, prefix: string, t: Translate): string {
  const match = options.find((option) => option.value === value);
  return t(`${HELPDESK_NS}.${prefix}_${value}`, match?.label ?? value);
}
