"use client";

import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { formatDateTime, getData, type AuditEvent, type AuditPage } from "./adminApi";
import { StateBox, useT } from "./AdminParts";
import styles from "./Admin.module.css";

/** Tenant audit trail from GET /api/v1/audit/events (audit.read), cursor-paginated, with CSV export. */

const NS = "components.Workspace.AuditLogTable";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: AuditEvent[]; nextCursor: string | null };

export default function AuditLogTable({ scope }: { scope: "all" | "access" | "security" | "settings" | "integrations" }) {
  const t = useT();
  const { locale } = useTranslation();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "loading" });
  const [more, setMore] = useState(false);
  const [generation, setGeneration] = useState(0);
  const fallback = t(`${NS}.text_failed`, "The audit trail could not be loaded.");

  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ scope, limit: "25" });
    if (query) params.set("search", query);
    getData<AuditPage>(`/api/v1/audit/events?${params.toString()}`, fallback, controller.signal).then(
      (page) => { if (!controller.signal.aborted) setState({ status: "ready", items: page.items, nextCursor: page.nextCursor }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : fallback }); },
    );
    return () => controller.abort();
  }, [scope, query, fallback, generation]);

  const loadMore = async () => {
    if (state.status !== "ready" || !state.nextCursor || more) return;
    setMore(true);
    const params = new URLSearchParams({ scope, limit: "25", cursor: state.nextCursor });
    if (query) params.set("search", query);
    try {
      const page = await getData<AuditPage>(`/api/v1/audit/events?${params.toString()}`, fallback);
      setState({ status: "ready", items: [...state.items, ...page.items], nextCursor: page.nextCursor });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : fallback });
    } finally {
      setMore(false);
    }
  };

  return (
    <div className={styles.toggleList}>
      <div className={styles.row}>
        <label className={styles.search} style={{ flex: 1 }}>
          <Search size={15} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t(`${NS}.text_search`, "Search action, record or person")} aria-label={t(`${NS}.text_search`, "Search action, record or person")} />
        </label>
        <a className={styles.btnSecondary} href="/api/v1/audit/export" target="_blank" rel="noopener noreferrer">
          <Download size={15} aria-hidden="true" />{t(`${NS}.text_export`, "Export audit CSV")}
        </a>
      </div>
      {state.status === "loading" && <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading the audit trail…")}</StateBox>}
      {state.status === "error" && <StateBox tone="error" onRetry={() => { setState({ status: "loading" }); setGeneration((value) => value + 1); }} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>}
      {state.status === "ready" && state.items.length === 0 && <StateBox tone="empty">{query ? t(`${NS}.text_no_match`, "No audit event matches your search.") : t(`${NS}.text_empty`, "No audit events have been recorded yet.")}</StateBox>}
      {state.status === "ready" && state.items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.help} style={{ captionSide: "bottom", padding: "0.5rem" }}>{t(`${NS}.text_caption`, "Most recent first. {count} shown.", { count: state.items.length })}</caption>
            <thead>
              <tr>
                <th scope="col">{t(`${NS}.col_action`, "Event action")}</th>
                <th scope="col">{t(`${NS}.col_record`, "Record")}</th>
                <th scope="col">{t(`${NS}.col_actor`, "Changed by")}</th>
                <th scope="col">{t(`${NS}.col_reason`, "Reason")}</th>
                <th scope="col">{t(`${NS}.col_time`, "Timestamp")}</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((event) => (
                <tr key={event.id}>
                  <td><span className={styles.mono}>{event.action}</span></td>
                  <td><span className={styles.mono}>{event.entityType}</span></td>
                  <td>{event.actorName || event.actorEmail || <span className={styles.muted}>{t(`${NS}.text_system`, "System")}</span>}</td>
                  <td>{event.reason || <span className={styles.muted}>—</span>}</td>
                  <td>{formatDateTime(event.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state.status === "ready" && state.nextCursor && (
        <button type="button" className={styles.btnSecondary} onClick={() => void loadMore()} disabled={more}>
          {more ? t(`${NS}.text_loading_more`, "Loading…") : t(`${NS}.text_more`, "Load older events")}
        </button>
      )}
    </div>
  );
}
