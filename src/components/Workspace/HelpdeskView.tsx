"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, HelpCircle, MessageSquare, Plus, RefreshCcw, Sparkles } from "lucide-react";
import styles from "./HelpdeskView.module.css";
import { useHRMS } from "@/context/HRMSContext";
import { failureMessage, readJson, useT } from "./engagement-client";
import { HELPDESK_NS as NS, TICKETS_PATH, isClosedStatus, optionLabel, priorityLabel, slaLabel, slaMinutesLeft, type Ticket, type TicketsEnvelope, type TicketsMeta } from "./helpdesk-model";
import HelpdeskRaiseModal, { type RaisePrefill } from "./HelpdeskRaiseModal";
import HelpdeskTicketDrawer from "./HelpdeskTicketDrawer";
import HelpdeskPolicySearch from "./HelpdeskPolicySearch";

/**
 * Employee helpdesk. Tickets come from GET /api/v1/helpdesk/tickets (agents see the tenant, employees their
 * own), with category/status catalogue and SLA policy from the same response. The SLA countdown is computed
 * from the server's due instant. The policy tab searches the tenant's policy knowledge base.
 */

type HelpdeskViewProps = { onNavigate?: (tab: string) => void; onSelectConsole?: (id: string) => void; activeSubFeature?: string | null };
type ListState = { status: "loading" } | { status: "ready"; items: Ticket[]; meta: TicketsMeta; page: number } | { status: "error"; message: string };
type ShowToast = (title: string, message: string, type?: string) => void;

const PRIORITY_CLASS: Record<string, string | undefined> = { urgent: styles.priCritical, high: styles.priHigh, medium: styles.priMed, low: styles.priLow };
const STATUS_CLASS: Record<string, string | undefined> = { open: styles.stOpen, reopened: styles.stOpen, in_progress: styles.stProg, awaiting_employee: styles.stProg, resolved: styles.stResolved, closed: styles.stResolved };

