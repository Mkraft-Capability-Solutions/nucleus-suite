"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import { BookOpen, CheckCircle2, Download, Search, X } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "./PolicyHandbookModal.module.css";

/**
 * Policy handbook: the tenant's published policy versions from GET /api/v1/policy-acknowledgements, with the
 * viewer's own acknowledgement state. Acknowledging calls POST /api/v1/policy-acknowledgements/{id}/acknowledge;
 * the row changes only after the server records it. The policy document opens through the document download route.
 */

type PolicyStatus = "published" | "pending_acknowledgement" | "acknowledged" | "overdue";
type PolicyRow = {
  id: string; policy: string; policy_code: string; policy_version: string | null; audience: string;
  published_from: string | null; due_on: string | null; audience_count: number; acknowledged_count: number;
  acknowledged_on: string | null; status: PolicyStatus;
};
type State = { status: "loading" } | { status: "ready"; rows: PolicyRow[] } | { status: "error"; message: string };
type Translate = (key: string, fallback: string, params?: Record<string, unknown>) => string;

const STATUS_KEYS: Record<PolicyStatus, [string, string]> = {
  published: ["text_status_published", "Published"],
  pending_acknowledgement: ["text_status_pending", "Awaiting your acknowledgement"],
  acknowledged: ["text_status_acknowledged", "Acknowledged"],
  overdue: ["text_status_overdue", "Overdue"],
};
const NS = "components.Policies.PolicyHandbookModal";

export default function PolicyHandbookModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t: rawT, locale } = useTranslation();
  const t = rawT as Translate;
  const [state, setState] = useState<State>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/v1/policy-acknowledgements", { signal, cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: PolicyRow[]; error?: { message?: string } } | null;
      if (!response.ok || !Array.isArray(payload?.data)) throw new Error(payload?.error?.message || t(`${NS}.text_load_failed`, "Policies could not be loaded."));
      const rows = payload.data;
      setState({ status: "ready", rows });
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (error) {
      if (!signal?.aborted) setState({ status: "error", message: error instanceof Error ? error.message : t(`${NS}.text_load_failed`, "Policies could not be loaded.") });
    }
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [isOpen, load]);

  const rows = useMemo(() => (state.status === "ready" ? state.rows : []), [state]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? rows.filter((row) => `${row.policy} ${row.policy_code} ${row.audience}`.toLowerCase().includes(needle)) : rows;
  }, [rows, query]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium" }).format(new Date(iso)) : "—");

  const acknowledge = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/v1/policy-acknowledgements/${encodeURIComponent(selected.id)}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(comment.trim() ? { comment: comment.trim() } : {}),
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { error?: { message?: string } } | null) : null;
    setBusy(false);
    if (!response?.ok) {
      setNotice({ tone: "error", text: payload?.error?.message || t(`${NS}.text_ack_failed`, "Your acknowledgement could not be recorded. Try again.") });
      return;
    }
    setComment("");
    setNotice({ tone: "ok", text: t(`${NS}.text_ack_done`, "Acknowledgement recorded for {policy}.", { policy: selected.policy }) });
    await load();
  };

  return (
    <Dialog open={isOpen} onClose={() => !busy && onClose()} fullWidth maxWidth="lg" aria-labelledby="policy-handbook-title">
      <section className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true"><BookOpen size={20} /></span>
          <div className={styles.headText}>
            <h2 id="policy-handbook-title">{t(`${NS}.text_title`, "Policy handbook")}</h2>
            <p>{t(`${NS}.text_subtitle`, "Published company policies and your acknowledgement status.")}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} /></button>
        </header>

        <div className={styles.body}>
          <aside className={styles.list} aria-label={t(`${NS}.text_list`, "Policies")}>
            <label className={styles.search}>
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(`${NS}.text_search`, "Search policies")} aria-label={t(`${NS}.text_search`, "Search policies")} />
            </label>
            {state.status === "loading" && <p className={styles.note}>{t(`${NS}.text_loading`, "Loading policies…")}</p>}
            {state.status === "error" && <p className={styles.note} role="alert">{state.message}</p>}
            {state.status === "ready" && filtered.length === 0 && <p className={styles.note}>{rows.length === 0 ? t(`${NS}.text_empty`, "No policies have been published yet.") : t(`${NS}.text_no_match`, "No policy matches your search.")}</p>}
            {filtered.map((row) => (
              <button key={row.id} type="button" className={`${styles.item} ${row.id === selectedId ? styles.itemOn : ""}`} onClick={() => { setSelectedId(row.id); setNotice(null); }} aria-current={row.id === selectedId ? "true" : undefined}>
                <span className={styles.itemTitle}>{row.policy}</span>
                <span className={styles.itemMeta}>{row.policy_code}{row.policy_version ? ` · v${row.policy_version}` : ""}</span>
                <span className={`${styles.badge} ${styles[row.status]}`}>{t(`${NS}.${STATUS_KEYS[row.status][0]}`, STATUS_KEYS[row.status][1])}</span>
              </button>
            ))}
          </aside>

          <article className={styles.detail} aria-live="polite">
            {!selected && state.status === "ready" && <p className={styles.note}>{t(`${NS}.text_pick`, "Choose a policy to see its details.")}</p>}
            {selected && (
              <>
                <h3>{selected.policy}</h3>
                <dl className={styles.facts}>
                  <div><dt>{t(`${NS}.text_code`, "Code")}</dt><dd>{selected.policy_code}</dd></div>
                  <div><dt>{t(`${NS}.text_version`, "Version")}</dt><dd>{selected.policy_version ?? "—"}</dd></div>
                  <div><dt>{t(`${NS}.text_audience`, "Audience")}</dt><dd>{selected.audience}</dd></div>
                  <div><dt>{t(`${NS}.text_published`, "Published")}</dt><dd>{date(selected.published_from)}</dd></div>
                  <div><dt>{t(`${NS}.text_due`, "Acknowledge by")}</dt><dd>{date(selected.due_on)}</dd></div>
                  <div><dt>{t(`${NS}.text_coverage`, "Acknowledged")}</dt><dd>{t(`${NS}.text_coverage_value`, "{done} of {total}", { done: selected.acknowledged_count, total: selected.audience_count })}</dd></div>
                </dl>
                <a className={styles.secondary} href={`/api/v1/documents/${encodeURIComponent(selected.id)}/download`} target="_blank" rel="noopener noreferrer">
                  <Download size={16} aria-hidden="true" />{t(`${NS}.text_open_document`, "Open policy document")}
                </a>
                {selected.acknowledged_on ? (
                  <p className={styles.done}><CheckCircle2 size={16} aria-hidden="true" />{t(`${NS}.text_you_acknowledged`, "You acknowledged this policy on {date}.", { date: date(selected.acknowledged_on) })}</p>
                ) : (
                  <div className={styles.ack}>
                    <label>
                      <span>{t(`${NS}.text_comment`, "Comment (optional)")}</span>
                      <textarea value={comment} maxLength={500} rows={3} onChange={(event) => setComment(event.target.value)} />
                    </label>
                    <button type="button" className={styles.primary} onClick={() => void acknowledge()} disabled={busy}>
                      {busy ? t(`${NS}.text_acknowledging`, "Recording…") : t(`${NS}.text_acknowledge`, "I have read and acknowledge this policy")}
                    </button>
                  </div>
                )}
                {notice && <p className={notice.tone === "ok" ? styles.done : styles.error} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
              </>
            )}
          </article>
        </div>
      </section>
    </Dialog>
  );
}
