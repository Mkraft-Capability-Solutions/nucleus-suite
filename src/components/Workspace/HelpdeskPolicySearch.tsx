"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Search, Sparkles } from "lucide-react";
import styles from "./HelpdeskView.module.css";
import { failureMessage, readJson, useT } from "./engagement-client";
import { HELPDESK_NS as NS } from "./helpdesk-model";

/**
 * Grounded policy clause search. Passages come from the tenant's policy knowledge base
 * (GET /api/v1/ai/knowledge?q=), quoted verbatim with their source title and section. No answer is generated
 * and no confidence is invented: when nothing matches, the screen says so and offers to raise a ticket.
 * Quick-search chips are the tenant's published policies (GET /api/v1/policy-acknowledgements).
 */

type Passage = { title: string; section: string; text: string; checksum?: string };
type Result = { status: "idle" } | { status: "loading"; question: string } | { status: "ready"; question: string; passages: Passage[] } | { status: "error"; question: string; message: string };
type PolicyRow = { id: string; policy: string };

export default function HelpdeskPolicySearch({ onEscalate }: { onEscalate: (question: string) => void }) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [policies, setPolicies] = useState<{ status: "loading" | "ready" | "error"; rows: PolicyRow[]; message?: string }>({ status: "loading", rows: [] });

  useEffect(() => {
    const controller = new AbortController();
    readJson<{ data: PolicyRow[] }>("/api/v1/policy-acknowledgements", controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (!response.ok) setPolicies({ status: "error", rows: [], message: failureMessage(response, t, t(`${NS}.text_policies_failed`, "Published policies could not be loaded.")) });
        else setPolicies({ status: "ready", rows: response.body.data.slice(0, 6) });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [t]);

  const run = async (question: string) => {
    const q = question.trim();
    if (q.length < 3) {
      setResult({ status: "error", question: q, message: t(`${NS}.err_query_short`, "Type at least 3 characters to search the policies.") });
      return;
    }
    setResult({ status: "loading", question: q });
    const response = await readJson<{ data: Passage[] }>(`/api/v1/ai/knowledge?q=${encodeURIComponent(q)}&limit=5`);
    if (!response.ok) {
      setResult({ status: "error", question: q, message: failureMessage(response, t, t(`${NS}.text_search_failed`, "The policy library could not be searched.")) });
      return;
    }
    setResult({ status: "ready", question: q, passages: Array.isArray(response.body.data) ? response.body.data : [] });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(query);
  };

  return (
    <div className={styles.policySection}>
      <form className={styles.searchBarWrapper} onSubmit={submit} role="search">
        <Search size={20} aria-hidden="true" className={styles.searchIcon} />
        <label className={styles.srOnly} htmlFor="helpdesk-policy-query">{t(`${NS}.text_policy_query_label`, "Policy question")}</label>
        <input id="helpdesk-policy-query" type="text" value={query} maxLength={300} onChange={(event) => setQuery(event.target.value)} placeholder={t(`${NS}.text_policy_placeholder`, "Ask a policy question, for example leave carry-forward or notice period")} className={styles.policySearchInput} />
        <button type="submit" className={styles.btnPrimary} disabled={result.status === "loading"}>
          <Sparkles size={16} aria-hidden="true" />{t(`${NS}.text_search_clauses`, "Search clauses")}
        </button>
      </form>

      <div className={styles.promptsRow}>
        <span className={styles.promptLabel}>{t(`${NS}.text_published_policies`, "Published policies:")}</span>
        {policies.status === "loading" && <span className={styles.muted}>{t(`${NS}.text_loading`, "Loading…")}</span>}
        {policies.status === "error" && <span className={styles.muted}>{policies.message}</span>}
        {policies.status === "ready" && policies.rows.length === 0 && <span className={styles.muted}>{t(`${NS}.text_no_policies`, "No policies have been published yet.")}</span>}
        {policies.rows.map((row) => (
          <button key={row.id} type="button" className={styles.promptBtn} onClick={() => { setQuery(row.policy); void run(row.policy); }}>{row.policy}</button>
        ))}
      </div>

      {result.status !== "idle" && (
        <section className={styles.groundedCard} aria-live="polite" aria-busy={result.status === "loading"}>
          <div className={styles.groundedHeader}>
            <div className={styles.groundedBadge}>{result.question}</div>
            <span className={styles.strictTag}>{t(`${NS}.text_strict_grounding`, "Quoted from your policy library only")}</span>
          </div>
          {result.status === "loading" && <p className={styles.muted}>{t(`${NS}.text_searching`, "Searching the policy library…")}</p>}
          {result.status === "error" && <p className={styles.formError} role="alert">{result.message}</p>}
          {result.status === "ready" && result.passages.length === 0 && (
            <p className={styles.answerText}>{t(`${NS}.text_no_clause`, "No policy clause in your library matches this question. Raise a ticket and the helpdesk will answer it.")}</p>
          )}
          {result.status === "ready" && result.passages.length > 0 && (
            <div className={styles.citationsSection}>
              <h4>{t(`${NS}.text_matching_clauses`, "Matching policy clauses")}</h4>
              <div className={styles.citationList}>
                {result.passages.map((passage, index) => (
                  <div key={passage.checksum ?? `${passage.title}-${index}`} className={styles.citationBox}>
                    <div className={styles.citationHead}>
                      <strong><BookOpen size={14} aria-hidden="true" /> {passage.title}</strong>
                      <span>{passage.section}</span>
                    </div>
                    <blockquote className={styles.quoteText}>{passage.text}</blockquote>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={styles.groundedFooter}>
            <span className={styles.feedbackText}>{t(`${NS}.text_feedback_unavailable`, "Rating answers needs an assistant run; clause search does not create one.")}</span>
            <div className={styles.feedbackBtns}>
              <button type="button" className={styles.btnThumb} disabled title={t(`${NS}.text_feedback_unavailable`, "Rating answers needs an assistant run; clause search does not create one.")}>{t(`${NS}.text_helpful_yes`, "Helpful")}</button>
              <button type="button" className={styles.btnThumb} disabled title={t(`${NS}.text_feedback_unavailable`, "Rating answers needs an assistant run; clause search does not create one.")}>{t(`${NS}.text_helpful_no`, "Not helpful")}</button>
              <button type="button" className={styles.btnEscalate} onClick={() => onEscalate(result.question)}>{t(`${NS}.text_escalate`, "Raise a ticket with this question")}</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