export default function HelpdeskView({ activeSubFeature }: HelpdeskViewProps) {
  const { t } = useT();
  const { showToast } = (useHRMS() ?? {}) as { showToast?: ShowToast };
  const [activeTab, setActiveTab] = useState<"tickets" | "policies">(() => (activeSubFeature && /polic/i.test(activeSubFeature) ? "policies" : "tickets"));
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [raise, setRaise] = useState<RaisePrefill | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const path = useCallback((page: number) => {
    const params = new URLSearchParams({ page: String(page), pageSize: "24" });
    if (category !== "all") params.set("category", category);
    if (appliedSearch) params.set("search", appliedSearch);
    return `${TICKETS_PATH}?${params.toString()}`;
  }, [category, appliedSearch]);

  const fetchPage = useCallback(async (page: number, signal?: AbortSignal): Promise<{ ok: boolean; body?: TicketsEnvelope; message: string }> => {
    const result = await readJson<TicketsEnvelope>(path(page), signal);
    if (!result.ok) return { ok: false, message: failureMessage(result, t, t(`${NS}.text_load_failed`, "Tickets could not be loaded.")) };
    return { ok: true, body: result.body, message: "" };
  }, [path, t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPage(1, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState(result.ok ? { status: "ready", items: result.body.data, meta: result.body.meta, page: 1 } : { status: "error", message: result.message });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [fetchPage]);

  const reload = async () => {
    setState({ status: "loading" });
    const result = await fetchPage(1);
    setState(result.ok ? { status: "ready", items: result.body.data, meta: result.body.meta, page: 1 } : { status: "error", message: result.message });
  };

  const loadMore = async () => {
    if (state.status !== "ready") return;
    const result = await fetchPage(state.page + 1);
    if (!result.ok) {
      showToast?.(t(`${NS}.text_load_failed`, "Tickets could not be loaded."), result.message, "error");
      return;
    }
    setState({ status: "ready", items: [...state.items, ...result.body.data], meta: result.body.meta, page: state.page + 1 });
  };

  const meta = state.status === "ready" ? state.meta : null;
  const tickets = useMemo(() => (state.status === "ready" ? state.items : []), [state]);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const breached = tickets.filter((ticket) => !isClosedStatus(ticket.status) && slaMinutesLeft(ticket, nowMs) < 0).length;

  const replaceTicket = (next: Ticket | null) => {
    if (!next || state.status !== "ready") return;
    setState({ ...state, items: state.items.map((ticket) => (ticket.id === next.id ? next : ticket)) });
  };

  const onCreated = (reference: string) => {
    setRaise(null);
    showToast?.(t(`${NS}.text_created_title`, "Ticket raised"), t(`${NS}.text_created_body`, "Ticket {reference} was recorded.", { reference }), "success");
    void reload();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.badgeRow}>
            <span className={styles.livePill}><HelpCircle size={13} aria-hidden="true" />{t(`${NS}.text_badge_helpdesk`, "Employee helpdesk")}</span>
            <span className={styles.groundedPill}><Sparkles size={13} aria-hidden="true" />{t(`${NS}.text_badge_grounded`, "Policy clause search")}</span>
          </div>
          <h2>{t(`${NS}.text_title`, "Helpdesk & policy assistant")}</h2>
          <p>{t(`${NS}.text_subtitle`, "Raise and track support tickets with SLA-based response windows, and search your company policy clauses.")}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnPrimary} onClick={() => setRaise({})} disabled={meta !== null && !meta.linkedEmployee && meta.scope === "self"}>
            <Plus size={16} aria-hidden="true" />{t(`${NS}.text_raise`, "Raise support ticket")}
          </button>
        </div>
      </div>

      <div className={styles.tabsRow} role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === "tickets"} className={`${styles.tabBtn} ${activeTab === "tickets" ? styles.activeTab : ""}`} onClick={() => setActiveTab("tickets")}>
          <MessageSquare size={16} aria-hidden="true" />
          {state.status === "ready" ? t(`${NS}.text_tab_tickets_count`, "Support tickets ({count})", { count: tickets.length }) : t(`${NS}.text_tab_tickets`, "Support tickets")}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "policies"} className={`${styles.tabBtn} ${activeTab === "policies" ? styles.activeTab : ""}`} onClick={() => setActiveTab("policies")}>
          <BookOpen size={16} aria-hidden="true" />{t(`${NS}.text_tab_policies`, "Policy assistant & clause search")}
        </button>
      </div>

      {activeTab === "tickets" && (
        <div className={styles.ticketsSection}>
          <div className={styles.filterPillsRow}>
            <button type="button" className={`${styles.filterPill} ${category === "all" ? styles.filterPillActive : ""}`} onClick={() => setCategory("all")} aria-pressed={category === "all"}>{t(`${NS}.text_all`, "All")}</button>
            {(meta?.categories ?? []).map((option) => (
              <button key={option.value} type="button" className={`${styles.filterPill} ${category === option.value ? styles.filterPillActive : ""}`} onClick={() => setCategory(option.value)} aria-pressed={category === option.value}>
                {optionLabel(meta?.categories ?? [], option.value, "category", t)}
              </button>
            ))}
            <form className={styles.ticketSearch} role="search" onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }}>
              <label className={styles.srOnly} htmlFor="helpdesk-search">{t(`${NS}.text_search_tickets`, "Search tickets")}</label>
              <input id="helpdesk-search" className={styles.formInput} value={search} maxLength={120} onChange={(event) => setSearch(event.target.value)} placeholder={t(`${NS}.text_search_tickets`, "Search tickets")} />
            </form>
          </div>

          {meta && (
            <p className={styles.scopeNote}>
              {meta.scope === "all" ? t(`${NS}.text_scope_all`, "Showing every ticket in the workspace.") : t(`${NS}.text_scope_self`, "Showing the tickets you raised.")}
              {breached > 0 && <> · <span className={styles.breachText}>{t(`${NS}.text_breached_count`, "{count} past their SLA", { count: breached })}</span></>}
            </p>
          )}

          {state.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.text_loading_tickets`, "Loading tickets…")}</p>}
          {state.status === "error" && (
            <div className={styles.stateNote} role="alert">
              <p>{state.message}</p>
              <button type="button" className={styles.btnSecondary} onClick={() => void reload()}><RefreshCcw size={14} aria-hidden="true" />{t(`${NS}.text_retry`, "Retry")}</button>
            </div>
          )}
          {state.status === "ready" && tickets.length === 0 && (
            <p className={styles.stateNote}>
              {!state.meta.linkedEmployee && state.meta.scope === "self"
                ? t(`${NS}.text_no_profile`, "Your account is not linked to an employee profile, so you cannot raise or view tickets.")
                : category !== "all" || appliedSearch
                  ? t(`${NS}.text_no_match`, "No ticket matches these filters.")
                  : t(`${NS}.text_empty`, "No support tickets yet.")}
            </p>
          )}

          <div className={styles.ticketsGrid}>
            {tickets.map((ticket) => (
              <button type="button" key={ticket.id} className={styles.ticketCard} onClick={() => setSelectedId(ticket.id)}>
                <div className={styles.tktTop}>
                  <span className={styles.tktId}>{ticket.reference}</span>
                  <span className={`${styles.priorityBadge} ${PRIORITY_CLASS[ticket.priority] ?? ""}`}>{priorityLabel(ticket.priority, t)}</span>
                </div>
                <h4 className={styles.tktTitle}>{ticket.subject}</h4>
                <div className={styles.tktCategoryTag}>{optionLabel(meta?.categories ?? [], ticket.category, "category", t)}</div>
                <div className={styles.tktMeta}>
                  <div><strong>{t(`${NS}.text_by`, "By:")}</strong> {ticket.raisedBy.name ?? t(`${NS}.text_not_recorded`, "Not recorded")}</div>
                  <div><strong>{t(`${NS}.text_assignee`, "Assignee:")}</strong> {ticket.assignee.name ?? t(`${NS}.text_unassigned`, "Unassigned")}</div>
                </div>
                <div className={styles.tktBottom}>
                  <div className={`${styles.slaText} ${!isClosedStatus(ticket.status) && slaMinutesLeft(ticket, nowMs) < 0 ? styles.breachText : ""}`}>
                    <Clock size={13} aria-hidden="true" /> {slaLabel(ticket, nowMs, t)}
                  </div>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[ticket.status] ?? ""}`}>{optionLabel(meta?.statuses ?? [], ticket.status, "status", t)}</span>
                </div>
              </button>
            ))}
          </div>
          {state.status === "ready" && state.meta.hasMore && (
            <button type="button" className={styles.btnSecondary} onClick={() => void loadMore()}>{t(`${NS}.text_load_more`, "Load more tickets")}</button>
          )}
        </div>
      )}

      {activeTab === "policies" && (
        <HelpdeskPolicySearch onEscalate={(question) => { setActiveTab("tickets"); setRaise({ category: "policy_query", subject: question.slice(0, 200), description: question }); }} />
      )}

      {selected && meta && (
        <HelpdeskTicketDrawer ticket={selected} categories={meta.categories} statuses={meta.statuses} canManage={meta.canManage} nowMs={nowMs} onClose={() => setSelectedId(null)} onChanged={replaceTicket} />
      )}
      {raise && (
        <HelpdeskRaiseModal categories={meta?.categories ?? []} slaHours={meta?.slaHours ?? null} prefill={raise} onClose={() => setRaise(null)} onCreated={onCreated} />
      )}
    </div>
  );
}
