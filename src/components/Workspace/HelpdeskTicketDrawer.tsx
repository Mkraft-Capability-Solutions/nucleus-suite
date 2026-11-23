"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Send, X } from "lucide-react";
import styles from "./HelpdeskView.module.css";
import { failureMessage, formatDateTime, readJson, sendJson, useSubmitKey, useT } from "./engagement-client";
import { HELPDESK_NS as NS, TICKETS_PATH, isClosedStatus, optionLabel, priorityLabel, slaLabel, type Option, type Ticket, type TicketMessage } from "./helpdesk-model";

/**
 * Ticket detail drawer: facts from the ticket row, the thread from GET …/messages, a reply posted with an
 * Idempotency-Key, and (for helpdesk agents) a status change through PATCH. Nothing changes on screen until the
 * server accepts it.
 */

type Thread = { status: "loading" } | { status: "ready"; messages: TicketMessage[] } | { status: "error"; message: string };

export default function HelpdeskTicketDrawer({ ticket, categories, statuses, canManage, nowMs, onClose, onChanged }: {
  ticket: Ticket;
  categories: Option[];
  statuses: Option[];
  canManage: boolean;
  nowMs: number;
  onClose: () => void;
  onChanged: (ticket: Ticket | null) => void;
}) {
  const { t, locale } = useT();
  const [thread, setThread] = useState<Thread>({ status: "loading" });
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<{ base: string; value: string }>({ base: ticket.status, value: ticket.status });
  const nextStatus = statusDraft.base === ticket.status ? statusDraft.value : ticket.status;
  const setNextStatus = (value: string) => setStatusDraft({ base: ticket.status, value });
  const { keyFor, reset } = useSubmitKey();
  const closed = ticket.status === "closed";

  const fetchThread = useCallback(async (signal?: AbortSignal): Promise<Thread> => {
    const result = await readJson<{ data: TicketMessage[] }>(`${TICKETS_PATH}/${encodeURIComponent(ticket.id)}/messages`, signal);
    if (!result.ok) return { status: "error", message: failureMessage(result, t, t(`${NS}.text_thread_failed`, "The conversation could not be loaded.")) };
    return { status: "ready", messages: result.body.data };
  }, [ticket.id, t]);

  const load = useCallback(async () => setThread(await fetchThread()), [fetchThread]);

  useEffect(() => {
    const controller = new AbortController();
    fetchThread(controller.signal).then((next) => { if (!controller.signal.aborted) setThread(next); }).catch(() => undefined);
    return () => controller.abort();
  }, [fetchThread]);

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text || busy) return;
    if (text.length > 2000) {
      setError(t(`${NS}.err_reply_long`, "Keep the reply under 2000 characters."));
      return;
    }
    const payload = { text, internal: canManage && internal };
    setBusy(true);
    setError(null);
    const result = await sendJson("POST", `${TICKETS_PATH}/${encodeURIComponent(ticket.id)}/messages`, payload, { idempotencyKey: keyFor(payload) });
    setBusy(false);
    if (!result.ok) {
      setError(failureMessage(result, t, t(`${NS}.text_reply_failed`, "Your reply could not be sent.")));
      return;
    }
    reset();
    setReply("");
    setInternal(false);
    await load();
    onChanged({ ...ticket, messageCount: ticket.messageCount + 1 });
  };

  const changeStatus = async () => {
    if (nextStatus === ticket.status || busy) return;
    setBusy(true);
    setError(null);
    const result = await sendJson<{ data: Ticket }>("PATCH", `${TICKETS_PATH}/${encodeURIComponent(ticket.id)}`, { status: nextStatus });
    setBusy(false);
    if (!result.ok) {
      setError(failureMessage(result, t, t(`${NS}.text_status_failed`, "The status could not be changed.")));
      setNextStatus(ticket.status);
      return;
    }
    onChanged(result.body.data);
  };

  const fact = (label: string, value: string | null) => (
    <div><strong>{label}</strong> {value || <span className={styles.muted}>{t(`${NS}.text_not_recorded`, "Not recorded")}</span>}</div>
  );

  return (
    <div className={styles.modalOverlay} onClick={() => !busy && onClose()}>
      <aside className={styles.drawerContent} role="dialog" aria-modal="true" aria-labelledby="helpdesk-ticket-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <span className={styles.tktId}>{ticket.reference}</span>
            <h3 id="helpdesk-ticket-title">{ticket.subject}</h3>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><X size={16} aria-hidden="true" /></button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.drawerInfoGrid}>
            {fact(t(`${NS}.text_raised_by`, "Raised by"), ticket.raisedBy.name)}
            {fact(t(`${NS}.text_department`, "Department"), ticket.raisedBy.department)}
            {fact(t(`${NS}.text_category`, "Category"), optionLabel(categories, ticket.category, "category", t))}
            {fact(t(`${NS}.text_priority`, "Priority"), priorityLabel(ticket.priority, t))}
            {fact(t(`${NS}.text_assigned_to`, "Assigned to"), ticket.assignee.name ?? t(`${NS}.text_unassigned`, "Unassigned"))}
            {fact(t(`${NS}.text_sla_status`, "SLA"), slaLabel(ticket, nowMs, t))}
            {fact(t(`${NS}.text_status`, "Status"), optionLabel(statuses, ticket.status, "status", t))}
            {fact(t(`${NS}.text_raised_on`, "Raised on"), formatDateTime(ticket.createdAt, locale))}
          </div>

          {canManage && (
            <div className={styles.statusRow}>
              <label htmlFor="helpdesk-status">{t(`${NS}.text_change_status`, "Change status")}</label>
              <select id="helpdesk-status" className={styles.formSelect} value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={busy}>
                {statuses.map((option) => <option key={option.value} value={option.value}>{optionLabel(statuses, option.value, "status", t)}</option>)}
              </select>
              <button type="button" className={styles.btnSecondary} onClick={() => void changeStatus()} disabled={busy || nextStatus === ticket.status}>{t(`${NS}.text_apply`, "Apply")}</button>
            </div>
          )}

          <h4 className={styles.threadTitle}>{t(`${NS}.text_thread`, "Conversation")}</h4>
          <div className={styles.messagesList} aria-live="polite">
            {thread.status === "loading" && <p className={styles.muted}>{t(`${NS}.text_thread_loading`, "Loading the conversation…")}</p>}
            {thread.status === "error" && <p className={styles.formError} role="alert">{thread.message}</p>}
            {thread.status === "ready" && thread.messages.length === 0 && <p className={styles.muted}>{t(`${NS}.text_thread_empty`, "No messages on this ticket yet.")}</p>}
            {thread.status === "ready" && thread.messages.map((message) => (
              <div key={message.id} className={`${styles.messageBubble} ${message.internal ? styles.internalNote : ""}`}>
                <div className={styles.msgHeader}>
                  <strong>{message.authorName || (message.authorRole === "agent" ? t(`${NS}.text_role_agent`, "Helpdesk") : t(`${NS}.text_role_requester`, "Requester"))}</strong>
                  <span>{message.internal ? t(`${NS}.text_internal`, "Internal note") : ""} {formatDateTime(message.at, locale)}</span>
                </div>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <form className={styles.replyBox} onSubmit={sendReply}>
            <label className={styles.srOnly} htmlFor="helpdesk-reply">{t(`${NS}.text_reply_label`, "Reply")}</label>
            <input id="helpdesk-reply" className={styles.replyInput} value={reply} maxLength={2000} onChange={(event) => setReply(event.target.value)} disabled={busy || closed}
              placeholder={closed ? t(`${NS}.text_reply_closed`, "This ticket is closed.") : t(`${NS}.text_reply_placeholder`, "Type a message or resolution notes…")} />
            {canManage && (
              <label className={styles.inlineCheck}>
                <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} disabled={busy || closed} />
                {t(`${NS}.text_internal`, "Internal note")}
              </label>
            )}
            <button type="submit" className={styles.btnPrimary} disabled={busy || closed || !reply.trim()}>
              <Send size={14} aria-hidden="true" />{busy ? t(`${NS}.text_sending`, "Sending…") : t(`${NS}.text_send_reply`, "Send reply")}
            </button>
          </form>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          {isClosedStatus(ticket.status) && !closed && <p className={styles.muted}>{t(`${NS}.text_resolved_note`, "This ticket is resolved. Replying keeps the thread open for follow-up.")}</p>}
        </div>
      </aside>
    </div>
  );
}
